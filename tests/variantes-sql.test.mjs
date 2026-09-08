import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const administrador = '00000000-0000-4000-8000-000000000001';
const base = await readFile(new URL('../supabase/migrations/20260901000000_esquema_base_completo.sql', import.meta.url), 'utf8');
const migracion = await readFile(new URL('../supabase/migrations/20260903000000_variantes_y_stock_por_tipo.sql', import.meta.url), 'utf8');

test('migración de variantes en PostgreSQL: preservación, límites, seguridad y guardado atómico', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  // Infraestructura propia de Supabase simulada; el esquema y la migración son los reales.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text);
  `);
  // gen_random_uuid es nativo de PostgreSQL; PGlite no necesita la extensión pgcrypto.
  const baseLocal = base.replace('create extension if not exists pgcrypto;', '');
  await db.exec(baseLocal).catch(error => {
    console.error({ fase: 'base', detalle: error.detail, contexto: error.where, consulta: error.internalQuery, cerca: baseLocal.slice(Number(error.position) - 90, Number(error.position) + 140) });
    throw error;
  });
  await db.query('insert into auth.users values ($1)', [administrador]);
  await db.query("insert into perfiles_administradores(usuario_id,nombre) values ($1,'Pruebas')", [administrador]);
  const originales = (await db.query('select id,slug,sku,precio from productos order by id')).rows;
  const fotos = (await db.query('select id,url_publica from imagenes order by id')).rows;
  await db.exec(migracion).catch(error => {
    console.error({ detalle: error.detail, contexto: error.where, consulta: error.internalQuery, cerca: migracion.slice(Number(error.position) - 90, Number(error.position) + 140) });
    throw error;
  });
  await db.exec(migracion); // Reejecución segura.
  assert.deepEqual((await db.query('select id,slug,sku,precio from productos order by id')).rows, originales);
  assert.deepEqual((await db.query('select id,url_publica from imagenes order by id')).rows, fotos);
  assert.equal((await db.query("select count(*)::int n from variantes where clave='comun'")).rows[0].n, 1000);
  assert.equal((await db.query('select count(*)::int n from codigos_sku')).rows[0].n, 2000);
  assert.equal((await db.query("select has_function_privilege('anon','guardar_producto_con_variantes(uuid,jsonb,jsonb,uuid)','execute') permiso")).rows[0].permiso, false);
  const guardar = async (datos, variantes = [], id = null) => (await db.query(
    'select guardar_producto_con_variantes($1,$2::jsonb,$3::jsonb,$4) id', [id, JSON.stringify(datos), JSON.stringify(variantes), administrador],
  )).rows[0].id;
  const producto = { nombre: 'Llavero', slug: 'llavero-prueba', descripcion: 'Llavero de pruebas', tipo_producto: 'fisico', usa_variantes: true, estado: 'publicado' };
  let versiones = [{ clave: 'rojo', nombre: 'Rojo', precio: 4000, stock: 2, estado: 'publicado' }, { clave: 'azul', nombre: 'Azul', precio: 4500, stock: 0, estado: 'publicado' }];
  const id = await guardar(producto, versiones);
  versiones = (await db.query('select * from variantes where producto_id=$1 order by precio', [id])).rows;
  const sku = versiones.map(v => v.sku);
  assert.equal(new Set(sku).size, 2);
  assert.deepEqual((await db.query('select stock,precio,controla_stock from productos where id=$1', [id])).rows[0], { stock: 2, precio: '4000.00', controla_stock: true });
  await guardar({ ...producto, nombre: 'Llavero editado', slug: 'no-cambiar' }, [{ ...versiones[0], precio: 5000, stock: 3 }, versiones[1]], id);
  assert.equal((await db.query('select slug from productos where id=$1', [id])).rows[0].slug, 'llavero-prueba');
  assert.deepEqual((await db.query('select sku from variantes where producto_id=$1 order by clave desc', [id])).rows.map(v => v.sku).sort(), sku.sort());
  assert.equal((await db.query('select count(*)::int n from historial_precios where variante_id=$1', [versiones[0].id])).rows[0].n, 1);
  await assert.rejects(guardar(producto, [{ ...versiones[0], stock: null }], id), /stock físico es obligatorio/);
  await assert.rejects(guardar(producto, [], id), /cantidad de variantes/);
  await assert.rejects(guardar(producto, [{ ...versiones[0], clave: 'otro' }], id), /identidad/);
  await assert.rejects(guardar(producto, Array.from({ length: 11 }, (_, i) => ({ ...versiones[0], id: undefined, clave: String(i) })), id), /cantidad/);
  assert.equal((await db.query('select count(*)::int n from variantes where producto_id=$1 and estado=\'publicado\'', [id])).rows[0].n, 2);
  // Archivar y recuperar conserva el ID y SKU.
  await guardar(producto, [versiones[0]], id);
  assert.equal((await db.query('select estado from variantes where id=$1', [versiones[1].id])).rows[0].estado, 'archivado');
  await guardar(producto, versiones, id);
  assert.equal((await db.query('select sku from variantes where id=$1', [versiones[1].id])).rows[0].sku, versiones[1].sku);
  const foto = (varianteId) => db.query("insert into imagenes(producto_id,variante_id,url_publica,texto_alternativo) values ($1,$2,'/foto.webp','Foto')", [id, varianteId]);
  await foto(versiones[0].id); await foto(versiones[0].id); await foto(versiones[0].id);
  await assert.rejects(foto(versiones[0].id), /máximo de imágenes/);
  await foto(versiones[1].id);
  const sticker = originales[0];
  await assert.rejects(db.query("insert into imagenes(producto_id,variante_id,url_publica,texto_alternativo) values ($1,$2,'/foto.webp','Foto')", [sticker.id, versiones[0].id]), /no pertenece/);
  await assert.rejects(db.query('update productos set stock=null where id=$1', [id]), /stock físico/);
  await db.query('update productos set controla_stock=true,stock=30 where id=$1', [sticker.id]);
  assert.deepEqual((await db.query('select stock,controla_stock from productos where id=$1', [sticker.id])).rows[0], { stock: null, controla_stock: false });
  const plantilla = await guardar({ nombre: 'Plantilla', slug: 'plantilla-prueba', descripcion: 'Plantilla', tipo_producto: 'plantilla', estado: 'publicado', precio: 900, stock: 10 });
  assert.equal((await db.query('select stock from productos where id=$1', [plantilla])).rows[0].stock, null);
  await assert.rejects(guardar({ ...producto, slug: 'fallo-atomico' }, [{ clave: 'x', nombre: 'X', precio: 1, stock: -1, estado: 'publicado' }]), /stock/);
  assert.equal((await db.query("select count(*)::int n from productos where slug='fallo-atomico'")).rows[0].n, 0);
  // RLS real de PostgreSQL: un visitante solo ve versiones publicadas y sus imágenes.
  await guardar(producto, [{ ...versiones[0], estado: 'publicado' }, { ...versiones[1], estado: 'borrador' }], id);
  await db.exec('grant usage on schema public,auth to anon; grant select on all tables in schema public to anon; set role anon;');
  assert.equal((await db.query('select count(*)::int n from variantes where producto_id=$1', [id])).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from imagenes where variante_id=$1', [versiones[1].id])).rows[0].n, 0);
  await assert.rejects(db.query('select guardar_producto_con_variantes($1,$2::jsonb,$3::jsonb,$4)', [id, '{}', '[]', administrador]), /permission denied/);
  await db.exec('reset role;');
  await assert.rejects(db.query('select guardar_producto_con_variantes($1,$2::jsonb,$3::jsonb,$4)', [id, JSON.stringify(producto), JSON.stringify(versiones), '00000000-0000-4000-8000-000000000099']), /permisos/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const administrador = '00000000-0000-4000-8000-000000000001';
const base = await readFile(new URL('../supabase/migrations/20260901000000_esquema_base_completo.sql', import.meta.url), 'utf8');
const migracion = await readFile(new URL('../supabase/migrations/20260928000000_sistema_pedidos_etapa_1.sql', import.meta.url), 'utf8');
const etapa2 = await readFile(new URL('../supabase/migrations/20260928120000_sistema_pedidos_etapa_2.sql', import.meta.url), 'utf8');

const clave = sufijo => `idempotencia-prueba-${sufijo}`;

test('Etapa 1: migración repetible, RLS, dinero derivado, stock y cupones idempotentes', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text);
  `);
  await db.exec(base.replace('create extension if not exists pgcrypto;', ''));
  // Columna incorporada por la migración de variantes; basta para aislar estas pruebas del dominio de pedidos.
  await db.exec('alter table public.productos add column usa_variantes boolean not null default false;');
  await db.exec(migracion);
  await db.exec(migracion); // La estructura puede validarse de nuevo sin duplicar objetos ni flags.
  await db.exec(etapa2);
  await db.exec(etapa2); // También es repetible sobre una Etapa 1 ya aplicada.

  const tablas = [
    'pedidos', 'pedido_items', 'reservas_stock', 'pagos', 'transferencias_pago', 'eventos_pago',
    'reembolsos', 'historial_pedidos', 'tokens_consulta_pedido', 'notificaciones_outbox',
    'cupones', 'cupon_reservas', 'cupon_usos', 'historial_cupones',
  ];
  for (const tabla of tablas) {
    assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass', [`public.${tabla}`])).rows[0].relrowsecurity, true);
    assert.equal((await db.query('select has_table_privilege(\'anon\',$1,\'select\') permiso', [`public.${tabla}`])).rows[0].permiso, false);
    assert.equal((await db.query('select has_table_privilege(\'authenticated\',$1,\'select\') permiso', [`public.${tabla}`])).rows[0].permiso, false);
  }
  assert.equal((await db.query("select has_function_privilege('anon','reservar_stock_pedido(uuid,text,integer)','execute') permiso")).rows[0].permiso, false);
  assert.equal((await db.query("select has_function_privilege('authenticated','marcar_transferencia_pago_aprobado(uuid,bigint,tipo_pago_pedido,uuid,text,text,text)','execute') permiso")).rows[0].permiso, false);
  assert.equal((await db.query("select has_function_privilege('service_role','reservar_stock_pedido(uuid,text,integer)','execute') permiso")).rows[0].permiso, true);
  assert.equal((await db.query("select count(*)::int n from productos where compra_automatica_habilitada")).rows[0].n, 0);
  assert.deepEqual(
    (await db.query("select clave,valor from configuraciones_sitio where clave in ('transferencias_checkout_habilitadas','mercado_pago_checkout_habilitado','correos_transaccionales_habilitados') order by clave")).rows,
    [
      { clave: 'correos_transaccionales_habilitados', valor: false },
      { clave: 'mercado_pago_checkout_habilitado', valor: false },
      { clave: 'transferencias_checkout_habilitadas', valor: false },
    ],
  );

  await db.query('insert into auth.users(id) values ($1)', [administrador]);
  await db.query("insert into perfiles_administradores(usuario_id,nombre) values ($1,'Administradora')", [administrador]);
  const categoria = (await db.query("insert into categorias(nombre,slug,tipo_producto) values ('Físicos etapa 1','fisicos-etapa-1','fisico') returning id")).rows[0].id;
  const producto = (await db.query(`
    insert into productos(categoria_id,tipo_producto,nombre,slug,precio,controla_stock,stock,estado,compra_automatica_habilitada)
    values ($1,'fisico','Producto con última unidad','producto-ultima-unidad',10000,true,1,'publicado',true) returning id
  `, [categoria])).rows[0].id;

  const productoAutomaticoEtapa2 = (await db.query(`
    insert into productos(categoria_id,tipo_producto,nombre,slug,precio,controla_stock,stock,estado,compra_automatica_habilitada)
    values ($1,'fisico','Automático etapa 2','automatico-etapa-2',123.45,true,5,'publicado',true) returning id
  `, [categoria])).rows[0].id;
  const productoCoordinadoEtapa2 = (await db.query(`
    insert into productos(categoria_id,tipo_producto,nombre,slug,precio,controla_stock,stock,estado)
    values ($1,'fisico','Coordinado etapa 2','coordinado-etapa-2',200,true,10,'publicado') returning id
  `, [categoria])).rows[0].id;
  await db.query('select configurar_modo_compra_producto_administracion($1,true,false,$2)', [productoCoordinadoEtapa2, administrador]);
  assert.equal((await db.query('select compra_automatica_habilitada from productos where id=$1', [productoCoordinadoEtapa2])).rows[0].compra_automatica_habilitada, true);
  await assert.rejects(
    db.query('select configurar_modo_compra_producto_administracion($1,true,true,$2)', [productoCoordinadoEtapa2, administrador]),
    /personalizado no puede usar compra automática/,
  );
  await db.query('select configurar_modo_compra_producto_administracion($1,false,false,$2)', [productoCoordinadoEtapa2, administrador]);
  const crearSolicitud = async ({ sufijo, lineas, cupon = null, hash = 0x10 }) => (await db.query(`
    select crear_solicitud_pedido($1::jsonb,'Cliente Etapa 2','cliente-etapa2@example.test','+5491155555555',
      'Prueba sin dinero real',$2,$3,$4,$5,$6) pedido
  `, [
    JSON.stringify(lineas), cupon, clave(`solicitud-${sufijo}`), Buffer.alloc(32, hash),
    Buffer.alloc(32, 0x20), Buffer.alloc(32, hash + 1),
  ])).rows[0].pedido;

  const solicitudCoordinada = await crearSolicitud({
    sufijo: 'coordinada', lineas: [{ producto_id: productoCoordinadoEtapa2, cantidad: 2 }],
  });
  assert.equal(solicitudCoordinada.tipo, 'coordinado');
  assert.equal(solicitudCoordinada.total_centavos, 40000);
  const snapshotCoordinado = (await db.query('select producto_nombre,precio_unitario_centavos,cantidad from pedido_items where pedido_id=$1', [solicitudCoordinada.id])).rows[0];
  assert.deepEqual(snapshotCoordinado, { producto_nombre: 'Coordinado etapa 2', precio_unitario_centavos: 20000, cantidad: 2 });

  const solicitudAutomatica = await crearSolicitud({
    sufijo: 'automatica', lineas: [{ producto_id: productoAutomaticoEtapa2, cantidad: 2 }], hash: 0x30,
  });
  assert.equal(solicitudAutomatica.tipo, 'automatico');
  assert.equal(solicitudAutomatica.total_centavos, 24690);
  assert.equal((await db.query('select count(*)::int n from reservas_stock where pedido_id=$1 and estado=\'activa\'', [solicitudAutomatica.id])).rows[0].n, 1);
  const repetida = await crearSolicitud({
    sufijo: 'automatica', lineas: [{ producto_id: productoAutomaticoEtapa2, cantidad: 2 }], hash: 0x30,
  });
  assert.equal(repetida.id, solicitudAutomatica.id);
  await assert.rejects(
    crearSolicitud({ sufijo: 'automatica', lineas: [{ producto_id: productoAutomaticoEtapa2, cantidad: 1 }], hash: 0x31 }),
    /idempotencia ya fue usada/,
  );

  const solicitudMixta = await crearSolicitud({
    sufijo: 'mixta',
    lineas: [
      { producto_id: productoAutomaticoEtapa2, cantidad: 1 },
      { producto_id: productoCoordinadoEtapa2, cantidad: 1 },
    ],
    hash: 0x40,
  });
  assert.equal(solicitudMixta.tipo, 'coordinado');
  assert.equal((await db.query('select count(*)::int n from reservas_stock where pedido_id=$1', [solicitudMixta.id])).rows[0].n, 0);

  const cuponEtapa2 = (await db.query(`select guardar_cupon_administracion(null,$1::jsonb,'{}'::uuid[],'{}'::uuid[],'{}'::uuid[],$2) id`, [
    JSON.stringify({
      codigo: 'etapa2-10', descripcion_interna: 'Creado por RPC', activo: true,
      tipo_descuento: 'porcentaje', porcentaje_puntos_base: 1000,
      compra_minima_centavos: 0, alcance: 'todos', aplica_tipo_pedido: 'automatico',
    }), administrador,
  ])).rows[0].id;
  assert.equal((await db.query('select codigo_normalizado from cupones where id=$1', [cuponEtapa2])).rows[0].codigo_normalizado, 'ETAPA2-10');
  const solicitudConCupon = await crearSolicitud({
    sufijo: 'con-cupon', lineas: [{ producto_id: productoAutomaticoEtapa2, cantidad: 1 }], cupon: 'eTaPa2-10', hash: 0x50,
  });
  assert.equal(solicitudConCupon.descuento_centavos, 1234);
  assert.equal(solicitudConCupon.total_centavos, 11111);
  assert.equal((await db.query('select count(*)::int n from historial_cupones where cupon_id=$1', [cuponEtapa2])).rows[0].n, 1);

  const estadoActualizado = (await db.query(
    "select actualizar_estado_pedido_administracion($1,'estado_preparacion','en_preparacion',$2,'Prueba administrativa') estado",
    [solicitudCoordinada.id, administrador],
  )).rows[0].estado;
  assert.equal(estadoActualizado.estado_preparacion, 'en_preparacion');
  assert.equal((await db.query(
    "select count(*)::int n from historial_pedidos where pedido_id=$1 and evento='estado_actualizado'",
    [solicitudCoordinada.id],
  )).rows[0].n, 1);

  const tokenAnterior = (await db.query(
    'select id from tokens_consulta_pedido where pedido_id=$1 and revocado_en is null',
    [solicitudCoordinada.id],
  )).rows[0].id;
  const tokenNuevo = (await db.query(
    'select rotar_token_consulta_pedido_administracion($1,$2,$3,30) id',
    [solicitudCoordinada.id, Buffer.alloc(32, 0xab), administrador],
  )).rows[0].id;
  assert.notEqual(tokenNuevo, tokenAnterior);
  assert.equal((await db.query('select revocado_en is not null valor from tokens_consulta_pedido where id=$1', [tokenAnterior])).rows[0].valor, true);
  assert.equal((await db.query('select revocado_en is null valor from tokens_consulta_pedido where id=$1', [tokenNuevo])).rows[0].valor, true);

  assert.equal((await db.query(
    'select alternar_cupon_administracion($1,false,$2) activo',
    [cuponEtapa2, administrador],
  )).rows[0].activo, false);
  assert.equal((await db.query('select activo from cupones where id=$1', [cuponEtapa2])).rows[0].activo, false);

  const limiteHash = Buffer.alloc(32, 0xee);
  assert.equal((await db.query("select consumir_limite_solicitudes($1,'crear_pedido',2,60) permitido", [limiteHash])).rows[0].permitido, true);
  assert.equal((await db.query("select consumir_limite_solicitudes($1,'crear_pedido',2,60) permitido", [limiteHash])).rows[0].permitido, true);
  assert.equal((await db.query("select consumir_limite_solicitudes($1,'crear_pedido',2,60) permitido", [limiteHash])).rows[0].permitido, false);

  const crearPedidoAutomatico = async (sufijo, subtotal = 10000) => {
    const pedido = (await db.query(`
      insert into pedidos(tipo,cliente_nombre,cliente_correo,cliente_whatsapp,envio_definido,
        subtotal_centavos,total_centavos,clave_idempotencia)
      values ('automatico','Cliente Prueba',$1,'+5491100000000',true,$2,$2,$3) returning id
    `, [`cliente-${sufijo}@example.test`, subtotal, clave(`pedido-${sufijo}`)])).rows[0].id;
    await db.query(`
      insert into pedido_items(pedido_id,producto_id,categoria_id,producto_nombre,sku,descripcion,
        precio_unitario_centavos,cantidad,subtotal_centavos,compra_automatica,requiere_reserva_stock)
      values ($1,$2,$3,'Producto con última unidad','PF-TEST','Snapshot',10000,1,10000,true,true)
    `, [pedido, producto, categoria]);
    return pedido;
  };

  const pedidoStockA = await crearPedidoAutomatico('stock-a');
  const pedidoStockB = await crearPedidoAutomatico('stock-b');
  const intentosReserva = await Promise.allSettled([
    db.query('select id from reservar_stock_pedido($1,$2,20)', [pedidoStockA, clave('reserva-a')]),
    db.query('select id from reservar_stock_pedido($1,$2,20)', [pedidoStockB, clave('reserva-b')]),
  ]);
  assert.equal(intentosReserva.filter(resultado => resultado.status === 'fulfilled').length, 1);
  assert.equal(intentosReserva.filter(resultado => resultado.status === 'rejected').length, 1);
  const pedidoReservado = intentosReserva[0].status === 'fulfilled' ? pedidoStockA : pedidoStockB;
  const claveReserva = intentosReserva[0].status === 'fulfilled' ? clave('reserva-a') : clave('reserva-b');
  const primeraReserva = (await db.query('select id from reservas_stock where pedido_id=$1', [pedidoReservado])).rows[0].id;
  assert.equal((await db.query('select id from reservar_stock_pedido($1,$2,20)', [pedidoReservado, claveReserva])).rows[0].id, primeraReserva);
  assert.equal(await db.query('select consumir_reservas_stock($1,$2) consumidas', [pedidoReservado, clave('consumo-stock')]).then(r => r.rows[0].consumidas), 1);
  assert.equal(await db.query('select consumir_reservas_stock($1,$2) consumidas', [pedidoReservado, clave('consumo-stock')]).then(r => r.rows[0].consumidas), 0);
  assert.equal((await db.query('select stock from productos where id=$1', [producto])).rows[0].stock, 0);
  assert.equal((await db.query('select count(*)::int n from movimientos_stock where pedido_id=$1', [pedidoReservado])).rows[0].n, 1);
  const itemInmutable = (await db.query('select id from pedido_items where pedido_id=$1', [pedidoReservado])).rows[0].id;
  await assert.rejects(db.query("update pedido_items set descripcion='Alterado' where id=$1", [itemInmutable]), /inmutables/);
  await assert.rejects(db.query('delete from pedidos where id=$1', [pedidoReservado]), /inmutables/);
  await assert.rejects(
    db.query("select marcar_transferencia_pago_aprobado($1,10000,'total',$2,$3,null,null)", [pedidoReservado, administrador, clave('transferencia-auto')]),
    /solamente a pedidos coordinados/,
  );

  const pedidoCoordinado = (await db.query(`
    insert into pedidos(tipo,cliente_nombre,cliente_correo,cliente_whatsapp,envio_definido,
      subtotal_centavos,total_centavos,anticipo_objetivo_centavos,clave_idempotencia)
    values ('coordinado','Cliente Coordinado','coordinado@example.test','+5491122222222',true,10000,10000,5000,$1) returning id
  `, [clave('pedido-coordinado')])).rows[0].id;
  const pagoAnticipo = (await db.query(
    "select marcar_transferencia_pago_aprobado($1,5000,'anticipo',$2,$3,'TRX-1','Comprobante verificado') id",
    [pedidoCoordinado, administrador, clave('pago-anticipo')],
  )).rows[0].id;
  assert.equal((await db.query('select estado_financiero from pedidos where id=$1', [pedidoCoordinado])).rows[0].estado_financiero, 'anticipo_pagado');
  assert.equal((await db.query(
    "select marcar_transferencia_pago_aprobado($1,5000,'anticipo',$2,$3,'TRX-1','Comprobante verificado') id",
    [pedidoCoordinado, administrador, clave('pago-anticipo')],
  )).rows[0].id, pagoAnticipo);
  await assert.rejects(
    db.query("select marcar_transferencia_pago_aprobado($1,4000,'anticipo',$2,$3,null,null)", [pedidoCoordinado, administrador, clave('pago-anticipo')]),
    /idempotencia ya fue usada/,
  );
  assert.equal((await db.query('select count(*)::int n from pagos where pedido_id=$1', [pedidoCoordinado])).rows[0].n, 1);
  await db.query(
    "select marcar_transferencia_pago_aprobado($1,5000,'saldo',$2,$3,'TRX-2',null)",
    [pedidoCoordinado, administrador, clave('pago-saldo')],
  );
  assert.equal((await db.query('select estado_financiero from pedidos where id=$1', [pedidoCoordinado])).rows[0].estado_financiero, 'pagado');
  assert.equal((await db.query('select count(*)::int n from notificaciones_outbox where pedido_id=$1', [pedidoCoordinado])).rows[0].n, 2);
  await assert.rejects(
    db.query('update pedidos set subtotal_centavos=9000,total_centavos=9000 where id=$1', [pedidoCoordinado]),
    /debajo de lo cobrado/,
  );
  await assert.rejects(
    db.query("update pedidos set estado_financiero='sin_cobro' where id=$1", [pedidoCoordinado]),
    /estado financiero se deriva/,
  );
  await assert.rejects(
    db.query(`insert into pagos(pedido_id,metodo,tipo,estado,importe_centavos,origen_verificacion,
      clave_idempotencia,proveedor,id_externo,aprobado_en)
      values ($1,'mercado_pago','total','aprobado',1,'mercado_pago',$2,'mercado_pago','mp-extra',now())`,
    [pedidoCoordinado, clave('pago-excedente')]),
    /superar el total/,
  );

  await db.query(`insert into reembolsos(pedido_id,estado,importe_centavos,motivo,clave_idempotencia,usuario_id,procesado_en)
    values ($1,'aprobado',2000,'Devolución parcial',$2,$3,now())`, [pedidoCoordinado, clave('reembolso-parcial'), administrador]);
  assert.equal((await db.query('select estado_financiero from pedidos where id=$1', [pedidoCoordinado])).rows[0].estado_financiero, 'parcialmente_reembolsado');
  await assert.rejects(
    db.query(`insert into reembolsos(pedido_id,estado,importe_centavos,motivo,clave_idempotencia,usuario_id,procesado_en)
      values ($1,'aprobado',8001,'Importe inválido',$2,$3,now())`, [pedidoCoordinado, clave('reembolso-exceso'), administrador]),
    /superar lo cobrado/,
  );
  await db.query(`insert into reembolsos(pedido_id,estado,importe_centavos,motivo,clave_idempotencia,usuario_id,procesado_en)
    values ($1,'aprobado',8000,'Devolución final',$2,$3,now())`, [pedidoCoordinado, clave('reembolso-total'), administrador]);
  assert.equal((await db.query('select estado_financiero from pedidos where id=$1', [pedidoCoordinado])).rows[0].estado_financiero, 'reembolsado');

  const pedidoEnvioPendiente = (await db.query(`
    insert into pedidos(tipo,cliente_nombre,cliente_correo,cliente_whatsapp,requiere_envio,envio_definido,
      subtotal_centavos,total_centavos,clave_idempotencia)
    values ('coordinado','Con envío','envio@example.test','+5491133333333',true,false,1000,1000,$1) returning id
  `, [clave('pedido-envio')])).rows[0].id;
  await assert.rejects(
    db.query("select marcar_transferencia_pago_aprobado($1,1000,'total',$2,$3,null,null)", [pedidoEnvioPendiente, administrador, clave('pago-envio')]),
    /envío debe estar definido/,
  );

  const productoCupon = (await db.query(`
    insert into productos(categoria_id,tipo_producto,nombre,slug,precio,controla_stock,stock,estado,compra_automatica_habilitada)
    values ($1,'fisico','Producto cupón','producto-cupon',10000,true,5,'publicado',true) returning id
  `, [categoria])).rows[0].id;
  const crearPedidoCupon = async sufijo => {
    const pedido = (await db.query(`
      insert into pedidos(tipo,cliente_nombre,cliente_correo,cliente_whatsapp,envio_definido,
        subtotal_centavos,total_centavos,clave_idempotencia)
      values ('automatico','Cliente Cupón',$1,'+5491144444444',true,10000,10000,$2) returning id
    `, [`cupon-${sufijo}@example.test`, clave(`pedido-cupon-${sufijo}`)])).rows[0].id;
    await db.query(`insert into pedido_items(pedido_id,producto_id,categoria_id,producto_nombre,precio_unitario_centavos,
      cantidad,subtotal_centavos,compra_automatica)
      values ($1,$2,$3,'Producto cupón',10000,1,10000,true)`, [pedido, productoCupon, categoria]);
    return pedido;
  };
  const cupon = (await db.query(`
    insert into cupones(codigo,codigo_normalizado,tipo_descuento,porcentaje_puntos_base,
      descuento_maximo_centavos,limite_usos_total,limite_usos_comprador,creado_por)
    values ('Sol10','SOL10','porcentaje',1000,1500,1,1,$1) returning id
  `, [administrador])).rows[0].id;
  const pedidoCuponA = await crearPedidoCupon('a');
  const pedidoCuponB = await crearPedidoCupon('b');
  const hashA = Buffer.alloc(32, 0xaa);
  const hashB = Buffer.alloc(32, 0xbb);
  const intentosCupon = await Promise.allSettled([
    db.query('select (reservar_cupon_pedido($1,$2,$3,$4,20)).id id', [pedidoCuponA, 'sol10', hashA, clave('cupon-a')]),
    db.query('select (reservar_cupon_pedido($1,$2,$3,$4,20)).id id', [pedidoCuponB, 'SOL10', hashB, clave('cupon-b')]),
  ]);
  assert.equal(intentosCupon.filter(resultado => resultado.status === 'fulfilled').length, 1);
  assert.equal(intentosCupon.filter(resultado => resultado.status === 'rejected').length, 1);
  const pedidoConCupon = intentosCupon[0].status === 'fulfilled' ? pedidoCuponA : pedidoCuponB;
  const hashGanador = intentosCupon[0].status === 'fulfilled' ? hashA : hashB;
  const claveCupon = intentosCupon[0].status === 'fulfilled' ? clave('cupon-a') : clave('cupon-b');
  const reservaCupon = (await db.query('select id from cupon_reservas where pedido_id=$1', [pedidoConCupon])).rows[0].id;
  assert.equal((await db.query('select (reservar_cupon_pedido($1,$2,$3,$4,20)).id id', [pedidoConCupon, 'sOl10', hashGanador, claveCupon])).rows[0].id, reservaCupon);
  const otroPedidoCupon = pedidoConCupon === pedidoCuponA ? pedidoCuponB : pedidoCuponA;
  await assert.rejects(
    db.query('select (reservar_cupon_pedido($1,$2,$3,$4,20)).id', [otroPedidoCupon, 'SOL10', Buffer.alloc(32, 0xdd), claveCupon]),
    /idempotencia ya fue usada/,
  );
  assert.deepEqual((await db.query('select descuento_centavos,total_centavos from pedidos where id=$1', [pedidoConCupon])).rows[0], { descuento_centavos: 1000, total_centavos: 9000 });
  const uso = (await db.query('select confirmar_cupon_pedido($1,$2) id', [pedidoConCupon, clave('confirmar-cupon')])).rows[0].id;
  assert.equal((await db.query('select confirmar_cupon_pedido($1,$2) id', [pedidoConCupon, clave('confirmar-cupon')])).rows[0].id, uso);
  await db.query("update cupones set porcentaje_puntos_base=500 where id=$1", [cupon]);
  assert.equal((await db.query("select regla_snapshot->>'porcentaje_puntos_base' valor from pedido_cupones where pedido_id=$1", [pedidoConCupon])).rows[0].valor, '1000');
  await assert.rejects(db.query('update cupon_usos set descuento_centavos=1 where id=$1', [uso]), /inmutables/);
  await assert.rejects(db.query('delete from cupones where id=$1', [cupon]), /foreign key|violates/i);

  const pedidoCuponExpira = intentosCupon[0].status === 'fulfilled' ? pedidoCuponB : pedidoCuponA;
  await db.query(`insert into cupones(codigo,codigo_normalizado,tipo_descuento,importe_fijo_centavos)
    values ('Expira500','EXPIRA500','fijo',500)`);
  await db.query('select (reservar_cupon_pedido($1,$2,$3,$4,20)).id', [pedidoCuponExpira, 'expira500', Buffer.alloc(32, 0xcc), clave('cupon-expira')]);
  await db.query("update cupon_reservas set vence_en=now()-interval '1 second' where pedido_id=$1 and estado='reservada'", [pedidoCuponExpira]);
  await db.query('select vencer_reservas_pedidos(100)');
  assert.deepEqual((await db.query('select descuento_centavos,total_centavos from pedidos where id=$1', [pedidoCuponExpira])).rows[0], { descuento_centavos: 0, total_centavos: 10000 });
  assert.equal((await db.query('select count(*)::int n from pedido_cupones where pedido_id=$1', [pedidoCuponExpira])).rows[0].n, 0);

  await assert.rejects(
    db.query(`insert into tokens_consulta_pedido(pedido_id,token_hash,vence_en)
      values ($1,$2,now()+interval '1 day')`, [pedidoCoordinado, Buffer.alloc(10)]),
    /check constraint|violates/i,
  );
  await assert.rejects(
    db.query(`insert into pedidos(tipo,cliente_nombre,cliente_correo,cliente_whatsapp,requiere_envio,envio_definido,
      subtotal_centavos,envio_centavos,total_centavos,clave_idempotencia)
      values ('automatico','Inválido','invalido@example.test','+5491100000000',true,true,1000,100,1100,$1)`, [clave('pedido-invalido')]),
    /pedido_automatico_solo_retiro/,
  );

  await db.exec('grant usage on schema public to anon, authenticated; set role anon;');
  await assert.rejects(db.query('select * from pedidos'), /permission denied/);
  await assert.rejects(db.query('select reservar_stock_pedido($1,$2,20)', [pedidoReservado, clave('anon')]), /permission denied/);
  await db.exec('reset role;');
});

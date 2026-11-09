import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import * as validacion from '../supabase/functions/pedidos/validacion.ts';

const codigo = readFileSync(new URL('../supabase/functions/pedidos/index.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '');
const javascript = ts.transpileModule(codigo, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const origen = 'https://papeleria-de-sol-pruebas.netlify.app';

function servidor() {
  const rpc = [];
  const valores = {
    tokens_consulta_pedido: { id: 'acceso', pedido_id: 'orden', vence_en: '2099-01-01' },
    pedidos: {
      numero: 5, estado_preparacion: 'listo', medio_pago_solicitado: 'efectivo',
      pedido_items: [{ producto_id: 'producto', variante_id: 'variante', producto_nombre: 'Cuaderno', cantidad: 1, subtotal_centavos: 10000, imagen_url_snapshot: null }],
    },
    imagenes: [{ producto_id: 'producto', variante_id: 'variante', url_publica: '/cuaderno.webp' }],
  };
  const cliente = {
    async rpc(nombre, parametros) {
      rpc.push({ nombre, parametros });
      return { data: nombre === 'consumir_limite_solicitudes' ? true : { id: 'orden', numero: 5, tipo: 'coordinado', medio_pago_solicitado: parametros.p_medio_pago_solicitado }, error: null };
    },
    from(tabla) {
      const filtros = {};
      const resultado = () => ({ error: null, data: tabla === 'configuraciones_sitio'
        ? { valor: filtros.clave === 'whatsapp' ? '5491100000000' : false } : valores[tabla] });
      const consulta = {
        select() { return consulta; }, in() { return consulta; }, update() { return consulta; },
        eq(clave, valor) { filtros[clave] = valor; return consulta; },
        async maybeSingle() { return resultado(); }, async single() { return resultado(); },
        then(resolve, reject) { return Promise.resolve(resultado()).then(resolve, reject); },
      };
      return consulta;
    },
  };
  let handler;
  runInNewContext(javascript, {
    ...validacion, createClient: () => cliente, Request, Response, TextEncoder, crypto: webcrypto,
    Deno: {
      env: { get: clave => ({ SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio-de-test', PEDIDOS_TOKEN_SECRET: 'secreto-sintetico-de-prueba-de-mas-de-32-caracteres', URL_SITIO: origen })[clave] },
      serve: funcion => { handler = funcion; },
    },
    fetch: () => { throw new Error('Las pruebas no deben enviar correos reales.'); },
  });
  const llamar = cuerpo => handler(new Request('https://prueba.supabase.co/functions/v1/pedidos', {
    method: 'POST', headers: { origin: origen, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  }));
  return { llamar, rpc };
}

test('la Edge persiste el medio elegido y la nota a través de la RPC transaccional', async () => {
  const api = servidor();
  const respuesta = await api.llamar({
    accion: 'crear_solicitud', medio_pago: 'efectivo', clave_idempotencia: 'pedido-prueba-runtime-0001',
    cliente: { nombre: 'Cliente', correo: 'cliente@example.test', whatsapp: '+5491155555555' },
    lineas: [{ producto_id: '00000000-0000-4000-8000-000000000010', cantidad: 1 }],
    observaciones: 'Guardar para regalo',
  });
  assert.equal(respuesta.status, 200);
  const creacion = api.rpc.find(entrada => entrada.nombre === 'crear_solicitud_pedido_checkout');
  assert.equal(creacion.parametros.p_medio_pago_solicitado, 'efectivo');
  assert.equal(creacion.parametros.p_observaciones, 'Guardar para regalo');
  assert.equal((await respuesta.json()).datos.correo_estado, 'deshabilitado');
});

test('el seguimiento devuelve imágenes de pedidos antiguos sin exponer identificadores ni contactos', async () => {
  const api = servidor();
  const respuesta = await api.llamar({ accion: 'consultar_seguimiento', token: 'a'.repeat(43) });
  assert.equal(respuesta.status, 200);
  const { datos } = await respuesta.json();
  assert.equal(datos.pedido_items[0].imagen_url, '/cuaderno.webp');
  assert.equal(datos.pedido_items[0].producto_id, undefined);
  assert.equal(datos.pedido_items[0].variante_id, undefined);
  assert.equal(datos.medio_pago_solicitado, 'efectivo');
  assert.equal(datos.cliente_correo, undefined);
});

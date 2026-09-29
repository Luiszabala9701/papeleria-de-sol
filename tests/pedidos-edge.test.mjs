import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  crearTokenDeterminista, normalizarCreacion, serializarCanonico,
  sha256, validarTokenSeguimiento,
} from '../supabase/functions/pedidos/validacion.ts';

const producto = '00000000-0000-4000-8000-000000000010';

test('el checkout público normaliza datos y descarta precios manipulados', () => {
  const datos = normalizarCreacion({
    accion: 'crear_solicitud',
    clave_idempotencia: 'checkout-prueba-0001',
    cliente: { nombre: '  Cliente  ', correo: 'CLIENTE@EXAMPLE.TEST', whatsapp: '+54 9 11 5555-5555' },
    lineas: [{ producto_id: producto, cantidad: 2, precio: 1, nombre: '<script>', opciones: { texto: 'Sol' } }],
    observaciones: '  Entregar por la tarde  ',
  });
  assert.deepEqual(datos.lineas, [{ producto_id: producto, variante_id: null, cantidad: 2, opciones: { texto: 'Sol' } }]);
  assert.deepEqual(datos.cliente, { nombre: 'Cliente', correo: 'cliente@example.test', whatsapp: '+54 9 11 5555-5555' });
  assert.equal(datos.observaciones, 'Entregar por la tarde');
});

test('la validación limita artículos, cantidades, contacto y opciones', () => {
  const base = {
    clave_idempotencia: 'checkout-prueba-0002',
    cliente: { nombre: 'Cliente', correo: 'cliente@example.test', whatsapp: '+5491155555555' },
    lineas: [{ producto_id: producto, cantidad: 1 }],
  };
  assert.throws(() => normalizarCreacion({ ...base, lineas: [] }), /entre 1 y 100/);
  assert.throws(() => normalizarCreacion({ ...base, lineas: [{ producto_id: producto, cantidad: 101 }] }), /cantidad/);
  assert.throws(() => normalizarCreacion({ ...base, cliente: { ...base.cliente, correo: 'invalido' } }), /contacto/);
  assert.throws(() => normalizarCreacion({ ...base, lineas: [{ producto_id: producto, cantidad: 1, opciones: [] }] }), /opciones/);
});

test('el token de seguimiento es determinista, opaco y se persiste solo mediante hash', async () => {
  const secreto = 'secreto-de-pruebas-con-mas-de-32-caracteres';
  const primero = await crearTokenDeterminista(secreto, 'checkout-prueba-0003');
  const repetido = await crearTokenDeterminista(secreto, 'checkout-prueba-0003');
  const distinto = await crearTokenDeterminista(secreto, 'checkout-prueba-0004');
  assert.equal(primero, repetido);
  assert.notEqual(primero, distinto);
  assert.equal(primero.length, 43);
  assert.equal(validarTokenSeguimiento(primero), primero);
  assert.equal((await sha256(primero)).length, 32);
  assert.throws(() => validarTokenSeguimiento(producto), /no es válido/);
});

test('la serialización usada para idempotencia no depende del orden de las claves', () => {
  assert.equal(serializarCanonico({ b: 2, a: { d: 4, c: 3 } }), serializarCanonico({ a: { c: 3, d: 4 }, b: 2 }));
});

test('la Edge Function limita body, origen, frecuencia y no confía en el navegador', async () => {
  const codigo = await readFile(new URL('../supabase/functions/pedidos/index.ts', import.meta.url), 'utf8');
  assert.match(codigo, /texto\.length > 32_000/);
  assert.match(codigo, /Origen no permitido/);
  assert.match(codigo, /consumir_limite_solicitudes/);
  assert.match(codigo, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(codigo, /PEDIDOS_TOKEN_SECRET/);
  assert.doesNotMatch(codigo, /console\.(log|error)/);
});

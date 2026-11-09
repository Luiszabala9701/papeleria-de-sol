import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { estadoVisiblePedido, imagenSeguraPedido } from '../src/servicios/seguimiento-pedido.js';

function nodo() {
  const clases = new Set();
  return {
    children: [], listeners: {}, dataset: {}, hidden: false, value: '', textContent: '', disabled: false,
    classList: {
      add: valor => clases.add(valor), remove: valor => clases.delete(valor), contains: valor => clases.has(valor),
      toggle: (valor, activo) => activo ? clases.add(valor) : clases.delete(valor),
    },
    addEventListener(tipo, listener) { this.listeners[tipo] = listener; },
    setAttribute() {}, removeAttribute() {}, focus() {}, reportValidity() { return true; },
    append(...hijos) { this.children.push(...hijos); },
    replaceChildren(...hijos) { this.children = hijos; },
  };
}

function checkout(fetchPedido) {
  const formulario = nodo();
  formulario.elements = Object.fromEntries(['nombre', 'correo', 'whatsapp', 'observaciones', 'medio_pago']
    .map(nombre => [nombre, nodo()]));
  Object.assign(formulario.elements.nombre, { value: 'Cliente Prueba' });
  Object.assign(formulario.elements.correo, { value: 'cliente@example.test' });
  Object.assign(formulario.elements.whatsapp, { value: '+5491155555555' });
  Object.assign(formulario.elements.observaciones, { value: '  Separar para regalo.\nRetiro el viernes.  ' });
  const controles = {
    '.formulario-pedido-publico': nodo(), '[data-instrucciones-checkout]': nodo(),
    '[data-paso-pago]': nodo(), '[data-volver-datos-pedido]': nodo(), 'button[type="submit"]': nodo(),
  };
  const pasos = [nodo(), nodo(), nodo()];
  formulario.querySelector = selector => controles[selector];
  formulario.querySelectorAll = selector => selector === '.pasos-checkout li' ? pasos : [controles['button[type="submit"]']];
  const dialogo = nodo();
  dialogo.dataset = { endpointPedidos: 'https://pruebas.example.test/pedidos', clavePublica: 'clave-publica' };
  dialogo.showModal = () => { dialogo.open = true; };
  const selectores = {
    '#formulario-datos-pedido': formulario, '#dialogo-datos-pedido': dialogo,
    '#error-datos-pedido': nodo(), '#confirmacion-pedido': nodo(), '#titulo-datos-pedido': nodo(),
    '[data-resumen-checkout]': nodo(),
  };
  const documento = nodo();
  documento.querySelector = selector => selectores[selector];
  documento.querySelectorAll = () => [];
  documento.createElement = () => nodo();
  const contexto = {
    document: documento, crypto: webcrypto, window: { setTimeout }, fetch: fetchPedido,
    localStorage: { getItem: () => JSON.stringify([{ id: '00000000-0000-4000-8000-000000000010', nombre: 'Cuaderno', precio: 100, tipo_producto: 'sticker', cantidad: 1 }]), setItem() {} },
    FormData: class {
      constructor(form) { this.form = form; }
      get(nombre) { return this.form.elements[nombre]?.value || null; }
    },
  };
  runInNewContext(readFileSync(new URL('../src/scripts/carrito.js', import.meta.url), 'utf8'), contexto);
  contexto.abrirFormularioPedido();
  return { formulario, controles, selectores };
}

test('el pedido sólo se registra después de elegir pago y conserva la nota al volver de paso', async () => {
  const solicitudes = [];
  const ui = checkout(async (_url, opciones) => {
    solicitudes.push(JSON.parse(opciones.body));
    return { ok: true, json: async () => ({ datos: { numero: 12, tipo: 'coordinado', correo_estado: 'deshabilitado' } }) };
  });
  const enviar = () => ui.formulario.listeners.submit({ preventDefault() {} });
  await enviar();
  assert.equal(solicitudes.length, 0, 'los datos de contacto no crean un pedido todavía');
  assert.equal(ui.controles['[data-paso-pago]'].hidden, false);
  await enviar();
  assert.equal(solicitudes.length, 0, 'elegir la forma de pago es obligatorio');
  assert.match(ui.selectores['#error-datos-pedido'].textContent, /transferencia o en efectivo/);
  ui.controles['[data-volver-datos-pedido]'].listeners.click();
  assert.equal(ui.formulario.elements.observaciones.value.trim(), 'Separar para regalo.\nRetiro el viernes.');
  await enviar();
  ui.formulario.elements.medio_pago.value = 'efectivo';
  await enviar();
  assert.equal(solicitudes.length, 1);
  assert.equal(solicitudes[0].medio_pago, 'efectivo');
  assert.equal(solicitudes[0].observaciones, 'Separar para regalo.\nRetiro el viernes.');
  assert.equal(solicitudes[0].lineas[0].precio, undefined);
  assert.match(ui.selectores['#confirmacion-pedido'].children.map(hijo => hijo.textContent).join(' '), /pago está pendiente/);
  assert.equal(ui.controles['[data-paso-pago]'].hidden, true);
});

test('un doble clic no duplica el registro del pedido', async () => {
  let solicitudes = 0;
  let resolver;
  const ui = checkout(async () => {
    solicitudes += 1;
    await new Promise(resolve => { resolver = resolve; });
    return { ok: true, json: async () => ({ datos: { numero: 13, tipo: 'coordinado' } }) };
  });
  const enviar = () => ui.formulario.listeners.submit({ preventDefault() {} });
  await enviar();
  ui.formulario.elements.medio_pago.value = 'transferencia';
  const primero = enviar();
  await enviar();
  assert.equal(solicitudes, 1);
  resolver();
  await primero;
});

test('el seguimiento muestra preparación, listo y cancelación sin confundirlos con el pago', () => {
  assert.equal(estadoVisiblePedido({ estado_preparacion: 'en_preparacion', estado_financiero: 'pagado' }), 'En preparación');
  assert.equal(estadoVisiblePedido({ estado_preparacion: 'listo', estado_financiero: 'sin_cobro' }), 'Empaquetado y listo');
  assert.equal(estadoVisiblePedido({ estado_preparacion: 'listo', estado_comercial: 'cancelado' }), 'Cancelado');
  assert.equal(estadoVisiblePedido({ estado_preparacion: 'listo', estado_entrega: 'retirado' }), 'Retirado');
});

test('las miniaturas del seguimiento rechazan URLs externas, javascript y rutas de red', () => {
  for (const valor of ['javascript:alert(1)', '//externo.test/foto', '/\\externo.test/foto', 'https://externo.test/foto', 'data:image/svg+xml,foo']) {
    assert.equal(imagenSeguraPedido(valor), '/marca/producto-sin-imagen.svg');
  }
  assert.equal(imagenSeguraPedido('/stickers/12.webp'), '/stickers/12.webp');
  assert.equal(imagenSeguraPedido('https://proyecto.supabase.co/storage/v1/object/public/productos/foto.webp'), 'https://proyecto.supabase.co/storage/v1/object/public/productos/foto.webp');
});

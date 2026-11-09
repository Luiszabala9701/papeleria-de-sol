import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function nodo() {
  const clases = new Set();
  return {
    children: [], dataset: {}, listeners: {}, value: '', textContent: '', hidden: false, open: false,
    classList: { add: x => clases.add(x), remove: x => clases.delete(x), contains: x => clases.has(x) },
    append(...hijos) { this.children.push(...hijos); },
    replaceChildren(...hijos) { this.children = hijos; },
    addEventListener(tipo, funcion) { this.listeners[tipo] = funcion; },
    setAttribute() {}, focus() { this.enfocado = true; },
  };
}

function carritoPrueba({ rechazar = false, vacio = false } = {}) {
  const codigo = nodo();
  const boton = nodo();
  const resumen = nodo();
  const formulario = nodo();
  formulario.elements = { cupon: codigo };
  formulario.querySelector = () => boton;
  const desplegable = nodo();
  desplegable.contains = control => control === boton;
  desplegable.querySelector = () => resumen;
  const selectores = {
    '[data-formulario-cupon-carrito]': formulario,
    '[data-cupon-desplegable]': desplegable,
    '[data-titulo-cupon-carrito]': nodo(),
    '[data-estado-cupon-carrito]': nodo(),
    '[data-resumen-descuento]': nodo(), '[data-descuento-carrito]': nodo(),
    '#contenido-carrito': nodo(), '#total-dinero-carrito': nodo(), '#vaciar-carrito': nodo(),
    '#dialogo-datos-pedido': Object.assign(nodo(), { dataset: { endpointPedidos: 'https://ejemplo.test/pedidos', clavePublica: 'prueba' } }),
  };
  const documento = nodo();
  documento.querySelector = selector => selectores[selector];
  documento.querySelectorAll = () => [];
  documento.createElement = nodo;
  documento.createDocumentFragment = nodo;
  documento.activeElement = boton;
  const solicitudes = [];
  runInNewContext(readFileSync(new URL('../src/scripts/carrito.js', import.meta.url), 'utf8'), {
    document: documento,
    localStorage: {
      getItem: () => JSON.stringify(vacio ? [] : [{ id: 'producto', nombre: 'Sticker', precio: 100, cantidad: 1, tipo_producto: 'sticker' }]),
      setItem() {},
    },
    fetch: async (_url, opciones) => {
      solicitudes.push(JSON.parse(opciones.body));
      return {
        ok: !rechazar,
        json: async () => rechazar ? { error: 'Este cupón ya venció.' }
          : { datos: { subtotal_centavos: 10000, descuento_centavos: 1000, total_centavos: 9000 } },
      };
    },
  });
  return { codigo, boton, resumen, formulario, desplegable, selectores, solicitudes };
}

test('el cupón empieza plegado, se normaliza y al aplicar libera espacio sin perder el descuento', async () => {
  const componente = readFileSync(new URL('../src/componentes/Carrito.astro', import.meta.url), 'utf8');
  assert.match(componente, /<details class="cupon-desplegable-carrito" data-cupon-desplegable>/);
  assert.match(componente, /<summary>/);
  const ui = carritoPrueba();
  assert.equal(ui.desplegable.open, false);
  ui.desplegable.open = true;
  ui.codigo.value = 'sol10';
  ui.codigo.listeners.input({ currentTarget: ui.codigo });
  assert.equal(ui.codigo.value, 'SOL10');
  await ui.formulario.listeners.submit({ preventDefault() {} });
  assert.equal(ui.solicitudes[0].cupon, 'SOL10');
  assert.equal(ui.desplegable.open, false);
  assert.equal(ui.desplegable.classList.contains('aplicado'), true);
  assert.equal(ui.resumen.enfocado, true, 'el foco vuelve al summary visible');
  assert.equal(ui.selectores['[data-titulo-cupon-carrito]'].textContent, 'Cupón SOL10 aplicado');
  assert.equal(ui.selectores['[data-resumen-descuento]'].hidden, false);
});

test('un cupón inválido mantiene abierto el formulario y no conserva un descuento', async () => {
  const ui = carritoPrueba({ rechazar: true });
  ui.codigo.value = 'VENCIDO';
  await ui.formulario.listeners.submit({ preventDefault() {} });
  assert.equal(ui.desplegable.open, true);
  assert.match(ui.selectores['[data-estado-cupon-carrito]'].textContent, /ya venció/);
  assert.equal(ui.selectores['[data-resumen-descuento]'].hidden, true);
  assert.equal(ui.boton.disabled, false);
});

test('al vaciar el carrito se oculta el cupón y no queda aplicado', async () => {
  const ui = carritoPrueba();
  ui.codigo.value = 'SOL10';
  await ui.formulario.listeners.submit({ preventDefault() {} });
  ui.selectores['#vaciar-carrito'].listeners.click();
  assert.equal(ui.desplegable.hidden, true);
  assert.equal(ui.desplegable.open, false);
  assert.equal(ui.codigo.value, '');
  assert.equal(ui.desplegable.classList.contains('aplicado'), false);
});

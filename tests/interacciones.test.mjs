import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function elemento() {
  const atributos = new Map();
  const clases = new Set();
  return {
    dataset: {},
    listeners: {},
    classList: {
      add: (clase) => clases.add(clase),
      remove: (clase) => clases.delete(clase),
      contains: (clase) => clases.has(clase),
      toggle: (clase, activa) => activa ? clases.add(clase) : clases.delete(clase),
    },
    addEventListener(tipo, listener) { this.listeners[tipo] = listener; },
    setAttribute: (clave, valor) => atributos.set(clave, valor),
    getAttribute: (clave) => atributos.get(clave),
    removeAttribute: (clave) => atributos.delete(clave),
    focus() { this.enfoques = (this.enfoques || 0) + 1; },
  };
}

for (const produccion of [true, false]) {
  test(`la galería cambia src y srcset juntos (${produccion ? 'producción' : 'desarrollo'})`, () => {
    const principal = elemento();
    principal.src = '/anterior.webp';
    principal.setAttribute('srcset', '/anterior.webp 960w');
    const ampliada = elemento();
    const miniatura = elemento();
    miniatura.dataset = { imagenSrc: '/nueva.webp', imagenAlt: 'Nueva versión' };
    const galeria = elemento();
    const selectores = {
      '[data-imagen-principal-galeria]': principal,
      '[data-imagen-visor-galeria]': ampliada,
    };
    galeria.querySelector = (selector) => selectores[selector];
    galeria.querySelectorAll = () => [miniatura];
    const documento = { querySelectorAll: () => [galeria] };
    const urlOptimizada = (url, ancho) => produccion ? `/optimizada?url=${url}&w=${ancho}` : url;
    const crearSrcset = (url, anchos) => produccion
      ? anchos.map((ancho) => `${urlOptimizada(url, ancho)} ${ancho}w`).join(', ')
      : undefined;
    const codigo = readFileSync(new URL('../src/scripts/galeria-producto.js', import.meta.url), 'utf8')
      .replace(/^import .*;\r?\n/m, '');
    runInNewContext(codigo, {
      document: documento,
      crearUrlImagenOptimizada: urlOptimizada,
      crearSrcsetImagen: crearSrcset,
    });
    galeria.listeners.click({ target: { closest: () => miniatura } });

    assert.equal(principal.src, urlOptimizada('/nueva.webp', 960));
    assert.equal(principal.getAttribute('srcset'), crearSrcset('/nueva.webp', [480, 709, 960, 1200]));
    assert.equal(principal.alt, 'Nueva versión');
    assert.equal(ampliada.src, urlOptimizada('/nueva.webp', 1200));
    assert.equal(miniatura.getAttribute('aria-pressed'), 'true');
  });
}

test('el carrito oculto es inerte y devuelve el foco al activador al cerrarse', () => {
  const boton = elemento();
  const panel = elemento();
  const cerrar = elemento();
  const fondo = elemento();
  const documento = elemento();
  documento.body = elemento();
  const selectores = {
    '#boton-carrito': boton,
    '#panel-carrito': panel,
    '#cerrar-carrito': cerrar,
    '#fondo-carrito': fondo,
  };
  documento.querySelector = (selector) => selectores[selector];
  panel.setAttribute('inert', '');
  runInNewContext(readFileSync(new URL('../src/scripts/carrito.js', import.meta.url), 'utf8'), {
    document: documento,
    localStorage: { getItem: () => '[]' },
  });

  documento.listeners.keydown({ key: 'Escape' });
  assert.equal(boton.enfoques, undefined, 'Escape no debe robar el foco si ya está cerrado');
  boton.listeners.click();
  assert.equal(panel.getAttribute('aria-hidden'), 'false');
  assert.equal(panel.getAttribute('inert'), undefined);
  assert.equal(cerrar.enfoques, 1);
  cerrar.listeners.click();
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(panel.getAttribute('inert'), '');
  assert.equal(boton.enfoques, 1);
});

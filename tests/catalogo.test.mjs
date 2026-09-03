import assert from 'node:assert/strict';
import test from 'node:test';
import { crearUrlCatalogo, obtenerPaginaCatalogo, tituloPaginaCatalogo } from '../src/servicios/catalogo.js';

const productos = Array.from({ length: 1002 }, (_, indice) => ({
  id: String(indice), nombre: `Diseño acrílico ${indice + 1}`, sku: `ST-${indice + 1}`,
  descripcion: 'Decoración para cuadernos', categoria: { id: indice % 2 ? 'uno' : 'dos' },
}));

test('las páginas enlazadas recorren los 1002 productos sin repetir ni omitir', () => {
  const vistos = [];
  for (let pagina = 1; pagina <= 21; pagina++) {
    const url = new URL(crearUrlCatalogo('/stickers', { pagina }), 'https://papeleriadesol.com.ar');
    const estado = obtenerPaginaCatalogo(productos, url.searchParams);
    assert.equal(estado.pagina, pagina);
    assert.equal(estado.totalPaginas, 21);
    vistos.push(...estado.visibles.map((producto) => producto.id));
  }
  assert.deepEqual(vistos, productos.map((producto) => producto.id));
});

test('la búsqueda ignora acentos y conserva el filtro al cambiar de página', () => {
  const url = crearUrlCatalogo('/stickers', { pagina: 2, buscar: 'acrilico', categoria: 'uno' });
  const estado = obtenerPaginaCatalogo(productos, new URL(url, 'https://papeleriadesol.com.ar').searchParams);
  assert.equal(estado.totalProductos, 501);
  assert.equal(estado.pagina, 2);
  assert.equal(estado.tieneFiltros, true);
  assert.ok(estado.visibles.every((producto) => producto.categoria.id === 'uno'));
});

test('las páginas inválidas y las búsquedas sin resultados no rompen la navegación', () => {
  for (const pagina of ['-1', 'NaN', '1.5', 'Infinity']) {
    assert.equal(obtenerPaginaCatalogo(productos, new URLSearchParams({ pagina })).pagina, 1);
  }
  assert.equal(obtenerPaginaCatalogo(productos, new URLSearchParams('pagina=999')).pagina, 21);
  const vacio = obtenerPaginaCatalogo(productos, new URLSearchParams('buscar=inexistente&pagina=2'));
  assert.equal(vacio.totalProductos, 0);
  assert.equal(vacio.pagina, 1);
  assert.equal(vacio.totalPaginas, 1);
});

test('la página inicial tiene una URL limpia y cada página posterior tiene título propio', () => {
  assert.equal(crearUrlCatalogo('/stickers'), '/stickers');
  assert.equal(crearUrlCatalogo('/stickers', { pagina: 2 }), '/stickers?pagina=2');
  assert.notEqual(tituloPaginaCatalogo('sticker', 1), tituloPaginaCatalogo('sticker', 2));
});

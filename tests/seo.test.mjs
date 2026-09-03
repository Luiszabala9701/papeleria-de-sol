import assert from 'node:assert/strict';
import test from 'node:test';
import { crearDescripcionProductoSeo, crearTituloSeo, escaparJsonLd } from '../src/servicios/seo.ts';

test('la portada prioriza la marca sin duplicarla', () => {
  assert.equal(crearTituloSeo('Stickers y papelería creativa', true), 'Papelería de Sol | Stickers y papelería creativa');
  assert.equal(crearTituloSeo('Papelería de Sol | Stickers', true), 'Papelería de Sol | Stickers');
  assert.equal(crearTituloSeo('Stickers | Papelería de Sol'), 'Stickers | Papelería de Sol');
});

test('las descripciones automáticas mantienen nombre, contacto y región dentro del límite', () => {
  for (const nombre of ['Llavero acrílico C.A.I', 'Un nombre de producto muy largo '.repeat(8)]) {
    const descripcion = crearDescripcionProductoSeo({ nombre, descripcion: 'Llavero con pompón. '.repeat(15), tipo_producto: 'fisico' });
    assert.ok(descripcion.length <= 160);
    assert.ok(descripcion.endsWith('Consultá por WhatsApp en CABA y GBA.'));
    assert.ok(descripcion.startsWith(nombre.split(' ')[0]));
  }
});

test('se respeta la descripción personalizada del administrador', () => {
  assert.equal(crearDescripcionProductoSeo({ nombre: 'Sticker', descripcion: '', tipo_producto: 'sticker', meta_descripcion: '  Mi descripción personalizada.  ' }), 'Mi descripción personalizada.');
});

test('los datos estructurados no pueden cerrar la etiqueta script', () => {
  const datos = { nombre: '</script><script>alert(1)</script>' };
  assert.ok(!escaparJsonLd(datos).includes('</script>'));
  assert.deepEqual(JSON.parse(escaparJsonLd(datos)), datos);
});

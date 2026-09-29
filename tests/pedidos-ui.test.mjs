import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = ruta => readFile(new URL(ruta, import.meta.url), 'utf8');

test('el carrito registra pedidos sin confiar en precios del navegador', async () => {
  const [carrito, componente] = await Promise.all([
    leer('../src/scripts/carrito.js'),
    leer('../src/componentes/Carrito.astro'),
  ]);
  assert.match(componente, /Continuar pedido/);
  assert.match(componente, /En esta etapa no se realiza ningún cobro/);
  assert.match(carrito, /accion: 'crear_solicitud'/);
  assert.match(carrito, /producto_id: producto\.id/);
  assert.match(carrito, /opciones: \{\}/);
  assert.match(carrito, /claveSolicitud = `pedido:\$\{crypto\.randomUUID\(\)\}`/);
});

test('el seguimiento es privado, no indexable y no muestra datos del comprador', async () => {
  const [pagina, cliente, funcion] = await Promise.all([
    leer('../src/pages/seguimiento.astro'),
    leer('../src/scripts/seguimiento-pedido.js'),
    leer('../supabase/functions/pedidos/index.ts'),
  ]);
  assert.match(pagina, /noIndexar/);
  assert.match(cliente, /consultar_seguimiento/);
  assert.match(funcion, /numero,tipo,moneda,subtotal_centavos/);
  const seleccionSeguimiento = funcion.match(/from\('pedidos'\)\.select\(`([^]*?)`\)/)?.[1] || '';
  assert.doesNotMatch(seleccionSeguimiento, /cliente_(nombre|correo|whatsapp)|direccion_entrega/);
  assert.match(funcion, /token_hash/);
});

test('el dashboard incluye pedidos, cupones y la etiqueta aprobada para transferencias', async () => {
  const [pagina, modulo, servidor] = await Promise.all([
    leer('../src/pages/admin/index.astro'),
    leer('../src/scripts/administracion/pedidos-cupones.js'),
    leer('../supabase/functions/administracion/operaciones-pedidos.ts'),
  ]);
  assert.match(pagina, /data-seccion-admin="pedidos"/);
  assert.match(pagina, /data-seccion-admin="cupones"/);
  assert.match(modulo, /Marcar como pago aprobado/);
  assert.match(servidor, /marcar_transferencia_pago_aprobado/);
  assert.match(servidor, /actualizar_estado_pedido_administracion/);
  assert.match(servidor, /guardar_cupon_administracion/);
  assert.match(pagina, /name="categoria_productos"/);
  assert.doesNotMatch(pagina, /name="excluidos"/);
  assert.match(modulo, /toUpperCase\(\)/);
  assert.match(modulo, /porcentaje > 100/);
  assert.match(modulo, /compraMinima < importeFijo/);
  assert.match(servidor, /compra_minima_centavos < Number\(datos\.importe_fijo_centavos\)/);
  assert.doesNotMatch(modulo, /innerHTML/);
});

test('las funciones administrativas limitan cuerpos y orígenes', async () => {
  const codigo = await leer('../supabase/functions/administracion/index.ts');
  assert.match(codigo, /262_144/);
  assert.match(codigo, /Origen no permitido/);
  assert.match(codigo, /papeleria-de-sol-pruebas\.netlify\.app/);
  assert.match(codigo, /configurar_modo_compra_producto_administracion/);
  assert.doesNotMatch(codigo, /console\.error\(error\)/);
});

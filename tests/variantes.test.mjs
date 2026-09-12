import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarProductoVenta, crearLineaSeleccion, revisarSeleccion, necesitaElegirVariante, productoSinStock } from '../src/servicios/variantes.js';
import { validarProductoConVariantes } from '../supabase/functions/administracion/validar-producto.ts';

const version = (id, clave, precio, stock = null) => ({ id, clave, nombre: clave, sku: `VAR-${id}`, precio, stock, estado: 'publicado' });
const sticker = normalizarProductoVenta({ id: 's', nombre: 'Sticker', sku: 'ST-0001', tipo_producto: 'sticker', usa_variantes: true, precio: 500,
  variantes: [version('a','comun',500), version('b','holografico',800), {...version('c','resistente_agua',1000),estado:'archivado'}] });
const fisico = normalizarProductoVenta({id:'f',nombre:'Llavero',sku:'PF-0001',tipo_producto:'fisico',usa_variantes:true,
  imagenes:[{url_publica:'/padre.webp'}, {url_publica:'/rojo.webp',variante_id:'r'}],
  variantes:[version('r','rojo',4000,2),version('z','azul',3000,0)]});

test('las versiones disponibles y sus precios se normalizan sin stock para stickers', () => {
  assert.equal(sticker.variantes.length, 2);
  assert.equal(sticker.controla_stock, false);
  assert.equal(sticker.stock, null);
  assert.equal(sticker.precio, 500);
  assert.equal(necesitaElegirVariante(sticker), true);
  assert.equal(crearLineaSeleccion(sticker), null);
  const lineaHolografica = crearLineaSeleccion(sticker, sticker.variantes[1]);
  assert.equal(lineaHolografica.nombre, 'Sticker — holografico');
  assert.equal(lineaHolografica.sku, 'ST-0001');
});
test('físicos: stock por variante y fotos propias, precios desde la variante comprable', () => {
  assert.equal(fisico.stock, 2);
  assert.equal(fisico.precio, 4000);
  assert.equal(productoSinStock(fisico), false);
  assert.equal(crearLineaSeleccion(fisico,fisico.variantes[0]).imagen, '/rojo.webp');
  assert.equal(crearLineaSeleccion(fisico,fisico.variantes[1]).imagen, '/padre.webp');
  assert.equal(productoSinStock(normalizarProductoVenta({tipo_producto:'fisico',stock:null})),true);
  const soloFotosVariantes = normalizarProductoVenta({tipo_producto:'fisico',usa_variantes:true,
    imagenes:[{url_publica:'/rojo.webp',variante_id:'r'}],variantes:[version('r','rojo',100,2)]});
  assert.equal(soloFotosVariantes.imagenes[0].url_publica,'/rojo.webp');
  assert.equal(necesitaElegirVariante(soloFotosVariantes),false);
  assert.equal(crearLineaSeleccion(soloFotosVariantes).imagen,'/rojo.webp');
});
test('carrito: dos versiones distintas, agrupar duplicados, limitar stock y actualizar precios', () => {
  const lineas = [
    {id:'s',variante_id:'a',cantidad:2,precio:500}, {id:'s',variante_id:'b',cantidad:3,precio:1},
    {id:'f',variante_id:'r',cantidad:1,precio:4000}, {id:'f',variante_id:'r',cantidad:4,precio:4000},
    {id:'f',variante_id:'z',cantidad:2,precio:3000}, {id:'s',variante_id:'c',cantidad:1,precio:1000},
  ];
  const resultado = revisarSeleccion(lineas,[sticker,fisico]);
  assert.deepEqual(resultado.lineas.map(l=>[l.variante_id,l.cantidad,l.precio]),[['a',2,500],['b',3,800],['r',2,4000]]);
  assert.deepEqual(resultado.lineas.map(l=>l.sku), ['ST-0001', 'ST-0001', 'PF-0001']);
  assert.ok(resultado.avisos.some(a=>a.includes('precio')));
  assert.ok(resultado.avisos.some(a=>a.includes('stock')));
  assert.ok(resultado.avisos.some(a=>a.includes('nuevamente')));
});
test('selecciones antiguas pasan a Común; cantidades inválidas no se aceptan', () => {
  assert.equal(revisarSeleccion([{id:'s',cantidad:2,precio:500}],[sticker]).lineas[0].variante_id,'a');
  for (const cantidad of [0,-1,1.4,NaN,Infinity,10000]) assert.equal(revisarSeleccion([{id:'s',cantidad}],[sticker]).lineas.length,0);
  assert.equal(revisarSeleccion([{id:'borrado',cantidad:1}],[sticker]).lineas.length,0);
});
test('servidor: no hay opción de stock en stickers/plantillas y los físicos lo requieren', () => {
  const datos = {nombre:'Producto',descripcion:'Descripción',estado:'publicado',tipo_producto:'sticker',variantes:[version('a','comun',500)],stock:50,controla_stock:true};
  const validado = validarProductoConVariantes(datos);
  assert.equal(validado.stock,null);
  assert.equal(validado.controla_stock,false);
  assert.equal(validado.variantes[0].stock,null);
  assert.equal(validado.variantes[0].nombre,'Común');
  assert.equal(validarProductoConVariantes({...datos,tipo_producto:'plantilla',precio:900,variantes:[]}).stock,null);
  for (const stock of [null,undefined,'',-1,1.2]) assert.throws(()=>validarProductoConVariantes({...datos,tipo_producto:'fisico',precio:500,variantes:[],stock}),/stock/);
  assert.equal(validarProductoConVariantes({...datos,tipo_producto:'fisico',precio:500,variantes:[],stock:0,controla_stock:false}).controla_stock,true);
  assert.throws(()=>validarProductoConVariantes({...datos,variantes:[]}),/cantidad/);
  assert.throws(()=>validarProductoConVariantes({...datos,variantes:[version('x','cualquier',1)]}),/acabado/);
});

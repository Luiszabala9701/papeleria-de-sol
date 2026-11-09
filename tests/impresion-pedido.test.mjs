import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHojaPedido, imprimirPedido } from '../src/scripts/administracion/imprimir-pedido.js';
import { gestionarAccionComercial } from '../supabase/functions/administracion/operaciones-pedidos.ts';

function documentoPrueba() {
  const crearNodo = etiqueta => ({
    etiqueta, children: [], textContent: '', atributos: {},
    setAttribute(nombre, valor) { this.atributos[nombre] = valor; },
    append(...hijos) { hijos.forEach(hijo => { hijo.parent = this; this.children.push(hijo); }); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(nodo => nodo !== this); },
  });
  const body = crearNodo('body');
  return {
    body, title: 'Administración', createElement: crearNodo,
    querySelector: selector => selector === '#impresion-pedido' ? body.children.find(nodo => nodo.id === 'impresion-pedido') : undefined,
  };
}

const textos = nodo => [nodo.textContent, ...nodo.children.flatMap(hijo => textos(hijo))].filter(Boolean);
const datos = {
  pedido: {
    numero: 5, creado_en: '2026-11-09T18:00:00Z', cliente_nombre: 'Cliente de prueba',
    cliente_correo: 'cliente@example.test', cliente_whatsapp: '+5491155555555',
    subtotal_centavos: 31000, descuento_centavos: 1000, total_centavos: 30000,
    estado_preparacion: 'en_preparacion', estado_financiero: 'sin_cobro', medio_pago_solicitado: 'efectivo',
    observaciones_cliente: 'Separar para regalo.\nGracias.', notas_internas: 'Nota privada que no debe imprimirse',
  },
  items: [
    { producto_nombre: 'Cuaderno', variante_nombre: 'Rosa', sku: 'PF-0001', cantidad: 2, precio_unitario_centavos: 15000, subtotal_centavos: 30000 },
    { producto_nombre: 'Sticker', variante_nombre: 'Común', sku: 'ST-0001', cantidad: 1, precio_unitario_centavos: 1000, subtotal_centavos: 1000 },
  ],
  cupon: { codigo_snapshot: 'SOL10' },
};

test('la hoja imprime snapshots, totales y nota del cliente con localizador recortable al final', () => {
  const hoja = crearHojaPedido(datos, documentoPrueba());
  const contenido = textos(hoja).join('\n');
  assert.match(contenido, /Orden #5/);
  assert.match(contenido, /Cuaderno\nRosa\nSKU: PF-0001/);
  assert.match(contenido, /Descuento \(SOL10\)/);
  assert.ok(contenido.includes(new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(300)));
  assert.match(contenido, /Separar para regalo/);
  assert.doesNotMatch(contenido, /Nota privada/);
  const localizador = hoja.children.at(-1);
  assert.equal(localizador.className, 'localizador-pedido');
  assert.match(textos(localizador).join('\n'), /Recortar por esta línea[\s\S]*Orden #5[\s\S]*Cliente de prueba[\s\S]*WhatsApp:[\s\S]*cliente@example.test/);
  assert.match(contenido, /Pendiente de pago/);
});

test('los datos del cliente se agregan como texto, sin ejecutar HTML', () => {
  const hoja = crearHojaPedido({ ...datos, pedido: { ...datos.pedido, observaciones_cliente: '<img src=x onerror=alert(1)>' } }, documentoPrueba());
  const recorrer = nodo => [nodo.etiqueta, ...nodo.children.flatMap(recorrer)];
  assert.ok(textos(hoja).includes('<img src=x onerror=alert(1)>'));
  assert.ok(!recorrer(hoja).includes('img'));
});

test('imprimir usa el diálogo del navegador y limpia los datos al cerrarlo sin cambiar el pedido', () => {
  const documento = documentoPrueba();
  let despues;
  let llamadas = 0;
  const ventana = {
    addEventListener(nombre, funcion) { assert.equal(nombre, 'afterprint'); despues = funcion; },
    removeEventListener() {},
    print() { llamadas += 1; assert.ok(documento.querySelector('#impresion-pedido')); },
  };
  imprimirPedido(datos, documento, ventana);
  assert.equal(llamadas, 1);
  assert.equal(documento.title, 'Orden #5 - Papelería de Sol');
  despues();
  assert.equal(documento.querySelector('#impresion-pedido'), undefined);
  assert.equal(documento.title, 'Administración');
  assert.equal(datos.pedido.notas_internas, 'Nota privada que no debe imprimirse');
});

test('guardar nota interna valida el texto y envía el administrador y la versión anterior al servidor', async () => {
  const llamadas = [];
  const base = {
    accion: 'guardar_nota_interna_pedido', usuarioId: '00000000-0000-4000-8000-000000000001', urlSitio: '',
    cliente: { rpc: async (nombre, parametros) => { llamadas.push({ nombre, parametros }); return { data: { notas_internas: 'Impresa' }, error: null }; } },
    cuerpo: { id: '00000000-0000-4000-8000-000000000005', nota: 'Impresa', nota_anterior: null },
  };
  const resultado = await gestionarAccionComercial(base);
  assert.equal(resultado.datos.notas_internas, 'Impresa');
  assert.equal(llamadas[0].nombre, 'guardar_nota_interna_pedido_administracion');
  assert.equal(llamadas[0].parametros.p_usuario, base.usuarioId);
  assert.equal(llamadas[0].parametros.p_nota_anterior, null);
  await assert.rejects(gestionarAccionComercial({ ...base, cuerpo: { ...base.cuerpo, nota: 'a'.repeat(2001) } }), /2000/);
  assert.equal(llamadas.length, 1);
});

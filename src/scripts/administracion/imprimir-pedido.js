import { estadoVisiblePedido } from '../../servicios/seguimiento-pedido.js';

const formatoDinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });

export function crearHojaPedido(datos, documento = document) {
  const { pedido, items = [], cupon } = datos;
  const crear = (tipo, texto, clase) => {
    const nodo = documento.createElement(tipo);
    if (texto != null) nodo.textContent = String(texto);
    if (clase) nodo.className = clase;
    return nodo;
  };
  const dinero = centavos => formatoDinero.format(Number(centavos || 0) / 100);
  const fecha = new Date(pedido.creado_en);
  const hoja = crear('section', null, 'hoja-pedido');
  hoja.id = 'impresion-pedido';
  hoja.setAttribute('aria-label', `Resumen de la orden ${pedido.numero}`);

  const cabecera = crear('header', null, 'cabecera-impresion-pedido');
  const identidad = crear('div');
  identidad.append(crear('strong', 'Papelería de Sol'), crear('p', 'Resumen para preparación'));
  const orden = crear('div');
  orden.append(crear('h1', `Orden #${pedido.numero}`), crear('p', Number.isNaN(fecha.getTime()) ? '' : formatoFecha.format(fecha)));
  cabecera.append(identidad, orden);
  hoja.append(cabecera);

  const pago = pedido.estado_financiero === 'pagado' ? 'Pago aprobado'
    : pedido.estado_financiero === 'anticipo_pagado' ? 'Anticipo / pago parcial'
    : pedido.estado_financiero === 'reembolsado' ? 'Reembolsado'
    : pedido.estado_financiero === 'parcialmente_reembolsado' ? 'Reembolso parcial'
    : pedido.estado_financiero === 'incidencia' ? 'Incidencia' : 'Pendiente de pago';
  const medio = pedido.medio_pago_solicitado === 'efectivo' ? 'Efectivo'
    : pedido.medio_pago_solicitado === 'transferencia' ? 'Transferencia bancaria' : 'A coordinar';
  hoja.append(crear('p', `Estado del pedido: ${estadoVisiblePedido(pedido)} · ${pago} · ${medio}`, 'estado-impresion-pedido'));

  const tabla = crear('table', null, 'productos-impresion-pedido');
  const encabezado = crear('thead');
  const titulos = crear('tr');
  ['Preparado', 'Producto / variante', 'Cantidad', 'Precio unitario', 'Subtotal'].forEach(texto => {
    const celda = crear('th', texto);
    celda.scope = 'col';
    titulos.append(celda);
  });
  encabezado.append(titulos);
  const cuerpo = crear('tbody');
  items.forEach(item => {
    const fila = crear('tr');
    const casillero = crear('td', '□', 'casillero-preparacion');
    const producto = crear('td');
    producto.append(crear('strong', item.producto_nombre));
    if (item.variante_nombre) producto.append(crear('span', item.variante_nombre));
    if (item.sku) producto.append(crear('small', `SKU: ${item.sku}`));
    fila.append(casillero, producto, crear('td', item.cantidad),
      crear('td', dinero(item.precio_unitario_centavos)), crear('td', dinero(item.subtotal_centavos)));
    cuerpo.append(fila);
  });
  tabla.append(encabezado, cuerpo);
  hoja.append(tabla);

  const totales = crear('dl', null, 'totales-impresion-pedido');
  const agregarTotal = (nombre, valor, clase = '') => {
    const fila = crear('div', null, clase);
    fila.append(crear('dt', nombre), crear('dd', valor));
    totales.append(fila);
  };
  agregarTotal('Subtotal', dinero(pedido.subtotal_centavos));
  agregarTotal(cupon?.codigo_snapshot ? `Descuento (${cupon.codigo_snapshot})` : 'Descuento', `−${dinero(pedido.descuento_centavos)}`);
  if (pedido.requiere_envio || Number(pedido.envio_centavos) > 0) agregarTotal('Envío', dinero(pedido.envio_centavos));
  agregarTotal('Total', dinero(pedido.total_centavos), 'total-impresion-pedido');
  hoja.append(totales);

  if (pedido.observaciones_cliente) {
    const nota = crear('section', null, 'nota-impresion-pedido');
    nota.append(crear('h2', 'Nota del cliente'), crear('p', pedido.observaciones_cliente));
    hoja.append(nota);
  }

  const localizador = crear('section', null, 'localizador-pedido');
  localizador.append(crear('p', 'Recortar por esta línea', 'linea-recorte-pedido'),
    crear('p', 'PAPELERÍA DE SOL · LOCALIZADOR', 'marca-localizador-pedido'),
    crear('h2', `Orden #${pedido.numero}`), crear('strong', pedido.cliente_nombre, 'nombre-localizador-pedido'),
    crear('p', `WhatsApp: ${pedido.cliente_whatsapp || 'Sin informar'}`),
    crear('p', `Correo: ${pedido.cliente_correo || 'Sin informar'}`));
  if (pedido.requiere_envio && pedido.direccion_entrega) localizador.append(crear('p', `Entrega: ${pedido.direccion_entrega}`));
  const unidades = items.reduce((total, item) => total + Number(item.cantidad || 0), 0);
  localizador.append(crear('p', `${unidades} unidad${unidades === 1 ? '' : 'es'} · ${medio}`));
  hoja.append(localizador);
  return hoja;
}

export function imprimirPedido(datos, documento = document, ventana = window) {
  documento.querySelector('#impresion-pedido')?.remove();
  const hoja = crearHojaPedido(datos, documento);
  const tituloAnterior = documento.title;
  const limpiar = () => {
    hoja.remove();
    documento.title = tituloAnterior;
    ventana.removeEventListener('afterprint', limpiar);
  };
  documento.body.append(hoja);
  documento.title = `Orden #${datos.pedido.numero} - Papelería de Sol`;
  ventana.addEventListener('afterprint', limpiar, { once: true });
  try { ventana.print(); } catch (error) { limpiar(); throw error; }
}

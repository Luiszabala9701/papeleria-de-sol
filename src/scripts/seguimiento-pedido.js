import { estadoVisiblePedido, imagenSeguraPedido } from '../servicios/seguimiento-pedido.js';

const raiz = document.querySelector('[data-seguimiento-pedido]');
const error = document.querySelector('[data-error-seguimiento]');
const resultado = document.querySelector('[data-resultado-seguimiento]');
const estadoAcceso = document.querySelector('[data-estado-acceso-seguimiento]');
const dinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const etiquetas = {
  automatico: 'Automático', coordinado: 'Coordinado', solicitud: 'Solicitud recibida', cotizando: 'Cotizando',
  espera_cliente: 'Esperando respuesta', confirmado: 'Confirmado', cancelado: 'Cancelado', finalizado: 'Finalizado',
  no_iniciada: 'No iniciada', espera_anticipo: 'Esperando anticipo', en_diseno: 'En diseño',
  espera_aprobacion: 'Esperando aprobación', en_preparacion: 'En preparación', listo: 'Listo',
  sin_definir: 'Sin definir', pendiente: 'Pendiente', listo_retiro: 'Listo para retirar', retirado: 'Retirado',
  enviado: 'Enviado', entregado: 'Entregado', sin_cobro: 'Sin cobro', anticipo_pagado: 'Anticipo / pago parcial',
  pagado: 'Pago aprobado', parcialmente_reembolsado: 'Reembolso parcial', reembolsado: 'Reembolsado', incidencia: 'Incidencia',
};

function nodo(tipo, texto, clase) {
  const elemento = document.createElement(tipo);
  elemento.textContent = texto;
  if (clase) elemento.className = clase;
  return elemento;
}

function dato(etiqueta, valor) {
  const bloque = nodo('div', '', 'dato-seguimiento');
  bloque.replaceChildren(nodo('span', etiqueta), nodo('strong', valor));
  return bloque;
}

function renderizar(pedido) {
  resultado.replaceChildren();
  const resumen = nodo('div', '', 'grilla-seguimiento');
  resumen.replaceChildren(
    dato('Estado del pedido', estadoVisiblePedido(pedido)),
    dato('Forma de pago', pedido.medio_pago_solicitado === 'efectivo' ? 'Efectivo'
      : pedido.medio_pago_solicitado === 'transferencia' ? 'Transferencia bancaria' : 'A coordinar'),
    dato('Estado del pago', pedido.estado_financiero === 'sin_cobro' ? 'Pendiente de pago'
      : etiquetas[pedido.estado_financiero] || pedido.estado_financiero),
    dato('Total', dinero.format(Number(pedido.total_centavos || 0) / 100)),
  );
  const lista = nodo('ul', '', 'lista-seguimiento');
  (pedido.pedido_items || []).forEach((item) => {
    const nombre = item.variante_nombre ? `${item.producto_nombre} · ${item.variante_nombre}` : item.producto_nombre;
    const fila = nodo('li', '', 'producto-seguimiento');
    const imagen = document.createElement('img');
    imagen.src = imagenSeguraPedido(item.imagen_url);
    imagen.alt = nombre;
    imagen.width = 80;
    imagen.height = 80;
    imagen.loading = 'lazy';
    imagen.decoding = 'async';
    imagen.referrerPolicy = 'no-referrer';
    imagen.addEventListener('error', () => { imagen.src = '/marca/producto-sin-imagen.svg'; }, { once: true });
    const detalle = nodo('div', '', 'detalle-producto-seguimiento');
    detalle.append(nodo('strong', nombre), nodo('span', `Cantidad: ${item.cantidad}`),
      nodo('span', dinero.format(Number(item.subtotal_centavos || 0) / 100)));
    fila.append(imagen, detalle);
    lista.append(fila);
  });
  resultado.append(nodo('h2', `Orden #${pedido.numero}`), resumen, nodo('h2', 'Productos'), lista);
  resultado.hidden = false;
}

async function consultar(token) {
  if (!raiz?.dataset.endpointPedidos || !raiz?.dataset.clavePublica) throw new Error('El seguimiento todavía no está configurado.');
  const respuesta = await fetch(raiz.dataset.endpointPedidos, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: raiz.dataset.clavePublica, Authorization: `Bearer ${raiz.dataset.clavePublica}` },
    body: JSON.stringify({ accion: 'consultar_seguimiento', token }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || cuerpo.error) throw new Error(cuerpo.error || 'No pudimos consultar el pedido.');
  renderizar(cuerpo.datos);
  if (estadoAcceso) estadoAcceso.hidden = true;
}

const token = new URLSearchParams(location.search).get('token') || '';
if (token) {
  consultar(token).catch((fallo) => {
    if (estadoAcceso) estadoAcceso.hidden = true;
    error.textContent = fallo.message;
    error.hidden = false;
  });
} else {
  if (estadoAcceso) estadoAcceso.hidden = true;
  error.textContent = 'Abrí el enlace privado que recibiste por correo o WhatsApp para consultar tu pedido.';
  error.hidden = false;
}

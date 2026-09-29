const raiz = document.querySelector('[data-seguimiento-pedido]');
const formulario = document.querySelector('[data-formulario-seguimiento]');
const error = document.querySelector('[data-error-seguimiento]');
const resultado = document.querySelector('[data-resultado-seguimiento]');
const dinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const etiquetas = {
  automatico: 'Automático', coordinado: 'Coordinado', solicitud: 'Solicitud recibida', cotizando: 'Cotizando',
  espera_cliente: 'Esperando respuesta', confirmado: 'Confirmado', cancelado: 'Cancelado', finalizado: 'Finalizado',
  no_iniciada: 'No iniciada', espera_anticipo: 'Esperando anticipo', en_diseno: 'En diseño',
  espera_aprobacion: 'Esperando aprobación', en_preparacion: 'En preparación', listo: 'Listo',
  sin_definir: 'Sin definir', pendiente: 'Pendiente', listo_retiro: 'Listo para retirar', retirado: 'Retirado',
  enviado: 'Enviado', entregado: 'Entregado', sin_cobro: 'Sin cobro', parcial: 'Pago parcial',
  pagado: 'Pago aprobado', reembolsado_parcial: 'Reembolso parcial', reembolsado_total: 'Reembolso total',
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
    dato('Pedido', `#${pedido.numero}`), dato('Tipo', etiquetas[pedido.tipo] || pedido.tipo),
    dato('Estado', etiquetas[pedido.estado_comercial] || pedido.estado_comercial),
    dato('Preparación', etiquetas[pedido.estado_preparacion] || pedido.estado_preparacion),
    dato('Entrega', etiquetas[pedido.estado_entrega] || pedido.estado_entrega),
    dato('Pago', etiquetas[pedido.estado_financiero] || pedido.estado_financiero),
    dato('Total', dinero.format(Number(pedido.total_centavos || 0) / 100)),
  );
  const lista = nodo('ul', '', 'lista-seguimiento');
  (pedido.pedido_items || []).forEach((item) => {
    const nombre = item.variante_nombre ? `${item.producto_nombre} · ${item.variante_nombre}` : item.producto_nombre;
    lista.append(nodo('li', `${item.cantidad} × ${nombre} — ${dinero.format(Number(item.subtotal_centavos || 0) / 100)}`));
  });
  resultado.append(nodo('h2', 'Estado actual'), resumen, nodo('h2', 'Productos'), lista);
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
}

formulario?.addEventListener('submit', async (evento) => {
  evento.preventDefault(); error.hidden = true; resultado.hidden = true;
  const boton = formulario.querySelector('button[type="submit"]'); boton.disabled = true;
  try { await consultar(formulario.elements.token.value.trim()); }
  catch (fallo) { error.textContent = fallo.message; error.hidden = false; }
  finally { boton.disabled = false; }
});

const token = new URLSearchParams(location.search).get('token') || '';
if (token) {
  formulario.elements.token.value = token;
  consultar(token).catch((fallo) => { error.textContent = fallo.message; error.hidden = false; });
}

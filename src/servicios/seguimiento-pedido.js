export const ESTADOS_PREPARACION = {
  no_iniciada: 'Pendiente de preparación',
  espera_anticipo: 'Esperando anticipo',
  en_diseno: 'En diseño',
  espera_aprobacion: 'Esperando aprobación',
  en_preparacion: 'En preparación',
  listo: 'Empaquetado y listo',
};

export function estadoVisiblePedido(pedido) {
  if (pedido.estado_comercial === 'cancelado') return 'Cancelado';
  if (pedido.estado_entrega === 'entregado') return 'Entregado';
  if (pedido.estado_entrega === 'retirado') return 'Retirado';
  if (pedido.estado_entrega === 'enviado') return 'Enviado';
  if (pedido.estado_entrega === 'listo_retiro') return 'Listo para retirar';
  if (pedido.estado_comercial === 'finalizado') return 'Finalizado';
  return ESTADOS_PREPARACION[pedido.estado_preparacion] || 'Pendiente de preparación';
}

export function imagenSeguraPedido(valor) {
  if (typeof valor !== 'string' || /[\\\u0000-\u0020]/.test(valor)) return '/marca/producto-sin-imagen.svg';
  if (/^\/(?!\/)/.test(valor)) return valor;
  try {
    const url = new URL(valor);
    if (url.protocol === 'https:' && !url.username && !url.password
      && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
      && url.pathname.startsWith('/storage/v1/object/public/')) return url.href;
  } catch { /* Un dato inválido usa la miniatura neutra. */ }
  return '/marca/producto-sin-imagen.svg';
}

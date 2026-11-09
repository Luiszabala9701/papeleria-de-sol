import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  bytesHex, crearTokenDeterminista, hmacSha256, normalizarCreacion,
  normalizarCotizacion, serializarCanonico, sha256, validarTokenSeguimiento, imagenDeArticulo,
} from './validacion.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') || '';
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SECRETO_TOKENS = Deno.env.get('PEDIDOS_TOKEN_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || '';
const RESEND_REPLY_TO = Deno.env.get('RESEND_REPLY_TO') || '';
const URL_SITIO = (Deno.env.get('URL_SITIO') || 'https://papeleria-de-sol-pruebas.netlify.app').replace(/\/$/, '');
const ORIGENES = new Set([
  URL_SITIO,
  'https://papeleria-de-sol-pruebas.netlify.app',
  'https://papeleriadesol.com.ar',
  'https://www.papeleriadesol.com.ar',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
]);
const cliente = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cabeceras(solicitud: Request) {
  const origen = solicitud.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.has(origen) ? origen : URL_SITIO,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function responder(solicitud: Request, cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(solicitud) });
}

function mensajeSeguro(error: unknown) {
  const mensaje = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error ? String(error.message || '') : '';
  return /^(La |Las |El |Los |Un |Una |Este |Esta |Falta|Faltan|Uno |No hay|Ya )/.test(mensaje)
    ? mensaje
    : 'No pudimos procesar la solicitud. Intentá nuevamente.';
}

async function consumirLimite(solicitud: Request, accion: string, limite: number) {
  if (!SECRETO_TOKENS) throw new Error('La función de pedidos todavía no está configurada.');
  const direccion = solicitud.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || solicitud.headers.get('cf-connecting-ip') || 'sin-direccion';
  const hash = await hmacSha256(SECRETO_TOKENS, `ip:${direccion}`);
  const { data, error } = await cliente.rpc('consumir_limite_solicitudes', {
    p_clave_hash: bytesHex(hash), p_accion: accion, p_limite: limite, p_ventana_segundos: 600,
  });
  if (error) throw error;
  if (!data) throw new Error('Se alcanzó el límite temporal de solicitudes. Esperá unos minutos.');
}

async function leerCuerpo(solicitud: Request) {
  const texto = await solicitud.text();
  if (texto.length > 32_000) throw new Error('La solicitud es demasiado grande.');
  try { return JSON.parse(texto); } catch { throw new Error('La solicitud no es válida.'); }
}

function escaparHtml(valor: unknown) {
  const entidades: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  };
  return String(valor ?? '').replace(/[&<>'"]/g, caracter => entidades[caracter] || caracter);
}

async function marcarOutbox(pedidoId: string, cambios: Record<string, unknown>) {
  await cliente.from('notificaciones_outbox').update(cambios)
    .eq('pedido_id', pedidoId).eq('evento', 'solicitud_recibida');
}

async function enviarCorreoSeguimiento(
  pedido: Record<string, any>, destinatario: string, seguimientoUrl: string,
) {
  const { data: configuracion } = await cliente.from('configuraciones_sitio')
    .select('valor').eq('clave', 'correos_transaccionales_habilitados').maybeSingle();
  if (configuracion?.valor !== true) return 'deshabilitado';

  const { data: notificacion } = await cliente.from('notificaciones_outbox')
    .select('id,estado,intentos').eq('pedido_id', pedido.id)
    .eq('evento', 'solicitud_recibida').maybeSingle();
  if (notificacion?.estado === 'enviada') return 'enviado';
  const intentos = Math.min(20, Number(notificacion?.intentos || 0) + 1);
  if (!RESEND_API_KEY || !RESEND_FROM) {
    await marcarOutbox(pedido.id, {
      estado: 'error', intentos, ultimo_error_seguro: 'Resend no está configurado en la función.',
      proximo_intento_en: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    return 'pendiente';
  }

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [destinatario],
        reply_to: RESEND_REPLY_TO || undefined,
        subject: `Seguimiento de tu pedido #${pedido.numero} · Papelería de Sol`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#242130;max-width:600px;margin:auto"><h1 style="color:#7b3fc6">Recibimos tu pedido #${escaparHtml(pedido.numero)}</h1><p>Podés consultar su estado cuando quieras desde este enlace privado:</p><p><a href="${escaparHtml(seguimientoUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6547b8;color:#fff;text-decoration:none;font-weight:700">Ver seguimiento del pedido</a></p><p style="font-size:13px;color:#666">No compartas este enlace: permite consultar el estado del pedido.</p></div>`,
      }),
    });
    if (!respuesta.ok) throw new Error(`Resend respondió ${respuesta.status}.`);
    const enviado = await respuesta.json().catch(() => ({}));
    await marcarOutbox(pedido.id, {
      estado: 'enviada', intentos, enviado_en: new Date().toISOString(), ultimo_error_seguro: null,
      datos: { pedido_id: pedido.id, numero: pedido.numero, proveedor_id: enviado.id || null },
    });
    return 'enviado';
  } catch (error) {
    const mensaje = error instanceof Error ? error.message.slice(0, 300) : 'No se pudo enviar el correo.';
    await marcarOutbox(pedido.id, {
      estado: 'error', intentos, ultimo_error_seguro: mensaje,
      proximo_intento_en: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    return 'pendiente';
  }
}

async function cotizarSolicitud(solicitud: Request, cuerpo: unknown) {
  await consumirLimite(solicitud, 'cotizar_pedido', 30);
  const datos = normalizarCotizacion(cuerpo);
  const { data, error } = await cliente.rpc('cotizar_solicitud_pedido', {
    p_lineas: datos.lineas,
    p_codigo_cupon: datos.cupon,
  });
  if (error) throw error;
  return data;
}

async function crearSolicitud(solicitud: Request, cuerpo: unknown) {
  await consumirLimite(solicitud, 'crear_pedido', 10);
  const datos = normalizarCreacion(cuerpo);
  const token = await crearTokenDeterminista(SECRETO_TOKENS, datos.clave_idempotencia);
  const [tokenHash, compradorHash, solicitudHash] = await Promise.all([
    sha256(token),
    hmacSha256(SECRETO_TOKENS, `comprador:${datos.cliente.correo}`),
    sha256(serializarCanonico(datos)),
  ]);
  const { data, error } = await cliente.rpc('crear_solicitud_pedido_checkout', {
    p_lineas: datos.lineas,
    p_cliente_nombre: datos.cliente.nombre,
    p_cliente_correo: datos.cliente.correo,
    p_cliente_whatsapp: datos.cliente.whatsapp,
    p_observaciones: datos.observaciones || null,
    p_medio_pago_solicitado: datos.medio_pago,
    p_codigo_cupon: datos.cupon,
    p_clave_idempotencia: datos.clave_idempotencia,
    p_solicitud_hash: bytesHex(solicitudHash),
    p_comprador_hash: bytesHex(compradorHash),
    p_token_hash: bytesHex(tokenHash),
  });
  if (error) throw error;
  const { data: configuracion } = await cliente.from('configuraciones_sitio')
    .select('valor').eq('clave', 'whatsapp').maybeSingle();
  const whatsapp = String(configuracion?.valor || '').replace(/\D/g, '');
  const mensaje = data.tipo === 'coordinado'
    ? `Hola, registré la solicitud #${data.numero} en Papelería de Sol. Quisiera coordinar los detalles.`
    : `Hola, registré el pedido #${data.numero} en Papelería de Sol. Quisiera continuar con la compra.`;
  const seguimientoUrl = `${URL_SITIO}/seguimiento?token=${encodeURIComponent(token)}`;
  const correoEstado = await enviarCorreoSeguimiento(data, datos.cliente.correo, seguimientoUrl);
  return {
    ...data,
    seguimiento_url: seguimientoUrl,
    whatsapp_url: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}` : null,
    correo_estado: correoEstado,
  };
}

async function consultarSeguimiento(solicitud: Request, cuerpo: Record<string, unknown>) {
  await consumirLimite(solicitud, 'consultar_pedido', 30);
  const token = validarTokenSeguimiento(cuerpo.token);
  const tokenHash = bytesHex(await sha256(token));
  const { data: acceso, error: errorAcceso } = await cliente.from('tokens_consulta_pedido')
    .select('id,pedido_id,vence_en,revocado_en').eq('token_hash', tokenHash).maybeSingle();
  if (errorAcceso) throw errorAcceso;
  if (!acceso || acceso.revocado_en || new Date(acceso.vence_en).getTime() <= Date.now()) {
    throw new Error('El enlace de seguimiento no es válido o venció.');
  }
  const { data, error } = await cliente.from('pedidos').select(`
    numero,tipo,moneda,subtotal_centavos,descuento_centavos,envio_centavos,total_centavos,
    estado_comercial,estado_preparacion,estado_entrega,estado_financiero,medio_pago_solicitado,creado_en,actualizado_en,
    pedido_items(producto_id,variante_id,producto_nombre,variante_nombre,sku,precio_unitario_centavos,cantidad,subtotal_centavos,imagen_url_snapshot),
    pedido_cupones(codigo_snapshot,descuento_centavos)
  `).eq('id', acceso.pedido_id).single();
  if (error) throw error;
  // Los pedidos anteriores a la migración conservan sus snapshots económicos;
  // sólo completamos la miniatura de la respuesta con fotos actuales del catálogo.
  const idsSinFoto = [...new Set((data.pedido_items || [])
    .filter((item: any) => !item.imagen_url_snapshot && item.producto_id)
    .map((item: any) => item.producto_id))];
  let imagenes: any[] = [];
  if (idsSinFoto.length) {
    const consulta = await cliente.from('imagenes')
      .select('producto_id,variante_id,url_publica,es_principal,orden').in('producto_id', idsSinFoto);
    if (!consulta.error) imagenes = consulta.data || [];
  }
  const itemsConImagen = (data.pedido_items || []).map((item: any) => {
    const { producto_id, variante_id, imagen_url_snapshot, ...detalle } = item;
    return { ...detalle, imagen_url: imagen_url_snapshot || imagenDeArticulo({ producto_id, variante_id }, imagenes) };
  });
  await cliente.from('tokens_consulta_pedido').update({ ultimo_uso_en: new Date().toISOString() }).eq('id', acceso.id);
  return { ...data, pedido_items: itemsConImagen };
}

Deno.serve(async (solicitud) => {
  if (solicitud.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(solicitud) });
  const origen = solicitud.headers.get('origin') || '';
  if (!ORIGENES.has(origen)) return responder(solicitud, { error: 'Origen no permitido.' }, 403);
  if (solicitud.method !== 'POST') return responder(solicitud, { error: 'Método no permitido.' }, 405);
  if (!URL_SUPABASE || !CLAVE_SERVICIO || SECRETO_TOKENS.length < 32) {
    return responder(solicitud, { error: 'La función de pedidos todavía no está configurada.' }, 503);
  }
  try {
    const cuerpo = await leerCuerpo(solicitud);
    const accion = String(cuerpo?.accion || '');
    if (accion === 'cotizar_solicitud') return responder(solicitud, { datos: await cotizarSolicitud(solicitud, cuerpo) });
    if (accion === 'crear_solicitud') return responder(solicitud, { datos: await crearSolicitud(solicitud, cuerpo) });
    if (accion === 'consultar_seguimiento') return responder(solicitud, { datos: await consultarSeguimiento(solicitud, cuerpo) });
    return responder(solicitud, { error: 'La acción solicitada no existe.' }, 400);
  } catch (error) {
    const mensaje = mensajeSeguro(error);
    const estado = /límite temporal/.test(mensaje) ? 429 : /no es válido|venció/.test(mensaje) ? 404 : 400;
    return responder(solicitud, { error: mensaje }, estado);
  }
});

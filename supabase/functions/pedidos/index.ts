import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  bytesHex, crearTokenDeterminista, hmacSha256, normalizarCreacion,
  serializarCanonico, sha256, validarTokenSeguimiento,
} from './validacion.ts';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') || '';
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SECRETO_TOKENS = Deno.env.get('PEDIDOS_TOKEN_SECRET') || '';
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
  return /^(La |Las |El |Los |Un |Una |Falta|Faltan|Uno |No hay|Ya )/.test(mensaje)
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

async function crearSolicitud(solicitud: Request, cuerpo: unknown) {
  await consumirLimite(solicitud, 'crear_pedido', 10);
  const datos = normalizarCreacion(cuerpo);
  const token = await crearTokenDeterminista(SECRETO_TOKENS, datos.clave_idempotencia);
  const [tokenHash, compradorHash, solicitudHash] = await Promise.all([
    sha256(token),
    hmacSha256(SECRETO_TOKENS, `comprador:${datos.cliente.correo}`),
    sha256(serializarCanonico(datos)),
  ]);
  const { data, error } = await cliente.rpc('crear_solicitud_pedido', {
    p_lineas: datos.lineas,
    p_cliente_nombre: datos.cliente.nombre,
    p_cliente_correo: datos.cliente.correo,
    p_cliente_whatsapp: datos.cliente.whatsapp,
    p_observaciones: datos.observaciones || null,
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
  return {
    ...data,
    seguimiento_url: `${URL_SITIO}/seguimiento?token=${encodeURIComponent(token)}`,
    whatsapp_url: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}` : null,
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
    estado_comercial,estado_preparacion,estado_entrega,estado_financiero,creado_en,actualizado_en,
    pedido_items(producto_nombre,variante_nombre,sku,precio_unitario_centavos,cantidad,subtotal_centavos),
    pedido_cupones(codigo_snapshot,descuento_centavos)
  `).eq('id', acceso.pedido_id).single();
  if (error) throw error;
  await cliente.from('tokens_consulta_pedido').update({ ultimo_uso_en: new Date().toISOString() }).eq('id', acceso.id);
  return data;
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
    if (accion === 'crear_solicitud') return responder(solicitud, { datos: await crearSolicitud(solicitud, cuerpo) });
    if (accion === 'consultar_seguimiento') return responder(solicitud, { datos: await consultarSeguimiento(solicitud, cuerpo) });
    return responder(solicitud, { error: 'La acción solicitada no existe.' }, 400);
  } catch (error) {
    const mensaje = mensajeSeguro(error);
    const estado = /límite temporal/.test(mensaje) ? 429 : /no es válido|venció/.test(mensaje) ? 404 : 400;
    return responder(solicitud, { error: mensaje }, estado);
  }
});

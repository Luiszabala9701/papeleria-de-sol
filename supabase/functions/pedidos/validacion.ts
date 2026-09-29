const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP = /^\+?[0-9 ()-]{6,30}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function texto(valor: unknown, maximo: number, requerido = false) {
  if (valor == null && !requerido) return '';
  if (typeof valor !== 'string') throw new Error('Los datos enviados no tienen un formato válido.');
  const limpio = valor.trim();
  if ((requerido && !limpio) || limpio.length > maximo) throw new Error('Los datos enviados no tienen un formato válido.');
  return limpio;
}

function ordenarObjeto(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarObjeto);
  if (!valor || typeof valor !== 'object') return valor;
  return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, contenido]) => [clave, ordenarObjeto(contenido)]));
}

export function normalizarCreacion(cuerpo: unknown) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) throw new Error('La solicitud no es válida.');
  const entrada = cuerpo as Record<string, unknown>;
  if (!Array.isArray(entrada.lineas) || entrada.lineas.length < 1 || entrada.lineas.length > 100) {
    throw new Error('La selección debe contener entre 1 y 100 artículos.');
  }
  const lineas = entrada.lineas.map((linea) => {
    if (!linea || typeof linea !== 'object' || Array.isArray(linea)) throw new Error('Un artículo no es válido.');
    const item = linea as Record<string, unknown>;
    if (typeof item.producto_id !== 'string' || !UUID.test(item.producto_id)) throw new Error('Un producto no es válido.');
    const variante = item.variante_id == null || item.variante_id === '' ? null : item.variante_id;
    if (variante !== null && (typeof variante !== 'string' || !UUID.test(variante))) throw new Error('Una variante no es válida.');
    const cantidad = Number(item.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) throw new Error('Una cantidad no es válida.');
    const opciones = item.opciones == null ? {} : item.opciones;
    if (!opciones || typeof opciones !== 'object' || Array.isArray(opciones) || JSON.stringify(opciones).length > 2000) {
      throw new Error('Las opciones del artículo no son válidas.');
    }
    return { producto_id: item.producto_id.toLowerCase(), variante_id: variante?.toLowerCase() || null, cantidad, opciones: ordenarObjeto(opciones) };
  });
  const cliente = entrada.cliente;
  if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)) throw new Error('Faltan los datos de contacto.');
  const datosCliente = cliente as Record<string, unknown>;
  const nombre = texto(datosCliente.nombre, 120, true);
  const correo = texto(datosCliente.correo, 254, true).toLowerCase();
  const whatsapp = texto(datosCliente.whatsapp, 30, true);
  if (!CORREO.test(correo) || !WHATSAPP.test(whatsapp)) throw new Error('Los datos de contacto no son válidos.');
  const idempotencia = texto(entrada.clave_idempotencia, 120, true);
  if (idempotencia.length < 16 || !/^[A-Za-z0-9:_-]+$/.test(idempotencia)) throw new Error('La clave de la solicitud no es válida.');
  const observaciones = texto(entrada.observaciones, 1000);
  const cupon = texto(entrada.cupon, 40).toUpperCase();
  if (cupon && !/^[A-Z0-9_-]{3,40}$/.test(cupon)) throw new Error('El código de cupón no es válido.');
  return { lineas, cliente: { nombre, correo, whatsapp }, observaciones, cupon: cupon || null, clave_idempotencia: idempotencia };
}

export function validarTokenSeguimiento(valor: unknown) {
  if (typeof valor !== 'string' || !TOKEN.test(valor)) throw new Error('El enlace de seguimiento no es válido.');
  return valor;
}

export function bytesHex(bytes: Uint8Array) {
  return `\\x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function bytesBase64Url(bytes: Uint8Array) {
  let binario = '';
  bytes.forEach(byte => { binario += String.fromCharCode(byte); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256(valor: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor)));
}

export async function hmacSha256(secreto: string, valor: string) {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(valor)));
}

export async function crearTokenDeterminista(secreto: string, idempotencia: string) {
  return bytesBase64Url(await hmacSha256(secreto, `seguimiento:${idempotencia}`));
}

export function serializarCanonico(valor: unknown) {
  return JSON.stringify(ordenarObjeto(valor));
}

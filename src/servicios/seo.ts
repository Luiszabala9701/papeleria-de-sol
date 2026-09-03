import type { Producto } from '../tipos/contenidos';

export const URL_SITIO_PRINCIPAL = 'https://papeleriadesol.com.ar';

export const NOMBRE_SITIO = 'Papelería de Sol';
export const NOMBRES_ALTERNATIVOS_SITIO = ['Papeleria de Sol', 'papeleriadesol', 'papeleriadesol.com.ar'];

export const PALABRAS_CLAVE_SITIO = [
  NOMBRE_SITIO,
  'papelería creativa',
  'stickers CABA',
  'stickers GBA',
  'papelería personalizada',
  'regalos personalizados',
  'comprar por WhatsApp',
  'calcomanías',
  'pegatinas para cuadernos',
  'llaveros acrílicos',
  'cuadernos A6',
].join(', ');

const MARCA = NOMBRE_SITIO;
const SUFIJO_MARCA = ` | ${MARCA}`;
const LONGITUD_MAXIMA_TITULO = 60;
const LONGITUD_MAXIMA_DESCRIPCION = 160;

function normalizarTexto(texto: string) {
  return texto.replace(/\s+/g, ' ').trim();
}

function recortarEnPalabra(texto: string, longitudMaxima: number) {
  if (texto.length <= longitudMaxima) return texto;

  const longitudTexto = Math.max(1, longitudMaxima - 1);
  const recorte = texto.slice(0, longitudTexto + 1);
  const ultimoEspacio = recorte.lastIndexOf(' ');
  const limite = ultimoEspacio > longitudTexto * 0.6 ? ultimoEspacio : longitudTexto;

  return `${recorte.slice(0, limite).trimEnd()}…`;
}

export function crearTituloSeo(titulo: string, marcaPrimero = false) {
  const tituloSinMarca = normalizarTexto(titulo)
    .replace(/^Papelería de Sol\s*\|\s*/i, '')
    .replace(/\s*\|\s*Papelería de Sol\s*$/i, '')
    .trim();

  if (!tituloSinMarca || tituloSinMarca.toLocaleLowerCase('es-AR') === MARCA.toLocaleLowerCase('es-AR')) {
    return MARCA;
  }

  const longitudDisponible = LONGITUD_MAXIMA_TITULO - SUFIJO_MARCA.length;
  const detalle = recortarEnPalabra(tituloSinMarca, longitudDisponible);
  return marcaPrimero ? `${MARCA} | ${detalle}` : `${detalle}${SUFIJO_MARCA}`;
}

export function crearDescripcionSeo(descripcion: string) {
  return recortarEnPalabra(normalizarTexto(descripcion), LONGITUD_MAXIMA_DESCRIPCION);
}

export function crearDescripcionProductoSeo(producto: Pick<Producto, 'nombre' | 'descripcion' | 'meta_descripcion' | 'tipo_producto'>) {
  if (producto.meta_descripcion?.trim()) {
    return crearDescripcionSeo(producto.meta_descripcion);
  }

  const nombre = recortarEnPalabra(normalizarTexto(producto.nombre), 70);
  const cierre = ' Consultá por WhatsApp en CABA y GBA.';
  const descripcion = normalizarTexto(producto.descripcion || 'Consultá las características y la disponibilidad de este producto.');
  const esDescripcionGenerica = producto.tipo_producto === 'sticker'
    && /^Diseño de sticker número \d+ disponible para consultar por WhatsApp\.?$/i.test(descripcion);
  const resumen = esDescripcionGenerica
    ? 'Sticker para decorar cuadernos, agendas y notebooks.'
    : descripcion;
  const espacioResumen = LONGITUD_MAXIMA_DESCRIPCION - nombre.length - cierre.length - 2;
  return `${nombre}. ${recortarEnPalabra(resumen, espacioResumen)}${cierre}`;
}

export function crearUrlAbsoluta(ruta: string | URL) {
  return new URL(ruta, URL_SITIO_PRINCIPAL).href;
}

export function escaparJsonLd(valor: unknown) {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

export function escaparXml(valor: string) {
  return valor.replace(/[<>&'\"]/g, (caracter) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[caracter] || caracter);
}

export const URL_SITIO_PRINCIPAL = 'https://papeleriadesol.com.ar';

export const PALABRAS_CLAVE_SITIO = [
  'papelería creativa',
  'stickers CABA',
  'stickers GBA',
  'papelería personalizada',
  'regalos personalizados',
  'comprar por WhatsApp',
].join(', ');

const MARCA = 'Papelería de Sol';
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

export function crearTituloSeo(titulo: string) {
  const tituloSinMarca = normalizarTexto(titulo)
    .replace(/\s*\|\s*Papelería de Sol\s*$/i, '')
    .trim();

  if (!tituloSinMarca || tituloSinMarca.toLocaleLowerCase('es-AR') === MARCA.toLocaleLowerCase('es-AR')) {
    return MARCA;
  }

  const longitudDisponible = LONGITUD_MAXIMA_TITULO - SUFIJO_MARCA.length;
  return `${recortarEnPalabra(tituloSinMarca, longitudDisponible)}${SUFIJO_MARCA}`;
}

export function crearDescripcionSeo(descripcion: string) {
  return recortarEnPalabra(normalizarTexto(descripcion), LONGITUD_MAXIMA_DESCRIPCION);
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

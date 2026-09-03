export const PRODUCTOS_POR_PAGINA = 48;

export function tituloPaginaCatalogo(tipo, pagina = 1) {
  const titulo = {
    sticker: 'Stickers y calcomanías',
    fisico: 'Llaveros, cuadernos y regalos',
    plantilla: 'Plantillas creativas',
  }[tipo];
  return `${titulo}${pagina > 1 ? ` · Página ${pagina}` : ''}`;
}

function textoNormalizado(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * @template {{nombre: string, sku?: string, descripcion?: string, categoria?: {id: string} | null}} T
 * @param {T[]} productos
 * @param {URLSearchParams} parametros
 */
export function obtenerPaginaCatalogo(productos, parametros) {
  const buscar = parametros.get('buscar')?.trim() || '';
  const categoria = parametros.get('categoria') || '';
  const termino = textoNormalizado(buscar);
  const filtrados = productos.filter((producto) => {
    const coincideCategoria = !categoria || producto.categoria?.id === categoria;
    const texto = textoNormalizado([producto.nombre, producto.sku, producto.descripcion].join(' '));
    return coincideCategoria && (!termino || texto.includes(termino));
  });
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PRODUCTOS_POR_PAGINA));
  const solicitada = Number(parametros.get('pagina'));
  const pagina = Number.isSafeInteger(solicitada) && solicitada > 0
    ? Math.min(solicitada, totalPaginas)
    : 1;
  const inicio = (pagina - 1) * PRODUCTOS_POR_PAGINA;

  return {
    buscar,
    categoria,
    pagina,
    totalPaginas,
    totalProductos: filtrados.length,
    visibles: filtrados.slice(inicio, inicio + PRODUCTOS_POR_PAGINA),
    tieneFiltros: Boolean(buscar || categoria),
  };
}

export function crearUrlCatalogo(ruta, { pagina = 1, buscar = '', categoria = '' } = {}) {
  const parametros = new URLSearchParams();
  if (buscar) parametros.set('buscar', buscar);
  if (categoria) parametros.set('categoria', categoria);
  if (pagina > 1) parametros.set('pagina', String(pagina));
  const consulta = parametros.toString();
  return `${ruta}${consulta ? `?${consulta}` : ''}`;
}

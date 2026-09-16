import contenidoDemostracion from '../datos/contenido-demostracion.json';
import { normalizarTextoBusqueda, obtenerPaginaCatalogo, PRODUCTOS_POR_PAGINA } from './catalogo.js';
import { normalizarProductoVenta } from './variantes.js';
import {
  configuracionSupabaseDisponible,
  obtenerClienteSupabase,
} from './cliente-supabase.js';

const usarDemostracion =
  import.meta.env.PUBLIC_USAR_DATOS_DEMOSTRACION !== 'false';

const CAMPOS_PRODUCTO_PUBLICO = `
  id,
  categoria_id,
  tipo_producto,
  nombre,
  slug,
  sku,
  descripcion,
  precio,
  moneda,
  controla_stock,
  usa_variantes,
  stock,
  estado,
  destacado,
  en_carrusel_inicio,
  orden_carrusel,
  orden,
  meta_titulo,
  meta_descripcion,
  categoria:categorias(id,nombre,slug,tipo_producto,publicada,orden),
  imagenes(id,variante_id,url_publica,texto_alternativo,es_principal,orden),
  variantes(id,clave,nombre,descripcion,sku,precio,stock,estado,orden)
`;

function informarFallo(contexto, error) {
  console.warn(`[Papelería de Sol] ${contexto}:`, error?.message || error);
}

function crearStickersDemostracion() {
  return Array.from({ length: 1000 }, (_, indice) => {
    const numero = indice + 1;
    const sku = `ST-${String(numero).padStart(4, '0')}`;
    const descripcion = [
      'Papel autoadhesivo',
      'Tamaño: 5 cm',
      'Impresión: Full color',
    ].join('\n');

    return {
      id: `sticker-demostracion-${numero}`,
      nombre: `Sticker #${numero}`,
      slug: `sticker-${numero}`,
      sku,
      descripcion,
      tipo_producto: 'sticker',
      precio: 199,
      moneda: 'ARS',
      usa_variantes: true,
      controla_stock: false,
      stock: null,
      destacado: numero <= 8,
      en_carrusel_inicio: numero <= 3,
      orden_carrusel: numero,
      estado: 'publicado',
      orden: numero,
      categoria: null,
      variantes: [
        { id: `variante-comun-${numero}`, clave: 'comun', nombre: 'Común', sku, precio: 199, stock: null, estado: 'publicado', orden: 0 },
        { id: `variante-holografico-${numero}`, clave: 'holografico', nombre: 'Holográfico', sku, precio: 499, stock: null, estado: 'publicado', orden: 1 },
        { id: `variante-resistente-agua-${numero}`, clave: 'resistente_agua', nombre: 'Resistente al agua', sku, precio: 499, stock: null, estado: 'publicado', orden: 2 },
      ],
      imagenes: [
        {
          id: `imagen-sticker-${numero}`,
          url_publica: `/stickers/${numero}.webp`,
          texto_alternativo: `Sticker creativo número ${numero} de Papelería de Sol`,
          es_principal: true,
          orden: 1
        }
      ]
    };
  });
}

function normalizarProducto(producto) {
  return normalizarProductoVenta(producto);
}

async function ejecutarConRespaldo(contexto, consulta, respaldo) {
  if (!configuracionSupabaseDisponible()) {
    return respaldo();
  }

  try {
    const resultado = await consulta(obtenerClienteSupabase());

    if (resultado.error) {
      throw resultado.error;
    }

    return resultado.data;
  } catch (error) {
    informarFallo(contexto, error);

    if (usarDemostracion) {
      return respaldo();
    }

    throw error;
  }
}

export async function obtenerConfiguracionSitio() {
  const datos = await ejecutarConRespaldo(
    'No se pudo obtener la configuración pública',
    (cliente) =>
      cliente
        .from('configuraciones_sitio')
        .select('clave, valor')
        .eq('publica', true),
    () =>
      Object.entries(contenidoDemostracion.configuracion).map(([clave, valor]) => ({
        clave,
        valor,
      })),
  );

  return Object.fromEntries(datos.map(({ clave, valor }) => [clave, valor]));
}

export async function obtenerSeccionesPublicadas() {
  return ejecutarConRespaldo(
    'No se pudieron obtener las secciones',
    (cliente) =>
      cliente
        .from('secciones')
        .select('id, clave, titulo, subtitulo, contenido, imagen_url, texto_boton, enlace_boton, publicada, orden')
        .eq('publicada', true)
        .order('orden'),
    () => contenidoDemostracion.secciones,
  );
}

export async function obtenerCategoriasPublicadas() {
  return ejecutarConRespaldo(
    'No se pudieron obtener las categorías',
    (cliente) =>
      cliente
        .from('categorias')
        .select('id, nombre, slug, descripcion, tipo_producto, publicada, orden')
        .eq('publicada', true)
        .order('orden'),
    () => contenidoDemostracion.categorias,
  );
}

export async function obtenerProductosPublicados({ tipo } = {}) {
  const datos = await ejecutarConRespaldo(
    'No se pudieron obtener los productos',
    async (cliente) => {
      const productos = [];
      const tamanoLote = 500;

      for (let inicio = 0; ; inicio += tamanoLote) {
        let consulta = cliente
          .from('productos')
          .select(CAMPOS_PRODUCTO_PUBLICO)
          .eq('estado', 'publicado')
          .order('orden')
          .order('creado_en', { ascending: false })
          .order('id')
          .range(inicio, inicio + tamanoLote - 1);

        if (tipo) {
          consulta = consulta.eq('tipo_producto', tipo);
        }

        const { data, error } = await consulta;
        if (error) return { data: null, error };
        productos.push(...data);
        if (data.length < tamanoLote) return { data: productos, error: null };
      }
    },
    () => {
      const productos = crearStickersDemostracion();
      return tipo ? productos.filter((producto) => producto.tipo_producto === tipo) : productos;
    },
  );

  return datos.map(normalizarProducto);
}

export async function obtenerProductosInicio() {
  const datos = await ejecutarConRespaldo(
    'No se pudieron obtener los productos del inicio',
    (cliente) => cliente
      .from('productos')
      .select(CAMPOS_PRODUCTO_PUBLICO)
      .eq('estado', 'publicado')
      .or('destacado.eq.true,en_carrusel_inicio.eq.true')
      .order('orden_carrusel')
      .order('orden')
      .order('id')
      .limit(24),
    () => crearStickersDemostracion()
      .filter((producto) => producto.destacado || producto.en_carrusel_inicio)
      .slice(0, 24),
  );

  return datos.map(normalizarProducto);
}

function limpiarBusquedaCatalogo(valor) {
  return String(valor || '')
    .trim()
    .slice(0, 80)
    .replace(/[%_*,().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoriaValida(valor) {
  const categoria = String(valor || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoria)
    ? categoria
    : '';
}

export async function obtenerPaginaProductosPublicados({ tipo, parametros, porPagina = PRODUCTOS_POR_PAGINA }) {
  const buscar = limpiarBusquedaCatalogo(parametros?.get('buscar'));
  const categoria = categoriaValida(parametros?.get('categoria'));
  const solicitada = Number(parametros?.get('pagina'));
  const paginaSolicitada = Number.isSafeInteger(solicitada) && solicitada > 0 ? solicitada : 1;
  const limite = Math.max(1, Math.min(96, Number(porPagina) || PRODUCTOS_POR_PAGINA));

  if (!configuracionSupabaseDisponible()) {
    const productos = crearStickersDemostracion()
      .filter((producto) => !tipo || producto.tipo_producto === tipo)
      .map(normalizarProducto);
    return obtenerPaginaCatalogo(productos, new URLSearchParams({
      ...(buscar ? { buscar } : {}),
      ...(categoria ? { categoria } : {}),
      pagina: String(paginaSolicitada),
    }));
  }

  const cliente = obtenerClienteSupabase();
  if (buscar) {
    const candidatos = [];
    const tamanoLote = 1000;
    for (let inicio = 0; ; inicio += tamanoLote) {
      let consultaBusqueda = cliente
        .from('productos')
        .select('id,nombre,sku,descripcion,categoria_id')
        .eq('estado', 'publicado')
        .order('orden')
        .order('creado_en', { ascending: false })
        .order('id')
        .range(inicio, inicio + tamanoLote - 1);
      if (tipo) consultaBusqueda = consultaBusqueda.eq('tipo_producto', tipo);
      if (categoria) consultaBusqueda = consultaBusqueda.eq('categoria_id', categoria);
      const { data: lote, error: errorBusqueda } = await consultaBusqueda;
      if (errorBusqueda) throw errorBusqueda;
      candidatos.push(...lote);
      if (lote.length < tamanoLote) break;
    }

    const termino = normalizarTextoBusqueda(buscar);
    const coincidentes = candidatos.filter((producto) => normalizarTextoBusqueda(
      [producto.nombre, producto.sku, producto.descripcion].join(' '),
    ).includes(termino));
    const totalProductos = coincidentes.length;
    const totalPaginas = Math.max(1, Math.ceil(totalProductos / limite));
    const pagina = Math.min(paginaSolicitada, totalPaginas);
    const inicio = (pagina - 1) * limite;
    const ids = coincidentes.slice(inicio, inicio + limite).map((producto) => producto.id);
    let productos = [];

    if (ids.length) {
      const { data, error } = await cliente
        .from('productos')
        .select(CAMPOS_PRODUCTO_PUBLICO)
        .in('id', ids);
      if (error) throw error;
      const posicion = new Map(ids.map((id, indice) => [id, indice]));
      productos = data.sort((primero, segundo) => posicion.get(primero.id) - posicion.get(segundo.id));
    }

    return {
      buscar,
      categoria,
      pagina,
      totalPaginas,
      totalProductos,
      visibles: productos.map(normalizarProducto),
      tieneFiltros: true,
    };
  }

  const crearConsulta = (pagina) => {
    const inicio = (pagina - 1) * limite;
    let consulta = cliente
      .from('productos')
      .select(CAMPOS_PRODUCTO_PUBLICO, { count: 'exact' })
      .eq('estado', 'publicado')
      .order('orden')
      .order('creado_en', { ascending: false })
      .order('id')
      .range(inicio, inicio + limite - 1);

    if (tipo) consulta = consulta.eq('tipo_producto', tipo);
    if (categoria) consulta = consulta.eq('categoria_id', categoria);
    return consulta;
  };

  let { data, error, count } = await crearConsulta(paginaSolicitada);
  if (error) throw error;

  const totalProductos = Number(count || 0);
  const totalPaginas = Math.max(1, Math.ceil(totalProductos / limite));
  const pagina = Math.min(paginaSolicitada, totalPaginas);
  if (pagina !== paginaSolicitada) {
    ({ data, error } = await crearConsulta(pagina));
    if (error) throw error;
  }

  return {
    buscar,
    categoria,
    pagina,
    totalPaginas,
    totalProductos,
    visibles: (data || []).map(normalizarProducto),
    tieneFiltros: Boolean(buscar || categoria),
  };
}

export async function obtenerSlugsProductosPublicados() {
  if (!configuracionSupabaseDisponible()) {
    return crearStickersDemostracion().map((producto) => producto.slug);
  }

  const cliente = obtenerClienteSupabase();
  const slugs = [];
  const tamanoLote = 500;

  for (let inicio = 0; ; inicio += tamanoLote) {
    const { data, error } = await cliente
      .from('productos')
      .select('slug')
      .eq('estado', 'publicado')
      .order('id')
      .range(inicio, inicio + tamanoLote - 1);

    // Un error debe impedir publicar un sitemap incompleto.
    if (error) {
      throw error;
    }

    slugs.push(...data.map((producto) => producto.slug));

    if (data.length < tamanoLote) {
      return slugs;
    }
  }
}

export async function obtenerProductoPorSlug(slug) {
  const producto = await ejecutarConRespaldo(
    `No se pudo obtener el producto ${slug}`,
    (cliente) =>
      cliente
        .from('productos')
        .select(CAMPOS_PRODUCTO_PUBLICO)
        .eq('slug', slug)
        .eq('estado', 'publicado')
        .maybeSingle(),
    () => crearStickersDemostracion().find((elemento) => elemento.slug === slug) || null,
  );

  return producto ? normalizarProducto(producto) : null;
}

export async function obtenerProductosPorIds(ids) {
  const datos = await ejecutarConRespaldo(
    'No se pudo comprobar la selección',
    (cliente) => cliente.from('productos').select(`${CAMPOS_PRODUCTO_PUBLICO}`)
      .eq('estado', 'publicado').in('id', ids),
    () => crearStickersDemostracion().filter((producto) => ids.includes(producto.id)),
  );
  return datos.map(normalizarProducto);
}

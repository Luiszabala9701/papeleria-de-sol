import contenidoDemostracion from '../datos/contenido-demostracion.json';
import {
  configuracionSupabaseDisponible,
  obtenerClienteSupabase,
} from './cliente-supabase.js';

const usarDemostracion =
  import.meta.env.PUBLIC_USAR_DATOS_DEMOSTRACION !== 'false';

function informarFallo(contexto, error) {
  console.warn(`[Papelería de Sol] ${contexto}:`, error?.message || error);
}

function crearStickersDemostracion() {
  return Array.from({ length: 1000 }, (_, indice) => {
    const numero = indice + 1;

    return {
      id: `sticker-demostracion-${numero}`,
      nombre: `Sticker #${numero}`,
      slug: `sticker-${numero}`,
      sku: `ST-${String(numero).padStart(4, '0')}`,
      descripcion: `Diseño de sticker número ${numero} disponible para consultar por WhatsApp.`,
      tipo_producto: 'sticker',
      precio: 100,
      moneda: 'ARS',
      controla_stock: false,
      stock: null,
      destacado: numero <= 8,
      estado: 'publicado',
      orden: numero,
      categoria: null,
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
  return {
    ...producto,
    precio: Number(producto.precio),
    imagenes: [...(producto.imagenes || [])].sort(
      (primera, segunda) => primera.orden - segunda.orden,
    ),
  };
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

const TAMANO_LOTE_PRODUCTOS = 1000;

async function obtenerTodosLosProductosPublicados(cliente, tipo) {
  const productos = [];

  for (let desde = 0; ; desde += TAMANO_LOTE_PRODUCTOS) {
    let consulta = cliente
      .from('productos')
      .select(
        `
          *,
          categoria:categorias(*),
          imagenes(*)
        `,
      )
      .eq('estado', 'publicado')
      .order('orden')
      .order('creado_en', { ascending: false })
      .order('id')
      .range(desde, desde + TAMANO_LOTE_PRODUCTOS - 1);

    if (tipo) consulta = consulta.eq('tipo_producto', tipo);

    const { data, error } = await consulta;
    if (error) return { data: null, error };

    const lote = data || [];
    productos.push(...lote);
    if (lote.length < TAMANO_LOTE_PRODUCTOS) return { data: productos, error: null };
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
        .select('*')
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
        .select('*')
        .eq('publicada', true)
        .order('orden'),
    () => contenidoDemostracion.categorias,
  );
}

export async function obtenerProductosPublicados({ tipo } = {}) {
  const datos = await ejecutarConRespaldo(
    'No se pudieron obtener los productos',
    (cliente) => obtenerTodosLosProductosPublicados(cliente, tipo),
    () => {
      const productos = crearStickersDemostracion();
      return tipo ? productos.filter((producto) => producto.tipo_producto === tipo) : productos;
    },
  );

  return datos.map(normalizarProducto);
}

export async function obtenerProductoPorSlug(slug) {
  const producto = await ejecutarConRespaldo(
    `No se pudo obtener el producto ${slug}`,
    (cliente) =>
      cliente
        .from('productos')
        .select(
          `
            *,
            categoria:categorias(*),
            imagenes(*),
            variantes(*)
          `,
        )
        .eq('slug', slug)
        .eq('estado', 'publicado')
        .maybeSingle(),
    () => crearStickersDemostracion().find((elemento) => elemento.slug === slug) || null,
  );

  return producto ? normalizarProducto(producto) : null;
}

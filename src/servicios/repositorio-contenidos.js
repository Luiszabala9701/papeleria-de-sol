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
      descripcion_corta: `Sticker creativo número ${numero}.`,
      descripcion: `Diseño de sticker número ${numero} disponible para consultar por WhatsApp.`,
      tipo_producto: 'sticker',
      precio: null,
      moneda: 'ARS',
      controla_stock: false,
      stock: null,
      destacado: numero <= 8,
      estado: 'publicado',
      orden: numero,
      categoria: contenidoDemostracion.categorias[0],
      temas: [],
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
    precio:
      producto.precio === null || producto.precio === undefined
        ? null
        : Number(producto.precio),
    temas: producto.productos_temas?.map((relacion) => relacion.tema) || producto.temas || [],
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

export async function obtenerTemasPublicados() {
  return ejecutarConRespaldo(
    'No se pudieron obtener los temas',
    (cliente) =>
      cliente
        .from('temas')
        .select('*')
        .eq('publicado', true)
        .order('orden'),
    () => [],
  );
}

export async function obtenerProductosPublicados({ tipo } = {}) {
  const datos = await ejecutarConRespaldo(
    'No se pudieron obtener los productos',
    (cliente) => {
      let consulta = cliente
        .from('productos')
        .select(
          `
            *,
            categoria:categorias(*),
            imagenes(*),
            productos_temas(tema:temas(*))
          `,
        )
        .eq('estado', 'publicado')
        .order('orden')
        .order('creado_en', { ascending: false });

      if (tipo) {
        consulta = consulta.eq('tipo_producto', tipo);
      }

      return consulta;
    },
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
            variantes(*),
            productos_temas(tema:temas(*))
          `,
        )
        .eq('slug', slug)
        .eq('estado', 'publicado')
        .maybeSingle(),
    () => crearStickersDemostracion().find((elemento) => elemento.slug === slug) || null,
  );

  return producto ? normalizarProducto(producto) : null;
}

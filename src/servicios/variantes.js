export const TIPOS_STICKER = [
  { clave: 'comun', nombre: 'Común' },
  { clave: 'holografico', nombre: 'Holográfico' },
  { clave: 'resistente_agua', nombre: 'Resistente al agua' },
];
export const MAXIMO_VARIANTES_FISICAS = 10;

export function ordenarImagenes(imagenes = []) {
  return [...imagenes].sort((a, b) => Number(Boolean(b.es_principal)) - Number(Boolean(a.es_principal)) || Number(a.orden || 0) - Number(b.orden || 0));
}

/** Normaliza también productos anteriores a la migración, sin inventar existencias. */
export function normalizarProductoVenta(producto) {
  const fisico = producto.tipo_producto === 'fisico';
  const todasLasImagenes = producto.imagenes || [];
  const imagenes = ordenarImagenes(todasLasImagenes.filter((imagen) => !imagen.variante_id));
  const variantes = (producto.variantes || [])
    .filter((variante) => variante.estado === 'publicado')
    .sort((a, b) => Number(a.orden) - Number(b.orden))
    .map((variante) => ({
      ...variante,
      precio: Number(variante.precio),
      stock: fisico ? Math.max(0, Math.floor(Number(variante.stock) || 0)) : null,
      imagenes: ordenarImagenes(todasLasImagenes.filter((imagen) => imagen.variante_id === variante.id)),
    }));
  // La versión común virtual permite previsualizar/actualizar selecciones antiguas.
  // Nunca se guarda su identificador en Supabase: la migración crea la variante real.
  if (producto.tipo_producto === 'sticker' && producto.usa_variantes === undefined && variantes.length === 0) {
    variantes.push({ id: `comun:${producto.id}`, clave: 'comun', nombre: 'Común', sku: producto.sku,
      precio: Number(producto.precio), stock: null, estado: 'publicado', orden: 0, imagenes: [] });
  }
  const usaVariantes = producto.tipo_producto === 'sticker'
    || (fisico && producto.usa_variantes === true);
  const disponibles = variantes.filter((variante) => !fisico || variante.stock > 0);
  const precios = (disponibles.length ? disponibles : variantes).map((variante) => variante.precio);
  const galeriaGeneral = imagenes.length ? imagenes
    : (disponibles.find(v => v.imagenes.length) || variantes.find(v => v.imagenes.length))?.imagenes || [];
  return {
    ...producto, imagenes: galeriaGeneral, variantes,
    usa_variantes: usaVariantes,
    controla_stock: fisico,
    precio: usaVariantes ? (precios.length ? Math.min(...precios) : 0) : Number(producto.precio),
    stock: fisico ? (usaVariantes ? variantes.reduce((total, variante) => total + variante.stock, 0) : Math.max(0, Math.floor(Number(producto.stock) || 0))) : null,
  };
}

export function necesitaElegirVariante(producto) {
  return producto.usa_variantes && producto.variantes?.length !== 1;
}

export function productoSinStock(producto) {
  return producto.usa_variantes && !producto.variantes?.length
    || producto.tipo_producto === 'fisico' && Number(producto.stock || 0) <= 0;
}

export function crearLineaSeleccion(producto, variante = null, cantidad = 1) {
  if (producto.usa_variantes && !variante) {
    if (producto.variantes?.length !== 1) return null;
    variante = producto.variantes[0];
  }
  const imagenes = variante?.imagenes?.length ? variante.imagenes : producto.imagenes;
  const fisico = producto.tipo_producto === 'fisico';
  return {
    id: producto.id,
    clave_linea: `${producto.id}:${variante?.id || 'simple'}`,
    variante_id: variante?.id || null,
    variante_clave: variante?.clave || null,
    nombre_producto: producto.nombre,
    nombre_variante: variante?.nombre || '',
    nombre: variante ? `${producto.nombre} — ${variante.nombre}` : producto.nombre,
    sku: variante?.sku || producto.sku || '',
    slug: producto.slug,
    tipo_producto: producto.tipo_producto,
    precio: variante ? Number(variante.precio) : Number(producto.precio),
    moneda: producto.moneda || 'ARS',
    imagen: imagenes?.[0]?.url_publica || '/stickers/1.webp',
    controla_stock: fisico,
    stock: fisico ? Math.max(0, Number(variante ? variante.stock : producto.stock) || 0) : null,
    cantidad,
  };
}

/** Recalcula siempre contra datos públicos actuales, nunca contra precios enviados por el navegador. */
export function revisarSeleccion(lineas, productos) {
  const actuales = new Map(productos.map((producto) => [producto.id, producto]));
  const agrupadas = new Map();
  const avisos = [];
  for (const anterior of lineas) {
    const producto = actuales.get(anterior.id);
    if (!producto) { avisos.push('Un producto ya no está disponible y se quitó de la selección.'); continue; }
    let variante = null;
    if (producto.usa_variantes) {
      variante = producto.variantes.find((v) => v.id === anterior.variante_id);
      if (!variante && producto.tipo_producto === 'sticker' && (!anterior.variante_id || anterior.variante_id === `comun:${producto.id}`)) {
        variante = producto.variantes.find((v) => v.clave === 'comun');
      }
      if (!variante) { avisos.push(`Elegí nuevamente la variante de ${producto.nombre}.`); continue; }
    } else if (anterior.variante_id) {
      avisos.push(`${producto.nombre} cambió sus opciones; agregalo nuevamente.`); continue;
    }
    const linea = crearLineaSeleccion(producto, variante, Number(anterior.cantidad));
    if (!linea || !Number.isSafeInteger(linea.cantidad) || linea.cantidad < 1 || linea.cantidad > 9999) {
      avisos.push('Se quitó una cantidad no válida.'); continue;
    }
    const existente = agrupadas.get(linea.clave_linea);
    linea.cantidad += existente?.cantidad || 0;
    if (linea.cantidad > 9999) {
      linea.cantidad = 9999;
      avisos.push(`Se ajustó la cantidad de ${linea.nombre} al máximo por consulta.`);
    }
    if (linea.controla_stock && linea.cantidad > linea.stock) {
      linea.cantidad = linea.stock;
      avisos.push(`Se ajustó la cantidad de ${linea.nombre} al stock disponible.`);
    }
    if (Number(anterior.precio) !== linea.precio) avisos.push(`Cambió el precio de ${linea.nombre}.`);
    if (linea.cantidad > 0) agrupadas.set(linea.clave_linea, linea);
  }
  return { lineas: [...agrupadas.values()], avisos: [...new Set(avisos)] };
}

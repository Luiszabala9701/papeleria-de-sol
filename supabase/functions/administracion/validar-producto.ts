const acabados: Record<string, string> = {
  comun: 'Común', holografico: 'Holográfico', resistente_agua: 'Resistente al agua',
};

function numero(valor: unknown, etiqueta: string, entero = false) {
  if (valor === '' || valor == null || typeof valor === 'boolean' ||
    !Number.isFinite(Number(valor)) || Number(valor) < 0 ||
    (entero && !Number.isInteger(Number(valor)))) {
    throw new Error(`El ${etiqueta} es obligatorio y debe ser un número ${entero ? 'entero ' : ''}no negativo.`);
  }
  return Number(valor);
}

export function validarProductoConVariantes(datos: Record<string, unknown>) {
  const tipo = String(datos.tipo_producto);
  if (!['sticker', 'plantilla', 'fisico'].includes(tipo)) throw new Error('El tipo de producto no es válido.');
  if (!String(datos.nombre || '').trim()) throw new Error('El nombre del producto es obligatorio.');
  if (!String(datos.descripcion || '').trim()) throw new Error('La descripción del producto es obligatoria.');
  if (!['borrador', 'publicado'].includes(String(datos.estado))) throw new Error('El estado del producto no es válido.');
  const usar = tipo === 'sticker' || tipo === 'fisico' && datos.usa_variantes === true;
  const versiones = datos.variantes;
  if (!Array.isArray(versiones) || (usar && !versiones.length) ||
    (!usar && versiones.length) || versiones.length > (tipo === 'sticker' ? 3 : 10)) {
    throw new Error('La cantidad de variantes no es válida.');
  }
  const claves = new Set<string>();
  const variantes = versiones.map((entrada, orden) => {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('La variante no es válida.');
    const clave = String(entrada.clave || '');
    if (!clave || claves.has(clave)) throw new Error('La variante está repetida o no tiene identificador.');
    claves.add(clave);
    if (tipo === 'sticker' && !acabados[clave]) throw new Error('El acabado del sticker no es válido.');
    const nombre = tipo === 'sticker' ? acabados[clave] : String(entrada.nombre || '').trim();
    if (!nombre) throw new Error('El nombre de cada variante es obligatorio.');
    if (!['publicado', 'borrador'].includes(entrada.estado)) throw new Error('El estado de la variante no es válido.');
    return {
      id: entrada.id || null, clave, nombre, orden,
      descripcion: tipo === 'fisico' ? String(entrada.descripcion || '').trim() : '',
      precio: numero(entrada.precio, 'precio de cada variante'),
      stock: tipo === 'fisico' ? numero(entrada.stock, 'stock de cada variante', true) : null,
      estado: entrada.estado,
    };
  });
  if (usar && datos.estado === 'publicado' && !variantes.some(v => v.estado === 'publicado')) {
    throw new Error('El producto publicado necesita una variante visible.');
  }
  return {
    ...datos, usa_variantes: usar, controla_stock: tipo === 'fisico', variantes,
    tipo_producto: tipo, nombre: String(datos.nombre).trim(), categoria_id: datos.categoria_id,
    precio: usar ? 0 : numero(datos.precio, 'precio'),
    stock: tipo === 'fisico' ? (usar ? 0 : numero(datos.stock, 'stock', true)) : null,
  };
}

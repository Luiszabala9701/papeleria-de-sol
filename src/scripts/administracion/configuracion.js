export const DESCRIPCIONES_RECURSOS = {
  productos: 'Creá stickers, plantillas y productos físicos con precio, imágenes y publicación.',
  categorias: 'Creá categorías específicas para cada tipo de producto, como Fútbol para stickers.',
  secciones: 'Editá los textos que se muestran en la portada y los datos generales de la tienda.',
};

export const ESQUEMAS_RECURSOS = {
  productos: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo de producto', tipo: 'select', obligatorio: true, soloCreacion: true,
      opciones: [
        { valor: '', texto: 'Elegí un tipo de producto' },
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select-categorias', dependeDe: 'tipo_producto' },
    { nombre: 'sku', etiqueta: 'SKU', tipo: 'text', obligatorio: true, soloCreacion: true },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', obligatorio: true, completo: true },
    { nombre: 'precio', etiqueta: 'Precio en pesos', tipo: 'number', minimo: 0, obligatorio: true },
    {
      nombre: 'estado', etiqueta: 'Estado de publicación', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'borrador', texto: 'No publicado' },
        { valor: 'publicado', texto: 'Publicado' },
      ],
    },
    { nombre: 'controla_stock', etiqueta: 'Controlar stock', tipo: 'checkbox' },
    { nombre: 'stock', etiqueta: 'Stock disponible', tipo: 'number', minimo: 0, dependeDe: 'controla_stock' },
    { nombre: 'destacado', etiqueta: 'Mostrar como destacado', tipo: 'checkbox' },
    { nombre: 'imagenes_nuevas', etiqueta: 'Agregar nuevas imágenes (máximo 5 en total)', tipo: 'file', multiple: true, completo: true, ayuda: 'Podés seleccionar varias imágenes a la vez. Cada archivo puede pesar hasta 5 MB.' },
    { nombre: 'meta_titulo', etiqueta: 'Título para buscadores', tipo: 'text', completo: true, avanzado: true, ayuda: 'Es el título que podría mostrarse en Google. Si se deja vacío, se usa el nombre del producto.' },
    { nombre: 'meta_descripcion', etiqueta: 'Descripción para buscadores', tipo: 'textarea', completo: true, avanzado: true, ayuda: 'Es el texto breve que podría mostrarse debajo del título en Google. Si se deja vacío, se usa la descripción del producto.' },
  ],
  categorias: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo de producto', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', completo: true },
    { nombre: 'publicada', etiqueta: 'Publicada', tipo: 'checkbox' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', minimo: 0 },
  ],
};

export const COLUMNAS_RECURSOS = {
  productos: [
    { clave: 'nombre', texto: 'Producto' },
    { clave: 'imagen_principal', texto: 'Imagen' },
    { clave: 'tipo_producto', texto: 'Tipo' },
    { clave: 'precio', texto: 'Precio' },
    { clave: 'estado', texto: 'Estado' },
    { clave: 'stock', texto: 'Stock' },
  ],
  categorias: [
    { clave: 'nombre', texto: 'Categoría' },
    { clave: 'tipo_producto', texto: 'Tipo' },
    { clave: 'publicada', texto: 'Publicación' },
    { clave: 'orden', texto: 'Orden' },
  ],
  secciones: [
    { clave: 'titulo', texto: 'Sección' },
    { clave: 'clave', texto: 'Clave' },
    { clave: 'publicada', texto: 'Publicación' },
    { clave: 'orden', texto: 'Orden' },
  ],
};

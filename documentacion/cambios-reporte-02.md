# Cambios del reporte 02

## Antes de probar el nuevo panel

En el proyecto de **Supabase de pruebas**, abrí **SQL Editor**, copiá el contenido completo de:

`supabase/migrations/202608230003_catalogo_simple.sql`

y ejecutalo una única vez. El script:

- asigna $100 a los stickers iniciales que aún no tienen precio;
- elimina las categorías genéricas y los temas, tal como fue confirmado;
- convierte la sección de stickers existente en el bloque administrable de destacados del inicio;
- agrega los textos de cabecera y footer al apartado **Contenido del sitio**;
- impide desde la propia base de datos guardar más de cinco imágenes por producto.

No ejecutarlo todavía en Supabase de producción. Una vez probado y aprobado en `pruebas`, se aplicará allí como parte de la publicación.

## Formulario de productos

Los campos con asterisco rojo son obligatorios. La dirección amigable se genera automáticamente con el nombre y no aparece en el formulario.

El precio es obligatorio al crear y editar. El número de orden se asigna automáticamente al crear: cada nuevo producto queda después de los existentes, sin que la administradora tenga que decidirlo.

Al elegir el tipo de producto, el selector de categoría muestra únicamente categorías del mismo tipo. Por ejemplo, una categoría **Fútbol** creada como **Sticker** solo aparece al cargar un sticker.

El ícono `!` junto a **Estado de publicación** explica la diferencia entre no publicado, publicado y archivado.

## Opciones avanzadas de SEO

Al final del formulario hay un desplegable llamado **Opciones avanzadas de SEO**. Es opcional y normalmente se puede dejar cerrado.

- **Título para buscadores:** se guarda como `meta_titulo`. Puede aparecer como el título del resultado en Google y como título de la ficha. Si queda vacío, se usa el nombre del producto.
- **Descripción para buscadores:** se guarda como `meta_descripcion`. Puede aparecer debajo del título en Google. Si queda vacía, se usa la descripción normal del producto.

La **Descripción** normal sigue siendo el texto principal que ve una persona dentro de la ficha del producto. Google decide finalmente qué mostrar, por lo que estos campos orientan el resultado pero no lo garantizan.

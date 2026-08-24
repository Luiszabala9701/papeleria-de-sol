# Cambios del reporte 03

## Antes de probar el nuevo estado de publicación

En Supabase de **pruebas**, abrí **SQL Editor** y ejecutá una sola vez el contenido de:

`supabase/migrations/202608230004_mejoras_reporte_03.sql`

Convierte los productos que estaban en estado `oculto` a `borrador` (mostrado como **No publicado** en el panel), elimina la descripción duplicada del footer y guarda la opción del mensaje superior.

No ejecutar este archivo en producción hasta aprobar esta versión en pruebas.

## SKU sugerido

Al crear un producto se debe elegir primero el tipo. El panel completa una sugerencia y el ícono `!` informa el último SKU usado:

- Sticker: `ST-0001`.
- Plantilla: `PL-0001`.
- Producto físico: `PF-0001`.

Los números continúan de forma independiente por tipo. La sugerencia se puede editar, pero el SKU es obligatorio, debe respetar el prefijo y no puede repetirse.

## Secciones existentes

No se pueden crear secciones nuevas desde el panel porque una sección sin programación no tendría un lugar visible en la tienda. Se editan únicamente las secciones existentes. El título y el subtítulo siguen separados, tanto en contenido como en color, fuente, tamaño, negrita y cursiva.

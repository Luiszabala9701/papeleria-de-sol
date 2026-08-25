# Cambios del Reporte 04

Estos cambios se realizan primero en la rama y el entorno de **pruebas**.

## Textos que ahora administra el dashboard

En **Contenido del sitio** se agregaron desplegables para editar, por separado:

- los nombres visibles del menú y del footer;
- los textos de la página de catálogo;
- los encabezados y mensajes cuando todavía no hay plantillas o productos físicos;
- los textos de tarjetas, fichas de producto, selección y mensaje preparado para WhatsApp;
- la guía pública de Ayuda.

Los textos técnicos, de accesibilidad y de errores permanecen en el código para que la interfaz sea coherente y segura.

## Página pública de Ayuda

La ruta es `/ayuda`. Aparece como la última opción del menú superior y también en el footer. Explica el recorrido básico: explorar productos, armar la selección y continuar la consulta por WhatsApp.

## Ayuda del administrador

El dashboard tiene una nueva opción **Ayuda**. Resume cómo crear categorías y productos, usar SKU, publicar, archivar y editar los textos del sitio.

## Migración necesaria en Supabase de pruebas

Antes de probar los formularios nuevos del dashboard, ejecutar una sola vez el contenido de:

`supabase/migrations/202608250005_textos_publicos_y_ayuda.sql`

en **Supabase de pruebas** → **SQL Editor** → **New query** → **Run**.

La migración solo incorpora valores iniciales de textos públicos en `configuraciones_sitio`. No elimina productos, categorías, imágenes ni datos de clientes.

## Aviso legal pendiente

Esta entrega no agrega una política de privacidad, términos de venta ni una casilla de aceptación. Esos documentos deben redactarse con la información comercial real y no se debe afirmar que se guarda un consentimiento si el sitio no lo registra.

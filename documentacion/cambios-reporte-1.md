# Cambios del reporte 1

Esta versión incorpora los ajustes solicitados durante las pruebas de Papelería de Sol.

## Cambios públicos

- Botón fijo de WhatsApp en la esquina inferior derecha.
- Se eliminó el segundo botón de WhatsApp del inicio, la franja de beneficios y el bloque de categorías de la portada.
- La marca del pie dejó de ser un enlace, por lo que ya no recarga el inicio al seleccionarla.
- Los datos de contacto del pie se muestran en dos columnas en pantallas amplias e incluyen iconos.
- El carrito ahora muestra el rótulo `Cantidad` junto a los controles de unidades.

## Cambios del administrador

- Se puede mostrar u ocultar la contraseña al iniciar sesión.
- La tabla de productos incluye una miniatura en la columna **Imagen**.
- Se puede filtrar entre productos no archivados, archivados o todos. Un producto archivado puede restaurarse como borrador.
- La expiración por inactividad continúa siendo de 30 minutos y se valida en el servidor, pero ya no se muestra como contador ni se puede modificar desde el panel.
- En **Secciones del sitio**, cada texto tiene opciones controladas de color, fuente, tamaño, negrita y cursiva.
- En **Estilo visual**, se pueden ajustar los colores globales y la tipografía. Para invertir la paleta, se intercambian el color inicial y el color final.

## Paso necesario para la base de pruebas

Antes de probar la edición de estilos en Supabase de pruebas, abrí **SQL Editor**, copiá el contenido completo de:

`supabase/migrations/202608230002_estilos_y_administracion.sql`

y ejecutalo una única vez. Agrega la columna de estilos de las secciones y los colores configurables. No borra productos ni cambia los contenidos existentes.

Después de aplicar ese SQL, hay que desplegar de nuevo la función `administracion` en el proyecto de pruebas para que acepte los nuevos campos y el filtro de archivados.

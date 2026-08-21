# Seguridad

## Capas implementadas

- Supabase Auth administra identidad y contraseñas.
- PostgreSQL RLS limita cada tabla incluso si alguien usa la API pública directamente.
- La función `administracion` vuelve a verificar el usuario, su perfil activo, el recurso solicitado y los campos permitidos.
- Las operaciones sensibles usan la clave privada únicamente dentro de la función.
- La sesión administrativa tiene identificador propio, registro de última actividad, cierre explícito y vencimiento tras 30 minutos de inactividad.
- Storage limita tipo y tamaño de imágenes y exige permisos para escribir.
- Las escrituras relevantes quedan registradas en auditoría.
- Netlify agrega cabeceras contra interpretación de contenido, marcos y permisos innecesarios.

La cuenta regresiva del navegador es una ayuda visual. La autoridad es el servidor: modificar JavaScript, ocultar el reloj o llamar a la API por otro medio no renueva una sesión vencida.

## Medidas operativas necesarias

- Contraseña larga y exclusiva para cada administrador.
- No compartir usuarios; crear o desactivar perfiles individuales.
- Mantener deshabilitado el registro público.
- No enviar claves por correo, WhatsApp o capturas.
- Activar segundo factor en las cuentas de Supabase, Netlify y el proveedor Git.
- Revisar dependencias y aplicar actualizaciones de seguridad de forma planificada.
- Conservar respaldos fuera del proveedor principal y probar su restauración.
- Usar HTTPS, incluido el dominio propio.

## Ataques contemplados

- Acceso directo a tablas: RLS.
- Escalamiento de permisos: perfil administrativo validado en servidor.
- Manipulación de campos: listas blancas por recurso.
- Robo o reutilización indefinida de sesión: tokens de Auth más sesión administrativa con inactividad de 30 minutos.
- CSRF: autenticación por token, validación de origen y ausencia de cookies administrativas propias.
- XSS: contenido insertado con APIs de texto, validación y sin ejecutar HTML editable.
- Carga maliciosa de archivos: tipos y tamaño limitados, nombres generados y ruta controlada.
- Fuerza bruta: controles de Supabase Auth; se recomienda revisar intentos y habilitar CAPTCHA si aparece abuso.

## Pendientes antes de producción

- Reemplazar los datos de demostración por Supabase.
- Fijar el origen CORS al dominio definitivo y a `localhost` para desarrollo.
- Probar cada política como anónimo, administrador y usuario no autorizado.
- Confirmar recuperación de contraseña y correo remitente.
- Revisar accesibilidad, contenido legal y política de privacidad si más adelante se guardan pedidos o analítica.

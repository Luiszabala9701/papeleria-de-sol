# Revisión previa a producción

**Fecha:** 26 de agosto de 2026  
**Entorno comprobado:** código local, Supabase de pruebas y rama `pruebas`.  
**Alcance:** seguridad, configuración, acceso a datos, validación, dependencias, aspectos legales básicos y despliegue.

Esta revisión no sustituye el asesoramiento de una persona profesional en derecho ni una auditoría de infraestructura de Supabase o Netlify. No se analizaron ni se copiaron contraseñas, claves privadas ni valores de archivos `.env`.

## Arquitectura revisada

- **Frontend y renderizado:** Astro 7 con JavaScript del navegador y renderizado SSR en Netlify.
- **Datos públicos:** PostgreSQL de Supabase leído con la clave publicable y limitado por RLS.
- **Administración:** Supabase Auth para la identidad; una Edge Function llamada `administracion` vuelve a verificar la sesión y el perfil administrativo antes de cualquier operación sensible.
- **Archivos:** Supabase Storage, bucket público `productos`, limitado a imágenes de hasta 5 MB.
- **Venta:** catálogo y selección local; WhatsApp coordina disponibilidad, pago y entrega. No se crean pedidos ni se procesan pagos en el sitio.
- **Datos de clientes:** no hay cuentas, formularios de pedido ni base de datos de clientes. La selección se conserva en el navegador.

## Correctamente implementado

### Secretos y configuración

- `.env`, variantes locales de `.env`, dependencias, compilados y cachés están ignorados por Git.
- El historial versionado contiene solamente `.env.ejemplo`, sin valores de claves.
- La clave de Supabase usada por el navegador es publicable. No se encontró una clave `service_role`, secret ni contraseña en archivos versionados o en el historial revisado.
- La clave con privilegios elevados se usa únicamente dentro de la Edge Function, mediante secretos de Supabase.
- Desarrollo y producción usan archivos de entorno separados y el código obtiene la URL canónica desde `PUBLIC_URL_SITIO`.

### Base de datos, permisos y autenticación

- Todas las tablas de aplicación y el bucket de imágenes tienen RLS activado con políticas específicas.
- Los visitantes solo pueden consultar contenidos publicados. Las escrituras están limitadas a administradores.
- Las operaciones del dashboard no dependen del navegador: la Edge Function valida el JWT con Supabase Auth, comprueba que el perfil esté activo y usa listas blancas de recursos y campos.
- La sesión administrativa se registra en servidor, tiene cierre explícito y vence por inactividad. La cuenta regresiva del navegador no es la autoridad.
- Supabase Auth guarda contraseñas con `bcrypt` y sal aleatoria; el proyecto no almacena contraseñas propias.
- La sesión de Supabase se conserva en el almacenamiento del navegador. No se implementaron cookies de sesión propias, por lo que los atributos `HttpOnly`, `Secure` y `SameSite` no aplican a una cookie que no existe.

### Comprobación anónima contra Supabase de pruebas

- Se obtuvo un producto publicado mediante la clave publicable.
- Las consultas anónimas a perfiles administrativos, sesiones administrativas, auditoría y configuraciones privadas devolvieron cero filas.
- Una solicitud a la función administrativa sin sesión recibió `401` con el mensaje `Falta la sesión.`

### Consultas y contenido dinámico

- No hay SQL construido con texto ingresado por visitantes. El acceso a datos usa el SDK de Supabase y filtros parametrizados.
- El contenido administrable se representa como texto. No se usa HTML editable ni `innerHTML` para los productos, descripciones o textos públicos.
- Los datos estructurados JSON-LD escapan el carácter `<` antes de insertarse.
- El catálogo pagina en el navegador y limita la vista a 48 productos por página.

### Rutas y experiencia pública

- Existe una página 404 propia, con el diseño de Papelería de Sol, código HTTP 404 y enlace para volver al catálogo.
- `robots.txt` evita indexar el dashboard y el sitemap se genera en la compilación.
- El sitio ya informa que WhatsApp es el canal externo de consulta, pago y coordinación; no se simula una compra dentro de la web.

## Corregido en esta revisión

### Validación de la Edge Function

- Se validan identificadores UUID antes de editar, archivar, restaurar, preparar una carga o registrar una imagen.
- La función comprueba que el producto exista antes de generar una carga firmada.
- La ruta que se registra para una imagen debe corresponder al producto y al nombre aleatorio generado por la propia función.
- Los enlaces de botones de secciones se limitan a rutas internas que comienzan con `/`. Esto evita que un valor administrable pueda convertirse en un enlace `javascript:`.
- Las imágenes de categorías y secciones solo admiten rutas internas o URL HTTPS.
- WhatsApp, correo, Instagram y TikTok se validan en servidor antes de guardarse. Las redes solo aceptan sus dominios oficiales por HTTPS.
- Las solicitudes con formato inesperado se rechazan y los errores técnicos no se devuelven tal cual al navegador. Los duplicados reciben un mensaje útil y los demás errores internos reciben un mensaje genérico.

### Cabeceras de seguridad reales en SSR

Las cabeceras de `netlify.toml` por sí solas no cubren de forma fiable páginas atendidas por una Function SSR. Por eso se añadió `src/middleware.ts`, que añade las cabeceras a todas las respuestas SSR:

- `Content-Security-Policy` con fuentes propias, Google Fonts y Supabase como únicos orígenes necesarios.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` y `frame-ancestors 'none'` para evitar clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` que deshabilita cámara, micrófono y geolocalización.
- HSTS durante conexiones HTTPS.

La CSP no contiene `unsafe-eval` ni scripts inline autorizados. Incluye `unsafe-inline` solo para estilos: la paleta y tipografías administrables se aplican mediante atributos `style` generados por el servidor. Eliminarlo ahora rompería esa funcionalidad sin una alternativa proporcional.

### Transparencia básica de privacidad

La política ahora nombra a Netlify, Supabase y Google Fonts como proveedores técnicos. Esto hace más claro que esos servicios pueden tratar datos técnicos de conexión necesarios para entregar la web.

### Dependencias

Se actualizaron revisiones menores compatibles:

- Astro a `7.2.7`.
- Adaptador de Netlify a `8.2.4`.
- `@supabase/supabase-js` a `2.112.4`.

No se actualizó TypeScript a una versión mayor.

## Evaluado y no implementado

### Bloqueo propio de cinco intentos, CAPTCHA y rate limiting adicional

No se agregó un contador propio de cinco intentos. El único acceso con contraseña es el panel de administración, no hay registro público y Supabase Auth ya limita endpoints de autenticación por IP y responde `429` ante abuso.

Una regla propia de cinco intentos requeriría guardar fallos por cuenta e IP. Tras el quinto fallo, lo razonable sería pausar el acceso unos 10 a 15 minutos. Implementarla de manera agresiva puede bloquear a la administradora por un error o afectar a varias personas que comparten IP. Además, un atacante podría provocar el bloqueo de una cuenta conocida. Por el alcance actual, el control de Supabase es suficiente.

Tampoco se agregó CAPTCHA o Turnstile: no hay formularios públicos, recuperación de contraseña ni registro abierto. Se recomienda activarlo en Supabase si aparece actividad anómala o si más adelante se agrega recuperación pública, registro o formularios de contacto.

### Cifrado adicional

No se agregó cifrado de columnas. La tienda no almacena datos sensibles de clientes; los datos administrativos y de contenido están protegidos mediante Auth, RLS, HTTPS y la infraestructura de Supabase. Añadir cifrado de aplicación sin necesidad dificultaría búsquedas y mantenimiento sin una mejora proporcional.

### Inteligencia artificial y políticas

El uso de IA como ayuda durante el desarrollo no es una función ofrecida al visitante y no envía datos de clientes a un proveedor de IA. No corresponde incluir una cláusula sobre IA en la Política de privacidad o los Términos por ese solo motivo.

Si en el futuro la tienda ofrece una función de IA a clientes o envía sus datos a un proveedor de IA, habrá que informar con claridad la finalidad, los datos enviados, el proveedor, la conservación y los derechos aplicables antes de activarla.

### Cláusula de arbitraje

El arbitraje es una forma privada de resolver un conflicto ante una persona o tribunal arbitral, en lugar de iniciar directamente una causa judicial. Puede ser útil entre empresas que negocian libremente un contrato complejo.

No se recomienda incluirla en esta tienda. La relación con clientes es de consumo, las condiciones son predispuestas y una cláusula que restrinja vías de reclamo puede considerarse abusiva o ineficaz. Si alguna vez se evalúa, debe revisarla una persona profesional especializada en derecho del consumidor argentino; no se incorporó texto alguno.

## Pendiente antes de producción

Estas tareas requieren comprobar configuraciones externas o decidir datos comerciales; no se modificaron a ciegas.

1. **Supabase producción:** confirmar que el registro público de usuarios está deshabilitado y que solo permanecen administradores necesarios y activos.
2. **CORS de la función:** en cada proyecto Supabase, el secreto `URL_SITIO` debe ser la URL exacta del sitio correspondiente. En pruebas debe ser la URL de pruebas; en producción, `https://papeleria-de-sol.netlify.app` o el dominio definitivo, sin barra final. Si se cambia de dominio, actualizarlo y redeplegar la función.
3. **Variables de Netlify producción:** confirmar `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_CLAVE_PUBLICA`, `PUBLIC_URL_SITIO`, `PUBLIC_USAR_DATOS_DEMOSTRACION=false` y `ASTRO_TELEMETRY_DISABLED=1`. Deben apuntar exclusivamente al proyecto Supabase de producción.
4. **Función producción:** la versión endurecida se desplegó en Supabase de pruebas. Luego de aprobar las pruebas, se debe desplegar la misma función en Supabase de producción antes de publicar el commit en `main`.
5. **Prueba de roles:** antes de producción, repetir el flujo con una cuenta administradora y, si se crea, una cuenta de Auth sin perfil administrativo. No usar el usuario de producción para pruebas innecesarias.
6. **Cuentas operativas:** activar MFA en Supabase, Netlify y GitHub; usar contraseñas únicas y largas; no compartir cuentas.
7. **Dominio:** si se compra un dominio propio, conectar HTTPS en Netlify, modificar ambas URL canónicas, volver a desplegar y actualizar Search Console.
8. **Contenido comercial:** revisar dirección de retiro, plazos, costos de envío, modificaciones incluidas y demás condiciones antes de anunciarlas públicamente. Las cláusulas no deben renunciar ni limitar derechos de consumidores.

## Advertencia de dependencias pendiente

`npm audit --omit=dev` aún informa 11 vulnerabilidades altas transitivas dentro de herramientas de Netlify. El remedio automático que npm propone es una versión mayor incompatible del adaptador, por lo que no se aplicó una degradación riesgosa.

Las advertencias corresponden a herramientas de desarrollo y compilación arrastradas por el adaptador de Netlify, no a una biblioteca que se ejecute como código de negocio en el navegador de clientes. Aun así, se debe vigilar el próximo lanzamiento del adaptador/Netlify que resuelva esas dependencias. Mientras tanto, no se deben compilar repositorios ni archivos de fuentes no confiables en el equipo de administración.

## Pruebas ejecutadas

- `npm run verificar`: 0 errores, 0 advertencias.
- `npm run build`: compilación SSR de Netlify completada.
- Rutas locales: inicio, catálogo, administración, privacidad, términos y ruta inexistente; todas respondieron con el código esperado.
- Cabeceras de seguridad: presentes en las rutas locales comprobadas.
- RLS anónimo: comprobado contra Supabase de pruebas.
- Edge Function: desplegada en pruebas y comprobada sin sesión (`401`).

## Fuentes consultadas

- [Ley 25.326 de Protección de Datos Personales](https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion).
- [Ley 24.240 de Defensa del Consumidor](https://www.argentina.gob.ar/normativa/nacional/decreto-351-1979-638/actualizacion).
- [Código Civil y Comercial: contratos por adhesión y cláusulas abusivas](https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion).
- [Supabase: seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security).
- [Supabase: claves API y RLS](https://supabase.com/docs/guides/getting-started/api-keys).
- [Supabase: límites de autenticación](https://supabase.com/docs/guides/auth/rate-limits).
- [Netlify: encabezados y CSP](https://docs.netlify.com/manage/security/content-security-policy/).

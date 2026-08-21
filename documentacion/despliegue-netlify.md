# Despliegue gratuito en Netlify

Netlify puede construir Astro y publicar tanto el sitio como sus funciones de renderizado. XAMPP no interviene en producción.

## Preparar el repositorio

1. Crear un repositorio privado gratuito en GitHub o GitLab.
2. Confirmar que `.env`, `node_modules`, `dist` y `recursos-originales` estén ignorados.
3. Subir el proyecto. Los WebP públicos sí deben formar parte del repositorio.

## Crear el sitio

1. En Netlify, elegir importar un proyecto existente.
2. Conectar el repositorio.
3. Netlify leerá `netlify.toml`: comando `npm run build`, carpeta publicada `dist` y Node 22.
4. Intentar asignar `papeleria-de-sol.netlify.app`. El nombre depende de disponibilidad y puede cambiarse después.

## Variables de entorno

Agregar en la configuración del sitio:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_CLAVE_PUBLICA
PUBLIC_URL_SITIO=https://papeleria-de-sol.netlify.app
PUBLIC_USAR_DATOS_DEMOSTRACION=false
ASTRO_TELEMETRY_DISABLED=1
```

Después ejecutar un nuevo deploy. Es normal que las variables públicas aparezcan en el JavaScript entregado: la seguridad real depende de RLS y de la función privada. La clave `service_role` nunca va en Netlify para este frontend.

## Dominio propio

Al conectar un dominio:

1. Configurarlo en Netlify y seguir sus registros DNS.
2. Cambiar `PUBLIC_URL_SITIO`.
3. Cambiar el secreto `URL_SITIO` de la función Supabase.
4. Volver a desplegar Netlify y la función.
5. Actualizar la URL del sitemap en Google Search Console.

## Límites del costo cero

El plan gratuito tiene cuotas de compilación, funciones y transferencia, y puede cambiar sus condiciones. Supabase también aplica cuotas y puede pausar proyectos gratuitos con poca actividad. Si el negocio empieza a tener tráfico sostenido, primero se deben medir esos consumos; recién entonces conviene comparar un hosting pago o una migración. No hay que cambiar tecnología preventivamente.

Un deploy manual de archivos estáticos no alcanza para esta configuración SSR. La opción reproducible es conectar el repositorio y permitir que Netlify ejecute el build.

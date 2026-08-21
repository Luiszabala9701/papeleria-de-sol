# Instalación local

## Requisitos

- Node.js 22 LTS o compatible.
- npm 10 o superior.
- Un navegador actual.
- Git, solamente si se desea versionar y publicar desde un repositorio.

XAMPP no es necesario: no existe un servidor PHP en esta arquitectura. Vite viene integrado en Astro y levanta el servidor local.

## Primer inicio

Desde la carpeta del proyecto:

```bash
npm install
Copy-Item .env.ejemplo .env
npm run iniciar
```

Abrir `http://127.0.0.1:4321`.

En macOS o Linux, la copia del entorno equivalente es:

```bash
cp .env.ejemplo .env
```

Mientras `PUBLIC_USAR_DATOS_DEMOSTRACION=true`, la tienda presenta los stickers locales aunque no exista conexión con Supabase. El acceso administrativo seguirá deshabilitado hasta configurar las dos variables públicas de Supabase.

## Comprobaciones

```bash
npm run verificar
npm run build
```

`verificar` revisa Astro y TypeScript. `build` reproduce la compilación de Netlify en la carpeta `dist`.

## Variables locales

El archivo `.env` no se debe subir a Git. Se puede modificar más adelante el correo, WhatsApp, redes y SEO desde el dashboard; los valores iniciales se cargan mediante la migración de Supabase.

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` en `.env` con prefijo `PUBLIC_`, en archivos JavaScript del navegador ni en Netlify como variable pública. Esa clave pertenece exclusivamente a la función de servidor.

## Nota sobre OneDrive

Las carpetas sincronizadas pueden ralentizar la instalación y el servidor de desarrollo por la cantidad de archivos de `node_modules`. Si ocurre, conservar el proyecto en una carpeta local no sincronizada para trabajar y usar Git para la copia remota. No hace falta cambiar código.

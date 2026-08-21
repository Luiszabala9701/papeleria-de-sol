# Configuración de Supabase Free

Supabase aporta PostgreSQL, usuarios, archivos, reglas RLS y funciones de servidor en un solo proyecto gratuito. Se puede cambiar de proveedor más adelante porque los datos principales viven en PostgreSQL y el acceso está aislado en servicios propios.

## 1. Crear el proyecto

1. Crear una cuenta gratuita en Supabase.
2. Crear un proyecto y guardar de forma privada la contraseña de base de datos.
3. Elegir la región más cercana disponible.
4. En la configuración de API, copiar la URL del proyecto y la clave pública o `anon`.

## 2. Crear el esquema

Abrir `SQL Editor`, pegar el archivo `supabase/migrations/202608040001_esquema_inicial.sql` y ejecutarlo una sola vez. La migración crea tablas, índices, políticas RLS, almacenamiento y datos iniciales.

No ejecutar fragmentos al azar ni desactivar RLS para resolver errores. Si la ejecución falla, conservar el mensaje completo y corregir la migración antes de continuar.

## 3. Crear el primer administrador

1. En `Authentication > Users`, crear manualmente el usuario con su correo definitivo y una contraseña única.
2. Abrir `supabase/crear-primer-administrador.sql`.
3. Reemplazar `REEMPLAZAR_CON_CORREO_ADMINISTRADOR` por ese correo.
4. Ejecutar el script en `SQL Editor`.
5. Deshabilitar el registro público de usuarios si estuviera habilitado.

La contraseña nunca se escribe en SQL: Supabase Auth la transforma y almacena de forma segura.

## 4. Desplegar la función privada

Instalar o ejecutar la CLI sin comprar ningún plan:

```bash
npx supabase login
npx supabase link --project-ref IDENTIFICADOR_DEL_PROYECTO
npx supabase functions deploy administracion
npx supabase secrets set URL_SITIO=https://papeleria-de-sol.netlify.app
```

Supabase entrega automáticamente a la función sus variables internas. La clave `service_role` no se copia al frontend.

Cuando exista dominio propio, actualizar `URL_SITIO` y volver a desplegar la función. La lista de orígenes permitidos debe mantenerse limitada al sitio real y al entorno local.

## 5. Conectar el sitio

Crear `.env` desde `.env.ejemplo` y completar:

```text
PUBLIC_SUPABASE_URL=https://IDENTIFICADOR.supabase.co
PUBLIC_SUPABASE_CLAVE_PUBLICA=CLAVE_PUBLICA
PUBLIC_URL_SITIO=http://127.0.0.1:4321
PUBLIC_USAR_DATOS_DEMOSTRACION=false
```

Reiniciar `npm run iniciar` después de cambiar variables.

## 6. Prueba mínima de permisos

- Sin iniciar sesión: el catálogo publicado se ve; el dashboard no permite operar.
- Con administrador activo: se pueden listar y modificar recursos permitidos.
- Con usuario de Auth sin perfil de administrador: la función responde acceso denegado.
- Tras 30 minutos sin una operación administrativa válida: la sesión se cierra en el servidor.
- Una imagen mayor a 5 MB o con tipo no permitido: Storage la rechaza.

## Mantenimiento

- Descargar copias SQL con una frecuencia acorde a la cantidad de cambios.
- Revisar administradores activos y auditoría.
- Archivar productos con historial en lugar de borrarlos físicamente.
- Vigilar cuotas de base, archivos y funciones en el panel gratuito.

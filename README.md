# Papelería de Sol

Tienda web administrable de papelería creativa para CABA y GBA. La primera versión permite explorar el catálogo, seleccionar productos y enviar el pedido por WhatsApp. No procesa pagos ni almacena datos de tarjetas.

## Tecnología elegida

- Astro 7 y Vite para el sitio público, SEO y una carga rápida.
- JavaScript sin React ni Vue para las interacciones.
- Supabase Free para PostgreSQL, autenticación, almacenamiento y seguridad RLS.
- Una función de servidor de Supabase para validar administradores y sesiones.
- Netlify Free para publicar el sitio y las rutas renderizadas por Astro.
- Dashboard propio en español; no se usa Filament, Blade, Eloquent, Laravel ni XAMPP.

## Comandos

```bash
npm install
npm run iniciar
npm run verificar
npm run build
```

El sitio local queda disponible en `http://127.0.0.1:4321`. La tienda funciona con datos de demostración aunque Supabase todavía no esté configurado. El dashboard necesita un proyecto Supabase para iniciar sesión y guardar cambios.

## Manuales

- [Manual para clientes](documentacion/manuales/manual-uso-clientes.docx)
- [Manual para administración](documentacion/manuales/manual-uso-administracion.docx)

## Base de datos

La estructura inicial de Supabase está reunida en
[`supabase/migrations/20260901000000_esquema_base_completo.sql`](supabase/migrations/20260901000000_esquema_base_completo.sql).
Es una base para crear un proyecto Supabase nuevo y vacío; no debe ejecutarse
sobre las bases de pruebas ni de producción existentes.

Para incorporar variantes, ejecutar después (también en bases nuevas)
[`20260903000000_variantes_y_stock_por_tipo.sql`](supabase/migrations/20260903000000_variantes_y_stock_por_tipo.sql).
Esta actualización conserva los productos y crea la versión Común de los stickers
con su precio actual. Solo los físicos usan stock; si no tenían existencias registradas,
quedan en cero hasta cargar el valor real. Las variantes archivadas conservan su SKU y fotos.

Orden de publicación: respaldo de la base, probar el SQL en el proyecto de pruebas,
aplicar la migración al destino, desplegar la función `administracion` de ese mismo
proyecto y publicar la web. Durante la actualización no editar el catálogo con el
panel anterior; recargar el panel al finalizar. No ejecutar nuevamente el esquema base.

`npm test` incluye pruebas PostgreSQL en memoria (PGlite, solo desarrollo) y reglas
de variantes/selección. No usa credenciales ni modifica Supabase. Antes de publicar,
verificar también el flujo real de Auth/Storage en pruebas.

La selección se valida de nuevo contra precios y stock públicos antes de continuar
a WhatsApp. No reserva ni descuenta existencias ni crea pedidos en la base de datos.

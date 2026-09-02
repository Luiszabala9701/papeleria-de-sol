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

# Etapa 3 — carrito, seguimiento y gestión de pedidos

Aplicar solamente en `papeleria-de-sol-pruebas` antes de promover a producción.

## Pasos manuales

1. Ejecutar completa la migración `supabase/migrations/20261013000000_checkout_seguimiento_y_archivado.sql` en el SQL Editor.
   Para la versión actual, ejecutar después `supabase/migrations/20261109000000_medio_pago_y_fotos_pedido.sql`; incorpora la forma de pago y las miniaturas de pedidos.
2. Volver a desplegar la Edge Function `pedidos` con `index.ts` y `validacion.ts` de este repositorio.
3. Volver a desplegar la Edge Function `administracion` con `index.ts`, `operaciones-pedidos.ts` y `validar-producto.ts` de este repositorio.
4. Desplegar la rama `pruebas` en Netlify.

## Correo con Resend (opcional hasta verificar el resto)

En los secretos de las Edge Functions agregar:

- `RESEND_API_KEY`: API key de Resend.
- `RESEND_FROM`: por ejemplo `Papelería de Sol <pedidos@papeleriadesol.com.ar>`; el dominio debe estar verificado en Resend.
- `RESEND_REPLY_TO`: correo al que responderán los clientes (opcional).

Después de verificar el remitente y hacer una prueba controlada, habilitar el envío:

```sql
update public.configuraciones_sitio
set valor = 'true'::jsonb
where clave = 'correos_transaccionales_habilitados';
```

Si Resend falla, el pedido se conserva y el correo queda registrado como pendiente/error en `notificaciones_outbox`.

## Prueba mínima

1. Crear un cupón activo con fechas válidas y un mínimo conocido.
2. Agregar un producto automático al carrito, escribir el cupón en minúsculas y confirmar que se convierte a mayúsculas.
3. Aplicarlo y comprobar subtotal, descuento y total. Probar también un carrito por debajo del mínimo.
4. Completar nombre, correo y WhatsApp; confirmar el pedido y abrir el enlace privado.
5. Confirmar que `/seguimiento` no muestra un campo para la clave y que el enlace con token carga el pedido.
6. En Pedidos, probar **En preparación**, **Gestionar pago**, **Archivar** y el filtro **Pedidos archivados**.
7. En Cupones, comprobar que porcentaje mayor a 100 y vencimiento anterior al inicio muestran el error antes de guardar.

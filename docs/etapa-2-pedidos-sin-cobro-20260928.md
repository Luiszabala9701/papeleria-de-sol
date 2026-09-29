# Etapa 2: pedidos sin cobro real

Fecha: 28 de septiembre de 2026  
Entorno objetivo: exclusivamente `pruebas`

## Alcance implementado

- Alta pública de solicitudes con revalidación de productos, variantes, precios y stock en PostgreSQL.
- Idempotencia para que un reintento no duplique el pedido.
- Clasificación en pedido automático o coordinado. Un carrito mixto se clasifica como coordinado.
- Reserva de stock durante 20 minutos solamente para pedidos automáticos.
- Aplicación de cupones calculada en el servidor.
- Datos históricos de los artículos guardados como snapshots.
- Seguimiento privado mediante un token opaco. En la base solo se guarda su hash SHA-256.
- Límite de solicitudes por origen sin guardar la IP en texto claro.
- Dashboard de pedidos con filtros, detalle, estados independientes y regeneración del enlace privado.
- Registro administrativo de transferencias verificadas con la acción **Marcar como pago aprobado**.
- Dashboard de cupones con vigencia, límites, alcance, exclusiones, activación, edición y duplicado.
- Flags por producto para compra automática y coordinación/personalización.

## Límites deliberados de esta etapa

- Mercado Pago permanece desactivado.
- El checkout por transferencia permanece desactivado.
- No se envían correos ni se conecta Resend.
- No se despliega ni se modifica producción.
- Registrar una solicitud no cobra dinero. El total mostrado se calcula en el servidor.

## Archivos que se despliegan en pruebas

1. Ejecutar `supabase/migrations/20260928120000_sistema_pedidos_etapa_2.sql` en el SQL Editor del Supabase de pruebas.
2. Crear la Edge Function `pedidos` con `supabase/functions/pedidos/index.ts` y `validacion.ts`.
3. Actualizar la Edge Function `administracion` agregando `operaciones-pedidos.ts` junto a `index.ts` y `validar-producto.ts`.
4. Configurar en las Edge Functions:
   - `URL_SITIO=https://papeleria-de-sol-pruebas.netlify.app`
   - `PEDIDOS_TOKEN_SECRET`: cadena aleatoria de al menos 32 caracteres, solo para la función `pedidos`.
5. Desplegar la rama `pruebas` en Netlify.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son secretos administrados por Supabase. Nunca deben copiarse al navegador ni a variables `PUBLIC_*`.

## Comprobación SQL después de aplicar la migración

```sql
select 'rate_limit_con_rls' as comprobacion, c.relrowsecurity::text as resultado
from pg_class c
where c.oid = 'public.limites_solicitudes'::regclass
union all
select 'pedidos_anon_sin_select', has_table_privilege('anon', 'public.pedidos', 'select')::text
union all
select 'crear_pedido_anon_sin_execute', has_function_privilege(
  'anon',
  'public.crear_solicitud_pedido(jsonb,text,text,text,text,text,text,bytea,bytea,bytea)',
  'execute'
)::text
union all
select 'mercado_pago_desactivado', valor::text
from public.configuraciones_sitio where clave = 'mercado_pago_checkout_habilitado'
union all
select 'transferencias_checkout_desactivadas', valor::text
from public.configuraciones_sitio where clave = 'transferencias_checkout_habilitadas'
order by comprobacion;
```

Resultado esperado: RLS `true`; privilegios de `anon` `false`; Mercado Pago y transferencias del checkout `false`.

## Pruebas funcionales en el sitio de pruebas

1. Crear un cupón desde Administración > Cupones.
2. Mantener todos los productos como coordinados al comienzo.
3. Agregar productos al carrito, pulsar **Continuar pedido** y completar nombre, correo y WhatsApp.
4. Confirmar que aparece un número de pedido, un enlace privado y el botón de WhatsApp, sin pedir pago.
5. Abrir el seguimiento en una ventana privada y comprobar que no muestra nombre, correo, WhatsApp ni dirección.
6. Abrir el pedido en el dashboard, cambiar preparación y entrega y refrescar el seguimiento.
7. Generar un nuevo enlace: el anterior debe dejar de funcionar.
8. Marcar una transferencia de prueba como pago aprobado y confirmar el estado financiero.
9. Activar compra automática en un producto publicado, no personalizado y con stock; comprobar una reserva de 20 minutos.
10. Combinar ese producto con uno coordinado: el pedido completo debe quedar coordinado y sin reserva automática.

## Verificación local realizada

- `npm test`: 29 pruebas aprobadas.
- `npm run verificar`: 0 errores, 0 advertencias y 0 sugerencias.
- `npm run build`: compilación SSR de Netlify completada.
- La migración se ejecutó dos veces en PostgreSQL embebido para comprobar repetibilidad.

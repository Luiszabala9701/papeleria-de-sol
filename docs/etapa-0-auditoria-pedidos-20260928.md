# Etapa 0 — Auditoría y protección de entornos

Fecha: 28 de septiembre de 2026  
Rama auditada: `pruebas`  
Commit de línea base: `5fb26a2`

## Resultado ejecutivo

El proyecto actual es una tienda Astro 7 con catálogo público, selección local de productos, validación server-side antes de abrir WhatsApp y un dashboard administrativo respaldado por Supabase Auth, PostgreSQL, Storage, RLS y una Edge Function con `service_role`.

Todavía no existen pedidos persistidos, pagos, reservas temporales, cupones, seguimiento privado ni correos transaccionales. La arquitectura permite incorporarlos mediante migraciones incrementales, RPC transaccionales y funciones separadas sin reemplazar el catálogo actual.

No se modificó producción ni se ejecutó ningún cambio remoto durante esta auditoría.

## Protección de entornos

| Comprobación | Resultado |
| --- | --- |
| Rama local | `pruebas` |
| Rama remota asociada | `origin/pruebas` |
| Supabase en `.env` | `sutyznqxbmawwrxbnddr` (pruebas) |
| Supabase en `.env.pruebas.local` | `sutyznqxbmawwrxbnddr` (pruebas) |
| Supabase en `.env.produccion.local` | `fjrfjufsgcxtlzgohlkl` (producción) |
| Netlify de pruebas | Responde HTTP 200 |
| Configuración compilada de `/admin` en Netlify pruebas | Contiene la referencia de pruebas y no contiene la referencia productiva |
| Salud de Supabase pruebas | Responde HTTP 401 sin credenciales, señal de que el proyecto está activo y REST disponible |
| Supabase CLI | No está instalada en el equipo |
| Enlace local guardado en `supabase/.temp/linked-project.json` | **Apunta a producción** (`fjrfjufsgcxtlzgohlkl`) |

### Bloqueo obligatorio

No ejecutar `supabase db push`, `supabase functions deploy`, `supabase secrets set`, migraciones remotas ni ningún comando que use el proyecto enlazado hasta reemplazar y verificar el enlace local por:

```text
sutyznqxbmawwrxbnddr
```

La corrección deberá hacerse con la CLI oficial y credenciales del proyecto de pruebas, nunca editando archivos internos a mano. Antes de cada aplicación o despliegue se volverá a comprobar el destino explícitamente.

## Arquitectura existente

- Astro 7 con renderizado server-side y adaptador Netlify.
- JavaScript nativo para carrito, galería, catálogo y administración.
- `@supabase/supabase-js` para catálogo público y autenticación administrativa.
- Netlify aplica CSP, HSTS desde middleware, `X-Frame-Options`, `nosniff`, política de permisos y caché de recursos estáticos.
- El catálogo público usa consultas selectivas y respaldo de demostración.
- El carrito vive en `localStorage`; no es todavía una orden ni una reserva.
- `/api/seleccion.json` limita el body a 24 KB, admite hasta 100 líneas y vuelve a validar identificadores, precio y stock antes de continuar a WhatsApp.
- El dashboard usa Supabase Auth y la Edge Function `administracion`.
- La función administrativa valida el JWT con `auth.getUser`, exige un perfil activo, mantiene sesiones administrativas y usa `service_role` solamente en servidor.
- La función administrativa actual tiene 1086 líneas y el script del panel 1223; las nuevas áreas de pedidos y cupones deberán separarse en módulos para no aumentar ese acoplamiento.

## Esquema existente

Las migraciones actuales crean catálogo, administradores, categorías, productos, variantes, secciones, imágenes, historial de precios, movimientos de stock, configuraciones, sesiones, auditoría y limpieza de archivos.

Hallazgos relevantes para las etapas siguientes:

- Los precios del catálogo existente usan `numeric(12,2)`. Los importes del nuevo dominio de pedidos deberán guardarse como enteros en centavos y convertir el precio del catálogo solamente al crear el snapshot.
- `movimientos_stock` ya existe, pero no representa reservas, consumo idempotente, liberación ni incidencias por pago tardío.
- La mayoría de tablas existentes tiene RLS habilitada.
- Las funciones sensibles de guardado de producto están revocadas para `anon` y `authenticated` y concedidas a `service_role`.
- La auditoría existente sirve como base, pero el nuevo dominio necesita eventos inmutables y claves de idempotencia propias.
- `sesiones_administrativas` conserva una IP completa en tipo `inet`; la revisión de seguridad posterior deberá decidir su migración a hash o su eliminación si no es indispensable.
- La CORS administrativa actual admite un único `URL_SITIO` y desarrollo local. Las nuevas funciones deberán usar una lista explícita separada para pruebas, producción y desarrollo.
- La Edge Function administrativa parsea JSON sin un límite previo de bytes; las nuevas funciones deberán limitar el body antes de deserializar.
- Existen algunas consultas administrativas con `select('*')`; no deben copiarse al nuevo código.

## Cobertura y línea base

Comandos ejecutados sin credenciales productivas y sin modificar servicios remotos:

| Verificación | Resultado |
| --- | --- |
| `npm test` | 19 pruebas aprobadas, 0 fallidas |
| Pruebas PostgreSQL en PGlite | Aprobadas |
| `npm run verificar` | 0 errores, 0 advertencias, 0 sugerencias |
| `npm run build` | Build SSR de Netlify completado |
| `git diff --check` | Sin errores |

La primera ejecución simultánea de Astro Check y build produjo un `EPERM` al competir por `node_modules/.vite/deps` en Windows. Ejecutados secuencialmente, ambos finalizaron correctamente. En adelante estas dos verificaciones se ejecutarán en secuencia.

## Brechas respecto del sistema solicitado

No existen todavía:

- Tablas de pedidos, artículos, reservas, pagos, eventos, reembolsos, seguimiento, outbox o cupones.
- Estados comercial, de preparación, entrega y financiero independientes.
- Clasificación automática/coordinada persistida.
- Compra automática por Mercado Pago Orders.
- Transferencias manuales auditadas.
- Reserva concurrente de stock durante 20 minutos.
- Seguimiento privado mediante hash de token.
- Dashboard de pedidos o cupones.
- Integración Resend ni plantillas transaccionales.
- Reconciliación programada, expiración de reservas o reintentos de outbox.
- Rate limiting persistente para checkout y validación de cupones.

## Viabilidad de costo fijo USD 0

La solución puede diseñarse sin costo fijo mientras el uso permanezca dentro de los límites y se acepte que los proveedores pausen o restrinjan el servicio al alcanzarlos.

- Supabase Free ofrece dos proyectos activos, 500 MB de base por proyecto, 1 GB de Storage, 5 GB de egress y 500.000 invocaciones de Edge Functions. No hay sobreconsumo facturable en Free; se aplican restricciones. Referencias: <https://supabase.com/docs/guides/platform/billing-on-supabase> y <https://supabase.com/docs/guides/functions/pricing>.
- Las Edge Functions Free tienen 256 MB, 150 segundos de wall clock y 2 segundos de CPU por solicitud. El webhook deberá responder rápido y delegar correo/reintentos a la outbox. Referencia: <https://supabase.com/docs/guides/functions/limits>.
- Supabase Cron puede ejecutar SQL o invocar funciones y permite resolver expiraciones, conciliación y outbox sin una cola paga. Referencia: <https://supabase.com/docs/guides/cron>.
- Resend Free ofrece 3.000 correos mensuales, 100 diarios y hasta 3 dominios. Al llegar al límite se deberá detener el envío, registrar la incidencia y reintentar posteriormente; no se activará pay-as-you-go. Referencia: <https://resend.com/pricing>.
- Netlify Free actualmente tiene un límite duro de 300 créditos mensuales para cuentas con precios por créditos; los branch deploys no consumen créditos de despliegue, pero tráfico y cómputo sí. Si se agotan, el sitio puede pausarse. Referencia: <https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/>.
- Mercado Pago Orders requiere `X-Idempotency-Key` y no agrega un costo fijo mensual, pero mantiene comisiones por transacción. Referencia: <https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/create-order/post>.

Por lo tanto, costo fijo USD 0 es viable para volumen bajo, pero no equivale a disponibilidad ilimitada. Se deberán mostrar métricas de consumo e incidencias y nunca activar recargas o planes pagos automáticamente.

## Decisiones para la Etapa 1

1. Crear una migración incremental nueva; no reejecutar el esquema base.
2. Mantener los precios actuales del catálogo y usar centavos enteros exclusivamente en el nuevo dominio de pedidos y cupones.
3. Crear enums y restricciones explícitas para los cuatro grupos de estados.
4. Hacer que el estado financiero sea calculado por funciones protegidas a partir de pagos y reembolsos.
5. Exponer al público únicamente RPC estrechas; denegar acceso directo a PII, pedidos, pagos, cupones internos y eventos.
6. Usar bloqueos de fila y claves únicas para reservas, uso de cupones, pagos, stock y notificaciones.
7. Preparar la migración y probarla localmente con PGlite antes de solicitar cualquier aplicación en Supabase pruebas.
8. No crear ni usar secretos de Mercado Pago o Resend durante la Etapa 1.

## Producción y costos

- Rama `main`: no modificada.
- Supabase producción: no consultado ni modificado.
- Dominio de producción: no desplegado.
- Credenciales productivas: no utilizadas.
- Servicios pagos o sobreconsumos: no habilitados.


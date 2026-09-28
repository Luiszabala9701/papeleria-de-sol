# Etapa 1 — Modelo de pedidos, pagos, stock, seguimiento, outbox y cupones

Fecha: 28 de septiembre de 2026

Rama: `pruebas`

Destino autorizado: Supabase de pruebas `sutyznqxbmawwrxbnddr`

Estado remoto: **no aplicado**

## 1. Resumen de lo implementado

Se agregó una migración incremental y repetible para el nuevo dominio comercial. Incluye pedidos y snapshots inmutables, pagos de Mercado Pago y transferencias diferenciados, reservas de stock, reembolsos, auditoría, seguimiento privado mediante hash, outbox transaccional y cupones.

Todos los productos quedan inicialmente como coordinados. Los checkouts de Mercado Pago, transferencias y correos permanecen apagados mediante configuraciones internas; esta etapa no agrega todavía ninguna interfaz ni permite pagos reales.

## 2. Archivos creados y modificados

- `supabase/migrations/20260928000000_sistema_pedidos_etapa_1.sql`: migración incremental.
- `tests/pedidos-sql.test.mjs`: pruebas aisladas de estructura, seguridad, concurrencia e idempotencia.
- `tests/variantes-sql.test.mjs`: comprobación adicional de que la migración nueva se aplica después de todo el historial anterior.
- `docs/etapa-1-modelo-pedidos-20260928.md`: este informe.

## 3. Migración

La migración crea:

- Estados separados para comercio, preparación, entrega y finanzas.
- `pedidos` y `pedido_items` con importes en centavos y snapshots inmutables.
- `reservas_stock`, ampliación idempotente de `movimientos_stock` y RPC con bloqueo de filas.
- `pagos`, `transferencias_pago`, `eventos_pago` y `reembolsos`.
- `historial_pedidos`, `tokens_consulta_pedido` y `notificaciones_outbox`.
- `cupones`, sus alcances por categoría/producto, exclusiones, reservas, usos, snapshots y auditoría.
- Índices parciales para reservas activas, pagos pendientes, outbox, vigencia y límites de cupones.
- RLS en todas las tablas nuevas, sin políticas públicas y sin privilegios para `anon` o `authenticated`.

La migración se ejecutó dos veces sobre PostgreSQL embebido y también después del historial completo de migraciones existentes.

## 4. Decisiones técnicas

- Los importes nuevos son `bigint` en centavos; el catálogo existente conserva `numeric(12,2)`.
- El estado financiero no es libre: se recalcula desde pagos aprobados y reembolsos aprobados.
- Pagos, reembolsos, artículos, usos de cupón e historiales no pueden borrarse o alterarse silenciosamente.
- Un pedido automático solo admite retiro con envío cero y artículos expresamente habilitados sin personalización.
- Las transferencias manuales se limitan a pedidos coordinados y requieren una administradora activa.
- Las reservas de stock bloquean la fila del producto o variante antes de calcular disponibilidad.
- Las reservas de cupón bloquean el cupón antes de contar usos confirmados y reservas vigentes.
- Los tokens privados se almacenan únicamente como SHA-256 de 32 bytes.
- Los eventos de pago almacenan un hash del payload y metadatos mínimos, no datos de tarjeta ni payloads completos.
- Los RPC sensibles usan `security definer`, `search_path` vacío, revocación pública y permiso exclusivo para `service_role`.

Estas decisiones siguen las recomendaciones oficiales de Supabase para [funciones de base de datos](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [protección de la Data API](https://supabase.com/docs/guides/api/securing-your-api).

## 5. Pruebas ejecutadas

La prueba de la Etapa 1 cubre:

- Creación y reejecución de la migración.
- RLS y ausencia de privilegios para `anon` y `authenticated`.
- Ejecución exclusiva de RPC por `service_role`.
- Todos los productos inicialmente coordinados y feature flags apagados.
- Dos pedidos disputando la última unidad: solo uno reserva.
- Repetición de reserva y consumo sin duplicar descuento de stock.
- Anticipo, saldo, reembolso parcial y reembolso completo con estado derivado.
- Bloqueo de pagos coordinados mientras el envío no está definido.
- Bloqueo de transferencias manuales en compras automáticas.
- Dos pedidos disputando el último uso de un cupón: solo uno reserva.
- Código de cupón sin distinción de mayúsculas/minúsculas.
- Snapshot de cupón inmune a cambios posteriores.
- Vencimiento que libera descuento y uso reservado.
- Inmutabilidad de artículos, pedidos, usos de cupón e historiales.

Resultado de `npm test`: 20 aprobadas, 0 fallidas. La estrategia coincide con la documentación oficial de [pruebas de base de datos de Supabase](https://supabase.com/docs/guides/local-development/testing/overview).

## 6. Riesgos y pendientes

- La migración todavía no está aplicada en Supabase de pruebas.
- La carpeta local de Supabase sigue enlazada internamente a producción; por seguridad no se ejecutó ningún comando remoto.
- La Supabase CLI no está instalada.
- Los RPC de esta etapa son la base transaccional; la validación de body, CORS, rate limiting y autorización por acción se incorporará en las Edge Functions de la Etapa 2.
- Mercado Pago, webhooks, pago tardío y reconciliación corresponden a la Etapa 3.
- La outbox existe, pero no enviará correos hasta la Etapa 4.
- Los límites gratuitos siguen dependiendo del volumen y no garantizan disponibilidad ilimitada.

## 7. Acciones manuales necesarias

Antes de iniciar la parte funcional de la Etapa 2 hay que aplicar la migración exclusivamente en Supabase de pruebas. No se debe usar el enlace local actual porque apunta a producción.

La opción segura inmediata es abrir el SQL Editor del proyecto cuyo identificador visible sea `sutyznqxbmawwrxbnddr`, pegar el contenido completo de la migración y ejecutarlo una sola vez. Antes de hacerlo se debe comprobar nuevamente el identificador del proyecto en la URL y en el encabezado.

Alternativamente, se puede instalar la CLI oficial, enlazar explícitamente `sutyznqxbmawwrxbnddr`, verificar el enlace y recién entonces usar el flujo de migraciones. No se debe editar manualmente `supabase/.temp/linked-project.json`.

## 8. Producción

- Rama `main`: no modificada.
- Supabase producción `fjrfjufsgcxtlzgohlkl`: no consultado ni modificado.
- Dominio productivo: no desplegado.
- No se hizo merge ni push.

## 9. Costos

No se agregó ningún servicio, dependencia o plan pago. La etapa usa únicamente PostgreSQL/Supabase ya existente y PGlite local para pruebas.

## 10. Próxima etapa recomendada

Aplicar y verificar esta migración en Supabase de pruebas. Después, comenzar la Etapa 2: creación server-side de solicitudes y snapshots, seguimiento privado, clasificación automático/coordinado, dashboard de pedidos, transferencias manuales y administración de cupones, todavía sin Mercado Pago.

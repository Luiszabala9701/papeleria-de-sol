# Ajustes de carrito, notas, forma de pago y seguimiento

Rama: `pruebas`. La interfaz se publica en Netlify; las funciones de Supabase se actualizan por separado.

## Activación en pruebas

1. Si falta, ejecutar `supabase/migrations/20261013000000_checkout_seguimiento_y_archivado.sql`.
2. Ejecutar `supabase/migrations/20261109000000_medio_pago_y_fotos_pedido.sql` completa. Es repetible y conserva los pedidos existentes.
   Para guardar notas internas, ejecutar también `supabase/migrations/20261109120000_notas_internas_pedido.sql`. La impresión no requiere una tabla nueva.
3. Redesplegar `pedidos` con `index.ts` y `validacion.ts`.
4. Redesplegar `administracion` con `index.ts`, `operaciones-pedidos.ts` y `validar-producto.ts`.
5. Publicar estos archivos de la rama `pruebas` en el Netlify de pruebas.

No hacen falta nuevos secretos. La elección entre transferencia y efectivo se guarda como preferencia: nunca acredita un pago. La aprobación manual de transferencias existente conserva su funcionamiento. El registro contable de cobros en efectivo no forma parte de esta elección de medio.

## Recorrido para comprobar

| Prueba | Resultado esperado |
| --- | --- |
| Abrir Mi selección | Cupón visible antes de Continuar pedido. |
| Aplicar cupón activo válido | Código en mayúsculas; descuento y total calculados por el servidor. Los cupones siguen respetando su alcance y el modo automático habilitado. |
| Escribir nota con varias líneas y continuar | Aparece la elección Transferencia / Efectivo antes de confirmar. |
| Volver a mis datos | Conserva nombre, correo, WhatsApp y nota. |
| Confirmar sin elegir medio | No se crea el pedido; pide elegir. |
| Confirmar con medio elegido | Un solo pedido, pago pendiente y forma de pago guardada. |
| Ver detalle en admin | Sección Nota del cliente y Forma de pago elegida. |
| Pulsar Imprimir en la fila del pedido, al lado de Ver detalle | Abre el diálogo del navegador con orden, productos, cantidades, precios, subtotal, descuento y total. Al final aparece el localizador recortable con los datos del cliente. |
| Guardar Impresa en Nota interna y volver a abrir el pedido | Conserva la nota en administración. No modifica la nota del cliente ni marca pagos como aprobados. |
| Abrir enlace privado | Título Orden #n, Estado del pedido, forma y estado de pago; sin campo de clave. |
| Cambiar preparación a En preparación / Empaquetado y listo | El seguimiento muestra el mismo estado al recargar. |
| Ver productos en seguimiento | Fotos de la variante elegida, o generales si no tiene foto propia; miniatura neutra si no hay foto. |

Las fotos nuevas se guardan desde el catálogo en un snapshot del artículo. Los pedidos antiguos usan las fotos actuales disponibles sin modificar sus importes ni sus artículos históricos. Las notas y los datos de contacto sólo están disponibles en administración; no se publican en el seguimiento.

## Cupón desplegable y acceso al panel

El cupón del carrito empieza plegado. Se abre pulsando «¿Tenés un cupón?» y se cierra después de aplicarlo correctamente; el código aplicado y el descuento siguen visibles. Si hay un error, el formulario permanece abierto. El encabezado y el pie se compactaron para priorizar la lista de productos, con desplazamiento independiente en pantallas bajas. Estos ajustes no requieren SQL ni secretos nuevos.

Si el acceso al panel muestra `Failed to send a request to the Edge Function`, revisar los Logs de `administracion`. Un `503 BOOT_ERROR` con `does not provide an export named 'gestionarAccionComercial'` indica que la versión desplegada de `operaciones-pedidos.ts` está incompleta o no corresponde al archivo actual. Reemplazar **todo** su contenido por `supabase/functions/administracion/operaciones-pedidos.ts` y pulsar **Deploy updates**. El archivo debe incluir `export async function gestionarAccionComercial(contexto: Contexto)` y su cuerpo completo. No modificar JWT, RLS, claves ni contraseñas para corregirlo.

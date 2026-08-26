# Cambios del Reporte 05

## Identidad visual y fuentes

- Se incorporó el logo oficial en la cabecera, el pie y la administración.
- Se añadió un favicon simplificado con la paleta de Papelería de Sol.
- Las fuentes disponibles desde el administrador ahora son: Moderna, Redondeada, Clásica, Creativa, Elegante y Manuscrita.
- Las tipografías son gratuitas y se cargan desde Google Fonts para que se vean de forma consistente en distintos dispositivos.

## Ayuda y administración

- La cabecera de la página pública de Ayuda está centrada.
- La guía interna del administrador usa español latino neutro.
- El ícono de ayuda de SKU se muestra junto a la etiqueta `SKU *`.
- Cerrar sesión requiere confirmación mediante una ventana antes de invalidar la sesión.

## Privacidad, términos y WhatsApp

- Se agregaron las páginas públicas `/privacidad` y `/terminos`.
- Los enlaces del pie abren estos documentos en una ventana modal y conservan una URL directa como alternativa accesible.
- El aviso previo a WhatsApp incluye enlaces a ambos documentos.
- La Política de privacidad explica que la selección se conserva en el navegador y que Papelería de Sol no crea una base de clientes ni planillas desde la tienda.
- Los Términos describen pagos por transferencia o efectivo, envíos, retiro, plazos, anticipos para personalizados, hasta tres modificaciones de diseño y atención de fallas.

## Paso necesario en Supabase de pruebas

La función `administracion` debe desplegarse en el proyecto de pruebas para que permita guardar las tres nuevas tipografías desde el dashboard. No hay migración SQL para ejecutar.

## Alcance legal

Los textos informan el flujo comercial actual y no reemplazan asesoramiento jurídico. Cualquier modificación futura de precios, medios de pago, datos de clientes o formas de venta deberá reflejarse también en estos documentos.

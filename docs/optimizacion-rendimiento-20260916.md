# Optimización de rendimiento — 16/09/2026

Estado: implementado y revisado en la rama `pruebas`. El usuario autorizó guardar y subir los cambios únicamente a esa rama el 16/09/2026; el resultado del despliegue se comprueba por separado. Producción y los datos de Supabase no se modificaron durante esta optimización.

## Problemas encontrados

Las capturas aportadas corresponden a PageSpeed Insights del 15/09/2026. El problema principal observado es la carga inicial en móvil, no el bloqueo de JavaScript: TBT de 0 ms frente a LCP de 15,5 s. La auditoría señalaba imágenes sobredimensionadas, una cadena de fuentes que bloqueaba el renderizado y oportunidades de caché.

| Métrica aportada | Móvil | Escritorio |
| --- | ---: | ---: |
| Rendimiento | 63 | 95 |
| FCP | 2,9 s | 0,8 s |
| LCP | 15,5 s | 1,1 s |
| TBT | 0 ms | 0 ms |
| CLS | 0,024 | 0,004 |
| Speed Index | 7,5 s | 1,8 s |

En el código, inicio y catálogos consultaban el catálogo completo con relaciones y campos de más. Además, el listado incrustaba los datos de todos los productos para reconstruir los filtros en el navegador, aunque solo mostrara una página.

También se encontraron enlaces marcados `aria-hidden`, un carrito cerrado con controles enfocables y saltos de h1 a h3. La política de seguridad no permitía scripts inline: se corrigió la carga del ajuste de vista móvil y se evitó que Astro vuelva a insertar scripts pequeños inline durante la compilación.

## Optimizaciones realizadas

- Inicio consulta solo productos destacados o elegidos para su carrusel, con un máximo de 24 registros.
- Listados consultan 48 productos por página, con orden estable, conteo total y selección explícita de campos. Ya no envían el JSON de los 1000 stickers al navegador.
- Detalle y validación de selección usan también campos explícitos. La validación de precio/stock antes de WhatsApp se conserva y no se sustituye por datos cacheados.
- Se conservan filtros, paginación enlazada, títulos, URLs canónicas y datos estructurados.
- Se corrigieron encabezados, enlaces accesibles y foco del carrito. En móvil, su botón tiene un nombre accesible y no solo el número de productos.
- Galería, cantidad y versiones se compilan juntas como un módulo. Al cambiar de foto se actualizan tanto `src` como `srcset`, evitando mostrar una foto anterior.
- La fuente Inter se sirve localmente en WOFF2, con preload y `font-display: swap`, eliminando el `@import` de Google Fonts. Se incluye su licencia OFL.

## Imágenes

Se configuró [Netlify Image CDN](https://docs.netlify.com/build/image-cdn/overview/) para servir tamaños adaptados a cada pantalla, usando `srcset` y `sizes` en tarjetas, galería y logos. Se autorizan únicamente las imágenes remotas del almacenamiento público de Supabase para este flujo.

La primera imagen del carrusel/listado y la imagen principal del detalle tienen carga prioritaria. El resto usa carga diferida y decodificación asíncrona. El visor ampliado y las miniaturas tienen tamaños separados.

No se borraron ni sobrescribieron imágenes existentes. Las futuras subidas desde administración se reducen, cuando es posible y beneficioso, a WebP con máximo de 1600 px. Se conserva el archivo original si la conversión falla o genera un archivo mayor. Las subidas usan nombres únicos y caché de un año.

El CDN de Netlify solo se comprueba completamente después del despliegue; el servidor de desarrollo muestra los originales. No se afirma haber conseguido todavía el ahorro de 2,5 MiB estimado por PageSpeed.

## Base de datos / Supabase

La migración nueva es `supabase/migrations/20260915000000_indice_catalogo_publico.sql`:

```sql
create index if not exists productos_catalogo_publico_idx
  on public.productos (tipo_producto, estado, orden, creado_en desc, id);
```

Es un índice para el listado paginado. No cambia precios, descripciones, registros, permisos ni funciones administrativas. El código funciona sin aplicarlo, aunque su aplicación puede mejorar la consulta. Ejecutarlo primero en pruebas; producción queda para el pase posterior aprobado.

La búsqueda conserva la comparación sin acentos: solo cuando se envía una búsqueda, el servidor consulta candidatos con cinco campos y recupera las relaciones completas para los 48 resultados de esa página. No se consulta cada vez que se escribe una letra. Este camino todavía recorre candidatos y podría trasladarse a una búsqueda SQL normalizada si el catálogo crece mucho; no se presenta como una consulta de coste constante.

No se alteró la Edge Function `administracion`, ni las reglas de acceso, ni se agregó caché a datos privados o a la confirmación del carrito.

## Navegación

Se habilitó [prefetch selectivo de Astro](https://docs.astro.build/en/guides/prefetch/) por intención de navegación en enlaces concretos del menú, tarjetas, CTA y paginación. No se precargan todas las rutas ni los 1000 detalles.

Los filtros son formularios GET y la paginación mantiene los parámetros. La navegación sigue siendo por páginas, sin añadir un router SPA ni cambiar la estructura del proyecto.

La caché larga se limita a recursos estáticos: archivos compilados con nombre hash, stickers y fuente. El logo de marca usa una caché más corta, porque su nombre no lleva hash. Al reemplazar la fuente o stickers estáticos, debe cambiarse la URL del archivo para evitar conservar una versión antigua.

## PageSpeed/Core Web Vitals

Comparación verificable en código:

| Camino | Antes | Ahora |
| --- | --- | --- |
| Inicio | Catálogo completo | Máximo 24 destacados/carrusel |
| Listado | Catálogo completo con relaciones | 48 registros con relaciones por página |
| Datos del listado en el cliente | JSON de todos los productos | Solo la página renderizada |
| Fuente | CSS externo y fuente externa encadenados | Un WOFF2 local de 48.256 bytes |
| Imágenes | Original, sin tamaños responsivos | CDN con tamaños y prioridades distintos |

En la revisión previa con acceso a Supabase, las rutas reales de inicio, stickers, segunda/última página, detalle y productos físicos respondieron HTTP 200. Ejemplos de TTFB local en caliente: stickers 0,374 s y página 21 0,322 s. Estos tiempos de desarrollo no son LCP ni resultados de Lighthouse y no son comparables directamente con las capturas de producción.

No hay puntuación PageSpeed posterior al cambio: queda pendiente medir el despliegue de pruebas en condiciones equivalentes y, después del pase, producción. No se promete una puntuación ni se atribuye una mejora numérica no medida.

## Verificaciones

- `npm test`: 17 pruebas pasan, incluidas paginación, búsqueda sin acentos, SQL de variantes, precios/stock, selección y las tres regresiones nuevas de galería/carrito.
- `npm run verificar`: 54 archivos, cero errores, advertencias o hints.
- `npm run build`: completado correctamente con el adaptador de Netlify.
- Índice SQL ejecutado dos veces en PostgreSQL local temporal (PGlite): se crea una sola vez, sin escribir en Supabase.
- `git diff --check HEAD`: sin errores de espacios.
- Revisión funcional en navegador con datos de demostración: búsqueda de 1000, 48 tarjetas por página, segunda página desde Sticker #49, Común a $199, Holográfico a $499, agregado y total del carrito, apertura/cierre y devolución de foco, imagen ampliada, carrusel y menú móvil.
- Revisión visual a 390 × 844: inicio y ficha conservan el diseño. Se restauró el tamaño del navegador y se retiró únicamente la línea de carrito creada para la prueba, preservando la selección anterior.
- No se enviaron mensajes de WhatsApp ni se realizaron pagos o subidas reales.

La comprobación inicial de consultas reales se hizo con acceso de red autorizado. En la revisión final, el entorno restringido devolvió EACCES al consultar Supabase; se usaron variables temporales del proceso para las pruebas de interfaz con demostración. No se editó `.env` ni se cambió la configuración publicada.

## Pendiente

1. Verificar el despliegue de la rama `pruebas`. El permiso de Git se bloqueó inicialmente por el límite de uso; se reintentó solo después de recibir autorización explícita del usuario.
2. Aplicar el índice en la base de pruebas, comprobar allí el CDN y una subida administrativa autorizada, y repetir PageSpeed móvil/escritorio.
3. Con pruebas aprobadas, pasar a producción y medir de nuevo. No ejecutar otra vez las migraciones anteriores de precios/descripciones ni copiar la base de pruebas sobre producción.

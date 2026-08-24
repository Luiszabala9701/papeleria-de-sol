# Arquitectura y alcance

## Resultado de la revisión

El MVP anterior demostró el estilo visual, la paleta y el flujo de selección por WhatsApp, pero concentraba catálogo, contenido y comportamiento en archivos estáticos grandes. Eso dificultaba administrar productos, controlar permisos, mantener SEO por producto y crecer sin editar código.

La nueva base conserva la identidad de Papelería de Sol —azul `#98b7ff`, lila `#df98ff`, composición amable y sencilla— y separa cuatro responsabilidades:

1. Astro entrega páginas públicas rápidas, accesibles y aptas para buscadores.
2. Supabase PostgreSQL guarda los contenidos y relaciones.
3. Supabase Auth, RLS y una función de servidor protegen el dashboard.
4. Netlify construye y publica el sitio.

## Qué se reutilizó

- Paleta, identidad visual y tono general.
- Los 1.000 stickers existentes, con copias WebP optimizadas para producción.
- Número de WhatsApp y enlaces sociales encontrados en el proyecto anterior.
- El concepto de catálogo y selección de artículos.
- HTML semántico, CSS y JavaScript como base de la interfaz.

## Qué se refactorizó o reemplazó

- El catálogo escrito a mano se reemplazó por un repositorio de contenidos que consulta Supabase y ofrece datos de demostración mientras se configura.
- El JavaScript monolítico se dividió en menú, catálogo, carrito y administración.
- La página única se dividió en inicio, catálogo, productos físicos, plantillas, detalle de producto, administración y página 404.
- Las imágenes PNG de producción se reemplazaron por WebP; los PNG fuente no se borraron.
- La administración desde archivos se reemplazó por un dashboard privado.
- El contenido de San Valentín quedó fuera de la nueva web.

## Componentes que no conviene trasladar

- Arrays de productos incrustados en JavaScript.
- Contraseñas, claves privadas o permisos comprobados solamente en el navegador.
- Un único archivo para toda la lógica de la aplicación.
- Ocultar enlaces como medida de seguridad.
- Agregar una pasarela de pago antes de definir cobros, devoluciones, comprobantes y conciliación.
- Migrar a Laravel solo por tener base de datos: para esta etapa agregaría servidor PHP, más mantenimiento y un hosting menos compatible con el objetivo de costo cero.

## Modelo funcional

La base incluye administradores, categorías, productos, variantes, secciones, imágenes, historial de precios, movimientos de stock, configuración del sitio, sesiones administrativas y auditoría.

Las categorías permiten crear agrupaciones específicas como Fútbol para stickers, Memes para stickers o Agendas para productos físicos sin cambiar código. Los tipos de producto permiten usar el mismo panel para stickers, productos físicos y plantillas. Las variantes quedan preparadas para tamaño, terminación u otra opción, aunque no es obligatorio usarlas desde el primer día.

## Flujo de venta actual

El cliente puede agregar elementos a una selección local. Al confirmar, el navegador genera un mensaje con cantidades, precios y total estimado, y abre WhatsApp al número comercial. No se crea una orden en la base ni se procesa un pago. Esto evita pedir datos personales innecesarios en esta etapa.

## Viabilidad y límites

Todo el alcance inicial es viable con planes gratuitos. No existe alta disponibilidad garantizada: un proveedor gratuito puede pausar proyectos inactivos, cambiar cuotas o limitar compilaciones, funciones, almacenamiento y transferencia. El sistema queda desacoplado para poder migrar más adelante a PostgreSQL administrado o a un hosting PHP/Laravel, pero esa migración requeriría adaptar consultas, autenticación y despliegue.

No se recomienda prometer stock en tiempo real mientras el pedido termina en WhatsApp: dos personas podrían consultar la misma última unidad antes de que el administrador confirme la venta. Se puede mostrar stock orientativo, ocultarlo o descontarlo manualmente. Una reserva real debe incorporarse cuando exista un flujo de orden confirmado.

## Desarrollo por etapas

### Etapa 1 — Base técnica y catálogo

- Estructura Astro, diseño responsive y SEO técnico.
- Catálogo, filtros, detalle y selección hacia WhatsApp.
- Optimización de recursos y datos de demostración.

### Etapa 2 — Supabase y administración

- Ejecutar el esquema, crear el primer administrador y desplegar la función privada.
- Configurar categorías, productos, imágenes, secciones y datos comerciales.
- Probar permisos con usuario administrador y visitante anónimo.

### Etapa 3 — Publicación

- Subir el repositorio privado, conectar Netlify y cargar variables de entorno.
- Validar móvil, accesibilidad, rendimiento, enlaces y metadatos.
- Conectar el dominio y registrar el sitio en Google Search Console.

### Etapa 4 — Operación y mejora

- Incorporar pedidos persistentes solo si se necesita seguimiento.
- Agregar métricas respetuosas de la privacidad y copias de seguridad periódicas.
- Evaluar pasarela de pago, reserva de stock o migración de hosting únicamente cuando el volumen lo justifique.

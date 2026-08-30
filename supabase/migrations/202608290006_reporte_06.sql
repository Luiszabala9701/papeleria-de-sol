-- Ajustes del Reporte 06: textos públicos, limpieza de configuraciones antiguas
-- y cola de eliminación segura para archivos de imágenes.

delete from public.configuraciones_sitio
where clave in ('nombre_marca', 'lema_marca');

insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('navegacion_catalogo', to_jsonb('Stickers'::text), 'Texto del enlace de stickers del menú', true),
  ('footer_catalogo', to_jsonb('Stickers'::text), 'Texto del enlace de stickers en el footer', true),
  ('carrito_explorar_catalogo', to_jsonb('Explorar stickers'::text), 'Enlace de selección vacía', true),
  ('plantillas_descripcion', to_jsonb('Encontrá plantillas para organizar, estudiar y crear. Elegí la que te gusta y consultanos por WhatsApp.'::text), 'Descripción pública de plantillas', true),
  ('fisicos_descripcion', to_jsonb('Elegí productos de papelería creativa, regalos y opciones personalizadas. Consultá por WhatsApp para coordinar los detalles.'::text), 'Descripción pública de productos físicos', true),
  ('producto_aviso_whatsapp', to_jsonb('Agregá este producto a tu selección. Por WhatsApp coordinamos la disponibilidad, el retiro o envío, el pago y otros detalles del pedido.'::text), 'Aclaración de la ficha de producto', true),
  ('mensaje_whatsapp_inicio', to_jsonb('¡Hola! Quisiera realizar el siguiente pedido:'::text), 'Inicio del mensaje de WhatsApp', true),
  ('mensaje_whatsapp_total', to_jsonb('Total del pedido'::text), 'Etiqueta del total de dinero en WhatsApp', true),
  ('mensaje_whatsapp_cierre', to_jsonb('Quedo atento/a. Gracias.'::text), 'Cierre del mensaje de WhatsApp', true),
  ('ayuda_paso_3_descripcion', to_jsonb('Al continuar, se abre WhatsApp con el detalle y el total estimado de los productos elegidos.'::text), 'Descripción del tercer paso de ayuda', true),
  ('ayuda_consultas_descripcion', to_jsonb('Escribinos por WhatsApp. Allí coordinamos productos personalizados, retiro o envío, pago y otros detalles.'::text), 'Descripción del bloque final de ayuda', true)
on conflict (clave) do update
set valor = excluded.valor,
    descripcion = excluded.descripcion,
    publica = excluded.publica;

update public.secciones
set texto_boton = 'Explorar stickers'
where clave = 'inicio_principal'
  and texto_boton = 'Explorar el catálogo';

update public.secciones
set contenido = 'Una pequeña muestra de la colección. En stickers podés buscar y combinar los diseños que quieras.'
where clave = 'inicio_destacados'
  and contenido = 'Una pequeña muestra de la colección. En el catálogo podés buscar y combinar los diseños que quieras.';

create table if not exists public.archivos_pendientes_eliminar (
  id uuid primary key default gen_random_uuid(),
  ruta text not null,
  deposito text not null default 'productos',
  producto_id uuid references public.productos(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (ruta, deposito)
);

alter table public.archivos_pendientes_eliminar enable row level security;

comment on table public.archivos_pendientes_eliminar is
  'Rutas de Storage que se reintentan eliminar si Storage no respondió durante la eliminación de una imagen.';

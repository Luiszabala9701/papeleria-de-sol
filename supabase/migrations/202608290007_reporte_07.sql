-- Ajustes del Reporte 07: ruta pública de stickers, textos de inicio
-- simplificados y eliminación de personalización tipográfica.

insert into public.secciones (
  clave, titulo, subtitulo, contenido, texto_boton, enlace_boton, publicada, orden
) values
  (
    'inicio_principal',
    'Ideas que alegran tus días',
    'Papelería creativa hecha con dedicación',
    'Descubrí stickers, plantillas y productos físicos para regalar, organizar y personalizar. Elegí tus favoritos y consultanos directamente por WhatsApp.',
    'Explorar stickers',
    '/stickers',
    true,
    1
  ),
  (
    'inicio_destacados',
    'Productos destacados',
    'Nuestros favoritos',
    'Una selección de productos de Papelería de Sol.',
    null,
    null,
    true,
    2
  )
on conflict (clave) do nothing;

update public.secciones
set enlace_boton = '/stickers',
    publicada = true,
    orden = 1
where clave = 'inicio_principal';

update public.secciones
set titulo = 'Productos destacados',
    texto_boton = null,
    enlace_boton = null,
    publicada = true,
    orden = 2
where clave = 'inicio_destacados';

delete from public.configuraciones_sitio
where clave = 'fuente_principal';

insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('navegacion_catalogo', to_jsonb('Stickers'::text), 'Texto del enlace de stickers del menú', true),
  ('footer_catalogo', to_jsonb('Stickers'::text), 'Texto del enlace de stickers en el footer', true),
  ('carrito_explorar_catalogo', to_jsonb('Explorar stickers'::text), 'Enlace de la selección vacía', true)
on conflict (clave) do update
set valor = excluded.valor,
    descripcion = excluded.descripcion,
    publica = excluded.publica;

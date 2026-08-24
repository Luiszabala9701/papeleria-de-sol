-- Simplifica el catálogo para administrarlo por categorías específicas.
-- Ejecutar una sola vez en el proyecto de Supabase de PRUEBAS.

-- Los 1.000 stickers iniciales pasan a tener un precio de $100.
update public.productos
set precio = 100
where tipo_producto = 'sticker'
  and (precio is null or precio = 0);

-- Se eliminan las categorías genéricas que ya no se mostrarán en el dashboard.
-- Las referencias de productos quedan sin categoría de forma segura (ON DELETE SET NULL).
delete from public.categorias
where slug in ('stickers', 'plantillas', 'productos-fisicos');

-- Los temas se reemplazan por categorías específicas, por ejemplo:
-- "Fútbol" de tipo Sticker o "Agenda" de tipo Producto físico.
-- Esta eliminación fue confirmada para el entorno de pruebas.
drop table if exists public.productos_temas;
drop table if exists public.temas;

-- La sección antigua de stickers pasa a administrar el bloque que hoy aparece
-- como "Stickers destacados" en el inicio. La antigua sección de plantillas no
-- se muestra en la página y se elimina.
do $$
begin
  delete from public.secciones where clave = 'inicio_plantillas';

  if exists (select 1 from public.secciones where clave = 'inicio_destacados') then
    delete from public.secciones where clave = 'inicio_stickers';
  else
    update public.secciones
    set clave = 'inicio_destacados'
    where clave = 'inicio_stickers';
  end if;

  if not exists (select 1 from public.secciones where clave = 'inicio_destacados') then
    insert into public.secciones (
      clave, titulo, subtitulo, contenido, texto_boton, enlace_boton, publicada, orden
    ) values (
      'inicio_destacados',
      'Stickers destacados',
      'Nuestros favoritos',
      'Una pequeña muestra de la colección. En el catálogo podés buscar y combinar los diseños que quieras.',
      'Ver los 1.000 stickers',
      '/catalogo?tipo=sticker',
      true,
      2
    );
  end if;
end;
$$;

-- Textos que se editan desde "Contenido del sitio" > "Contacto y textos generales".
insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('lema_marca', '"Papelería creativa"'::jsonb, 'Texto debajo del nombre de la marca', true),
  ('aviso_superior', '"Pedidos personalizados en CABA y GBA · Consultanos por WhatsApp"'::jsonb, 'Mensaje de la franja superior', true),
  ('descripcion_footer', '"Papelería creativa, stickers y productos personalizados con atención directa en CABA y GBA."'::jsonb, 'Texto descriptivo del footer', true),
  ('titulo_footer_explorar', '"Explorá"'::jsonb, 'Título de enlaces del footer', true),
  ('titulo_footer_contacto', '"Contacto"'::jsonb, 'Título de contacto del footer', true)
on conflict (clave) do nothing;

-- El límite también se valida en la base de datos, no solo en el navegador.
create or replace function public.limitar_imagenes_por_producto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cantidad_actual integer;
begin
  if new.producto_id is null then
    return new;
  end if;

  select count(*) into cantidad_actual
  from public.imagenes
  where producto_id = new.producto_id
    and id is distinct from new.id;

  if cantidad_actual >= 5 then
    raise exception 'Un producto puede tener como máximo 5 imágenes.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists limitar_imagenes_por_producto on public.imagenes;

create trigger limitar_imagenes_por_producto
before insert or update of producto_id on public.imagenes
for each row
execute function public.limitar_imagenes_por_producto();

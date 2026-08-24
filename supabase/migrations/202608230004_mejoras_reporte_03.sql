-- Ajustes del reporte 03 para el proyecto de Supabase de PRUEBAS.
-- Ejecutar una sola vez en SQL Editor.

-- "Oculto" se unifica en "No publicado" para simplificar la administración.
update public.productos
set estado = 'borrador'
where estado = 'oculto';

-- Ya no se mantiene una segunda descripción solamente para el footer.
delete from public.configuraciones_sitio
where clave = 'descripcion_footer';

-- El mensaje superior se muestra de forma predeterminada y puede desactivarse
-- desde Contenido del sitio.
insert into public.configuraciones_sitio (clave, valor, descripcion, publica)
values (
  'mostrar_aviso_superior',
  'true'::jsonb,
  'Indica si se muestra el mensaje superior de la tienda',
  true
)
on conflict (clave) do nothing;

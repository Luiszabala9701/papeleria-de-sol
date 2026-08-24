-- Formatos seguros para textos administrables y paleta editable de Papelería de Sol.
-- Ejecutar después de 202608040001_esquema_inicial.sql.

alter table public.secciones
  add column if not exists estilos jsonb not null default '{}'::jsonb;

insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('color_principal', '"#98b7ff"', 'Color inicial de la identidad visual', true),
  ('color_secundario', '"#df98ff"', 'Color final de la identidad visual', true),
  ('color_principal_intenso', '"#526ca8"', 'Color inicial intenso para botones y enlaces', true),
  ('color_secundario_intenso', '"#9358ad"', 'Color final intenso para botones y enlaces', true),
  ('color_fondo', '"#fbfaff"', 'Color de fondo general del sitio', true),
  ('color_texto', '"#252434"', 'Color del texto principal', true),
  ('color_texto_suave', '"#676579"', 'Color del texto secundario', true),
  ('fuente_principal', '"moderna"', 'Tipografía general elegida en el administrador', true)
on conflict (clave) do nothing;

-- Ejecutar después de crear el usuario desde Authentication > Users en Supabase.
-- Reemplazar el correo antes de ejecutar. No colocar ninguna contraseña aquí.

insert into public.perfiles_administradores (usuario_id, nombre, activo)
select id, 'Administración Papelería de Sol', true
from auth.users
where lower(email) = lower('REEMPLAZAR_CON_CORREO_ADMINISTRADOR')
on conflict (usuario_id) do update set
  nombre = excluded.nombre,
  activo = true;

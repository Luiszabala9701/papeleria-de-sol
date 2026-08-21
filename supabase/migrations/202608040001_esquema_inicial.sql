-- Esquema inicial de Papelería de Sol.
-- Este archivo se ejecuta sobre PostgreSQL mediante Supabase.

create extension if not exists pgcrypto;

create type public.tipo_producto as enum ('sticker', 'plantilla', 'fisico');
create type public.estado_publicacion as enum ('borrador', 'publicado', 'oculto', 'archivado');
create type public.tipo_movimiento_stock as enum ('entrada', 'salida', 'ajuste');

create table public.perfiles_administradores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  descripcion text,
  tipo_producto public.tipo_producto,
  imagen_url text,
  publicada boolean not null default true,
  orden integer not null default 0 check (orden >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  descripcion text,
  imagen_url text,
  publicado boolean not null default true,
  orden integer not null default 0 check (orden >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo_producto public.tipo_producto not null,
  nombre text not null,
  slug text not null unique,
  sku text unique,
  descripcion_corta text not null default '',
  descripcion text not null default '',
  precio numeric(12, 2) check (precio is null or precio >= 0),
  moneda char(3) not null default 'ARS',
  controla_stock boolean not null default false,
  stock integer check (stock is null or stock >= 0),
  estado public.estado_publicacion not null default 'borrador',
  destacado boolean not null default false,
  orden integer not null default 0 check (orden >= 0),
  mensaje_whatsapp text,
  meta_titulo text,
  meta_descripcion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint stock_coherente check (
    (controla_stock = false) or (controla_stock = true and stock is not null)
  )
);

create table public.productos_temas (
  producto_id uuid not null references public.productos(id) on delete cascade,
  tema_id uuid not null references public.temas(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (producto_id, tema_id)
);

create table public.variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre text not null,
  sku text unique,
  precio numeric(12, 2) check (precio is null or precio >= 0),
  stock integer check (stock is null or stock >= 0),
  estado public.estado_publicacion not null default 'publicado',
  orden integer not null default 0 check (orden >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.secciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  titulo text not null,
  subtitulo text,
  contenido text,
  imagen_url text,
  texto_boton text,
  enlace_boton text,
  publicada boolean not null default true,
  orden integer not null default 0 check (orden >= 0),
  meta_titulo text,
  meta_descripcion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.imagenes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references public.productos(id) on delete cascade,
  seccion_id uuid references public.secciones(id) on delete cascade,
  deposito text not null default 'productos',
  ruta text,
  url_publica text not null,
  texto_alternativo text not null,
  es_principal boolean not null default false,
  orden integer not null default 0 check (orden >= 0),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint imagen_con_propietario check (
    producto_id is not null or seccion_id is not null
  )
);

create table public.historial_precios (
  id bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_anterior numeric(12, 2),
  precio_nuevo numeric(12, 2),
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.movimientos_stock (
  id bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  variante_id uuid references public.variantes(id) on delete cascade,
  tipo public.tipo_movimiento_stock not null,
  cantidad integer not null check (cantidad > 0),
  stock_anterior integer,
  stock_nuevo integer,
  motivo text,
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.configuraciones_sitio (
  clave text primary key,
  valor jsonb not null,
  descripcion text,
  publica boolean not null default false,
  actualizado_en timestamptz not null default now()
);

create table public.sesiones_administrativas (
  id_sesion uuid primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  ultima_actividad_en timestamptz not null default now(),
  creada_en timestamptz not null default now(),
  cerrada_en timestamptz,
  direccion_ip inet,
  agente_usuario text
);

create table public.registros_auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid references auth.users(id) on delete set null,
  accion text not null,
  recurso text not null,
  recurso_id text,
  datos jsonb,
  creado_en timestamptz not null default now()
);

create index productos_estado_orden_idx on public.productos (estado, orden);
create index productos_tipo_idx on public.productos (tipo_producto);
create index productos_categoria_idx on public.productos (categoria_id);
create index imagenes_producto_idx on public.imagenes (producto_id, orden);
create index variantes_producto_idx on public.variantes (producto_id, orden);
create index sesiones_usuario_idx on public.sesiones_administrativas (usuario_id, ultima_actividad_en);
create index auditoria_usuario_fecha_idx on public.registros_auditoria (usuario_id, creado_en desc);

create or replace function public.actualizar_fecha_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger actualizar_perfiles_administradores
before update on public.perfiles_administradores
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_categorias
before update on public.categorias
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_temas
before update on public.temas
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_productos
before update on public.productos
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_variantes
before update on public.variantes
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_secciones
before update on public.secciones
for each row execute function public.actualizar_fecha_modificacion();

create trigger actualizar_imagenes
before update on public.imagenes
for each row execute function public.actualizar_fecha_modificacion();

create or replace function public.es_administrador(usuario_consultado uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles_administradores
    where usuario_id = usuario_consultado
      and activo = true
  );
$$;

revoke all on function public.es_administrador(uuid) from public;
grant execute on function public.es_administrador(uuid) to anon, authenticated, service_role;

alter table public.perfiles_administradores enable row level security;
alter table public.categorias enable row level security;
alter table public.temas enable row level security;
alter table public.productos enable row level security;
alter table public.productos_temas enable row level security;
alter table public.variantes enable row level security;
alter table public.secciones enable row level security;
alter table public.imagenes enable row level security;
alter table public.historial_precios enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.configuraciones_sitio enable row level security;
alter table public.sesiones_administrativas enable row level security;
alter table public.registros_auditoria enable row level security;

create policy "Perfil propio visible para administradores"
on public.perfiles_administradores for select
to authenticated
using (usuario_id = auth.uid() and activo = true);

create policy "Categorías publicadas visibles"
on public.categorias for select
to anon, authenticated
using (publicada = true or public.es_administrador());

create policy "Administradores gestionan categorías"
on public.categorias for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Temas publicados visibles"
on public.temas for select
to anon, authenticated
using (publicado = true or public.es_administrador());

create policy "Administradores gestionan temas"
on public.temas for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Productos publicados visibles"
on public.productos for select
to anon, authenticated
using (estado = 'publicado' or public.es_administrador());

create policy "Administradores gestionan productos"
on public.productos for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Relaciones de productos publicados visibles"
on public.productos_temas for select
to anon, authenticated
using (
  public.es_administrador()
  or exists (
    select 1 from public.productos
    where productos.id = productos_temas.producto_id
      and productos.estado = 'publicado'
  )
);

create policy "Administradores gestionan relaciones de temas"
on public.productos_temas for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Variantes publicadas visibles"
on public.variantes for select
to anon, authenticated
using (
  public.es_administrador()
  or (
    estado = 'publicado'
    and exists (
      select 1 from public.productos
      where productos.id = variantes.producto_id
        and productos.estado = 'publicado'
    )
  )
);

create policy "Administradores gestionan variantes"
on public.variantes for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Secciones publicadas visibles"
on public.secciones for select
to anon, authenticated
using (publicada = true or public.es_administrador());

create policy "Administradores gestionan secciones"
on public.secciones for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Imágenes públicas visibles"
on public.imagenes for select
to anon, authenticated
using (
  public.es_administrador()
  or exists (
    select 1 from public.productos
    where productos.id = imagenes.producto_id
      and productos.estado = 'publicado'
  )
  or exists (
    select 1 from public.secciones
    where secciones.id = imagenes.seccion_id
      and secciones.publicada = true
  )
);

create policy "Administradores gestionan imágenes"
on public.imagenes for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Administradores consultan precios"
on public.historial_precios for select
to authenticated
using (public.es_administrador());

create policy "Administradores consultan stock"
on public.movimientos_stock for select
to authenticated
using (public.es_administrador());

create policy "Configuraciones públicas visibles"
on public.configuraciones_sitio for select
to anon, authenticated
using (publica = true or public.es_administrador());

create policy "Administradores gestionan configuraciones"
on public.configuraciones_sitio for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

create policy "Administrador consulta su sesión"
on public.sesiones_administrativas for select
to authenticated
using (usuario_id = auth.uid() and public.es_administrador());

create policy "Administradores consultan auditoría"
on public.registros_auditoria for select
to authenticated
using (public.es_administrador());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Imágenes del catálogo visibles en Storage"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'productos');

create policy "Administradores suben imágenes a Storage"
on storage.objects for insert
to authenticated
with check (bucket_id = 'productos' and public.es_administrador());

create policy "Administradores actualizan imágenes en Storage"
on storage.objects for update
to authenticated
using (bucket_id = 'productos' and public.es_administrador())
with check (bucket_id = 'productos' and public.es_administrador());

create policy "Administradores eliminan imágenes de Storage"
on storage.objects for delete
to authenticated
using (bucket_id = 'productos' and public.es_administrador());

insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('nombre_marca', '"Papelería de Sol"', 'Nombre público de la tienda', true),
  ('descripcion_corta', '"Papelería creativa, stickers, plantillas y productos personalizados en CABA y GBA."', 'Descripción general', true),
  ('whatsapp', '"541164879422"', 'Número internacional sin espacios', true),
  ('correo', '"Solnat.v@gmail.com"', 'Correo comercial', true),
  ('instagram', '"https://www.instagram.com/papeleriadesol?igsh=MTc0ZWg1amd0NTg5bw=="', 'Instagram oficial', true),
  ('tiktok', '"https://www.tiktok.com/@papeleriadesol?_r=1&_t=ZM-93DMEseSIUW"', 'TikTok oficial', true),
  ('pais', '"Argentina"', 'País principal', true),
  ('region', '"CABA y GBA"', 'Región comercial', true),
  ('moneda', '"ARS"', 'Código de moneda', true),
  ('simbolo_moneda', '"$"', 'Símbolo de moneda', true),
  ('inactividad_administrador_minutos', '30', 'Tiempo máximo sin actividad administrativa', false)
on conflict (clave) do nothing;

insert into public.secciones (
  clave, titulo, subtitulo, contenido, texto_boton, enlace_boton, publicada, orden
) values
  (
    'inicio_principal',
    'Ideas que alegran tus días',
    'Papelería creativa hecha con dedicación',
    'Descubrí stickers, plantillas y productos físicos para regalar, organizar y personalizar. Elegí tus favoritos y consultanos directamente por WhatsApp.',
    'Explorar el catálogo',
    '/catalogo',
    true,
    1
  ),
  (
    'inicio_stickers',
    'Stickers para cada idea',
    'Más de 1.000 diseños disponibles',
    'Buscá por número, armá tu selección y envianos el pedido por WhatsApp.',
    'Ver stickers',
    '/catalogo?tipo=sticker',
    true,
    2
  ),
  (
    'inicio_plantillas',
    'Plantillas creativas',
    'Diseños editables e imprimibles',
    'Las nuevas colecciones se publicarán desde el dashboard.',
    'Ver plantillas',
    '/plantillas',
    true,
    3
  )
on conflict (clave) do nothing;

insert into public.categorias (nombre, slug, descripcion, tipo_producto, publicada, orden) values
  ('Stickers', 'stickers', 'Colección completa de stickers', 'sticker', true, 1),
  ('Plantillas', 'plantillas', 'Plantillas editables e imprimibles', 'plantilla', true, 2),
  ('Productos físicos', 'productos-fisicos', 'Productos preparados y personalizados', 'fisico', true, 3)
on conflict (slug) do nothing;

insert into public.productos (
  categoria_id,
  tipo_producto,
  nombre,
  slug,
  sku,
  descripcion_corta,
  descripcion,
  precio,
  controla_stock,
  stock,
  estado,
  destacado,
  orden
)
select
  categoria.id,
  'sticker'::public.tipo_producto,
  'Sticker #' || numero,
  'sticker-' || numero,
  'ST-' || lpad(numero::text, 4, '0'),
  'Sticker creativo número ' || numero || '.',
  'Diseño de sticker número ' || numero || ' disponible para consultar por WhatsApp.',
  null,
  false,
  null,
  'publicado'::public.estado_publicacion,
  numero <= 8,
  numero
from generate_series(1, 1000) as serie(numero)
cross join lateral (
  select id from public.categorias where slug = 'stickers' limit 1
) as categoria
on conflict (slug) do nothing;

insert into public.imagenes (
  producto_id,
  deposito,
  ruta,
  url_publica,
  texto_alternativo,
  es_principal,
  orden
)
select
  productos.id,
  'sitio',
  null,
  '/stickers/' || productos.orden || '.webp',
  'Sticker creativo número ' || productos.orden || ' de Papelería de Sol',
  true,
  1
from public.productos
where productos.tipo_producto = 'sticker'
  and productos.sku like 'ST-%'
  and not exists (
    select 1 from public.imagenes where imagenes.producto_id = productos.id
  );

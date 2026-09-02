-- Esquema base completo de Papelería de Sol.
--
-- Uso: crear un proyecto Supabase nuevo y vacío con la estructura actual.
-- No ejecutar en los proyectos de pruebas o producción ya existentes: sus datos
-- y estructuras ya están creados. Este archivo no contiene cuentas, contraseñas
-- ni datos reales de clientes.

create extension if not exists pgcrypto;

create type public.tipo_producto as enum ('sticker', 'plantilla', 'fisico');
create type public.estado_publicacion as enum ('borrador', 'publicado', 'archivado');
create type public.tipo_movimiento_stock as enum ('entrada', 'salida', 'ajuste');

-- Cuentas administrativas autorizadas por Supabase Auth.
create table public.perfiles_administradores (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Clasificación y catálogo.
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
    controla_stock = false or (controla_stock = true and stock is not null)
  )
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
  estilos jsonb not null default '{}'::jsonb,
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

-- Trazabilidad administrativa.
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

create table public.archivos_pendientes_eliminar (
  id uuid primary key default gen_random_uuid(),
  ruta text not null,
  deposito text not null default 'productos',
  producto_id uuid references public.productos(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (ruta, deposito)
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
alter table public.productos enable row level security;
alter table public.variantes enable row level security;
alter table public.secciones enable row level security;
alter table public.imagenes enable row level security;
alter table public.historial_precios enable row level security;
alter table public.movimientos_stock enable row level security;
alter table public.configuraciones_sitio enable row level security;
alter table public.sesiones_administrativas enable row level security;
alter table public.registros_auditoria enable row level security;
alter table public.archivos_pendientes_eliminar enable row level security;

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

create policy "Productos publicados visibles"
on public.productos for select
to anon, authenticated
using (estado = 'publicado' or public.es_administrador());

create policy "Administradores gestionan productos"
on public.productos for all
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

-- Límite defensivo: no se pueden asociar más de cinco imágenes a un producto.
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

create trigger limitar_imagenes_por_producto
before insert or update of producto_id on public.imagenes
for each row
execute function public.limitar_imagenes_por_producto();

-- Bucket público de imágenes y sus permisos.
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

-- Configuración pública y visual predeterminada. Los datos comerciales pueden
-- modificarse posteriormente desde el panel de administración.
insert into public.configuraciones_sitio (clave, valor, descripcion, publica) values
  ('descripcion_corta', to_jsonb('Papelería creativa, stickers, plantillas y productos personalizados en CABA y GBA.'::text), 'Descripción general', true),
  ('whatsapp', to_jsonb('541164879422'::text), 'Número internacional sin espacios', true),
  ('correo', to_jsonb('Solnat.v@gmail.com'::text), 'Correo comercial', true),
  ('instagram', to_jsonb('https://www.instagram.com/papeleriadesol?igsh=MTc0ZWg1amd0NTg5bw=='::text), 'Instagram oficial', true),
  ('tiktok', to_jsonb('https://www.tiktok.com/@papeleriadesol?_r=1&_t=ZM-93DMEseSIUW'::text), 'TikTok oficial', true),
  ('pais', to_jsonb('Argentina'::text), 'País principal', true),
  ('region', to_jsonb('CABA y GBA'::text), 'Región comercial', true),
  ('moneda', to_jsonb('ARS'::text), 'Código de moneda', true),
  ('simbolo_moneda', to_jsonb('$'::text), 'Símbolo de moneda', true),
  ('inactividad_administrador_minutos', '30'::jsonb, 'Tiempo máximo sin actividad administrativa', false),
  ('mostrar_aviso_superior', 'true'::jsonb, 'Indica si se muestra el mensaje superior de la tienda', true),
  ('color_principal', to_jsonb('#98b7ff'::text), 'Color inicial de la identidad visual', true),
  ('color_secundario', to_jsonb('#df98ff'::text), 'Color final de la identidad visual', true),
  ('color_principal_intenso', to_jsonb('#526ca8'::text), 'Color inicial intenso para botones y enlaces', true),
  ('color_secundario_intenso', to_jsonb('#9358ad'::text), 'Color final intenso para botones y enlaces', true),
  ('color_fondo', to_jsonb('#fbfaff'::text), 'Color de fondo general del sitio', true),
  ('color_texto', to_jsonb('#252434'::text), 'Color del texto principal', true),
  ('color_texto_suave', to_jsonb('#676579'::text), 'Color del texto secundario', true);

insert into public.configuraciones_sitio (clave, valor, descripcion, publica)
select clave, to_jsonb(valor), 'Texto público editable desde el administrador', true
from jsonb_each_text(
  '{
    "navegacion_inicio": "Inicio",
    "navegacion_catalogo": "Stickers",
    "navegacion_plantillas": "Plantillas",
    "navegacion_productos_fisicos": "Productos físicos",
    "navegacion_ayuda": "Ayuda",
    "carrito_boton": "Mi selección",
    "footer_catalogo": "Stickers",
    "footer_plantillas": "Plantillas",
    "footer_productos_fisicos": "Productos físicos",
    "footer_ayuda": "Ayuda para clientes",
    "pie_derechos_reservados": "Todos los derechos reservados.",
    "inicio_texto_destacado": "con un toque de Sol",
    "catalogo_etiqueta": "Colecciones de Papelería de Sol",
    "catalogo_titulo": "Encontrá tu próximo favorito",
    "catalogo_descripcion": "Buscá por nombre o número, elegí una categoría y agregá tus stickers favoritos a la selección.",
    "catalogo_busqueda_placeholder": "Buscar por nombre o número…",
    "catalogo_todas_categorias": "Todas las categorías",
    "catalogo_aviso_disponibilidad": "Consultá disponibilidad por WhatsApp",
    "catalogo_pagina_anterior": "Anterior",
    "catalogo_pagina_siguiente": "Siguiente",
    "plantillas_etiqueta": "Diseños digitales",
    "plantillas_titulo": "Plantillas creativas",
    "plantillas_descripcion": "Encontrá plantillas para organizar, estudiar y crear. Elegí la que te gusta y consultanos por WhatsApp.",
    "plantillas_vacio_etiqueta": "Estamos preparando novedades",
    "plantillas_vacio_titulo": "Próximamente habrá nuevas plantillas",
    "plantillas_vacio_descripcion": "Consultanos por WhatsApp si buscás un diseño personalizado.",
    "plantillas_vacio_boton": "Consultar por WhatsApp",
    "fisicos_etiqueta": "Hechos con dedicación",
    "fisicos_titulo": "Productos físicos",
    "fisicos_descripcion": "Elegí productos de papelería creativa, regalos y opciones personalizadas. Consultá por WhatsApp para coordinar los detalles.",
    "fisicos_vacio_etiqueta": "Nuevas creaciones en camino",
    "fisicos_vacio_titulo": "Muy pronto vas a ver productos físicos",
    "fisicos_vacio_descripcion": "Mientras tanto, podés consultarnos si tenés una idea especial.",
    "fisicos_vacio_boton": "Contanos tu idea",
    "producto_destacado": "Destacado",
    "producto_tipo_fisico": "Producto físico",
    "producto_agregar": "Agregar",
    "producto_agregar_seleccion": "Agregar a mi selección",
    "producto_sku": "SKU",
    "producto_categoria": "Categoría",
    "producto_disponibilidad": "Disponibilidad",
    "producto_en_stock": "En stock",
    "producto_consultar": "Consultar",
    "carrito_etiqueta": "Tu pedido",
    "carrito_titulo": "Mi selección",
    "carrito_vacio": "Todavía no agregaste productos.",
    "carrito_explorar_catalogo": "Explorar stickers",
    "carrito_productos_seleccionados": "Productos seleccionados",
    "carrito_total": "Total",
    "carrito_continuar_whatsapp": "Continuar compra por WhatsApp",
    "carrito_vaciar": "Vaciar selección",
    "carrito_aclaracion": "El pedido se confirma personalmente por WhatsApp. No se realiza ningún pago desde esta página.",
    "carrito_cantidad": "Cantidad",
    "carrito_agregado": "se agregó a tu selección.",
    "mensaje_whatsapp_inicio": "¡Hola! Quisiera realizar el siguiente pedido:",
    "mensaje_whatsapp_total_productos": "Total de productos",
    "mensaje_whatsapp_total": "Total del pedido",
    "mensaje_whatsapp_cierre": "Quedo atento/a. Gracias.",
    "ayuda_etiqueta": "Estamos para ayudarte",
    "ayuda_titulo": "Cómo consultar y comprar",
    "ayuda_descripcion": "Elegí tus productos, armá tu selección y escribinos por WhatsApp para coordinar los detalles.",
    "ayuda_paso_1_titulo": "1. Explorá los stickers",
    "ayuda_paso_1_descripcion": "Buscá stickers por nombre o categoría. También podés recorrer las plantillas y los productos físicos.",
    "ayuda_paso_2_titulo": "2. Armá tu selección",
    "ayuda_paso_2_descripcion": "Usá el botón Agregar en cada producto. Podés cambiar las cantidades o vaciar la selección cuando quieras.",
    "ayuda_paso_3_titulo": "3. Continuá por WhatsApp",
    "ayuda_paso_3_descripcion": "Al continuar, se abre WhatsApp con el detalle y el total estimado de los productos elegidos.",
    "ayuda_consultas_titulo": "¿Tenés una idea especial?",
    "ayuda_consultas_descripcion": "Escribinos por WhatsApp. Allí coordinamos productos personalizados, retiro o envío, pago y otros detalles.",
    "ayuda_consultas_boton": "Escribir por WhatsApp"
  }'::jsonb
);

-- Contenido inicial de la portada.
insert into public.secciones (
  clave,
  titulo,
  subtitulo,
  contenido,
  texto_boton,
  enlace_boton,
  publicada,
  orden
)
values
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
  );

-- Catálogo de respaldo. Las imágenes se resuelven desde los archivos locales
-- incluidos en el sitio; los productos comerciales reales se cargan luego desde
-- el administrador junto con sus imágenes en Storage.
insert into public.productos (
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
  'sticker'::public.tipo_producto,
  'Sticker #' || numero,
  'sticker-' || numero,
  'ST-' || lpad(numero::text, 4, '0'),
  'Sticker creativo número ' || numero || '.',
  'Diseño de sticker número ' || numero || ' disponible para consultar por WhatsApp.',
  500,
  false,
  null,
  'publicado'::public.estado_publicacion,
  numero <= 8,
  numero
from generate_series(1, 1000) as serie(numero);

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
  and productos.sku like 'ST-%';

comment on table public.archivos_pendientes_eliminar is
  'Registro interno de archivos de Storage pendientes de eliminación segura.';

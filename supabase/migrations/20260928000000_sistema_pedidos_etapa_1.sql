-- Etapa 1: modelo transaccional de pedidos, pagos, stock, seguimiento, outbox y cupones.
-- Esta migración es incremental. No contiene credenciales ni habilita checkout o correos.
-- Debe aplicarse primero en el proyecto de pruebas sutyznqxbmawwrxbnddr.

begin;
set constraints all immediate;

do $$ begin
  create type public.tipo_pedido as enum ('automatico', 'coordinado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_comercial_pedido as enum ('solicitud', 'cotizando', 'espera_cliente', 'confirmado', 'cancelado', 'finalizado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_preparacion_pedido as enum ('no_iniciada', 'espera_anticipo', 'en_diseno', 'espera_aprobacion', 'en_preparacion', 'listo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_entrega_pedido as enum ('sin_definir', 'pendiente', 'listo_retiro', 'retirado', 'enviado', 'entregado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_financiero_pedido as enum ('sin_cobro', 'pendiente', 'anticipo_pagado', 'pagado', 'parcialmente_reembolsado', 'reembolsado', 'incidencia');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.metodo_pago_pedido as enum ('mercado_pago', 'transferencia');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tipo_pago_pedido as enum ('total', 'anticipo', 'saldo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_pago_pedido as enum ('creado', 'pendiente', 'aprobado', 'rechazado', 'cancelado', 'incidencia');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.origen_verificacion_pago as enum ('mercado_pago', 'administracion');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_reserva_stock as enum ('activa', 'consumida', 'vencida', 'cancelada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_evento_pago as enum ('recibido', 'procesando', 'procesado', 'ignorado', 'error');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_reembolso as enum ('pendiente', 'aprobado', 'rechazado', 'cancelado');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_notificacion as enum ('pendiente', 'procesando', 'enviada', 'error', 'descartada');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.tipo_descuento_cupon as enum ('porcentaje', 'fijo');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.alcance_cupon as enum ('todos', 'categorias', 'productos');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.aplicacion_tipo_pedido_cupon as enum ('automatico', 'coordinado', 'ambos');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.estado_reserva_cupon as enum ('reservada', 'confirmada', 'liberada', 'vencida');
exception when duplicate_object then null; end $$;

alter table public.productos
  add column if not exists compra_automatica_habilitada boolean not null default false,
  add column if not exists requiere_personalizacion boolean not null default false;

comment on column public.productos.compra_automatica_habilitada is
  'Feature flag por producto. Todos quedan coordinados hasta una activación administrativa explícita.';

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  tipo public.tipo_pedido not null,
  moneda char(3) not null default 'ARS' check (moneda = 'ARS'),
  cliente_nombre text not null check (char_length(btrim(cliente_nombre)) between 2 and 120),
  cliente_correo text not null check (char_length(cliente_correo) between 3 and 254),
  cliente_whatsapp text not null check (char_length(cliente_whatsapp) between 6 and 30),
  requiere_envio boolean not null default false,
  envio_definido boolean not null default false,
  direccion_entrega text check (direccion_entrega is null or char_length(direccion_entrega) <= 500),
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  descuento_centavos bigint not null default 0 check (descuento_centavos >= 0),
  envio_centavos bigint not null default 0 check (envio_centavos >= 0),
  total_centavos bigint not null check (total_centavos >= 0),
  anticipo_objetivo_centavos bigint not null default 0 check (anticipo_objetivo_centavos >= 0),
  estado_comercial public.estado_comercial_pedido not null default 'solicitud',
  estado_preparacion public.estado_preparacion_pedido not null default 'no_iniciada',
  estado_entrega public.estado_entrega_pedido not null default 'sin_definir',
  estado_financiero public.estado_financiero_pedido not null default 'sin_cobro',
  referencia_externa text unique check (referencia_externa is null or char_length(referencia_externa) between 8 and 100),
  clave_idempotencia text not null unique check (char_length(clave_idempotencia) between 16 and 160),
  observaciones_cliente text check (observaciones_cliente is null or char_length(observaciones_cliente) <= 1000),
  notas_internas text check (notas_internas is null or char_length(notas_internas) <= 2000),
  incidencia_codigo text check (incidencia_codigo is null or char_length(incidencia_codigo) <= 80),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cancelado_en timestamptz,
  finalizado_en timestamptz,
  constraint pedido_total_coherente check (total_centavos = subtotal_centavos - descuento_centavos + envio_centavos),
  constraint pedido_descuento_coherente check (descuento_centavos <= subtotal_centavos),
  constraint pedido_anticipo_coherente check (anticipo_objetivo_centavos <= total_centavos),
  constraint pedido_automatico_solo_retiro check (
    tipo <> 'automatico' or (requiere_envio = false and envio_definido = true and envio_centavos = 0)
  )
);

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  producto_id uuid references public.productos(id) on delete set null,
  variante_id uuid references public.variantes(id) on delete set null,
  categoria_id uuid references public.categorias(id) on delete set null,
  producto_nombre text not null check (char_length(producto_nombre) between 1 and 200),
  variante_nombre text check (variante_nombre is null or char_length(variante_nombre) <= 200),
  sku text check (sku is null or char_length(sku) <= 100),
  descripcion text not null default '' check (char_length(descripcion) <= 2000),
  precio_unitario_centavos bigint not null check (precio_unitario_centavos >= 0),
  cantidad integer not null check (cantidad between 1 and 100),
  subtotal_centavos bigint not null check (subtotal_centavos >= 0),
  opciones_personalizadas jsonb not null default '{}'::jsonb check (jsonb_typeof(opciones_personalizadas) = 'object'),
  compra_automatica boolean not null default false,
  requiere_personalizacion boolean not null default false,
  requiere_reserva_stock boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint pedido_item_subtotal_coherente check (subtotal_centavos = precio_unitario_centavos * cantidad)
);

create table if not exists public.reservas_stock (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  pedido_item_id uuid not null references public.pedido_items(id) on delete restrict,
  producto_id uuid references public.productos(id) on delete set null,
  variante_id uuid references public.variantes(id) on delete set null,
  cantidad integer not null check (cantidad > 0),
  estado public.estado_reserva_stock not null default 'activa',
  clave_idempotencia text not null check (char_length(clave_idempotencia) between 16 and 160),
  vence_en timestamptz not null,
  consumida_en timestamptz,
  liberada_en timestamptz,
  creado_en timestamptz not null default now(),
  unique (pedido_id, pedido_item_id, clave_idempotencia),
  constraint reserva_stock_identidad check (producto_id is not null)
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  metodo public.metodo_pago_pedido not null,
  tipo public.tipo_pago_pedido not null,
  estado public.estado_pago_pedido not null default 'creado',
  importe_centavos bigint not null check (importe_centavos > 0),
  moneda char(3) not null default 'ARS' check (moneda = 'ARS'),
  origen_verificacion public.origen_verificacion_pago not null,
  proveedor text check (proveedor is null or char_length(proveedor) <= 40),
  id_externo text unique check (id_externo is null or char_length(id_externo) <= 160),
  clave_idempotencia text not null unique check (char_length(clave_idempotencia) between 16 and 160),
  usuario_verificador_id uuid references auth.users(id) on delete set null,
  referencia text check (referencia is null or char_length(referencia) <= 300),
  nota text check (nota is null or char_length(nota) <= 1000),
  aprobado_en timestamptz,
  rechazado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint pago_verificacion_coherente check (
    (metodo = 'mercado_pago' and origen_verificacion = 'mercado_pago' and usuario_verificador_id is null)
    or (metodo = 'transferencia' and origen_verificacion = 'administracion')
  ),
  constraint pago_aprobacion_coherente check (
    estado <> 'aprobado' or aprobado_en is not null
  )
);

create table if not exists public.transferencias_pago (
  pago_id uuid primary key references public.pagos(id) on delete restrict,
  comprobante_referencia text check (comprobante_referencia is null or char_length(comprobante_referencia) <= 300),
  recibido_en timestamptz,
  creado_en timestamptz not null default now()
);

create table if not exists public.eventos_pago (
  id bigint generated always as identity primary key,
  proveedor text not null check (char_length(proveedor) between 2 and 40),
  id_evento_externo text not null check (char_length(id_evento_externo) between 1 and 180),
  id_orden_externa text check (id_orden_externa is null or char_length(id_orden_externa) <= 180),
  accion text check (accion is null or char_length(accion) <= 100),
  modo_prueba boolean not null default true,
  firma_valida boolean not null default false,
  hash_payload bytea not null check (octet_length(hash_payload) = 32),
  estado public.estado_evento_pago not null default 'recibido',
  intentos smallint not null default 0 check (intentos between 0 and 20),
  ocurrido_en timestamptz,
  recibido_en timestamptz not null default now(),
  procesado_en timestamptz,
  error_seguro text check (error_seguro is null or char_length(error_seguro) <= 500),
  unique (proveedor, id_evento_externo)
);

create table if not exists public.reembolsos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  pago_id uuid references public.pagos(id) on delete restrict,
  estado public.estado_reembolso not null default 'pendiente',
  importe_centavos bigint not null check (importe_centavos > 0),
  moneda char(3) not null default 'ARS' check (moneda = 'ARS'),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 500),
  id_externo text unique check (id_externo is null or char_length(id_externo) <= 160),
  clave_idempotencia text not null unique check (char_length(clave_idempotencia) between 16 and 160),
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  procesado_en timestamptz
);

create table if not exists public.historial_pedidos (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  evento text not null check (char_length(evento) between 2 and 100),
  actor text not null default 'sistema' check (actor in ('sistema', 'cliente', 'administracion', 'mercado_pago')),
  usuario_id uuid references auth.users(id) on delete set null,
  estado_anterior jsonb,
  estado_nuevo jsonb,
  nota text check (nota is null or char_length(nota) <= 1000),
  metadatos jsonb not null default '{}'::jsonb check (jsonb_typeof(metadatos) = 'object'),
  clave_deduplicacion text unique check (clave_deduplicacion is null or char_length(clave_deduplicacion) between 8 and 200),
  creado_en timestamptz not null default now()
);

create table if not exists public.tokens_consulta_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  vence_en timestamptz not null,
  revocado_en timestamptz,
  rotado_desde_id uuid references public.tokens_consulta_pedido(id) on delete set null,
  creado_en timestamptz not null default now(),
  ultimo_uso_en timestamptz,
  constraint token_consulta_vigencia check (vence_en > creado_en)
);

create table if not exists public.notificaciones_outbox (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete restrict,
  evento text not null check (char_length(evento) between 2 and 100),
  destinatario text not null check (char_length(destinatario) between 3 and 254),
  plantilla text not null check (char_length(plantilla) between 2 and 100),
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  clave_deduplicacion text not null unique check (char_length(clave_deduplicacion) between 8 and 200),
  estado public.estado_notificacion not null default 'pendiente',
  intentos smallint not null default 0 check (intentos between 0 and 20),
  max_intentos smallint not null default 5 check (max_intentos between 1 and 20),
  proximo_intento_en timestamptz not null default now(),
  ultimo_error_seguro text check (ultimo_error_seguro is null or char_length(ultimo_error_seguro) <= 500),
  creado_en timestamptz not null default now(),
  enviado_en timestamptz,
  constraint outbox_intentos_coherentes check (intentos <= max_intentos)
);

create table if not exists public.cupones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (char_length(btrim(codigo)) between 3 and 40),
  codigo_normalizado text not null unique check (
    codigo_normalizado = upper(btrim(codigo_normalizado)) and codigo_normalizado ~ '^[A-Z0-9_-]+$'
  ),
  descripcion_interna text not null default '' check (char_length(descripcion_interna) <= 500),
  activo boolean not null default true,
  inicia_en timestamptz,
  vence_en timestamptz,
  tipo_descuento public.tipo_descuento_cupon not null,
  porcentaje_puntos_base integer,
  importe_fijo_centavos bigint,
  compra_minima_centavos bigint not null default 0 check (compra_minima_centavos >= 0),
  descuento_maximo_centavos bigint check (descuento_maximo_centavos is null or descuento_maximo_centavos > 0),
  limite_usos_total integer check (limite_usos_total is null or limite_usos_total > 0),
  limite_usos_comprador integer check (limite_usos_comprador is null or limite_usos_comprador > 0),
  alcance public.alcance_cupon not null default 'todos',
  aplica_tipo_pedido public.aplicacion_tipo_pedido_cupon not null default 'automatico',
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cupon_vigencia_coherente check (vence_en is null or inicia_en is null or vence_en > inicia_en),
  constraint cupon_valor_coherente check (
    (tipo_descuento = 'porcentaje' and porcentaje_puntos_base between 1 and 10000 and importe_fijo_centavos is null)
    or (tipo_descuento = 'fijo' and importe_fijo_centavos > 0 and porcentaje_puntos_base is null and descuento_maximo_centavos is null)
  )
);

create table if not exists public.cupon_categorias (
  cupon_id uuid not null references public.cupones(id) on delete cascade,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  primary key (cupon_id, categoria_id)
);
create table if not exists public.cupon_productos (
  cupon_id uuid not null references public.cupones(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  primary key (cupon_id, producto_id)
);
create table if not exists public.cupon_productos_excluidos (
  cupon_id uuid not null references public.cupones(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  primary key (cupon_id, producto_id)
);

create table if not exists public.pedido_cupones (
  pedido_id uuid primary key references public.pedidos(id) on delete restrict,
  cupon_id uuid references public.cupones(id) on delete set null,
  codigo_snapshot text not null,
  regla_snapshot jsonb not null check (jsonb_typeof(regla_snapshot) = 'object'),
  descuento_centavos bigint not null check (descuento_centavos > 0),
  confirmado boolean not null default false,
  creado_en timestamptz not null default now(),
  confirmado_en timestamptz
);

create table if not exists public.cupon_reservas (
  id uuid primary key default gen_random_uuid(),
  cupon_id uuid not null references public.cupones(id) on delete restrict,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  comprador_hash bytea not null check (octet_length(comprador_hash) = 32),
  descuento_centavos bigint not null check (descuento_centavos > 0),
  estado public.estado_reserva_cupon not null default 'reservada',
  clave_idempotencia text not null unique check (char_length(clave_idempotencia) between 16 and 160),
  vence_en timestamptz not null,
  creado_en timestamptz not null default now(),
  finalizada_en timestamptz
);

create table if not exists public.cupon_usos (
  id uuid primary key default gen_random_uuid(),
  cupon_id uuid not null references public.cupones(id) on delete restrict,
  pedido_id uuid not null unique references public.pedidos(id) on delete restrict,
  reserva_id uuid not null unique references public.cupon_reservas(id) on delete restrict,
  comprador_hash bytea not null check (octet_length(comprador_hash) = 32),
  descuento_centavos bigint not null check (descuento_centavos > 0),
  confirmado_en timestamptz not null default now()
);

create table if not exists public.historial_cupones (
  id bigint generated always as identity primary key,
  cupon_id uuid not null references public.cupones(id) on delete restrict,
  accion text not null check (char_length(accion) between 2 and 100),
  usuario_id uuid references auth.users(id) on delete set null,
  datos jsonb not null default '{}'::jsonb check (jsonb_typeof(datos) = 'object'),
  clave_deduplicacion text unique,
  creado_en timestamptz not null default now()
);

alter table public.movimientos_stock
  add column if not exists pedido_id uuid references public.pedidos(id) on delete set null,
  add column if not exists reserva_id uuid references public.reservas_stock(id) on delete set null,
  add column if not exists clave_idempotencia text;

create unique index if not exists reservas_stock_item_activa_idx on public.reservas_stock (pedido_item_id) where estado = 'activa';
create index if not exists reservas_stock_vencimiento_idx on public.reservas_stock (vence_en, id) where estado = 'activa';
create index if not exists reservas_stock_disponible_idx on public.reservas_stock (producto_id, variante_id, vence_en) where estado = 'activa';
create unique index if not exists movimientos_stock_idempotencia_idx on public.movimientos_stock (clave_idempotencia) where clave_idempotencia is not null;
create index if not exists pedidos_fecha_idx on public.pedidos (creado_en desc, id);
create index if not exists pedidos_estados_idx on public.pedidos (estado_comercial, estado_financiero, estado_preparacion, estado_entrega);
create index if not exists pedidos_cliente_correo_idx on public.pedidos (lower(cliente_correo));
create index if not exists pedidos_cliente_whatsapp_idx on public.pedidos (cliente_whatsapp);
create index if not exists pedido_items_pedido_idx on public.pedido_items (pedido_id, creado_en);
create index if not exists pagos_pedido_fecha_idx on public.pagos (pedido_id, creado_en desc);
create index if not exists pagos_pendientes_idx on public.pagos (actualizado_en, id) where estado in ('creado', 'pendiente');
create index if not exists reembolsos_pedido_idx on public.reembolsos (pedido_id, creado_en desc);
create index if not exists historial_pedidos_fecha_idx on public.historial_pedidos (pedido_id, creado_en, id);
create index if not exists tokens_pedido_idx on public.tokens_consulta_pedido (pedido_id, creado_en desc);
create index if not exists outbox_pendiente_idx on public.notificaciones_outbox (proximo_intento_en, id) where estado in ('pendiente', 'error');
create index if not exists cupones_vigencia_idx on public.cupones (activo, inicia_en, vence_en);
create index if not exists cupon_reservas_limite_idx on public.cupon_reservas (cupon_id, estado, vence_en);
create index if not exists cupon_reservas_comprador_idx on public.cupon_reservas (cupon_id, comprador_hash, estado, vence_en);
create unique index if not exists cupon_reserva_pedido_activa_idx on public.cupon_reservas (pedido_id) where estado = 'reservada';
create index if not exists cupon_usos_metricas_idx on public.cupon_usos (cupon_id, confirmado_en desc);

drop trigger if exists actualizar_pedidos on public.pedidos;
create trigger actualizar_pedidos before update on public.pedidos
for each row execute function public.actualizar_fecha_modificacion();
drop trigger if exists actualizar_pagos on public.pagos;
create trigger actualizar_pagos before update on public.pagos
for each row execute function public.actualizar_fecha_modificacion();
drop trigger if exists actualizar_cupones on public.cupones;
create trigger actualizar_cupones before update on public.cupones
for each row execute function public.actualizar_fecha_modificacion();

create or replace function public.validar_item_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tipo public.tipo_pedido; automatico_habilitado boolean;
begin
  select p.tipo into tipo from public.pedidos p where p.id = new.pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if new.variante_id is not null and not exists (
    select 1 from public.variantes v where v.id = new.variante_id and v.producto_id = new.producto_id
  ) then raise exception 'La variante no pertenece al producto del artículo.'; end if;
  if tipo = 'automatico' then
    select compra_automatica_habilitada into automatico_habilitado
      from public.productos where id = new.producto_id;
    if not coalesce(automatico_habilitado, false) or not new.compra_automatica or new.requiere_personalizacion then
      raise exception 'Todos los artículos de una compra automática deben estar habilitados y no requerir personalización.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validar_item on public.pedido_items;
create trigger validar_item before insert on public.pedido_items
for each row execute function public.validar_item_pedido();

create or replace function public.validar_totales_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cobrado bigint;
begin
  if tg_op = 'UPDATE' then
    select coalesce(sum(importe_centavos), 0) into cobrado from public.pagos
      where pedido_id = new.id and estado = 'aprobado';
    if new.total_centavos < cobrado then
      raise exception 'El total del pedido no puede quedar por debajo de lo cobrado.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validar_totales on public.pedidos;
create trigger validar_totales before update of subtotal_centavos, descuento_centavos, envio_centavos, total_centavos, anticipo_objetivo_centavos
on public.pedidos for each row execute function public.validar_totales_pedido();

create or replace function public.impedir_mutacion_auditoria()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Los registros de auditoría son inmutables.';
end;
$$;
drop trigger if exists historial_pedidos_inmutable on public.historial_pedidos;
create trigger historial_pedidos_inmutable before update or delete on public.historial_pedidos
for each row execute function public.impedir_mutacion_auditoria();
drop trigger if exists cupon_usos_inmutable on public.cupon_usos;
create trigger cupon_usos_inmutable before update or delete on public.cupon_usos
for each row execute function public.impedir_mutacion_auditoria();
drop trigger if exists historial_cupones_inmutable on public.historial_cupones;
create trigger historial_cupones_inmutable before update or delete on public.historial_cupones
for each row execute function public.impedir_mutacion_auditoria();
drop trigger if exists pedido_items_inmutables on public.pedido_items;
create trigger pedido_items_inmutables before update or delete on public.pedido_items
for each row execute function public.impedir_mutacion_auditoria();
drop trigger if exists pedidos_no_borrables on public.pedidos;
create trigger pedidos_no_borrables before delete on public.pedidos
for each row execute function public.impedir_mutacion_auditoria();

create or replace function public.estado_financiero_calculado(p_pedido_id uuid)
returns public.estado_financiero_pedido
language plpgsql stable security definer set search_path = '' as $$
declare
  total bigint;
  anticipo bigint;
  cobrado bigint;
  devuelto bigint;
  pendientes integer;
  incidencias integer;
begin
  select p.total_centavos, p.anticipo_objetivo_centavos into total, anticipo
  from public.pedidos p where p.id = p_pedido_id;
  if not found then raise exception 'El pedido no existe.'; end if;
  select coalesce(sum(importe_centavos) filter (where estado = 'aprobado'), 0),
    count(*) filter (where estado in ('creado', 'pendiente')),
    count(*) filter (where estado = 'incidencia')
  into cobrado, pendientes, incidencias
  from public.pagos where pedido_id = p_pedido_id;
  select coalesce(sum(importe_centavos) filter (where estado = 'aprobado'), 0)
  into devuelto from public.reembolsos where pedido_id = p_pedido_id;
  if incidencias > 0 then return 'incidencia'; end if;
  if devuelto > 0 and greatest(cobrado - devuelto, 0) = 0 then return 'reembolsado'; end if;
  if devuelto > 0 then return 'parcialmente_reembolsado'; end if;
  if total > 0 and cobrado >= total then return 'pagado'; end if;
  if anticipo > 0 and cobrado >= anticipo then return 'anticipo_pagado'; end if;
  if cobrado > 0 then return 'anticipo_pagado'; end if;
  if pendientes > 0 then return 'pendiente'; end if;
  return 'sin_cobro';
end;
$$;

create or replace function public.validar_estado_financiero_derivado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare esperado public.estado_financiero_pedido;
begin
  if tg_op = 'INSERT' then
    if new.estado_financiero <> 'sin_cobro' then
      raise exception 'El estado financiero inicial debe ser sin_cobro.';
    end if;
    return new;
  end if;
  esperado := public.estado_financiero_calculado(new.id);
  if new.estado_financiero <> esperado then
    raise exception 'El estado financiero se deriva de pagos y reembolsos; esperado: %.', esperado;
  end if;
  return new;
end;
$$;
drop trigger if exists estado_financiero_derivado on public.pedidos;
create trigger estado_financiero_derivado before insert or update of estado_financiero on public.pedidos
for each row execute function public.validar_estado_financiero_derivado();

create or replace function public.recalcular_estado_financiero(p_pedido_id uuid)
returns public.estado_financiero_pedido
language plpgsql security definer set search_path = '' as $$
declare calculado public.estado_financiero_pedido;
begin
  calculado := public.estado_financiero_calculado(p_pedido_id);
  update public.pedidos set estado_financiero = calculado
  where id = p_pedido_id and estado_financiero is distinct from calculado;
  return calculado;
end;
$$;

create or replace function public.validar_pago_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; ya_cobrado bigint;
begin
  select * into p from public.pedidos where id = new.pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if p.requiere_envio and not p.envio_definido then
    raise exception 'El envío debe estar definido antes de crear un pago.';
  end if;
  if new.moneda <> p.moneda then raise exception 'La moneda del pago no coincide con el pedido.'; end if;
  if new.estado = 'aprobado' then
    if new.metodo = 'transferencia' and new.usuario_verificador_id is null then
      raise exception 'Una transferencia aprobada requiere administradora verificadora.';
    end if;
    select coalesce(sum(importe_centavos), 0) into ya_cobrado from public.pagos
    where pedido_id = new.pedido_id and estado = 'aprobado' and id <> new.id;
    if ya_cobrado + new.importe_centavos > p.total_centavos then
      raise exception 'Los pagos aprobados no pueden superar el total del pedido.';
    end if;
  end if;
  if new.metodo = 'transferencia' and p.tipo = 'automatico' and not coalesce((
    select (valor #>> '{}')::boolean from public.configuraciones_sitio
    where clave = 'transferencias_checkout_habilitadas'
  ), false) then raise exception 'La transferencia no está habilitada en el checkout automático.'; end if;
  if tg_op = 'UPDATE' and old.estado = 'aprobado' and (
    new.pedido_id <> old.pedido_id or new.metodo <> old.metodo or new.tipo <> old.tipo
    or new.importe_centavos <> old.importe_centavos or new.moneda <> old.moneda
    or new.origen_verificacion <> old.origen_verificacion
  ) then raise exception 'Los datos económicos de un pago aprobado son inmutables.'; end if;
  if tg_op = 'UPDATE' and old.estado = 'aprobado' and new.estado <> 'aprobado' then
    raise exception 'Un pago aprobado no puede retroceder de estado.';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_pago on public.pagos;
create trigger validar_pago before insert or update on public.pagos
for each row execute function public.validar_pago_pedido();

create or replace function public.validar_reembolso_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cobrado bigint; devuelto bigint;
begin
  perform 1 from public.pedidos where id = new.pedido_id for update;
  select coalesce(sum(importe_centavos), 0) into cobrado from public.pagos
    where pedido_id = new.pedido_id and estado = 'aprobado';
  select coalesce(sum(importe_centavos), 0) into devuelto from public.reembolsos
    where pedido_id = new.pedido_id and estado = 'aprobado' and id <> new.id;
  if new.estado = 'aprobado' and devuelto + new.importe_centavos > cobrado then
    raise exception 'Los reembolsos aprobados no pueden superar lo cobrado.';
  end if;
  if new.pago_id is not null and not exists (
    select 1 from public.pagos where id = new.pago_id and pedido_id = new.pedido_id and estado = 'aprobado'
  ) then raise exception 'El pago a reembolsar no es válido.'; end if;
  if tg_op = 'UPDATE' and old.estado = 'aprobado' and (
    new.pedido_id <> old.pedido_id or new.pago_id is distinct from old.pago_id
    or new.importe_centavos <> old.importe_centavos or new.moneda <> old.moneda
  ) then raise exception 'Los datos económicos de un reembolso aprobado son inmutables.'; end if;
  if tg_op = 'UPDATE' and old.estado = 'aprobado' and new.estado <> 'aprobado' then
    raise exception 'Un reembolso aprobado no puede retroceder de estado.';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_reembolso on public.reembolsos;
create trigger validar_reembolso before insert or update on public.reembolsos
for each row execute function public.validar_reembolso_pedido();

create or replace function public.sincronizar_finanzas_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_estado_financiero(coalesce(new.pedido_id, old.pedido_id));
  return coalesce(new, old);
end;
$$;
drop trigger if exists sincronizar_pago_pedido on public.pagos;
create trigger sincronizar_pago_pedido after insert or update of estado on public.pagos
for each row execute function public.sincronizar_finanzas_pedido();
drop trigger if exists sincronizar_reembolso_pedido on public.reembolsos;
create trigger sincronizar_reembolso_pedido after insert or update of estado on public.reembolsos
for each row execute function public.sincronizar_finanzas_pedido();

create or replace function public.impedir_borrado_financiero()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Los registros financieros no se borran.'; end;
$$;
drop trigger if exists pagos_no_borrables on public.pagos;
create trigger pagos_no_borrables before delete on public.pagos for each row execute function public.impedir_borrado_financiero();
drop trigger if exists reembolsos_no_borrables on public.reembolsos;
create trigger reembolsos_no_borrables before delete on public.reembolsos for each row execute function public.impedir_borrado_financiero();

create or replace function public.reservar_stock_pedido(
  p_pedido_id uuid, p_clave_idempotencia text, p_duracion_minutos integer default 20
)
returns setof public.reservas_stock
language plpgsql security definer set search_path = '' as $$
declare item record; stock_total integer; reservado integer;
begin
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 160 then
    raise exception 'La clave de idempotencia no es válida.';
  end if;
  if p_duracion_minutos not between 1 and 60 then raise exception 'La duración de la reserva no es válida.'; end if;
  if exists (select 1 from public.reservas_stock where pedido_id = p_pedido_id and clave_idempotencia = p_clave_idempotencia) then
    return query select * from public.reservas_stock
      where pedido_id = p_pedido_id and clave_idempotencia = p_clave_idempotencia order by creado_en, id;
    return;
  end if;
  perform 1 from public.pedidos where id = p_pedido_id and tipo = 'automatico'
    and estado_comercial not in ('cancelado', 'finalizado') for update;
  if not found then raise exception 'El pedido no admite una reserva automática.'; end if;
  for item in select * from public.pedido_items
    where pedido_id = p_pedido_id and requiere_reserva_stock order by id
  loop
    if item.producto_id is null then raise exception 'El producto del pedido ya no existe.'; end if;
    update public.reservas_stock set estado = 'vencida', liberada_en = now()
      where pedido_item_id = item.id and estado = 'activa' and vence_en <= now();
    if item.variante_id is not null then
      select v.stock into stock_total from public.variantes v
      join public.productos p on p.id = v.producto_id
      where v.id = item.variante_id and v.producto_id = item.producto_id and p.controla_stock
      for update of v;
    else
      select p.stock into stock_total from public.productos p
      where p.id = item.producto_id and p.controla_stock for update;
    end if;
    if stock_total is null then raise exception 'El artículo no tiene stock automático configurable.'; end if;
    select coalesce(sum(r.cantidad), 0)::integer into reservado from public.reservas_stock r
      where r.producto_id = item.producto_id and r.variante_id is not distinct from item.variante_id
        and r.estado = 'activa' and r.vence_en > now();
    if stock_total - reservado < item.cantidad then raise exception 'No hay stock suficiente para completar la reserva.'; end if;
    insert into public.reservas_stock(
      pedido_id, pedido_item_id, producto_id, variante_id, cantidad, clave_idempotencia, vence_en
    ) values (
      p_pedido_id, item.id, item.producto_id, item.variante_id, item.cantidad,
      p_clave_idempotencia, now() + make_interval(mins => p_duracion_minutos)
    );
  end loop;
  if not found then raise exception 'El pedido no contiene artículos que requieran reserva.'; end if;
  insert into public.historial_pedidos(pedido_id, evento, clave_deduplicacion, metadatos)
  values (p_pedido_id, 'stock_reservado', 'stock_reservado:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia),
    jsonb_build_object('duracion_minutos', p_duracion_minutos)) on conflict (clave_deduplicacion) do nothing;
  return query select * from public.reservas_stock
    where pedido_id = p_pedido_id and clave_idempotencia = p_clave_idempotencia order by creado_en, id;
end;
$$;

create or replace function public.consumir_reservas_stock(p_pedido_id uuid, p_clave_idempotencia text)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.reservas_stock; antes integer; despues integer; consumidas integer := 0; clave_movimiento text;
begin
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 160 then
    raise exception 'La clave de idempotencia no es válida.';
  end if;
  if exists (select 1 from public.historial_pedidos
    where clave_deduplicacion = 'stock_consumido:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia)) then
    return 0;
  end if;
  perform 1 from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  for r in select * from public.reservas_stock
    where pedido_id = p_pedido_id and estado = 'activa' order by id for update
  loop
    if r.vence_en <= now() then raise exception 'La reserva de stock está vencida.'; end if;
    if r.variante_id is not null then
      update public.variantes set stock = stock - r.cantidad
      where id = r.variante_id and stock >= r.cantidad
      returning stock + r.cantidad, stock into antes, despues;
    else
      update public.productos set stock = stock - r.cantidad
      where id = r.producto_id and stock >= r.cantidad
      returning stock + r.cantidad, stock into antes, despues;
    end if;
    if antes is null then raise exception 'El stock cambió y ya no alcanza para el pedido.'; end if;
    update public.reservas_stock set estado = 'consumida', consumida_en = now() where id = r.id;
    clave_movimiento := p_clave_idempotencia || ':' || r.id::text;
    insert into public.movimientos_stock(
      producto_id, variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo,
      pedido_id, reserva_id, clave_idempotencia
    ) values (
      r.producto_id, r.variante_id, 'salida', r.cantidad, antes, despues,
      'Consumo de reserva de pedido', p_pedido_id, r.id, clave_movimiento
    ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing;
    consumidas := consumidas + 1;
  end loop;
  if consumidas = 0 then raise exception 'El pedido no tiene reservas activas.'; end if;
  insert into public.historial_pedidos(pedido_id, evento, clave_deduplicacion, metadatos)
  values (p_pedido_id, 'stock_consumido', 'stock_consumido:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia),
    jsonb_build_object('reservas', consumidas)) on conflict (clave_deduplicacion) do nothing;
  return consumidas;
end;
$$;

create or replace function public.vencer_reservas_pedidos(p_limite integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare cantidad integer; reserva_cupon public.cupon_reservas;
begin
  if p_limite not between 1 and 500 then raise exception 'El límite no es válido.'; end if;
  with candidatas as (
    select r.id from public.reservas_stock r where r.estado = 'activa' and r.vence_en <= now()
      and not exists (select 1 from public.pagos p where p.pedido_id = r.pedido_id and p.estado = 'aprobado')
    order by vence_en, id limit p_limite for update skip locked
  ), actualizadas as (
    update public.reservas_stock r set estado = 'vencida', liberada_en = now()
    from candidatas c where r.id = c.id returning r.id
  ) select count(*)::integer into cantidad from actualizadas;
  for reserva_cupon in
    select r.* from public.cupon_reservas r where r.estado = 'reservada' and r.vence_en <= now()
      and not exists (select 1 from public.pagos p where p.pedido_id = r.pedido_id and p.estado = 'aprobado')
    order by vence_en, id limit p_limite for update skip locked
  loop
    update public.cupon_reservas set estado = 'vencida', finalizada_en = now() where id = reserva_cupon.id;
    delete from public.pedido_cupones where pedido_id = reserva_cupon.pedido_id and not confirmado;
    update public.pedidos set descuento_centavos = 0,
      total_centavos = subtotal_centavos + envio_centavos
    where id = reserva_cupon.pedido_id
      and not exists (select 1 from public.pagos where pedido_id = reserva_cupon.pedido_id and estado = 'aprobado');
    insert into public.historial_pedidos(pedido_id, evento, clave_deduplicacion, metadatos)
    values (reserva_cupon.pedido_id, 'cupon_vencido', 'cupon_vencido:' || reserva_cupon.id::text,
      jsonb_build_object('reserva_id', reserva_cupon.id, 'cupon_id', reserva_cupon.cupon_id))
    on conflict (clave_deduplicacion) do nothing;
  end loop;
  return cantidad;
end;
$$;

create or replace function public.reservar_cupon_pedido(
  p_pedido_id uuid, p_codigo text, p_comprador_hash bytea,
  p_clave_idempotencia text, p_duracion_minutos integer default 20
)
returns public.cupon_reservas
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; c public.cupones; elegible bigint; descuento bigint;
  confirmados integer; reservados integer; usados_comprador integer; resultado public.cupon_reservas;
begin
  if octet_length(p_comprador_hash) <> 32 then raise exception 'La identidad del comprador no es válida.'; end if;
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 160 then raise exception 'La clave de idempotencia no es válida.'; end if;
  if p_duracion_minutos not between 1 and 60 then raise exception 'La duración de la reserva no es válida.'; end if;
  select * into resultado from public.cupon_reservas where clave_idempotencia = p_clave_idempotencia;
  if found then
    if resultado.pedido_id <> p_pedido_id or resultado.comprador_hash <> p_comprador_hash then
      raise exception 'La clave de idempotencia ya fue usada con otros datos.';
    end if;
    return resultado;
  end if;
  select * into p from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if p.estado_comercial in ('cancelado', 'finalizado') then raise exception 'El pedido no admite cupones.'; end if;
  if exists (select 1 from public.pedido_cupones where pedido_id = p_pedido_id and confirmado) then
    raise exception 'El pedido ya tiene un cupón confirmado.';
  end if;
  update public.cupon_reservas set estado = 'vencida', finalizada_en = now()
    where pedido_id = p_pedido_id and estado = 'reservada' and vence_en <= now();
  if exists (select 1 from public.cupon_reservas where pedido_id = p_pedido_id and estado = 'reservada') then
    raise exception 'El pedido ya tiene un cupón reservado.';
  end if;
  select * into c from public.cupones where codigo_normalizado = upper(btrim(p_codigo)) for update;
  if not found or not c.activo or (c.inicia_en is not null and c.inicia_en > now())
    or (c.vence_en is not null and c.vence_en <= now()) then raise exception 'El cupón no está disponible.'; end if;
  if c.aplica_tipo_pedido <> 'ambos' and c.aplica_tipo_pedido::text <> p.tipo::text then
    raise exception 'El cupón no aplica a este tipo de pedido.';
  end if;
  if p.subtotal_centavos < c.compra_minima_centavos then raise exception 'El pedido no alcanza la compra mínima del cupón.'; end if;
  select count(*)::integer into confirmados from public.cupon_usos where cupon_id = c.id;
  select count(*)::integer into reservados from public.cupon_reservas
    where cupon_id = c.id and estado = 'reservada' and vence_en > now();
  if c.limite_usos_total is not null and confirmados + reservados >= c.limite_usos_total then
    raise exception 'El cupón ya no tiene usos disponibles.';
  end if;
  select count(*)::integer into usados_comprador from (
    select 1 from public.cupon_usos where cupon_id = c.id and comprador_hash = p_comprador_hash
    union all
    select 1 from public.cupon_reservas where cupon_id = c.id and comprador_hash = p_comprador_hash
      and estado = 'reservada' and vence_en > now()
  ) usos;
  if c.limite_usos_comprador is not null and usados_comprador >= c.limite_usos_comprador then
    raise exception 'El comprador alcanzó el límite de usos del cupón.';
  end if;
  select coalesce(sum(i.subtotal_centavos), 0) into elegible
  from public.pedido_items i
  where i.pedido_id = p_pedido_id
    and not exists (select 1 from public.cupon_productos_excluidos x where x.cupon_id = c.id and x.producto_id = i.producto_id)
    and (
      c.alcance = 'todos'
      or (c.alcance = 'categorias' and exists (select 1 from public.cupon_categorias cc where cc.cupon_id = c.id and cc.categoria_id = i.categoria_id))
      or (c.alcance = 'productos' and exists (select 1 from public.cupon_productos cp where cp.cupon_id = c.id and cp.producto_id = i.producto_id))
    );
  if elegible <= 0 then raise exception 'El cupón no aplica a los artículos del pedido.'; end if;
  if c.tipo_descuento = 'fijo' then descuento := least(c.importe_fijo_centavos, elegible);
  else
    descuento := floor(elegible * c.porcentaje_puntos_base / 10000.0)::bigint;
    if c.descuento_maximo_centavos is not null then descuento := least(descuento, c.descuento_maximo_centavos); end if;
  end if;
  descuento := least(descuento, p.subtotal_centavos);
  if descuento <= 0 then raise exception 'El descuento calculado no es válido.'; end if;
  insert into public.cupon_reservas(cupon_id, pedido_id, comprador_hash, descuento_centavos, clave_idempotencia, vence_en)
  values (c.id, p_pedido_id, p_comprador_hash, descuento, p_clave_idempotencia,
    now() + make_interval(mins => p_duracion_minutos)) returning * into resultado;
  insert into public.pedido_cupones(pedido_id, cupon_id, codigo_snapshot, regla_snapshot, descuento_centavos)
  values (p_pedido_id, c.id, c.codigo_normalizado,
    jsonb_build_object('tipo', c.tipo_descuento, 'porcentaje_puntos_base', c.porcentaje_puntos_base,
      'importe_fijo_centavos', c.importe_fijo_centavos, 'descuento_maximo_centavos', c.descuento_maximo_centavos,
      'compra_minima_centavos', c.compra_minima_centavos, 'alcance', c.alcance,
      'aplica_tipo_pedido', c.aplica_tipo_pedido), descuento)
  on conflict (pedido_id) do update set cupon_id = excluded.cupon_id, codigo_snapshot = excluded.codigo_snapshot,
    regla_snapshot = excluded.regla_snapshot, descuento_centavos = excluded.descuento_centavos,
    confirmado = false, confirmado_en = null, creado_en = now();
  update public.pedidos set descuento_centavos = descuento,
    total_centavos = subtotal_centavos - descuento + envio_centavos where id = p_pedido_id;
  return resultado;
end;
$$;

create or replace function public.confirmar_cupon_pedido(p_pedido_id uuid, p_clave_idempotencia text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.cupon_reservas; uso_id uuid;
begin
  select id into uso_id from public.cupon_usos where pedido_id = p_pedido_id;
  if found then return uso_id; end if;
  select * into r from public.cupon_reservas where pedido_id = p_pedido_id and estado = 'reservada' for update;
  if not found or r.vence_en <= now() then raise exception 'No existe una reserva de cupón vigente.'; end if;
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 160 then raise exception 'La clave de idempotencia no es válida.'; end if;
  update public.cupon_reservas set estado = 'confirmada', finalizada_en = now() where id = r.id;
  insert into public.cupon_usos(cupon_id, pedido_id, reserva_id, comprador_hash, descuento_centavos)
  values (r.cupon_id, r.pedido_id, r.id, r.comprador_hash, r.descuento_centavos)
  returning id into uso_id;
  update public.pedido_cupones set confirmado = true, confirmado_en = now() where pedido_id = p_pedido_id;
  insert into public.historial_pedidos(pedido_id, evento, clave_deduplicacion, metadatos)
  values (p_pedido_id, 'cupon_confirmado', 'cupon_confirmado:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia),
    jsonb_build_object('cupon_id', r.cupon_id, 'descuento_centavos', r.descuento_centavos))
  on conflict (clave_deduplicacion) do nothing;
  return uso_id;
end;
$$;

create or replace function public.liberar_cupon_pedido(p_pedido_id uuid, p_clave_idempotencia text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.cupon_reservas;
begin
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 160 then
    raise exception 'La clave de idempotencia no es válida.';
  end if;
  if exists (select 1 from public.historial_pedidos
    where clave_deduplicacion = 'cupon_liberado:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia)) then
    return false;
  end if;
  perform 1 from public.pedidos where id = p_pedido_id for update;
  if exists (select 1 from public.pagos where pedido_id = p_pedido_id and estado = 'aprobado') then
    raise exception 'No se puede liberar un cupón después de registrar un pago aprobado.';
  end if;
  select * into r from public.cupon_reservas where pedido_id = p_pedido_id and estado = 'reservada' for update;
  if not found then return false; end if;
  update public.cupon_reservas set estado = 'liberada', finalizada_en = now() where id = r.id;
  delete from public.pedido_cupones where pedido_id = p_pedido_id and not confirmado;
  update public.pedidos set descuento_centavos = 0, total_centavos = subtotal_centavos + envio_centavos
    where id = p_pedido_id;
  insert into public.historial_pedidos(pedido_id, evento, clave_deduplicacion, metadatos)
  values (p_pedido_id, 'cupon_liberado', 'cupon_liberado:' || p_pedido_id::text || ':' || md5(p_clave_idempotencia),
    jsonb_build_object('reserva_id', r.id, 'cupon_id', r.cupon_id))
  on conflict (clave_deduplicacion) do nothing;
  return true;
end;
$$;

create or replace function public.marcar_transferencia_pago_aprobado(
  p_pedido_id uuid, p_importe_centavos bigint, p_tipo public.tipo_pago_pedido,
  p_usuario_id uuid, p_clave_idempotencia text, p_referencia text default null, p_nota text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pago_id uuid; correo text; tipo_actual public.tipo_pedido;
begin
  select id into pago_id from public.pagos where clave_idempotencia = p_clave_idempotencia
    and pedido_id = p_pedido_id and importe_centavos = p_importe_centavos and tipo = p_tipo
    and metodo = 'transferencia';
  if found then return pago_id; end if;
  if exists (select 1 from public.pagos where clave_idempotencia = p_clave_idempotencia) then
    raise exception 'La clave de idempotencia ya fue usada con otros datos.';
  end if;
  if not public.es_administrador(p_usuario_id) then raise exception 'No tenés permisos para aprobar transferencias.'; end if;
  select cliente_correo, tipo into correo, tipo_actual from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if tipo_actual <> 'coordinado' then raise exception 'Las transferencias manuales corresponden solamente a pedidos coordinados.'; end if;
  insert into public.pagos(pedido_id, metodo, tipo, estado, importe_centavos, origen_verificacion,
    clave_idempotencia, usuario_verificador_id, referencia, nota, aprobado_en)
  values (p_pedido_id, 'transferencia', p_tipo, 'aprobado', p_importe_centavos, 'administracion',
    p_clave_idempotencia, p_usuario_id, p_referencia, p_nota, now()) returning id into pago_id;
  insert into public.transferencias_pago(pago_id, comprobante_referencia, recibido_en)
  values (pago_id, p_referencia, now());
  insert into public.historial_pedidos(pedido_id, evento, actor, usuario_id, nota, clave_deduplicacion, metadatos)
  values (p_pedido_id, 'pago_aprobado', 'administracion', p_usuario_id, p_nota,
    'pago_aprobado:' || p_clave_idempotencia,
    jsonb_build_object('pago_id', pago_id, 'metodo', 'transferencia', 'importe_centavos', p_importe_centavos, 'tipo', p_tipo));
  insert into public.notificaciones_outbox(pedido_id, evento, destinatario, plantilla, datos, clave_deduplicacion)
  values (p_pedido_id, 'pago_aprobado', correo, 'pago_aprobado',
    jsonb_build_object('pedido_id', p_pedido_id, 'pago_id', pago_id), 'correo:pago_aprobado:' || pago_id);
  return pago_id;
end;
$$;

insert into public.configuraciones_sitio(clave, valor, descripcion, publica) values
  ('transferencias_checkout_habilitadas', 'false'::jsonb, 'Feature flag del checkout; no afecta transferencias coordinadas del dashboard.', false),
  ('mercado_pago_checkout_habilitado', 'false'::jsonb, 'Se habilitará únicamente durante la integración de pruebas.', false),
  ('correos_transaccionales_habilitados', 'false'::jsonb, 'Se habilitará después de configurar Resend en pruebas.', false),
  ('reserva_stock_minutos', '20'::jsonb, 'Duración de la reserva de stock para compra automática.', false)
on conflict (clave) do nothing;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'pedidos','pedido_items','reservas_stock','pagos','transferencias_pago','eventos_pago','reembolsos',
    'historial_pedidos','tokens_consulta_pedido','notificaciones_outbox','cupones','cupon_categorias',
    'cupon_productos','cupon_productos_excluidos','pedido_cupones','cupon_reservas','cupon_usos','historial_cupones'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on table public.%I from public, anon, authenticated', tabla);
    execute format('grant all on table public.%I to service_role', tabla);
  end loop;
end;
$$;

-- Las secuencias de identity también deben permanecer fuera del alcance público.
revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.impedir_mutacion_auditoria() from public, anon, authenticated;
revoke all on function public.validar_item_pedido() from public, anon, authenticated;
revoke all on function public.validar_totales_pedido() from public, anon, authenticated;
revoke all on function public.estado_financiero_calculado(uuid) from public, anon, authenticated;
revoke all on function public.validar_estado_financiero_derivado() from public, anon, authenticated;
revoke all on function public.recalcular_estado_financiero(uuid) from public, anon, authenticated;
revoke all on function public.validar_pago_pedido() from public, anon, authenticated;
revoke all on function public.validar_reembolso_pedido() from public, anon, authenticated;
revoke all on function public.sincronizar_finanzas_pedido() from public, anon, authenticated;
revoke all on function public.impedir_borrado_financiero() from public, anon, authenticated;
revoke all on function public.reservar_stock_pedido(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.consumir_reservas_stock(uuid,text) from public, anon, authenticated;
revoke all on function public.vencer_reservas_pedidos(integer) from public, anon, authenticated;
revoke all on function public.reservar_cupon_pedido(uuid,text,bytea,text,integer) from public, anon, authenticated;
revoke all on function public.confirmar_cupon_pedido(uuid,text) from public, anon, authenticated;
revoke all on function public.liberar_cupon_pedido(uuid,text) from public, anon, authenticated;
revoke all on function public.marcar_transferencia_pago_aprobado(uuid,bigint,public.tipo_pago_pedido,uuid,text,text,text) from public, anon, authenticated;

grant execute on function public.estado_financiero_calculado(uuid) to service_role;
grant execute on function public.recalcular_estado_financiero(uuid) to service_role;
grant execute on function public.reservar_stock_pedido(uuid,text,integer) to service_role;
grant execute on function public.consumir_reservas_stock(uuid,text) to service_role;
grant execute on function public.vencer_reservas_pedidos(integer) to service_role;
grant execute on function public.reservar_cupon_pedido(uuid,text,bytea,text,integer) to service_role;
grant execute on function public.confirmar_cupon_pedido(uuid,text) to service_role;
grant execute on function public.liberar_cupon_pedido(uuid,text) to service_role;
grant execute on function public.marcar_transferencia_pago_aprobado(uuid,bigint,public.tipo_pago_pedido,uuid,text,text,text) to service_role;

comment on table public.pedido_items is 'Snapshots históricos: no deben reconstruirse desde el catálogo actual.';
comment on table public.eventos_pago is 'Metadatos mínimos del evento; no guarda payloads completos ni datos de tarjeta.';
comment on column public.tokens_consulta_pedido.token_hash is 'SHA-256 del token privado. El token sin hash nunca se persiste.';
comment on table public.notificaciones_outbox is 'Cola transaccional; un fallo de correo nunca cambia el resultado financiero.';

commit;

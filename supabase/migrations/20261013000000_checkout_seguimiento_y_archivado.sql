-- Etapa 3: cotización segura del carrito, mensajes de cupones y archivado de pedidos.
-- Aplicar primero en papeleria-de-sol-pruebas.

begin;

alter table public.pedidos
  add column if not exists archivado_en timestamptz,
  add column if not exists archivado_por uuid references auth.users(id) on delete set null;

create index if not exists pedidos_archivado_creado_idx
  on public.pedidos (archivado_en, creado_en desc);

create or replace function public.cotizar_solicitud_pedido(
  p_lineas jsonb,
  p_codigo_cupon text default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  linea jsonb;
  producto public.productos;
  variante public.variantes;
  cupon public.cupones;
  claves text[] := '{}';
  clave_linea text;
  codigo_cupon text := upper(btrim(coalesce(p_codigo_cupon, '')));
  cantidad integer;
  precio_centavos bigint;
  subtotal_linea bigint;
  subtotal bigint := 0;
  elegible bigint := 0;
  descuento bigint := 0;
  es_automatico boolean;
  todos_automaticos boolean := true;
  confirmados integer;
  reservados integer;
begin
  if jsonb_typeof(p_lineas) is distinct from 'array'
    or jsonb_array_length(p_lineas) not between 1 and 100 then
    raise exception 'La selección debe contener entre 1 y 100 artículos.';
  end if;
  if codigo_cupon <> '' and codigo_cupon !~ '^[A-Z0-9_-]{3,40}$' then
    raise exception 'El código de cupón no es válido.';
  end if;

  if codigo_cupon <> '' then
    select * into cupon from public.cupones c where c.codigo_normalizado = codigo_cupon;
    if not found or not cupon.activo
      or (cupon.inicia_en is not null and cupon.inicia_en > now())
      or (cupon.vence_en is not null and cupon.vence_en <= now()) then
      raise exception 'El cupón no está disponible o está fuera de vigencia.';
    end if;
    select count(*)::integer into confirmados from public.cupon_usos where cupon_id = cupon.id;
    select count(*)::integer into reservados from public.cupon_reservas
      where cupon_id = cupon.id and estado = 'reservada' and vence_en > now();
    if cupon.limite_usos_total is not null and confirmados + reservados >= cupon.limite_usos_total then
      raise exception 'El cupón ya no tiene usos disponibles.';
    end if;
  end if;

  for linea in select value from jsonb_array_elements(p_lineas)
  loop
    if jsonb_typeof(linea) is distinct from 'object' then
      raise exception 'Un artículo no tiene formato válido.';
    end if;
    begin
      producto.id := (linea->>'producto_id')::uuid;
      cantidad := (linea->>'cantidad')::integer;
    exception when others then
      raise exception 'Un artículo no tiene identificadores válidos.';
    end;
    if cantidad not between 1 and 100 then raise exception 'La cantidad solicitada no es válida.'; end if;
    clave_linea := producto.id::text || ':' || coalesce(nullif(linea->>'variante_id', ''), 'simple');
    if clave_linea = any(claves) then raise exception 'La selección contiene un artículo repetido.'; end if;
    claves := array_append(claves, clave_linea);

    select * into producto from public.productos p
      where p.id = producto.id and p.estado = 'publicado';
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    variante := null;
    if producto.usa_variantes then
      if nullif(linea->>'variante_id', '') is null then raise exception 'Falta elegir una variante del producto.'; end if;
      begin
        select * into variante from public.variantes v
          where v.id = (linea->>'variante_id')::uuid
            and v.producto_id = producto.id and v.estado = 'publicado';
      exception when others then
        raise exception 'La variante seleccionada no es válida.';
      end;
      if not found then raise exception 'La variante seleccionada ya no está disponible.'; end if;
      precio_centavos := round(variante.precio * 100)::bigint;
    else
      if nullif(linea->>'variante_id', '') is not null then raise exception 'El producto no utiliza variantes.'; end if;
      if producto.precio is null then raise exception 'Uno de los productos no tiene precio confirmado.'; end if;
      precio_centavos := round(producto.precio * 100)::bigint;
    end if;
    if precio_centavos < 0 then raise exception 'El precio vigente no es válido.'; end if;

    es_automatico := producto.compra_automatica_habilitada and not producto.requiere_personalizacion;
    if es_automatico and producto.controla_stock then
      if variante.id is not null then es_automatico := coalesce(variante.stock, 0) >= cantidad;
      else es_automatico := coalesce(producto.stock, 0) >= cantidad; end if;
    end if;
    todos_automaticos := todos_automaticos and es_automatico;
    subtotal_linea := precio_centavos * cantidad;
    subtotal := subtotal + subtotal_linea;

    if codigo_cupon <> ''
      and not exists (
        select 1 from public.cupon_productos_excluidos x
        where x.cupon_id = cupon.id and x.producto_id = producto.id
      )
      and (
        cupon.alcance = 'todos'
        or (cupon.alcance = 'categorias' and exists (
          select 1 from public.cupon_categorias cc
          where cc.cupon_id = cupon.id and cc.categoria_id = producto.categoria_id
        ))
        or (cupon.alcance = 'productos' and exists (
          select 1 from public.cupon_productos cp
          where cp.cupon_id = cupon.id and cp.producto_id = producto.id
        ))
      ) then
      elegible := elegible + subtotal_linea;
    end if;
  end loop;

  if codigo_cupon <> '' then
    if not todos_automaticos then
      raise exception 'Los cupones se aplican actualmente solamente a compras automáticas.';
    end if;
    if cupon.aplica_tipo_pedido not in ('automatico', 'ambos') then
      raise exception 'El cupón no aplica a este tipo de pedido.';
    end if;
    if subtotal < cupon.compra_minima_centavos then
      raise exception using message = format(
        'Este cupón requiere una compra mínima de $%s.',
        trim(to_char(cupon.compra_minima_centavos / 100.0, 'FM999999999990D00'))
      );
    end if;
    if elegible <= 0 then raise exception 'El cupón no aplica a los artículos seleccionados.'; end if;
    if cupon.tipo_descuento = 'fijo' then descuento := least(cupon.importe_fijo_centavos, elegible);
    else
      descuento := floor(elegible * cupon.porcentaje_puntos_base / 10000.0)::bigint;
      if cupon.descuento_maximo_centavos is not null then
        descuento := least(descuento, cupon.descuento_maximo_centavos);
      end if;
    end if;
    descuento := least(descuento, subtotal);
    if descuento <= 0 then raise exception 'El descuento calculado no es válido.'; end if;
  end if;

  return jsonb_build_object(
    'tipo', case when todos_automaticos then 'automatico' else 'coordinado' end,
    'subtotal_centavos', subtotal,
    'descuento_centavos', descuento,
    'total_centavos', subtotal - descuento,
    'codigo_cupon', nullif(codigo_cupon, '')
  );
end;
$$;

create or replace function public.archivar_pedido_administracion(
  p_pedido_id uuid,
  p_archivar boolean,
  p_usuario uuid
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare estaba_archivado boolean;
begin
  if not public.es_administrador(p_usuario) then
    raise exception 'No tenés permisos para archivar pedidos.';
  end if;
  select archivado_en is not null into estaba_archivado
    from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  update public.pedidos set
    archivado_en = case when p_archivar then coalesce(archivado_en, now()) else null end,
    archivado_por = case when p_archivar then p_usuario else null end
  where id = p_pedido_id;
  if estaba_archivado is distinct from p_archivar then
    insert into public.historial_pedidos(
      pedido_id, evento, actor, usuario_id, estado_anterior, estado_nuevo, clave_deduplicacion
    ) values (
      p_pedido_id, case when p_archivar then 'pedido_archivado' else 'pedido_reabierto' end,
      'administracion', p_usuario,
      jsonb_build_object('archivado', estaba_archivado),
      jsonb_build_object('archivado', p_archivar),
      'archivo:' || p_pedido_id::text || ':' || gen_random_uuid()::text
    );
  end if;
  return p_archivar;
end;
$$;

-- Conserva toda la lógica de reserva y mejora el error de compra mínima.
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
    or (c.vence_en is not null and c.vence_en <= now()) then raise exception 'El cupón no está disponible o está fuera de vigencia.'; end if;
  if c.aplica_tipo_pedido <> 'ambos' and c.aplica_tipo_pedido::text <> p.tipo::text then
    raise exception 'El cupón no aplica a este tipo de pedido.';
  end if;
  if p.subtotal_centavos < c.compra_minima_centavos then
    raise exception using message = format(
      'Este cupón requiere una compra mínima de $%s.',
      trim(to_char(c.compra_minima_centavos / 100.0, 'FM999999999990D00'))
    );
  end if;
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

revoke all on function public.cotizar_solicitud_pedido(jsonb,text) from public, anon, authenticated;
revoke all on function public.archivar_pedido_administracion(uuid,boolean,uuid) from public, anon, authenticated;
grant execute on function public.cotizar_solicitud_pedido(jsonb,text) to service_role;
grant execute on function public.archivar_pedido_administracion(uuid,boolean,uuid) to service_role;

comment on column public.pedidos.archivado_en is
  'Archivado administrativo reversible; no altera pagos, stock ni estados del pedido.';

commit;

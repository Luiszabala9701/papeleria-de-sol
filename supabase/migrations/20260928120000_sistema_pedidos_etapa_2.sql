-- Etapa 2: creación transaccional de solicitudes, rate limiting y gestión de cupones.
-- No integra Mercado Pago ni envía correos. Aplicar solamente en pruebas.

begin;
set constraints all immediate;

alter table public.pedidos
  add column if not exists solicitud_hash bytea check (solicitud_hash is null or octet_length(solicitud_hash) = 32);

create table if not exists public.limites_solicitudes (
  clave_hash bytea not null check (octet_length(clave_hash) = 32),
  accion text not null check (accion ~ '^[a-z_]{3,60}$'),
  ventana_inicia timestamptz not null default now(),
  cantidad integer not null default 1 check (cantidad > 0),
  actualizado_en timestamptz not null default now(),
  primary key (clave_hash, accion)
);

alter table public.limites_solicitudes enable row level security;
revoke all on table public.limites_solicitudes from public, anon, authenticated;
grant all on table public.limites_solicitudes to service_role;
create index if not exists limites_solicitudes_limpieza_idx on public.limites_solicitudes (actualizado_en);

create or replace function public.consumir_limite_solicitudes(
  p_clave_hash bytea, p_accion text, p_limite integer, p_ventana_segundos integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare registro public.limites_solicitudes;
begin
  if octet_length(p_clave_hash) <> 32 or p_accion !~ '^[a-z_]{3,60}$'
    or p_limite not between 1 and 1000 or p_ventana_segundos not between 10 and 86400 then
    raise exception 'La configuración del límite no es válida.';
  end if;
  insert into public.limites_solicitudes(clave_hash, accion)
  values (p_clave_hash, p_accion)
  on conflict (clave_hash, accion) do update set
    ventana_inicia = case
      when public.limites_solicitudes.ventana_inicia + make_interval(secs => p_ventana_segundos) <= now()
        then now() else public.limites_solicitudes.ventana_inicia end,
    cantidad = case
      when public.limites_solicitudes.ventana_inicia + make_interval(secs => p_ventana_segundos) <= now()
        then 1 else public.limites_solicitudes.cantidad + 1 end,
    actualizado_en = now()
  returning * into registro;
  return registro.cantidad <= p_limite;
end;
$$;

create or replace function public.crear_solicitud_pedido(
  p_lineas jsonb,
  p_cliente_nombre text,
  p_cliente_correo text,
  p_cliente_whatsapp text,
  p_observaciones text,
  p_codigo_cupon text,
  p_clave_idempotencia text,
  p_solicitud_hash bytea,
  p_comprador_hash bytea,
  p_token_hash bytea
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  linea jsonb;
  producto public.productos;
  variante public.variantes;
  pedido public.pedidos;
  item jsonb;
  items jsonb := '[]'::jsonb;
  claves text[] := '{}';
  clave_linea text;
  cantidad integer;
  precio_centavos bigint;
  subtotal bigint := 0;
  es_automatico boolean;
  todos_automaticos boolean := true;
  requiere_stock boolean;
  opciones jsonb;
  reserva_cupon public.cupon_reservas;
begin
  if jsonb_typeof(p_lineas) is distinct from 'array'
    or jsonb_array_length(p_lineas) not between 1 and 100 then
    raise exception 'La selección debe contener entre 1 y 100 artículos.';
  end if;
  if char_length(btrim(coalesce(p_cliente_nombre, ''))) not between 2 and 120
    or char_length(coalesce(p_cliente_correo, '')) not between 3 and 254
    or p_cliente_correo !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(coalesce(p_cliente_whatsapp, '')) not between 6 and 30
    or p_cliente_whatsapp !~ '^\+?[0-9 ()-]+$' then
    raise exception 'Los datos de contacto no son válidos.';
  end if;
  if p_observaciones is not null and char_length(p_observaciones) > 1000 then
    raise exception 'Las observaciones son demasiado extensas.';
  end if;
  if char_length(coalesce(p_clave_idempotencia, '')) not between 16 and 120
    or octet_length(p_solicitud_hash) <> 32 or octet_length(p_comprador_hash) <> 32
    or octet_length(p_token_hash) <> 32 then
    raise exception 'La solicitud no tiene identificadores seguros.';
  end if;

  select * into pedido from public.pedidos where clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if pedido.solicitud_hash is distinct from p_solicitud_hash then
      raise exception 'La clave de idempotencia ya fue usada con otros datos.';
    end if;
    return jsonb_build_object(
      'id', pedido.id, 'numero', pedido.numero, 'tipo', pedido.tipo,
      'subtotal_centavos', pedido.subtotal_centavos,
      'descuento_centavos', pedido.descuento_centavos,
      'total_centavos', pedido.total_centavos,
      'estado_comercial', pedido.estado_comercial,
      'estado_financiero', pedido.estado_financiero
    );
  end if;

  for linea in select value from jsonb_array_elements(p_lineas)
  loop
    if jsonb_typeof(linea) is distinct from 'object' then raise exception 'Un artículo no tiene formato válido.'; end if;
    begin
      producto.id := (linea->>'producto_id')::uuid;
      cantidad := (linea->>'cantidad')::integer;
    exception when others then raise exception 'Un artículo no tiene identificadores válidos.'; end;
    if cantidad not between 1 and 100 then raise exception 'La cantidad solicitada no es válida.'; end if;
    clave_linea := producto.id::text || ':' || coalesce(nullif(linea->>'variante_id', ''), 'simple');
    if clave_linea = any(claves) then raise exception 'La selección contiene un artículo repetido.'; end if;
    claves := array_append(claves, clave_linea);

    select * into producto from public.productos p
      where p.id = producto.id and p.estado = 'publicado' for share;
    if not found then raise exception 'Uno de los productos ya no está disponible.'; end if;
    variante := null;
    if producto.usa_variantes then
      if nullif(linea->>'variante_id', '') is null then raise exception 'Falta elegir una variante del producto.'; end if;
      begin
        select * into variante from public.variantes v
          where v.id = (linea->>'variante_id')::uuid and v.producto_id = producto.id and v.estado = 'publicado'
          for share;
      exception when others then raise exception 'La variante seleccionada no es válida.'; end;
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
    requiere_stock := es_automatico and producto.controla_stock;
    opciones := coalesce(linea->'opciones', '{}'::jsonb);
    if jsonb_typeof(opciones) is distinct from 'object' then raise exception 'Las opciones del artículo no son válidas.'; end if;
    subtotal := subtotal + precio_centavos * cantidad;
    items := items || jsonb_build_array(jsonb_build_object(
      'producto_id', producto.id,
      'variante_id', variante.id,
      'categoria_id', producto.categoria_id,
      'producto_nombre', producto.nombre,
      'variante_nombre', variante.nombre,
      'sku', coalesce(variante.sku, producto.sku),
      'descripcion', producto.descripcion,
      'precio_unitario_centavos', precio_centavos,
      'cantidad', cantidad,
      'subtotal_centavos', precio_centavos * cantidad,
      'opciones', opciones,
      'compra_automatica', es_automatico,
      'requiere_personalizacion', producto.requiere_personalizacion,
      'requiere_reserva_stock', requiere_stock
    ));
  end loop;

  insert into public.pedidos(
    tipo, cliente_nombre, cliente_correo, cliente_whatsapp, requiere_envio, envio_definido,
    subtotal_centavos, total_centavos, clave_idempotencia, solicitud_hash,
    referencia_externa, observaciones_cliente
  ) values (
    case when todos_automaticos then 'automatico'::public.tipo_pedido else 'coordinado'::public.tipo_pedido end,
    btrim(p_cliente_nombre), lower(btrim(p_cliente_correo)), btrim(p_cliente_whatsapp), false, todos_automaticos,
    subtotal, subtotal, p_clave_idempotencia, p_solicitud_hash,
    'pedido-' || gen_random_uuid()::text, nullif(btrim(p_observaciones), '')
  ) returning * into pedido;

  for item in select value from jsonb_array_elements(items)
  loop
    insert into public.pedido_items(
      pedido_id, producto_id, variante_id, categoria_id, producto_nombre, variante_nombre,
      sku, descripcion, precio_unitario_centavos, cantidad, subtotal_centavos,
      opciones_personalizadas, compra_automatica, requiere_personalizacion, requiere_reserva_stock
    ) values (
      pedido.id, (item->>'producto_id')::uuid, nullif(item->>'variante_id', '')::uuid,
      nullif(item->>'categoria_id', '')::uuid, item->>'producto_nombre', nullif(item->>'variante_nombre', ''),
      nullif(item->>'sku', ''), item->>'descripcion', (item->>'precio_unitario_centavos')::bigint,
      (item->>'cantidad')::integer, (item->>'subtotal_centavos')::bigint, item->'opciones',
      (item->>'compra_automatica')::boolean, (item->>'requiere_personalizacion')::boolean,
      (item->>'requiere_reserva_stock')::boolean
    );
  end loop;

  insert into public.tokens_consulta_pedido(pedido_id, token_hash, vence_en)
    values (pedido.id, p_token_hash, now() + interval '90 days');
  insert into public.historial_pedidos(pedido_id, evento, actor, clave_deduplicacion, metadatos)
    values (pedido.id, 'solicitud_recibida', 'cliente', 'solicitud:' || pedido.id::text,
      jsonb_build_object('tipo', pedido.tipo, 'articulos', jsonb_array_length(items)));
  insert into public.notificaciones_outbox(pedido_id, evento, destinatario, plantilla, datos, clave_deduplicacion)
    values (pedido.id, 'solicitud_recibida', pedido.cliente_correo, 'solicitud_recibida',
      jsonb_build_object('pedido_id', pedido.id, 'numero', pedido.numero), 'correo:solicitud:' || pedido.id::text);

  if todos_automaticos then
    if exists (select 1 from public.pedido_items where pedido_id = pedido.id and requiere_reserva_stock) then
      perform public.reservar_stock_pedido(pedido.id, p_clave_idempotencia || ':stock', 20);
    end if;
    if nullif(btrim(p_codigo_cupon), '') is not null then
      select * into reserva_cupon from public.reservar_cupon_pedido(
        pedido.id, p_codigo_cupon, p_comprador_hash, p_clave_idempotencia || ':cupon', 20
      );
    end if;
  elsif nullif(btrim(p_codigo_cupon), '') is not null then
    raise exception 'Los cupones se aplican actualmente solamente a compras automáticas.';
  end if;

  select * into pedido from public.pedidos where id = pedido.id;
  return jsonb_build_object(
    'id', pedido.id, 'numero', pedido.numero, 'tipo', pedido.tipo,
    'subtotal_centavos', pedido.subtotal_centavos,
    'descuento_centavos', pedido.descuento_centavos,
    'total_centavos', pedido.total_centavos,
    'estado_comercial', pedido.estado_comercial,
    'estado_financiero', pedido.estado_financiero
  );
end;
$$;

create or replace function public.guardar_cupon_administracion(
  p_id uuid, p_datos jsonb, p_categorias uuid[], p_productos uuid[], p_excluidos uuid[], p_usuario uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_cupon_id uuid := coalesce(p_id, gen_random_uuid()); v_codigo text; tipo public.tipo_descuento_cupon;
  alcance_nuevo public.alcance_cupon; aplica public.aplicacion_tipo_pedido_cupon; accion text;
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para administrar cupones.'; end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Los datos del cupón no son válidos.'; end if;
  v_codigo := upper(btrim(p_datos->>'codigo'));
  if v_codigo !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'El código debe tener de 3 a 40 letras, números, guiones o guiones bajos.'; end if;
  begin
    tipo := (p_datos->>'tipo_descuento')::public.tipo_descuento_cupon;
    alcance_nuevo := coalesce((p_datos->>'alcance')::public.alcance_cupon, 'todos');
    aplica := coalesce((p_datos->>'aplica_tipo_pedido')::public.aplicacion_tipo_pedido_cupon, 'automatico');
  exception when others then raise exception 'Las opciones del cupón no son válidas.'; end;
  if alcance_nuevo = 'categorias' and coalesce(array_length(p_categorias, 1), 0) = 0 then
    raise exception 'Elegí al menos una categoría para el cupón.';
  end if;
  if alcance_nuevo = 'productos' and coalesce(array_length(p_productos, 1), 0) = 0 then
    raise exception 'Elegí al menos un producto para el cupón.';
  end if;
  if p_id is null then
    insert into public.cupones(
      id, codigo, codigo_normalizado, descripcion_interna, activo, inicia_en, vence_en,
      tipo_descuento, porcentaje_puntos_base, importe_fijo_centavos, compra_minima_centavos,
      descuento_maximo_centavos, limite_usos_total, limite_usos_comprador, alcance,
      aplica_tipo_pedido, creado_por
    ) values (
      v_cupon_id, v_codigo, v_codigo, left(coalesce(p_datos->>'descripcion_interna', ''), 500),
      coalesce((p_datos->>'activo')::boolean, true), nullif(p_datos->>'inicia_en', '')::timestamptz,
      nullif(p_datos->>'vence_en', '')::timestamptz, tipo,
      nullif(p_datos->>'porcentaje_puntos_base', '')::integer,
      nullif(p_datos->>'importe_fijo_centavos', '')::bigint,
      coalesce(nullif(p_datos->>'compra_minima_centavos', '')::bigint, 0),
      nullif(p_datos->>'descuento_maximo_centavos', '')::bigint,
      nullif(p_datos->>'limite_usos_total', '')::integer,
      nullif(p_datos->>'limite_usos_comprador', '')::integer,
      alcance_nuevo, aplica, p_usuario
    );
    accion := 'crear';
  else
    perform 1 from public.cupones where id = p_id for update;
    if not found then raise exception 'El cupón no existe.'; end if;
    update public.cupones set
      codigo = v_codigo, codigo_normalizado = v_codigo,
      descripcion_interna = left(coalesce(p_datos->>'descripcion_interna', ''), 500),
      activo = coalesce((p_datos->>'activo')::boolean, true),
      inicia_en = nullif(p_datos->>'inicia_en', '')::timestamptz,
      vence_en = nullif(p_datos->>'vence_en', '')::timestamptz,
      tipo_descuento = tipo,
      porcentaje_puntos_base = nullif(p_datos->>'porcentaje_puntos_base', '')::integer,
      importe_fijo_centavos = nullif(p_datos->>'importe_fijo_centavos', '')::bigint,
      compra_minima_centavos = coalesce(nullif(p_datos->>'compra_minima_centavos', '')::bigint, 0),
      descuento_maximo_centavos = nullif(p_datos->>'descuento_maximo_centavos', '')::bigint,
      limite_usos_total = nullif(p_datos->>'limite_usos_total', '')::integer,
      limite_usos_comprador = nullif(p_datos->>'limite_usos_comprador', '')::integer,
      alcance = alcance_nuevo, aplica_tipo_pedido = aplica
    where id = p_id;
    accion := 'actualizar';
  end if;
  delete from public.cupon_categorias where cupon_id = v_cupon_id;
  delete from public.cupon_productos where cupon_id = v_cupon_id;
  delete from public.cupon_productos_excluidos where cupon_id = v_cupon_id;
  insert into public.cupon_categorias(cupon_id, categoria_id)
    select v_cupon_id, unnest(coalesce(p_categorias, '{}'::uuid[])) on conflict do nothing;
  insert into public.cupon_productos(cupon_id, producto_id)
    select v_cupon_id, unnest(coalesce(p_productos, '{}'::uuid[])) on conflict do nothing;
  insert into public.cupon_productos_excluidos(cupon_id, producto_id)
    select v_cupon_id, unnest(coalesce(p_excluidos, '{}'::uuid[])) on conflict do nothing;
  insert into public.historial_cupones(cupon_id, accion, usuario_id, datos, clave_deduplicacion)
    values (v_cupon_id, accion, p_usuario,
      jsonb_build_object('codigo', v_codigo, 'activo', coalesce((p_datos->>'activo')::boolean, true)),
      accion || ':' || v_cupon_id::text || ':' || gen_random_uuid()::text);
  return v_cupon_id;
end;
$$;

create or replace function public.actualizar_estado_pedido_administracion(
  p_pedido_id uuid, p_campo text, p_valor text, p_usuario uuid, p_nota text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare anterior jsonb; actualizado public.pedidos;
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para actualizar pedidos.'; end if;
  if p_nota is not null and char_length(p_nota) > 1000 then raise exception 'La nota es demasiado extensa.'; end if;
  select to_jsonb(p) into anterior from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  begin
    if p_campo = 'estado_comercial' then
      update public.pedidos set estado_comercial = p_valor::public.estado_comercial_pedido,
        cancelado_en = case when p_valor = 'cancelado' then now() else cancelado_en end,
        finalizado_en = case when p_valor = 'finalizado' then now() else finalizado_en end
      where id = p_pedido_id returning * into actualizado;
    elsif p_campo = 'estado_preparacion' then
      update public.pedidos set estado_preparacion = p_valor::public.estado_preparacion_pedido
      where id = p_pedido_id returning * into actualizado;
    elsif p_campo = 'estado_entrega' then
      update public.pedidos set estado_entrega = p_valor::public.estado_entrega_pedido
      where id = p_pedido_id returning * into actualizado;
    else raise exception 'El estado solicitado no se puede editar.';
    end if;
  exception when invalid_text_representation then raise exception 'El valor del estado no es válido.'; end;
  insert into public.historial_pedidos(
    pedido_id, evento, actor, usuario_id, estado_anterior, estado_nuevo, nota, clave_deduplicacion
  ) values (
    p_pedido_id, 'estado_actualizado', 'administracion', p_usuario,
    jsonb_build_object(p_campo, anterior->p_campo),
    jsonb_build_object(p_campo, to_jsonb(actualizado)->p_campo), p_nota,
    'estado:' || p_pedido_id::text || ':' || gen_random_uuid()::text
  );
  return jsonb_build_object(
    'estado_comercial', actualizado.estado_comercial,
    'estado_preparacion', actualizado.estado_preparacion,
    'estado_entrega', actualizado.estado_entrega,
    'estado_financiero', actualizado.estado_financiero
  );
end;
$$;

create or replace function public.rotar_token_consulta_pedido_administracion(
  p_pedido_id uuid, p_token_hash bytea, p_usuario uuid, p_dias integer default 90
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare anterior_id uuid; nuevo_id uuid;
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para generar enlaces de seguimiento.'; end if;
  if octet_length(p_token_hash) <> 32 or p_dias not between 1 and 365 then raise exception 'El token no es válido.'; end if;
  perform 1 from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  select id into anterior_id from public.tokens_consulta_pedido
    where pedido_id = p_pedido_id and revocado_en is null order by creado_en desc limit 1 for update;
  update public.tokens_consulta_pedido set revocado_en = now()
    where pedido_id = p_pedido_id and revocado_en is null;
  insert into public.tokens_consulta_pedido(pedido_id, token_hash, vence_en, rotado_desde_id)
    values (p_pedido_id, p_token_hash, now() + make_interval(days => p_dias), anterior_id)
    returning id into nuevo_id;
  insert into public.historial_pedidos(pedido_id, evento, actor, usuario_id, clave_deduplicacion)
    values (p_pedido_id, 'enlace_seguimiento_rotado', 'administracion', p_usuario,
      'token:' || nuevo_id::text);
  return nuevo_id;
end;
$$;

create or replace function public.alternar_cupon_administracion(p_cupon_id uuid, p_activo boolean, p_usuario uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para administrar cupones.'; end if;
  update public.cupones set activo = p_activo where id = p_cupon_id;
  if not found then raise exception 'El cupón no existe.'; end if;
  insert into public.historial_cupones(cupon_id, accion, usuario_id, datos, clave_deduplicacion)
    values (p_cupon_id, case when p_activo then 'activar' else 'desactivar' end, p_usuario,
      jsonb_build_object('activo', p_activo), 'estado:' || p_cupon_id::text || ':' || gen_random_uuid()::text);
  return p_activo;
end;
$$;

create or replace function public.configurar_modo_compra_producto_administracion(
  p_producto_id uuid, p_compra_automatica boolean, p_requiere_personalizacion boolean, p_usuario uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare producto public.productos; tiene_variante_disponible boolean;
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para configurar productos.'; end if;
  select * into producto from public.productos where id = p_producto_id for update;
  if not found then raise exception 'El producto no existe.'; end if;
  if p_compra_automatica and p_requiere_personalizacion then
    raise exception 'Un producto personalizado no puede usar compra automática.';
  end if;
  if p_compra_automatica then
    if producto.estado <> 'publicado' then raise exception 'Publicá el producto antes de habilitar la compra automática.'; end if;
    if producto.usa_variantes then
      select exists(select 1 from public.variantes where producto_id = p_producto_id and estado = 'publicado'
        and precio > 0 and (producto.tipo_producto <> 'fisico' or stock > 0)) into tiene_variante_disponible;
      if not tiene_variante_disponible then raise exception 'La compra automática necesita una variante publicada, con precio y stock cuando corresponda.'; end if;
    elsif producto.precio <= 0 or (producto.tipo_producto = 'fisico' and producto.stock <= 0) then
      raise exception 'La compra automática necesita precio y stock disponible cuando corresponda.';
    end if;
  end if;
  update public.productos set
    compra_automatica_habilitada = p_compra_automatica,
    requiere_personalizacion = p_requiere_personalizacion
  where id = p_producto_id;
end;
$$;

revoke all on function public.consumir_limite_solicitudes(bytea,text,integer,integer) from public, anon, authenticated;
revoke all on function public.crear_solicitud_pedido(jsonb,text,text,text,text,text,text,bytea,bytea,bytea) from public, anon, authenticated;
revoke all on function public.guardar_cupon_administracion(uuid,jsonb,uuid[],uuid[],uuid[],uuid) from public, anon, authenticated;
revoke all on function public.actualizar_estado_pedido_administracion(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.rotar_token_consulta_pedido_administracion(uuid,bytea,uuid,integer) from public, anon, authenticated;
revoke all on function public.alternar_cupon_administracion(uuid,boolean,uuid) from public, anon, authenticated;
revoke all on function public.configurar_modo_compra_producto_administracion(uuid,boolean,boolean,uuid) from public, anon, authenticated;
grant execute on function public.consumir_limite_solicitudes(bytea,text,integer,integer) to service_role;
grant execute on function public.crear_solicitud_pedido(jsonb,text,text,text,text,text,text,bytea,bytea,bytea) to service_role;
grant execute on function public.guardar_cupon_administracion(uuid,jsonb,uuid[],uuid[],uuid[],uuid) to service_role;
grant execute on function public.actualizar_estado_pedido_administracion(uuid,text,text,uuid,text) to service_role;
grant execute on function public.rotar_token_consulta_pedido_administracion(uuid,bytea,uuid,integer) to service_role;
grant execute on function public.alternar_cupon_administracion(uuid,boolean,uuid) to service_role;
grant execute on function public.configurar_modo_compra_producto_administracion(uuid,boolean,boolean,uuid) to service_role;

commit;

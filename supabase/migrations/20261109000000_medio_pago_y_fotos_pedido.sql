-- Aplicar en pruebas DESPUÉS de 20261013000000_checkout_seguimiento_y_archivado.sql.
-- Guarda la elección de pago; no acredita dinero ni cambia el estado financiero.
begin;

alter table public.pedidos add column if not exists medio_pago_solicitado text
  check (medio_pago_solicitado is null or medio_pago_solicitado in ('transferencia', 'efectivo'));
alter table public.pedido_items add column if not exists imagen_url_snapshot text
  check (imagen_url_snapshot is null or char_length(imagen_url_snapshot) <= 2000);

create or replace function public.imagen_catalogo_pedido(p_producto_id uuid, p_variante_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select i.url_publica from public.imagenes i
  where i.producto_id = p_producto_id
    and (i.variante_id is null or i.variante_id = p_variante_id)
  order by (i.variante_id is not null) desc, i.es_principal desc, i.orden, i.id
  limit 1;
$$;

create or replace function public.guardar_imagen_item_pedido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Ignora cualquier URL proporcionada por quien invoque la función.
  new.imagen_url_snapshot := public.imagen_catalogo_pedido(new.producto_id, new.variante_id);
  return new;
end;
$$;
drop trigger if exists guardar_imagen_item on public.pedido_items;
create trigger guardar_imagen_item before insert on public.pedido_items
for each row execute function public.guardar_imagen_item_pedido();

create or replace function public.crear_solicitud_pedido_checkout(
  p_lineas jsonb,
  p_cliente_nombre text,
  p_cliente_correo text,
  p_cliente_whatsapp text,
  p_observaciones text,
  p_codigo_cupon text,
  p_clave_idempotencia text,
  p_solicitud_hash bytea,
  p_comprador_hash bytea,
  p_token_hash bytea,
  p_medio_pago_solicitado text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare respuesta jsonb; pedido_id uuid; medio_anterior text;
begin
  if p_medio_pago_solicitado is null or p_medio_pago_solicitado not in ('transferencia', 'efectivo') then
    raise exception 'El medio de pago debe ser transferencia o efectivo.';
  end if;
  -- La transacción original mantiene precios, notas, stock y cupones en el servidor.
  respuesta := public.crear_solicitud_pedido(
    p_lineas, p_cliente_nombre, p_cliente_correo, p_cliente_whatsapp,
    p_observaciones, p_codigo_cupon, p_clave_idempotencia,
    p_solicitud_hash, p_comprador_hash, p_token_hash
  );
  pedido_id := (respuesta->>'id')::uuid;
  select p.medio_pago_solicitado into medio_anterior
    from public.pedidos p where p.id = pedido_id for update;
  if medio_anterior is not null and medio_anterior <> p_medio_pago_solicitado then
    raise exception 'La clave de idempotencia ya fue usada con otra forma de pago.';
  end if;
  if medio_anterior is null then
    update public.pedidos set medio_pago_solicitado = p_medio_pago_solicitado where id = pedido_id;
    insert into public.historial_pedidos(pedido_id, evento, actor, metadatos, clave_deduplicacion)
    values (pedido_id, 'medio_pago_elegido', 'cliente',
      jsonb_build_object('medio_pago', p_medio_pago_solicitado), 'medio-pago:' || pedido_id::text);
  end if;
  return respuesta || jsonb_build_object('medio_pago_solicitado', p_medio_pago_solicitado);
end;
$$;

revoke all on function public.imagen_catalogo_pedido(uuid,uuid) from public, anon, authenticated;
revoke all on function public.guardar_imagen_item_pedido() from public, anon, authenticated;
revoke all on function public.crear_solicitud_pedido_checkout(jsonb,text,text,text,text,text,text,bytea,bytea,bytea,text)
  from public, anon, authenticated;
grant execute on function public.imagen_catalogo_pedido(uuid,uuid) to service_role;
grant execute on function public.crear_solicitud_pedido_checkout(jsonb,text,text,text,text,text,text,bytea,bytea,bytea,text)
  to service_role;

comment on column public.pedidos.medio_pago_solicitado is
  'Preferencia del cliente; no representa un pago recibido o aprobado.';
comment on column public.pedido_items.imagen_url_snapshot is
  'Foto de catálogo elegida en el servidor al crear el artículo; conserva el snapshot inmutable.';

commit;

-- Notas privadas de administración. Aplicar sólo en papeleria-de-sol-pruebas.
begin;

create or replace function public.guardar_nota_interna_pedido_administracion(
  p_pedido_id uuid, p_nota text, p_usuario uuid, p_nota_anterior text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare anterior text; nueva text := nullif(btrim(p_nota), ''); actualizacion timestamptz;
begin
  if not public.es_administrador(p_usuario) then
    raise exception 'No tenés permisos para editar notas del pedido.';
  end if;
  if char_length(coalesce(p_nota, '')) > 2000 or char_length(coalesce(p_nota_anterior, '')) > 2000 then
    raise exception 'La nota interna no puede superar 2000 caracteres.';
  end if;
  select p.notas_internas into anterior from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if coalesce(anterior, '') is distinct from coalesce(p_nota_anterior, '') then
    raise exception 'La nota interna cambió en otra sesión. Volvé a abrir el pedido antes de editarla.';
  end if;
  if anterior is distinct from nueva then
    update public.pedidos set notas_internas = nueva where id = p_pedido_id
      returning actualizado_en into actualizacion;
    insert into public.historial_pedidos(pedido_id, evento, actor, usuario_id, estado_anterior, estado_nuevo)
    values (p_pedido_id, 'nota_interna_actualizada', 'administracion', p_usuario,
      jsonb_build_object('notas_internas', anterior), jsonb_build_object('notas_internas', nueva));
  else
    select actualizado_en into actualizacion from public.pedidos where id = p_pedido_id;
  end if;
  return jsonb_build_object('notas_internas', nueva, 'actualizado_en', actualizacion);
end;
$$;

revoke all on function public.guardar_nota_interna_pedido_administracion(uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.guardar_nota_interna_pedido_administracion(uuid,text,uuid,text) to service_role;

commit;

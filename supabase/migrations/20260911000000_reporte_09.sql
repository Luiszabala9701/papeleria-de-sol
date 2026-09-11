-- Ajustes del Reporte 09: SKU históricos, carrusel de inicio y orden de imágenes.
-- Ejecutar primero en pruebas y después en producción, antes de desplegar la
-- función Edge y la web de la misma versión.
begin;
set constraints all immediate;

-- El carrusel es independiente de "destacado" y tiene un orden estable propio.
alter table public.productos
  add column if not exists en_carrusel_inicio boolean not null default false;
alter table public.productos
  add column if not exists orden_carrusel integer not null default 0 check (orden_carrusel >= 0);
create index if not exists productos_carrusel_inicio_idx
  on public.productos (orden_carrusel, orden, id)
  where estado = 'publicado' and en_carrusel_inicio;

-- El último requerimiento establece que un SKU utilizado jamás se reutiliza.
-- Se quitan los disparadores que liberaban reservas al borrar productos/versiones.
drop trigger if exists liberar_sku_producto on public.productos;
drop trigger if exists liberar_sku_variante on public.variantes;
drop function if exists public.liberar_sku_catalogo();

-- Recupera reservas de borrados hechos con la versión anterior cuando el SKU
-- quedó registrado en la auditoría administrativa.
insert into public.codigos_sku(codigo, propietario_id)
select upper(trim(datos->>'sku')), recurso_id::uuid
from public.registros_auditoria
where accion = 'eliminar_definitivamente'
  and recurso in ('productos', 'variantes')
  and recurso_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and nullif(trim(datos->>'sku'), '') is not null
on conflict do nothing;

insert into public.contadores_sku(prefijo, ultimo)
select prefijo, coalesce(max(substring(codigo from '-([0-9]+)$')::bigint), 0)
from (values ('ST'), ('PF'), ('PL')) prefijos(prefijo)
left join public.codigos_sku on codigo ~ ('^' || prefijo || '-[0-9]+$')
group by prefijo
on conflict (prefijo) do update
set ultimo = greatest(public.contadores_sku.ultimo, excluded.ultimo);

create or replace function public.asignar_sku_catalogo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prefijo_sku text; tipo public.tipo_producto; numero bigint; reservado uuid;
begin
  if tg_op = 'UPDATE' then
    if new.sku is distinct from old.sku then raise exception 'El SKU no se puede cambiar.'; end if;
    return new;
  end if;
  if tg_table_name = 'productos' then tipo := new.tipo_producto;
  else select tipo_producto into tipo from public.productos where id = new.producto_id; end if;
  prefijo_sku := case tipo when 'sticker' then 'ST' when 'fisico' then 'PF' when 'plantilla' then 'PL' end;
  if prefijo_sku is null then raise exception 'El tipo de producto no es válido.'; end if;

  perform 1 from public.contadores_sku where prefijo = prefijo_sku for update;
  if nullif(trim(new.sku), '') is null then
    update public.contadores_sku set ultimo = ultimo + 1
      where prefijo = prefijo_sku returning ultimo into numero;
    new.sku := prefijo_sku || '-' || lpad(numero::text, greatest(4, length(numero::text)), '0');
  else
    new.sku := upper(trim(new.sku));
    if new.sku !~ ('^' || prefijo_sku || '-[0-9]+$') then raise exception 'El SKU no coincide con el tipo de producto.'; end if;
    numero := substring(new.sku from '-([0-9]+)$')::bigint;
    update public.contadores_sku set ultimo = greatest(ultimo, numero) where prefijo = prefijo_sku;
  end if;

  select propietario_id into reservado from public.codigos_sku where codigo = new.sku;
  if reservado is not null and reservado <> new.id then raise exception 'Ese SKU ya fue utilizado.'; end if;
  insert into public.codigos_sku(codigo, propietario_id) values (new.sku, new.id)
    on conflict (codigo) do nothing;
  return new;
end;
$$;

-- Envuelve el guardado existente para incorporar el estado del carrusel en la
-- misma transacción sin duplicar la lógica consolidada de productos/variantes.
create or replace function public.guardar_producto_con_variantes_v2(
  p_id uuid, p_datos jsonb, p_variantes jsonb, p_usuario uuid
) returns uuid language plpgsql set search_path = '' as $$
declare producto uuid; posicion integer;
begin
  posicion := coalesce((p_datos->>'orden_carrusel')::integer, 0);
  if posicion < 0 then raise exception 'El orden del carrusel no puede ser negativo.'; end if;
  producto := public.guardar_producto_con_variantes(p_id, p_datos, p_variantes, p_usuario);
  update public.productos set
    en_carrusel_inicio = coalesce((p_datos->>'en_carrusel_inicio')::boolean, false),
    orden_carrusel = posicion
  where id = producto;
  return producto;
end;
$$;

-- Guarda toda una galería de una vez. La lista debe contener exactamente las
-- imágenes actuales de ese producto/variante, sin duplicados ni elementos ajenos.
create or replace function public.reordenar_imagenes_producto(
  p_producto uuid, p_variante uuid, p_imagenes uuid[], p_usuario uuid
) returns void language plpgsql set search_path = '' as $$
declare actuales uuid[]; enviados uuid[]; indice integer;
begin
  if not public.es_administrador(p_usuario) then
    raise exception 'No tenés permisos para ordenar imágenes.';
  end if;
  if p_imagenes is null then raise exception 'El orden de imágenes no es válido.'; end if;
  perform 1 from public.productos where id = p_producto for update;
  if not found then raise exception 'El producto no existe.'; end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[]) into actuales
  from public.imagenes
  where producto_id = p_producto and variante_id is not distinct from p_variante;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into enviados
  from unnest(p_imagenes) id;
  if cardinality(p_imagenes) <> cardinality(enviados) or actuales is distinct from enviados then
    raise exception 'La lista debe incluir una sola vez todas las imágenes de la galería.';
  end if;

  if cardinality(p_imagenes) > 0 then
    for indice in 1..cardinality(p_imagenes) loop
      update public.imagenes set orden = indice, es_principal = indice = 1
      where id = p_imagenes[indice] and producto_id = p_producto
        and variante_id is not distinct from p_variante;
    end loop;
  end if;
end;
$$;

-- Si se elimina una foto desde el editor, la siguiente mantiene de inmediato
-- una portada válida aunque el usuario cierre el formulario sin guardar de nuevo.
create or replace function public.normalizar_galeria_tras_eliminar_imagen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  with ordenadas as (
    select id,
      row_number() over (order by es_principal desc, orden, id)::integer as posicion
    from public.imagenes
    where producto_id = old.producto_id
      and variante_id is not distinct from old.variante_id
  )
  update public.imagenes as imagen
  set orden = ordenadas.posicion,
      es_principal = ordenadas.posicion = 1
  from ordenadas
  where imagen.id = ordenadas.id;
  return old;
end;
$$;

drop trigger if exists normalizar_galeria_tras_eliminar_imagen on public.imagenes;
create trigger normalizar_galeria_tras_eliminar_imagen
after delete on public.imagenes
for each row execute function public.normalizar_galeria_tras_eliminar_imagen();

revoke all on function public.guardar_producto_con_variantes_v2(uuid, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.guardar_producto_con_variantes_v2(uuid, jsonb, jsonb, uuid)
  to service_role;
revoke all on function public.reordenar_imagenes_producto(uuid, uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.reordenar_imagenes_producto(uuid, uuid, uuid[], uuid)
  to service_role;
revoke all on function public.asignar_sku_catalogo(), public.normalizar_galeria_tras_eliminar_imagen()
  from public, anon, authenticated;

commit;

-- Permite eliminar definitivamente productos y variantes desde administración.
-- Los SKU liberados vuelven a estar disponibles y la asignación automática usa
-- siempre el número libre más bajo del prefijo correspondiente.
begin;
set constraints all immediate;

-- Las referencias históricas se conservan sin impedir la eliminación de una variante.
alter table public.imagenes drop constraint if exists imagenes_variante_id_fkey;
alter table public.imagenes add constraint imagenes_variante_id_fkey
  foreign key (variante_id) references public.variantes(id) on delete cascade;

alter table public.historial_precios drop constraint if exists historial_precios_variante_id_fkey;
alter table public.historial_precios add constraint historial_precios_variante_id_fkey
  foreign key (variante_id) references public.variantes(id) on delete set null;

alter table public.movimientos_stock drop constraint if exists movimientos_stock_variante_id_fkey;
alter table public.movimientos_stock add constraint movimientos_stock_variante_id_fkey
  foreign key (variante_id) references public.variantes(id) on delete set null;

-- Elimina reservas antiguas cuyo producto o variante ya no existe.
delete from public.codigos_sku codigo
where not exists (select 1 from public.productos where id = codigo.propietario_id)
  and not exists (select 1 from public.variantes where id = codigo.propietario_id);

create or replace function public.asignar_sku_catalogo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prefijo_sku text;
  tipo public.tipo_producto;
  numero bigint;
  maximo bigint;
  reservado uuid;
begin
  if tg_op = 'UPDATE' then
    if new.sku is distinct from old.sku then raise exception 'El SKU no se puede cambiar.'; end if;
    return new;
  end if;

  if tg_table_name = 'productos' then
    tipo := new.tipo_producto;
  else
    select tipo_producto into tipo from public.productos where id = new.producto_id;
  end if;
  prefijo_sku := case tipo when 'sticker' then 'ST' when 'fisico' then 'PF' when 'plantilla' then 'PL' end;
  if prefijo_sku is null then raise exception 'El tipo de producto no es válido.'; end if;

  -- Serializa la asignación por prefijo para impedir duplicados concurrentes.
  perform 1 from public.contadores_sku where prefijo = prefijo_sku for update;
  if nullif(trim(new.sku), '') is null then
    select coalesce(max(substring(codigo from '-([0-9]+)$')::bigint), 0)
      into maximo
      from public.codigos_sku
      where codigo ~ ('^' || prefijo_sku || '-[0-9]+$');
    select candidato into numero
      from generate_series(1::bigint, maximo + 1) candidato
      where not exists (
        select 1 from public.codigos_sku ocupado
        where ocupado.codigo ~ ('^' || prefijo_sku || '-[0-9]+$')
          and substring(ocupado.codigo from '-([0-9]+)$')::bigint = candidato
      )
      order by candidato
      limit 1;
    new.sku := prefijo_sku || '-' || lpad(numero::text, greatest(4, length(numero::text)), '0');
  else
    new.sku := upper(trim(new.sku));
    if new.sku !~ ('^' || prefijo_sku || '-[0-9]+$') then raise exception 'El SKU no coincide con el tipo de producto.'; end if;
    numero := substring(new.sku from '-([0-9]+)$')::bigint;
  end if;

  update public.contadores_sku set ultimo = greatest(ultimo, numero) where prefijo = prefijo_sku;
  select propietario_id into reservado from public.codigos_sku where codigo = new.sku;
  if reservado is not null and reservado <> new.id then raise exception 'Ya existe ese SKU.'; end if;
  insert into public.codigos_sku(codigo, propietario_id) values (new.sku, new.id) on conflict (codigo) do nothing;
  return new;
end;
$$;

create or replace function public.liberar_sku_catalogo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.codigos_sku where propietario_id = old.id;
  return old;
end;
$$;

drop trigger if exists liberar_sku_producto on public.productos;
create trigger liberar_sku_producto after delete on public.productos
for each row execute function public.liberar_sku_catalogo();

drop trigger if exists liberar_sku_variante on public.variantes;
create trigger liberar_sku_variante after delete on public.variantes
for each row execute function public.liberar_sku_catalogo();

revoke all on function public.asignar_sku_catalogo(), public.liberar_sku_catalogo()
  from public, anon, authenticated;

commit;

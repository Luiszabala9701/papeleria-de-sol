-- Actualización de bases existentes. Ejecutar primero en pruebas y con respaldo.
-- Conserva productos, URLs, precios y fotos. Los físicos sin existencias conocidas
-- quedan en cero; cargar su stock real antes de volver a ofrecerlos.
-- No crea pedidos ni descuenta stock: la confirmación sigue por WhatsApp.
begin;
-- Evita eventos diferidos pendientes al reejecutar esta actualización.
set constraints all immediate;

alter table public.productos add column if not exists usa_variantes boolean not null default false;
alter table public.variantes add column if not exists clave text;
alter table public.variantes add column if not exists descripcion text not null default '';
alter table public.imagenes add column if not exists variante_id uuid references public.variantes(id);
alter table public.historial_precios add column if not exists variante_id uuid references public.variantes(id);
create unique index if not exists variantes_producto_clave_idx on public.variantes(producto_id, clave);
create index if not exists imagenes_variante_idx on public.imagenes(variante_id, orden);

-- Registro común: un código nunca se asigna a dos productos/versiones ni se reutiliza.
create table if not exists public.codigos_sku (
  codigo text primary key,
  propietario_id uuid not null unique
);
create table if not exists public.contadores_sku (
  prefijo text primary key,
  ultimo bigint not null default 0
);
alter table public.codigos_sku enable row level security;
alter table public.contadores_sku enable row level security;
revoke all on public.codigos_sku, public.contadores_sku from anon, authenticated;
grant all on public.codigos_sku, public.contadores_sku to service_role;

do $$
begin
  if exists (
    select upper(trim(sku)) from (
      select id, sku from public.productos union all select id, sku from public.variantes
    ) origen where nullif(trim(sku), '') is not null group by upper(trim(sku)) having count(distinct id) > 1
  ) then
    raise exception 'Ya existen SKU compartidos entre productos y variantes. Revisarlos antes de migrar.';
  end if;
  if exists (select 1 from public.productos where tipo_producto = 'sticker' and precio is null) then
    raise exception 'Hay stickers sin precio. Completar sus precios antes de migrar.';
  end if;
end;
$$;
insert into public.codigos_sku(codigo, propietario_id)
select upper(trim(sku)), id from (
  select id, sku from public.productos union all select id, sku from public.variantes
) origen where nullif(trim(sku), '') is not null
on conflict (codigo) do nothing;
insert into public.contadores_sku(prefijo, ultimo)
select prefijo, coalesce(max(substring(codigo from '-([0-9]+)$')::bigint), 0)
from (values ('ST'), ('PF'), ('PL')) prefijos(prefijo)
left join public.codigos_sku on codigo ~ ('^' || prefijo || '-[0-9]+$') group by prefijo
on conflict (prefijo) do update set ultimo = greatest(public.contadores_sku.ultimo, excluded.ultimo);

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
    update public.contadores_sku set ultimo = ultimo + 1 where prefijo = prefijo_sku returning ultimo into numero;
    new.sku := prefijo_sku || '-' || lpad(numero::text, greatest(4, length(numero::text)), '0');
  else
    new.sku := upper(trim(new.sku));
    if new.sku !~ ('^' || prefijo_sku || '-[0-9]+$') then raise exception 'El SKU no coincide con el tipo de producto.'; end if;
    numero := substring(new.sku from '-([0-9]+)$')::bigint;
    update public.contadores_sku set ultimo = greatest(ultimo, numero) where prefijo = prefijo_sku;
  end if;
  select propietario_id into reservado from public.codigos_sku where codigo = new.sku;
  if reservado is not null and reservado <> new.id then raise exception 'Ya existe ese SKU.'; end if;
  insert into public.codigos_sku(codigo, propietario_id) values (new.sku, new.id) on conflict (codigo) do nothing;
  return new;
end;
$$;
drop trigger if exists asignar_sku_producto on public.productos;
create trigger asignar_sku_producto before insert or update of sku on public.productos for each row execute function public.asignar_sku_catalogo();
drop trigger if exists asignar_sku_variante on public.variantes;
create trigger asignar_sku_variante before insert or update of sku on public.variantes for each row execute function public.asignar_sku_catalogo();

-- Versiones previas reconocibles se conservan; una versión desconocida requiere revisión.
update public.variantes set clave = case lower(trim(nombre))
  when 'común' then 'comun' when 'comun' then 'comun' when 'sticker común' then 'comun'
  when 'holográfico' then 'holografico' when 'holografico' then 'holografico'
  when 'resistente al agua' then 'resistente_agua' else id::text end
where clave is null;
do $$ begin
  if exists (select 1 from public.variantes v join public.productos p on p.id = v.producto_id
    where p.tipo_producto = 'sticker' and v.clave not in ('comun', 'holografico', 'resistente_agua')) then
    raise exception 'Hay variantes antiguas de stickers sin un acabado reconocido. Revisarlas antes de migrar.';
  end if;
end; $$;
insert into public.variantes(producto_id, clave, nombre, precio, stock, estado, orden)
select p.id, 'comun', 'Común', p.precio, null, 'publicado', 0 from public.productos p
where p.tipo_producto = 'sticker'
and not exists (select 1 from public.variantes v where v.producto_id = p.id and v.clave = 'comun');
update public.productos set controla_stock = (tipo_producto = 'fisico'),
  stock = case when tipo_producto = 'fisico' then coalesce(stock, 0) else null end,
  usa_variantes = case when tipo_producto = 'sticker' then true when tipo_producto = 'plantilla' then false else usa_variantes end;
update public.variantes v set stock = case when p.tipo_producto = 'fisico' then coalesce(v.stock, 0) else null end
from public.productos p where p.id = v.producto_id;
alter table public.variantes alter column clave set not null;

create or replace function public.validar_stock_catalogo()
returns trigger language plpgsql set search_path = '' as $$
declare tipo public.tipo_producto;
begin
  if tg_table_name = 'productos' then
    if tg_op = 'UPDATE' and new.tipo_producto <> old.tipo_producto then raise exception 'El tipo del producto no se puede cambiar.'; end if;
    tipo := new.tipo_producto;
    new.controla_stock := tipo = 'fisico';
    if tipo = 'sticker' then new.usa_variantes := true; end if;
    if tipo = 'plantilla' then new.usa_variantes := false; end if;
  else
    if tg_op = 'UPDATE' and (new.producto_id <> old.producto_id or new.clave <> old.clave) then
      raise exception 'La identidad de la variante no se puede cambiar.';
    end if;
    select tipo_producto into tipo from public.productos where id = new.producto_id for update;
    if tipo = 'plantilla' then raise exception 'Las plantillas no utilizan variantes.'; end if;
    if tipo = 'sticker' and new.clave not in ('comun', 'holografico', 'resistente_agua') then raise exception 'El acabado del sticker no es válido.'; end if;
    if new.precio is null or new.precio < 0 or new.precio = 'NaN'::numeric then raise exception 'El precio de cada variante es obligatorio.'; end if;
    if nullif(trim(new.nombre), '') is null then raise exception 'El nombre de la variante es obligatorio.'; end if;
  end if;
  if tipo = 'fisico' then
    if new.stock is null or new.stock < 0 then raise exception 'El stock físico es obligatorio y no puede ser negativo.'; end if;
  else new.stock := null; end if;
  return new;
end;
$$;
drop trigger if exists stock_por_tipo_producto on public.productos;
create trigger stock_por_tipo_producto before insert or update on public.productos for each row execute function public.validar_stock_catalogo();
drop trigger if exists stock_por_tipo_variante on public.variantes;
create trigger stock_por_tipo_variante before insert or update on public.variantes for each row execute function public.validar_stock_catalogo();

create or replace function public.resumir_variantes_producto()
returns trigger language plpgsql security definer set search_path = '' as $$
declare producto uuid := coalesce(new.producto_id, old.producto_id);
begin
  update public.productos p set
    precio = coalesce((select min(v.precio) from public.variantes v where v.producto_id = p.id and v.estado = 'publicado'), 0),
    stock = case when p.tipo_producto = 'fisico' then coalesce((select sum(v.stock) from public.variantes v where v.producto_id = p.id and v.estado = 'publicado'), 0) else null end
  where p.id = producto and p.usa_variantes;
  return null;
end;
$$;
drop trigger if exists resumen_variantes on public.variantes;
create trigger resumen_variantes after insert or update or delete on public.variantes for each row execute function public.resumir_variantes_producto();

create or replace function public.comprobar_variantes_producto()
returns trigger language plpgsql set search_path = '' as $$
declare producto uuid; p public.productos; total integer; publicadas integer;
begin
  if tg_table_name = 'productos' then producto := coalesce(new.id, old.id);
  else producto := coalesce(new.producto_id, old.producto_id); end if;
  select * into p from public.productos where id = producto;
  if not found then return null; end if;
  select count(*), count(*) filter (where estado = 'publicado') into total, publicadas
  from public.variantes where producto_id = producto and estado <> 'archivado';
  if total > (case when p.tipo_producto = 'sticker' then 3 else 10 end) then raise exception 'Se superó el máximo de variantes del producto.'; end if;
  if p.usa_variantes and p.estado <> 'archivado' and (total = 0 or p.estado = 'publicado' and publicadas = 0) then
    raise exception 'Un producto con variantes necesita al menos una variante; si está publicado, al menos una debe ser visible.';
  end if;
  return null;
end;
$$;
drop trigger if exists comprobar_variantes on public.variantes;
create constraint trigger comprobar_variantes after insert or update or delete on public.variantes
deferrable initially deferred for each row execute function public.comprobar_variantes_producto();
drop trigger if exists comprobar_variantes_padre on public.productos;
create constraint trigger comprobar_variantes_padre after insert or update on public.productos
deferrable initially deferred for each row execute function public.comprobar_variantes_producto();

create or replace function public.limitar_imagenes_por_producto()
returns trigger language plpgsql set search_path = '' as $$
declare cantidad integer; maximo integer := 5;
begin
  if new.producto_id is null then
    if new.variante_id is not null then raise exception 'La imagen de una variante necesita su producto.'; end if;
    return new;
  end if;
  perform 1 from public.productos where id = new.producto_id for update;
  if new.variante_id is not null then
    maximo := 3;
    if not exists (select 1 from public.variantes v join public.productos p on p.id = v.producto_id
      where v.id = new.variante_id and v.producto_id = new.producto_id and p.tipo_producto = 'fisico') then
      raise exception 'La imagen no pertenece a una variante física de este producto.';
    end if;
  end if;
  select count(*) into cantidad from public.imagenes where producto_id = new.producto_id
    and variante_id is not distinct from new.variante_id and id <> new.id;
  if cantidad >= maximo then raise exception 'Se alcanzó el máximo de imágenes de esta galería (%).', maximo; end if;
  return new;
end;
$$;
drop trigger if exists limitar_imagenes_por_producto on public.imagenes;
create trigger limitar_imagenes_por_producto before insert or update of producto_id, variante_id on public.imagenes
for each row execute function public.limitar_imagenes_por_producto();
drop policy if exists "Imágenes públicas visibles" on public.imagenes;
create policy "Imágenes públicas visibles" on public.imagenes for select to anon, authenticated using (
  public.es_administrador() or
  (exists (select 1 from public.productos p where p.id = imagenes.producto_id and p.estado = 'publicado')
    and (variante_id is null or exists (select 1 from public.variantes v where v.id = imagenes.variante_id and v.estado = 'publicado')))
  or exists (select 1 from public.secciones s where s.id = imagenes.seccion_id and s.publicada)
);

-- Una única operación transaccional: no deja productos o variantes guardados a medias.
create or replace function public.guardar_producto_con_variantes(p_id uuid, p_datos jsonb, p_variantes jsonb, p_usuario uuid)
returns uuid language plpgsql set search_path = '' as $$
declare
  producto uuid := coalesce(p_id, gen_random_uuid()); anterior public.productos; tipo public.tipo_producto;
  usar boolean; version jsonb; version_id uuid; previa public.variantes; conservadas uuid[] := '{}'; precio_nuevo numeric; stock_nuevo integer;
begin
  if not public.es_administrador(p_usuario) then raise exception 'No tenés permisos para editar productos.'; end if;
  if p_id is not null then
    select * into anterior from public.productos where id = p_id for update;
    if not found then raise exception 'El producto no existe.'; end if;
    tipo := anterior.tipo_producto;
  else tipo := (p_datos->>'tipo_producto')::public.tipo_producto; end if;
  usar := tipo = 'sticker' or tipo = 'fisico' and coalesce((p_datos->>'usa_variantes')::boolean, false);
  if nullif(trim(p_datos->>'nombre'), '') is null or nullif(trim(p_datos->>'descripcion'), '') is null then
    raise exception 'El nombre y la descripción son obligatorios.';
  end if;
  if jsonb_typeof(p_variantes) is distinct from 'array' then raise exception 'Las variantes no tienen un formato válido.'; end if;
  if usar and (jsonb_array_length(p_variantes) < 1 or jsonb_array_length(p_variantes) > case when tipo = 'sticker' then 3 else 10 end) then
    raise exception 'La cantidad de variantes no es válida.';
  end if;
  if not usar and jsonb_array_length(p_variantes) > 0 then raise exception 'Este producto no utiliza variantes.'; end if;
  precio_nuevo := case when usar then 0 else (p_datos->>'precio')::numeric end;
  stock_nuevo := case when tipo <> 'fisico' then null when usar then 0 else (p_datos->>'stock')::integer end;
  if precio_nuevo is null or precio_nuevo < 0 or precio_nuevo = 'NaN'::numeric then raise exception 'El precio es obligatorio.'; end if;
  if p_id is null then
    insert into public.productos(id, categoria_id, tipo_producto, nombre, slug, sku, descripcion, descripcion_corta,
      precio, stock, controla_stock, usa_variantes, estado, destacado, moneda, orden, meta_titulo, meta_descripcion)
    values (producto, nullif(p_datos->>'categoria_id', '')::uuid, tipo, trim(p_datos->>'nombre'), p_datos->>'slug', null,
      trim(p_datos->>'descripcion'), trim(p_datos->>'descripcion'), precio_nuevo, stock_nuevo, tipo = 'fisico', usar,
      (p_datos->>'estado')::public.estado_publicacion, coalesce((p_datos->>'destacado')::boolean, false), 'ARS',
      coalesce((p_datos->>'orden')::integer, 0), p_datos->>'meta_titulo', p_datos->>'meta_descripcion');
  else
    update public.productos set categoria_id = nullif(p_datos->>'categoria_id', '')::uuid, nombre = trim(p_datos->>'nombre'),
      descripcion = trim(p_datos->>'descripcion'), descripcion_corta = trim(p_datos->>'descripcion'),
      precio = precio_nuevo, stock = stock_nuevo, usa_variantes = usar,
      estado = (p_datos->>'estado')::public.estado_publicacion, destacado = coalesce((p_datos->>'destacado')::boolean, false),
      meta_titulo = p_datos->>'meta_titulo', meta_descripcion = p_datos->>'meta_descripcion' where id = producto;
  end if;
  for version in select value from jsonb_array_elements(p_variantes) loop
    version_id := coalesce(nullif(version->>'id', '')::uuid, gen_random_uuid());
    select * into previa from public.variantes where id = version_id;
    if found and previa.producto_id <> producto then raise exception 'La variante pertenece a otro producto.'; end if;
    if version_id = any(conservadas) then raise exception 'La variante está repetida.'; end if;
    conservadas := array_append(conservadas, version_id);
    if previa.id is not null then
      if previa.clave is distinct from version->>'clave' then raise exception 'La identidad de la variante no se puede cambiar.'; end if;
      update public.variantes set nombre = trim(version->>'nombre'), descripcion = coalesce(version->>'descripcion', ''),
        precio = (version->>'precio')::numeric, stock = case when tipo = 'fisico' then (version->>'stock')::integer else null end,
        estado = (version->>'estado')::public.estado_publicacion, orden = coalesce((version->>'orden')::integer, 0)
      where id = version_id;
    else
    insert into public.variantes(id, producto_id, clave, nombre, descripcion, precio, stock, estado, orden)
    values (version_id, producto, version->>'clave', trim(version->>'nombre'), coalesce(version->>'descripcion', ''),
      (version->>'precio')::numeric, case when tipo = 'fisico' then (version->>'stock')::integer else null end,
      (version->>'estado')::public.estado_publicacion, coalesce((version->>'orden')::integer, 0));
    end if;
    if previa.id is not null and previa.precio is distinct from (version->>'precio')::numeric then
      insert into public.historial_precios(producto_id, variante_id, precio_anterior, precio_nuevo, usuario_id)
      values (producto, version_id, previa.precio, (version->>'precio')::numeric, p_usuario);
    end if;
    if tipo = 'fisico' and coalesce(previa.stock, 0) <> (version->>'stock')::integer then
      insert into public.movimientos_stock(producto_id, variante_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
      values (producto, version_id, 'ajuste', abs(coalesce(previa.stock, 0) - (version->>'stock')::integer), previa.stock,
        (version->>'stock')::integer, 'Edición administrativa de variante', p_usuario);
    end if;
  end loop;
  update public.variantes set estado = 'archivado' where producto_id = producto and not (id = any(conservadas)) and estado <> 'archivado';
  if not usar then
    if p_id is not null and anterior.precio is distinct from precio_nuevo then
      insert into public.historial_precios(producto_id, precio_anterior, precio_nuevo, usuario_id) values (producto, anterior.precio, precio_nuevo, p_usuario);
    end if;
    if tipo = 'fisico' and coalesce(anterior.stock, 0) <> stock_nuevo then
      insert into public.movimientos_stock(producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
      values (producto, 'ajuste', abs(coalesce(anterior.stock, 0) - stock_nuevo), anterior.stock, stock_nuevo, 'Edición administrativa', p_usuario);
    end if;
  end if;
  return producto;
end;
$$;
revoke all on function public.guardar_producto_con_variantes(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.guardar_producto_con_variantes(uuid, jsonb, jsonb, uuid) to service_role;
revoke all on function public.asignar_sku_catalogo(), public.resumir_variantes_producto() from public, anon, authenticated;

commit;

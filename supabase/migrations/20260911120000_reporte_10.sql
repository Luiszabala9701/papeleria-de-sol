-- Ajustes de datos del Reporte 10.
-- Completa los tres acabados de cada sticker y agrega la ficha descriptiva
-- solicitada sin borrar textos ni precios configurados previamente.
begin;
set constraints all immediate;

with acabados(clave, nombre, orden) as (
  values
    ('comun', 'Común', 0),
    ('holografico', 'Holográfico', 1),
    ('resistente_agua', 'Resistente al agua', 2)
), stickers as (
  select producto.id,
    coalesce(
      (select variante.precio
       from public.variantes as variante
       where variante.producto_id = producto.id and variante.clave = 'comun'),
      producto.precio,
      0
    ) as precio_referencia
  from public.productos as producto
  where producto.tipo_producto = 'sticker'
)
insert into public.variantes(
  producto_id, clave, nombre, precio, stock, estado, orden
)
select
  sticker.id, acabado.clave, acabado.nombre, sticker.precio_referencia,
  null, 'publicado'::public.estado_publicacion, acabado.orden
from stickers as sticker
cross join acabados as acabado
where not exists (
  select 1
  from public.variantes as existente
  where existente.producto_id = sticker.id and existente.clave = acabado.clave
);

-- Todos los acabados pedidos quedan visibles. Se normaliza nombre y orden, pero
-- nunca se reemplaza el precio de una variante que ya existía.
with acabados(clave, nombre, orden) as (
  values
    ('comun', 'Común', 0),
    ('holografico', 'Holográfico', 1),
    ('resistente_agua', 'Resistente al agua', 2)
)
update public.variantes as variante
set nombre = acabado.nombre,
    estado = 'publicado'::public.estado_publicacion,
    orden = acabado.orden,
    stock = null
from public.productos as producto, acabados as acabado
where producto.id = variante.producto_id
  and producto.tipo_producto = 'sticker'
  and variante.clave = acabado.clave;

with detalle(valor) as (
  values (E'Papel autoadhesivo\nTamaño: 5 cm\nImpresión: Full color'::text)
)
update public.productos as producto
set descripcion = case
      when position(detalle.valor in coalesce(producto.descripcion, '')) > 0
        then producto.descripcion
      when nullif(trim(producto.descripcion), '') is null
        then detalle.valor
      else rtrim(producto.descripcion) || E'\n\n' || detalle.valor
    end,
    descripcion_corta = case
      when position(detalle.valor in coalesce(producto.descripcion_corta, '')) > 0
        then producto.descripcion_corta
      when nullif(trim(producto.descripcion_corta), '') is null
        then detalle.valor
      else rtrim(producto.descripcion_corta) || E'\n\n' || detalle.valor
    end
from detalle
where producto.tipo_producto = 'sticker';

commit;

-- Ajuste final de precios de stickers.
-- Común: $199. Cualquier otro acabado: $499.
begin;

update public.variantes as variante
set precio = case
  when variante.clave = 'comun' then 199
  else 499
end
from public.productos as producto
where producto.id = variante.producto_id
  and producto.tipo_producto = 'sticker'
  and variante.precio is distinct from case
    when variante.clave = 'comun' then 199
    else 499
  end;

update public.productos
set precio = 199
where tipo_producto = 'sticker'
  and precio is distinct from 199;

commit;

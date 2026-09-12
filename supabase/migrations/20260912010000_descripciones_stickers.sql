-- Descripción uniforme para todos los stickers.
begin;

-- Reafirma también los precios solicitados para que este ajuste pueda aplicarse
-- de forma segura aunque la migración de precios anterior no haya impactado.
update public.variantes as variante
set precio = case
  when variante.clave = 'comun' then 199
  else 2499
end
from public.productos as producto
where producto.id = variante.producto_id
  and producto.tipo_producto = 'sticker'
  and variante.precio is distinct from case
    when variante.clave = 'comun' then 199
    else 2499
  end;

update public.productos
set precio = 199,
    descripcion = E'Papel autoadhesivo\nTamaño: 5 cm\nImpresión: Full color',
    descripcion_corta = E'Papel autoadhesivo\nTamaño: 5 cm\nImpresión: Full color'
where tipo_producto = 'sticker'
  and (
    precio is distinct from 199
    or descripcion is distinct from E'Papel autoadhesivo\nTamaño: 5 cm\nImpresión: Full color'
    or descripcion_corta is distinct from E'Papel autoadhesivo\nTamaño: 5 cm\nImpresión: Full color'
  );

commit;

-- Actualiza el precio de venta de todos los productos de tipo sticker.
-- Ejecutar primero en Supabase de PRUEBAS y, tras verificarlo, en producción.

update public.productos
set precio = 500
where tipo_producto = 'sticker'
  and precio is distinct from 500;

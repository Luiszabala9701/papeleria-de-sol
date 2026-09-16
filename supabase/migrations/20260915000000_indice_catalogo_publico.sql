-- Acelera el listado público paginado sin cambiar datos ni permisos.
create index if not exists productos_catalogo_publico_idx
  on public.productos (tipo_producto, estado, orden, creado_en desc, id);

import { crearLineaSeleccion } from '../servicios/variantes.js';

const detalle = document.querySelector('[data-detalle-variantes]');
if (detalle) {
  const producto = JSON.parse(detalle.dataset.productoVenta);
  const selector = detalle.querySelector('[data-elegir-variante]');
  const boton = detalle.querySelector('[data-agregar-producto]');
  const cantidad = detalle.querySelector('[data-selector-cantidad]');
  const dinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: producto.moneda || 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function cambiarVersion() {
    const variante = producto.variantes.find(v => v.id === selector.value);
    const linea = variante ? crearLineaSeleccion(producto, variante) : null;
    const sinStock = linea?.controla_stock && linea.stock === 0;
    boton.disabled = !linea || sinStock;
    boton.dataset.producto = JSON.stringify(linea);
    boton.textContent = !linea ? 'Elegí una versión' : sinStock ? 'Sin stock' : boton.dataset.textoAgregar;
    cantidad.dataset.pendienteVariante = linea ? 'false' : 'true';
    cantidad.dataset.maximo = String(linea?.stock ?? 9999);
    cantidad.dispatchEvent(new Event('reiniciar-cantidad'));
    detalle.querySelector('[data-precio-variante]').textContent = variante ? dinero.format(variante.precio) : `Desde ${dinero.format(producto.precio)}`;
    detalle.querySelector('[data-sku-variante]').textContent = producto.sku || variante?.sku || '';
    const descripcion = detalle.querySelector('[data-descripcion-variante]');
    descripcion.textContent = variante?.descripcion || '';
    descripcion.hidden = !descripcion.textContent;
    const stock = detalle.querySelector('[data-stock-variante]');
    if (stock) stock.textContent = !linea ? 'Elegí una variante' : sinStock ? 'Sin stock' : 'En stock';
    const unidades = detalle.querySelector('[data-unidades-variante]');
    if (unidades) unidades.textContent = !linea ? 'El stock corresponde a la variante elegida.' : `${linea.stock} unidades disponibles.`;
    detalle.querySelector('[data-galeria-producto]').dispatchEvent(new CustomEvent('cambiar-imagenes', {
      detail: { imagenes: variante?.imagenes?.length ? variante.imagenes : producto.imagenes, nombre: producto.nombre },
    }));
  }
  selector?.addEventListener('change', cambiarVersion);
}

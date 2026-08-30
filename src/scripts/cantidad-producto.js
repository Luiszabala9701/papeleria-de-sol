const selectorCantidad = document.querySelector('[data-selector-cantidad]');
const botonAgregarProducto = document.querySelector('[data-agregar-producto]');

if (selectorCantidad && botonAgregarProducto) {
  const botonRestar = selectorCantidad.querySelector('[data-selector-cantidad-restar]');
  const botonSumar = selectorCantidad.querySelector('[data-selector-cantidad-sumar]');
  const valorCantidad = selectorCantidad.querySelector('[data-selector-cantidad-valor]');
  const controlaStock = selectorCantidad.dataset.controlaStock === 'true';
  const maximo = Math.max(0, Math.floor(Number(selectorCantidad.dataset.maximo) || 0));
  let cantidad = 1;

  function actualizarSelector() {
    if (valorCantidad) valorCantidad.textContent = String(cantidad);
    botonAgregarProducto.dataset.cantidad = String(cantidad);

    if (botonRestar) botonRestar.disabled = cantidad <= 1;
    if (botonSumar) botonSumar.disabled = controlaStock && cantidad >= maximo;
  }

  botonRestar?.addEventListener('click', () => {
    cantidad = Math.max(1, cantidad - 1);
    actualizarSelector();
  });

  botonSumar?.addEventListener('click', () => {
    cantidad = controlaStock ? Math.min(maximo, cantidad + 1) : cantidad + 1;
    actualizarSelector();
  });

  actualizarSelector();
}

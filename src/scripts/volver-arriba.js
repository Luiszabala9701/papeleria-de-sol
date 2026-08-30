const botonVolverArriba = document.querySelector('#volver-arriba');

function actualizarBotonVolverArriba() {
  if (!botonVolverArriba) return;
  botonVolverArriba.hidden = window.scrollY < 500;
}

botonVolverArriba?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('scroll', actualizarBotonVolverArriba, { passive: true });
actualizarBotonVolverArriba();

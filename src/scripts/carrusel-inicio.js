document.querySelectorAll('[data-carrusel-inicio]').forEach((carrusel) => {
  const diapositivas = Array.from(carrusel.querySelectorAll('[data-diapo-carrusel]'));
  const indicador = carrusel.querySelector('[data-carrusel-indicador]');
  let actual = 0;
  let inicioDeslizamiento = null;

  function mostrar(indice) {
    if (!diapositivas.length) return;
    actual = (indice + diapositivas.length) % diapositivas.length;
    diapositivas.forEach((diapositiva, posicion) => {
      diapositiva.hidden = posicion !== actual;
    });
    if (indicador) indicador.textContent = `${actual + 1} / ${diapositivas.length}`;
  }

  carrusel.querySelector('[data-carrusel-anterior]')?.addEventListener('click', () => mostrar(actual - 1));
  carrusel.querySelector('[data-carrusel-siguiente]')?.addEventListener('click', () => mostrar(actual + 1));
  carrusel.addEventListener('pointerdown', (evento) => {
    if (evento.pointerType !== 'mouse') inicioDeslizamiento = evento.clientX;
  });
  carrusel.addEventListener('pointerup', (evento) => {
    if (inicioDeslizamiento === null) return;
    const distancia = evento.clientX - inicioDeslizamiento;
    inicioDeslizamiento = null;
    if (Math.abs(distancia) < 45) return;
    mostrar(actual + (distancia < 0 ? 1 : -1));
  });
  carrusel.addEventListener('pointercancel', () => { inicioDeslizamiento = null; });
});

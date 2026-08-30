document.querySelectorAll('[data-galeria-producto]').forEach((galeria) => {
  const imagenPrincipal = galeria.querySelector('[data-imagen-principal-galeria]');
  const botonPrincipal = galeria.querySelector('[data-galeria-principal]');
  const visor = galeria.querySelector('[data-visor-galeria]');
  const imagenVisor = galeria.querySelector('[data-imagen-visor-galeria]');

  function seleccionarImagen(boton) {
    if (!imagenPrincipal || !boton) return;
    imagenPrincipal.src = boton.dataset.imagenSrc || imagenPrincipal.src;
    imagenPrincipal.alt = boton.dataset.imagenAlt || imagenPrincipal.alt;
    if (imagenVisor) {
      imagenVisor.src = imagenPrincipal.src;
      imagenVisor.alt = imagenPrincipal.alt;
    }

    galeria.querySelectorAll('[data-miniatura-galeria]').forEach((miniatura) => {
      const activa = miniatura === boton;
      miniatura.classList.toggle('activa', activa);
      miniatura.setAttribute('aria-pressed', String(activa));
    });
  }

  galeria.querySelectorAll('[data-miniatura-galeria]').forEach((boton) => {
    boton.addEventListener('click', () => seleccionarImagen(boton));
  });

  botonPrincipal?.addEventListener('click', () => {
    if (!visor?.open) visor?.showModal();
  });
  galeria.querySelector('[data-cerrar-visor-galeria]')?.addEventListener('click', () => visor?.close());
  visor?.addEventListener('click', (evento) => {
    if (evento.target === visor) visor.close();
  });
});

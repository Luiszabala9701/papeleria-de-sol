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

  galeria.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-miniatura-galeria]');
    if (boton) seleccionarImagen(boton);
  });

  galeria.addEventListener('cambiar-imagenes', (evento) => {
    const { imagenes, nombre } = evento.detail;
    const lista = imagenes.length ? imagenes : [{ url_publica: '/stickers/1.webp' }];
    const miniaturas = galeria.querySelector('.miniaturas-galeria');
    miniaturas.replaceChildren();
    miniaturas.hidden = lista.length < 2;
    lista.forEach((imagen, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'miniatura-galeria';
      boton.dataset.miniaturaGaleria = '';
      boton.dataset.imagenSrc = imagen.url_publica;
      boton.dataset.imagenAlt = imagen.texto_alternativo || nombre;
      boton.setAttribute('aria-label', `Ver imagen ${indice + 1} de ${lista.length}`);
      const foto = document.createElement('img');
      foto.src = imagen.url_publica;
      foto.alt = '';
      foto.width = foto.height = 96;
      boton.append(foto);
      miniaturas.append(boton);
    });
    seleccionarImagen(miniaturas.firstElementChild);
  });

  botonPrincipal?.addEventListener('click', () => {
    if (!visor?.open) visor?.showModal();
  });
  galeria.querySelector('[data-cerrar-visor-galeria]')?.addEventListener('click', () => visor?.close());
  visor?.addEventListener('click', (evento) => {
    if (evento.target === visor) visor.close();
  });
});

import { crearSrcsetImagen, crearUrlImagenOptimizada } from '../servicios/imagenes.ts';

document.querySelectorAll('[data-galeria-producto]').forEach((galeria) => {
  const imagenPrincipal = galeria.querySelector('[data-imagen-principal-galeria]');
  const botonPrincipal = galeria.querySelector('[data-galeria-principal]');
  const botonAnterior = galeria.querySelector('[data-galeria-anterior]');
  const botonSiguiente = galeria.querySelector('[data-galeria-siguiente]');
  const visor = galeria.querySelector('[data-visor-galeria]');
  const imagenVisor = galeria.querySelector('[data-imagen-visor-galeria]');

  const obtenerMiniaturas = () => [...galeria.querySelectorAll('[data-miniatura-galeria]')];

  function actualizarNavegacion() {
    const hayVarias = obtenerMiniaturas().length > 1;
    if (botonAnterior) botonAnterior.hidden = !hayVarias;
    if (botonSiguiente) botonSiguiente.hidden = !hayVarias;
  }

  function seleccionarImagen(boton) {
    if (!imagenPrincipal || !boton) return;
    const original = boton.dataset.imagenSrc || imagenPrincipal.src;
    const srcset = crearSrcsetImagen(original, [480, 709, 960, 1200], 82);
    if (srcset) imagenPrincipal.setAttribute('srcset', srcset);
    else imagenPrincipal.removeAttribute('srcset');
    imagenPrincipal.src = crearUrlImagenOptimizada(original, 960, 82);
    imagenPrincipal.alt = boton.dataset.imagenAlt || imagenPrincipal.alt;
    if (imagenVisor) {
      imagenVisor.src = crearUrlImagenOptimizada(original, 1200, 84);
      imagenVisor.alt = imagenPrincipal.alt;
    }

    galeria.querySelectorAll('[data-miniatura-galeria]').forEach((miniatura) => {
      const activa = miniatura === boton;
      miniatura.classList.toggle('activa', activa);
      miniatura.setAttribute('aria-pressed', String(activa));
    });
    boton.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function moverImagen(direccion) {
    const miniaturas = obtenerMiniaturas();
    if (miniaturas.length < 2) return;
    const actual = miniaturas.findIndex((miniatura) => miniatura.classList.contains('activa'));
    const siguiente = (Math.max(0, actual) + direccion + miniaturas.length) % miniaturas.length;
    seleccionarImagen(miniaturas[siguiente]);
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
      boton.setAttribute('aria-pressed', 'false');
      const foto = document.createElement('img');
      foto.src = crearUrlImagenOptimizada(imagen.url_publica, 192, 76);
      foto.alt = '';
      foto.width = foto.height = 96;
      foto.loading = 'lazy';
      foto.decoding = 'async';
      boton.append(foto);
      miniaturas.append(boton);
    });
    seleccionarImagen(miniaturas.firstElementChild);
    actualizarNavegacion();
  });

  botonAnterior?.addEventListener('click', () => moverImagen(-1));
  botonSiguiente?.addEventListener('click', () => moverImagen(1));

  let inicioDeslizamiento = null;
  let omitirAmpliacion = false;
  botonPrincipal?.addEventListener('pointerdown', (evento) => {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return;
    inicioDeslizamiento = { x: evento.clientX, y: evento.clientY };
  });
  botonPrincipal?.addEventListener('pointerup', (evento) => {
    if (!inicioDeslizamiento) return;
    const diferenciaX = evento.clientX - inicioDeslizamiento.x;
    const diferenciaY = evento.clientY - inicioDeslizamiento.y;
    inicioDeslizamiento = null;
    if (Math.abs(diferenciaX) < 42 || Math.abs(diferenciaX) <= Math.abs(diferenciaY)) return;
    omitirAmpliacion = true;
    moverImagen(diferenciaX < 0 ? 1 : -1);
    evento.preventDefault();
  });
  botonPrincipal?.addEventListener('pointercancel', () => { inicioDeslizamiento = null; });
  botonPrincipal?.addEventListener('keydown', (evento) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(evento.key)) return;
    evento.preventDefault();
    moverImagen(evento.key === 'ArrowRight' ? 1 : -1);
  });

  botonPrincipal?.addEventListener('click', (evento) => {
    if (omitirAmpliacion) {
      omitirAmpliacion = false;
      evento.preventDefault();
      return;
    }
    if (!visor?.open) visor?.showModal();
  });
  galeria.querySelector('[data-cerrar-visor-galeria]')?.addEventListener('click', () => visor?.close());
  visor?.addEventListener('click', (evento) => {
    if (evento.target === visor) visor.close();
  });
  actualizarNavegacion();
});

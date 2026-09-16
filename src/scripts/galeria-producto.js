import { crearSrcsetImagen, crearUrlImagenOptimizada } from '../servicios/imagenes.ts';

document.querySelectorAll('[data-galeria-producto]').forEach((galeria) => {
  const imagenPrincipal = galeria.querySelector('[data-imagen-principal-galeria]');
  const botonPrincipal = galeria.querySelector('[data-galeria-principal]');
  const visor = galeria.querySelector('[data-visor-galeria]');
  const imagenVisor = galeria.querySelector('[data-imagen-visor-galeria]');

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
      foto.src = crearUrlImagenOptimizada(imagen.url_publica, 192, 76);
      foto.alt = '';
      foto.width = foto.height = 96;
      foto.loading = 'lazy';
      foto.decoding = 'async';
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

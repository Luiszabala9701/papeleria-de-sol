function obtenerContenedorProtegido(elemento) {
  return elemento instanceof Element
    ? elemento.closest('[data-proteccion-imagen]')
    : null;
}

document.addEventListener('contextmenu', (evento) => {
  if (!obtenerContenedorProtegido(evento.target)) return;

  evento.preventDefault();
});

document.addEventListener('dragstart', (evento) => {
  if (!obtenerContenedorProtegido(evento.target)) return;

  evento.preventDefault();
});

document.addEventListener('selectstart', (evento) => {
  if (!obtenerContenedorProtegido(evento.target)) return;

  evento.preventDefault();
});

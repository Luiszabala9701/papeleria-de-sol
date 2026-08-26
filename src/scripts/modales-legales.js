const modales = {
  privacidad: document.querySelector('#modal-privacidad'),
  terminos: document.querySelector('#modal-terminos'),
};

let activadorAnterior = null;

function cerrarDocumentoLegal() {
  const modalAbierto = Object.values(modales).find((modal) => modal?.open);
  modalAbierto?.close();
  activadorAnterior?.focus();
  activadorAnterior = null;
}

function abrirDocumentoLegal(tipo, activador) {
  const modal = modales[tipo];
  if (!modal) return;

  activadorAnterior = activador instanceof HTMLElement ? activador : document.activeElement;
  window.cerrarAvisoWhatsApp?.();
  Object.values(modales).forEach((otroModal) => {
    if (otroModal?.open) otroModal.close();
  });
  modal.showModal();
  modal.querySelector('[data-cerrar-documento-legal]')?.focus();
}

document.addEventListener('click', (evento) => {
  const enlace = evento.target.closest('[data-documento-legal]');
  if (!enlace) return;

  const tipo = enlace.dataset.documentoLegal;
  if (!modales[tipo]) return;
  evento.preventDefault();
  abrirDocumentoLegal(tipo, enlace);
});

document.querySelectorAll('[data-cerrar-documento-legal]').forEach((boton) => {
  boton.addEventListener('click', cerrarDocumentoLegal);
});

Object.values(modales).forEach((modal) => {
  modal?.addEventListener('click', (evento) => {
    if (evento.target === modal) cerrarDocumentoLegal();
  });
});

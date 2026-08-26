const modal = document.querySelector('#aviso-whatsapp');
const botonCerrar = document.querySelector('#cerrar-aviso-whatsapp');
const botonCancelar = document.querySelector('#cancelar-aviso-whatsapp');
const botonConfirmar = document.querySelector('#confirmar-aviso-whatsapp');
const descripcion = document.querySelector('#descripcion-aviso-whatsapp');
const detalle = document.querySelector('#detalle-aviso-whatsapp');

let activadorAnterior = null;

function esEnlaceWhatsApp(enlace) {
  try {
    const url = new URL(enlace.href);
    const dominio = url.hostname.toLowerCase();
    return dominio === 'wa.me' || dominio === 'api.whatsapp.com' || dominio === 'web.whatsapp.com';
  } catch {
    return false;
  }
}

function cerrarAvisoWhatsApp() {
  if (!modal?.open) return;

  modal.close();
  activadorAnterior?.focus();
  activadorAnterior = null;
}

function configurarContenido(tipo) {
  if (!descripcion || !detalle) return;

  if (tipo === 'seleccion') {
    descripcion.textContent = 'Se abrirá WhatsApp con tu selección como mensaje prellenado. La disponibilidad, el precio final, el pago y la entrega se coordinan por ese medio.';
    detalle.textContent = 'Tu selección queda guardada solamente en este navegador. Podés revisar el mensaje antes de enviarlo por WhatsApp.';
    return;
  }

  descripcion.textContent = 'Se abrirá WhatsApp para que puedas escribirle a Papelería de Sol. La disponibilidad, el precio final, el pago y la entrega se coordinan por ese medio.';
  detalle.textContent = 'Esta página no procesa pagos ni guarda tus datos de contacto.';
}

function abrirAvisoWhatsApp(enlace, opciones = {}) {
  if (!modal || !botonConfirmar || !enlace) {
    window.open(enlace, '_blank', 'noopener,noreferrer');
    return;
  }

  activadorAnterior = opciones.activador instanceof HTMLElement ? opciones.activador : document.activeElement;
  configurarContenido(opciones.tipo);
  botonConfirmar.href = enlace;
  modal.showModal();
  botonConfirmar.focus();
}

document.addEventListener('click', (evento) => {
  const enlace = evento.target.closest('a[href]');
  if (!enlace || enlace.closest('#aviso-whatsapp') || enlace.hasAttribute('data-sin-aviso-whatsapp')) return;
  if (!esEnlaceWhatsApp(enlace)) return;

  evento.preventDefault();
  abrirAvisoWhatsApp(enlace.href, { activador: enlace });
});

botonCerrar?.addEventListener('click', cerrarAvisoWhatsApp);
botonCancelar?.addEventListener('click', cerrarAvisoWhatsApp);

modal?.addEventListener('click', (evento) => {
  if (evento.target === modal) cerrarAvisoWhatsApp();
});

modal?.addEventListener('close', () => {
  if (document.activeElement !== botonConfirmar) return;
  activadorAnterior?.focus();
  activadorAnterior = null;
});

window.abrirAvisoWhatsApp = abrirAvisoWhatsApp;
window.cerrarAvisoWhatsApp = cerrarAvisoWhatsApp;

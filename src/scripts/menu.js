const botonMenu = document.querySelector('#boton-menu');
const menuPrincipal = document.querySelector('#menu-principal');

function cerrarMenu() {
  if (!botonMenu || !menuPrincipal) return;

  botonMenu.setAttribute('aria-expanded', 'false');
  menuPrincipal.classList.remove('abierto');
  document.body.classList.remove('menu-abierto');
}

botonMenu?.addEventListener('click', () => {
  const quedaraAbierto = botonMenu.getAttribute('aria-expanded') !== 'true';
  botonMenu.setAttribute('aria-expanded', String(quedaraAbierto));
  menuPrincipal?.classList.toggle('abierto', quedaraAbierto);
  document.body.classList.toggle('menu-abierto', quedaraAbierto);
});

menuPrincipal?.addEventListener('click', (evento) => {
  if (evento.target.closest('a')) cerrarMenu();
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') cerrarMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 980) cerrarMenu();
});

const formularioBusqueda = document.querySelector('#formulario-busqueda-catalogo');
const buscador = document.querySelector('#buscador-catalogo');
const filtroCategoria = document.querySelector('#filtro-categoria');

function desactivarCamposVacios() {
  [buscador, filtroCategoria].forEach((campo) => {
    if (campo && !campo.value.trim()) campo.disabled = true;
  });
}

formularioBusqueda?.addEventListener('submit', desactivarCamposVacios);
filtroCategoria?.addEventListener('change', () => formularioBusqueda?.requestSubmit());

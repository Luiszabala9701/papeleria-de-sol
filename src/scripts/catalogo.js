import { crearUrlCatalogo, obtenerPaginaCatalogo, tituloPaginaCatalogo } from '../servicios/catalogo.js';
import { crearTituloSeo, crearUrlAbsoluta } from '../servicios/seo';

const datosCatalogo = document.querySelector('#datos-catalogo');
const galeria = document.querySelector('#galeria-catalogo');
const formularioBusqueda = document.querySelector('#formulario-busqueda-catalogo');
const buscador = document.querySelector('#buscador-catalogo');
const filtroCategoria = document.querySelector('#filtro-categoria');
const informacionResultados = document.querySelector('#informacion-resultados');
const informacionPagina = document.querySelector('#informacion-pagina-catalogo');
const botonAnterior = document.querySelector('#pagina-anterior');
const botonSiguiente = document.querySelector('#pagina-siguiente');

let paginaActual = 1;
let productos = [];
let textos = {};
let tipoCatalogo = 'sticker';

try {
  const datos = JSON.parse(datosCatalogo?.textContent || '{}');
  productos = Array.isArray(datos) ? datos : Array.isArray(datos.productos) ? datos.productos : [];
  textos = datos.textos || {};
  tipoCatalogo = datos.tipo || 'sticker';
} catch {
  productos = [];
  textos = {};
}

function imagenSegura(url) {
  const valor = String(url || '');
  return valor.startsWith('/') || valor.startsWith('https://')
    ? valor
    : '/stickers/1.webp';
}

function datosProductoCarrito(producto) {
  const imagen = producto.imagenes?.find((elemento) => elemento.es_principal) || producto.imagenes?.[0];
  return {
    id: producto.id,
    nombre: producto.nombre,
    sku: producto.sku || '',
    slug: producto.slug,
    tipo_producto: producto.tipo_producto,
    precio: producto.precio,
    moneda: producto.moneda,
    imagen: imagenSegura(imagen?.url_publica),
    controla_stock: producto.controla_stock === true,
    stock: producto.controla_stock ? Math.max(0, Math.floor(Number(producto.stock) || 0)) : null,
  };
}

function crearTarjeta(producto) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-producto';
  tarjeta.dataset.tipo = producto.tipo_producto;

  const enlaceImagen = document.createElement('a');
  enlaceImagen.className = 'imagen-producto';
  enlaceImagen.href = `/productos/${encodeURIComponent(producto.slug)}`;
  enlaceImagen.tabIndex = -1;
  enlaceImagen.setAttribute('aria-hidden', 'true');

  const esSticker = producto.tipo_producto === 'sticker';
  if (esSticker) enlaceImagen.dataset.proteccionImagen = 'sticker';

  const imagenPrincipal = producto.imagenes?.find((imagen) => imagen.es_principal) || producto.imagenes?.[0];
  const imagen = document.createElement('img');
  imagen.src = imagenSegura(imagenPrincipal?.url_publica);
  imagen.alt = imagenPrincipal?.texto_alternativo || producto.nombre;
  imagen.width = 709;
  imagen.height = 709;
  imagen.loading = 'lazy';
  imagen.decoding = 'async';
  imagen.draggable = !esSticker;
  enlaceImagen.append(imagen);

  const contenido = document.createElement('div');
  contenido.className = 'contenido-producto';

  const tipo = document.createElement('p');
  tipo.className = 'tipo-producto';
  tipo.textContent = producto.tipo_producto === 'fisico'
    ? (textos.tipoFisico || 'Producto físico')
    : producto.tipo_producto;

  const titulo = document.createElement('h3');
  const enlaceTitulo = document.createElement('a');
  enlaceTitulo.href = `/productos/${encodeURIComponent(producto.slug)}`;
  enlaceTitulo.textContent = producto.nombre;
  titulo.append(enlaceTitulo);

  const descripcion = document.createElement('p');
  descripcion.className = 'descripcion-producto';
  descripcion.textContent = producto.descripcion || '';

  const pie = document.createElement('div');
  pie.className = 'pie-producto';
  const precio = document.createElement('strong');
  precio.className = 'precio-producto';
  precio.textContent = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: producto.moneda || 'ARS',
    maximumFractionDigits: 0,
  }).format(producto.precio);

  const agregar = document.createElement('button');
  agregar.type = 'button';
  agregar.className = 'boton-agregar-producto';
  agregar.dataset.agregarProducto = '';
  agregar.dataset.producto = JSON.stringify(datosProductoCarrito(producto));
  agregar.setAttribute('aria-label', `Agregar ${producto.nombre} a mi selección`);
  const sinStock = producto.controla_stock && Math.max(0, Number(producto.stock) || 0) === 0;
  agregar.disabled = sinStock;
  agregar.textContent = sinStock ? 'Sin stock' : (textos.agregar || 'Agregar');

  pie.append(precio, agregar);
  contenido.append(tipo, titulo, descripcion, pie);
  tarjeta.append(enlaceImagen, contenido);
  return tarjeta;
}

function actualizarEnlace(enlace, pagina, estado, habilitado) {
  if (!enlace) return;
  if (habilitado) {
    enlace.href = crearUrlCatalogo(location.pathname, { ...estado, pagina });
    enlace.removeAttribute('aria-disabled');
    enlace.removeAttribute('tabindex');
  } else {
    enlace.removeAttribute('href');
    enlace.setAttribute('aria-disabled', 'true');
    enlace.tabIndex = -1;
  }
}

function renderizar(reconstruir = true) {
  if (!galeria) return;

  const parametros = new URLSearchParams({
    buscar: buscador?.value || '',
    categoria: filtroCategoria?.value || '',
    pagina: String(paginaActual),
  });
  const estado = obtenerPaginaCatalogo(productos, parametros);
  const { visibles, totalPaginas, totalProductos } = estado;
  paginaActual = estado.pagina;

  if (reconstruir) {
    galeria.replaceChildren();
    if (visibles.length === 0) {
      const vacio = document.createElement('div');
      vacio.className = 'estado-vacio';
      vacio.style.gridColumn = '1 / -1';
      const texto = document.createElement('p');
      texto.textContent = textos.resultadosVacios || 'No encontramos productos con esos filtros.';
      vacio.append(texto);
      galeria.append(vacio);
    } else {
      const fragmento = document.createDocumentFragment();
      visibles.forEach((producto) => fragmento.append(crearTarjeta(producto)));
      galeria.append(fragmento);
    }
  }

  if (informacionResultados) {
    informacionResultados.textContent = `${totalProductos} producto${totalProductos === 1 ? '' : 's'}`;
  }
  if (informacionPagina) informacionPagina.textContent = `${textos.pagina || 'Página'} ${paginaActual} de ${totalPaginas}`;
  actualizarEnlace(botonAnterior, paginaActual - 1, estado, paginaActual > 1);
  actualizarEnlace(botonSiguiente, paginaActual + 1, estado, paginaActual < totalPaginas);
  if (reconstruir) {
    const ruta = crearUrlCatalogo(location.pathname, estado);
    history.pushState(null, '', ruta);
    document.title = crearTituloSeo(tituloPaginaCatalogo(tipoCatalogo, paginaActual));
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', crearUrlAbsoluta(ruta));
    document.querySelector('meta[name="robots"]')?.setAttribute('content', estado.tieneFiltros ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    const datosColeccion = document.querySelector('#datos-coleccion');
    if (datosColeccion) {
      const coleccion = JSON.parse(datosColeccion.textContent);
      coleccion.name = tituloPaginaCatalogo(tipoCatalogo, paginaActual);
      coleccion.url = crearUrlAbsoluta(ruta);
      coleccion.mainEntity.itemListElement = visibles.map((producto, indice) => ({
        '@type': 'ListItem', position: indice + 1, name: producto.nombre,
        url: crearUrlAbsoluta(`/productos/${producto.slug}`),
      }));
      datosColeccion.textContent = JSON.stringify(coleccion);
    }
  }
}

function reiniciarYRenderizar() {
  paginaActual = 1;
  renderizar();
}

const parametros = new URLSearchParams(location.search);
paginaActual = obtenerPaginaCatalogo(productos, parametros).pagina;
if (buscador) buscador.value = parametros.get('buscar') || '';
if (filtroCategoria) filtroCategoria.value = parametros.get('categoria') || '';

formularioBusqueda?.addEventListener('submit', (evento) => {
  evento.preventDefault();
  reiniciarYRenderizar();
});
filtroCategoria?.addEventListener('change', reiniciarYRenderizar);

botonAnterior?.addEventListener('click', (evento) => {
  if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  if (botonAnterior.getAttribute('aria-disabled') === 'true') return;
  paginaActual -= 1;
  renderizar();
  document.querySelector('#catalogo-resultados')?.scrollIntoView({ behavior: 'smooth' });
});

botonSiguiente?.addEventListener('click', (evento) => {
  if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  if (botonSiguiente.getAttribute('aria-disabled') === 'true') return;
  paginaActual += 1;
  renderizar();
  document.querySelector('#catalogo-resultados')?.scrollIntoView({ behavior: 'smooth' });
});

window.addEventListener('popstate', () => location.reload());

renderizar(false);

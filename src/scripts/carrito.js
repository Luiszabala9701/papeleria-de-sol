const CLAVE_CARRITO = 'papeleria-de-sol-seleccion';

const botonCarrito = document.querySelector('#boton-carrito');
const panelCarrito = document.querySelector('#panel-carrito');
const fondoCarrito = document.querySelector('#fondo-carrito');
const cerrarCarrito = document.querySelector('#cerrar-carrito');
const contenidoCarrito = document.querySelector('#contenido-carrito');
const contadorCarrito = document.querySelector('#contador-carrito');
const totalElementos = document.querySelector('#total-elementos-carrito');
const totalDineroCarrito = document.querySelector('#total-dinero-carrito');
const botonEnviar = document.querySelector('#enviar-carrito-whatsapp');
const botonVaciar = document.querySelector('#vaciar-carrito');
const textos = obtenerTextosCarrito();

let carrito = cargarCarrito();

function obtenerTextosCarrito() {
  try {
    const datos = JSON.parse(panelCarrito?.dataset.textos || '{}');
    return typeof datos === 'object' && datos ? datos : {};
  } catch {
    return {};
  }
}

function texto(clave, respaldo) {
  return typeof textos[clave] === 'string' && textos[clave].trim()
    ? textos[clave].trim()
    : respaldo;
}

function cargarCarrito() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_CARRITO) || '[]');
    if (!Array.isArray(datos)) return [];

    return datos
      .map((producto) => normalizarProductoCarrito(producto))
      .filter((producto) => producto && producto.cantidad > 0);
  } catch {
    return [];
  }
}

function limitarCantidad(valor, minimo = 1) {
  const cantidad = Math.floor(Number(valor));
  return Number.isFinite(cantidad) ? Math.max(minimo, cantidad) : minimo;
}

function limiteDeStock(producto) {
  if (producto?.controla_stock !== true) return null;

  const stock = Math.floor(Number(producto.stock));
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function normalizarProductoCarrito(producto) {
  if (!producto?.id || !producto?.nombre) return null;

  const limite = limiteDeStock(producto);
  const cantidad = limitarCantidad(producto.cantidad);
  return {
    ...producto,
    cantidad: limite === null ? cantidad : Math.min(cantidad, limite),
  };
}

function guardarCarrito() {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
}

function cantidadTotal() {
  return carrito.reduce((total, producto) => total + producto.cantidad, 0);
}

function totalDinero() {
  return carrito.reduce((total, producto) => {
    const precio = Number(producto.precio);
    return total + (Number.isFinite(precio) ? precio : 0) * producto.cantidad;
  }, 0);
}

function formatearDinero(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor);
}

function mostrarNotificacion(mensaje) {
  const contenedor = document.querySelector('#contenedor-notificaciones');
  if (!contenedor) return;

  const notificacion = document.createElement('div');
  notificacion.className = 'notificacion';
  notificacion.textContent = mensaje;
  contenedor.append(notificacion);

  window.setTimeout(() => notificacion.remove(), 3200);
}

function abrirPanelCarrito() {
  if (!panelCarrito || !fondoCarrito) return;

  panelCarrito.classList.add('abierto');
  panelCarrito.setAttribute('aria-hidden', 'false');
  fondoCarrito.hidden = false;
  document.body.classList.add('carrito-abierto');
  cerrarCarrito?.focus();
}

function cerrarPanelCarrito() {
  if (!panelCarrito || !fondoCarrito) return;

  panelCarrito.classList.remove('abierto');
  panelCarrito.setAttribute('aria-hidden', 'true');
  fondoCarrito.hidden = true;
  document.body.classList.remove('carrito-abierto');
}

function crearEstadoVacio() {
  const estado = document.createElement('div');
  estado.className = 'estado-vacio';

  const icono = document.createElement('span');
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = '♡';

  const mensaje = document.createElement('p');
  mensaje.textContent = texto('vacio', 'Todavía no agregaste productos.');

  const enlace = document.createElement('a');
  enlace.className = 'enlace-texto';
  enlace.href = '/stickers';
  enlace.textContent = texto('explorarCatalogo', 'Explorar stickers');

  estado.append(icono, mensaje, enlace);
  return estado;
}

function crearControlesCantidad(producto) {
  const controles = document.createElement('div');
  controles.className = 'controles-cantidad';

  const restar = document.createElement('button');
  restar.type = 'button';
  restar.dataset.accionCarrito = 'restar';
  restar.dataset.idProducto = producto.id;
  restar.setAttribute('aria-label', `Restar una unidad de ${producto.nombre}`);
  restar.textContent = '−';

  const cantidad = document.createElement('span');
  cantidad.textContent = String(producto.cantidad);
  cantidad.setAttribute('aria-live', 'polite');

  const sumar = document.createElement('button');
  sumar.type = 'button';
  sumar.dataset.accionCarrito = 'sumar';
  sumar.dataset.idProducto = producto.id;
  sumar.setAttribute('aria-label', `Agregar otra unidad de ${producto.nombre}`);
  const limite = limiteDeStock(producto);
  sumar.disabled = limite !== null && producto.cantidad >= limite;
  sumar.textContent = '+';

  controles.append(restar, cantidad, sumar);
  return controles;
}

function crearElementoCarrito(producto) {
  const elemento = document.createElement('article');
  elemento.className = 'elemento-carrito';

  const miniatura = document.createElement('div');
  miniatura.className = 'miniatura-carrito';
  const esSticker = producto.tipo_producto === 'sticker';
  if (esSticker) miniatura.dataset.proteccionImagen = 'sticker';

  const imagen = document.createElement('img');
  imagen.src = producto.imagen || '/stickers/1.webp';
  imagen.alt = '';
  imagen.width = 64;
  imagen.height = 64;
  imagen.draggable = !esSticker;
  miniatura.append(imagen);

  const informacion = document.createElement('div');
  const nombre = document.createElement('h3');
  nombre.textContent = producto.nombre;
  const cantidad = document.createElement('small');
  cantidad.textContent = texto('cantidad', 'Cantidad');
  const filaCantidad = document.createElement('div');
  filaCantidad.className = 'fila-cantidad-carrito';
  filaCantidad.append(cantidad, crearControlesCantidad(producto));
  informacion.append(nombre, filaCantidad);

  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className = 'eliminar-elemento';
  eliminar.dataset.accionCarrito = 'eliminar';
  eliminar.dataset.idProducto = producto.id;
  eliminar.setAttribute('aria-label', `Eliminar ${producto.nombre}`);
  eliminar.textContent = '×';

  elemento.append(miniatura, informacion, eliminar);
  return elemento;
}

function renderizarCarrito() {
  if (!contenidoCarrito) return;

  contenidoCarrito.replaceChildren();

  if (carrito.length === 0) {
    contenidoCarrito.append(crearEstadoVacio());
  } else {
    const fragmento = document.createDocumentFragment();
    carrito.forEach((producto) => fragmento.append(crearElementoCarrito(producto)));
    contenidoCarrito.append(fragmento);
  }

  const total = cantidadTotal();
  const totalEnDinero = totalDinero();
  if (contadorCarrito) contadorCarrito.textContent = String(total);
  if (totalElementos) totalElementos.textContent = String(total);
  if (totalDineroCarrito) totalDineroCarrito.textContent = formatearDinero(totalEnDinero);
  if (botonEnviar) botonEnviar.disabled = total === 0;
}

function agregarProducto(producto, cantidadSolicitada = 1) {
  if (!producto?.id || !producto?.nombre) return;

  const existente = carrito.find((elemento) => elemento.id === producto.id);
  const cantidad = limitarCantidad(cantidadSolicitada);
  const limite = limiteDeStock(producto);
  const cantidadActual = existente?.cantidad || 0;
  const disponible = limite === null ? cantidad : Math.max(0, limite - cantidadActual);
  const cantidadAAgregar = Math.min(cantidad, disponible);

  if (cantidadAAgregar <= 0) {
    mostrarNotificacion(`${producto.nombre} ya alcanzó el stock disponible.`);
    return;
  }

  if (existente) {
    Object.assign(existente, producto, { cantidad: cantidadActual + cantidadAAgregar });
  } else {
    carrito.push({ ...producto, cantidad: cantidadAAgregar });
  }

  guardarCarrito();
  renderizarCarrito();
  if (cantidadAAgregar < cantidad) {
    mostrarNotificacion(`Agregamos ${cantidadAAgregar} de ${producto.nombre}: es el máximo disponible.`);
    return;
  }

  const detalleCantidad = cantidadAAgregar > 1 ? `${cantidadAAgregar} unidades de ` : '';
  mostrarNotificacion(`${detalleCantidad}${producto.nombre} ${texto('agregado', 'se agregó a tu selección.')}`);
}

function modificarCantidad(idProducto, cambio) {
  const producto = carrito.find((elemento) => elemento.id === idProducto);
  if (!producto) return;

  const limite = limiteDeStock(producto);
  if (cambio > 0 && limite !== null && producto.cantidad >= limite) {
    mostrarNotificacion(`${producto.nombre} ya alcanzó el stock disponible.`);
    return;
  }

  producto.cantidad += cambio;
  if (producto.cantidad <= 0) {
    carrito = carrito.filter((elemento) => elemento.id !== idProducto);
  }

  guardarCarrito();
  renderizarCarrito();
}

function crearMensajeWhatsApp() {
  const lineas = [
    texto('mensajeInicio', '¡Hola! Quisiera consultar por los siguientes productos de Papelería de Sol:'),
    '',
  ];

  carrito.forEach((producto) => {
    const subtotal = Number(producto.precio) * producto.cantidad;
    lineas.push(
      `• SKU: ${producto.sku || 'Sin SKU'}`,
      `  Producto: ${producto.nombre}`,
      `  Cantidad: ${producto.cantidad}`,
      `  Precio unitario: ${formatearDinero(producto.precio)}`,
      `  Subtotal: ${formatearDinero(subtotal)}`,
      '',
    );
  });

  lineas.push(
    `${texto('mensajeTotalProductos', 'Total de productos')}: ${cantidadTotal()}`,
    `${texto('mensajeTotal', 'Total del pedido')}: ${formatearDinero(totalDinero())}`,
    '',
    texto('mensajeCierre', 'Quedo atento/a. Gracias.'),
  );
  return lineas.join('\n');
}

document.addEventListener('click', (evento) => {
  const botonAgregar = evento.target.closest('[data-agregar-producto]');
  if (botonAgregar) {
    try {
      agregarProducto(
        JSON.parse(botonAgregar.dataset.producto),
        botonAgregar.dataset.cantidad,
      );
    } catch {
      mostrarNotificacion('No pudimos agregar ese producto. Intentá nuevamente.');
    }
    return;
  }

  const accion = evento.target.closest('[data-accion-carrito]');
  if (!accion) return;

  const { accionCarrito, idProducto } = accion.dataset;
  if (accionCarrito === 'sumar') modificarCantidad(idProducto, 1);
  if (accionCarrito === 'restar') modificarCantidad(idProducto, -1);
  if (accionCarrito === 'eliminar') {
    carrito = carrito.filter((producto) => producto.id !== idProducto);
    guardarCarrito();
    renderizarCarrito();
  }
});

botonCarrito?.addEventListener('click', abrirPanelCarrito);
cerrarCarrito?.addEventListener('click', cerrarPanelCarrito);
fondoCarrito?.addEventListener('click', cerrarPanelCarrito);

botonVaciar?.addEventListener('click', () => {
  carrito = [];
  guardarCarrito();
  renderizarCarrito();
});

botonEnviar?.addEventListener('click', () => {
  if (carrito.length === 0 || !panelCarrito) return;

  const numero = panelCarrito.dataset.whatsapp;
  const enlace = `https://wa.me/${numero}?text=${encodeURIComponent(crearMensajeWhatsApp())}`;
  if (typeof window.abrirAvisoWhatsApp === 'function') {
    window.abrirAvisoWhatsApp(enlace, { tipo: 'seleccion', activador: botonEnviar });
    return;
  }

  window.open(enlace, '_blank', 'noopener,noreferrer');
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') cerrarPanelCarrito();
});

renderizarCarrito();

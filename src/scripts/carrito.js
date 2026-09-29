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
const dialogoDatosPedido = document.querySelector('#dialogo-datos-pedido');
const formularioDatosPedido = document.querySelector('#formulario-datos-pedido');
const errorDatosPedido = document.querySelector('#error-datos-pedido');
const confirmacionPedido = document.querySelector('#confirmacion-pedido');
const textos = obtenerTextosCarrito();

let carrito = cargarCarrito();
let claveSolicitud = null;

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
  return Number.isFinite(cantidad) ? Math.min(9999, Math.max(minimo, cantidad)) : minimo;
}

function limiteDeStock(producto) {
  if (producto?.controla_stock !== true) return null;

  const stock = Math.floor(Number(producto.stock));
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
}

function limiteDeCantidad(producto) {
  if (producto?.tipo_producto === 'plantilla') return 1;
  return limiteDeStock(producto);
}

function normalizarProductoCarrito(producto) {
  if (!producto?.id || !producto?.nombre) return null;
  producto = { ...producto, controla_stock: producto.tipo_producto === 'fisico' };
  if (!producto.controla_stock) producto.stock = null;

  const limite = limiteDeCantidad(producto);
  const cantidad = limitarCantidad(producto.cantidad);
  return {
    ...producto,
    clave_linea: `${producto.id}:${producto.variante_id || 'simple'}`,
    cantidad: limite === null ? cantidad : Math.min(cantidad, limite),
  };
}

function guardarCarrito() {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
  claveSolicitud = null;
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
    minimumFractionDigits: 0, maximumFractionDigits: 2,
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
  panelCarrito.removeAttribute('inert');
  fondoCarrito.hidden = false;
  document.body.classList.add('carrito-abierto');
  cerrarCarrito?.focus();
}

function cerrarPanelCarrito() {
  if (!panelCarrito || !fondoCarrito || !panelCarrito.classList.contains('abierto')) return;

  botonCarrito?.focus();
  panelCarrito.classList.remove('abierto');
  panelCarrito.setAttribute('aria-hidden', 'true');
  panelCarrito.setAttribute('inert', '');
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
  restar.dataset.idProducto = producto.clave_linea;
  restar.setAttribute('aria-label', `Restar una unidad de ${producto.nombre}`);
  restar.textContent = '−';

  const cantidad = document.createElement('span');
  cantidad.textContent = String(producto.cantidad);
  cantidad.setAttribute('aria-live', 'polite');

  const sumar = document.createElement('button');
  sumar.type = 'button';
  sumar.dataset.accionCarrito = 'sumar';
  sumar.dataset.idProducto = producto.clave_linea;
  sumar.setAttribute('aria-label', `Agregar otra unidad de ${producto.nombre}`);
  const limite = limiteDeCantidad(producto);
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
  const precio = document.createElement('small');
  precio.textContent = `${formatearDinero(producto.precio)} c/u · ${formatearDinero(producto.precio * producto.cantidad)}`;
  const cantidad = document.createElement('small');
  cantidad.textContent = texto('cantidad', 'Cantidad');
  const filaCantidad = document.createElement('div');
  filaCantidad.className = 'fila-cantidad-carrito';
  filaCantidad.append(cantidad, crearControlesCantidad(producto));
  informacion.append(nombre, precio, filaCantidad);

  const eliminar = document.createElement('button');
  eliminar.type = 'button';
  eliminar.className = 'eliminar-elemento';
  eliminar.dataset.accionCarrito = 'eliminar';
  eliminar.dataset.idProducto = producto.clave_linea;
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

  producto = normalizarProductoCarrito({ ...producto, cantidad: cantidadSolicitada });
  const existente = carrito.find((elemento) => elemento.clave_linea === producto.clave_linea);
  if (!existente && carrito.length >= 100) { mostrarNotificacion('Podés seleccionar hasta 100 versiones distintas por consulta.'); return; }
  const cantidad = limitarCantidad(cantidadSolicitada);
  const limite = limiteDeCantidad(producto);
  const cantidadActual = existente?.cantidad || 0;
  const disponible = Math.max(0, (limite ?? 9999) - cantidadActual);
  const cantidadAAgregar = Math.min(cantidad, disponible);

  if (cantidadAAgregar <= 0) {
    mostrarNotificacion(producto.tipo_producto === 'plantilla'
      ? `${producto.nombre} es digital y solo se puede agregar una unidad.`
      : `${producto.nombre} ya alcanzó el stock disponible.`);
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
  const producto = carrito.find((elemento) => elemento.clave_linea === idProducto);
  if (!producto) return;

  const limite = limiteDeCantidad(producto);
  if (cambio > 0 && producto.cantidad >= (limite ?? 9999)) {
    mostrarNotificacion(producto.tipo_producto === 'plantilla'
      ? `${producto.nombre} es digital y solo se puede agregar una unidad.`
      : `${producto.nombre} ya alcanzó el stock disponible.`);
    return;
  }

  producto.cantidad += cambio;
  if (producto.cantidad <= 0) {
    carrito = carrito.filter((elemento) => elemento.clave_linea !== idProducto);
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

function endpointPedidosDisponible() {
  return Boolean(dialogoDatosPedido?.dataset.endpointPedidos && dialogoDatosPedido?.dataset.clavePublica);
}

function abrirFormularioPedido() {
  if (!dialogoDatosPedido || !formularioDatosPedido) return;
  errorDatosPedido.hidden = true;
  confirmacionPedido.hidden = true;
  confirmacionPedido.replaceChildren();
  formularioDatosPedido.querySelector('button[type="submit"]').hidden = false;
  if (!claveSolicitud) claveSolicitud = `pedido:${crypto.randomUUID()}`;
  cerrarPanelCarrito();
  dialogoDatosPedido.showModal();
}

function abrirWhatsAppSeleccion() {
  const numero = panelCarrito.dataset.whatsapp;
  const enlace = `https://wa.me/${numero}?text=${encodeURIComponent(crearMensajeWhatsApp())}`;
  if (typeof window.abrirAvisoWhatsApp === 'function') {
    window.abrirAvisoWhatsApp(enlace, { tipo: 'seleccion', activador: botonEnviar });
    return;
  }
  window.open(enlace, '_blank', 'noopener,noreferrer');
}

function agregarEnlaceConfirmacion(contenedor, textoEnlace, url) {
  if (!url) return;
  const enlace = document.createElement('a');
  enlace.className = 'boton boton-secundario';
  enlace.href = url;
  enlace.target = '_blank';
  enlace.rel = 'noopener noreferrer';
  enlace.textContent = textoEnlace;
  contenedor.append(enlace);
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
    carrito = carrito.filter((producto) => producto.clave_linea !== idProducto);
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

botonEnviar?.addEventListener('click', async () => {
  if (carrito.length === 0 || !panelCarrito) return;
  const seleccionEnviada = JSON.stringify(carrito);
  botonEnviar.disabled = true;
  try {
    const respuesta = await fetch('/api/seleccion.json', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineas: carrito.map(({ id, variante_id, cantidad, precio }) => ({ id, variante_id, cantidad, precio })) }),
    });
    if (!respuesta.ok) throw new Error('No pudimos comprobar los precios y el stock. Intentá nuevamente.');
    const resultado = await respuesta.json();
    if (JSON.stringify(carrito) !== seleccionEnviada) throw new Error('Cambiaste la selección. Revisala y volvé a continuar.');
    carrito = resultado.lineas;
    guardarCarrito();
    renderizarCarrito();
    if (resultado.avisos.length) {
      const aviso = document.createElement('p');
      aviso.className = 'aviso-seleccion';
      aviso.setAttribute('role', 'status');
      aviso.textContent = `${resultado.avisos.join(' ')} Revisá la selección y volvé a continuar.`;
      contenidoCarrito.prepend(aviso);
      return;
    }
    if (!carrito.length) return;
  } catch (error) {
    mostrarNotificacion(error.message);
    return;
  } finally { botonEnviar.disabled = carrito.length === 0; }

  if (endpointPedidosDisponible()) abrirFormularioPedido();
  else abrirWhatsAppSeleccion();
});

document.querySelectorAll?.('[data-cerrar-pedido-publico]').forEach((boton) => {
  boton.addEventListener('click', () => dialogoDatosPedido?.close());
});

formularioDatosPedido?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!carrito.length || !endpointPedidosDisponible()) return;
  errorDatosPedido.hidden = true;
  const boton = formularioDatosPedido.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Registrando…';
  const datos = new FormData(formularioDatosPedido);
  try {
    const respuesta = await fetch(dialogoDatosPedido.dataset.endpointPedidos, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: dialogoDatosPedido.dataset.clavePublica,
        Authorization: `Bearer ${dialogoDatosPedido.dataset.clavePublica}`,
      },
      body: JSON.stringify({
        accion: 'crear_solicitud',
        clave_idempotencia: claveSolicitud,
        cliente: {
          nombre: String(datos.get('nombre') || '').trim(),
          correo: String(datos.get('correo') || '').trim(),
          whatsapp: String(datos.get('whatsapp') || '').trim(),
        },
        observaciones: String(datos.get('observaciones') || '').trim(),
        cupon: String(datos.get('cupon') || '').trim(),
        lineas: carrito.map(producto => ({
          producto_id: producto.id,
          variante_id: producto.variante_id || null,
          cantidad: producto.cantidad,
          opciones: {},
        })),
      }),
    });
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || resultado.error) throw new Error(resultado.error || 'No pudimos registrar el pedido.');
    carrito = [];
    guardarCarrito();
    renderizarCarrito();
    const pedido = resultado.datos;
    confirmacionPedido.replaceChildren();
    confirmacionPedido.append(
      Object.assign(document.createElement('h3'), { textContent: `Pedido #${pedido.numero} registrado` }),
      Object.assign(document.createElement('p'), {
        textContent: pedido.tipo === 'automatico'
          ? `Total confirmado: ${formatearDinero(Number(pedido.total_centavos || 0) / 100)}. El pago todavía no está habilitado.`
          : 'La solicitud se coordinará por WhatsApp. No se realizó ningún cobro.',
      }),
    );
    const enlaces = document.createElement('div');
    enlaces.className = 'acciones-confirmacion-pedido';
    agregarEnlaceConfirmacion(enlaces, 'Ver seguimiento privado', pedido.seguimiento_url);
    agregarEnlaceConfirmacion(enlaces, 'Continuar por WhatsApp', pedido.whatsapp_url);
    confirmacionPedido.append(enlaces);
    confirmacionPedido.hidden = false;
    boton.hidden = true;
    claveSolicitud = null;
  } catch (error) {
    errorDatosPedido.textContent = error.message || 'No pudimos registrar el pedido.';
    errorDatosPedido.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Registrar pedido';
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') cerrarPanelCarrito();
});

renderizarCarrito();

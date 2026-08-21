import { obtenerClienteSupabase } from '../servicios/cliente-supabase.js';

const aplicacion = document.querySelector('.admin-aplicacion');
const configuracionDisponible = aplicacion?.dataset.configuracionDisponible === 'true';
const cliente = configuracionDisponible ? obtenerClienteSupabase() : null;

const pantallaLogin = document.querySelector('#pantalla-login');
const formularioLogin = document.querySelector('#formulario-login');
const errorLogin = document.querySelector('#error-login');
const panelAdministracion = document.querySelector('#panel-administracion');
const datosSesion = document.querySelector('#datos-sesion');
const tiempoSesion = document.querySelector('#tiempo-sesion');
const botonCerrarSesion = document.querySelector('#cerrar-sesion-admin');
const tarjetasResumen = document.querySelector('#tarjetas-resumen');
const dialogo = document.querySelector('#dialogo-recurso');
const formularioRecurso = document.querySelector('#formulario-recurso');
const camposFormulario = document.querySelector('#campos-formulario-recurso');
const tituloDialogo = document.querySelector('#titulo-dialogo');
const errorFormulario = document.querySelector('#error-formulario-recurso');
const formularioConfiguraciones = document.querySelector('#formulario-configuraciones');

const DESCRIPCIONES = {
  productos: 'Creá stickers, plantillas y productos físicos; controlá su precio, stock y publicación.',
  categorias: 'Organizá los productos en categorías generales administrables.',
  temas: 'Creá temas como fútbol, memes o cine y asigná cada sticker a uno o varios.',
  secciones: 'Modificá títulos, textos, botones y el orden de las secciones públicas.',
};

const ESQUEMAS = {
  productos: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    { nombre: 'slug', etiqueta: 'Dirección amigable', tipo: 'text', ayuda: 'Se genera automáticamente si queda vacía.' },
    { nombre: 'sku', etiqueta: 'Código interno', tipo: 'text' },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo de producto', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select-categorias' },
    { nombre: 'temas_ids', etiqueta: 'Temas', tipo: 'select-temas', multiple: true },
    { nombre: 'descripcion_corta', etiqueta: 'Descripción corta', tipo: 'textarea', obligatorio: true, completo: true },
    { nombre: 'descripcion', etiqueta: 'Descripción completa', tipo: 'textarea', obligatorio: true, completo: true },
    { nombre: 'precio', etiqueta: 'Precio en pesos (opcional)', tipo: 'number', minimo: 0 },
    {
      nombre: 'estado', etiqueta: 'Estado', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'borrador', texto: 'Borrador' },
        { valor: 'publicado', texto: 'Publicado' },
        { valor: 'oculto', texto: 'Oculto' },
      ],
    },
    { nombre: 'controla_stock', etiqueta: 'Controlar stock', tipo: 'checkbox' },
    { nombre: 'stock', etiqueta: 'Stock disponible', tipo: 'number', minimo: 0 },
    { nombre: 'destacado', etiqueta: 'Mostrar como destacado', tipo: 'checkbox' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', minimo: 0 },
    { nombre: 'meta_titulo', etiqueta: 'Título SEO', tipo: 'text', completo: true },
    { nombre: 'meta_descripcion', etiqueta: 'Descripción SEO', tipo: 'textarea', completo: true },
    { nombre: 'imagen_nueva', etiqueta: 'Nueva imagen (máximo 5 MB)', tipo: 'file', completo: true },
  ],
  categorias: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    { nombre: 'slug', etiqueta: 'Dirección amigable', tipo: 'text' },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo relacionado', tipo: 'select',
      opciones: [
        { valor: '', texto: 'Todos' },
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', completo: true },
    { nombre: 'publicada', etiqueta: 'Publicada', tipo: 'checkbox' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', minimo: 0 },
  ],
  temas: [
    { nombre: 'nombre', etiqueta: 'Nombre del tema', tipo: 'text', obligatorio: true },
    { nombre: 'slug', etiqueta: 'Dirección amigable', tipo: 'text' },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', completo: true },
    { nombre: 'publicado', etiqueta: 'Publicado', tipo: 'checkbox' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', minimo: 0 },
  ],
  secciones: [
    { nombre: 'clave', etiqueta: 'Clave interna', tipo: 'text', ayuda: 'No conviene cambiarla después de crear la sección.' },
    { nombre: 'titulo', etiqueta: 'Título', tipo: 'text', obligatorio: true },
    { nombre: 'subtitulo', etiqueta: 'Subtítulo', tipo: 'text', completo: true },
    { nombre: 'contenido', etiqueta: 'Contenido', tipo: 'textarea', completo: true },
    { nombre: 'texto_boton', etiqueta: 'Texto del botón', tipo: 'text' },
    { nombre: 'enlace_boton', etiqueta: 'Enlace del botón', tipo: 'text' },
    { nombre: 'publicada', etiqueta: 'Publicada', tipo: 'checkbox' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'number', minimo: 0 },
    { nombre: 'meta_titulo', etiqueta: 'Título SEO', tipo: 'text', completo: true },
    { nombre: 'meta_descripcion', etiqueta: 'Descripción SEO', tipo: 'textarea', completo: true },
  ],
};

const COLUMNAS = {
  productos: [
    { clave: 'nombre', texto: 'Producto' },
    { clave: 'tipo_producto', texto: 'Tipo' },
    { clave: 'precio', texto: 'Precio' },
    { clave: 'estado', texto: 'Estado' },
    { clave: 'stock', texto: 'Stock' },
  ],
  categorias: [
    { clave: 'nombre', texto: 'Categoría' },
    { clave: 'tipo_producto', texto: 'Tipo' },
    { clave: 'publicada', texto: 'Publicación' },
    { clave: 'orden', texto: 'Orden' },
  ],
  temas: [
    { clave: 'nombre', texto: 'Tema' },
    { clave: 'publicado', texto: 'Publicación' },
    { clave: 'orden', texto: 'Orden' },
  ],
  secciones: [
    { clave: 'titulo', texto: 'Sección' },
    { clave: 'clave', texto: 'Clave' },
    { clave: 'publicada', texto: 'Publicación' },
    { clave: 'orden', texto: 'Orden' },
  ],
};

let recursoActual = 'resumen';
let recursoDialogo = null;
let idEdicion = null;
let registrosActuales = new Map();
let categorias = [];
let temas = [];
let minutosInactividad = 30;
let ultimaActividadConfirmada = Date.now();

function mostrarError(elemento, mensaje) {
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.hidden = false;
}

function ocultarError(elemento) {
  if (elemento) elemento.hidden = true;
}

function notificar(mensaje) {
  const contenedor = document.querySelector('#contenedor-notificaciones');
  if (!contenedor) return;
  const elemento = document.createElement('div');
  elemento.className = 'notificacion';
  elemento.textContent = mensaje;
  contenedor.append(elemento);
  setTimeout(() => elemento.remove(), 3500);
}

async function obtenerMensajeErrorFuncion(error) {
  const respuesta = error?.context;

  if (respuesta instanceof Response) {
    const cuerpo = await respuesta.clone().json().catch(() => null);
    if (cuerpo?.error) return cuerpo.error;
  }

  return error?.message || 'No se pudo completar la operación.';
}

async function invocar(accion, contenido = {}) {
  if (!cliente) throw new Error('Supabase no está configurado.');

  const { data, error } = await cliente.functions.invoke('administracion', {
    body: { accion, ...contenido },
  });

  if (error || data?.error) {
    const mensaje = data?.error || await obtenerMensajeErrorFuncion(error);
    if (/sesión|permisos|autoriz/i.test(mensaje)) {
      await cerrarSesionLocal();
    }
    throw new Error(mensaje);
  }

  ultimaActividadConfirmada = Date.now();
  return data?.datos;
}

async function abrirAdministracion() {
  const datos = await invocar('iniciar_sesion');
  minutosInactividad = Number(datos.inactividad_minutos || 30);
  pantallaLogin.hidden = true;
  panelAdministracion.hidden = false;
  datosSesion.hidden = false;
  await Promise.all([cargarAuxiliares(), cargarResumen()]);
}

async function cerrarSesionLocal() {
  await cliente?.auth.signOut().catch(() => {});
  panelAdministracion.hidden = true;
  datosSesion.hidden = true;
  pantallaLogin.hidden = false;
}

async function cerrarSesionCompleta() {
  try {
    await invocar('cerrar_sesion');
  } catch {
    // El cierre local debe continuar aunque la sesión ya haya expirado en el servidor.
  }
  await cerrarSesionLocal();
}

async function cargarResumen() {
  if (!tarjetasResumen) return;
  tarjetasResumen.textContent = 'Cargando resumen…';
  const resumen = await invocar('resumen');
  tarjetasResumen.replaceChildren();

  const etiquetas = {
    productos: 'Productos',
    publicados: 'Publicados',
    categorias: 'Categorías',
    temas: 'Temas',
    secciones: 'Secciones',
  };

  Object.entries(etiquetas).forEach(([clave, etiqueta]) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta-resumen';
    const texto = document.createElement('span');
    texto.textContent = etiqueta;
    const valor = document.createElement('strong');
    valor.textContent = String(resumen[clave] || 0);
    tarjeta.append(texto, valor);
    tarjetasResumen.append(tarjeta);
  });
}

async function cargarAuxiliares() {
  [categorias, temas] = await Promise.all([
    invocar('listar', { recurso: 'categorias' }),
    invocar('listar', { recurso: 'temas' }),
  ]);
}

function valorVisible(registro, clave) {
  const valor = registro[clave];
  if (clave === 'precio') {
    return valor == null
      ? 'Consultar'
      : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
  }
  if (clave === 'stock') return registro.controla_stock ? String(valor ?? 0) : 'Sin control';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (clave === 'tipo_producto' && valor === 'fisico') return 'Producto físico';
  return valor ?? '—';
}

function crearBotonAccion(texto, atributo, id) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = texto;
  boton.dataset[atributo] = id;
  return boton;
}

function renderizarListado(recurso, registros) {
  registrosActuales = new Map(registros.map((registro) => [registro.id, registro]));
  const cuerpo = document.querySelector(`[data-lista-recurso="${recurso}"]`);
  const cabecera = document.querySelector(`[data-cabecera-tabla="${recurso}"]`);
  if (!cuerpo || !cabecera) return;

  cabecera.replaceChildren();
  const filaCabecera = document.createElement('tr');
  COLUMNAS[recurso].forEach(({ texto }) => {
    const celda = document.createElement('th');
    celda.scope = 'col';
    celda.textContent = texto;
    filaCabecera.append(celda);
  });
  const acciones = document.createElement('th');
  acciones.scope = 'col';
  acciones.textContent = 'Acciones';
  filaCabecera.append(acciones);
  cabecera.append(filaCabecera);

  const termino = document.querySelector(`[data-buscar-recurso="${recurso}"]`)?.value.toLowerCase().trim() || '';
  const filtrados = registros.filter((registro) =>
    JSON.stringify(registro).toLowerCase().includes(termino),
  );
  const visibles = filtrados.slice(0, 200);
  cuerpo.replaceChildren();

  visibles.forEach((registro) => {
    const fila = document.createElement('tr');
    COLUMNAS[recurso].forEach(({ clave }) => {
      const celda = document.createElement('td');
      if (['estado', 'publicada', 'publicado'].includes(clave)) {
        const estado = document.createElement('span');
        estado.className = 'estado-tabla';
        estado.textContent = String(valorVisible(registro, clave));
        celda.append(estado);
      } else {
        celda.textContent = String(valorVisible(registro, clave));
      }
      fila.append(celda);
    });

    const celdaAcciones = document.createElement('td');
    const grupo = document.createElement('div');
    grupo.className = 'acciones-tabla';
    grupo.append(
      crearBotonAccion('Editar', 'editar', registro.id),
      crearBotonAccion(recurso === 'productos' ? 'Archivar' : 'Eliminar', 'eliminar', registro.id),
    );
    celdaAcciones.append(grupo);
    fila.append(celdaAcciones);
    cuerpo.append(fila);
  });

  const total = document.querySelector(`[data-total-recurso="${recurso}"]`);
  if (total) {
    total.textContent = `${filtrados.length} registro${filtrados.length === 1 ? '' : 's'}${filtrados.length > 200 ? ' · mostrando los primeros 200' : ''}`;
  }
}

async function cargarRecurso(recurso) {
  const total = document.querySelector(`[data-total-recurso="${recurso}"]`);
  if (total) total.textContent = 'Cargando…';
  const registros = await invocar('listar', { recurso });
  renderizarListado(recurso, registros);
}

function crearOpcion(valor, texto, seleccionada = false) {
  const opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  opcion.selected = seleccionada;
  return opcion;
}

function crearCampo(definicion, registro = {}) {
  const contenedor = document.createElement('label');
  contenedor.className = `grupo-campo${definicion.completo ? ' campo-completo' : ''}`;
  const etiqueta = document.createElement('span');
  etiqueta.textContent = definicion.etiqueta;

  let campo;
  if (definicion.tipo === 'textarea') {
    campo = document.createElement('textarea');
    campo.className = 'area-texto';
    campo.rows = 4;
    campo.value = registro[definicion.nombre] || '';
  } else if (definicion.tipo.startsWith('select')) {
    campo = document.createElement('select');
    campo.className = `selector${definicion.multiple ? ' selector-multiple' : ''}`;
    campo.multiple = Boolean(definicion.multiple);

    if (definicion.tipo === 'select-categorias') {
      campo.append(crearOpcion('', 'Sin categoría', !registro.categoria_id));
      categorias.forEach((categoria) => campo.append(
        crearOpcion(categoria.id, categoria.nombre, registro.categoria_id === categoria.id),
      ));
    } else if (definicion.tipo === 'select-temas') {
      const elegidos = registro.productos_temas?.map((relacion) => relacion.tema?.id) || [];
      temas.forEach((tema) => campo.append(
        crearOpcion(tema.id, tema.nombre, elegidos.includes(tema.id)),
      ));
    } else {
      definicion.opciones.forEach((opcion) => campo.append(
        crearOpcion(opcion.valor, opcion.texto, String(registro[definicion.nombre] ?? '') === opcion.valor),
      ));
    }
  } else {
    campo = document.createElement('input');
    campo.type = definicion.tipo;
    campo.className = definicion.tipo === 'checkbox' ? '' : 'campo';
    if (definicion.tipo === 'checkbox') {
      campo.checked = Boolean(registro[definicion.nombre]);
      contenedor.classList.add('grupo-checkbox');
    } else if (definicion.tipo !== 'file') {
      campo.value = registro[definicion.nombre] ?? '';
    }
    if (definicion.minimo !== undefined) campo.min = String(definicion.minimo);
    if (definicion.tipo === 'file') campo.accept = 'image/jpeg,image/png,image/webp,image/avif';
  }

  campo.name = definicion.nombre;
  campo.required = Boolean(definicion.obligatorio);
  contenedor.append(etiqueta, campo);

  if (definicion.ayuda) {
    const ayuda = document.createElement('small');
    ayuda.textContent = definicion.ayuda;
    ayuda.style.color = 'var(--tinta-suave)';
    contenedor.append(ayuda);
  }

  return contenedor;
}

function abrirDialogo(recurso, registro = null) {
  recursoDialogo = recurso;
  idEdicion = registro?.id || null;
  tituloDialogo.textContent = registro ? `Editar ${registro.nombre || registro.titulo}` : 'Crear nuevo registro';
  camposFormulario.replaceChildren();
  ESQUEMAS[recurso].forEach((definicion) => camposFormulario.append(crearCampo(definicion, registro || {})));
  ocultarError(errorFormulario);
  dialogo.showModal();
}

function obtenerDatosFormulario() {
  const datos = {};
  ESQUEMAS[recursoDialogo].forEach((definicion) => {
    const campo = formularioRecurso.elements[definicion.nombre];
    if (!campo || definicion.tipo === 'file') return;

    if (definicion.tipo === 'checkbox') datos[definicion.nombre] = campo.checked;
    else if (definicion.multiple) datos[definicion.nombre] = Array.from(campo.selectedOptions).map((opcion) => opcion.value);
    else if (definicion.tipo === 'number') datos[definicion.nombre] = campo.value === '' ? null : Number(campo.value);
    else datos[definicion.nombre] = campo.value || null;
  });

  if (recursoDialogo === 'productos') {
    datos.moneda = 'ARS';
    if (!datos.controla_stock) datos.stock = null;
  }

  return datos;
}

async function subirImagenSiCorresponde(producto) {
  if (recursoDialogo !== 'productos') return;
  const archivo = formularioRecurso.elements.imagen_nueva?.files?.[0];
  if (!archivo) return;
  if (archivo.size > 5 * 1024 * 1024) throw new Error('La imagen supera el máximo de 5 MB.');

  const preparacion = await invocar('preparar_subida', {
    datos: { producto_id: producto.id, tipo: archivo.type },
  });
  const { error } = await cliente.storage
    .from('productos')
    .uploadToSignedUrl(preparacion.ruta, preparacion.token, archivo, { contentType: archivo.type });
  if (error) throw error;

  await invocar('registrar_imagen', {
    datos: {
      producto_id: producto.id,
      ruta: preparacion.ruta,
      texto_alternativo: `${producto.nombre} de Papelería de Sol`,
      es_principal: true,
      orden: 1,
    },
  });
}

async function cambiarSeccion(recurso) {
  recursoActual = recurso;
  document.querySelectorAll('[data-seccion-admin]').forEach((boton) =>
    boton.classList.toggle('activo', boton.dataset.seccionAdmin === recurso),
  );
  document.querySelectorAll('[data-panel-admin]').forEach((panel) =>
    panel.classList.toggle('activa', panel.dataset.panelAdmin === recurso),
  );

  if (recurso === 'resumen') await cargarResumen();
  else if (['productos', 'categorias', 'temas', 'secciones'].includes(recurso)) await cargarRecurso(recurso);
  else if (recurso === 'configuraciones') await cargarConfiguraciones();
}

async function cargarConfiguraciones() {
  const filas = await invocar('obtener_configuraciones');
  filas.forEach(({ clave, valor }) => {
    const campo = formularioConfiguraciones.elements[clave];
    if (campo) campo.value = valor ?? '';
  });
}

formularioLogin?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  ocultarError(errorLogin);
  const boton = formularioLogin.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Ingresando…';

  try {
    const { error } = await cliente.auth.signInWithPassword({
      email: formularioLogin.elements.correo.value,
      password: formularioLogin.elements.contrasena.value,
    });
    if (error) throw error;
    await abrirAdministracion();
    formularioLogin.reset();
  } catch (error) {
    await cliente?.auth.signOut();
    mostrarError(errorLogin, error.message || 'No pudimos iniciar sesión.');
  } finally {
    boton.disabled = !configuracionDisponible;
    boton.textContent = 'Iniciar sesión';
  }
});

document.addEventListener('click', async (evento) => {
  const navegacion = evento.target.closest('[data-seccion-admin]');
  if (navegacion) {
    await cambiarSeccion(navegacion.dataset.seccionAdmin);
    return;
  }

  const nuevo = evento.target.closest('[data-nuevo-recurso]');
  if (nuevo) {
    abrirDialogo(nuevo.dataset.nuevoRecurso);
    return;
  }

  const editar = evento.target.closest('[data-editar]');
  if (editar) {
    abrirDialogo(recursoActual, registrosActuales.get(editar.dataset.editar));
    return;
  }

  const eliminar = evento.target.closest('[data-eliminar]');
  if (eliminar) {
    const verbo = recursoActual === 'productos' ? 'archivar' : 'eliminar';
    if (!confirm(`¿Querés ${verbo} este registro?`)) return;
    try {
      await invocar('eliminar', { recurso: recursoActual, id: eliminar.dataset.eliminar });
      notificar('El cambio se guardó correctamente.');
      await cargarRecurso(recursoActual);
    } catch (error) {
      notificar(error.message);
    }
  }
});

document.querySelectorAll('[data-descripcion-recurso]').forEach((elemento) => {
  const recurso = elemento.closest('[data-panel-admin]')?.dataset.panelAdmin;
  elemento.textContent = DESCRIPCIONES[recurso] || '';
});

document.querySelectorAll('[data-buscar-recurso]').forEach((campo) => {
  campo.addEventListener('input', () => renderizarListado(campo.dataset.buscarRecurso, Array.from(registrosActuales.values())));
});

formularioRecurso?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  ocultarError(errorFormulario);
  const boton = formularioRecurso.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = 'Guardando…';

  try {
    const producto = await invocar('guardar', {
      recurso: recursoDialogo,
      id: idEdicion,
      datos: obtenerDatosFormulario(),
    });
    await subirImagenSiCorresponde(producto);
    dialogo.close();
    notificar('Contenido guardado correctamente.');
    if (['categorias', 'temas'].includes(recursoDialogo)) await cargarAuxiliares();
    await cargarRecurso(recursoDialogo);
  } catch (error) {
    mostrarError(errorFormulario, error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
});

formularioConfiguraciones?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(formularioConfiguraciones));
  datos.inactividad_administrador_minutos = Number(datos.inactividad_administrador_minutos || 30);
  try {
    await invocar('guardar_configuraciones', { datos });
    minutosInactividad = datos.inactividad_administrador_minutos;
    notificar('Datos comerciales actualizados.');
  } catch (error) {
    notificar(error.message);
  }
});

document.querySelector('#cerrar-dialogo')?.addEventListener('click', () => dialogo.close());
document.querySelector('#cancelar-dialogo')?.addEventListener('click', () => dialogo.close());
botonCerrarSesion?.addEventListener('click', cerrarSesionCompleta);

setInterval(() => {
  if (panelAdministracion?.hidden || !tiempoSesion) return;
  const transcurridos = Date.now() - ultimaActividadConfirmada;
  const restantes = Math.max(0, minutosInactividad * 60_000 - transcurridos);
  const minutos = Math.ceil(restantes / 60_000);
  tiempoSesion.textContent = restantes > 0 ? `Expira tras ${minutos} min sin actividad` : 'Sesión vencida';
  if (restantes <= 0) cerrarSesionCompleta();
}, 15_000);

if (cliente) {
  cliente.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;
    try {
      await abrirAdministracion();
    } catch {
      await cerrarSesionLocal();
    }
  });
}

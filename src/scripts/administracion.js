import { obtenerClienteSupabase } from '../servicios/cliente-supabase.js';
import {
  COLUMNAS_RECURSOS,
  DESCRIPCIONES_RECURSOS,
  ESQUEMAS_RECURSOS,
} from './administracion/configuracion.js';
import {
  crearBotonAccion,
  crearEtiqueta,
  crearOpcion,
  notificar,
  ocultarError,
  obtenerImagenPrincipal,
  mostrarError,
  valorVisible,
} from './administracion/interfaz.js';

const aplicacion = document.querySelector('.admin-aplicacion');
const configuracionDisponible = aplicacion?.dataset.configuracionDisponible === 'true';
const cliente = configuracionDisponible ? obtenerClienteSupabase() : null;

const pantallaLogin = document.querySelector('#pantalla-login');
const formularioLogin = document.querySelector('#formulario-login');
const errorLogin = document.querySelector('#error-login');
const panelAdministracion = document.querySelector('#panel-administracion');
const datosSesion = document.querySelector('#datos-sesion');
const botonCerrarSesion = document.querySelector('#cerrar-sesion-admin');
const tarjetasResumen = document.querySelector('#tarjetas-resumen');
const dialogo = document.querySelector('#dialogo-recurso');
const formularioRecurso = document.querySelector('#formulario-recurso');
const camposFormulario = document.querySelector('#campos-formulario-recurso');
const tituloDialogo = document.querySelector('#titulo-dialogo');
const errorFormulario = document.querySelector('#error-formulario-recurso');
const formulariosConfiguraciones = document.querySelectorAll('[data-formulario-configuraciones]');
const formularioEstilosGlobales = document.querySelector('#formulario-estilos-globales');
const botonAlternarContrasena = document.querySelector('#alternar-contrasena-admin');
const dialogoCerrarSesion = document.querySelector('#dialogo-cerrar-sesion');
const botonCancelarCerrarSesion = document.querySelector('#cancelar-cerrar-sesion');
const botonConfirmarCerrarSesion = document.querySelector('#confirmar-cerrar-sesion');
const botonAlternarMenu = document.querySelector('#alternar-menu-admin');

let recursoActual = 'resumen';
let recursoDialogo = null;
let idEdicion = null;
let registrosActuales = new Map();
let categorias = [];
let registroEdicion = null;
let minutosInactividad = 30;
let ultimaActividadConfirmada = Date.now();
let paginaProductos = 1;
const PRODUCTOS_POR_PAGINA = 50;

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
  categorias = await invocar('listar', { recurso: 'categorias' });
}

function actualizarPaginacionProductos(cantidad) {
  const paginacion = document.querySelector('[data-paginacion-admin="productos"]');
  const informacion = document.querySelector('[data-informacion-pagina-admin]');
  const anterior = document.querySelector('[data-pagina-admin-anterior]');
  const siguiente = document.querySelector('[data-pagina-admin-siguiente]');
  if (!paginacion || !informacion || !anterior || !siguiente) return;

  const totalPaginas = Math.max(1, Math.ceil(cantidad / PRODUCTOS_POR_PAGINA));
  paginaProductos = Math.min(Math.max(1, paginaProductos), totalPaginas);
  paginacion.hidden = cantidad <= PRODUCTOS_POR_PAGINA;
  informacion.textContent = `Página ${paginaProductos} de ${totalPaginas}`;
  anterior.disabled = paginaProductos <= 1;
  siguiente.disabled = paginaProductos >= totalPaginas;
}

function renderizarListado(recurso, registros) {
  registrosActuales = new Map(registros.map((registro) => [registro.id, registro]));
  const cuerpo = document.querySelector(`[data-lista-recurso="${recurso}"]`);
  const cabecera = document.querySelector(`[data-cabecera-tabla="${recurso}"]`);
  if (!cuerpo || !cabecera) return;

  cabecera.replaceChildren();
  const filaCabecera = document.createElement('tr');
  COLUMNAS_RECURSOS[recurso].forEach(({ texto }) => {
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
  const tipoCategoria = recurso === 'categorias'
    ? document.querySelector('[data-filtro-tipo-categoria]')?.value || ''
    : '';
  const tipoProducto = recurso === 'productos'
    ? document.querySelector('[data-filtro-tipo-producto]')?.value || ''
    : '';
  const filtrados = registros.filter((registro) => {
    const coincideBusqueda = JSON.stringify(registro).toLowerCase().includes(termino);
    const coincideTipoCategoria = !tipoCategoria || registro.tipo_producto === tipoCategoria;
    const coincideTipoProducto = !tipoProducto || registro.tipo_producto === tipoProducto;
    return coincideBusqueda && coincideTipoCategoria && coincideTipoProducto;
  });
  const totalPaginasProductos = Math.max(1, Math.ceil(filtrados.length / PRODUCTOS_POR_PAGINA));
  if (recurso === 'productos') paginaProductos = Math.min(paginaProductos, totalPaginasProductos);
  const inicio = recurso === 'productos' ? (paginaProductos - 1) * PRODUCTOS_POR_PAGINA : 0;
  const visibles = recurso === 'productos'
    ? filtrados.slice(inicio, inicio + PRODUCTOS_POR_PAGINA)
    : filtrados.slice(0, 200);
  cuerpo.replaceChildren();

  visibles.forEach((registro) => {
    const fila = document.createElement('tr');
    COLUMNAS_RECURSOS[recurso].forEach(({ clave }) => {
      const celda = document.createElement('td');
      if (clave === 'imagen_principal') {
        const imagenPrincipal = obtenerImagenPrincipal(registro);
        if (imagenPrincipal?.url_publica) {
          const imagen = document.createElement('img');
          imagen.className = 'miniatura-tabla';
          imagen.src = imagenPrincipal.url_publica;
          imagen.alt = `Vista previa de ${registro.nombre}`;
          imagen.width = 44;
          imagen.height = 44;
          imagen.loading = 'lazy';
          celda.append(imagen);
        } else {
          celda.textContent = 'Sin imagen';
        }
      } else if (['estado', 'publicada', 'publicado'].includes(clave)) {
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
    grupo.append(crearBotonAccion('Editar', 'editar', registro.id));
    if (recurso === 'productos' && registro.estado === 'archivado') {
      grupo.append(crearBotonAccion('Restaurar', 'restaurar', registro.id));
    } else {
      grupo.append(crearBotonAccion(recurso === 'productos' ? 'Archivar' : 'Eliminar', 'eliminar', registro.id));
    }
    celdaAcciones.append(grupo);
    fila.append(celdaAcciones);
    cuerpo.append(fila);
  });

  const total = document.querySelector(`[data-total-recurso="${recurso}"]`);
  if (total) {
    if (recurso === 'productos') {
      const desde = filtrados.length ? inicio + 1 : 0;
      const hasta = Math.min(inicio + PRODUCTOS_POR_PAGINA, filtrados.length);
      total.textContent = `${filtrados.length} producto${filtrados.length === 1 ? '' : 's'} · mostrando ${desde} a ${hasta}`;
      actualizarPaginacionProductos(filtrados.length);
    } else {
      total.textContent = `${filtrados.length} registro${filtrados.length === 1 ? '' : 's'}${filtrados.length > 200 ? ' · mostrando los primeros 200' : ''}`;
    }
  }
}

async function cargarRecurso(recurso) {
  const total = document.querySelector(`[data-total-recurso="${recurso}"]`);
  if (total) total.textContent = 'Cargando…';
  const filtroArchivados = recurso === 'productos'
    ? document.querySelector('[data-filtro-archivados]')?.value || 'activos'
    : undefined;
  const registros = await invocar('listar', { recurso, filtro_archivados: filtroArchivados });
  renderizarListado(recurso, registros);
}

function actualizarCategoriasDisponibles() {
  const selectorTipo = formularioRecurso?.elements.tipo_producto;
  const selectorCategoria = formularioRecurso?.elements.categoria_id;
  if (!selectorTipo || !selectorCategoria) return;

  if (!selectorTipo.value) {
    selectorCategoria.replaceChildren(crearOpcion('', 'Primero elegí un tipo de producto', true));
    selectorCategoria.disabled = true;
    selectorCategoria.setAttribute('aria-disabled', 'true');
    return;
  }

  const categoriaSeleccionada = selectorCategoria.value;
  const disponibles = categorias.filter((categoria) => categoria.tipo_producto === selectorTipo.value);
  selectorCategoria.disabled = false;
  selectorCategoria.setAttribute('aria-disabled', 'false');
  selectorCategoria.replaceChildren(crearOpcion('', 'Sin categoría', !categoriaSeleccionada));
  disponibles.forEach((categoria) => selectorCategoria.append(
    crearOpcion(categoria.id, categoria.nombre, categoria.id === categoriaSeleccionada),
  ));
}

function actualizarCampoStock() {
  const controlaStock = formularioRecurso?.elements.controla_stock;
  const stock = formularioRecurso?.elements.stock;
  if (!controlaStock || !stock) return;
  stock.disabled = !controlaStock.checked;
  stock.setAttribute('aria-disabled', String(!controlaStock.checked));
  if (!controlaStock.checked) stock.value = '';
}

async function actualizarSugerenciaSku({ cambioTipo = false } = {}) {
  const selectorTipo = formularioRecurso?.elements.tipo_producto;
  const campoSku = formularioRecurso?.elements.sku;
  if (!selectorTipo || !campoSku) return;

  if (!selectorTipo.value) {
    campoSku.placeholder = 'Primero elegí el tipo de producto';
    return;
  }

  if (cambioTipo && !idEdicion) {
    campoSku.value = '';
    delete campoSku.dataset.editado;
  }

  try {
    const sugerencia = await invocar('obtener_sugerencia_sku', {
      tipo_producto: selectorTipo.value,
    });
    if (selectorTipo.value !== sugerencia.tipo_producto) return;

    campoSku.placeholder = sugerencia.siguiente_sku;
    if (!idEdicion && !campoSku.dataset.editado) campoSku.value = sugerencia.siguiente_sku;
  } catch {
    campoSku.placeholder = 'Escribí un SKU con el prefijo del tipo elegido';
  }
}

function crearCampo(definicion, registro = {}) {
  const contenedor = document.createElement('label');
  contenedor.className = `grupo-campo${definicion.completo ? ' campo-completo' : ''}`;
  const etiqueta = crearEtiqueta(definicion);

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
      const tipoProducto = registro.tipo_producto || '';
      if (!tipoProducto) {
        campo.append(crearOpcion('', 'Primero elegí un tipo de producto', true));
      } else {
        campo.append(crearOpcion('', 'Sin categoría', !registro.categoria_id));
        categorias.filter((categoria) => categoria.tipo_producto === tipoProducto).forEach((categoria) => campo.append(
          crearOpcion(categoria.id, categoria.nombre, registro.categoria_id === categoria.id),
        ));
      }
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
    if (definicion.tipo === 'file') {
      campo.accept = 'image/jpeg,image/png,image/webp,image/avif';
      campo.multiple = Boolean(definicion.multiple);
    }
  }

  campo.name = definicion.nombre;
  campo.required = Boolean(definicion.obligatorio);
  if (definicion.dependeDe && !registro[definicion.dependeDe]) {
    campo.disabled = true;
    campo.setAttribute('aria-disabled', 'true');
  }
  if (idEdicion && definicion.soloCreacion) {
    campo.disabled = true;
    campo.setAttribute('aria-disabled', 'true');
  }
  contenedor.append(etiqueta, campo);

  if (definicion.ayuda) {
    const ayuda = document.createElement('small');
    ayuda.textContent = definicion.ayuda;
    ayuda.style.color = 'var(--tinta-suave)';
    contenedor.append(ayuda);
  }

  if (idEdicion && definicion.soloCreacion) {
    const ayudaInmutable = document.createElement('small');
    ayudaInmutable.textContent = 'Este dato se define al crear el producto y no se puede modificar después.';
    ayudaInmutable.style.color = 'var(--tinta-suave)';
    contenedor.append(ayudaInmutable);
  }

  return contenedor;
}

function abrirDialogo(recurso, registro = null) {
  recursoDialogo = recurso;
  idEdicion = registro?.id || null;
  registroEdicion = registro;
  tituloDialogo.textContent = registro ? `Editar ${registro.nombre || registro.titulo}` : 'Crear nuevo registro';
  camposFormulario.replaceChildren();
  const definiciones = ESQUEMAS_RECURSOS[recurso];
  definiciones.filter((definicion) => !definicion.avanzado).forEach((definicion) => {
    if (recurso === 'productos' && registro && definicion.nombre === 'imagenes_nuevas') {
      camposFormulario.append(crearGestorImagenesProducto(registro));
    }
    camposFormulario.append(crearCampo(definicion, registro || {}));
  });
  const avanzadas = definiciones.filter((definicion) => definicion.avanzado);
  if (avanzadas.length) {
    const detalle = document.createElement('details');
    detalle.className = 'opciones-avanzadas campo-completo';
    const resumen = document.createElement('summary');
    resumen.textContent = 'Opciones avanzadas de SEO';
    const descripcion = document.createElement('p');
    descripcion.textContent = 'Son opcionales y ayudan a que buscadores como Google entiendan mejor este producto.';
    const contenido = document.createElement('div');
    contenido.className = 'contenido-opciones-avanzadas formulario-dos-columnas';
    avanzadas.forEach((definicion) => contenido.append(crearCampo(definicion, registro || {})));
    detalle.append(resumen, descripcion, contenido);
    camposFormulario.append(detalle);
  }
  ocultarError(errorFormulario);
  actualizarCategoriasDisponibles();
  actualizarCampoStock();
  actualizarSugerenciaSku();
  document.body.classList.add('dialogo-abierto');
  if (!dialogo.open) dialogo.showModal();
}

function obtenerDatosFormulario() {
  const datos = {};
  ESQUEMAS_RECURSOS[recursoDialogo].forEach((definicion) => {
    const campo = formularioRecurso.elements[definicion.nombre];
    if (!campo || definicion.soloCreacion && idEdicion || definicion.tipo === 'file') return;

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

async function subirImagenesSiCorresponde(producto) {
  if (recursoDialogo !== 'productos') return;
  const archivos = Array.from(formularioRecurso.elements.imagenes_nuevas?.files || []);
  if (!archivos.length) return;
  const cantidadExistente = registroEdicion?.imagenes?.length || 0;
  if (cantidadExistente + archivos.length > 5) throw new Error('Un producto puede tener como máximo 5 imágenes.');

  for (const [indice, archivo] of archivos.entries()) {
    if (archivo.size > 5 * 1024 * 1024) throw new Error(`La imagen ${archivo.name} supera el máximo de 5 MB.`);
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
        es_principal: cantidadExistente === 0 && indice === 0,
        orden: cantidadExistente + indice + 1,
      },
    });
  }
}

function imagenesOrdenadas(registro) {
  return [...(registro?.imagenes || [])].sort((primera, segunda) => {
    if (primera.es_principal !== segunda.es_principal) return primera.es_principal ? -1 : 1;
    return Number(primera.orden || 0) - Number(segunda.orden || 0);
  });
}

function crearGestorImagenesProducto(registro) {
  const seccion = document.createElement('section');
  seccion.id = 'gestor-imagenes-producto';
  seccion.className = 'gestor-imagenes-producto campo-completo';

  const cabecera = document.createElement('div');
  cabecera.className = 'cabecera-gestor-imagenes';
  const titulo = document.createElement('h3');
  titulo.textContent = 'Imágenes actuales';
  const descripcion = document.createElement('p');
  descripcion.textContent = 'Podés ampliar una imagen o eliminarla. Las nuevas se agregan desde el campo de carga de abajo.';
  cabecera.append(titulo, descripcion);
  seccion.append(cabecera);

  const imagenes = imagenesOrdenadas(registro);
  if (!imagenes.length) {
    const vacio = document.createElement('p');
    vacio.className = 'estado-imagenes-vacio';
    vacio.textContent = 'Este producto todavía no tiene imágenes cargadas.';
    seccion.append(vacio);
    return seccion;
  }

  const cuadricula = document.createElement('div');
  cuadricula.className = 'cuadricula-imagenes-admin';
  imagenes.forEach((imagen, indice) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta-imagen-admin';

    const ampliar = document.createElement('button');
    ampliar.type = 'button';
    ampliar.className = 'boton-miniatura-admin';
    ampliar.dataset.ampliarImagenAdmin = '';
    ampliar.dataset.imagenUrl = imagen.url_publica;
    ampliar.dataset.imagenAlt = imagen.texto_alternativo || registro.nombre;
    ampliar.setAttribute('aria-label', `Ampliar imagen ${indice + 1} de ${registro.nombre}`);
    const vista = document.createElement('img');
    vista.src = imagen.url_publica;
    vista.alt = imagen.texto_alternativo || `Imagen ${indice + 1} de ${registro.nombre}`;
    vista.width = 160;
    vista.height = 160;
    vista.loading = 'lazy';
    ampliar.append(vista);

    const pie = document.createElement('div');
    pie.className = 'acciones-imagen-admin';
    const estado = document.createElement('span');
    estado.textContent = imagen.es_principal ? 'Principal' : `Imagen ${indice + 1}`;
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'boton-eliminar-imagen-admin';
    eliminar.textContent = 'Eliminar';
    eliminar.dataset.eliminarImagen = imagen.id;
    eliminar.dataset.productoImagen = registro.id;
    pie.append(estado, eliminar);
    tarjeta.append(ampliar, pie);
    cuadricula.append(tarjeta);
  });
  seccion.append(cuadricula);
  return seccion;
}

function actualizarGestorImagenesProducto() {
  const actual = formularioRecurso?.querySelector('#gestor-imagenes-producto');
  if (!actual || !registroEdicion) return;
  actual.replaceWith(crearGestorImagenesProducto(registroEdicion));
}

function abrirVisorImagenAdmin(url, alt) {
  let visor = document.querySelector('#visor-imagen-admin');
  if (!visor) {
    visor = document.createElement('dialog');
    visor.id = 'visor-imagen-admin';
    visor.className = 'visor-imagen-admin';
    const contenido = document.createElement('div');
    contenido.className = 'contenido-visor-imagen-admin';
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'boton-icono';
    cerrar.textContent = '×';
    cerrar.setAttribute('aria-label', 'Cerrar imagen ampliada');
    cerrar.addEventListener('click', () => visor.close());
    const imagen = document.createElement('img');
    imagen.dataset.visorImagenAdmin = '';
    contenido.append(cerrar, imagen);
    visor.append(contenido);
    visor.addEventListener('click', (evento) => {
      if (evento.target === visor) visor.close();
    });
    document.body.append(visor);
  }

  const imagen = visor.querySelector('[data-visor-imagen-admin]');
  imagen.src = url;
  imagen.alt = alt;
  if (!visor.open) visor.showModal();
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
  else if (recurso === 'secciones') {
    await Promise.all([cargarSeccionesInicio(), cargarConfiguraciones()]);
  } else if (['productos', 'categorias'].includes(recurso)) {
    await cargarRecurso(recurso);
  }
}

async function cargarSeccionesInicio() {
  const registros = await invocar('obtener_textos_inicio');
  document.querySelectorAll('[data-formulario-seccion-inicio]').forEach((formulario) => {
    const clave = formulario.dataset.formularioSeccionInicio;
    const seccion = registros.find((registro) => registro.clave === clave);
    if (!seccion) {
      notificar('No se pudieron cargar los textos de inicio. Actualizá la página e intentá nuevamente.');
      return;
    }

    ['titulo', 'subtitulo', 'contenido', 'texto_boton'].forEach((nombre) => {
      const campo = formulario.elements[nombre];
      if (campo) campo.value = seccion[nombre] || '';
    });
  });
}

function obtenerDatosSeccionInicio(formulario) {
  const datos = {};
  ['titulo', 'subtitulo', 'contenido', 'texto_boton'].forEach((nombre) => {
    const campo = formulario.elements[nombre];
    if (campo) datos[nombre] = campo.value.trim();
  });
  return datos;
}

async function cargarConfiguraciones() {
  const filas = await invocar('obtener_configuraciones');
  filas.forEach(({ clave, valor }) => {
    [...formulariosConfiguraciones, formularioEstilosGlobales].forEach((formulario) => {
      const campo = formulario?.elements[clave];
      if (!campo) return;
      if (campo.type === 'checkbox') campo.checked = Boolean(valor);
      else campo.value = valor ?? '';
    });
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

botonAlternarContrasena?.addEventListener('click', () => {
  const campo = formularioLogin?.elements.contrasena;
  if (!campo) return;
  const mostrar = campo.type === 'password';
  campo.type = mostrar ? 'text' : 'password';
  botonAlternarContrasena.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  botonAlternarContrasena.setAttribute('aria-pressed', String(mostrar));
  campo.focus();
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

  const ampliarImagen = evento.target.closest('[data-ampliar-imagen-admin]');
  if (ampliarImagen) {
    abrirVisorImagenAdmin(ampliarImagen.dataset.imagenUrl, ampliarImagen.dataset.imagenAlt);
    return;
  }

  const eliminarImagen = evento.target.closest('[data-eliminar-imagen]');
  if (eliminarImagen) {
    if (!registroEdicion || !confirm('¿Querés eliminar esta imagen del producto?')) return;
    try {
      const resultado = await invocar('eliminar_imagen', {
        datos: {
          producto_id: eliminarImagen.dataset.productoImagen,
          imagen_id: eliminarImagen.dataset.eliminarImagen,
        },
      });
      registroEdicion.imagenes = (registroEdicion.imagenes || []).filter(
        (imagen) => imagen.id !== eliminarImagen.dataset.eliminarImagen,
      );
      actualizarGestorImagenesProducto();
      notificar(resultado?.archivo_pendiente
        ? 'La imagen dejó de estar publicada. Su archivo se eliminará automáticamente al reintentarlo.'
        : 'La imagen se eliminó correctamente.');
    } catch (error) {
      notificar(error.message);
    }
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

  const restaurar = evento.target.closest('[data-restaurar]');
  if (restaurar) {
    if (!confirm('¿Querés restaurar este producto como no publicado?')) return;
    try {
      await invocar('restaurar', { recurso: recursoActual, id: restaurar.dataset.restaurar });
      notificar('El producto fue restaurado como no publicado.');
      await cargarRecurso(recursoActual);
    } catch (error) {
      notificar(error.message);
    }
  }
});

document.querySelectorAll('[data-descripcion-recurso]').forEach((elemento) => {
  const recurso = elemento.closest('[data-panel-admin]')?.dataset.panelAdmin;
  elemento.textContent = DESCRIPCIONES_RECURSOS[recurso] || '';
});

document.querySelectorAll('[data-buscar-recurso]').forEach((campo) => {
  campo.addEventListener('input', () => {
    if (campo.dataset.buscarRecurso === 'productos') paginaProductos = 1;
    renderizarListado(campo.dataset.buscarRecurso, Array.from(registrosActuales.values()));
  });
});

document.querySelector('[data-filtro-archivados]')?.addEventListener('change', () => {
  paginaProductos = 1;
  cargarRecurso('productos');
});
document.querySelector('[data-filtro-tipo-producto]')?.addEventListener('change', () => {
  paginaProductos = 1;
  renderizarListado('productos', Array.from(registrosActuales.values()));
});
document.querySelector('[data-filtro-tipo-categoria]')?.addEventListener('change', () => {
  renderizarListado('categorias', Array.from(registrosActuales.values()));
});
document.querySelector('[data-pagina-admin-anterior]')?.addEventListener('click', () => {
  if (paginaProductos <= 1) return;
  paginaProductos -= 1;
  renderizarListado('productos', Array.from(registrosActuales.values()));
  document.querySelector('[data-lista-recurso="productos"]')?.closest('.tabla-contenedor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('[data-pagina-admin-siguiente]')?.addEventListener('click', () => {
  paginaProductos += 1;
  renderizarListado('productos', Array.from(registrosActuales.values()));
  document.querySelector('[data-lista-recurso="productos"]')?.closest('.tabla-contenedor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

formularioRecurso?.addEventListener('change', async (evento) => {
  if (evento.target.name === 'tipo_producto') {
    actualizarCategoriasDisponibles();
    await actualizarSugerenciaSku({ cambioTipo: true });
  }
  if (evento.target.name === 'controla_stock') actualizarCampoStock();
});

formularioRecurso?.addEventListener('input', (evento) => {
  if (evento.target.name === 'sku') evento.target.dataset.editado = 'true';
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
    await subirImagenesSiCorresponde(producto);
    dialogo.close();
    document.body.classList.remove('dialogo-abierto');
    notificar('Contenido guardado correctamente.');
    if (recursoDialogo === 'categorias') await cargarAuxiliares();
    await cargarRecurso(recursoDialogo);
  } catch (error) {
    mostrarError(errorFormulario, error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
});

formulariosConfiguraciones.forEach((formulario) => formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(formulario));
  if (formulario.elements.mostrar_aviso_superior) {
    datos.mostrar_aviso_superior = Boolean(formulario.elements.mostrar_aviso_superior.checked);
  }
  try {
    await invocar('guardar_configuraciones', { datos });
    notificar('Contenido guardado. Actualizá la tienda para ver los cambios.');
  } catch (error) {
    notificar(error.message);
  }
}));

document.querySelectorAll('[data-formulario-seccion-inicio]').forEach((formulario) => formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formulario.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await invocar('guardar_textos_inicio', {
      clave: formulario.dataset.formularioSeccionInicio,
      datos: obtenerDatosSeccionInicio(formulario),
    });
    notificar('El bloque del inicio se guardó. Actualizá la portada para ver el cambio.');
    await cargarSeccionesInicio();
  } catch (error) {
    notificar(error.message);
  } finally {
    boton.disabled = false;
  }
}));

formularioEstilosGlobales?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(formularioEstilosGlobales));
  try {
    await invocar('guardar_configuraciones', { datos });
    notificar('El estilo visual se guardó. Actualizá la tienda para ver los cambios.');
  } catch (error) {
    notificar(error.message);
  }
});

function cerrarDialogo() {
  dialogo.close();
  document.body.classList.remove('dialogo-abierto');
}

function establecerMenuAdminContraido(contraido) {
  const lateral = document.querySelector('.admin-lateral');
  if (!panelAdministracion || !lateral || !botonAlternarMenu) return;

  panelAdministracion.classList.toggle('menu-admin-contraido', contraido);
  lateral.classList.toggle('contraido', contraido);
  botonAlternarMenu.setAttribute('aria-expanded', String(!contraido));
  botonAlternarMenu.querySelector('[aria-hidden="true"]').textContent = contraido ? '›' : '‹';
  botonAlternarMenu.querySelector('.solo-lectores').textContent = contraido
    ? 'Expandir menú de administración'
    : 'Contraer menú de administración';

  try {
    localStorage.setItem('menu-admin-contraido', String(contraido));
  } catch {
    // El menú funciona igualmente si el navegador bloquea el almacenamiento local.
  }
}

document.querySelector('#cerrar-dialogo')?.addEventListener('click', cerrarDialogo);
document.querySelector('#cancelar-dialogo')?.addEventListener('click', cerrarDialogo);
dialogo?.addEventListener('close', () => document.body.classList.remove('dialogo-abierto'));
botonCerrarSesion?.addEventListener('click', () => dialogoCerrarSesion?.showModal());
botonCancelarCerrarSesion?.addEventListener('click', () => dialogoCerrarSesion?.close());
botonConfirmarCerrarSesion?.addEventListener('click', async () => {
  dialogoCerrarSesion?.close();
  await cerrarSesionCompleta();
});
botonAlternarMenu?.addEventListener('click', () => {
  establecerMenuAdminContraido(!panelAdministracion?.classList.contains('menu-admin-contraido'));
});

try {
  establecerMenuAdminContraido(localStorage.getItem('menu-admin-contraido') === 'true');
} catch {
  // La preferencia es opcional.
}

setInterval(() => {
  if (panelAdministracion?.hidden) return;
  const transcurridos = Date.now() - ultimaActividadConfirmada;
  const restantes = Math.max(0, minutosInactividad * 60_000 - transcurridos);
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

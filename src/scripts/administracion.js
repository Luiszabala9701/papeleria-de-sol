import { obtenerClienteSupabase } from '../servicios/cliente-supabase.js';
import {
  CAMPOS_ESTILO_SECCION,
  OPCIONES_FUENTE,
  OPCIONES_TAMANO,
  esColorHexadecimal,
} from '../servicios/estilos-visuales.ts';

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
const formularioConfiguraciones = document.querySelector('#formulario-configuraciones');
const formularioEstilosGlobales = document.querySelector('#formulario-estilos-globales');
const botonAlternarContrasena = document.querySelector('#alternar-contrasena-admin');

const DESCRIPCIONES = {
  productos: 'Creá stickers, plantillas y productos físicos con precio, imágenes y publicación.',
  categorias: 'Creá categorías específicas para cada tipo de producto, como Fútbol para stickers.',
  secciones: 'Modificá los textos y los estilos de los bloques públicos del sitio.',
};

const ESQUEMAS = {
  productos: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    { nombre: 'sku', etiqueta: 'SKU', tipo: 'text', ayuda: 'Código opcional para identificar el producto internamente.' },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo de producto', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select-categorias' },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', obligatorio: true, completo: true },
    { nombre: 'precio', etiqueta: 'Precio en pesos', tipo: 'number', minimo: 0, obligatorio: true },
    {
      nombre: 'estado', etiqueta: 'Estado de publicación', tipo: 'select', obligatorio: true,
      ayudaEmergente: 'Borrador guarda el producto sin mostrarlo en la tienda. Publicado lo muestra al público y Oculto lo retira temporalmente sin borrarlo.',
      opciones: [
        { valor: 'borrador', texto: 'Borrador' },
        { valor: 'publicado', texto: 'Publicado' },
        { valor: 'oculto', texto: 'Oculto' },
      ],
    },
    { nombre: 'controla_stock', etiqueta: 'Controlar stock', tipo: 'checkbox' },
    { nombre: 'stock', etiqueta: 'Stock disponible', tipo: 'number', minimo: 0, dependeDe: 'controla_stock' },
    { nombre: 'destacado', etiqueta: 'Mostrar como destacado', tipo: 'checkbox' },
    { nombre: 'imagenes_nuevas', etiqueta: 'Imágenes del producto (máximo 5)', tipo: 'file', multiple: true, completo: true, ayuda: 'Podés seleccionar varias imágenes a la vez. Cada archivo puede pesar hasta 5 MB.' },
    { nombre: 'meta_titulo', etiqueta: 'Título para buscadores', tipo: 'text', completo: true, avanzado: true, ayuda: 'Es el título que podría mostrarse en Google. Si se deja vacío, se usa el nombre del producto.' },
    { nombre: 'meta_descripcion', etiqueta: 'Descripción para buscadores', tipo: 'textarea', completo: true, avanzado: true, ayuda: 'Es el texto breve que podría mostrarse debajo del título en Google. Si se deja vacío, se usa la descripción del producto.' },
  ],
  categorias: [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'text', obligatorio: true },
    {
      nombre: 'tipo_producto', etiqueta: 'Tipo de producto', tipo: 'select', obligatorio: true,
      opciones: [
        { valor: 'sticker', texto: 'Sticker' },
        { valor: 'plantilla', texto: 'Plantilla' },
        { valor: 'fisico', texto: 'Producto físico' },
      ],
    },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', completo: true },
    { nombre: 'publicada', etiqueta: 'Publicada', tipo: 'checkbox' },
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
    { nombre: 'estilos', etiqueta: 'Apariencia de cada texto', tipo: 'estilos-seccion', completo: true },
  ],
};

const COLUMNAS = {
  productos: [
    { clave: 'nombre', texto: 'Producto' },
    { clave: 'imagen_principal', texto: 'Imagen' },
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
let registroEdicion = null;
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
  categorias = await invocar('listar', { recurso: 'categorias' });
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

function obtenerImagenPrincipal(registro) {
  const imagenes = [...(registro.imagenes || [])].sort((primera, segunda) => primera.orden - segunda.orden);
  return imagenes.find((imagen) => imagen.es_principal) || imagenes[0] || null;
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
    total.textContent = `${filtrados.length} registro${filtrados.length === 1 ? '' : 's'}${filtrados.length > 200 ? ' · mostrando los primeros 200' : ''}`;
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

function crearOpcion(valor, texto, seleccionada = false) {
  const opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  opcion.selected = seleccionada;
  return opcion;
}

function crearEtiqueta(definicion) {
  const etiqueta = document.createElement('span');
  etiqueta.textContent = definicion.etiqueta;
  if (definicion.obligatorio) {
    const obligatorio = document.createElement('b');
    obligatorio.className = 'indicador-obligatorio';
    obligatorio.textContent = ' *';
    obligatorio.setAttribute('aria-label', 'Campo obligatorio');
    etiqueta.append(obligatorio);
  }
  return etiqueta;
}

function actualizarCategoriasDisponibles() {
  const selectorTipo = formularioRecurso?.elements.tipo_producto;
  const selectorCategoria = formularioRecurso?.elements.categoria_id;
  if (!selectorTipo || !selectorCategoria) return;

  const categoriaSeleccionada = selectorCategoria.value;
  const disponibles = categorias.filter((categoria) => categoria.tipo_producto === selectorTipo.value);
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

function crearControlEstilo(etiqueta, control) {
  const contenedor = document.createElement('label');
  contenedor.className = 'control-estilo-texto';
  const texto = document.createElement('span');
  texto.textContent = etiqueta;
  contenedor.append(texto, control);
  return contenedor;
}

function crearEditorEstilosSeccion(registro = {}) {
  const contenedor = document.createElement('fieldset');
  contenedor.className = 'editor-estilos-seccion campo-completo';
  const titulo = document.createElement('legend');
  titulo.textContent = 'Apariencia de cada texto';
  contenedor.append(titulo);

  const ayuda = document.createElement('p');
  ayuda.textContent = 'Estas opciones aplican formato sin permitir código ni estilos externos.';
  contenedor.append(ayuda);

  CAMPOS_ESTILO_SECCION.forEach(({ clave, etiqueta }) => {
    const estiloActual = registro.estilos?.[clave] || {};
    const grupo = document.createElement('fieldset');
    grupo.className = 'grupo-estilo-texto';
    const leyenda = document.createElement('legend');
    leyenda.textContent = etiqueta;
    grupo.append(leyenda);

    const color = document.createElement('input');
    color.type = 'color';
    color.name = `estilo_${clave}_color`;
    color.value = esColorHexadecimal(estiloActual.color) ? estiloActual.color : '#252434';
    grupo.append(crearControlEstilo('Color', color));

    const fuente = document.createElement('select');
    fuente.className = 'selector';
    fuente.name = `estilo_${clave}_fuente`;
    OPCIONES_FUENTE.forEach((opcion) => fuente.append(
      crearOpcion(opcion.valor, opcion.texto, (estiloActual.fuente || 'moderna') === opcion.valor),
    ));
    grupo.append(crearControlEstilo('Fuente', fuente));

    const tamano = document.createElement('select');
    tamano.className = 'selector';
    tamano.name = `estilo_${clave}_tamano`;
    OPCIONES_TAMANO.forEach((opcion) => tamano.append(
      crearOpcion(opcion.valor, opcion.texto, (estiloActual.tamano || 'normal') === opcion.valor),
    ));
    grupo.append(crearControlEstilo('Tamaño', tamano));

    const negrita = document.createElement('input');
    negrita.type = 'checkbox';
    negrita.name = `estilo_${clave}_negrita`;
    negrita.checked = Boolean(estiloActual.negrita);
    grupo.append(crearControlEstilo('Negrita', negrita));

    const cursiva = document.createElement('input');
    cursiva.type = 'checkbox';
    cursiva.name = `estilo_${clave}_cursiva`;
    cursiva.checked = Boolean(estiloActual.cursiva);
    grupo.append(crearControlEstilo('Cursiva', cursiva));
    contenedor.append(grupo);
  });

  return contenedor;
}

function crearCampo(definicion, registro = {}) {
  if (definicion.tipo === 'estilos-seccion') return crearEditorEstilosSeccion(registro);

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
      const tipoProducto = registro.tipo_producto || 'sticker';
      campo.append(crearOpcion('', 'Sin categoría', !registro.categoria_id));
      categorias.filter((categoria) => categoria.tipo_producto === tipoProducto).forEach((categoria) => campo.append(
        crearOpcion(categoria.id, categoria.nombre, registro.categoria_id === categoria.id),
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
  contenedor.append(etiqueta, campo);

  if (definicion.ayuda) {
    const ayuda = document.createElement('small');
    ayuda.textContent = definicion.ayuda;
    ayuda.style.color = 'var(--tinta-suave)';
    contenedor.append(ayuda);
  }

  if (definicion.ayudaEmergente) {
    const ayuda = document.createElement('details');
    ayuda.className = 'ayuda-emergente';
    const resumen = document.createElement('summary');
    resumen.textContent = '!';
    resumen.setAttribute('aria-label', 'Explicación sobre este campo');
    const texto = document.createElement('p');
    texto.textContent = definicion.ayudaEmergente;
    ayuda.append(resumen, texto);
    etiqueta.append(ayuda);
  }

  return contenedor;
}

function abrirDialogo(recurso, registro = null) {
  recursoDialogo = recurso;
  idEdicion = registro?.id || null;
  registroEdicion = registro;
  tituloDialogo.textContent = registro ? `Editar ${registro.nombre || registro.titulo}` : 'Crear nuevo registro';
  camposFormulario.replaceChildren();
  const definiciones = ESQUEMAS[recurso];
  definiciones.filter((definicion) => !definicion.avanzado).forEach((definicion) => {
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
  document.body.classList.add('dialogo-abierto');
  if (!dialogo.open) dialogo.showModal();
}

function obtenerDatosFormulario() {
  const datos = {};
  ESQUEMAS[recursoDialogo].forEach((definicion) => {
    const campo = formularioRecurso.elements[definicion.nombre];
    if (!campo || ['file', 'estilos-seccion'].includes(definicion.tipo)) return;

    if (definicion.tipo === 'checkbox') datos[definicion.nombre] = campo.checked;
    else if (definicion.multiple) datos[definicion.nombre] = Array.from(campo.selectedOptions).map((opcion) => opcion.value);
    else if (definicion.tipo === 'number') datos[definicion.nombre] = campo.value === '' ? null : Number(campo.value);
    else datos[definicion.nombre] = campo.value || null;
  });

  if (recursoDialogo === 'productos') {
    datos.moneda = 'ARS';
    if (!datos.controla_stock) datos.stock = null;
  }

  if (recursoDialogo === 'secciones') {
    datos.estilos = Object.fromEntries(CAMPOS_ESTILO_SECCION.map(({ clave }) => [clave, {
      color: formularioRecurso.elements[`estilo_${clave}_color`]?.value,
      fuente: formularioRecurso.elements[`estilo_${clave}_fuente`]?.value,
      tamano: formularioRecurso.elements[`estilo_${clave}_tamano`]?.value,
      negrita: Boolean(formularioRecurso.elements[`estilo_${clave}_negrita`]?.checked),
      cursiva: Boolean(formularioRecurso.elements[`estilo_${clave}_cursiva`]?.checked),
    }]));
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
    await Promise.all([cargarRecurso(recurso), cargarConfiguraciones()]);
  } else if (['productos', 'categorias'].includes(recurso)) {
    await cargarRecurso(recurso);
  }
}

async function cargarConfiguraciones() {
  const filas = await invocar('obtener_configuraciones');
  filas.forEach(({ clave, valor }) => {
    [formularioConfiguraciones, formularioEstilosGlobales].forEach((formulario) => {
      const campo = formulario?.elements[clave];
      if (campo) campo.value = valor ?? '';
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
    if (!confirm('¿Querés restaurar este producto como borrador?')) return;
    try {
      await invocar('restaurar', { recurso: recursoActual, id: restaurar.dataset.restaurar });
      notificar('El producto fue restaurado como borrador.');
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

document.querySelector('[data-filtro-archivados]')?.addEventListener('change', () => cargarRecurso('productos'));

formularioRecurso?.addEventListener('change', (evento) => {
  if (evento.target.name === 'tipo_producto') actualizarCategoriasDisponibles();
  if (evento.target.name === 'controla_stock') actualizarCampoStock();
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

formularioConfiguraciones?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(formularioConfiguraciones));
  try {
    await invocar('guardar_configuraciones', { datos });
    notificar('Datos comerciales actualizados.');
  } catch (error) {
    notificar(error.message);
  }
});

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

document.querySelector('#cerrar-dialogo')?.addEventListener('click', cerrarDialogo);
document.querySelector('#cancelar-dialogo')?.addEventListener('click', cerrarDialogo);
dialogo?.addEventListener('close', () => document.body.classList.remove('dialogo-abierto'));
botonCerrarSesion?.addEventListener('click', cerrarSesionCompleta);

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

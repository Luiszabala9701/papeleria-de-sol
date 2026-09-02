export function mostrarError(elemento, mensaje) {
  if (!elemento) return;
  elemento.textContent = mensaje;
  elemento.hidden = false;
}

export function ocultarError(elemento) {
  if (elemento) elemento.hidden = true;
}

export function notificar(mensaje) {
  const contenedor = document.querySelector('#contenedor-notificaciones');
  if (!contenedor) return;

  const elemento = document.createElement('div');
  elemento.className = 'notificacion';
  elemento.textContent = mensaje;
  contenedor.append(elemento);
  setTimeout(() => elemento.remove(), 3500);
}

export function valorVisible(registro, clave) {
  const valor = registro[clave];

  if (clave === 'precio') {
    return valor == null
      ? 'Consultar'
      : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor);
  }

  if (clave === 'stock') return registro.controla_stock ? String(valor ?? 0) : 'Sin control';
  if (clave === 'estado' && valor === 'borrador') return 'No publicado';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (clave === 'tipo_producto' && valor === 'fisico') return 'Producto físico';

  return valor ?? '—';
}

export function obtenerImagenPrincipal(registro) {
  const imagenes = [...(registro.imagenes || [])].sort(
    (primera, segunda) => primera.orden - segunda.orden,
  );

  return imagenes.find((imagen) => imagen.es_principal) || imagenes[0] || null;
}

export function crearBotonAccion(texto, atributo, id) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = texto;
  boton.dataset[atributo] = id;
  return boton;
}

export function crearOpcion(valor, texto, seleccionada = false) {
  const opcion = document.createElement('option');
  opcion.value = valor;
  opcion.textContent = texto;
  opcion.selected = seleccionada;
  return opcion;
}

export function crearEtiqueta(definicion, asociadaAlCampo = false) {
  const etiqueta = document.createElement(asociadaAlCampo ? 'label' : 'span');
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

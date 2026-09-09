import { TIPOS_STICKER, MAXIMO_VARIANTES_FISICAS } from '../../servicios/variantes.js';

function elemento(etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  if (texto) nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

export function crearEditorVariantes(formulario, registro = {}, crearGaleria, eliminarVariante) {
  const contenedor = elemento('section', '', 'editor-variantes campo-completo');
  const activar = elemento('input');
  activar.type = 'checkbox';
  activar.checked = Boolean(registro.usa_variantes);
  const etiquetaActivar = elemento('label', '', 'grupo-checkbox');
  etiquetaActivar.append(activar, document.createTextNode('Este producto tiene variantes'));
  const titulo = elemento('h3');
  const ayuda = elemento('p');
  const lista = elemento('div', '', 'lista-variantes-admin');
  const agregar = elemento('button', 'Agregar variante', 'boton boton-secundario');
  agregar.type = 'button';
  contenedor.append(etiquetaActivar, titulo, ayuda, lista, agregar);
  let tipoActual;
  let filas = [];

  function crearFila(version, esSticker) {
    const tarjeta = elemento('article', '', 'variante-admin');
    const habilitada = elemento('input');
    habilitada.type = 'checkbox';
    habilitada.checked = version.estado !== 'archivado';
    const cabecera = elemento('div', '', 'cabecera-variante-admin');
    const selectorEstado = elemento('label', '', 'grupo-checkbox');
    const rotulo = elemento('span', version.nombre);
    selectorEstado.append(habilitada, rotulo);
    const eliminar = elemento('button', version.sku ? 'Eliminar variante' : 'Quitar variante', 'boton-eliminar-variante-admin');
    eliminar.type = 'button';
    cabecera.append(selectorEstado, eliminar);
    const campos = elemento('fieldset', '', 'formulario-dos-columnas');
    const controles = {};
    function campo(nombre, etiqueta, tipo, obligatorio = true) {
      const grupo = elemento('label', '', `grupo-campo${tipo === 'textarea' || tipo === 'file' ? ' campo-completo' : ''}`);
      const entrada = elemento(tipo === 'textarea' ? 'textarea' : 'input', '', tipo === 'textarea' ? 'area-texto' : 'campo');
      if (tipo !== 'textarea') entrada.type = tipo;
      entrada.required = obligatorio;
      entrada.dataset.campoVariante = nombre;
      if (tipo === 'number') { entrada.min = '0'; entrada.step = nombre === 'stock' ? '1' : '0.01'; }
      if (tipo === 'file') { entrada.multiple = true; entrada.accept = 'image/jpeg,image/png,image/webp,image/avif'; }
      else entrada.value = version[nombre] ?? '';
      grupo.append(elemento('span', etiqueta), entrada);
      campos.append(grupo);
      controles[nombre] = entrada;
    }
    if (!esSticker) campo('nombre', 'Nombre de la variante', 'text');
    campo('precio', 'Precio en pesos', 'number');
    if (!esSticker) {
      campo('stock', 'Stock disponible', 'number');
      campo('descripcion', 'Descripción de la variante (opcional)', 'textarea', false);
      const visible = elemento('input');
      visible.type = 'checkbox';
      visible.checked = version.estado === 'publicado';
      const grupo = elemento('label', '', 'grupo-checkbox');
      grupo.append(visible, document.createTextNode('Visible para clientes'));
      campos.append(grupo);
      controles.visible = visible;
      if (registro.id) campos.append(crearGaleria({ ...registro, imagenes: (registro.imagenes || []).filter(i => i.variante_id === version.id) }, version.id));
      campo('imagenes', 'Imágenes de esta variante (máximo 3)', 'file', false);
    }
    campos.append(elemento('small', version.sku ? `SKU: ${version.sku}` : 'El SKU se asigna automáticamente al guardar.', 'campo-completo'));
    tarjeta.append(cabecera, campos);
    const fila = { version, tarjeta, habilitada, campos, controles, rotulo };
    habilitada.addEventListener('change', actualizarVisibilidad);
    controles.nombre?.addEventListener('input', actualizarVisibilidad);
    eliminar.addEventListener('click', async () => {
      const usa = tipoActual === 'sticker' || tipoActual === 'fisico' && activar.checked;
      const activas = filas.filter(f => f.habilitada.checked);
      if (usa && habilitada.checked && activas.length === 1) {
        alert('No podés eliminar la última variante mientras el producto use variantes.');
        return;
      }
      if (version.sku && !confirm(`¿Querés eliminar definitivamente la variante ${version.nombre}? Su SKU quedará libre.`)) return;
      eliminar.disabled = true;
      try {
        if (version.sku) await eliminarVariante(version);
        filas = filas.filter(f => f !== fila);
        tarjeta.remove();
        actualizarVisibilidad();
      } catch (error) {
        alert(error.message || 'No se pudo eliminar la variante.');
        eliminar.disabled = false;
      }
    });
    filas.push(fila);
    lista.append(tarjeta);
    return fila;
  }

  function actualizarVisibilidad() {
    const fisico = tipoActual === 'fisico';
    const usa = tipoActual === 'sticker' || fisico && activar.checked;
    contenedor.hidden = !['sticker', 'fisico'].includes(tipoActual);
    etiquetaActivar.hidden = !fisico;
    lista.hidden = !usa;
    titulo.hidden = !usa;
    ayuda.hidden = !usa;
    agregar.hidden = !fisico || !usa;
    agregar.disabled = filas.filter(f => f.habilitada.checked).length >= MAXIMO_VARIANTES_FISICAS;
    for (const fila of filas) {
      fila.campos.disabled = !usa || !fila.habilitada.checked;
      fila.habilitada.disabled = !usa;
      if (fisico) fila.rotulo.textContent = `${fila.controles.nombre.value || fila.version.nombre || 'Nueva variante'} — ${fila.habilitada.checked ? 'Disponible' : 'Archivada'}`;
    }
    for (const nombre of ['precio', 'stock']) {
      const campo = formulario.elements[nombre];
      const mostrar = !usa && (nombre === 'precio' || fisico);
      campo.closest('label').hidden = !mostrar;
      campo.disabled = !mostrar;
      campo.required = mostrar;
      campo.step = nombre === 'stock' ? '1' : '0.01';
    }
  }

  function actualizarTipo() {
    const tipo = formulario.elements.tipo_producto?.value;
    if (tipo !== tipoActual) {
      tipoActual = tipo;
      filas = [];
      lista.replaceChildren();
      if (tipo === 'sticker') {
        titulo.textContent = 'Versiones del sticker';
        ayuda.textContent = 'Activá al menos una versión y cargá su precio. Comparten las fotos del sticker y no controlan stock.';
        TIPOS_STICKER.forEach((acabado, indice) => {
          const existente = registro.variantes?.find(v => v.clave === acabado.clave);
          crearFila(existente || { ...acabado, id: crypto.randomUUID(), precio: indice === 0 ? registro.precio : '', estado: indice === 0 ? 'publicado' : 'archivado' }, true);
        });
      } else if (tipo === 'fisico') {
        titulo.textContent = 'Variantes del producto';
        ayuda.textContent = 'Hasta 10 variantes activas, con precio, stock y hasta 3 fotos propias. Desmarcar archiva; Eliminar variante borra sus datos y libera su SKU.';
        (registro.variantes || []).forEach(v => crearFila(v, false));
      }
    }
    actualizarVisibilidad();
  }
  agregar.addEventListener('click', () => {
    if (filas.filter(f => f.habilitada.checked).length >= MAXIMO_VARIANTES_FISICAS) return;
    const id = crypto.randomUUID();
    const fila = crearFila({ id, clave: id, nombre: '', precio: '', stock: '', estado: 'publicado' }, false);
    actualizarVisibilidad();
    fila.controles.nombre.focus();
  });
  activar.addEventListener('change', actualizarVisibilidad);
  return {
    contenedor, actualizarTipo,
    obtener() {
      const usa = tipoActual === 'sticker' || tipoActual === 'fisico' && activar.checked;
      const activas = usa ? filas.filter(f => f.habilitada.checked) : [];
      if (usa && !activas.length) throw new Error('Activá al menos una variante.');
      if (activas.length > MAXIMO_VARIANTES_FISICAS) throw new Error('El máximo es de 10 variantes activas.');
      return { usa_variantes: usa, variantes: activas.map(({ version, controles }, orden) => ({
        id: version.id, clave: version.clave, nombre: controles.nombre?.value || version.nombre,
        descripcion: controles.descripcion?.value || '', precio: Number(controles.precio.value),
        stock: tipoActual === 'fisico' ? Number(controles.stock.value) : null,
        estado: tipoActual === 'sticker' || controles.visible?.checked ? 'publicado' : 'borrador', orden,
      })) };
    },
    cargas() {
      return tipoActual === 'fisico' && activar.checked
        ? filas.filter(f => f.habilitada.checked).map(f => ({ varianteId: f.version.id, campo: f.controles.imagenes, maximo: 3 }))
        : [];
    },
  };
}

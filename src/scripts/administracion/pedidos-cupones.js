const DINERO = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const FECHA = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' });
const ETIQUETAS = {
  automatico: 'Automático', coordinado: 'Coordinado', sin_cobro: 'Sin cobro', pendiente: 'Pendiente',
  parcial: 'Parcial', pagado: 'Pago aprobado', reembolsado_parcial: 'Reembolso parcial',
  reembolsado_total: 'Reembolso total', no_iniciada: 'No iniciada', espera_anticipo: 'Espera anticipo',
  en_diseno: 'En diseño', espera_aprobacion: 'Espera aprobación', en_preparacion: 'En preparación',
  listo: 'Listo', solicitud: 'Solicitud', cotizando: 'Cotizando', espera_cliente: 'Espera cliente',
  confirmado: 'Confirmado', cancelado: 'Cancelado', finalizado: 'Finalizado', sin_definir: 'Sin definir',
  listo_retiro: 'Listo para retirar', retirado: 'Retirado', enviado: 'Enviado', entregado: 'Entregado',
};

function dinero(centavos) {
  return DINERO.format(Number(centavos || 0) / 100);
}

function fecha(valor) {
  if (!valor) return '—';
  const objeto = new Date(valor);
  return Number.isNaN(objeto.getTime()) ? '—' : FECHA.format(objeto);
}

function elemento(tipo, texto, clase) {
  const nodo = document.createElement(tipo);
  if (texto != null) nodo.textContent = String(texto);
  if (clase) nodo.className = clase;
  return nodo;
}

function boton(texto, clase = 'boton boton-secundario') {
  const nodo = elemento('button', texto, clase);
  nodo.type = 'button';
  return nodo;
}

function opcion(valor, etiqueta, seleccionada = false) {
  const nodo = elemento('option', etiqueta);
  nodo.value = valor;
  nodo.selected = seleccionada;
  return nodo;
}

function centavos(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function fechaFormulario(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  const desplazamiento = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - desplazamiento).toISOString().slice(0, 16);
}

export function inicializarModuloComercial({ invocar, notificar }) {
  const estado = {
    pedidos: { pagina: 1, total: 0, porPagina: 25, cargado: false },
    cupones: { pagina: 1, total: 0, porPagina: 25, cargado: false, filas: new Map() },
    catalogo: null,
  };
  const dialogoPedido = document.querySelector('#dialogo-pedido');
  const detallePedido = document.querySelector('[data-detalle-pedido]');
  const dialogoCupon = document.querySelector('#dialogo-cupon');
  const formularioCupon = document.querySelector('[data-formulario-cupon]');
  const errorCupon = document.querySelector('[data-error-cupon]');

  async function cargarPedidos() {
    const formulario = document.querySelector('[data-filtros-pedidos]');
    const salida = document.querySelector('[data-estado-pedidos]');
    const cuerpo = Object.fromEntries(new FormData(formulario || undefined));
    salida.textContent = 'Cargando pedidos…';
    try {
      const resultado = await invocar('listar_pedidos', {
        ...cuerpo, pagina: estado.pedidos.pagina, por_pagina: estado.pedidos.porPagina,
      });
      estado.pedidos.total = resultado.total;
      estado.pedidos.cargado = true;
      renderizarPedidos(resultado.filas);
      salida.textContent = `${resultado.total} pedido${resultado.total === 1 ? '' : 's'}`;
      actualizarPaginacion('pedidos');
    } catch (error) {
      salida.textContent = error.message;
      notificar(error.message);
    }
  }

  function renderizarPedidos(filas) {
    const cuerpo = document.querySelector('[data-lista-pedidos]');
    cuerpo.replaceChildren();
    if (!filas.length) {
      const fila = document.createElement('tr');
      const celda = elemento('td', 'No hay pedidos que coincidan con los filtros.');
      celda.colSpan = 8;
      fila.append(celda);
      cuerpo.append(fila);
      return;
    }
    filas.forEach((pedido) => {
      const fila = document.createElement('tr');
      const numero = elemento('strong', `#${pedido.numero}`);
      const celdaNumero = document.createElement('td');
      celdaNumero.append(numero);
      const cliente = document.createElement('td');
      cliente.append(elemento('strong', pedido.cliente_nombre), elemento('small', pedido.cliente_correo));
      const ver = boton('Ver detalle');
      ver.addEventListener('click', () => abrirPedido(pedido.id));
      [
        celdaNumero, cliente, elemento('td', ETIQUETAS[pedido.tipo] || pedido.tipo),
        elemento('td', dinero(pedido.total_centavos)), elemento('td', ETIQUETAS[pedido.estado_financiero] || pedido.estado_financiero),
        elemento('td', ETIQUETAS[pedido.estado_preparacion] || pedido.estado_preparacion), elemento('td', fecha(pedido.creado_en)),
      ].forEach(celda => fila.append(celda));
      const acciones = document.createElement('td');
      acciones.append(ver);
      fila.append(acciones);
      cuerpo.append(fila);
    });
  }

  function bloqueDato(etiqueta, valor) {
    const bloque = elemento('div', null, 'dato-pedido');
    bloque.append(elemento('span', etiqueta), elemento('strong', valor));
    return bloque;
  }

  function crearControlEstado(pedido, campo, valores, etiqueta) {
    const formulario = elemento('form', null, 'control-estado-pedido');
    const titulo = elemento('label', etiqueta);
    const selector = elemento('select', null, 'selector');
    selector.name = 'valor';
    valores.forEach(valor => selector.append(opcion(valor, ETIQUETAS[valor] || valor, pedido[campo] === valor)));
    const guardar = elemento('button', 'Guardar', 'boton boton-secundario');
    guardar.type = 'submit';
    titulo.append(selector);
    formulario.append(titulo, guardar);
    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      guardar.disabled = true;
      try {
        await invocar('actualizar_estado_pedido', { id: pedido.id, campo, valor: selector.value });
        notificar('Estado actualizado.');
        await Promise.all([abrirPedido(pedido.id), cargarPedidos()]);
      } catch (error) { notificar(error.message); } finally { guardar.disabled = false; }
    });
    return formulario;
  }

  async function abrirPedido(id) {
    detallePedido.textContent = 'Cargando detalle…';
    if (!dialogoPedido.open) dialogoPedido.showModal();
    try {
      const datos = await invocar('obtener_pedido', { id });
      const pedido = datos.pedido;
      document.querySelector('#titulo-dialogo-pedido').textContent = `Pedido #${pedido.numero}`;
      detallePedido.replaceChildren();
      const resumen = elemento('div', null, 'grilla-datos-pedido');
      resumen.append(
        bloqueDato('Cliente', pedido.cliente_nombre), bloqueDato('Correo', pedido.cliente_correo),
        bloqueDato('WhatsApp', pedido.cliente_whatsapp), bloqueDato('Tipo', ETIQUETAS[pedido.tipo] || pedido.tipo),
        bloqueDato('Total', dinero(pedido.total_centavos)), bloqueDato('Pago', ETIQUETAS[pedido.estado_financiero] || pedido.estado_financiero),
      );
      detallePedido.append(resumen);
      if (pedido.observaciones_cliente) detallePedido.append(elemento('p', `Observaciones: ${pedido.observaciones_cliente}`, 'nota-pedido'));

      const tituloItems = elemento('h3', 'Productos');
      const lista = elemento('ul', null, 'lista-items-pedido');
      datos.items.forEach(item => {
        const nombre = item.variante_nombre ? `${item.producto_nombre} · ${item.variante_nombre}` : item.producto_nombre;
        lista.append(elemento('li', `${item.cantidad} × ${nombre} — ${dinero(item.subtotal_centavos)}`));
      });
      detallePedido.append(tituloItems, lista);

      const controles = elemento('div', null, 'controles-pedido');
      controles.append(
        crearControlEstado(pedido, 'estado_comercial', ['solicitud', 'cotizando', 'espera_cliente', 'confirmado', 'cancelado', 'finalizado'], 'Estado comercial'),
        crearControlEstado(pedido, 'estado_preparacion', ['no_iniciada', 'espera_anticipo', 'en_diseno', 'espera_aprobacion', 'en_preparacion', 'listo'], 'Preparación'),
        crearControlEstado(pedido, 'estado_entrega', ['sin_definir', 'pendiente', 'listo_retiro', 'retirado', 'enviado', 'entregado'], 'Entrega'),
      );
      detallePedido.append(elemento('h3', 'Estados'), controles);

      const acciones = elemento('div', null, 'acciones-pedido-comercial');
      const enlace = boton('Generar nuevo enlace privado');
      enlace.addEventListener('click', async () => {
        enlace.disabled = true;
        try {
          const resultado = await invocar('crear_enlace_seguimiento', { id: pedido.id });
          await navigator.clipboard.writeText(resultado.url).catch(() => {});
          const salida = elemento('a', resultado.url, 'enlace-seguimiento-generado');
          salida.href = resultado.url;
          salida.target = '_blank';
          salida.rel = 'noopener';
          acciones.append(salida);
          notificar('Enlace privado generado y copiado. El enlace anterior quedó revocado.');
        } catch (error) { notificar(error.message); } finally { enlace.disabled = false; }
      });
      acciones.append(enlace);
      detallePedido.append(elemento('h3', 'Seguimiento privado'), acciones);

      const pago = elemento('form', null, 'formulario-transferencia');
      const importe = document.createElement('input');
      importe.className = 'campo'; importe.name = 'importe'; importe.type = 'number'; importe.min = '0.01'; importe.step = '0.01'; importe.required = true;
      importe.placeholder = 'Importe en pesos';
      const tipo = elemento('select', null, 'selector'); tipo.name = 'tipo';
      tipo.append(opcion('total', 'Pago total'), opcion('anticipo', 'Anticipo'), opcion('saldo', 'Saldo'));
      const referencia = document.createElement('input');
      referencia.className = 'campo'; referencia.name = 'referencia'; referencia.maxLength = 300; referencia.placeholder = 'Referencia del comprobante (opcional)';
      const aprobar = elemento('button', 'Marcar como pago aprobado', 'boton boton-principal'); aprobar.type = 'submit';
      pago.append(importe, tipo, referencia, aprobar);
      pago.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        aprobar.disabled = true;
        try {
          await invocar('aprobar_transferencia', {
            id: pedido.id, importe_centavos: centavos(importe.value), tipo_pago: tipo.value, referencia: referencia.value,
          });
          notificar('Pago aprobado.');
          await Promise.all([abrirPedido(pedido.id), cargarPedidos()]);
        } catch (error) { notificar(error.message); } finally { aprobar.disabled = false; }
      });
      detallePedido.append(elemento('h3', 'Transferencia verificada'), elemento('p', 'Usá esta acción solo después de comprobar el ingreso en la cuenta.'), pago);

      if (datos.pagos.length) {
        const historialPagos = elemento('ul', null, 'lista-items-pedido');
        datos.pagos.forEach(registro => historialPagos.append(elemento('li', `${fecha(registro.creado_en)} · ${registro.metodo} · ${dinero(registro.importe_centavos)} · ${ETIQUETAS[registro.estado] || registro.estado}`)));
        detallePedido.append(elemento('h3', 'Pagos registrados'), historialPagos);
      }
    } catch (error) {
      detallePedido.textContent = error.message;
    }
  }

  async function cargarCupones() {
    const formulario = document.querySelector('[data-filtros-cupones]');
    const salida = document.querySelector('[data-estado-cupones]');
    salida.textContent = 'Cargando cupones…';
    try {
      const resultado = await invocar('listar_cupones', {
        ...Object.fromEntries(new FormData(formulario || undefined)), pagina: estado.cupones.pagina, por_pagina: estado.cupones.porPagina,
      });
      estado.cupones.total = resultado.total;
      estado.cupones.cargado = true;
      estado.cupones.filas = new Map(resultado.filas.map(fila => [fila.id, fila]));
      renderizarCupones(resultado.filas);
      salida.textContent = `${resultado.total} cupón${resultado.total === 1 ? '' : 'es'}`;
      actualizarPaginacion('cupones');
    } catch (error) { salida.textContent = error.message; notificar(error.message); }
  }

  function descripcionDescuento(cupon) {
    return cupon.tipo_descuento === 'porcentaje'
      ? `${Number(cupon.porcentaje_puntos_base) / 100}%`
      : dinero(cupon.importe_fijo_centavos);
  }

  function renderizarCupones(filas) {
    const cuerpo = document.querySelector('[data-lista-cupones]');
    cuerpo.replaceChildren();
    if (!filas.length) {
      const fila = document.createElement('tr'); const celda = elemento('td', 'Todavía no hay cupones.'); celda.colSpan = 7; fila.append(celda); cuerpo.append(fila); return;
    }
    filas.forEach((cupon) => {
      const fila = document.createElement('tr');
      [cupon.codigo_normalizado, descripcionDescuento(cupon), cupon.alcance,
        cupon.vence_en ? `Hasta ${fecha(cupon.vence_en)}` : 'Sin vencimiento', String(cupon.usos_confirmados || 0),
        cupon.activo ? 'Activo' : 'Inactivo'].forEach(valor => fila.append(elemento('td', valor)));
      const acciones = elemento('td', null, 'acciones-tabla');
      const editar = boton('Editar'); editar.addEventListener('click', () => abrirCupon(cupon));
      const duplicar = boton('Duplicar'); duplicar.addEventListener('click', () => abrirCupon({ ...cupon, id: '', codigo: `${cupon.codigo_normalizado}-COPIA`, codigo_normalizado: `${cupon.codigo_normalizado}-COPIA` }));
      const alternar = boton(cupon.activo ? 'Desactivar' : 'Activar');
      alternar.addEventListener('click', async () => {
        alternar.disabled = true;
        try { await invocar('alternar_cupon', { id: cupon.id, activo: !cupon.activo }); notificar('Estado del cupón actualizado.'); await cargarCupones(); }
        catch (error) { notificar(error.message); } finally { alternar.disabled = false; }
      });
      acciones.append(editar, duplicar, alternar); fila.append(acciones); cuerpo.append(fila);
    });
  }

  async function asegurarCatalogo() {
    if (!estado.catalogo) estado.catalogo = await invocar('obtener_catalogo_cupones');
    return estado.catalogo;
  }

  function seleccionarValores(selector, valores) {
    const conjunto = new Set(valores || []);
    [...selector.options].forEach(item => { item.selected = conjunto.has(item.value); });
  }

  async function abrirCupon(cupon = null) {
    errorCupon.hidden = true;
    const catalogo = await asegurarCatalogo();
    formularioCupon.reset();
    formularioCupon.elements.activo.checked = cupon?.activo ?? true;
    const categorias = formularioCupon.elements.categorias;
    const categoriaProductos = formularioCupon.elements.categoria_productos;
    categorias.replaceChildren(...catalogo.categorias.map(item => opcion(item.id, `${item.nombre} (${item.tipo_producto})`)));
    categoriaProductos.replaceChildren(
      opcion('', 'Elegí una categoría'),
      ...catalogo.categorias.map(item => opcion(item.id, `${item.nombre} (${item.tipo_producto})`)),
    );
    if (cupon) {
      const valores = {
        id: cupon.id || '', codigo: cupon.codigo_normalizado || cupon.codigo, descripcion_interna: cupon.descripcion_interna,
        tipo_descuento: cupon.tipo_descuento, porcentaje: Number(cupon.porcentaje_puntos_base || 0) / 100,
        importe_fijo: Number(cupon.importe_fijo_centavos || 0) / 100, compra_minima: Number(cupon.compra_minima_centavos || 0) / 100,
        descuento_maximo: Number(cupon.descuento_maximo_centavos || 0) / 100,
        limite_usos_total: cupon.limite_usos_total || '', limite_usos_comprador: cupon.limite_usos_comprador || '',
        inicia_en: fechaFormulario(cupon.inicia_en), vence_en: fechaFormulario(cupon.vence_en), alcance: cupon.alcance,
        aplica_tipo_pedido: cupon.aplica_tipo_pedido,
      };
      Object.entries(valores).forEach(([nombre, valor]) => { if (formularioCupon.elements[nombre]) formularioCupon.elements[nombre].value = valor ?? ''; });
      formularioCupon.elements.activo.checked = cupon.activo;
      seleccionarValores(categorias, cupon.cupon_categorias?.map(item => item.categoria_id));
      const productosElegidos = cupon.cupon_productos?.map(item => item.producto_id) || [];
      const primerProducto = catalogo.productos.find(item => productosElegidos.includes(item.id));
      categoriaProductos.value = primerProducto?.categoria_id || '';
      actualizarProductosPorCategoria(productosElegidos);
    } else {
      actualizarProductosPorCategoria();
    }
    actualizarCamposCupon();
    document.querySelector('#titulo-dialogo-cupon').textContent = cupon?.id ? `Editar ${cupon.codigo_normalizado}` : 'Nuevo cupón';
    dialogoCupon.showModal();
  }

  function actualizarProductosPorCategoria(seleccionados = []) {
    const categoriaId = formularioCupon.elements.categoria_productos.value;
    const productos = formularioCupon.elements.productos;
    const disponibles = (estado.catalogo?.productos || []).filter(item => item.categoria_id === categoriaId);
    productos.replaceChildren(...disponibles.map(item => opcion(
      item.id,
      `${item.nombre}${item.sku ? ` · ${item.sku}` : ''}`,
      seleccionados.includes(item.id),
    )));
    if (categoriaId && !disponibles.length) productos.append(opcion('', 'No hay productos en esta categoría'));
  }

  function actualizarCamposCupon() {
    const esPorcentaje = formularioCupon.elements.tipo_descuento.value === 'porcentaje';
    formularioCupon.elements.porcentaje.disabled = !esPorcentaje;
    formularioCupon.elements.porcentaje.required = esPorcentaje;
    formularioCupon.elements.importe_fijo.disabled = esPorcentaje;
    formularioCupon.elements.importe_fijo.required = !esPorcentaje;
    formularioCupon.elements.descuento_maximo.disabled = !esPorcentaje;
    const alcance = formularioCupon.elements.alcance.value;
    const porCategorias = alcance === 'categorias';
    const porProductos = alcance === 'productos';
    document.querySelector('[data-campo-categorias]').hidden = !porCategorias;
    document.querySelector('[data-campo-categoria-productos]').hidden = !porProductos;
    document.querySelector('[data-campo-productos]').hidden = !porProductos;
    formularioCupon.elements.categorias.disabled = !porCategorias;
    formularioCupon.elements.categoria_productos.disabled = !porProductos;
    formularioCupon.elements.categoria_productos.required = porProductos;
    formularioCupon.elements.productos.disabled = !porProductos;
  }

  function valoresSeleccionados(selector) {
    return [...selector.selectedOptions].map(item => item.value);
  }

  function actualizarPaginacion(recurso) {
    const datos = estado[recurso];
    const paginas = Math.max(1, Math.ceil(datos.total / datos.porPagina));
    document.querySelector(`[data-${recurso}-pagina]`).textContent = `Página ${datos.pagina} de ${paginas}`;
    document.querySelector(`[data-${recurso}-anterior]`).disabled = datos.pagina <= 1;
    document.querySelector(`[data-${recurso}-siguiente]`).disabled = datos.pagina >= paginas;
  }

  document.querySelector('[data-filtros-pedidos]')?.addEventListener('submit', (evento) => { evento.preventDefault(); estado.pedidos.pagina = 1; cargarPedidos(); });
  document.querySelector('[data-recargar-pedidos]')?.addEventListener('click', cargarPedidos);
  document.querySelector('[data-filtros-cupones]')?.addEventListener('submit', (evento) => { evento.preventDefault(); estado.cupones.pagina = 1; cargarCupones(); });
  document.querySelector('[data-nuevo-cupon]')?.addEventListener('click', () => abrirCupon().catch(error => notificar(error.message)));
  document.querySelectorAll('[data-cerrar-pedido]').forEach(item => item.addEventListener('click', () => dialogoPedido.close()));
  document.querySelectorAll('[data-cerrar-cupon]').forEach(item => item.addEventListener('click', () => dialogoCupon.close()));
  formularioCupon?.elements.tipo_descuento.addEventListener('change', actualizarCamposCupon);
  formularioCupon?.elements.alcance.addEventListener('change', actualizarCamposCupon);
  formularioCupon?.elements.categoria_productos.addEventListener('change', () => actualizarProductosPorCategoria());
  formularioCupon?.elements.codigo.addEventListener('input', (evento) => {
    evento.currentTarget.value = evento.currentTarget.value.toUpperCase();
  });
  ['pedidos', 'cupones'].forEach(recurso => {
    document.querySelector(`[data-${recurso}-anterior]`)?.addEventListener('click', () => { if (estado[recurso].pagina > 1) { estado[recurso].pagina -= 1; recurso === 'pedidos' ? cargarPedidos() : cargarCupones(); } });
    document.querySelector(`[data-${recurso}-siguiente]`)?.addEventListener('click', () => { estado[recurso].pagina += 1; recurso === 'pedidos' ? cargarPedidos() : cargarCupones(); });
  });

  formularioCupon?.addEventListener('submit', async (evento) => {
    evento.preventDefault(); errorCupon.hidden = true;
    const campos = formularioCupon.elements;
    const porcentaje = Number(campos.porcentaje.value || 0);
    const importeFijo = centavos(campos.importe_fijo.value);
    const compraMinima = centavos(campos.compra_minima.value);
    const categorias = campos.alcance.value === 'categorias' ? valoresSeleccionados(campos.categorias) : [];
    const productos = campos.alcance.value === 'productos' ? valoresSeleccionados(campos.productos) : [];
    let mensajeValidacion = '';
    if (campos.tipo_descuento.value === 'porcentaje' && (porcentaje <= 0 || porcentaje > 100)) mensajeValidacion = 'El porcentaje debe ser mayor que 0 y no puede superar 100.';
    if (campos.tipo_descuento.value === 'fijo' && importeFijo <= 0) mensajeValidacion = 'Ingresá un importe de descuento mayor que 0.';
    if (campos.tipo_descuento.value === 'fijo' && compraMinima < importeFijo) mensajeValidacion = 'La compra mínima debe ser igual o mayor que el importe del descuento.';
    if (campos.alcance.value === 'categorias' && !categorias.length) mensajeValidacion = 'Elegí al menos una categoría.';
    if (campos.alcance.value === 'productos' && !campos.categoria_productos.value) mensajeValidacion = 'Elegí primero una categoría de productos.';
    if (campos.alcance.value === 'productos' && !productos.length) mensajeValidacion = 'Elegí al menos un producto.';
    if (mensajeValidacion) {
      errorCupon.textContent = mensajeValidacion;
      errorCupon.hidden = false;
      return;
    }
    const botonGuardar = formularioCupon.querySelector('button[type="submit"]'); botonGuardar.disabled = true;
    const datos = {
      codigo: campos.codigo.value.trim().toUpperCase(), descripcion_interna: campos.descripcion_interna.value.trim(), activo: campos.activo.checked,
      tipo_descuento: campos.tipo_descuento.value, porcentaje_puntos_base: Math.round(porcentaje * 100),
      importe_fijo_centavos: importeFijo, compra_minima_centavos: compraMinima,
      descuento_maximo_centavos: campos.descuento_maximo.value ? centavos(campos.descuento_maximo.value) : null,
      limite_usos_total: campos.limite_usos_total.value || null, limite_usos_comprador: campos.limite_usos_comprador.value || null,
      inicia_en: campos.inicia_en.value || null, vence_en: campos.vence_en.value || null, alcance: campos.alcance.value,
      aplica_tipo_pedido: campos.aplica_tipo_pedido.value,
    };
    try {
      await invocar('guardar_cupon', {
        id: campos.id.value || null, datos, categorias, productos, excluidos: [],
      });
      dialogoCupon.close(); notificar('Cupón guardado.'); await cargarCupones();
    } catch (error) { errorCupon.textContent = error.message; errorCupon.hidden = false; } finally { botonGuardar.disabled = false; }
  });

  return {
    async cargar(recurso) {
      if (recurso === 'pedidos') await cargarPedidos();
      if (recurso === 'cupones') await cargarCupones();
    },
  };
}

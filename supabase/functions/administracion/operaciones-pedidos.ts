const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPOS_PEDIDO = [
  'id', 'numero', 'tipo', 'moneda', 'cliente_nombre', 'cliente_correo', 'cliente_whatsapp',
  'requiere_envio', 'envio_definido', 'direccion_entrega', 'subtotal_centavos',
  'descuento_centavos', 'envio_centavos', 'total_centavos', 'anticipo_objetivo_centavos',
  'estado_comercial', 'estado_preparacion', 'estado_entrega', 'estado_financiero',
  'observaciones_cliente', 'notas_internas', 'incidencia_codigo', 'creado_en', 'actualizado_en',
].join(',');

type ClienteServicio = {
  from: (tabla: string) => any;
  rpc: (funcion: string, parametros: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

type Contexto = {
  accion: string;
  cuerpo: Record<string, any>;
  cliente: ClienteServicio;
  usuarioId: string;
  urlSitio: string;
};

function texto(valor: unknown, maximo: number) {
  return String(valor ?? '').trim().slice(0, maximo);
}

function uuid(valor: unknown, etiqueta = 'El identificador') {
  const limpio = texto(valor, 40);
  if (!UUID.test(limpio)) throw new Error(`${etiqueta} no es válido.`);
  return limpio;
}

function entero(valor: unknown, minimo: number, maximo: number, predeterminado: number) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? Math.min(maximo, Math.max(minimo, numero)) : predeterminado;
}

function fechaIso(valor: unknown) {
  const limpio = texto(valor, 40);
  if (!limpio) return null;
  const fecha = new Date(limpio);
  if (Number.isNaN(fecha.getTime())) throw new Error('La fecha ingresada no es válida.');
  return fecha.toISOString();
}

function listaUuid(valor: unknown) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.map(item => uuid(item)))].slice(0, 500);
}

function sinError<T>({ data, error }: { data: T; error: any }) {
  if (error) throw error;
  return data;
}

async function listarPedidos(cuerpo: Record<string, any>, cliente: ClienteServicio) {
  const pagina = entero(cuerpo.pagina, 1, 100000, 1);
  const porPagina = entero(cuerpo.por_pagina, 10, 50, 25);
  const desde = (pagina - 1) * porPagina;
  let consulta = cliente.from('pedidos').select(CAMPOS_PEDIDO, { count: 'exact' });

  const filtros: Array<[string, string[]]> = [
    ['tipo', ['automatico', 'coordinado']],
    ['estado_financiero', ['sin_cobro', 'pendiente', 'parcial', 'pagado', 'reembolsado_parcial', 'reembolsado_total']],
    ['estado_preparacion', ['no_iniciada', 'espera_anticipo', 'en_diseno', 'espera_aprobacion', 'en_preparacion', 'listo']],
    ['estado_entrega', ['sin_definir', 'pendiente', 'listo_retiro', 'retirado', 'enviado', 'entregado']],
  ];
  for (const [campo, permitidos] of filtros) {
    const valor = texto(cuerpo[campo], 40);
    if (valor && permitidos.includes(valor)) consulta = consulta.eq(campo, valor);
  }
  const desdeFecha = fechaIso(cuerpo.desde);
  const hastaFecha = fechaIso(cuerpo.hasta);
  if (desdeFecha) consulta = consulta.gte('creado_en', desdeFecha);
  if (hastaFecha) consulta = consulta.lte('creado_en', hastaFecha);

  const busqueda = texto(cuerpo.busqueda, 120).replace(/[%_,()]/g, ' ');
  if (busqueda) {
    if (/^\d{1,18}$/.test(busqueda)) consulta = consulta.eq('numero', Number(busqueda));
    else if (busqueda.includes('@')) consulta = consulta.ilike('cliente_correo', `%${busqueda}%`);
    else if (/^[+\d\s()-]{6,30}$/.test(busqueda)) {
      const telefono = busqueda.replace(/[^+\d]/g, '');
      consulta = consulta.ilike('cliente_whatsapp', `%${telefono}%`);
    } else consulta = consulta.ilike('cliente_nombre', `%${busqueda}%`);
  }

  const { data, count, error } = await consulta
    .order('creado_en', { ascending: false })
    .range(desde, desde + porPagina - 1);
  if (error) throw error;
  return { filas: data || [], total: count || 0, pagina, por_pagina: porPagina };
}

async function obtenerPedido(cuerpo: Record<string, any>, cliente: ClienteServicio) {
  const pedidoId = uuid(cuerpo.id, 'El pedido');
  const [pedido, items, pagos, reservas, historial] = await Promise.all([
    cliente.from('pedidos').select(CAMPOS_PEDIDO).eq('id', pedidoId).single(),
    cliente.from('pedido_items').select('id,producto_id,variante_id,producto_nombre,variante_nombre,sku,descripcion,precio_unitario_centavos,cantidad,subtotal_centavos,opciones_personalizadas,compra_automatica,requiere_personalizacion').eq('pedido_id', pedidoId).order('creado_en'),
    cliente.from('pagos').select('id,metodo,tipo,estado,importe_centavos,referencia,nota,aprobado_en,creado_en,transferencias_pago(comprobante_referencia,recibido_en)').eq('pedido_id', pedidoId).order('creado_en'),
    cliente.from('reservas_stock').select('id,cantidad,estado,vence_en,consumida_en,liberada_en,producto_id,variante_id').eq('pedido_id', pedidoId).order('creado_en'),
    cliente.from('historial_pedidos').select('id,evento,actor,estado_anterior,estado_nuevo,nota,creado_en').eq('pedido_id', pedidoId).order('creado_en', { ascending: false }).limit(100),
  ]);
  const [cupon, reembolsos] = await Promise.all([
    cliente.from('pedido_cupones').select('codigo_snapshot,regla_snapshot,descuento_centavos,confirmado,confirmado_en').eq('pedido_id', pedidoId).maybeSingle(),
    cliente.from('reembolsos').select('id,estado,importe_centavos,motivo,creado_en,procesado_en').eq('pedido_id', pedidoId).order('creado_en'),
  ]);
  return {
    pedido: sinError(pedido),
    items: sinError(items) || [],
    pagos: sinError(pagos) || [],
    reservas: sinError(reservas) || [],
    historial: sinError(historial) || [],
    cupon: sinError(cupon),
    reembolsos: sinError(reembolsos) || [],
  };
}

async function actualizarEstado(cuerpo: Record<string, any>, cliente: ClienteServicio, usuarioId: string) {
  const campos = ['estado_comercial', 'estado_preparacion', 'estado_entrega'];
  const campo = texto(cuerpo.campo, 40);
  if (!campos.includes(campo)) throw new Error('El estado solicitado no se puede editar.');
  return sinError(await cliente.rpc('actualizar_estado_pedido_administracion', {
    p_pedido_id: uuid(cuerpo.id, 'El pedido'),
    p_campo: campo,
    p_valor: texto(cuerpo.valor, 40),
    p_usuario: usuarioId,
    p_nota: texto(cuerpo.nota, 1000) || null,
  }));
}

async function aprobarTransferencia(cuerpo: Record<string, any>, cliente: ClienteServicio, usuarioId: string) {
  const importe = Number(cuerpo.importe_centavos);
  if (!Number.isSafeInteger(importe) || importe <= 0 || importe > 999_999_999_00) {
    throw new Error('El importe del pago no es válido.');
  }
  const tipo = texto(cuerpo.tipo_pago, 20);
  if (!['total', 'anticipo', 'saldo'].includes(tipo)) throw new Error('Elegí el tipo de pago aprobado.');
  return sinError(await cliente.rpc('marcar_transferencia_pago_aprobado', {
    p_pedido_id: uuid(cuerpo.id, 'El pedido'),
    p_importe_centavos: importe,
    p_tipo: tipo,
    p_usuario: usuarioId,
    p_referencia: texto(cuerpo.referencia, 300) || null,
    p_nota: texto(cuerpo.nota, 1000) || null,
    p_clave_idempotencia: `transferencia-admin:${crypto.randomUUID()}`,
  }));
}

function bytesHex(bytes: Uint8Array) {
  return `\\x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function base64Url(bytes: Uint8Array) {
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function crearEnlaceSeguimiento(cuerpo: Record<string, any>, cliente: ClienteServicio, usuarioId: string, urlSitio: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = base64Url(bytes);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const dias = entero(cuerpo.dias, 1, 365, 90);
  sinError(await cliente.rpc('rotar_token_consulta_pedido_administracion', {
    p_pedido_id: uuid(cuerpo.id, 'El pedido'), p_token_hash: bytesHex(hash), p_usuario: usuarioId, p_dias: dias,
  }));
  return { url: `${urlSitio.replace(/\/$/, '')}/seguimiento?token=${encodeURIComponent(token)}`, vence_en_dias: dias };
}

async function listarCupones(cuerpo: Record<string, any>, cliente: ClienteServicio) {
  const pagina = entero(cuerpo.pagina, 1, 100000, 1);
  const porPagina = entero(cuerpo.por_pagina, 10, 50, 25);
  const desde = (pagina - 1) * porPagina;
  let consulta = cliente.from('cupones').select([
    'id', 'codigo', 'codigo_normalizado', 'descripcion_interna', 'activo', 'inicia_en', 'vence_en',
    'tipo_descuento', 'porcentaje_puntos_base', 'importe_fijo_centavos', 'compra_minima_centavos',
    'descuento_maximo_centavos', 'limite_usos_total', 'limite_usos_comprador', 'alcance',
    'aplica_tipo_pedido', 'creado_en', 'actualizado_en',
    'cupon_categorias(categoria_id)', 'cupon_productos(producto_id)', 'cupon_productos_excluidos(producto_id)',
  ].join(','), { count: 'exact' });
  const busqueda = texto(cuerpo.busqueda, 80).replace(/[%_,()]/g, ' ');
  if (busqueda) consulta = consulta.ilike('codigo_normalizado', `%${busqueda.toUpperCase()}%`);
  const estado = texto(cuerpo.estado, 20);
  if (estado === 'activos') consulta = consulta.eq('activo', true);
  if (estado === 'inactivos') consulta = consulta.eq('activo', false);
  const { data, count, error } = await consulta.order('creado_en', { ascending: false }).range(desde, desde + porPagina - 1);
  if (error) throw error;
  const filas = data || [];
  const ids = filas.map((fila: any) => fila.id);
  if (!ids.length) return { filas, total: count || 0, pagina, por_pagina: porPagina };
  const [usos, reservas] = await Promise.all([
    cliente.from('cupon_usos').select('cupon_id,descuento_centavos').in('cupon_id', ids),
    cliente.from('cupon_reservas').select('cupon_id,estado').in('cupon_id', ids).eq('estado', 'reservada'),
  ]);
  const datosUsos = sinError(usos) || [];
  const datosReservas = sinError(reservas) || [];
  for (const fila of filas) {
    const usados = datosUsos.filter((uso: any) => uso.cupon_id === fila.id);
    fila.usos_confirmados = usados.length;
    fila.descuento_otorgado_centavos = usados.reduce((suma: number, uso: any) => suma + Number(uso.descuento_centavos || 0), 0);
    fila.reservas_activas = datosReservas.filter((reserva: any) => reserva.cupon_id === fila.id).length;
  }
  return { filas, total: count || 0, pagina, por_pagina: porPagina };
}

async function obtenerCatalogoCupones(cliente: ClienteServicio) {
  const [categorias, productos] = await Promise.all([
    cliente.from('categorias').select('id,nombre,tipo_producto').neq('publicada', false).order('nombre').limit(500),
    cliente.from('productos').select('id,nombre,sku,categoria_id,tipo_producto,estado').neq('estado', 'archivado').order('nombre').limit(1500),
  ]);
  return { categorias: sinError(categorias) || [], productos: sinError(productos) || [] };
}

async function guardarCupon(cuerpo: Record<string, any>, cliente: ClienteServicio, usuarioId: string) {
  const datosEntrada = cuerpo.datos && typeof cuerpo.datos === 'object' ? cuerpo.datos : {};
  const tipo = texto(datosEntrada.tipo_descuento, 20);
  if (!['porcentaje', 'fijo'].includes(tipo)) throw new Error('Elegí el tipo de descuento.');
  const alcance = texto(datosEntrada.alcance, 20) || 'todos';
  if (!['todos', 'categorias', 'productos'].includes(alcance)) throw new Error('Elegí el alcance del cupón.');
  const aplica = texto(datosEntrada.aplica_tipo_pedido, 20) || 'automatico';
  if (!['automatico', 'coordinado', 'ambos'].includes(aplica)) throw new Error('Elegí a qué pedidos aplica el cupón.');
  const datos = {
    codigo: texto(datosEntrada.codigo, 40).toUpperCase(), descripcion_interna: texto(datosEntrada.descripcion_interna, 500),
    activo: datosEntrada.activo !== false, inicia_en: fechaIso(datosEntrada.inicia_en), vence_en: fechaIso(datosEntrada.vence_en),
    tipo_descuento: tipo,
    porcentaje_puntos_base: tipo === 'porcentaje' ? entero(datosEntrada.porcentaje_puntos_base, 1, 10000, 0) : null,
    importe_fijo_centavos: tipo === 'fijo' ? entero(datosEntrada.importe_fijo_centavos, 1, 999_999_999_00, 0) : null,
    compra_minima_centavos: entero(datosEntrada.compra_minima_centavos, 0, 999_999_999_00, 0),
    descuento_maximo_centavos: tipo === 'porcentaje' && datosEntrada.descuento_maximo_centavos
      ? entero(datosEntrada.descuento_maximo_centavos, 1, 999_999_999_00, 0) : null,
    limite_usos_total: datosEntrada.limite_usos_total ? entero(datosEntrada.limite_usos_total, 1, 1_000_000, 0) : null,
    limite_usos_comprador: datosEntrada.limite_usos_comprador ? entero(datosEntrada.limite_usos_comprador, 1, 1000, 0) : null,
    alcance, aplica_tipo_pedido: aplica,
  };
  if (!/^[A-Z0-9_-]{3,40}$/.test(datos.codigo)) throw new Error('El código debe usar letras, números, guion o guion bajo.');
  if (tipo === 'fijo' && datos.compra_minima_centavos < Number(datos.importe_fijo_centavos)) {
    throw new Error('La compra mínima debe ser igual o mayor que el importe del descuento.');
  }
  const categorias = listaUuid(cuerpo.categorias);
  const productos = listaUuid(cuerpo.productos);
  const excluidos: string[] = [];
  if (alcance === 'categorias' && !categorias.length) throw new Error('Elegí al menos una categoría para el cupón.');
  if (alcance === 'productos' && !productos.length) throw new Error('Elegí al menos un producto para el cupón.');
  return sinError(await cliente.rpc('guardar_cupon_administracion', {
    p_id: cuerpo.id ? uuid(cuerpo.id, 'El cupón') : null,
    p_datos: datos, p_categorias: categorias, p_productos: productos, p_excluidos: excluidos, p_usuario: usuarioId,
  }));
}

async function alternarCupon(cuerpo: Record<string, any>, cliente: ClienteServicio, usuarioId: string) {
  return sinError(await cliente.rpc('alternar_cupon_administracion', {
    p_cupon_id: uuid(cuerpo.id, 'El cupón'), p_activo: Boolean(cuerpo.activo), p_usuario: usuarioId,
  }));
}

export async function gestionarAccionComercial(contexto: Contexto) {
  const { accion, cuerpo, cliente, usuarioId, urlSitio } = contexto;
  const acciones: Record<string, () => Promise<any>> = {
    listar_pedidos: () => listarPedidos(cuerpo, cliente),
    obtener_pedido: () => obtenerPedido(cuerpo, cliente),
    actualizar_estado_pedido: () => actualizarEstado(cuerpo, cliente, usuarioId),
    aprobar_transferencia: () => aprobarTransferencia(cuerpo, cliente, usuarioId),
    crear_enlace_seguimiento: () => crearEnlaceSeguimiento(cuerpo, cliente, usuarioId, urlSitio),
    listar_cupones: () => listarCupones(cuerpo, cliente),
    obtener_catalogo_cupones: () => obtenerCatalogoCupones(cliente),
    guardar_cupon: () => guardarCupon(cuerpo, cliente, usuarioId),
    alternar_cupon: () => alternarCupon(cuerpo, cliente, usuarioId),
  };
  if (!acciones[accion]) return null;
  return { manejada: true, datos: await acciones[accion]() };
}

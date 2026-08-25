import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') || '';
const CLAVE_SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const URL_SITIO = Deno.env.get('URL_SITIO') || 'https://papeleria-de-sol.netlify.app';

const clienteServicio = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RECURSOS = {
  productos: {
    tabla: 'productos',
    seleccion: '*, categoria:categorias(id,nombre), imagenes(*)',
    campos: [
      'categoria_id', 'tipo_producto', 'nombre', 'sku',
      'descripcion', 'precio', 'moneda', 'controla_stock', 'stock', 'estado',
      'destacado', 'mensaje_whatsapp', 'meta_titulo', 'meta_descripcion',
    ],
  },
  categorias: {
    tabla: 'categorias',
    seleccion: '*',
    campos: ['nombre', 'slug', 'descripcion', 'tipo_producto', 'imagen_url', 'publicada', 'orden'],
  },
  secciones: {
    tabla: 'secciones',
    seleccion: '*',
    campos: [
      'clave', 'titulo', 'subtitulo', 'contenido', 'imagen_url', 'texto_boton',
      'enlace_boton', 'publicada', 'orden', 'meta_titulo', 'meta_descripcion', 'estilos',
    ],
  },
  variantes: {
    tabla: 'variantes',
    seleccion: '*',
    campos: ['producto_id', 'nombre', 'sku', 'precio', 'stock', 'estado', 'orden'],
  },
} as const;

type NombreRecurso = keyof typeof RECURSOS;

const CAMPOS_ESTILO_SECCION = ['titulo', 'subtitulo', 'contenido', 'texto_boton'];
const FUENTES_PERMITIDAS = ['moderna', 'redondeada', 'clasica'];
const TAMANOS_PERMITIDOS = ['pequeno', 'normal', 'mediano', 'grande', 'extra_grande'];
const COLORES_CONFIGURABLES = [
  'color_principal', 'color_secundario', 'color_principal_intenso', 'color_secundario_intenso',
  'color_fondo', 'color_texto', 'color_texto_suave',
];
const CLAVES_TEXTO_PUBLICO = [
  'navegacion_inicio', 'navegacion_catalogo', 'navegacion_plantillas',
  'navegacion_productos_fisicos', 'navegacion_ayuda', 'carrito_boton',
  'footer_catalogo', 'footer_plantillas', 'footer_productos_fisicos', 'footer_ayuda',
  'pie_derechos_reservados', 'inicio_texto_destacado',
  'catalogo_etiqueta', 'catalogo_titulo', 'catalogo_descripcion',
  'catalogo_busqueda_placeholder', 'catalogo_todas_categorias',
  'catalogo_aviso_disponibilidad', 'catalogo_pagina_anterior', 'catalogo_pagina_siguiente',
  'plantillas_etiqueta', 'plantillas_titulo', 'plantillas_descripcion',
  'plantillas_vacio_etiqueta', 'plantillas_vacio_titulo',
  'plantillas_vacio_descripcion', 'plantillas_vacio_boton',
  'fisicos_etiqueta', 'fisicos_titulo', 'fisicos_descripcion',
  'fisicos_vacio_etiqueta', 'fisicos_vacio_titulo',
  'fisicos_vacio_descripcion', 'fisicos_vacio_boton',
  'producto_destacado', 'producto_tipo_fisico', 'producto_agregar',
  'producto_agregar_seleccion', 'producto_sku', 'producto_categoria',
  'producto_disponibilidad', 'producto_en_stock', 'producto_consultar',
  'producto_aviso_whatsapp',
  'carrito_etiqueta', 'carrito_titulo', 'carrito_vacio', 'carrito_explorar_catalogo',
  'carrito_productos_seleccionados', 'carrito_total', 'carrito_continuar_whatsapp',
  'carrito_vaciar', 'carrito_aclaracion', 'carrito_cantidad', 'carrito_agregado',
  'mensaje_whatsapp_inicio', 'mensaje_whatsapp_total_productos',
  'mensaje_whatsapp_total', 'mensaje_whatsapp_cierre',
  'ayuda_etiqueta', 'ayuda_titulo', 'ayuda_descripcion',
  'ayuda_paso_1_titulo', 'ayuda_paso_1_descripcion',
  'ayuda_paso_2_titulo', 'ayuda_paso_2_descripcion',
  'ayuda_paso_3_titulo', 'ayuda_paso_3_descripcion',
  'ayuda_consultas_titulo', 'ayuda_consultas_descripcion', 'ayuda_consultas_boton',
];
const PREFIJOS_SKU: Record<string, string> = {
  sticker: 'ST',
  plantilla: 'PL',
  fisico: 'PF',
};

function cabecerasCors(solicitud: Request) {
  const origen = solicitud.headers.get('origin') || '';
  const origenPermitido =
    origen === URL_SITIO ||
    origen === 'http://localhost:4321' ||
    origen === 'http://127.0.0.1:4321';

  return {
    'Access-Control-Allow-Origin': origenPermitido ? origen : URL_SITIO,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function responder(solicitud: Request, cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: cabecerasCors(solicitud),
  });
}

function convertirBase64Url(valor: string) {
  const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
}

function obtenerIdentificadorSesion(token: string) {
  try {
    const contenido = JSON.parse(convertirBase64Url(token.split('.')[1]));
    return contenido.session_id as string | undefined;
  } catch {
    return undefined;
  }
}

function crearSlug(texto: unknown) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function obtenerPrefijoSku(tipoProducto: unknown) {
  const prefijo = PREFIJOS_SKU[String(tipoProducto)];
  if (!prefijo) throw new Error('El tipo de producto no es válido.');
  return prefijo;
}

function seleccionarCampos(datos: Record<string, unknown>, campos: readonly string[]) {
  return Object.fromEntries(
    campos
      .filter((campo) => Object.prototype.hasOwnProperty.call(datos, campo))
      .map((campo) => [campo, datos[campo]]),
  );
}

function esColorHexadecimal(valor: unknown) {
  return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor);
}

function normalizarEstilosSeccion(valor: unknown) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw new Error('Los estilos de la sección no tienen un formato válido.');
  }

  const estilos = valor as Record<string, Record<string, unknown>>;
  return Object.fromEntries(CAMPOS_ESTILO_SECCION.map((campo) => {
    const estilo = estilos[campo] || {};
    const color = esColorHexadecimal(estilo.color) ? estilo.color : '#252434';
    const fuente = FUENTES_PERMITIDAS.includes(String(estilo.fuente)) ? estilo.fuente : 'moderna';
    const tamano = TAMANOS_PERMITIDOS.includes(String(estilo.tamano)) ? estilo.tamano : 'normal';

    return [campo, {
      color,
      fuente,
      tamano,
      negrita: Boolean(estilo.negrita),
      cursiva: Boolean(estilo.cursiva),
    }];
  }));
}

function validarDatos(recurso: NombreRecurso, datos: Record<string, unknown>) {
  if ('nombre' in datos && !String(datos.nombre || '').trim()) {
    throw new Error('El nombre es obligatorio.');
  }

  if (recurso === 'productos') {
    if (!String(datos.nombre || '').trim()) {
      throw new Error('El nombre del producto es obligatorio.');
    }
    if (!['sticker', 'plantilla', 'fisico'].includes(String(datos.tipo_producto))) {
      throw new Error('El tipo de producto no es válido.');
    }
    const prefijoSku = obtenerPrefijoSku(datos.tipo_producto);
    const sku = String(datos.sku || '').trim().toUpperCase();
    if (!sku) throw new Error('El SKU es obligatorio.');
    if (!new RegExp(`^${prefijoSku}-\\d+$`).test(sku)) {
      throw new Error(`El SKU para este tipo debe comenzar con ${prefijoSku}- y terminar con números.`);
    }
    if (
      datos.precio === null ||
      datos.precio === undefined ||
      datos.precio === '' ||
      !Number.isFinite(Number(datos.precio)) ||
      Number(datos.precio) < 0
    ) {
      throw new Error('El precio en pesos es obligatorio y no puede ser negativo.');
    }
    if (!String(datos.descripcion || '').trim()) {
      throw new Error('La descripción del producto es obligatoria.');
    }
    if (
      datos.controla_stock &&
      (!Number.isFinite(Number(datos.stock)) || Number(datos.stock) < 0)
    ) {
      throw new Error('El stock es obligatorio al activar el control de stock y no puede ser negativo.');
    }
    if (!['borrador', 'publicado'].includes(String(datos.estado))) {
      throw new Error('Elegí si el producto está publicado o no publicado.');
    }
  }

  if (recurso === 'categorias') {
    if (!['sticker', 'plantilla', 'fisico'].includes(String(datos.tipo_producto))) {
      throw new Error('Elegí el tipo de producto de esta categoría.');
    }
  }

  if (recurso === 'secciones') {
    if (!String(datos.titulo || '').trim()) throw new Error('El título de la sección es obligatorio.');
    if (Object.prototype.hasOwnProperty.call(datos, 'estilos')) normalizarEstilosSeccion(datos.estilos);
  }
}

async function obtenerSugerenciaSku(tipoProducto: unknown) {
  const tipo = String(tipoProducto);
  const prefijo = obtenerPrefijoSku(tipo);
  const { data, error } = await clienteServicio
    .from('productos')
    .select('sku')
    .eq('tipo_producto', tipo)
    .not('sku', 'is', null);
  if (error) throw error;

  const expresion = new RegExp(`^${prefijo}-(\\d+)$`, 'i');
  let numeroMayor = 0;
  let digitosSku = 4;
  let ultimoSku: string | null = null;

  (data || []).forEach(({ sku }) => {
    const coincidencia = expresion.exec(String(sku || '').trim());
    if (!coincidencia) return;
    const numero = Number(coincidencia[1]);
    if (numero > numeroMayor) {
      numeroMayor = numero;
      digitosSku = Math.max(4, coincidencia[1].length);
      ultimoSku = `${prefijo}-${String(numero).padStart(digitosSku, '0')}`;
    }
  });

  const digitos = Math.max(digitosSku, String(numeroMayor + 1).length);
  return {
    tipo_producto: tipo,
    ultimo_sku: ultimoSku,
    siguiente_sku: `${prefijo}-${String(numeroMayor + 1).padStart(digitos, '0')}`,
  };
}

async function crearSlugDisponible(tabla: string, texto: unknown, id?: string) {
  const base = crearSlug(texto) || 'elemento';

  for (let numero = 1; numero <= 1000; numero += 1) {
    const candidato = numero === 1 ? base : `${base}-${numero}`;
    const { data, error } = await clienteServicio
      .from(tabla)
      .select('id')
      .eq('slug', candidato)
      .maybeSingle();

    if (error) throw error;
    if (!data || data.id === id) return candidato;
  }

  throw new Error('No se pudo generar una dirección interna única.');
}

async function validarCategoriaDeProducto(categoriaId: unknown, tipoProducto: unknown) {
  if (!categoriaId) return;

  const { data, error } = await clienteServicio
    .from('categorias')
    .select('tipo_producto')
    .eq('id', String(categoriaId))
    .maybeSingle();

  if (error || !data) throw new Error('La categoría seleccionada no existe.');
  if (data.tipo_producto !== tipoProducto) {
    throw new Error('La categoría seleccionada no corresponde al tipo de producto.');
  }
}

async function siguienteOrdenProducto() {
  const { data, error } = await clienteServicio
    .from('productos')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1);

  if (error) throw error;
  return Number(data?.[0]?.orden || 0) + 1;
}

async function registrarAuditoria(
  usuarioId: string,
  accion: string,
  recurso: string,
  recursoId?: string,
  datos?: unknown,
) {
  await clienteServicio.from('registros_auditoria').insert({
    usuario_id: usuarioId,
    accion,
    recurso,
    recurso_id: recursoId,
    datos,
  });
}

async function verificarAdministrador(usuarioId: string) {
  const { data, error } = await clienteServicio
    .from('perfiles_administradores')
    .select('usuario_id, nombre, activo')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) {
    throw new Error('La cuenta no tiene permisos de administración.');
  }

  return data;
}

async function minutosInactividadPermitidos() {
  const { data } = await clienteServicio
    .from('configuraciones_sitio')
    .select('valor')
    .eq('clave', 'inactividad_administrador_minutos')
    .maybeSingle();

  return Math.min(120, Math.max(5, Number(data?.valor || 30)));
}

async function iniciarSesionAdministrativa(
  solicitud: Request,
  usuarioId: string,
  sesionId: string,
) {
  const direccion = solicitud.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const agente = solicitud.headers.get('user-agent') || null;

  const { data: existente } = await clienteServicio
    .from('sesiones_administrativas')
    .select('ultima_actividad_en, cerrada_en')
    .eq('id_sesion', sesionId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (existente) {
    const minutos = await minutosInactividadPermitidos();
    const vencida =
      existente.cerrada_en ||
      new Date(existente.ultima_actividad_en).getTime() < Date.now() - minutos * 60_000;

    if (vencida) {
      throw new Error('La sesión expiró por inactividad. Volvé a iniciar sesión.');
    }

    const { error } = await clienteServicio
      .from('sesiones_administrativas')
      .update({
        ultima_actividad_en: new Date().toISOString(),
        direccion_ip: direccion,
        agente_usuario: agente,
      })
      .eq('id_sesion', sesionId);
    if (error) throw error;
    return;
  }

  const { error } = await clienteServicio.from('sesiones_administrativas').insert({
    id_sesion: sesionId,
    usuario_id: usuarioId,
    ultima_actividad_en: new Date().toISOString(),
    direccion_ip: direccion,
    agente_usuario: agente,
  });

  if (error) throw error;
}

async function validarActividad(usuarioId: string, sesionId: string) {
  const { data, error } = await clienteServicio
    .from('sesiones_administrativas')
    .select('ultima_actividad_en, cerrada_en')
    .eq('id_sesion', sesionId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error || !data || data.cerrada_en) {
    throw new Error('La sesión administrativa no está activa.');
  }

  const minutos = await minutosInactividadPermitidos();
  const limite = Date.now() - minutos * 60_000;
  if (new Date(data.ultima_actividad_en).getTime() < limite) {
    await clienteServicio
      .from('sesiones_administrativas')
      .update({ cerrada_en: new Date().toISOString() })
      .eq('id_sesion', sesionId);
    throw new Error('La sesión expiró por inactividad. Volvé a iniciar sesión.');
  }

  await clienteServicio
    .from('sesiones_administrativas')
    .update({ ultima_actividad_en: new Date().toISOString() })
    .eq('id_sesion', sesionId);
}

async function obtenerResumen() {
  const [productos, publicados, categorias, secciones] = await Promise.all([
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).neq('estado', 'archivado'),
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).eq('estado', 'publicado'),
    clienteServicio.from('categorias').select('*', { count: 'exact', head: true }),
    clienteServicio.from('secciones').select('*', { count: 'exact', head: true }),
  ]);

  return {
    productos: productos.count || 0,
    publicados: publicados.count || 0,
    categorias: categorias.count || 0,
    secciones: secciones.count || 0,
  };
}

async function listarRecurso(recurso: NombreRecurso, filtroArchivados = 'activos') {
  const definicion = RECURSOS[recurso];
  let consulta = clienteServicio.from(definicion.tabla).select(definicion.seleccion);

  if (recurso === 'productos') {
    if (filtroArchivados === 'archivados') {
      consulta = consulta.eq('estado', 'archivado');
    } else if (filtroArchivados !== 'todos') {
      consulta = consulta.neq('estado', 'archivado');
    }
    consulta = consulta.order('actualizado_en', { ascending: false });
  } else {
    consulta = consulta.order('orden').order('actualizado_en', { ascending: false });
  }

  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

async function guardarRecurso(
  recurso: NombreRecurso,
  datosOriginales: Record<string, unknown>,
  id: string | undefined,
  usuarioId: string,
) {
  validarDatos(recurso, datosOriginales);
  const definicion = RECURSOS[recurso];
  const datos = seleccionarCampos(datosOriginales, definicion.campos);

  if (recurso === 'secciones' && Object.prototype.hasOwnProperty.call(datos, 'estilos')) {
    datos.estilos = normalizarEstilosSeccion(datos.estilos);
  }

  if (recurso === 'productos') {
    datos.slug = await crearSlugDisponible('productos', datos.nombre, id);
    datos.sku = String(datos.sku || '').trim().toUpperCase();
    datos.descripcion_corta = String(datos.descripcion || '').trim();
    datos.stock = datos.controla_stock ? Number(datos.stock) : null;
    await validarCategoriaDeProducto(datos.categoria_id, datos.tipo_producto);
    if (!id) datos.orden = await siguienteOrdenProducto();
  } else if (recurso === 'categorias') {
    datos.slug = await crearSlugDisponible('categorias', datos.slug || datos.nombre, id);
  } else if ('slug' in datos) {
    datos.slug = crearSlug(datos.slug || datos.nombre);
  }
  if (recurso === 'secciones' && !datos.clave) {
    datos.clave = crearSlug(datos.titulo).replace(/-/g, '_');
  }

  let precioAnterior: number | null | undefined;
  if (recurso === 'productos' && id && Object.prototype.hasOwnProperty.call(datos, 'precio')) {
    const resultadoAnterior = await clienteServicio
      .from('productos')
      .select('precio')
      .eq('id', id)
      .maybeSingle();
    precioAnterior = resultadoAnterior.data?.precio;
  }

  const consulta = id
    ? clienteServicio.from(definicion.tabla).update(datos).eq('id', id).select().single()
    : clienteServicio.from(definicion.tabla).insert(datos).select().single();
  const { data, error } = await consulta;
  if (error) throw error;

  if (recurso === 'productos') {
    if (id && precioAnterior !== data.precio) {
      await clienteServicio.from('historial_precios').insert({
        producto_id: data.id,
        precio_anterior: precioAnterior,
        precio_nuevo: data.precio,
        usuario_id: usuarioId,
      });
    }
  }

  await registrarAuditoria(usuarioId, id ? 'actualizar' : 'crear', recurso, data.id, datos);
  return data;
}

async function eliminarRecurso(recurso: NombreRecurso, id: string, usuarioId: string) {
  const definicion = RECURSOS[recurso];
  const consulta = recurso === 'productos'
    ? clienteServicio.from('productos').update({ estado: 'archivado' }).eq('id', id)
    : clienteServicio.from(definicion.tabla).delete().eq('id', id);
  const { error } = await consulta;
  if (error) throw error;

  await registrarAuditoria(
    usuarioId,
    recurso === 'productos' ? 'archivar' : 'eliminar',
    recurso,
    id,
  );
}

async function restaurarRecurso(recurso: NombreRecurso, id: string, usuarioId: string) {
  if (recurso !== 'productos') throw new Error('Solo se pueden restaurar productos archivados.');

  const { error } = await clienteServicio
    .from('productos')
    .update({ estado: 'borrador' })
    .eq('id', id)
    .eq('estado', 'archivado');
  if (error) throw error;

  await registrarAuditoria(usuarioId, 'restaurar', recurso, id, { estado: 'borrador' });
}

function validarRecurso(valor: unknown): NombreRecurso {
  if (!valor || !(String(valor) in RECURSOS)) {
    throw new Error('El recurso solicitado no es válido.');
  }
  return String(valor) as NombreRecurso;
}

async function prepararSubida(datos: Record<string, unknown>) {
  const productoId = String(datos.producto_id || '');
  const tipo = String(datos.tipo || '');
  const extensiones: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  };

  if (!productoId || !extensiones[tipo]) {
    throw new Error('El producto o el formato de imagen no son válidos.');
  }

  const { count, error: errorConteo } = await clienteServicio
    .from('imagenes')
    .select('*', { count: 'exact', head: true })
    .eq('producto_id', productoId);
  if (errorConteo) throw errorConteo;
  if ((count || 0) >= 5) throw new Error('Un producto puede tener como máximo 5 imágenes.');

  const ruta = `${productoId}/${crypto.randomUUID()}.${extensiones[tipo]}`;
  const { data, error } = await clienteServicio.storage
    .from('productos')
    .createSignedUploadUrl(ruta, { upsert: false });
  if (error) throw error;

  return { ruta, token: data.token };
}

async function registrarImagen(
  datos: Record<string, unknown>,
  usuarioId: string,
) {
  const ruta = String(datos.ruta || '');
  const productoId = String(datos.producto_id || '');
  if (!ruta || !productoId) throw new Error('Faltan datos de la imagen.');

  const { count, error: errorConteo } = await clienteServicio
    .from('imagenes')
    .select('*', { count: 'exact', head: true })
    .eq('producto_id', productoId);
  if (errorConteo) throw errorConteo;
  if ((count || 0) >= 5) throw new Error('Un producto puede tener como máximo 5 imágenes.');

  const { data: url } = clienteServicio.storage.from('productos').getPublicUrl(ruta);
  const principal = Boolean(datos.es_principal);

  if (principal) {
    await clienteServicio
      .from('imagenes')
      .update({ es_principal: false })
      .eq('producto_id', productoId);
  }

  const { data, error } = await clienteServicio
    .from('imagenes')
    .insert({
      producto_id: productoId,
      deposito: 'productos',
      ruta,
      url_publica: url.publicUrl,
      texto_alternativo: String(datos.texto_alternativo || 'Producto de Papelería de Sol'),
      es_principal: principal,
      orden: Number(datos.orden || 0),
    })
    .select()
    .single();
  if (error) throw error;

  await registrarAuditoria(usuarioId, 'subir_imagen', 'imagenes', data.id, { producto_id: productoId });
  return data;
}

async function guardarConfiguraciones(datos: Record<string, unknown>, usuarioId: string) {
  const clavesPermitidas = [
    'nombre_marca', 'lema_marca', 'aviso_superior', 'mostrar_aviso_superior', 'descripcion_corta',
    'titulo_footer_explorar', 'titulo_footer_contacto', 'whatsapp', 'correo', 'instagram', 'tiktok',
    'pais', 'region', 'moneda', 'simbolo_moneda', ...COLORES_CONFIGURABLES, 'fuente_principal',
    ...CLAVES_TEXTO_PUBLICO,
  ];

  COLORES_CONFIGURABLES.forEach((clave) => {
    if (Object.prototype.hasOwnProperty.call(datos, clave) && !esColorHexadecimal(datos[clave])) {
      throw new Error('Uno de los colores ingresados no es válido.');
    }
  });
  if (Object.prototype.hasOwnProperty.call(datos, 'fuente_principal') && !FUENTES_PERMITIDAS.includes(String(datos.fuente_principal))) {
    throw new Error('La tipografía seleccionada no es válida.');
  }
  CLAVES_TEXTO_PUBLICO.forEach((clave) => {
    if (Object.prototype.hasOwnProperty.call(datos, clave) && typeof datos[clave] !== 'string') {
      throw new Error('Uno de los textos ingresados no es válido.');
    }
  });

  const filas = Object.entries(datos)
    .filter(([clave]) => clavesPermitidas.includes(clave))
    .map(([clave, valor]) => ({ clave, valor, publica: true }));

  const { error } = await clienteServicio
    .from('configuraciones_sitio')
    .upsert(filas, { onConflict: 'clave' });
  if (error) throw error;

  await registrarAuditoria(usuarioId, 'actualizar', 'configuraciones_sitio', undefined, datos);
}

Deno.serve(async (solicitud) => {
  if (solicitud.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabecerasCors(solicitud) });
  }

  if (solicitud.method !== 'POST') {
    return responder(solicitud, { error: 'Método no permitido.' }, 405);
  }

  try {
    const autorizacion = solicitud.headers.get('authorization') || '';
    const token = autorizacion.replace(/^Bearer\s+/i, '');
    if (!token) return responder(solicitud, { error: 'Falta la sesión.' }, 401);

    const { data: autenticacion, error: errorUsuario } = await clienteServicio.auth.getUser(token);
    if (errorUsuario || !autenticacion.user) {
      return responder(solicitud, { error: 'La sesión no es válida.' }, 401);
    }

    const perfil = await verificarAdministrador(autenticacion.user.id);
    const sesionId = obtenerIdentificadorSesion(token);
    if (!sesionId) return responder(solicitud, { error: 'No se pudo identificar la sesión.' }, 401);

    const cuerpo = await solicitud.json();
    const accion = String(cuerpo.accion || '');

    if (accion === 'iniciar_sesion') {
      await iniciarSesionAdministrativa(solicitud, autenticacion.user.id, sesionId);
      await registrarAuditoria(autenticacion.user.id, 'iniciar_sesion', 'administracion', sesionId);
      return responder(solicitud, { datos: { perfil, inactividad_minutos: await minutosInactividadPermitidos() } });
    }

    await validarActividad(autenticacion.user.id, sesionId);

    if (accion === 'cerrar_sesion') {
      await clienteServicio
        .from('sesiones_administrativas')
        .update({ cerrada_en: new Date().toISOString() })
        .eq('id_sesion', sesionId);
      await registrarAuditoria(autenticacion.user.id, 'cerrar_sesion', 'administracion', sesionId);
      return responder(solicitud, { datos: true });
    }

    if (accion === 'resumen') {
      return responder(solicitud, { datos: await obtenerResumen() });
    }

    if (accion === 'obtener_sugerencia_sku') {
      return responder(solicitud, { datos: await obtenerSugerenciaSku(cuerpo.tipo_producto) });
    }

    if (accion === 'listar') {
      const recurso = validarRecurso(cuerpo.recurso);
      return responder(solicitud, { datos: await listarRecurso(recurso, String(cuerpo.filtro_archivados || 'activos')) });
    }

    if (accion === 'guardar') {
      const recurso = validarRecurso(cuerpo.recurso);
      const datos = await guardarRecurso(
        recurso,
        cuerpo.datos || {},
        cuerpo.id || undefined,
        autenticacion.user.id,
      );
      return responder(solicitud, { datos });
    }

    if (accion === 'eliminar') {
      const recurso = validarRecurso(cuerpo.recurso);
      await eliminarRecurso(recurso, String(cuerpo.id), autenticacion.user.id);
      return responder(solicitud, { datos: true });
    }

    if (accion === 'restaurar') {
      const recurso = validarRecurso(cuerpo.recurso);
      await restaurarRecurso(recurso, String(cuerpo.id), autenticacion.user.id);
      return responder(solicitud, { datos: true });
    }

    if (accion === 'preparar_subida') {
      return responder(solicitud, { datos: await prepararSubida(cuerpo.datos || {}) });
    }

    if (accion === 'registrar_imagen') {
      return responder(solicitud, {
        datos: await registrarImagen(cuerpo.datos || {}, autenticacion.user.id),
      });
    }

    if (accion === 'obtener_configuraciones') {
      const { data, error } = await clienteServicio.from('configuraciones_sitio').select('*');
      if (error) throw error;
      return responder(solicitud, { datos: data });
    }

    if (accion === 'guardar_configuraciones') {
      await guardarConfiguraciones(cuerpo.datos || {}, autenticacion.user.id);
      return responder(solicitud, { datos: true });
    }

    return responder(solicitud, { error: 'La acción solicitada no existe.' }, 400);
  } catch (error) {
    console.error(error);
    const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    const estado = mensaje.toLowerCase().includes('sesión') || mensaje.includes('permisos') ? 401 : 400;
    return responder(solicitud, { error: mensaje }, estado);
  }
});

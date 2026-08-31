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
      'enlace_boton', 'publicada', 'orden', 'meta_titulo', 'meta_descripcion',
    ],
  },
  variantes: {
    tabla: 'variantes',
    seleccion: '*',
    campos: ['producto_id', 'nombre', 'sku', 'precio', 'stock', 'estado', 'orden'],
  },
} as const;

type NombreRecurso = keyof typeof RECURSOS;

const COLORES_CONFIGURABLES = [
  'color_principal', 'color_secundario', 'color_principal_intenso', 'color_secundario_intenso',
  'color_fondo', 'color_texto', 'color_texto_suave',
];
const SECCIONES_INICIO_PREDETERMINADAS = {
  inicio_principal: {
    clave: 'inicio_principal',
    titulo: 'Ideas que alegran tus días',
    subtitulo: 'Papelería creativa hecha con dedicación',
    contenido: 'Descubrí stickers, plantillas y productos físicos para regalar, organizar y personalizar. Elegí tus favoritos y consultanos directamente por WhatsApp.',
    texto_boton: 'Explorar stickers',
    enlace_boton: '/stickers',
    publicada: true,
    orden: 1,
  },
  inicio_destacados: {
    clave: 'inicio_destacados',
    titulo: 'Productos destacados',
    subtitulo: 'Nuestros favoritos',
    contenido: 'Una selección de productos de Papelería de Sol.',
    texto_boton: null,
    enlace_boton: null,
    publicada: true,
    orden: 2,
  },
} as const;
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
const EXPRESION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAMANO_LOTE_LISTADO = 1000;

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

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function validarIdentificador(valor: unknown, etiqueta = 'El identificador') {
  if (typeof valor !== 'string' || !EXPRESION_UUID.test(valor)) {
    throw new Error(`${etiqueta} no es válido.`);
  }
  return valor;
}

function esEnlaceInternoSeguro(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return true;
  return typeof valor === 'string' && /^\/(?!\/)/.test(valor.trim());
}

function esUrlHttpsSegura(valor: unknown, dominiosPermitidos: string[] = []) {
  if (valor === null || valor === undefined || valor === '') return true;
  if (typeof valor !== 'string') return false;

  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:') return false;
    if (!dominiosPermitidos.length) return true;
    return dominiosPermitidos.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function esRutaDeImagenSegura(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return true;
  return typeof valor === 'string' && (
    /^\/(?!\/)/.test(valor) || esUrlHttpsSegura(valor)
  );
}

function esNumeroWhatsAppSeguro(valor: unknown) {
  return typeof valor === 'string' && /^[1-9]\d{7,14}$/.test(valor);
}

function esCorreoSeguro(valor: unknown) {
  return typeof valor === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function esRutaDeArchivoDeProductoSegura(ruta: string, productoId: string) {
  const expresion = new RegExp(
    `^${productoId}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp|avif)$`,
    'i',
  );
  return expresion.test(ruta);
}

function mensajeSeguroError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    return 'Ya existe un registro con ese SKU, nombre o dirección interna.';
  }

  const mensaje = error instanceof Error ? error.message : '';
  const esMensajeControlado = /^(El |La |Los |Una |Uno |Elegí |Faltan |Solo |No se pudo |Ya existe )/.test(mensaje);
  return esMensajeControlado
    ? mensaje
    : 'No se pudo completar la operación. Revisá los datos e intentá nuevamente.';
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
    if (Object.prototype.hasOwnProperty.call(datos, 'imagen_url') && !esRutaDeImagenSegura(datos.imagen_url)) {
      throw new Error('La imagen de la categoría debe ser una dirección interna o HTTPS válida.');
    }
  }

  if (recurso === 'secciones') {
    if (!String(datos.titulo || '').trim()) throw new Error('El título de la sección es obligatorio.');
    if (Object.prototype.hasOwnProperty.call(datos, 'enlace_boton') && !esEnlaceInternoSeguro(datos.enlace_boton)) {
      throw new Error('El enlace del botón debe comenzar con / y dirigir a una página de la tienda.');
    }
    if (Object.prototype.hasOwnProperty.call(datos, 'imagen_url') && !esRutaDeImagenSegura(datos.imagen_url)) {
      throw new Error('La imagen de la sección debe ser una dirección interna o HTTPS válida.');
    }
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
  const [productos, publicados, categorias] = await Promise.all([
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).neq('estado', 'archivado'),
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).eq('estado', 'publicado'),
    clienteServicio.from('categorias').select('*', { count: 'exact', head: true }),
  ]);

  return {
    productos: productos.count || 0,
    publicados: publicados.count || 0,
    categorias: categorias.count || 0,
  };
}

async function listarRecurso(recurso: NombreRecurso, filtroArchivados = 'activos') {
  const definicion = RECURSOS[recurso];
  const registros: Record<string, unknown>[] = [];

  for (let desde = 0; ; desde += TAMANO_LOTE_LISTADO) {
    let consulta = clienteServicio
      .from(definicion.tabla)
      .select(definicion.seleccion)
      .range(desde, desde + TAMANO_LOTE_LISTADO - 1);

    if (recurso === 'productos') {
      if (filtroArchivados === 'archivados') {
        consulta = consulta.eq('estado', 'archivado');
      } else if (filtroArchivados !== 'todos') {
        consulta = consulta.neq('estado', 'archivado');
      }
      consulta = consulta.order('actualizado_en', { ascending: false }).order('id');
    } else {
      consulta = consulta.order('orden').order('actualizado_en', { ascending: false }).order('id');
    }

    const { data, error } = await consulta;
    if (error) throw error;

    const lote = data || [];
    registros.push(...lote);
    if (lote.length < TAMANO_LOTE_LISTADO) return registros;
  }
}

function esClaveDeInicio(clave: unknown): clave is keyof typeof SECCIONES_INICIO_PREDETERMINADAS {
  return typeof clave === 'string' && clave in SECCIONES_INICIO_PREDETERMINADAS;
}

function textoLimpio(valor: unknown, predeterminado: string | null) {
  if (typeof valor !== 'string') return predeterminado;
  const texto = valor.trim();
  return texto || predeterminado;
}

async function obtenerTextosInicio() {
  const claves = Object.keys(SECCIONES_INICIO_PREDETERMINADAS);
  const { data, error } = await clienteServicio
    .from('secciones')
    .select('*')
    .in('clave', claves);
  if (error) throw error;

  return claves.map((clave) => (
    data?.find((seccion) => seccion.clave === clave)
      || SECCIONES_INICIO_PREDETERMINADAS[clave as keyof typeof SECCIONES_INICIO_PREDETERMINADAS]
  ));
}

async function guardarTextoInicio(
  clave: unknown,
  datos: Record<string, unknown>,
  usuarioId: string,
) {
  if (!esClaveDeInicio(clave)) throw new Error('El bloque de inicio solicitado no es válido.');
  if (!esObjetoPlano(datos)) throw new Error('Los textos enviados no tienen un formato válido.');

  const predeterminado = SECCIONES_INICIO_PREDETERMINADAS[clave];
  const titulo = textoLimpio(datos.titulo, predeterminado.titulo);
  if (!titulo) throw new Error('El título del bloque es obligatorio.');

  const registro = {
    ...predeterminado,
    titulo,
    subtitulo: textoLimpio(datos.subtitulo, predeterminado.subtitulo),
    contenido: textoLimpio(datos.contenido, predeterminado.contenido),
    texto_boton: clave === 'inicio_principal'
      ? textoLimpio(datos.texto_boton, predeterminado.texto_boton)
      : null,
  };
  const { data, error } = await clienteServicio
    .from('secciones')
    .upsert(registro, { onConflict: 'clave' })
    .select()
    .single();
  if (error) throw error;

  await registrarAuditoria(usuarioId, 'actualizar_textos_inicio', 'secciones', data.id, { clave });
  return data;
}

async function guardarRecurso(
  recurso: NombreRecurso,
  datosOriginales: Record<string, unknown>,
  id: string | undefined,
  usuarioId: string,
) {
  if (!esObjetoPlano(datosOriginales)) throw new Error('Los datos enviados no tienen un formato válido.');
  if (id) validarIdentificador(id);

  let datosValidados = datosOriginales;
  if (recurso === 'productos' && id) {
    const { data: productoActual, error: errorProductoActual } = await clienteServicio
      .from('productos')
      .select('tipo_producto, sku')
      .eq('id', id)
      .maybeSingle();
    if (errorProductoActual || !productoActual) throw new Error('El producto que querés editar no existe.');

    // El tipo y el SKU determinan la identidad del producto. Siempre se conservan
    // desde la base de datos aunque alguien intente enviarlos por fuera del formulario.
    datosValidados = {
      ...datosOriginales,
      tipo_producto: productoActual.tipo_producto,
      sku: productoActual.sku,
    };
  }

  validarDatos(recurso, datosValidados);
  const definicion = RECURSOS[recurso];
  const datos = seleccionarCampos(datosValidados, definicion.campos);

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
  validarIdentificador(id);
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
  validarIdentificador(id);

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
  if (!esObjetoPlano(datos)) throw new Error('Los datos de la imagen no tienen un formato válido.');
  const productoId = validarIdentificador(datos.producto_id, 'El producto');
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

  const { data: producto, error: errorProducto } = await clienteServicio
    .from('productos')
    .select('id')
    .eq('id', productoId)
    .maybeSingle();
  if (errorProducto || !producto) throw new Error('El producto seleccionado no existe.');

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
  if (!esObjetoPlano(datos)) throw new Error('Los datos de la imagen no tienen un formato válido.');
  const productoId = validarIdentificador(datos.producto_id, 'El producto');
  const ruta = String(datos.ruta || '');
  if (!ruta || !esRutaDeArchivoDeProductoSegura(ruta, productoId)) {
    throw new Error('La ruta de la imagen no es válida.');
  }

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

async function limpiarArchivosPendientes() {
  const { data: pendientes, error } = await clienteServicio
    .from('archivos_pendientes_eliminar')
    .select('ruta, deposito')
    .order('creado_en')
    .limit(20);

  // La tabla puede no existir hasta que se aplique la migración. Eso no debe impedir
  // las acciones habituales del panel durante una actualización escalonada.
  if (error || !pendientes?.length) return;

  for (const pendiente of pendientes) {
    const { error: errorStorage } = await clienteServicio.storage
      .from(pendiente.deposito)
      .remove([pendiente.ruta]);
    if (errorStorage) continue;

    await clienteServicio
      .from('archivos_pendientes_eliminar')
      .delete()
      .eq('ruta', pendiente.ruta)
      .eq('deposito', pendiente.deposito);
  }
}

async function eliminarImagen(
  datos: Record<string, unknown>,
  usuarioId: string,
) {
  if (!esObjetoPlano(datos)) throw new Error('Los datos de la imagen no tienen un formato válido.');
  const productoId = validarIdentificador(datos.producto_id, 'El producto');
  const imagenId = validarIdentificador(datos.imagen_id, 'La imagen');

  const { data: imagen, error: errorImagen } = await clienteServicio
    .from('imagenes')
    .select('id, producto_id, deposito, ruta, es_principal')
    .eq('id', imagenId)
    .eq('producto_id', productoId)
    .maybeSingle();
  if (errorImagen || !imagen) throw new Error('La imagen no pertenece al producto seleccionado.');
  if (imagen.deposito !== 'productos' || !esRutaDeArchivoDeProductoSegura(imagen.ruta, productoId)) {
    throw new Error('La ruta de la imagen no es válida.');
  }

  // Primero se elimina la referencia pública. Si Storage tiene una interrupción, la
  // imagen no se seguirá mostrando y su ruta queda en una cola para reintentarla.
  const { error: errorBase } = await clienteServicio
    .from('imagenes')
    .delete()
    .eq('id', imagenId)
    .eq('producto_id', productoId);
  if (errorBase) throw errorBase;

  const { error: errorStorage } = await clienteServicio.storage
    .from(imagen.deposito)
    .remove([imagen.ruta]);

  if (errorStorage) {
    const { error: errorPendiente } = await clienteServicio
      .from('archivos_pendientes_eliminar')
      .upsert({ ruta: imagen.ruta, deposito: imagen.deposito, producto_id: productoId }, { onConflict: 'ruta,deposito' });
    if (errorPendiente) console.error('No se pudo registrar la limpieza pendiente:', errorPendiente);

    await registrarAuditoria(usuarioId, 'eliminar_imagen_pendiente', 'imagenes', imagenId, {
      producto_id: productoId,
      ruta: imagen.ruta,
    });
    return { archivo_pendiente: true };
  }

  await registrarAuditoria(usuarioId, 'eliminar_imagen', 'imagenes', imagenId, {
    producto_id: productoId,
    ruta: imagen.ruta,
  });
  return { archivo_pendiente: false };
}

async function guardarConfiguraciones(datos: Record<string, unknown>, usuarioId: string) {
  const clavesPermitidas = [
    'aviso_superior', 'mostrar_aviso_superior', 'descripcion_corta',
    'titulo_footer_explorar', 'titulo_footer_contacto', 'whatsapp', 'correo', 'instagram', 'tiktok',
    'pais', 'region', 'moneda', 'simbolo_moneda', ...COLORES_CONFIGURABLES,
    ...CLAVES_TEXTO_PUBLICO,
  ];

  if (!esObjetoPlano(datos)) throw new Error('Los datos enviados no tienen un formato válido.');
  for (const [clave, valor] of Object.entries(datos)) {
    if (!clavesPermitidas.includes(clave)) continue;
    if (clave === 'mostrar_aviso_superior') {
      if (typeof valor !== 'boolean') throw new Error('El estado del aviso superior no es válido.');
    } else if (typeof valor !== 'string') {
      throw new Error('Uno de los textos ingresados no es válido.');
    }
  }

  COLORES_CONFIGURABLES.forEach((clave) => {
    if (Object.prototype.hasOwnProperty.call(datos, clave) && !esColorHexadecimal(datos[clave])) {
      throw new Error('Uno de los colores ingresados no es válido.');
    }
  });
  if (Object.prototype.hasOwnProperty.call(datos, 'whatsapp') && !esNumeroWhatsAppSeguro(datos.whatsapp)) {
    throw new Error('El número de WhatsApp debe estar en formato internacional, sin espacios ni símbolos.');
  }
  if (Object.prototype.hasOwnProperty.call(datos, 'correo') && !esCorreoSeguro(datos.correo)) {
    throw new Error('El correo comercial no tiene un formato válido.');
  }
  if (
    Object.prototype.hasOwnProperty.call(datos, 'instagram') &&
    !esUrlHttpsSegura(datos.instagram, ['instagram.com', 'www.instagram.com'])
  ) {
    throw new Error('El enlace de Instagram debe usar https://instagram.com o https://www.instagram.com.');
  }
  if (
    Object.prototype.hasOwnProperty.call(datos, 'tiktok') &&
    !esUrlHttpsSegura(datos.tiktok, ['tiktok.com', 'www.tiktok.com'])
  ) {
    throw new Error('El enlace de TikTok debe usar https://tiktok.com o https://www.tiktok.com.');
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
    await limpiarArchivosPendientes();

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

    if (accion === 'obtener_textos_inicio') {
      return responder(solicitud, { datos: await obtenerTextosInicio() });
    }

    if (accion === 'guardar_textos_inicio') {
      return responder(solicitud, {
        datos: await guardarTextoInicio(cuerpo.clave, cuerpo.datos || {}, autenticacion.user.id),
      });
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

    if (accion === 'eliminar_imagen') {
      return responder(solicitud, {
        datos: await eliminarImagen(cuerpo.datos || {}, autenticacion.user.id),
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
    const mensaje = mensajeSeguroError(error);
    const estado = mensaje.toLowerCase().includes('sesión') || mensaje.includes('permisos') ? 401 : 400;
    return responder(solicitud, { error: mensaje }, estado);
  }
});

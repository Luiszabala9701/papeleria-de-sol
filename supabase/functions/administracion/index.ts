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
    seleccion: '*, categoria:categorias(id,nombre), imagenes(*), productos_temas(tema:temas(id,nombre,slug))',
    campos: [
      'categoria_id', 'tipo_producto', 'nombre', 'slug', 'sku', 'descripcion_corta',
      'descripcion', 'precio', 'moneda', 'controla_stock', 'stock', 'estado',
      'destacado', 'orden', 'mensaje_whatsapp', 'meta_titulo', 'meta_descripcion',
    ],
  },
  categorias: {
    tabla: 'categorias',
    seleccion: '*',
    campos: ['nombre', 'slug', 'descripcion', 'tipo_producto', 'imagen_url', 'publicada', 'orden'],
  },
  temas: {
    tabla: 'temas',
    seleccion: '*',
    campos: ['nombre', 'slug', 'descripcion', 'imagen_url', 'publicado', 'orden'],
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

function seleccionarCampos(datos: Record<string, unknown>, campos: readonly string[]) {
  return Object.fromEntries(
    campos
      .filter((campo) => Object.prototype.hasOwnProperty.call(datos, campo))
      .map((campo) => [campo, datos[campo]]),
  );
}

function validarDatos(recurso: NombreRecurso, datos: Record<string, unknown>) {
  if ('nombre' in datos && !String(datos.nombre || '').trim()) {
    throw new Error('El nombre es obligatorio.');
  }

  if (recurso === 'productos') {
    if (!['sticker', 'plantilla', 'fisico'].includes(String(datos.tipo_producto))) {
      throw new Error('El tipo de producto no es válido.');
    }
    if (datos.precio !== null && datos.precio !== undefined && Number(datos.precio) < 0) {
      throw new Error('El precio no puede ser negativo.');
    }
    if (datos.controla_stock && Number(datos.stock) < 0) {
      throw new Error('El stock no puede ser negativo.');
    }
  }
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
  const [productos, publicados, categorias, temas, secciones] = await Promise.all([
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).neq('estado', 'archivado'),
    clienteServicio.from('productos').select('*', { count: 'exact', head: true }).eq('estado', 'publicado'),
    clienteServicio.from('categorias').select('*', { count: 'exact', head: true }),
    clienteServicio.from('temas').select('*', { count: 'exact', head: true }),
    clienteServicio.from('secciones').select('*', { count: 'exact', head: true }),
  ]);

  return {
    productos: productos.count || 0,
    publicados: publicados.count || 0,
    categorias: categorias.count || 0,
    temas: temas.count || 0,
    secciones: secciones.count || 0,
  };
}

async function listarRecurso(recurso: NombreRecurso) {
  const definicion = RECURSOS[recurso];
  let consulta = clienteServicio.from(definicion.tabla).select(definicion.seleccion);

  if (recurso === 'productos') {
    consulta = consulta.neq('estado', 'archivado').order('actualizado_en', { ascending: false });
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

  if ('slug' in datos) {
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
    const temasIds = Array.isArray(datosOriginales.temas_ids)
      ? datosOriginales.temas_ids.filter(Boolean)
      : [];

    await clienteServicio.from('productos_temas').delete().eq('producto_id', data.id);
    if (temasIds.length > 0) {
      const relaciones = temasIds.map((temaId) => ({ producto_id: data.id, tema_id: temaId }));
      const resultadoTemas = await clienteServicio.from('productos_temas').insert(relaciones);
      if (resultadoTemas.error) throw resultadoTemas.error;
    }

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
    'nombre_marca', 'descripcion_corta', 'whatsapp', 'correo', 'instagram', 'tiktok',
    'pais', 'region', 'moneda', 'simbolo_moneda', 'inactividad_administrador_minutos',
  ];

  const filas = Object.entries(datos)
    .filter(([clave]) => clavesPermitidas.includes(clave))
    .map(([clave, valor]) => ({ clave, valor }));

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

    if (accion === 'listar') {
      const recurso = validarRecurso(cuerpo.recurso);
      return responder(solicitud, { datos: await listarRecurso(recurso) });
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

export async function obtenerMensajeErrorFuncion(error) {
  const respuesta = error?.context;
  if (respuesta instanceof Response) {
    const cuerpo = await respuesta.clone().json().catch(() => null);
    if (cuerpo?.code === 'BOOT_ERROR') {
      return 'El servidor de administración no pudo iniciarse. Revisá el despliegue de la función administracion en Supabase.';
    }
    if (cuerpo?.error) return cuerpo.error;
  }
  if (error?.name === 'FunctionsFetchError' || /Failed to send a request to the Edge Function/i.test(error?.message || '')) {
    return 'No pudimos conectar con administración. Revisá tu conexión; si continúa, comprobá el despliegue y los Logs de la función administracion en Supabase.';
  }
  return error?.message || 'No se pudo completar la operación.';
}

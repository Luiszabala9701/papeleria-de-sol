import { defineMiddleware } from 'astro:middleware';

const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co",
  "media-src 'self'",
].join('; ');

export const onRequest = defineMiddleware(async (contexto, siguiente) => {
  const respuesta = await siguiente();
  const esConexionSegura = contexto.url.protocol === 'https:';

  respuesta.headers.set(
    'Content-Security-Policy',
    `${POLITICA_CONTENIDO}${esConexionSegura ? '; upgrade-insecure-requests' : ''}`,
  );
  respuesta.headers.set('X-Content-Type-Options', 'nosniff');
  respuesta.headers.set('X-Frame-Options', 'DENY');
  respuesta.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  respuesta.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (esConexionSegura) {
    respuesta.headers.set('Strict-Transport-Security', 'max-age=31536000');
  }

  return respuesta;
});

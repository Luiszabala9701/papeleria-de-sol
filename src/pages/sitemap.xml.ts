import type { APIRoute } from 'astro';
import { obtenerSlugsProductosPublicados } from '../servicios/repositorio-contenidos.js';
import { crearUrlAbsoluta, escaparXml } from '../servicios/seo';

export const prerender = false;

const PAGINAS_PUBLICAS = [
  { ruta: '/', prioridad: '1.0', frecuencia: 'weekly' },
  { ruta: '/stickers', prioridad: '0.9', frecuencia: 'daily' },
  { ruta: '/productos-fisicos', prioridad: '0.8', frecuencia: 'weekly' },
  { ruta: '/plantillas', prioridad: '0.7', frecuencia: 'weekly' },
  { ruta: '/ayuda', prioridad: '0.5', frecuencia: 'monthly' },
  { ruta: '/privacidad', prioridad: '0.2', frecuencia: 'yearly' },
  { ruta: '/terminos', prioridad: '0.2', frecuencia: 'yearly' },
];

function entradaSitemap(ruta: string, prioridad: string, frecuencia: string) {
  return [
    '  <url>',
    `    <loc>${escaparXml(crearUrlAbsoluta(ruta))}</loc>`,
    `    <changefreq>${frecuencia}</changefreq>`,
    `    <priority>${prioridad}</priority>`,
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = async () => {
  const slugs = await obtenerSlugsProductosPublicados();
  const rutasProductos = [...new Set(slugs.map((slug) => `/productos/${slug}`))];
  const paginas = PAGINAS_PUBLICAS.map(({ ruta, prioridad, frecuencia }) =>
    entradaSitemap(ruta, prioridad, frecuencia),
  );
  const productosSitemap = rutasProductos.map((ruta) => entradaSitemap(ruta, '0.7', 'weekly'));
  const contenido = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paginas,
    ...productosSitemap,
    '</urlset>',
  ].join('\n');

  return new Response(contenido, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};

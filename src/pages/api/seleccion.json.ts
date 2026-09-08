import type { APIRoute } from 'astro';
import { obtenerProductosPorIds } from '../../servicios/repositorio-contenidos.js';
import { revisarSeleccion } from '../../servicios/variantes.js';

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const responder = (datos: unknown, status = 200) => new Response(JSON.stringify(datos), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  try {
    const texto = await request.text();
    if (texto.length > 24000) return responder({ error: 'La selección es demasiado grande.' }, 400);
    let cuerpo;
    try { cuerpo = JSON.parse(texto); } catch { return responder({ error: 'La selección no es válida.' }, 400); }
    const lineas = cuerpo?.lineas;
    if (!Array.isArray(lineas) || !lineas.length || lineas.length > 100
      || lineas.some((linea) => !linea || typeof linea.id !== 'string' || !linea.id.trim() || linea.id.length > 80)) {
      return responder({ error: 'La selección no es válida.' }, 400);
    }
    const ids = [...new Set<string>(lineas.map((linea) => linea.id))];
    return responder(revisarSeleccion(lineas, await obtenerProductosPorIds(ids)));
  } catch {
    return responder({ error: 'No pudimos comprobar los precios y el stock. Intentá nuevamente.' }, 503);
  }
};

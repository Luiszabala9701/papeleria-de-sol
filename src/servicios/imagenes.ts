const ANCHOS_PREDETERMINADOS = [320, 480, 640, 960];

function esRutaImagenValida(url: string) {
  return url.startsWith('/') || url.startsWith('https://');
}

export function crearUrlImagenOptimizada(url: string | undefined, ancho: number, calidad = 78) {
  const original = String(url || '/stickers/1.webp');
  if (!import.meta.env.PROD || !esRutaImagenValida(original) || original.startsWith('/.netlify/images')) {
    return original;
  }

  const parametros = new URLSearchParams({
    url: original,
    w: String(Math.max(1, Math.round(ancho))),
    q: String(Math.max(1, Math.min(100, Math.round(calidad)))),
  });
  return `/.netlify/images?${parametros.toString()}`;
}

export function crearSrcsetImagen(
  url: string | undefined,
  anchos = ANCHOS_PREDETERMINADOS,
  calidad = 78,
) {
  if (!import.meta.env.PROD) return undefined;
  const original = String(url || '/stickers/1.webp');
  if (!esRutaImagenValida(original)) return undefined;

  return [...new Set(anchos)]
    .sort((primero, segundo) => primero - segundo)
    .map((ancho) => `${crearUrlImagenOptimizada(original, ancho, calidad)} ${ancho}w`)
    .join(', ');
}

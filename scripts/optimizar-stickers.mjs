import { mkdir, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const carpetaOrigen = resolve(process.argv[2] || 'recursos-originales/stickers');
const carpetaDestino = resolve(process.argv[3] || 'public/stickers');
const calidad = 82;
const procesosSimultaneos = 8;

await mkdir(carpetaDestino, { recursive: true });

const archivos = (await readdir(carpetaOrigen))
  .filter((archivo) => archivo.toLowerCase().endsWith('.png'))
  .sort((a, b) => Number.parseInt(a) - Number.parseInt(b));

if (archivos.length === 0) {
  throw new Error(`No se encontraron imágenes PNG en ${carpetaOrigen}.`);
}

let cursor = 0;

async function procesarSiguiente() {
  while (cursor < archivos.length) {
    const indice = cursor;
    cursor += 1;
    const archivo = archivos[indice];
    const nombreDestino = archivo.replace(/\.png$/i, '.webp');

    await sharp(resolve(carpetaOrigen, archivo))
      .webp({ quality: calidad, alphaQuality: 90, effort: 4 })
      .toFile(resolve(carpetaDestino, nombreDestino));
  }
}

await Promise.all(Array.from({ length: procesosSimultaneos }, procesarSiguiente));

const bytesOrigen = (
  await Promise.all(archivos.map((archivo) => stat(resolve(carpetaOrigen, archivo))))
).reduce((total, archivo) => total + archivo.size, 0);

const archivosDestino = (await readdir(carpetaDestino)).filter((archivo) =>
  archivo.toLowerCase().endsWith('.webp'),
);
const bytesDestino = (
  await Promise.all(archivosDestino.map((archivo) => stat(resolve(carpetaDestino, archivo))))
).reduce((total, archivo) => total + archivo.size, 0);

console.log(`Stickers procesados: ${archivosDestino.length}`);
console.log(`Peso original: ${(bytesOrigen / 1024 / 1024).toFixed(2)} MB`);
console.log(`Peso optimizado: ${(bytesDestino / 1024 / 1024).toFixed(2)} MB`);
console.log(`Reducción: ${((1 - bytesDestino / bytesOrigen) * 100).toFixed(1)} %`);

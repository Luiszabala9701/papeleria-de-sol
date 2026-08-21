import { dev } from 'astro';

process.env.ASTRO_TELEMETRY_DISABLED = '1';

const servidor = await dev({
  root: new URL('../', import.meta.url),
  configFile: 'astro.config.local.mjs',
});

const urlLocal = servidor.resolvedUrls?.local?.[0]
  || `http://${servidor.address.address}:${servidor.address.port}/`;

console.log(`Papelería de Sol disponible en ${urlLocal}`);
console.log('Presioná Ctrl+C para detener el servidor.');

let cerrando = false;

async function cerrarServidor() {
  if (cerrando) return;
  cerrando = true;
  await servidor.stop();
  process.exit(0);
}

process.once('SIGINT', cerrarServidor);
process.once('SIGTERM', cerrarServidor);

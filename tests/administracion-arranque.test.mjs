import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as productos from '../supabase/functions/administracion/validar-producto.ts';
import * as pedidos from '../supabase/functions/administracion/operaciones-pedidos.ts';
import { obtenerMensajeErrorFuncion } from '../src/servicios/errores-administracion.js';

const origen = 'https://papeleria-de-sol-pruebas.netlify.app';

function iniciarServidor() {
  const modulos = { './validar-producto.ts': productos, './operaciones-pedidos.ts': pedidos };
  const fuente = readFileSync(new URL('../supabase/functions/administracion/index.ts', import.meta.url), 'utf8');
  const codigo = fuente.replace(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';\r?\n/gm, (_importacion, nombres, ruta) => {
    for (const nombre of nombres.split(',').map(x => x.trim())) {
      if (ruta.startsWith('./')) assert.equal(typeof modulos[ruta]?.[nombre], 'function', `${ruta} debe exportar ${nombre}`);
      else assert.equal(ruta, 'npm:@supabase/supabase-js@2');
    }
    return '';
  });
  const { outputText, diagnostics } = ts.transpileModule(codigo, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
  });
  assert.equal(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  let handler;
  runInNewContext(outputText, {
    ...productos, ...pedidos, Request, Response, TextEncoder,
    createClient: () => ({ auth: { getUser() { throw new Error('No deben verificarse usuarios sin token.'); } } }),
    Deno: {
      env: { get: clave => ({ SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio-sintetico', URL_SITIO: origen })[clave] },
      serve: funcion => { handler = funcion; },
    },
  });
  assert.equal(typeof handler, 'function');
  return handler;
}

test('administracion arranca con sus exportaciones y responde al preflight sin abrir permisos', async () => {
  const handler = iniciarServidor();
  const respuesta = await handler(new Request('https://prueba.supabase.co/functions/v1/administracion', {
    method: 'OPTIONS', headers: { Origin: origen, 'Access-Control-Request-Method': 'POST' },
  }));
  assert.equal(respuesta.status, 204);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), origen);
  assert.match(respuesta.headers.get('access-control-allow-headers'), /content-type/);
});

test('administracion sigue rechazando solicitudes sin sesión y orígenes no permitidos', async () => {
  const handler = iniciarServidor();
  const solicitar = origenSolicitud => handler(new Request('https://prueba.supabase.co/functions/v1/administracion', {
    method: 'POST', headers: { Origin: origenSolicitud, 'Content-Type': 'application/json' }, body: '{"accion":"iniciar_sesion"}',
  }));
  assert.equal((await solicitar(origen)).status, 401);
  assert.equal((await solicitar('https://externo.example.test')).status, 403);
});

test('los errores de arranque y conexión se explican sin confundirlos con la contraseña', async () => {
  const arranque = await obtenerMensajeErrorFuncion({ context: Response.json({ code: 'BOOT_ERROR', message: 'Function failed to start' }, { status: 503 }) });
  assert.match(arranque, /no pudo iniciarse/);
  const conexion = await obtenerMensajeErrorFuncion({ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' });
  assert.match(conexion, /despliegue y los Logs/);
  assert.equal(await obtenerMensajeErrorFuncion({ context: Response.json({ error: 'La sesión no es válida.' }, { status: 401 }) }), 'La sesión no es válida.');
});

// Servidor HTTP: solo 127.0.0.1, comprobación de Host/Origin, estáticos de web/ y /core/, y la API.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearStore } from './store.js';
import { crearCopias } from './copias.js';
import { crearDeshacer } from './deshacer.js';
import { crearApi, ErrorHttp } from './api.js';

export const LIMITE_CUERPO = 256 * 1024;
const RAIZ_WEB = fileURLToPath(new URL('../../web/', import.meta.url));
const RAIZ_CORE = fileURLToPath(new URL('../core/', import.meta.url));

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    + "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

function responder(res, estado, cuerpo, cabeceras = {}) {
  res.writeHead(estado, { ...CABECERAS_SEGURIDAD, ...cabeceras });
  res.end(cuerpo);
}

const json = (res, estado, datos) =>
  responder(res, estado, JSON.stringify(datos), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

/**
 * Lee el cuerpo JSON con límite de tamaño. Lo que pasa del límite se sigue leyendo (sin guardarlo) para poder
 * responder 413: si se cortara la conexión a mitad, el cliente vería «conexión cortada» en vez del error.
 * Solo se corta si alguien manda muchísimo más.
 */
function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let tam = 0;
    const trozos = [];
    req.on('data', (t) => {
      tam += t.length;
      if (tam > LIMITE_CUERPO * 64) { req.destroy(); return; }
      if (tam <= LIMITE_CUERPO) trozos.push(t);
    });
    req.on('end', () => {
      if (tam > LIMITE_CUERPO) { mal(new ErrorHttp(413, 'Petición demasiado grande')); return; }
      let v;
      try { v = JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}'); } catch { mal(new ErrorHttp(400, 'JSON no válido')); return; }
      if (v === null || typeof v !== 'object' || Array.isArray(v)) mal(new ErrorHttp(400, 'Se espera un objeto JSON'));
      else ok(v);
    });
    req.on('error', mal);
  });
}

/** Fichero estático dentro de `raiz` (sin salir de ella). */
async function estatico(raiz, rel) {
  let ruta;
  try { ruta = resolve(raiz, decodeURIComponent(rel)); } catch { return null; }
  if (!ruta.startsWith(raiz.endsWith(sep) ? raiz : raiz + sep)) return null;
  try { return { cuerpo: await readFile(ruta), tipo: TIPOS_MIME[extname(ruta)] ?? 'application/octet-stream' }; } catch { return null; }
}

/**
 * Arranca el servidor. `alServirIndex(html)` permite inyectar el tema en el <html> (sin parpadeo).
 * Devuelve { servidor, puerto, url, store, cerrar }.
 */
export async function iniciarServidor({ datos, puerto = 4321, host = '127.0.0.1', hoySimulado = null, extrasContexto = [], metricas = [], alServirIndex = null }) {
  const store = crearStore(datos);
  if (store.existe()) store.limpiarTemporales();
  const copias = crearCopias(store.raiz, { avisar: (m) => console.warn(m) });
  const api = crearApi({ store, copias, deshacer: crearDeshacer(), hoySimulado, extrasContexto, metricas });
  let puertoReal = puerto;

  const hostValido = (h) => h === `localhost:${puertoReal}` || h === `127.0.0.1:${puertoReal}`;
  const origenValido = (o) => o === `http://localhost:${puertoReal}` || o === `http://127.0.0.1:${puertoReal}`;

  async function manejar(req, res) {
    // Defensa contra DNS rebinding: solo nombres locales con nuestro puerto.
    if (!hostValido(req.headers.host)) return responder(res, 403, 'Host no permitido', { 'Content-Type': 'text/plain; charset=utf-8' });
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const clave = `${req.method} ${url.pathname}`;
      const ruta = api.rutas[clave];
      if (!ruta) {
        const metodos = Object.keys(api.rutas).filter((k) => k.endsWith(` ${url.pathname}`)).map((k) => k.split(' ')[0]);
        if (metodos.length) return responder(res, 405, JSON.stringify({ error: 'Método no permitido' }), { Allow: metodos.join(', '), 'Content-Type': 'application/json; charset=utf-8' });
        return json(res, 404, { error: 'Ruta desconocida' });
      }
      try {
        let cuerpo = {};
        if (req.method === 'POST') {
          if (req.headers.origin && !origenValido(req.headers.origin)) throw new ErrorHttp(403, 'Origen no permitido');
          if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new ErrorHttp(415, 'Se espera JSON');
          cuerpo = await leerCuerpo(req);
        }
        return json(res, 200, await ruta(url.searchParams, cuerpo));
      } catch (e) {
        if (e instanceof ErrorHttp) return json(res, e.estado, { error: e.message, ...e.extra });
        console.error(e); // el detalle (con rutas y trazas) solo en la consola del servidor
        return json(res, 500, { error: 'Error interno del planner. El detalle está en la terminal donde corre.' });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, 'Método no permitido', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    const [raiz, rel] = url.pathname.startsWith('/core/')
      ? [RAIZ_CORE, url.pathname.slice('/core/'.length)]
      : [RAIZ_WEB, url.pathname === '/' ? 'index.html' : url.pathname.slice(1)];
    const f = await estatico(raiz, rel);
    if (!f) return responder(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
    let cuerpo = f.cuerpo;
    if (rel === 'index.html' && alServirIndex) cuerpo = Buffer.from(await alServirIndex(cuerpo.toString('utf8'), store), 'utf8');
    responder(res, 200, req.method === 'HEAD' ? undefined : cuerpo, {
      'Content-Type': f.tipo, 'Cache-Control': rel === 'index.html' ? 'no-store' : 'no-cache',
    });
  }

  const servidor = createServer((req, res) => {
    manejar(req, res).catch((e) => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'Error interno' }); });
  });
  await new Promise((ok, mal) => { servidor.once('error', mal); servidor.listen(puerto, host, ok); });
  puertoReal = servidor.address().port;
  return {
    servidor, store, api, puerto: puertoReal, url: `http://localhost:${puertoReal}/`,
    cerrar: () => new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(() => ok()); }),
  };
}

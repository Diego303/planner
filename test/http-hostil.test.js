// Q3 · Servidor HTTP ante peticiones hostiles o raras: siempre una respuesta clara, sin trazas internas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { arrancar } from '../src/server/index.js';
import { copiaEjemplo } from './ayudas.js';

const HOY = '2026-11-02';
let app, c, P;
before(async () => { c = copiaEjemplo(); app = await arrancar({ datos: c.dir, puerto: 0, hoySimulado: HOY }); P = app.puerto; });
after(async () => { await app.cerrar(); c.borrar(); });

/** Petición cruda: sin cabeceras automáticas (ni Host) y con el cuerpo tal cual. */
function cruda({ method = 'GET', path = '/', headers, body = null, host = '127.0.0.1' }) {
  return new Promise((ok, mal) => {
    const req = request({ host, port: P, method, path, setHost: false, headers: headers ?? { host: `127.0.0.1:${P}` } }, (res) => {
      let datos = '';
      res.on('data', (d) => { datos += d; });
      res.on('end', () => ok({ estado: res.statusCode, datos, cabeceras: res.headers }));
    });
    req.on('error', mal);
    if (body) req.write(body);
    req.end();
  });
}
const JSON_ = () => ({ host: `127.0.0.1:${P}`, 'content-type': 'application/json' });

test('cuerpo de más de 256 KB: el cliente recibe el 413 (no una conexión cortada)', async () => {
  for (const kb of [257, 300, 2048]) {
    const r = await cruda({ method: 'POST', path: '/api/op', headers: JSON_(), body: JSON.stringify({ op: 'tarea.crear', relleno: 'a'.repeat(kb * 1024) }) });
    assert.equal(r.estado, 413, `${kb} KB`);
    assert.match(JSON.parse(r.datos).error, /demasiado grande/);
  }
  // y el servidor sigue atendiendo
  assert.equal((await cruda({ path: `/api/version?hoy=${HOY}` })).estado, 200);
});

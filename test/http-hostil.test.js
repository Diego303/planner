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

test('cuerpo JSON que no es un objeto: 400 claro', async () => {
  for (const body of ['null', '[]', '"op"', '5', 'true', '{', '{"op":5}']) {
    const r = await cruda({ method: 'POST', path: '/api/op', headers: JSON_(), body });
    assert.equal(r.estado, 400, `${body} → ${r.datos}`);
  }
  for (const body of ['null', '[1]']) assert.equal((await cruda({ method: 'POST', path: '/api/deshacer', headers: JSON_(), body })).estado, 400, body);
});

test('fichero sin permiso de lectura o que es una carpeta: aviso claro, sin rutas internas, y lo demás funciona', { skip: process.getuid?.() === 0 && 'como root no hay permisos' }, async () => {
  const { chmodSync, mkdirSync, rmSync } = await import('node:fs');
  chmodSync(`${c.dir}/tareas.md`, 0o000);
  mkdirSync(`${c.dir}/inbox.md.d`);
  rmSync(`${c.dir}/inbox.md`);
  mkdirSync(`${c.dir}/inbox.md`);
  try {
    const r = await cruda({ path: `/api/estado?hoy=${HOY}` });
    assert.equal(r.estado, 200, r.datos);
    const avisos = JSON.parse(r.datos).meta.avisos.join(' · ');
    assert.match(avisos, /tareas\.md ignorado: sin permiso para leerlo/);
    assert.match(avisos, /inbox\.md ignorado: es una carpeta/);
    const op = await cruda({ method: 'POST', path: '/api/op', headers: JSON_(), body: JSON.stringify({ op: 'tarea.crear', hoy: HOY, args: { seccion: 'mas', tarea: { texto: 'x' } } }) });
    assert.equal(op.estado, 422, op.datos);
    assert.match(JSON.parse(op.datos).error, /tareas\.md.*sin permiso/);
    for (const x of [avisos, op.datos]) assert.ok(!x.includes(c.dir), 'sin la ruta absoluta'); // (meta.datos.ruta sí la lleva: se enseña en Gestión)
  } finally {
    chmodSync(`${c.dir}/tareas.md`, 0o644);
    rmSync(`${c.dir}/inbox.md`, { recursive: true });
    rmSync(`${c.dir}/inbox.md.d`, { recursive: true });
  }
});

test('un error inesperado da 500 sin el mensaje interno', async (t) => {
  const fsp = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  t.mock.method(fsp, 'readdir', async () => { throw new Error(`fallo raro en ${c.dir}/semanas con detalles internos`); });
  syncBuiltinESMExports();
  try {
    const r = await cruda({ path: `/api/semanas?hoy=${HOY}` });
    assert.equal(r.estado, 500);
    assert.ok(!r.datos.includes(c.dir) && !r.datos.includes('detalles internos'), r.datos);
    assert.match(JSON.parse(r.datos).error, /Error interno/);
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
});

test('método que no toca: 405 con Allow; ruta de la API desconocida: 404', async () => {
  for (const [method, path, allow] of [['GET', '/api/op', 'POST'], ['DELETE', '/api/op', 'POST'], ['POST', '/api/estado', 'GET'], ['PUT', '/api/deshacer', 'POST']]) {
    const r = await cruda({ method, path, headers: JSON_(), body: method === 'GET' ? null : '{}' });
    assert.equal(r.estado, 405, `${method} ${path}`);
    assert.equal(r.cabeceras.allow, allow);
  }
  assert.equal((await cruda({ path: '/api/nada' })).estado, 404);
  assert.equal((await cruda({ method: 'PUT', path: '/index.html', body: 'x' })).estado, 405);
});

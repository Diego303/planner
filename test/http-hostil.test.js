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

/** Petición cruda: sin cabeceras automáticas (ni Host) y con el cuerpo tal cual (con Content-Length: DELETE no va troceado). */
function cruda({ method = 'GET', path = '/', headers, body = null, host = '127.0.0.1' }) {
  return new Promise((ok, mal) => {
    const h = { ...(headers ?? { host: `127.0.0.1:${P}` }), ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) };
    const req = request({ host, port: P, method, path, setHost: false, headers: h }, (res) => {
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

test('Host: solo localhost o 127.0.0.1 con nuestro puerto (contra DNS rebinding)', async () => {
  for (const host of [null, '', `localhost.evil.com:${P}`, `127.0.0.1:${P}.evil.com`, `evil.com:${P}`, `127.0.0.1`, `localhost:${P + 1}`, `[::1]:${P}`, `0.0.0.0:${P}`, `127.0.0.2:${P}`]) {
    const r = await cruda({ path: '/api/estado', headers: host == null ? {} : { host } });
    // sin Host, el propio Node responde 400 (requireHostHeader); con uno ajeno, el planner responde 403
    assert.ok(host ? r.estado === 403 : [400, 403].includes(r.estado), `Host ${host} → ${r.estado}`);
  }
  for (const host of [`localhost:${P}`, `127.0.0.1:${P}`]) assert.equal((await cruda({ path: '/api/salud', headers: { host } })).estado, 200, host);
});

test('Origin en POST: solo el propio; sin cabeceras CORS en ninguna respuesta', async () => {
  for (const origin of ['null', `http://localhost:${P + 1}`, `https://localhost:${P}`, `http://127.0.0.1.evil.com:${P}`, 'http://evil.com', `http://localhost:${P}.evil.com`]) {
    const r = await cruda({ method: 'POST', path: '/api/op', headers: { ...JSON_(), origin }, body: JSON.stringify({ op: 'ajustes.cambiar', hoy: HOY, args: { clave: 'foco_max', valor: 5 } }) });
    assert.equal(r.estado, 403, origin);
  }
  const respuestas = [
    await cruda({ method: 'OPTIONS', path: '/api/op', headers: { host: `127.0.0.1:${P}`, origin: 'http://evil.com', 'access-control-request-method': 'POST' } }),
    await cruda({ path: '/api/estado', headers: { host: `127.0.0.1:${P}`, origin: 'http://evil.com' } }),
    await cruda({ path: '/', headers: { host: `127.0.0.1:${P}` } }),
  ];
  for (const r of respuestas) {
    assert.ok(!Object.keys(r.cabeceras).some((k) => k.startsWith('access-control-')), 'sin CORS');
    assert.equal(r.cabeceras['x-frame-options'], 'DENY');
  }
  assert.ok(!(await import('node:fs')).readFileSync(`${c.dir}/ajustes.md`, 'utf8').includes('foco_max: 5'));
});

test('rutas: nada fuera de web/ y src/core/ (codificadas, barras invertidas, nulos, absolutas)', async () => {
  const fuera = ['/..%2fpackage.json', '/%2e%2e/package.json', '/%2e%2e%2f%2e%2e%2fpackage.json', '/..%5c..%5cpackage.json', '/%2e%2e%5cpackage.json',
    '//etc/passwd', '/%2fetc%2fpasswd', '/core/%2e%2e/server/store.js', '/core/..%2f..%2fpackage.json', '/core/%2e%2e%5cserver%5cstore.js',
    '/%00', '/index.html%00.js', '/core/', '/.%2e/package.json', '/%252e%252e/package.json', '/core/../../package.json', '/web/index.html',
    '/core/%2e%2e/%2e%2e/.git/config', '/%E0%A4%A', '/core/formato/%2e%2e/%2e%2e/%2e%2e/bin/planner.js'];
  for (const path of fuera) {
    const r = await cruda({ path });
    assert.ok([400, 404].includes(r.estado), `${path} → ${r.estado}`);
    assert.ok(!r.datos.includes('"name": "planner"') && !r.datos.includes('crearStore'), path);
  }
  assert.equal((await cruda({ path: '/core/formato/index.js' })).estado, 200);
  assert.equal((await cruda({ path: '/index.html' })).estado, 200);
});

test('no responde por la IP de la red local, solo por 127.0.0.1', async (t) => {
  const { networkInterfaces } = await import('node:os');
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
  if (!ips.length) { t.skip('sin interfaz de red'); return; }
  for (const ip of ips) {
    await assert.rejects(cruda({ host: ip, path: '/api/salud', headers: { host: `127.0.0.1:${P}` } }), (e) => e.code === 'ECONNREFUSED', ip);
  }
});

test('parámetros raros en la consulta: nunca un 500', async () => {
  const rutas = ['/api/estado?semana=../../x&hoy=9999-99-99&ahora=abc', '/api/estado?semana=2026-W99&ahora=-5', '/api/estado?hoy=2026-02-30&semana=__proto__',
    '/api/semanas?desde=x&hasta=y', '/api/semanas?desde=2026-W50&hasta=2026-W40', '/api/semanas?desde=2000-W01&hasta=2100-W52', '/api/cierre?semana=2026-W99',
    '/api/cierre', '/api/cierre?semana=1999-W01', '/api/version?hoy=nada', `/api/estado?${'a=1&'.repeat(2000)}`];
  for (const path of rutas) {
    const r = await cruda({ path });
    assert.ok(r.estado < 500, `${path.slice(0, 80)} → ${r.estado} ${r.datos.slice(0, 120)}`);
  }
});

test('cada ruta de la API: caso feliz, método incorrecto y, en las POST, JSON roto, cuerpo grande, op desconocida y versión antigua', async () => {
  const G = (path) => cruda({ path });
  const P_ = (path, body) => cruda({ method: 'POST', path, headers: JSON_(), body: typeof body === 'string' ? body : JSON.stringify(body) });
  const felices = {
    '/api/salud': (j) => j.app === 'planner',
    [`/api/version?hoy=${HOY}`]: (j) => /^[0-9a-f]{12}$/.test(j.version),
    [`/api/estado?hoy=${HOY}`]: (j) => j.meta.semanaActual === '2026-W45',
    [`/api/semanas?hoy=${HOY}`]: (j) => j.semanas.length > 5,
    [`/api/cierre?semana=2026-W44&hoy=${HOY}`]: (j) => j && typeof j === 'object',
  };
  for (const [path, ok] of Object.entries(felices)) {
    const r = await G(path);
    assert.equal(r.estado, 200, path);
    assert.ok(ok(JSON.parse(r.datos)), path);
    assert.equal((await P_(path.split('?')[0], {})).estado, 405, `POST ${path}`);
  }
  const e = JSON.parse((await G(`/api/estado?hoy=${HOY}`)).datos);
  const op = { op: 'tarea.crear', hoy: HOY, versiones: e.versiones, args: { seccion: 'mas', tarea: { texto: 'feliz' } } };
  const feliz = await P_('/api/op', op);
  assert.equal(feliz.estado, 200);
  assert.equal((await P_('/api/op', op)).estado, 409, 'misma versión otra vez: ya es antigua');
  assert.equal((await P_('/api/deshacer', { inversaId: JSON.parse(feliz.datos).inversaId, hoy: HOY })).estado, 200);
  assert.equal((await P_('/api/deshacer', { inversaId: 'no-existe', hoy: HOY })).estado, 410);
  for (const path of ['/api/op', '/api/deshacer']) {
    assert.equal((await P_(path, '{"op":')).estado, 400, `${path} JSON roto`);
    assert.equal((await P_(path, { relleno: 'x'.repeat(300 * 1024) })).estado, 413, `${path} > 256 KB`);
    assert.equal((await G(path)).estado, 405, `GET ${path}`);
  }
  assert.equal((await P_('/api/op', { op: 'no.existe', hoy: HOY })).estado, 422);
  assert.equal((await G('/api/no-existe')).estado, 404);
});

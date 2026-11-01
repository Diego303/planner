import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { arrancar } from '../src/server/index.js';
import { EJEMPLO } from './ayudas.js';
import * as m from '../src/core/modelo.js';
import { fechaDe } from '../src/core/fechas.js';

const HOY = '2026-11-02';
let app, dir, base;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'planner-test-'));
  cpSync(EJEMPLO, dir, { recursive: true });
  app = await arrancar({ datos: dir, puerto: 0, hoySimulado: HOY });
  base = `http://127.0.0.1:${app.puerto}`;
});
after(async () => { await app.cerrar(); rmSync(dir, { recursive: true, force: true }); });

const get = async (ruta) => { const r = await fetch(base + ruta); return { estado: r.status, json: await r.json() }; };
async function post(ruta, cuerpo, cabeceras = {}) {
  const r = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabeceras }, body: JSON.stringify(cuerpo) });
  return { estado: r.status, json: await r.json() };
}
const leer = (r) => readFileSync(join(dir, r), 'utf8');

/** Petición cruda (para poder mandar un Host falso). */
function cruda({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((ok, mal) => {
    const req = request({ host: '127.0.0.1', port: app.puerto, method, path, headers }, (res) => {
      let datos = '';
      res.on('data', (d) => { datos += d; });
      res.on('end', () => ok({ estado: res.statusCode, datos, cabeceras: res.headers }));
    });
    req.on('error', mal);
    if (body) req.write(body);
    req.end();
  });
}

test('GET /api/estado: ficheros, versiones y meta', async () => {
  const { estado, json } = await get(`/api/estado?hoy=${HOY}`);
  assert.equal(estado, 200);
  assert.equal(json.meta.semanaActual, '2026-W45');
  assert.deepEqual(json.meta.pendientes, ['2026-W44']);
  assert.ok(json.ficheros['semanas/2026-W45.md']);
  assert.equal(json.ficheros['semanas/2026-W46.md'], null);
  assert.equal(typeof json.versiones['tareas.md'], 'string');
  assert.equal(json.meta.inbox, 2);
  assert.equal(json.meta.semanas.find((s) => s.id === '2026-W43').estado, 'cerrada');
  assert.equal(json.meta.semanas.find((s) => s.id === '2026-W46').estado, 'sin planificar');
});

test('la página sale con el tema inyectado y cabeceras de seguridad; /core/ sirve el núcleo', async () => {
  const r = await cruda({ path: '/', headers: { host: `localhost:${app.puerto}` } });
  assert.equal(r.estado, 200);
  assert.match(r.datos, /<html lang="es" data-tema="nordico-claro"/);
  assert.match(r.cabeceras['content-security-policy'], /script-src 'self'/);
  assert.equal(r.cabeceras['x-content-type-options'], 'nosniff');
  const core = await fetch(`${base}/core/fechas.js`);
  assert.equal(core.status, 200);
  assert.match(core.headers.get('content-type'), /javascript/);
});

test('seguridad: Host ajeno, Origin ajeno, sin JSON, cuerpo grande y rutas fuera', async () => {
  assert.equal((await cruda({ path: '/api/estado', headers: { host: 'evil.example:80' } })).estado, 403);
  assert.equal((await cruda({ path: '/', headers: { host: `attacker.com:${app.puerto}` } })).estado, 403);
  const op = JSON.stringify({ op: 'ajustes.cambiar', args: { clave: 'capacidad', valor: 75 } });
  assert.equal((await cruda({ method: 'POST', path: '/api/op', headers: { host: `127.0.0.1:${app.puerto}`, origin: 'http://evil.example', 'content-type': 'application/json' }, body: op })).estado, 403);
  assert.equal((await cruda({ method: 'POST', path: '/api/op', headers: { host: `127.0.0.1:${app.puerto}`, 'content-type': 'text/plain' }, body: op })).estado, 415);
  const grande = JSON.stringify({ op: 'x', relleno: 'a'.repeat(300 * 1024) });
  const r = await cruda({ method: 'POST', path: '/api/op', headers: { host: `127.0.0.1:${app.puerto}`, 'content-type': 'application/json' }, body: grande }).catch(() => ({ estado: 413 }));
  assert.equal(r.estado, 413);
  for (const ruta of ['/%2e%2e/package.json', '/core/%2e%2e/server/store.js', '/..%2fpackage.json', '/core/..%2f..%2fpackage.json']) {
    assert.equal((await cruda({ path: ruta, headers: { host: `127.0.0.1:${app.puerto}` } })).estado, 404, ruta);
  }
  assert.ok(!readFileSync(join(dir, 'ajustes.md'), 'utf8').includes('capacidad: 75'));
});

test('POST /api/op escribe de forma atómica, cambia la versión y hace la copia del día', async () => {
  const antes = await get(`/api/estado?hoy=${HOY}`);
  const v0 = (await get(`/api/version?hoy=${HOY}`)).json.version;
  const r = await post('/api/op', {
    op: 'bloque.crear', hoy: HOY, semana: '2026-W45', versiones: antes.json.versiones,
    args: { semana: '2026-W45', bloque: { dia: 2, inicio: 1260, fin: 1320, tipo: 'personal', titulo: 'Llamar a casa' } },
  });
  assert.equal(r.estado, 200, JSON.stringify(r.json));
  assert.ok(r.json.inversaId);
  assert.deepEqual(r.json.cambiados, ['semanas/2026-W45.md']);
  assert.match(leer('semanas/2026-W45.md'), /^- X 21:00-22:00 \| personal \| Llamar a casa$/m);
  assert.ok(m.bloquesDe(r.json.estado.ficheros['semanas/2026-W45.md']).some((b) => b.titulo === 'Llamar a casa'));
  assert.notEqual(r.json.estado.versiones['semanas/2026-W45.md'], antes.json.versiones['semanas/2026-W45.md']);
  assert.notEqual((await get(`/api/version?hoy=${HOY}`)).json.version, v0);
  assert.ok(!readdirSync(join(dir, 'semanas')).some((n) => n.includes('.tmp-')), 'sin temporales');
  assert.ok(existsSync(join(dir, '.copias', fechaDe(new Date()), 'semanas', '2026-W45.md')), 'copia del día');
  assert.ok(!existsSync(join(dir, '.copias', fechaDe(new Date()), '.copias')));
});

test('409 si el fichero cambió fuera del planner', async () => {
  const e = (await get(`/api/estado?hoy=${HOY}`)).json;
  writeFileSync(join(dir, 'tareas.md'), leer('tareas.md') + '- [ ] añadida a mano\n');
  const t = m.tareasDe(e.ficheros['tareas.md']).hoy[0];
  const r = await post('/api/op', { op: 'tarea.marcar', hoy: HOY, versiones: e.versiones, args: { id: t.id, hecha: true } });
  assert.equal(r.estado, 409);
  assert.equal(r.json.ruta, 'tareas.md');
  assert.match(r.json.error, /fuera del planner/);
  assert.ok(leer('tareas.md').endsWith('- [ ] añadida a mano\n'));
});

test('422 con mensaje claro si la operación no es válida', async () => {
  const r = await post('/api/op', { op: 'tipo.eliminar', hoy: HOY, args: { nombre: 'estudio' } });
  assert.equal(r.estado, 422);
  assert.match(r.json.error, /en uso/);
  assert.equal((await post('/api/op', { op: 'no.existe', hoy: HOY, args: {} })).estado, 422);
});

test('deshacer restaura los bytes; si el fichero cambió después, 409', async () => {
  const e = (await get(`/api/estado?hoy=${HOY}`)).json;
  const original = leer('semanas/2026-W45.md');
  const b = m.bloquesDe(e.ficheros['semanas/2026-W45.md']).find((x) => x.titulo === 'Deploy del pipeline');
  const r = await post('/api/op', { op: 'bloque.eliminar', hoy: HOY, versiones: e.versiones, args: { semana: '2026-W45', id: b.id } });
  assert.equal(r.estado, 200);
  assert.ok(!leer('semanas/2026-W45.md').includes('Deploy del pipeline'));
  const d = await post('/api/deshacer', { inversaId: r.json.inversaId, hoy: HOY });
  assert.equal(d.estado, 200, JSON.stringify(d.json));
  assert.equal(leer('semanas/2026-W45.md'), original);
  assert.equal((await post('/api/deshacer', { inversaId: r.json.inversaId, hoy: HOY })).estado, 410);

  const r2 = await post('/api/op', { op: 'ajustes.cambiar', hoy: HOY, args: { clave: 'foco_max', valor: 4 } });
  writeFileSync(join(dir, 'ajustes.md'), leer('ajustes.md') + '- nota a mano\n');
  const d2 = await post('/api/deshacer', { inversaId: r2.json.inversaId, hoy: HOY });
  assert.equal(d2.estado, 409);
  assert.match(leer('ajustes.md'), /foco_max: 4/);
});

test('GET /api/semanas lista con estados', async () => {
  const { json } = await get(`/api/semanas?desde=2026-W42&hasta=2026-W46&hoy=${HOY}`);
  assert.deepEqual(json.semanas.map((s) => `${s.id}:${s.estado}`),
    ['2026-W42:cerrada', '2026-W43:cerrada', '2026-W44:sin cerrar', '2026-W45:en curso', '2026-W46:sin planificar']);
});

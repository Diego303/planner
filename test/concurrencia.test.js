// Q3 · Concurrencia: muchas operaciones a la vez, dos pestañas y ediciones de fuera mientras el planner escribe.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { arrancar } from '../src/server/index.js';
import { parsear } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { copiaEjemplo } from './ayudas.js';
import { crearAzar } from './azar.js';

const HOY = '2026-11-02';
let app, c, base;
before(async () => { c = copiaEjemplo(); app = await arrancar({ datos: c.dir, puerto: 0, hoySimulado: HOY }); base = `http://127.0.0.1:${app.puerto}`; });
after(async () => { await app.cerrar(); c.borrar(); });

const post = async (ruta, cuerpo) => {
  const r = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  return { estado: r.status, json: await r.json() };
};
const estado = async () => (await fetch(`${base}/api/estado?hoy=${HOY}`)).json();
const leer = (r) => readFileSync(join(c.dir, r), 'utf8');
const textos = () => Object.values(m.tareasDe(parsear('tareas.md', leer('tareas.md')))).flat().map((t) => t.texto);

test('50 operaciones a la vez: todas se aplican, en orden y sin perder ninguna', async () => {
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => post('/api/op', { op: 'tarea.crear', hoy: HOY, args: { seccion: 'mas', tarea: { texto: `paralela ${i}` } } })));
  assert.deepEqual(rs.map((r) => r.estado), Array(50).fill(200));
  const t = textos();
  for (let i = 0; i < 50; i++) assert.equal(t.filter((x) => x === `paralela ${i}`).length, 1, `paralela ${i}`);
  // Deshacer: el servidor guarda las 20 últimas (plan §5) y cada una exige que el fichero no haya cambiado
  // después. Fuera de orden: 409 sin tocar nada (y esa ya no vale). En orden inverso, como el toast: todas.
  const ids = rs.map((r) => r.json.inversaId);
  assert.equal((await post('/api/deshacer', { inversaId: ids[30], hoy: HOY })).estado, 409);
  for (let i = 49; i > 30; i--) assert.equal((await post('/api/deshacer', { inversaId: ids[i], hoy: HOY })).estado, 200, `deshacer ${i}`);
  assert.equal((await post('/api/deshacer', { inversaId: ids[30], hoy: HOY })).estado, 410, 'la que falló ya no vale');
  assert.equal((await post('/api/deshacer', { inversaId: ids[10], hoy: HOY })).estado, 410, 'más allá de las 20 últimas');
  assert.deepEqual(textos().filter((x) => x.startsWith('paralela')), Array.from({ length: 31 }, (_, i) => `paralela ${i}`));
});

test('dos pestañas con la misma versión: la primera guarda y la segunda recibe 409 sin pisarla', async () => {
  const e = await estado();
  const [a, b] = await Promise.all([
    post('/api/op', { op: 'tarea.crear', hoy: HOY, versiones: e.versiones, args: { seccion: 'mas', tarea: { texto: 'pestaña A' } } }),
    post('/api/op', { op: 'tarea.crear', hoy: HOY, versiones: e.versiones, args: { seccion: 'mas', tarea: { texto: 'pestaña B' } } }),
  ]);
  assert.deepEqual([a.estado, b.estado].sort(), [200, 409]);
  const t = textos();
  assert.equal(t.filter((x) => x.startsWith('pestaña ')).length, 1);
  // la que recibió 409 recarga y repite: ahora sí
  const perdedora = a.estado === 409 ? 'pestaña A' : 'pestaña B';
  const e2 = await estado();
  assert.equal((await post('/api/op', { op: 'tarea.crear', hoy: HOY, versiones: e2.versiones, args: { seccion: 'mas', tarea: { texto: perdedora } } })).estado, 200);
  assert.ok(textos().includes('pestaña A') && textos().includes('pestaña B'));
});

test('ediciones de fuera mientras el planner escribe: ninguna se pierde', async () => {
  const azar = crearAzar();
  let externas = 0, conflictos = 0;
  const hechas = [];
  for (let i = 0; i < 60; i++) {
    const e = await estado();
    const op = post('/api/op', { op: 'tarea.crear', hoy: HOY, versiones: e.versiones, args: { seccion: 'mas', tarea: { texto: `planner ${i}` } } });
    // a veces el «editor» guarda justo durante la operación (como Obsidian: escribe un temporal y lo renombra)
    if (azar.bool(0.6)) {
      await new Promise((r) => setTimeout(r, azar.entero(0, 6)));
      const tmp = join(c.dir, '.editor.tmp');
      writeFileSync(tmp, `${leer('tareas.md')}- [ ] externa ${i}\n`);
      renameSync(tmp, join(c.dir, 'tareas.md'));
      externas++;
      hechas.push(i);
    }
    const r = await op;
    assert.ok([200, 409].includes(r.estado), JSON.stringify(r.json));
    if (r.estado === 409) conflictos++;
  }
  const t = textos();
  for (const i of hechas) assert.ok(t.includes(`externa ${i}`), `se perdió «externa ${i}»`);
  assert.equal(t.filter((x) => x.startsWith('externa ')).length, externas, 'todas las ediciones de fuera siguen ahí');
  assert.ok(conflictos > 0, 'alguna vez coincidieron (409)');
});

// R4 · Entre los `rename` de una operación de varios ficheros: si uno falla se deshacen los anteriores,
// y si el proceso muere entre dos, lo que se mueve queda repetido, nunca perdido.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

let limpiar = [];
afterEach(() => { mock.restoreAll(); syncBuiltinESMExports(); limpiar.forEach((f) => f()); limpiar = []; });

const leer = (dir, r) => (existsSync(join(dir, r)) ? readFileSync(join(dir, r), 'utf8') : null);
const RUTAS = ['tareas.md', 'diario/2026-11-03.md', 'archivo/tareas-2026-11.md'];

/** Ayer se marcó «Revisar PR»: cerrar hoy el día escribe el diario, quita la tarea de tareas.md y la archiva. */
async function preparar() {
  const c = copiaEjemplo();
  limpiar.push(c.borrar);
  const p = apiDirecta(c.dir);
  const e = await p.estado({ hoy: '2026-11-02' });
  const t = m.tareasDe(e.ficheros['tareas.md']).hoy.find((x) => x.texto.includes('Revisar PR'));
  await p.op({ op: 'tarea.marcar', hoy: '2026-11-02', args: { id: t.id, hecha: true } });
  return { ...p, dir: c.dir, antes: Object.fromEntries(RUTAS.map((r) => [r, leer(c.dir, r)])) };
}

/** Sustituye el `rename` n-ésimo (desde 1) por `fn`. */
function enRename(n, fn) {
  const original = fsp.rename;
  let llamadas = 0;
  mock.method(fsp, 'rename', (a, b) => (++llamadas === n ? fn(a, b) : original(a, b)));
  syncBuiltinESMExports();
}

const CIERRE = { op: 'dia.cerrar', hoy: '2026-11-03', args: { animo: 4, linea: 'x', manana: 'y' } };

test('si falla el segundo rename, el primero se deshace y nada cambia', async () => {
  const p = await preparar();
  enRename(2, async () => { throw Object.assign(new Error('EIO simulado'), { code: 'EIO' }); });
  await assert.rejects(p.op(CIERRE), (e) => e.estado === 500 && /No se ha guardado nada/.test(e.message));
  for (const r of RUTAS) assert.equal(leer(p.dir, r), p.antes[r], r);
  mock.restoreAll();
  syncBuiltinESMExports();
  await p.op(CIERRE);
  assert.match(leer(p.dir, 'archivo/tareas-2026-11.md'), /Revisar PR/);
});

test('si el proceso muere entre dos rename, ninguna tarea se pierde', async () => {
  for (const n of [2, 3]) {
    const p = await preparar();
    enRename(n, () => new Promise(() => {})); // el proceso «muere»: este rename y los siguientes no llegan
    p.op(CIERRE).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const esta = (leer(p.dir, 'tareas.md') ?? '').includes('Revisar PR') || (leer(p.dir, 'archivo/tareas-2026-11.md') ?? '').includes('Revisar PR');
    assert.ok(esta, `muerte antes del rename ${n}: «Revisar PR» no está ni en tareas.md ni en el archivo`);
    mock.restoreAll();
    syncBuiltinESMExports();
  }
});

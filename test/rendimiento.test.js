// Q6 · Con tres años de datos, cada petición toca pocos ficheros: en /mnt/d cada stat cuesta ~4 ms.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generar } from './rendimiento/generar.js';
import { crearStore } from '../src/server/store.js';
import { crearApi } from '../src/server/api.js';
import { crearDeshacer } from '../src/server/deshacer.js';
import { SIN_COPIAS } from './ayudas.js';

const dir = mkdtempSync(join(tmpdir(), 'planner-3años-'));
after(() => rmSync(dir, { recursive: true, force: true }));
generar(dir);

function contarStat() {
  const original = fsp.stat;
  const c = { n: 0 };
  fsp.stat = (...a) => { c.n++; return original(...a); };
  syncBuiltinESMExports();
  return { c, fin() { fsp.stat = original; syncBuiltinESMExports(); } };
}

test('tres años de datos: estado, sondeo y operaciones hacen pocos stat (y siguen viendo los cambios cercanos)', async () => {
  const store = crearStore(dir);
  const api = crearApi({ store, copias: SIN_COPIAS, deshacer: crearDeshacer(), hoySimulado: '2026-11-02' });
  const q = new URLSearchParams({ hoy: '2026-11-02' });
  await api.rutas['GET /api/estado'](q); // en frío lo lee todo
  const s = contarStat();
  try {
    await api.rutas['GET /api/estado'](q);
    const estado = s.c.n; s.c.n = 0;
    await api.rutas['GET /api/version'](q);
    const version = s.c.n; s.c.n = 0;
    await api.rutas['POST /api/op'](q, { op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'x' } } });
    const op = s.c.n;
    assert.ok(estado <= 120, `estado: ${estado} stat`);
    assert.ok(version <= 60, `versión: ${version} stat`);
    assert.ok(op <= 200, `operación: ${op} stat`);
  } finally { s.fin(); }
  // una semana cercana editada a mano se ve al momento
  writeFileSync(join(dir, 'semanas', '2026-W44.md'), `${(await fsp.readFile(join(dir, 'semanas', '2026-W44.md'), 'utf8'))}`.replace('## Bloques\n', '## Bloques\n- S 16:00-17:00 | personal | editado a mano\n'));
  const e = await api.rutas['GET /api/estado'](new URLSearchParams({ hoy: '2026-11-02', semana: '2026-W44' }));
  assert.ok(JSON.stringify(e.ficheros['semanas/2026-W44.md']).includes('editado a mano'));
});

// R1 · Una operación que toca varios ficheros se escribe entera o no se escribe.
import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

let limpiar = [];
afterEach(() => { mock.restoreAll(); syncBuiltinESMExports(); limpiar.forEach((f) => f()); limpiar = []; });

const leer = (dir, r) => (existsSync(join(dir, r)) ? readFileSync(join(dir, r), 'utf8') : null);
export const temporales = (dir) => ['', 'semanas', 'diario', 'archivo']
  .flatMap((d) => (existsSync(join(dir, d)) ? readdirSync(join(dir, d)) : [])).filter((n) => n.includes('.tmp-'));

/** Hace fallar con `codigo` la apertura del temporal de los ficheros cuyo nombre contenga `trozo`. */
function fallarAlAbrir(trozo, codigo) {
  const original = fsp.open;
  mock.method(fsp, 'open', async (ruta, ...resto) => {
    if (String(ruta).includes(trozo)) throw Object.assign(new Error(`${codigo}: fallo simulado`), { code: codigo });
    return original(ruta, ...resto);
  });
  syncBuiltinESMExports();
}

async function preparar() {
  const c = copiaEjemplo();
  limpiar.push(c.borrar);
  const p = apiDirecta(c.dir);
  // ayer se marcó una tarea: al cerrar hoy el día se archiva en archivo/tareas-2026-11.md
  const e = await p.estado({ hoy: '2026-11-02' });
  const t = m.tareasDe(e.ficheros['tareas.md']).hoy[0];
  await p.op({ op: 'tarea.marcar', hoy: '2026-11-02', args: { id: t.id, hecha: true } });
  return { ...p, dir: c.dir };
}

test('disco lleno al escribir el archivo mensual: no se escribe nada (ni tareas.md ni el diario)', async () => {
  const p = await preparar();
  const antes = leer(p.dir, 'tareas.md');
  fallarAlAbrir('tareas-2026-11.md', 'ENOSPC');
  await assert.rejects(p.op({ op: 'dia.cerrar', hoy: '2026-11-03', args: { animo: 4, linea: 'x', manana: 'y' } }), (err) => {
    assert.equal(err.estado, 507);
    assert.match(err.message, /espacio/);
    assert.match(err.message, /no se ha guardado nada/i);
    return true;
  });
  assert.equal(leer(p.dir, 'tareas.md'), antes);
  assert.equal(leer(p.dir, 'diario/2026-11-03.md'), null);
  assert.equal(leer(p.dir, 'archivo/tareas-2026-11.md'), null);
  assert.deepEqual(temporales(p.dir), []);
  // y cuando hay sitio, la misma operación funciona
  mock.restoreAll();
  syncBuiltinESMExports();
  await p.op({ op: 'dia.cerrar', hoy: '2026-11-03', args: { animo: 4, linea: 'x', manana: 'y' } });
  assert.match(leer(p.dir, 'archivo/tareas-2026-11.md'), /Revisar PR/);
  assert.ok(!leer(p.dir, 'tareas.md').includes('Revisar PR'));
});

test('sin permiso para escribir: error claro sin rutas internas y nada cambia', async () => {
  const p = await preparar();
  const antes = leer(p.dir, 'tareas.md');
  fallarAlAbrir('tareas.md', 'EACCES');
  await assert.rejects(p.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'algo' } } }), (err) => {
    assert.equal(err.estado, 500);
    assert.match(err.message, /No se pudo guardar tareas\.md/);
    assert.ok(!err.message.includes(p.dir), 'sin rutas absolutas');
    return true;
  });
  assert.equal(leer(p.dir, 'tareas.md'), antes);
  assert.deepEqual(temporales(p.dir), []);
});

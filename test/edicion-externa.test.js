// R2 · Una edición externa entre la lectura y la escritura se detecta: 409 y el cambio externo se conserva.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

test('el hueco de la copia de seguridad: lo que escribe Obsidian ahí no se pierde', async () => {
  const { dir, borrar } = copiaEjemplo();
  try {
    const editado = `${readFileSync(join(dir, 'tareas.md'), 'utf8')}- [ ] escrita en Obsidian mientras guardabas\n`;
    const copias = { antesDeEscribir() { writeFileSync(join(dir, 'tareas.md'), editado); }, async despuesDeEscribir() {} };
    const p = apiDirecta(dir, { copias });
    await assert.rejects(p.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'Comprar pilas' } } }), (err) => {
      assert.equal(err.estado, 409);
      assert.equal(err.extra.ruta, 'tareas.md');
      return true;
    });
    assert.equal(readFileSync(join(dir, 'tareas.md'), 'utf8'), editado);
    // tras recargar, la operación ya se aplica sobre el fichero editado
    const p2 = apiDirecta(dir);
    await p2.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'Comprar pilas' } } });
    const final = readFileSync(join(dir, 'tareas.md'), 'utf8');
    assert.match(final, /escrita en Obsidian/);
    assert.match(final, /Comprar pilas/);
  } finally { borrar(); }
});

test('el hueco entre comprobar el disco y renombrar: lo que se guarda justo ahí tampoco se pierde', async () => {
  for (const [ruta, op] of [
    ['tareas.md', { op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'Comprar pilas' } } }],
    ['diario/2026-11-02.md', { op: 'dia.cerrar', hoy: '2026-11-02', args: { animo: 4 } }], // fichero que aún no existía
  ]) {
    const { dir, borrar } = copiaEjemplo();
    try {
      const abs = join(dir, ruta);
      const externo = ruta === 'tareas.md' ? `${readFileSync(abs, 'utf8')}- [ ] guardada en el peor momento\n` : '# Diario\n\n- linea: escrita a mano\n';
      // El editor guarda (temporal + rename, como Obsidian) justo después de que el planner compruebe el fichero.
      const original = fsp.readFile;
      let armado = false;
      mock.method(fsp, 'readFile', async (r, ...resto) => {
        const toca = armado && String(r) === abs;
        const out = await original(r, ...resto).catch((e) => { if (toca) return e; throw e; });
        if (toca) {
          armado = false;
          writeFileSync(`${abs}.editor`, externo);
          renameSync(`${abs}.editor`, abs);
        }
        if (out instanceof Error) throw out;
        return out;
      });
      syncBuiltinESMExports();
      const p = apiDirecta(dir);
      await p.estado({ hoy: '2026-11-02' }); // lo que se lee para pintar ya está en caché
      armado = true; // la siguiente lectura de ese fichero es la comprobación de justo antes de renombrar
      await assert.rejects(p.op(op), (err) => err.estado === 409 && err.extra.ruta === ruta, ruta);
      assert.equal(readFileSync(abs, 'utf8'), externo, `${ruta}: se conserva lo guardado fuera`);
    } finally { mock.restoreAll(); syncBuiltinESMExports(); borrar(); }
  }
});

// R2 · Una edición externa entre la lectura y la escritura se detecta: 409 y el cambio externo se conserva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
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

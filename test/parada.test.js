// Q4 · Parar el servidor (Ctrl+C, planner stop) con una escritura en marcha: se espera a que termine.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arrancar } from '../src/server/index.js';
import { copiaEjemplo } from './ayudas.js';

test('cerrar() espera a la operación que se está guardando y no acepta otras', async () => {
  const c = copiaEjemplo();
  const app = await arrancar({ datos: c.dir, puerto: 0, hoySimulado: '2026-11-02' });
  try {
    // el disco va lento: cada temporal tarda 300 ms en abrirse
    const original = fsp.open;
    mock.method(fsp, 'open', async (...a) => { await new Promise((r) => setTimeout(r, 300)); return original(...a); });
    syncBuiltinESMExports();
    const op = fetch(`http://127.0.0.1:${app.puerto}/api/op`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'guardada antes de parar' } } }),
    }).then((r) => r.status, () => 'cortada');
    await new Promise((r) => setTimeout(r, 100)); // la operación ya está escribiendo
    const parada = app.cerrar();
    // mientras se para, lo que llegue (aunque sea por una conexión abierta) recibe 503
    const tarde = await fetch(`http://127.0.0.1:${app.puerto}/api/salud`).then((r) => r.status, () => 'rechazada');
    assert.ok([503, 'rechazada'].includes(tarde), String(tarde));
    await parada;
    assert.match(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), /guardada antes de parar/, 'al terminar cerrar() la escritura ya está en disco');
    assert.equal(await op, 200, 'y el cliente recibió su respuesta');
    await assert.rejects(fetch(`http://127.0.0.1:${app.puerto}/api/salud`), 'ya no acepta peticiones');
  } finally { mock.restoreAll(); syncBuiltinESMExports(); c.borrar(); }
});

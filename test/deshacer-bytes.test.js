// Q3 · Deshacer desde el servidor devuelve los ficheros byte a byte, también en líneas cambiadas con formato
// propio (comentarios alineados, espacios de más): entre la operación y el deshacer el servidor relee el disco.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

const HOY = '2026-11-02';
const limpiar = [];
after(() => limpiar.forEach((f) => f()));

test('deshacer devuelve los bytes exactos de las líneas cambiadas', async () => {
  const c = copiaEjemplo();
  limpiar.push(c.borrar);
  // una tarea escrita a mano con espacios de más
  const rutaT = join(c.dir, 'tareas.md');
  writeFileSync(rutaT, readFileSync(rutaT, 'utf8').replace('- [ ] Llamar al gestor | personal', '-  [ ]  Llamar al gestor  |   personal'));
  const p = apiDirecta(c.dir, { hoySimulado: HOY });
  const e = await p.estado({ hoy: HOY });
  const tarea = m.tareasDe(e.ficheros['tareas.md']).hoy.find((t) => t.texto === 'Llamar al gestor');
  assert.ok(tarea, 'la tarea a mano se reconoce');
  const tema = m.temasEstudio(e.ficheros['estudio.md']).find((t) => t.total != null);
  const casos = [
    ['ajustes.md', { op: 'ajustes.cambiar', args: { clave: 'foco_max', valor: 4 } }],
    ['tipos.md', { op: 'tipo.color', args: { nombre: 'trabajo', color: '#112233' } }],
    ['estudio.md', { op: 'estudio.cambiar', args: { id: tema.id, clave: 'total', valor: 60 } }],
    ['tareas.md', { op: 'tarea.marcar', args: { id: tarea.id, hecha: true } }],
    ['tareas.md', { op: 'tarea.editar', args: { id: tarea.id, cambios: { prioridad: true } } }],
  ];
  for (const [ruta, cuerpo] of casos) {
    const antes = readFileSync(join(c.dir, ruta), 'utf8');
    const r = await p.op({ ...cuerpo, hoy: HOY });
    assert.notEqual(readFileSync(join(c.dir, ruta), 'utf8'), antes, `${cuerpo.op} cambia ${ruta}`);
    await p.deshacer({ inversaId: r.inversaId, hoy: HOY });
    assert.equal(readFileSync(join(c.dir, ruta), 'utf8'), antes, `${cuerpo.op}: deshacer deja ${ruta} como estaba`);
  }
});

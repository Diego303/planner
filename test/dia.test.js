import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar } from '../src/core/ops.js';
import { serializar } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const CTX = { hoy: '2026-11-03', ahora: 22 * 60 };

function mundo() {
  const mu = mundoEjemplo();
  for (const r of ['diario/2026-11-03.md', 'archivo/tareas-2026-11.md', 'archivo/tareas-2026-10.md']) mu.ficheros[r] ??= null;
  return mu;
}

test('cerrar el día: diario, aplazar, fecha a las marcadas a mano y archivo de las de ayer', () => {
  let mu = mundo();
  const t = m.tareasDe(mu.ficheros['tareas.md']);
  // ayer (2026-11-02) se marcó «Revisar PR»; «Leer» se marcó a mano sin fecha
  mu = aplicar(mu, { op: 'tarea.marcar', args: { id: t.hoy[0].id, hecha: true } }, { hoy: '2026-11-02' }).mundo;
  const leer = m.tareasDe(mu.ficheros['tareas.md']).hoy[1];
  mu = aplicar(mu, { op: 'linea.cambiar', args: { ruta: 'tareas.md', indice: leer.id, cambios: { hecha: true } } }, CTX).mundo;
  const llamar = m.tareasDe(mu.ficheros['tareas.md']).hoy.find((x) => x.texto === 'Llamar al gestor');
  const r = aplicar(mu, { op: 'dia.cerrar', args: {
    animo: 4, linea: 'Día tranquilo | buen ritmo', avanzado: ['AI-102 · visión', 'Leer; chunking'], manana: 'Curso: abrir el notebook',
    aplazar: [{ id: llamar.id, huella: m.huellaDe(llamar) }],
  } }, CTX);
  assert.equal(serializar(r.mundo.ficheros['diario/2026-11-03.md']),
    '- ánimo: 4\n- línea: Día tranquilo / buen ritmo\n- avanzado: AI-102 · visión; Leer, chunking\n- mañana: Curso: abrir el notebook\n');
  const tareas = m.tareasDe(r.mundo.ficheros['tareas.md']);
  assert.deepEqual(tareas.hoy.map((x) => x.texto), ['Leer: chunking y reranking', 'Reservar fisio']);
  assert.equal(tareas.hoy[0].fechaHecha, '2026-11-03'); // se archivará mañana
  assert.equal(tareas.mas.at(-1).texto, 'Llamar al gestor');
  const archivo = serializar(r.mundo.ficheros['archivo/tareas-2026-11.md']);
  assert.equal(archivo, '# Archivo de tareas · 2026-11\n\n- [x] Revisar PR del pipeline de evaluación | trabajo | prioridad | hecha: 2026-11-02\n');
  // la inversa lo deja todo como estaba
  const vuelta = aplicar(r.mundo, r.inversa, CTX).mundo;
  for (const ruta of r.tocados) assert.equal(vuelta.ficheros[ruta] && serializar(vuelta.ficheros[ruta]), mu.ficheros[ruta] && serializar(mu.ficheros[ruta]), ruta);
});

test('volver a cerrar el día actualiza el diario sin duplicar', () => {
  const mu = mundo();
  const a = aplicar(mu, { op: 'dia.cerrar', args: { animo: 3, linea: 'uno', manana: 'x' } }, CTX).mundo;
  const b = aplicar(a, { op: 'dia.cerrar', args: { animo: 5, linea: 'dos', manana: null } }, CTX).mundo;
  assert.equal(serializar(b.ficheros['diario/2026-11-03.md']), '- ánimo: 5\n- línea: dos\n');
});

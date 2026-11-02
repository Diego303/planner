// Operaciones para que nada quede «bloqueado»: renombrar tipos, temas y proyectos (en todo lo que los usa),
// quitar un tipo pasando sus usos a otro, duplicar bloques, quitar sugerencias, Hoy por encima del límite,
// inbox desde la web y diario de días anteriores. Cada una cambia lo que debe, nada más, y se deshace entera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { parsear, tipoDeRuta } from '../src/core/formato/index.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

const HOY = '2026-11-04';
const leer = (dir, r) => (existsSync(join(dir, r)) ? readFileSync(join(dir, r), 'utf8') : null);
function todo(dir) {
  const out = {};
  for (const d of ['', 'semanas', 'diario', 'archivo']) {
    if (!existsSync(join(dir, d))) continue;
    for (const n of readdirSync(join(dir, d))) { const r = d ? `${d}/${n}` : n; if (tipoDeRuta(r)) out[r] = leer(dir, r); }
  }
  return out;
}
const cambiados = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]).sort();

async function con(fn) {
  const c = copiaEjemplo();
  try { await fn({ dir: c.dir, p: apiDirecta(c.dir, { hoySimulado: HOY }) }); } finally { c.borrar(); }
}
const op = (p, o, args) => p.op({ op: o, hoy: HOY, args });
/** Aplica, comprueba qué ficheros cambiaron, deshace y comprueba que todo vuelve byte a byte. */
async function yDeshacer(dir, p, o, args, ficheros) {
  const antes = todo(dir);
  const r = await op(p, o, args);
  if (ficheros) assert.deepEqual(cambiados(antes, todo(dir)), ficheros, `${o}: ficheros cambiados`);
  return { r, deshacer: async () => { await p.deshacer({ inversaId: r.inversaId, hoy: HOY }); assert.deepEqual(cambiados(antes, todo(dir)), [], `${o}: deshacer lo devuelve todo`); } };
}

test('renombrar un tipo lo cambia en tipos.md, en los bloques de todas las semanas y en la plantilla; se deshace', () => con(async ({ dir, p }) => {
  const semanas = readdirSync(join(dir, 'semanas')).map((n) => `semanas/${n}`).filter((r) => /\| entreno \|/.test(leer(dir, r)));
  const { r, deshacer } = await yDeshacer(dir, p, 'tipo.renombrar', { nombre: 'entreno', nuevo: 'deporte' }, ['plantilla.md', ...semanas, 'tipos.md'].sort());
  assert.ok(r.resultado.usos > 20);
  assert.match(leer(dir, 'tipos.md'), /^- deporte \| #A04E33$/m);
  assert.ok(!Object.values(todo(dir)).some((t) => /\| entreno \|/.test(t)), 'no queda ningún «entreno»');
  assert.match(leer(dir, 'semanas/2026-W43.md'), /\| deporte \| Gimnasio/, 'también en las cerradas: un nombre es un nombre');
  await deshacer();
  await assert.rejects(op(p, 'tipo.renombrar', { nombre: 'entreno', nuevo: 'Personal' }), /Ya hay un tipo «personal»/);
  await assert.rejects(op(p, 'tipo.renombrar', { nombre: 'entreno', nuevo: 'prioridad' }), /no se puede usar/);
  await op(p, 'tipo.renombrar', { nombre: 'entreno', nuevo: 'Entreno' }); // solo mayúsculas: vale
  assert.match(leer(dir, 'tipos.md'), /^- Entreno \|/m);
}));

test('quitar un tipo en uso pasando sus bloques, plantilla y tareas a otro', () => con(async ({ dir, p }) => {
  await assert.rejects(op(p, 'tipo.eliminar', { nombre: 'personal' }), /en uso/);
  await assert.rejects(op(p, 'tipo.eliminar', { nombre: 'personal', pasarA: 'personal' }), /otro tipo/);
  const { deshacer } = await yDeshacer(dir, p, 'tipo.eliminar', { nombre: 'personal', pasarA: 'entreno' });
  assert.ok(!/^- personal \|/m.test(leer(dir, 'tipos.md')));
  assert.ok(!Object.values(todo(dir)).some((t) => /\| personal( \||$)/m.test(t)), 'ningún uso de «personal»');
  assert.match(leer(dir, 'tareas.md'), /- \[ \] Llamar al gestor \| entreno/);
  await deshacer();
}));

test('renombrar un tema de estudio o un proyecto cambia sus bloques, Las 3 y las horas de la semana', () => con(async ({ dir, p }) => {
  const ai = m.temasEstudio(parsear('estudio.md', leer(dir, 'estudio.md'))).find((t) => t.nombre === 'AI-102');
  const { r, deshacer } = await yDeshacer(dir, p, 'estudio.renombrar', { id: ai.id, nombre: 'AZ-104' });
  assert.ok(r.resultado.n > 5);
  assert.match(leer(dir, 'estudio.md'), /^## AZ-104$/m);
  assert.match(leer(dir, 'semanas/2026-W45.md'), /\| AZ-104 · visión \|/);
  assert.match(leer(dir, 'semanas/2026-W43.md'), /rel: AZ-104/);
  // ni títulos de bloque ni rel con el nombre viejo (el texto libre de un objetivo, «Estudiar AI-102 · visión», es tuyo: no se toca)
  assert.ok(!Object.values(todo(dir)).some((t) => /\| AI-102 ·|rel: AI-102/.test(t)));
  await deshacer();
  await assert.rejects(op(p, 'estudio.renombrar', { id: ai.id, nombre: 'curso' }), /Ya hay uno/);
  await assert.rejects(op(p, 'estudio.renombrar', { id: ai.id, nombre: 'A · B' }), /« · »/);
  const hu = m.proyectosDe(parsear('proyectos.md', leer(dir, 'proyectos.md'))).find((x) => x.nombre === 'huddle');
  await op(p, 'proyecto.renombrar', { id: hu.id, nombre: 'huddle app' });
  assert.match(leer(dir, 'proyectos.md'), /^## huddle app$/m);
  assert.match(leer(dir, 'semanas/2026-W43.md'), /\| huddle app · avanzar \|/);
  // pausar y volver a activar desde la web
  await op(p, 'proyecto.cambiar', { id: hu.id, clave: 'estado', valor: 'pausado' });
  await op(p, 'proyecto.cambiar', { id: hu.id, clave: 'estado', valor: 'activo' });
  assert.match(leer(dir, 'proyectos.md'), /## huddle app\n- siguiente: pestaña Mañana\n- estado: activo/);
}));

test('duplicar un bloque en otros días (sin el «hecho»), contando solapes y sin repetir', () => con(async ({ dir, p }) => {
  const b = m.bloquesDe(parsear('semanas/2026-W45.md', leer(dir, 'semanas/2026-W45.md'))).find((x) => x.titulo === 'AI-102 · visión');
  const { r, deshacer } = await yDeshacer(dir, p, 'bloque.duplicar', { semana: '2026-W45', id: b.id, huella: m.huellaDe(b), dias: [0, 1, 3, 5] }, ['semanas/2026-W45.md']);
  assert.deepEqual(r.resultado, { n: 3, solapes: 2 }); // el lunes es el suyo; el martes choca con «Curso · lab RAG» y el jueves con el simulacro
  const copias = m.bloquesDe(parsear('semanas/2026-W45.md', leer(dir, 'semanas/2026-W45.md'))).filter((x) => x.titulo === 'AI-102 · visión');
  assert.deepEqual(copias.map((x) => [x.dia, x.hecho]).sort(), [[0, 30], [1, null], [3, null], [5, null]]);
  const b2 = copias.find((x) => x.dia === 0);
  assert.deepEqual((await op(p, 'bloque.duplicar', { semana: '2026-W45', id: b2.id, huella: m.huellaDe(b2), dias: [1] })).resultado, { n: 0, solapes: 0 });
  await deshacer().catch(() => {}); // (ya hubo otra operación encima: el deshacer de la primera puede no aplicar)
  await assert.rejects(op(p, 'bloque.duplicar', { semana: '2026-W45', id: b2.id, dias: [] }), /al menos un día/);
}));

test('quitar todas las sugerencias de una semana de una vez', () => con(async ({ dir, p }) => {
  await assert.rejects(op(p, 'semana.quitarSugerencias', { semana: '2026-W45' }), /no tiene sugerencias/);
  const antes = leer(dir, 'semanas/2026-W45.md');
  const pr = await op(p, 'semana.proponer', { semana: '2026-W45' });
  assert.ok(pr.resultado.n > 0);
  const { r } = await yDeshacer(dir, p, 'semana.quitarSugerencias', { semana: '2026-W45' }, ['semanas/2026-W45.md']);
  assert.equal(r.resultado.n, pr.resultado.n);
  assert.equal(leer(dir, 'semanas/2026-W45.md'), antes);
}));

test('Hoy por encima del límite solo si se pide («subir igualmente»)', () => con(async ({ dir, p }) => {
  await op(p, 'ajustes.cambiar', { clave: 'tareas_hoy', valor: 4 });
  await assert.rejects(op(p, 'tarea.crear', { seccion: 'hoy', tarea: { texto: 'una más' } }), /Hoy está lleno/);
  await op(p, 'tarea.crear', { seccion: 'hoy', tarea: { texto: 'una más' }, exceder: true });
  const t = m.tareasDe(parsear('tareas.md', leer(dir, 'tareas.md'))).mas[0];
  await assert.rejects(op(p, 'tarea.mover', { id: t.id, huella: m.huellaDe(t), seccion: 'hoy' }), /Hoy está lleno/);
  await op(p, 'tarea.mover', { id: t.id, huella: m.huellaDe(t), seccion: 'hoy', exceder: true });
  assert.equal(m.tareasDe(parsear('tareas.md', leer(dir, 'tareas.md'))).hoy.filter((x) => !x.hecha).length, 6);
}));

test('inbox: apuntar, borrar y convertir en tarea', () => con(async ({ dir, p }) => {
  const { deshacer } = await yDeshacer(dir, p, 'inbox.crear', { texto: 'probar el modo foco | con pipes' }, ['inbox.md']);
  assert.match(leer(dir, 'inbox.md'), /^- probar el modo foco \/ con pipes$/m);
  await deshacer();
  const notas = () => m.notasInbox(parsear('inbox.md', leer(dir, 'inbox.md')));
  const n = notas().find((x) => x.texto.includes('rerankers'));
  const r = await op(p, 'inbox.aTarea', { id: n.id, huella: m.huellaDe(n) });
  assert.ok(r.resultado.id != null);
  assert.match(leer(dir, 'tareas.md'), /## Más adelante[\s\S]*- \[ \] idea: comparar rerankers con un dataset propio \| creada: 2026-11-04/);
  assert.ok(!leer(dir, 'inbox.md').includes('rerankers'));
  const otra = notas()[0];
  await op(p, 'inbox.eliminar', { id: otra.id, huella: m.huellaDe(otra) });
  assert.equal(notas().length, 0);
  await assert.rejects(op(p, 'inbox.eliminar', { id: otra.id, huella: m.huellaDe(otra) }), /ya no existe/);
  await op(p, 'inbox.crear', { texto: 'desde cero' });
  assert.match(leer(dir, 'inbox.md'), /^# Inbox\n- desde cero\n$/);
}));

test('diario de un día anterior: cambiar, añadir y quitar campos, sin cerrar el día', () => con(async ({ dir, p }) => {
  const tareas = leer(dir, 'tareas.md');
  await op(p, 'diario.editar', { fecha: '2026-11-01', animo: 5, linea: 'mejor de lo que creía', manana: 'gimnasio temprano' });
  assert.equal(leer(dir, 'diario/2026-11-01.md'), '- ánimo: 5\n- línea: mejor de lo que creía\n- mañana: gimnasio temprano\n');
  await op(p, 'diario.editar', { fecha: '2026-11-01', manana: '' });
  assert.equal(leer(dir, 'diario/2026-11-01.md'), '- ánimo: 5\n- línea: mejor de lo que creía\n');
  await op(p, 'diario.editar', { fecha: '2026-10-31', animo: 2 }); // un día sin diario
  assert.match(leer(dir, 'diario/2026-10-31.md'), /- ánimo: 2/);
  assert.equal(leer(dir, 'tareas.md'), tareas, 'no archiva nada (no es cerrar el día)');
  await assert.rejects(op(p, 'diario.editar', { fecha: '2026-11-05', animo: 3 }), /hoy o de días anteriores/);
  await assert.rejects(op(p, 'diario.editar', { fecha: '2026-11-01', animo: 7 }), /de 1 a 5/);
}));

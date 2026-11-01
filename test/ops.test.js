import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, ErrorOp, FaltaFichero } from '../src/core/ops.js';
import { serializar } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const CTX = { hoy: '2026-11-02', ahora: 9 * 60 + 12, usoTipos: { trabajo: 50, estudio: 80, entreno: 40, personal: 8, proyectos: 15 } };
const S = '2026-W45';
const RS = `semanas/${S}.md`;

/** Mundo de ejemplo completo + algunos ficheros que no existen. */
function mundo() {
  const mu = mundoEjemplo();
  for (const r of ['tema.md', 'semanas/2026-W46.md', 'semanas/2026-W47.md', 'semanas/2026-W30.md', 'diario/2026-11-02.md', 'archivo/tareas-2026-11.md', 'archivo/tareas-2026-10.md', 'archivo/inbox-2026-11.md']) {
    mu.ficheros[r] ??= null;
  }
  return mu;
}

const texto = (doc) => (doc == null ? null : serializar(doc));

/** Aplica la operación y su inversa y comprueba que todo vuelve, byte a byte. */
function idaYVuelta(mu, op, ctx = CTX) {
  const ida = aplicar(mu, op, ctx);
  assert.ok(ida.tocados.length, `${op.op} no tocó nada`);
  const vuelta = aplicar(ida.mundo, ida.inversa, ctx);
  for (const r of new Set([...ida.tocados, ...vuelta.tocados])) {
    assert.equal(texto(vuelta.mundo.ficheros[r]), texto(mu.ficheros[r]), `${op.op}: ${r} no vuelve igual`);
  }
  return ida;
}

const bloque = (mu, titulo) => m.bloquesDe(mu.ficheros[RS]).find((b) => b.titulo === titulo);

test('las operaciones son puras: no modifican el mundo de entrada', () => {
  const mu = mundo();
  const antes = JSON.stringify(mu);
  aplicar(mu, { op: 'bloque.eliminar', args: { semana: S, id: bloque(mu, 'Trabajo').id } }, CTX);
  assert.equal(JSON.stringify(mu), antes);
});

test('cada operación básica tiene una inversa exacta', () => {
  const mu = mundo();
  const temas = m.temasEstudio(mu.ficheros['estudio.md']);
  const pro = m.proyectosDe(mu.ficheros['proyectos.md']);
  const tareas = m.tareasDe(mu.ficheros['tareas.md']);
  const ops = [
    { op: 'bloque.crear', args: { semana: S, bloque: { dia: 2, inicio: 1200, fin: 1290, tipo: 'estudio', titulo: 'AI-102 · repasar', subtipo: 'repasar' } } },
    { op: 'bloque.editar', args: { semana: S, id: bloque(mu, 'Curso · lab RAG').id, cambios: { dia: 3, inicio: 1170, fin: 1260 } } },
    { op: 'bloque.editar', args: { semana: S, id: bloque(mu, 'Deploy del pipeline').id, cambios: { plantilla: true, titulo: 'Deploy' } } },
    { op: 'bloque.eliminar', args: { semana: S, id: bloque(mu, 'AI-102 · repasar').id } },
    { op: 'las3.crear', args: { semana: S, texto: 'Cuarta', rel: 'huddle' } },
    { op: 'las3.editar', args: { semana: S, id: m.las3De(mu.ficheros[RS])[1].id, cambios: { hecha: true } } },
    { op: 'las3.eliminar', args: { semana: S, id: m.las3De(mu.ficheros[RS])[0].id } },
    { op: 'semana.crear', args: { semana: '2026-W47' } },
    { op: 'bloque.crear', args: { semana: '2026-W46', bloque: { dia: 0, inicio: 600, fin: 660, tipo: 'personal', titulo: 'Médico' } } },
    { op: 'semana.reabrir', args: { semana: '2026-W43' } },
    { op: 'tarea.crear', args: { seccion: 'mas', tarea: { texto: 'Comprar pilas', tipo: 'personal', fecha: '2026-11-04' } } },
    { op: 'tarea.marcar', args: { id: tareas.hoy[0].id, hecha: true } },
    { op: 'tarea.mover', args: { id: tareas.hoy[1].id, seccion: 'mas' } },
    { op: 'tarea.mover', args: { id: tareas.mas[0].id, seccion: 'hoy' } },
    { op: 'tarea.editar', args: { id: tareas.algun[0].id, cambios: { texto: 'Aprender Rust en serio', prioridad: true } } },
    { op: 'tarea.eliminar', args: { id: tareas.mas[2].id } },
    { op: 'ajustes.cambiar', args: { clave: 'capacidad', valor: 80 } },
    { op: 'ajustes.cambiar', args: { clave: 'decoracion', valor: false } },
    { op: 'estudio.crear', args: { nombre: 'Inglés C1', horas_semana: 2, examen: '2027-03-01' } },
    { op: 'estudio.cambiar', args: { id: temas[0].id, clave: 'horas_semana', valor: 6 } },
    { op: 'estudio.cambiar', args: { id: temas[2].id, clave: 'dejado', valor: null } },
    { op: 'estudio.cambiar', args: { id: temas[1].id, clave: 'dejado', valor: 'tema 3, pregunta 12' } },
    { op: 'estudio.eliminar', args: { id: temas[2].id } },
    { op: 'estudio.eliminar', args: { id: temas[0].id } },
    { op: 'proyecto.crear', args: { nombre: 'blog', siguiente: 'borrador del post' } },
    { op: 'proyecto.cambiar', args: { id: pro[1].id, clave: 'siguiente', valor: 'importar CSV' } },
    { op: 'proyecto.cambiar', args: { id: pro[0].id, clave: 'estado', valor: 'pausado' } },
    { op: 'proyecto.eliminar', args: { id: pro[2].id } },
    { op: 'plantilla.crear', args: { dias: [1, 3], inicio: 420, fin: 450, tipo: 'personal', titulo: 'Paseo' } },
    { op: 'plantilla.eliminar', args: { id: m.plantillaDe(mu.ficheros['plantilla.md'])[1].id } },
    { op: 'tipo.crear', args: { nombre: 'Lectura', color: '#A1466B' } },
    { op: 'tipo.color', args: { nombre: 'personal', color: '#2D7A80' } },
  ];
  for (const op of ops) idaYVuelta(mu, op);
});

test('editar una línea conserva el resto del fichero tal cual', () => {
  const mu = mundo();
  const r = aplicar(mu, { op: 'bloque.editar', args: { semana: S, id: bloque(mu, 'Deploy del pipeline').id, cambios: { inicio: 1290, fin: 1350 } } }, CTX);
  const antes = serializar(mu.ficheros[RS]).split('\n'), despues = serializar(r.mundo.ficheros[RS]).split('\n');
  const distintas = antes.filter((l, i) => l !== despues[i]);
  assert.deepEqual(distintas, ['- J 21:30-23:00 | trabajo | Deploy del pipeline']);
  assert.ok(despues.includes('- J 21:30-22:30 | trabajo | Deploy del pipeline'));
});

test('crear un bloque en una semana futura sin fichero la crea desde la plantilla', () => {
  const mu = mundo();
  const r = aplicar(mu, { op: 'bloque.crear', args: { semana: '2026-W46', bloque: { dia: 0, inicio: 600, fin: 660, tipo: 'personal', titulo: 'Médico' } } }, CTX);
  const doc = r.mundo.ficheros['semanas/2026-W46.md'];
  const bs = m.bloquesDe(doc);
  assert.equal(bs.filter((b) => b.plantilla).length, 10);
  assert.equal(bs.at(-1).titulo, 'Médico');
  assert.equal(serializar(doc).split('\n')[0], '# Semana 46 · 2026-11-09 → 2026-11-15');
  assert.match(serializar(doc), /^estado: solo plantilla$/m);
});

test('reglas: semanas cerradas, pasadas sin datos, tipos en uso, Hoy lleno, textos limpios', () => {
  const mu = mundo();
  const err = (op, re) => assert.throws(() => aplicar(mu, op, CTX), (e) => e instanceof ErrorOp && re.test(e.message));
  const w43 = m.bloquesDe(mu.ficheros['semanas/2026-W43.md'])[0];
  err({ op: 'bloque.eliminar', args: { semana: '2026-W43', id: w43.id } }, /cerrada/);
  err({ op: 'bloque.crear', args: { semana: '2026-W30', bloque: { dia: 0, inicio: 600, fin: 660, tipo: 'x', titulo: 'y' } } }, /solo lectura/);
  err({ op: 'tipo.eliminar', args: { nombre: 'entreno' } }, /en uso/);
  err({ op: 'bloque.crear', args: { semana: S, bloque: { dia: 0, inicio: 600, fin: 600, tipo: 'x', titulo: 'y' } } }, /termina antes/);
  err({ op: 'bloque.editar', args: { semana: S, id: 0, cambios: { dia: 1 } } }, /ya no existe/);
  err({ op: 'semana.crear', args: { semana: S } }, /ya existe/);
  err({ op: 'ajustes.cambiar', args: { clave: 'capacidad', valor: 20 } }, /no válido/);
  err({ op: 'operacion.rara', args: {} }, /desconocida/);
  // Hoy tiene 4 abiertas y el límite es 5: cabe una más y luego está lleno
  const una = aplicar(mu, { op: 'tarea.crear', args: { seccion: 'hoy', tarea: { texto: 'Quinta' } } }, CTX);
  assert.throws(() => aplicar(una.mundo, { op: 'tarea.crear', args: { seccion: 'hoy', tarea: { texto: 'Sexta' } } }, CTX), /lleno/);
  const mas = m.tareasDe(una.mundo.ficheros['tareas.md']).mas[0];
  assert.throws(() => aplicar(una.mundo, { op: 'tarea.mover', args: { id: mas.id, seccion: 'hoy' } }, CTX), /lleno/);
  // los textos de la UI no crean campos ni comentarios
  const r = aplicar(mu, { op: 'bloque.crear', args: { semana: S, bloque: { dia: 0, inicio: 420, fin: 480, tipo: 'personal', titulo: 'a | b   # c\nd' } } }, CTX);
  assert.equal(m.bloquesDe(r.mundo.ficheros[RS]).at(-1).titulo, 'a / b # c d');
  // un tipo sin usos se puede borrar
  const sinUso = aplicar(mu, { op: 'tipo.crear', args: { nombre: 'ocio', color: '#55722B' } }, CTX);
  aplicar(sinUso.mundo, { op: 'tipo.eliminar', args: { nombre: 'ocio' } }, CTX);
});

test('si falta un fichero, la operación lo pide (FaltaFichero) y se puede repetir', () => {
  const mu = { ficheros: {} };
  const pedidos = [];
  let res;
  for (let i = 0; i < 10 && !res; i++) {
    try { res = aplicar(mu, { op: 'tarea.crear', args: { seccion: 'mas', tarea: { texto: 'algo' } } }, CTX); } catch (e) {
      assert.ok(e instanceof FaltaFichero);
      pedidos.push(e.ruta);
      mu.ficheros[e.ruta] = null;
    }
  }
  assert.deepEqual(pedidos, ['tareas.md']);
  assert.equal(serializar(res.mundo.ficheros['tareas.md']), '## Hoy\n\n## Más adelante\n- [ ] algo | creada: 2026-11-02\n\n## Algún día\n');
});

test('tarea.marcar guarda la fecha y tarea.crear la de creación', () => {
  const mu = mundo();
  const t = m.tareasDe(mu.ficheros['tareas.md']).hoy[1];
  const r = aplicar(mu, { op: 'tarea.marcar', args: { id: t.id, hecha: true } }, CTX);
  assert.match(serializar(r.mundo.ficheros['tareas.md']), /- \[x\] Leer: chunking y reranking \| estudio \| hecha: 2026-11-02/);
});

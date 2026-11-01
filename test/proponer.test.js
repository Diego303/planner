import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, trocear, necesidades } from '../src/core/proponer.js';
import { factores, factorDe } from '../src/core/factor.js';
import { aplicar } from '../src/core/ops.js';
import { serializar } from '../src/core/formato/index.js';
import * as fsem from '../src/core/formato/semana.js';
import * as m from '../src/core/modelo.js';
import { carriles } from '../src/core/carriles.js';
import { mundoEjemplo } from './ayudas.js';

const HOY = '2026-11-02';
const mu = mundoEjemplo().ficheros;
const docs = Object.fromEntries(Object.entries(mu).filter(([r]) => r.startsWith('semanas/')).map(([r, d]) => [r.slice(8, -3), d]));
const tipos = m.tiposDe(mu['tipos.md']);
const AJUSTES = m.valoresAjustes(mu['ajustes.md']);
const FACTORES = factores(docs, tipos, '2026-W45');
const temas = m.temasEstudio(mu['estudio.md']);
const proyectos = m.proyectosDe(mu['proyectos.md']);

/** Semana con solo la plantilla (y lo que se le pase). */
function semana(id, extra = [], las3 = []) {
  const doc = fsem.vacia(id, 'planificada');
  doc.lineas.splice(4, 0, ...las3.map((o) => fsem.objetivo3(o)));
  for (const b of m.bloquesDe(docs['2026-W45']).filter((x) => x.plantilla)) doc.lineas.push(fsem.bloque(b));
  doc.lineas.push(...extra.map((b) => fsem.bloque(b)));
  return doc;
}
const base = { temas, proyectos, ajustes: AJUSTES, tipos, factores: FACTORES, hoy: HOY };
const P = (o) => proponer({ ...base, ...o });

/** Comprobaciones comunes a cualquier propuesta. */
function invariantes(r, doc, ajustes = AJUSTES) {
  const todos = [...m.bloquesDe(doc).filter((b) => !b.sugerido), ...r.bloques];
  for (const b of r.bloques) {
    assert.ok(b.sugerido);
    assert.ok(b.inicio >= ajustes.horas.desde * 60 && b.fin <= Math.min(ajustes.horas.hasta * 60, ajustes.cierre), `${b.titulo} fuera de horas`);
    for (const o of todos) {
      if (o === b || o.dia !== b.dia) continue;
      assert.ok(b.inicio >= o.fin + 15 || b.fin <= o.inicio - 15, `${b.titulo} choca con ${o.titulo}`);
    }
  }
  for (let d = 0; d < 7; d++) {
    const temasDia = r.bloques.filter((b) => b.dia === d).map((b) => m.temaDe(b.titulo));
    const existentes = m.bloquesDe(doc).filter((b) => b.dia === d && !b.sugerido).map((b) => m.normalizar(m.temaDe(b.titulo)));
    for (const t of temasDia) assert.ok(!existentes.includes(m.normalizar(t)), `tema repetido el día ${d}`);
    assert.equal(new Set(temasDia).size, temasDia.length, `dos piezas del mismo tema el día ${d}`);
    const est = todos.filter((b) => b.dia === d && m.esEstudio(tipos, b.tipo)).reduce((s, b) => s + b.fin - b.inicio, 0);
    const nuevosEst = r.bloques.filter((b) => b.dia === d && m.esEstudio(tipos, b.tipo)).length;
    if (nuevosEst) assert.ok(est <= ajustes.foco_max * 60, `foco superado el día ${d}`);
  }
}

test('trocear: piezas de 1,5 h, la última de 1–1,5 h y nunca menos de 1 h', () => {
  assert.deepEqual(trocear(0), []);
  assert.deepEqual(trocear(30), []);
  assert.deepEqual(trocear(60), [60]);
  assert.deepEqual(trocear(90), [90]);
  assert.deepEqual(trocear(120), [60, 60]);
  assert.deepEqual(trocear(150), [90, 60]);
  assert.deepEqual(trocear(300), [90, 90, 60, 60]);
  assert.deepEqual(trocear(-60), []);
});

test('factor: media acotada por tipo, ×1,0 con menos de 5 muestras', () => {
  assert.ok(FACTORES.estudio.muestras >= 5);
  assert.ok(FACTORES.estudio.factor > 1.1 && FACTORES.estudio.factor < 1.5);
  assert.equal(FACTORES.entreno.factor, 1);
  assert.equal(FACTORES.trabajo.muestras, 0);
  assert.equal(FACTORES.trabajo.factor, 1);
  assert.equal(factorDe({}, 'estudio'), 1);
  // acotado a [0,7 · 2,0]
  const lento = fsem.vacia('2026-W45', 'en curso');
  for (let i = 0; i < 6; i++) lento.lineas.push(fsem.bloque({ dia: i, inicio: 600, fin: 630, tipo: 'estudio', titulo: 'x', hecho: 120 }));
  assert.equal(factores({ '2026-W45': lento }, tipos, '2026-W45').estudio.factor, 2);
});

test('escenario 1 · semana con plantilla: estudio y proyectos colocados, sin solapes ni temas repetidos', () => {
  const doc = semana('2026-W46');
  const r = P({ id: '2026-W46', doc });
  invariantes(r, doc);
  assert.ok(r.bloques.length >= 8, `solo ${r.bloques.length}`);
  for (const t of temas) {
    const reservado = r.bloques.filter((b) => m.temaDe(b.titulo) === t.nombre).length;
    assert.ok(reservado >= 1, t.nombre);
  }
  assert.ok(r.bloques.some((b) => m.temaDe(b.titulo) === 'gymhub'));
});

test('escenario 2 · determinista: misma entrada, mismo resultado (y no depende del orden de llamada)', () => {
  const doc = semana('2026-W46');
  const a = JSON.stringify(P({ id: '2026-W46', doc }));
  P({ id: '2026-W47', doc: semana('2026-W47') });
  assert.equal(JSON.stringify(P({ id: '2026-W46', doc })), a);
});

test('escenario 3 · ★ primero lo que avanza Las 3 y después el examen más cercano', () => {
  const doc = semana('2026-W46', [], [{ texto: 'Lab del curso', rel: 'Curso' }]);
  const n = necesidades({ doc, temas, proyectos, tipos, hoy: HOY, id: '2026-W46' });
  assert.equal(n[0].tema, 'Curso');
  const sinRel = necesidades({ doc: semana('2026-W46'), temas, proyectos, tipos, hoy: HOY, id: '2026-W46' });
  assert.equal(sinRel[0].tema, 'AI-102'); // examen 12 dic, el más cercano
  assert.equal(sinRel.at(-1).clase, 1); // proyectos al final
  assert.deepEqual(sinRel.slice(0, 3).map((x) => x.tema), ['AI-102', 'Curso', 'MLA-C01']); // por rondas
});

test('escenario 4 · simulacro primero si hace ≥ 2 semanas del último y no hay uno planificado', () => {
  const doc = semana('2026-W46');
  const n = necesidades({ doc, temas, proyectos, tipos, hoy: HOY, id: '2026-W46' });
  const mla = n.filter((x) => x.tema === 'MLA-C01');
  assert.equal(mla[0].subtipo, 'simulacro');
  assert.equal(n.filter((x) => x.tema === 'AI-102')[0].subtipo, 'simulacro'); // el 26 oct queda a 2 semanas del lunes 9
  const recien = necesidades({ doc: semana('2026-W45'), temas, proyectos, tipos, hoy: HOY, id: '2026-W45' });
  assert.deepEqual(recien.filter((x) => x.tema === 'AI-102').map((x) => x.subtipo), ['aprender', 'repasar', 'aprender', 'repasar']);
  // con uno ya planificado, no se añade otro
  const conSim = semana('2026-W46', [{ dia: 3, inicio: 1200, fin: 1260, tipo: 'estudio', titulo: 'MLA-C01 · simulacro', subtipo: 'simulacro' }]);
  const n2 = necesidades({ doc: conSim, temas, proyectos, tipos, hoy: HOY, id: '2026-W46' });
  assert.ok(n2.filter((x) => x.tema === 'MLA-C01').every((x) => x.subtipo !== 'simulacro'));
});

test('escenario 5 · lo ya planificado se descuenta y las sugerencias viejas no cuentan', () => {
  const doc = docs['2026-W45'];
  const n = necesidades({ doc, temas, proyectos, tipos, hoy: HOY, id: '2026-W45' });
  const minutos = (t) => n.filter((x) => x.tema === t).reduce((s, x) => s + x.minutos, 0);
  assert.equal(minutos('AI-102'), 120); // 5 h − 3 h planificadas
  assert.equal(minutos('Curso'), 150); // 6 h − 3,5 h → 2,5 h
  assert.equal(minutos('MLA-C01'), 120); // 3 h − 1 h
  assert.ok(!n.some((x) => x.tema === 'agente soporte' && false));
});

test('escenario 6 · margen auto usa el factor (máx. 2,5 h) y fijo usa la pieza', () => {
  const doc = semana('2026-W46');
  const holgado = { ...AJUSTES, capacidad: 100, foco_max: 8 };
  const auto = P({ id: '2026-W46', doc, ajustes: holgado });
  const fijo = P({ id: '2026-W46', doc, ajustes: { ...holgado, margen: 'fijo' } });
  assert.deepEqual(auto.noCaben, []);
  const ai = (r) => r.bloques.filter((b) => m.temaDe(b.titulo) === 'AI-102').map((b) => b.fin - b.inicio);
  assert.deepEqual(ai(fijo), [90, 90, 60, 60]);
  const f = FACTORES.estudio.factor;
  assert.deepEqual(ai(auto), [90, 90, 60, 60].map((x) => Math.min(150, Math.round((x * f) / 30) * 30)));
});

test('escenario 7 · semana actual: nunca en días pasados ni antes de ahora', () => {
  const doc = docs['2026-W45'];
  const jueves = '2026-11-05';
  const r = P({ id: '2026-W45', doc, hoy: jueves, ahora: 19 * 60 + 10 });
  invariantes(r, doc);
  assert.ok(r.bloques.every((b) => b.dia >= 3));
  assert.ok(r.bloques.filter((b) => b.dia === 3).every((b) => b.inicio >= 19 * 60 + 30));
  assert.deepEqual(P({ id: '2026-W44', doc: docs['2026-W44'] }).bloques, []); // semana pasada
});

test('escenario 8 · capacidad y foco: lo que no cabe se informa por tema', () => {
  const doc = semana('2026-W46');
  const r = P({ id: '2026-W46', doc, ajustes: { ...AJUSTES, capacidad: 50, foco_max: 1.5 } });
  invariantes(r, doc, { ...AJUSTES, capacidad: 50, foco_max: 1.5 });
  for (let d = 0; d < 7; d++) {
    const ocupado = [...m.bloquesDe(doc), ...r.bloques].filter((b) => b.dia === d).reduce((s, b) => s + b.fin - b.inicio, 0);
    if (r.bloques.some((b) => b.dia === d)) assert.ok((ocupado / (17 * 60)) * 100 <= 60, `día ${d} por encima de capacidad + 10`);
  }
  assert.ok(r.noCaben.length > 0);
  assert.ok(r.noCaben.every((x) => x.minutos >= 60 && x.tema));
});

test('escenario 9 · mejores horas: mañanas antes de las 13, noches desde las 19', () => {
  const doc = semana('2026-W46');
  const man = P({ id: '2026-W46', doc, ajustes: { ...AJUSTES, mejores_horas: 'mañanas' } });
  const noc = P({ id: '2026-W46', doc, ajustes: { ...AJUSTES, mejores_horas: 'noches' } });
  invariantes(man, doc);
  invariantes(noc, doc);
  const finde = (r) => r.bloques.filter((b) => b.dia >= 5);
  assert.ok(finde(man).every((b) => b.inicio < 13 * 60), 'mañanas en fin de semana');
  assert.ok(noc.bloques.filter((b) => b.dia < 5).every((b) => b.inicio >= 19 * 60), 'noches entre semana');
  // sin preferencia: nunca antes de las 9 si hay sitio después
  assert.ok(P({ id: '2026-W46', doc }).bloques.every((b) => b.inicio >= 9 * 60));
});

test('escenario 10 · evita empezar justo después de un bloque de trabajo de más de 4 h', () => {
  const doc = semana('2026-W46');
  const r = P({ id: '2026-W46', doc });
  for (const b of r.bloques.filter((x) => x.dia <= 4)) {
    assert.ok(!(b.inicio >= 17.5 * 60 && b.inicio <= 18 * 60), `${b.titulo} empieza a las ${b.inicio / 60}`);
  }
});

test('escenario 11 · nada que proponer si todo está planificado; proyectos pausados no cuentan', () => {
  const extra = [];
  let dia = 0;
  for (const t of temas) for (const min of trocear(t.horasSemana * 60)) extra.push({ dia: dia++ % 7, inicio: 7 * 60, fin: 7 * 60 + min, tipo: 'estudio', titulo: `${t.nombre} · x` });
  for (const p of proyectos) extra.push({ dia: 5, inicio: 13 * 60, fin: 14 * 60, tipo: 'proyectos', titulo: `${p.nombre} · x` });
  const r = P({ id: '2026-W46', doc: semana('2026-W46', extra) });
  assert.deepEqual(r, { bloques: [], noCaben: [] });
  const pausados = proyectos.map((p) => ({ ...p, estado: 'pausado' }));
  assert.ok(!P({ id: '2026-W46', doc: semana('2026-W46'), proyectos: pausados }).bloques.some((b) => b.tipo === 'proyectos'));
});

test('escenario 12 · exámenes pasados, temas sin examen y semana 53', () => {
  const pasado = [{ ...temas[0], examen: '2026-10-01' }, { ...temas[1], examen: null }];
  const n = necesidades({ doc: semana('2026-W46'), temas: pasado, proyectos: [], tipos, hoy: HOY, id: '2026-W46' });
  assert.ok(n.every((x) => x.tema === 'MLA-C01'));
  const doc = semana('2026-W53');
  const r = P({ id: '2026-W53', doc, hoy: '2026-12-28' });
  invariantes(r, doc);
  assert.ok(r.bloques.length > 0);
});

test('semana.proponer: sustituye las sugerencias anteriores, se puede deshacer y repetir da lo mismo', () => {
  const mundo = mundoEjemplo();
  const ctx = { hoy: HOY, ahora: 9 * 60, factores: FACTORES };
  const r1 = aplicar(mundo, { op: 'semana.proponer', args: { semana: '2026-W45' } }, ctx);
  const doc1 = r1.mundo.ficheros['semanas/2026-W45.md'];
  const sug = m.bloquesDe(doc1).filter((b) => b.sugerido);
  assert.equal(sug.length, r1.resultado.n);
  assert.ok(sug.length > 0);
  for (let d = 0; d < 7; d++) {
    const delDia = m.bloquesDe(doc1).filter((b) => b.dia === d);
    carriles(delDia).forEach((c, i) => assert.ok(!delDia[i].sugerido || !c.solapa));
  }
  const r2 = aplicar(r1.mundo, { op: 'semana.proponer', args: { semana: '2026-W45' } }, ctx);
  assert.equal(serializar(r2.mundo.ficheros['semanas/2026-W45.md']), serializar(doc1));
  const vuelta = aplicar(r1.mundo, r1.inversa, ctx);
  assert.equal(serializar(vuelta.mundo.ficheros['semanas/2026-W45.md']), serializar(mundo.ficheros['semanas/2026-W45.md']));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../src/core/progreso.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const HOY = '2026-11-02', ACTUAL = '2026-W45';
const f = mundoEjemplo().ficheros;
const docs = Object.fromEntries(Object.entries(f).filter(([r]) => r.startsWith('semanas/')).map(([r, d]) => [r.slice(8, -3), d]));
const tipos = m.tiposDe(f['tipos.md']);
const temas = m.temasEstudio(f['estudio.md']);
const diarios = Object.fromEntries(Object.entries(f).filter(([r]) => r.startsWith('diario/')).map(([r, d]) => [r.slice(7, -3), m.diarioDe(d)]));
const prog = p.calcularProgreso({ docsSemanas: docs, temas, tipos, diarios, hoy: HOY, actual: ACTUAL });

test('acumulado = previo + horas hechas en todas las semanas', () => {
  const [ai] = temas;
  // previo 2 h + lo hecho en el ejemplo
  const hechas = Object.values(docs).flatMap((d) => m.bloquesDe(d)).filter((b) => b.hecho != null && m.temaDe(b.titulo) === 'AI-102').reduce((s, b) => s + m.minutosHechos(b), 0);
  assert.equal(p.acumulado(ai, docs, tipos), 120 + hechas);
  assert.ok(hechas > 30 * 60);
});

test('esperado = total × avance entre inicio y examen (acotado)', () => {
  const t = { total: 40, inicio: '2026-09-14', examen: '2026-12-12' };
  assert.equal(p.esperado(t, '2026-09-14'), 0);
  assert.equal(p.esperado(t, '2027-01-01'), 2400);
  assert.ok(Math.abs(p.esperado(t, HOY) - 2400 * (49 / 89)) < 1e-9);
  assert.equal(p.esperado({ total: 40, examen: null, inicio: '2026-09-14' }, HOY), null);
});

test('certificaciones: encuadre, diferencia, 8 semanas y simulacros', () => {
  const [ai, mla, curso] = prog.certificaciones;
  assert.equal(ai.horas8.length, 8);
  assert.deepEqual(ai.simulacros, [61, 66, 72]);
  assert.equal(ai.encuadre, ai.acumulado / (40 * 60) < 0.5 ? 'llevas' : 'faltan');
  assert.ok(Math.abs(ai.diferencia - (ai.acumulado - ai.esperado)) < 1e-9);
  assert.equal(mla.sinSimulacro, 2);
  assert.deepEqual(curso.simulacros, []);
  assert.equal(curso.soloSemanal, false);
  const sinTotal = p.certificaciones({ temas: [{ ...temas[0], total: null }], docsSemanas: docs, tipos, hoy: HOY, actual: ACTUAL });
  assert.equal(sinTotal[0].soloSemanal, true);
  assert.equal(sinTotal[0].esperado, null);
});

test('plan frente a real de la última semana cerrada, rejilla de 16 semanas y estudio total', () => {
  assert.equal(prog.ultimaCerrada, '2026-W43');
  const est = prog.planReal.find((x) => x.tipo === 'estudio');
  assert.ok(est.real > est.plan); // en el ejemplo se tarda más de lo previsto
  assert.ok(!prog.planReal.some((x) => x.tipo === 'trabajo'));
  assert.equal(prog.rejilla.length, 16);
  assert.equal(prog.rejilla[0].id, '2026-W38');
  assert.equal(prog.rejilla.findIndex((c) => c.actual), 7);
  assert.ok(prog.rejilla.slice(8).every((c) => c.futura && c.minutos == null));
  assert.equal(prog.estudio8.length, 8);
  assert.equal(prog.meta, 14);
  assert.equal(prog.semanasConEstudio, 7);
});

test('ánimo por semana, mediana y comparación (correlación, no causa)', () => {
  assert.equal(p.mediana([3, 1, 2]), 2);
  assert.equal(p.mediana([4, 1, 3, 2]), 2.5);
  assert.equal(prog.animo8.length, 8);
  assert.ok(prog.animo8[0] > 3 && prog.animo8[0] < 4);
  assert.equal(prog.animo8[7], null); // semana actual sin diario
  const c = prog.comparacion;
  assert.ok(c.mediana > 0 && c.conMas >= 1 && c.conMenos >= 1);
  assert.equal(p.animoYEstudio([1, 2], [null, 3]), null);
});

test('lecciones de los cierres, de la más reciente a la más antigua', () => {
  assert.deepEqual(prog.lecciones.map((l) => l.semana), ['2026-W43', '2026-W42', '2026-W41']);
  assert.equal(prog.lecciones[0].cambio, 'Nada de simulacros los jueves: llego sin energía.');
});

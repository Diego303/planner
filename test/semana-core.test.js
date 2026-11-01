import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carriles, contarSolapes } from '../src/core/carriles.js';
import { ocupacionDia, estudioDia, nivelOcupacion, trabajoTrasCierre } from '../src/core/capacidad.js';
import { colorBloque, contraste, mezclar } from '../src/core/color.js';
import { estadoSemana, crearDesdePlantilla, listaSemanas, pendientesDeCerrar } from '../src/core/semanas.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const b = (inicio, fin, extra = {}) => ({ dia: 0, inicio: inicio * 60, fin: fin * 60, tipo: 'x', titulo: 't', ...extra });

test('carriles: grupos transitivos, carril mínimo libre y solapes', () => {
  const r = carriles([b(9, 11), b(10, 12), b(11, 13), b(14, 15), b(15, 16)]);
  assert.deepEqual(r.map((x) => [x.carril, x.n, x.solapa]), [[0, 2, true], [1, 2, true], [0, 2, true], [0, 1, false], [0, 1, false]]);
  // tocarse no es solaparse
  assert.deepEqual(carriles([b(9, 10), b(10, 11)]).map((x) => x.solapa), [false, false]);
  // una sugerencia ocupa carril pero no cuenta como solape
  const s = carriles([b(9, 11), b(10, 12, { sugerido: true })]);
  assert.deepEqual(s.map((x) => [x.carril, x.solapa]), [[0, false], [1, false]]);
  assert.equal(contarSolapes([b(9, 11), b(10, 12), b(10, 12, { dia: 1 }), b(9, 10, { sugerido: true })]), 1);
  // orden de entrada irrelevante
  assert.deepEqual(carriles([b(10, 12), b(9, 11)]).map((x) => x.carril), [1, 0]);
});

test('capacidad: ocupación recortada a las horas visibles, niveles y foco', () => {
  const ajustes = { ...m.AJUSTES_DEFECTO };
  const tipos = m.TIPOS_DEFECTO;
  const bloques = [b(9, 17.5, { tipo: 'trabajo' }), b(20, 21.5, { tipo: 'estudio' }), b(21.5, 23, { tipo: 'estudio' }),
    b(6, 8, { tipo: 'personal' }), b(18, 19, { tipo: 'estudio', sugerido: true })];
  const o = ocupacionDia(bloques, 0, ajustes);
  assert.equal(o.minutos, 8.5 * 60 + 3 * 60 + 60); // 6–8 se recorta a 7–8
  assert.equal(o.disponibles, 17 * 60);
  assert.equal(o.nivel, 'aviso');
  assert.equal(nivelOcupacion(70, 70), 'ok');
  assert.equal(nivelOcupacion(86, 70), 'exceso');
  assert.deepEqual(estudioDia(bloques, 0, tipos, ajustes), { minutos: 180, aviso: false });
  assert.equal(estudioDia([...bloques, b(12, 13, { tipo: 'estudio' })], 0, tipos, ajustes).aviso, true);
  assert.ok(trabajoTrasCierre(b(21.5, 23, { tipo: 'trabajo' }), tipos, ajustes));
  assert.ok(!trabajoTrasCierre(b(21.5, 22.5, { tipo: 'trabajo' }), tipos, ajustes));
});

test('color de bloque en tema claro: 11 % de fondo y texto con contraste AA', () => {
  const c = colorBloque('#5B4E8C', { modo: 'claro', superficie: '#FFFFFF' });
  assert.equal(c.fondo, mezclar('#5B4E8C', '#FFFFFF', 0.11));
  assert.equal(c.texto, '#5B4E8C');
  for (const base of m.PAL) assert.ok(contraste(colorBloque(base).texto, colorBloque(base).fondo) >= 4.5, base);
});

test('estados de semana y creación desde plantilla', () => {
  const mu = mundoEjemplo().ficheros;
  const docs = Object.fromEntries(Object.entries(mu).filter(([r]) => r.startsWith('semanas/')).map(([r, d]) => [r.slice(8, -3), d]));
  const actual = '2026-W45';
  assert.equal(estadoSemana('2026-W45', docs['2026-W45'], actual), 'en curso');
  assert.equal(estadoSemana('2026-W44', docs['2026-W44'], actual), 'sin cerrar');
  assert.equal(estadoSemana('2026-W43', docs['2026-W43'], actual), 'cerrada');
  assert.equal(estadoSemana('2026-W30', null, actual), 'sin datos');
  assert.equal(estadoSemana('2026-W50', null, actual), 'sin planificar');
  const nueva = crearDesdePlantilla('2026-W46', mu['plantilla.md'], actual);
  assert.equal(estadoSemana('2026-W46', nueva, actual), 'solo plantilla');
  assert.equal(m.bloquesDe(nueva).length, 10);
  assert.deepEqual(pendientesDeCerrar(docs, actual), ['2026-W44']);
  assert.equal(listaSemanas('2026-W52', '2027-W02', {}, actual).map((s) => s.id).join(','), '2026-W52,2026-W53,2027-W01,2027-W02');
  // la semana 53 se crea como cualquier otra
  assert.equal(m.bloquesDe(crearDesdePlantilla('2026-W53', mu['plantilla.md'], '2026-W53')).length, 10);
});

test('★ y relación de Las 3', () => {
  const las3 = [{ rel: 'Curso' }, { rel: 'MLA-C01' }, { rel: null }];
  assert.ok(m.avanzaLas3('Curso · lab RAG', las3));
  assert.ok(!m.avanzaLas3('AI-102 · visión', las3));
  assert.ok(m.tareaAvanzaLas3({ texto: 'Simulacro MLA-C01', las3: false }, las3));
  assert.ok(m.tareaAvanzaLas3({ texto: 'Otra', las3: true }, las3));
  assert.equal(m.relDeTexto('Simulacro MLA-C01 ≥ 70 %', ['AI-102', 'MLA-C01', 'Curso']), 'MLA-C01');
  assert.equal(m.relDeTexto('Ir al concurso', ['Curso']), null);
});

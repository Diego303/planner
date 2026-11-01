// Q2 · Lógica del núcleo: factor, captura (≥ 60 casos), carriles, capacidad, semanas, progreso y temas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factores, factorDe, redondearFactor } from '../src/core/factor.js';
import { parsearCaptura, destinoCaptura, tareaDeCaptura } from '../src/core/captura.js';
import { carriles, contarSolapes } from '../src/core/carriles.js';
import { ocupacionDia, estudioDia, nivelOcupacion } from '../src/core/capacidad.js';
import { estadoSemana, crearDesdePlantilla, soloLectura } from '../src/core/semanas.js';
import { encuadre, mediana, esperado, certificaciones, animoPorSemana, animoYEstudio, calcularProgreso, semanasSinSimulacro } from '../src/core/progreso.js';
import { atributosTema } from '../src/core/temas.js';
import { aplicar } from '../src/core/ops.js';
import { parsear, serializar } from '../src/core/formato/index.js';
import * as fsem from '../src/core/formato/semana.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const TIPOS = m.TIPOS_DEFECTO;

// ---------- Factor ----------

const semanaCon = (id, bloques) => {
  const d = fsem.vacia(id, 'cerrada');
  d.lineas.push(...bloques.map((b) => fsem.bloque({ dia: 0, inicio: 600, tipo: 'estudio', titulo: 'x', ...b })));
  return d;
};

test('factor: < 5 muestras da ×1, se acota a [0,7 · 2,0], solo cuenta 8 semanas y aguanta bloques de 30 min', () => {
  const cuatro = { '2026-W45': semanaCon('2026-W45', Array(4).fill({ fin: 690, hecho: 60 })) };
  assert.deepEqual(factores(cuatro, TIPOS, '2026-W45').estudio, { factor: 1, muestras: 4, media: (90 + 60) / 90 });
  const lentos = { '2026-W45': semanaCon('2026-W45', Array(5).fill({ fin: 630, hecho: 120 })) };
  assert.equal(factores(lentos, TIPOS, '2026-W45').estudio.factor, 2);
  const rapidos = { '2026-W45': semanaCon('2026-W45', Array(5).fill({ fin: 630, hecho: -30 })) }; // duraron 0 min
  const fr = factores(rapidos, TIPOS, '2026-W45').estudio;
  assert.equal(fr.factor, 0.7);
  assert.ok(Number.isFinite(fr.media) && fr.media === 0);
  // la semana 9 hacia atrás no cuenta
  const viejas = { '2026-W37': semanaCon('2026-W37', Array(10).fill({ fin: 690, hecho: 60 })), '2026-W38': semanaCon('2026-W38', Array(5).fill({ fin: 690, hecho: 0 })) };
  assert.deepEqual([factores(viejas, TIPOS, '2026-W45').estudio.muestras, factores(viejas, TIPOS, '2026-W45').estudio.factor], [5, 1]);
  assert.equal(factorDe({ Estudio: { factor: 1.4 } }, 'estudio'), 1.4);
  assert.equal(redondearFactor(1.26), 1.3);
  // sin datos ni tipos: no explota
  assert.deepEqual(factores({}, [], '2026-W45'), {});
});

// ---------- Captura: tabla de casos ----------

const HOY = '2026-11-02'; // lunes
const CASOS = [
  // [texto, { titulo, tipo, fecha, prioridad, dur, algunDia }, destino (Hoy con hueco)]
  ['Llamar al gestor', { titulo: 'Llamar al gestor' }, 'hoy'],
  ['Llamar al gestor #pers', { titulo: 'Llamar al gestor', tipo: 'personal' }, 'mas'],
  ['#tr Revisar PR', { titulo: 'Revisar PR', tipo: 'trabajo' }, 'mas'],
  ['#e algo', { titulo: 'algo', tipo: 'estudio' }, 'mas'], // ambiguo (estudio/entreno): el primero de tipos.md
  ['#en correr', { titulo: 'correr', tipo: 'entreno' }, 'mas'],
  ['#p blog', { titulo: 'blog', tipo: 'proyectos' }, 'mas'],
  ['#Est leer', { titulo: 'leer', tipo: 'estudio' }, 'mas'],
  ['#éstudio leer', { titulo: 'leer', tipo: 'estudio' }, 'mas'],
  ['#xyz leer', { titulo: '#xyz leer' }, 'hoy'], // prefijo inexistente: se queda en el título
  ['# leer', { titulo: '# leer' }, 'hoy'],
  ['leer #est #trab', { titulo: 'leer #trab', tipo: 'estudio' }, 'mas'], // solo el primero
  ['Comprar pan hoy', { titulo: 'Comprar pan', fecha: HOY }, 'hoy'],
  ['Comprar pan HOY #pers', { titulo: 'Comprar pan', fecha: HOY, tipo: 'personal' }, 'hoy'],
  ['Comprar pan mañana', { titulo: 'Comprar pan', fecha: '2026-11-03' }, 'mas'],
  ['Comprar pan manana', { titulo: 'Comprar pan', fecha: '2026-11-03' }, 'mas'],
  ['Comprar pan MAÑANA', { titulo: 'Comprar pan', fecha: '2026-11-03' }, 'mas'],
  ['Cena lun', { titulo: 'Cena', fecha: HOY }, 'hoy'],
  ['Cena lunes', { titulo: 'Cena', fecha: HOY }, 'hoy'],
  ['Cena mar', { titulo: 'Cena', fecha: '2026-11-03' }, 'mas'],
  ['Cena martes', { titulo: 'Cena', fecha: '2026-11-03' }, 'mas'],
  ['Cena mié', { titulo: 'Cena', fecha: '2026-11-04' }, 'mas'],
  ['Cena mie', { titulo: 'Cena', fecha: '2026-11-04' }, 'mas'],
  ['Cena miércoles', { titulo: 'Cena', fecha: '2026-11-04' }, 'mas'],
  ['Cena jue', { titulo: 'Cena', fecha: '2026-11-05' }, 'mas'],
  ['Cena viernes', { titulo: 'Cena', fecha: '2026-11-06' }, 'mas'],
  ['Cena sábado', { titulo: 'Cena', fecha: '2026-11-07' }, 'mas'],
  ['Cena sabado', { titulo: 'Cena', fecha: '2026-11-07' }, 'mas'],
  ['Cena SÁB', { titulo: 'Cena', fecha: '2026-11-07' }, 'mas'],
  ['Cena dom', { titulo: 'Cena', fecha: '2026-11-08' }, 'mas'],
  ['Cena domingo', { titulo: 'Cena', fecha: '2026-11-08' }, 'mas'],
  ['Revisar contrato 20/11', { titulo: 'Revisar contrato', fecha: '2026-11-20' }, 'mas'],
  ['Revisar contrato 2/11', { titulo: 'Revisar contrato', fecha: HOY }, 'hoy'],
  ['Revisar contrato 02/11', { titulo: 'Revisar contrato', fecha: HOY }, 'hoy'],
  ['Revisar contrato 15/01', { titulo: 'Revisar contrato', fecha: '2027-01-15' }, 'mas'], // ya pasó: el año que viene
  ['Revisar contrato 1/11', { titulo: 'Revisar contrato', fecha: '2027-11-01' }, 'mas'], // ayer: el año que viene
  ['Revisar contrato 31/04', { titulo: 'Revisar contrato 31/04' }, 'hoy'], // fecha imposible: se queda
  ['Revisar contrato 29/02', { titulo: 'Revisar contrato', fecha: '2028-02-29' }, 'mas'], // el próximo 29 de febrero
  ['Urgente !', { titulo: 'Urgente', prioridad: true }, 'hoy'],
  ['! Urgente', { titulo: 'Urgente', prioridad: true }, 'hoy'],
  ['Hola!', { titulo: 'Hola!' }, 'hoy'],
  ['Algo !!', { titulo: 'Algo !!' }, 'hoy'],
  ['Leer 45m', { titulo: 'Leer', dur: 45 }, 'hoy'],
  ['Leer 2h', { titulo: 'Leer', dur: 120 }, 'hoy'],
  ['Leer 2H', { titulo: 'Leer', dur: 120 }, 'hoy'],
  ['Leer 1h30', { titulo: 'Leer', dur: 90 }, 'hoy'],
  ['Leer 1h30m', { titulo: 'Leer', dur: 90 }, 'hoy'],
  ['Leer 90min', { titulo: 'Leer', dur: 90 }, 'hoy'],
  ['Leer 45 m', { titulo: 'Leer 45 m' }, 'hoy'],
  ['Leer 0m', { titulo: 'Leer 0m' }, 'hoy'],
  ['Aprender Rust algún día', { titulo: 'Aprender Rust', algunDia: true }, 'algun'],
  ['Aprender Rust algun dia', { titulo: 'Aprender Rust', algunDia: true }, 'algun'],
  ['Aprender Rust ALGÚN DÍA #est', { titulo: 'Aprender Rust', algunDia: true, tipo: 'estudio' }, 'algun'],
  ['algún día hoy Rust', { titulo: 'Rust', algunDia: true, fecha: HOY }, 'algun'],
  ['Simulacro MLA-C01 #est jue 1h30 !', { titulo: 'Simulacro MLA-C01', tipo: 'estudio', fecha: '2026-11-05', dur: 90, prioridad: true }, 'mas'],
  ['#pers mañana ! 30m', { titulo: '', tipo: 'personal', fecha: '2026-11-03', prioridad: true, dur: 30 }, 'mas'],
  ['hoy', { titulo: '', fecha: HOY }, 'hoy'],
  ['   ', { titulo: '' }, 'hoy'],
  ['Ir mar y jue', { titulo: 'Ir y jue', fecha: '2026-11-03' }, 'mas'], // solo la primera fecha
  ['Martes de carnaval', { titulo: 'de carnaval', fecha: '2026-11-03' }, 'mas'], // un día de la semana es fecha esté donde esté (D11)
  ['Ir al mar', { titulo: 'Ir al', fecha: '2026-11-03' }, 'mas'], // también «mar» (D11)
  ['Leer <script>alert(1)</script>', { titulo: 'Leer <script>alert(1)</script>' }, 'hoy'],
  ['Reunión 😀 con Ñandú', { titulo: 'Reunión 😀 con Ñandú' }, 'hoy'],
  ['Pagar | algo', { titulo: 'Pagar | algo' }, 'hoy'],
];

test(`captura: ${CASOS.length} casos de la tabla`, () => {
  assert.ok(CASOS.length >= 60);
  for (const [texto, esperado, destino] of CASOS) {
    const r = parsearCaptura(texto, { tipos: TIPOS, hoy: HOY });
    const completo = { titulo: '', tipo: null, fecha: null, prioridad: false, dur: null, algunDia: false, ...esperado };
    assert.deepEqual(r, completo, texto);
    assert.equal(destinoCaptura(r, { hoy: HOY, abiertasHoy: 2, limite: 5 }), destino, `destino de ${texto}`);
  }
});

test('captura con Hoy lleno: lo que iría a Hoy va a Más adelante (con la fecha de hoy si la tenía)', () => {
  for (const texto of ['Llamar', 'Llamar hoy', 'Llamar hoy #pers']) {
    const r = parsearCaptura(texto, { tipos: TIPOS, hoy: HOY });
    assert.equal(destinoCaptura(r, { hoy: HOY, abiertasHoy: 5, limite: 5 }), 'mas', texto);
  }
  const r = parsearCaptura('Llamar hoy', { tipos: TIPOS, hoy: HOY });
  assert.equal(tareaDeCaptura(r, 'mas', HOY).fecha, HOY);
  assert.equal(tareaDeCaptura(r, 'hoy', HOY).fecha, null);
  assert.equal(destinoCaptura(parsearCaptura('Rust algún día', { tipos: TIPOS, hoy: HOY }), { hoy: HOY, abiertasHoy: 9, limite: 5 }), 'algun');
});

// ---------- Carriles ----------

const b = (inicio, fin, extra = {}) => ({ dia: 0, inicio: inicio * 60, fin: fin * 60, ...extra });

test('carriles: cadenas de 2, 3 y 5, idénticos y uno dentro de otro', () => {
  const lanes = (bs) => carriles(bs).map((x) => [x.carril, x.n, x.solapa]);
  assert.deepEqual(lanes([b(9, 10), b(9.5, 11)]), [[0, 2, true], [1, 2, true]]);
  assert.deepEqual(lanes([b(9, 10), b(9.5, 11), b(10.5, 12)]), [[0, 2, true], [1, 2, true], [0, 2, true]]);
  // cinco encadenados: cada uno pisa al siguiente → bastan 2 carriles
  assert.deepEqual(lanes([b(9, 10), b(9.5, 10.5), b(10, 11), b(10.5, 11.5), b(11, 12)]).map((x) => x[0]), [0, 1, 0, 1, 0]);
  // cinco a la vez → 5 carriles
  assert.deepEqual(lanes(Array.from({ length: 5 }, () => b(9, 10))).map((x) => x[0]), [0, 1, 2, 3, 4]);
  assert.equal(contarSolapes(Array.from({ length: 5 }, () => b(9, 10))), 10);
  // contenido en otro
  assert.deepEqual(lanes([b(9, 13), b(10, 11)]), [[0, 2, true], [1, 2, true]]);
  // uno que solo toca al siguiente no solapa, pero el del medio sí con los dos
  const r = carriles([b(9, 10), b(9.5, 10.5), b(10, 11)]);
  assert.deepEqual(r.map((x) => x.solapa), [true, true, true]);
  assert.deepEqual(carriles([b(9, 10), b(10, 11)]).map((x) => x.solapa), [false, false]);
  assert.deepEqual(carriles([]), []);
});

// ---------- Capacidad ----------

test('capacidad: límites exactos (= capacidad, = capacidad + 15) y días vacíos', () => {
  assert.equal(nivelOcupacion(70, 70), 'ok');
  assert.equal(nivelOcupacion(70.0001, 70), 'aviso');
  assert.equal(nivelOcupacion(85, 70), 'aviso');
  assert.equal(nivelOcupacion(85.0001, 70), 'exceso');
  const ajustes = { ...m.AJUSTES_DEFECTO, horas: { desde: 8, hasta: 18 }, capacidad: 70 }; // 600 min visibles
  assert.deepEqual(ocupacionDia([], 3, ajustes), { minutos: 0, disponibles: 600, pct: 0, nivel: 'ok' });
  assert.equal(ocupacionDia([b(8, 15)], 0, ajustes).nivel, 'ok'); // 70 %
  assert.equal(ocupacionDia([b(8, 16.5)], 0, ajustes).nivel, 'aviso'); // 85 %
  assert.equal(ocupacionDia([b(8, 17)], 0, ajustes).nivel, 'exceso'); // 90 %
  assert.equal(ocupacionDia([b(6, 20)], 0, ajustes).minutos, 600); // recortado a lo visible
  assert.equal(ocupacionDia([b(8, 18, { sugerido: true })], 0, ajustes).minutos, 0);
  const foco = { ...ajustes, foco_max: 3 };
  assert.deepEqual(estudioDia([b(9, 12, { tipo: 'estudio' })], 0, TIPOS, foco), { minutos: 180, aviso: false });
  assert.deepEqual(estudioDia([b(9, 12.5, { tipo: 'estudio' })], 0, TIPOS, foco), { minutos: 210, aviso: true });
  assert.deepEqual(estudioDia([], 0, TIPOS, foco), { minutos: 0, aviso: false });
});

// ---------- Semanas ----------

test('semanas: todos los estados, solo lectura y plantilla solo para semanas nuevas', () => {
  const actual = '2026-W45';
  const conEstado = (v, bloques = []) => { const d = fsem.vacia('2026-W45', v); d.lineas.push(...bloques); return d; };
  const plantillaBlk = fsem.bloque({ dia: 0, inicio: 540, fin: 600, tipo: 'trabajo', titulo: 'T', plantilla: true });
  const normal = fsem.bloque({ dia: 1, inicio: 540, fin: 600, tipo: 'personal', titulo: 'P' });
  const sug = fsem.bloque({ dia: 1, inicio: 600, fin: 660, tipo: 'estudio', titulo: 'S', sugerido: true });
  const tabla = [
    ['2026-W44', null, 'sin datos'], ['2026-W46', null, 'sin planificar'],
    ['2026-W45', conEstado('planificada'), 'en curso'], ['2026-W44', conEstado('en curso'), 'sin cerrar'],
    ['2026-W44', conEstado('cerrada'), 'cerrada'], ['2026-W45', conEstado('cerrada'), 'cerrada'],
    ['2026-W44', conEstado('reabierta'), 'reabierta'], ['2026-W45', conEstado('reabierta'), 'reabierta'],
    ['2026-W46', conEstado('planificada', [plantillaBlk]), 'solo plantilla'], ['2026-W46', conEstado('planificada', [plantillaBlk, sug]), 'solo plantilla'],
    ['2026-W46', conEstado('solo plantilla', [plantillaBlk, normal]), 'planificada'], ['2026-W46', conEstado('solo plantilla'), 'solo plantilla'],
  ];
  for (const [id, doc, esperado] of tabla) assert.equal(estadoSemana(id, doc, actual), esperado, `${id} ${doc && m.estadoGuardado(doc)}`);
  assert.deepEqual(['cerrada', 'sin datos', 'en curso', 'reabierta', 'sin cerrar'].map(soloLectura), [true, true, false, false, false]);
  // cambiar la plantilla no toca semanas existentes; la próxima semana nueva ya la usa
  const mu = mundoEjemplo();
  mu.ficheros['semanas/2026-W46.md'] = null;
  const ctx = { hoy: '2026-11-02' };
  const r = aplicar(mu, { op: 'plantilla.crear', args: { dias: [2], inicio: 420, fin: 450, tipo: 'personal', titulo: 'Meditar' } }, ctx);
  assert.deepEqual(r.tocados, ['plantilla.md']);
  const w46 = aplicar(r.mundo, { op: 'semana.crear', args: { semana: '2026-W46' } }, ctx).mundo.ficheros['semanas/2026-W46.md'];
  assert.ok(m.bloquesDe(w46).some((x) => x.titulo === 'Meditar' && x.plantilla));
  assert.ok(!m.bloquesDe(mu.ficheros['semanas/2026-W45.md']).some((x) => x.titulo === 'Meditar'));
  assert.deepEqual(m.bloquesDe(crearDesdePlantilla('2026-W46', null, actual)), []);
});

// ---------- Progreso ----------

test('progreso: llevas/te faltan en 49, 50 y 51 %, sin examen ni total, previo, simulacros vacíos, mediana y ánimo sin diario', () => {
  assert.equal(encuadre(49, 100), 'llevas');
  assert.equal(encuadre(50, 100), 'faltan');
  assert.equal(encuadre(51, 100), 'faltan');
  assert.equal(encuadre(10, 0), 'llevas');
  assert.equal(mediana([5]), 5);
  assert.equal(mediana([1, 9]), 5);
  assert.equal(mediana([9, 1, 5]), 5);
  assert.equal(mediana([]), null);
  const sinNada = { nombre: 'X', horasSemana: 3, examen: null, inicio: null, total: null, previo: 0, simulacros: [] };
  const [c] = certificaciones({ temas: [sinNada], docsSemanas: {}, tipos: TIPOS, hoy: '2026-11-02', actual: '2026-W45' });
  assert.deepEqual([c.soloSemanal, c.esperado, c.diferencia, c.encuadre, c.simulacros, c.sinSimulacro, c.acumulado], [true, null, null, null, [], null, 0]);
  const conPrevio = { ...sinNada, previo: 12.5, total: 40, examen: '2026-12-12', inicio: '2026-09-14' };
  const [p] = certificaciones({ temas: [conPrevio], docsSemanas: {}, tipos: TIPOS, hoy: '2026-11-02', actual: '2026-W45' });
  assert.deepEqual([p.acumulado, p.encuadre, p.soloSemanal], [750, 'llevas', false]);
  assert.equal(esperado({ total: 10, inicio: '2026-11-02', examen: '2026-11-02' }, '2026-11-01'), 600); // inicio = examen: no divide por cero
  assert.equal(semanasSinSimulacro({ simulacros: [{ nota: 70, fecha: null }], inicio: null }, '2026-11-02'), null);
  assert.deepEqual(animoPorSemana({}, '2026-W45', 3), [null, null, null]);
  assert.equal(animoYEstudio([600, 300, 0], [null, null, null]), null);
  const vacio = calcularProgreso({ docsSemanas: {}, temas: [], tipos: TIPOS, diarios: {}, hoy: '2026-11-02', actual: '2026-W45' });
  assert.deepEqual([vacio.ultimaCerrada, vacio.planReal, vacio.comparacion, vacio.meta, vacio.semanasConEstudio, vacio.lecciones], [null, [], null, 0, 0, []]);
  assert.equal(vacio.rejilla.length, 16);
});

// ---------- Temas ----------

test('tema personalizado incompleto o inválido', () => {
  const a = { ...m.AJUSTES_DEFECTO, tema: 'personalizado' };
  assert.deepEqual(atributosTema(a, null, '2026-11-02'), { tema: 'nordico-claro', personalizado: true, deco: 'sí', css: '' });
  const sinBase = parsear('tema.md', '- acento: #FF00AA\n');
  assert.equal(atributosTema(a, sinBase, '2026-11-02').tema, 'nordico-claro');
  const malo = parsear('tema.md', '- base: rosa\n- fondo: red; } body { color: red\n- acento: </style><script>\n- texto: #111\n- inventado: #222\n');
  const r = atributosTema(a, malo, '2026-11-02');
  assert.deepEqual([r.tema, r.css], ['nordico-claro', '--texto: #111;']);
  assert.equal(m.desconocidas(malo).length, 4);
  assert.equal(serializar(malo), '- base: rosa\n- fondo: red; } body { color: red\n- acento: </style><script>\n- texto: #111\n- inventado: #222\n');
});

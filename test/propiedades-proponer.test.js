// Q2 · Proponer semana sobre cientos de semanas aleatorias: todas las reglas del plan (§4.4) siempre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proponer, necesidades, COLCHON } from '../src/core/proponer.js';
import { semanasSinSimulacro } from '../src/core/progreso.js';
import { minutosVisibles } from '../src/core/capacidad.js';
import { aplicar } from '../src/core/ops.js';
import { serializar } from '../src/core/formato/index.js';
import * as fsem from '../src/core/formato/semana.js';
import { estudio as festudio, proyectos as fproyectos, vacio } from '../src/core/formato/listas.js';
import * as f from '../src/core/fechas.js';
import * as m from '../src/core/modelo.js';
import { paraCada } from './azar.js';

const TIPOS = m.TIPOS_DEFECTO;
const NOMBRES = ['AI-102', 'MLA-C01', 'Curso', 'Inglés', 'Rust', 'huddle', 'gymhub', 'blog'];
const esEst = (tipo) => m.esEstudio(TIPOS, tipo);

function escenario(azar) {
  const desde = azar.entero(5, 10), hasta = azar.entero(Math.max(desde + 8, 20), 24);
  const ajustes = {
    ...m.AJUSTES_DEFECTO, capacidad: azar.entero(10, 20) * 5, horas: { desde, hasta }, cierre: azar.entero(19 * 2, 48) * 30,
    foco_max: azar.entero(2, 10) / 2, mejores_horas: azar.elegir(['sin preferencia', 'mañanas', 'tardes', 'noches']), margen: azar.elegir(['auto', 'fijo']),
  };
  const id = azar.elegir(['2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W53', '2027-W01']);
  const hoy = f.sumarDias(f.lunesDe(id), azar.entero(-10, 12));
  const nombres = azar.algunos(NOMBRES, 0.5);
  const temas = nombres.slice(0, azar.entero(0, nombres.length)).map((nombre) => ({
    nombre, horasSemana: azar.entero(0, 16) / 2, examen: azar.bool(0.7) ? f.sumarDias(hoy, azar.entero(-20, 120)) : null,
    inicio: azar.bool(0.7) ? f.sumarDias(hoy, -azar.entero(0, 60)) : null, total: null, previo: 0,
    simulacros: azar.lista(0, 3, () => ({ nota: azar.entero(40, 95), fecha: f.sumarDias(hoy, -azar.entero(0, 50)) })), dejado: null,
  }));
  const proyectos = nombres.filter((n) => !temas.some((t) => t.nombre === n)).map((nombre) => ({ nombre, siguiente: azar.bool(0.8) ? 'siguiente paso' : null, estado: azar.bool(0.8) ? 'activo' : 'pausado' }));
  const doc = fsem.vacia(id, 'planificada');
  doc.lineas.splice(4, 0, ...azar.lista(0, 3, () => fsem.objetivo3({ texto: 'x', rel: azar.bool(0.7) ? azar.elegir(NOMBRES) : null })));
  if (azar.bool(0.7)) for (const dia of [0, 1, 2, 3, 4]) doc.lineas.push(fsem.bloque({ dia, inicio: 540, fin: azar.elegir([1050, 1080, 840]), tipo: 'trabajo', titulo: 'Trabajo', plantilla: true }));
  doc.lineas.push(...azar.lista(0, 12, () => {
    const inicio = azar.entero(desde * 2, hasta * 2 - 1) * 30;
    const tema = azar.elegir([...NOMBRES, 'Gimnasio']);
    return fsem.bloque({
      dia: azar.entero(0, 6), inicio, fin: Math.min(1440, inicio + azar.entero(1, 6) * 30), tipo: tema === 'Gimnasio' ? 'entreno' : azar.elegir(['estudio', 'proyectos', 'personal']),
      titulo: `${tema} · algo`, subtipo: azar.bool(0.1) ? 'simulacro' : null, sugerido: azar.bool(0.15),
    });
  }));
  const factores = Object.fromEntries(TIPOS.map((t) => [t.nombre, { factor: azar.entero(7, 20) / 10, muestras: azar.entero(0, 12) }]));
  for (const x of Object.values(factores)) if (x.muestras < 5) x.factor = 1;
  return { id, doc, temas, proyectos, ajustes, tipos: TIPOS, factores, hoy, ahora: azar.bool(0.5) ? azar.entero(0, 1439) : null };
}

const choca = (a, b) => a.dia === b.dia && a.inicio < b.fin + COLCHON && a.fin > b.inicio - COLCHON;

test('reglas de Proponer en 400 semanas aleatorias', () => {
  let colocados = 0, conNoCaben = 0;
  paraCada(400, (azar) => {
    const e = escenario(azar);
    const r = proponer(e);
    assert.deepEqual(proponer(e), r, 'determinista');
    const existentes = m.bloquesDe(e.doc).filter((b) => !b.sugerido);
    const actual = f.semanaDe(e.hoy);
    const disponibles = (e.ajustes.horas.hasta - e.ajustes.horas.desde) * 60;
    if (e.id < actual) { assert.deepEqual(r, { bloques: [], noCaben: [] }, 'semana pasada: nada'); return; }
    colocados += r.bloques.length;
    if (r.noCaben.length) conNoCaben++;
    for (const [i, b] of r.bloques.entries()) {
      assert.ok(b.sugerido);
      assert.ok(b.inicio >= e.ajustes.horas.desde * 60 && b.fin <= Math.min(e.ajustes.horas.hasta * 60, e.ajustes.cierre), 'dentro de horas y antes del cierre');
      assert.ok(b.fin - b.inicio >= 30 && b.fin - b.inicio <= 150, 'reserva entre 30 min y 2,5 h');
      for (const o of [...existentes, ...r.bloques.slice(0, i)]) assert.ok(!choca(b, o), `${b.titulo} choca con ${o.titulo} (colchón ${COLCHON} min)`);
      if (e.id === actual) {
        const hoyIdx = f.diaSemana(e.hoy);
        assert.ok(b.dia >= hoyIdx, 'nunca en días pasados');
        if (b.dia === hoyIdx && e.ahora != null) assert.ok(b.inicio >= e.ahora, 'hoy, nunca antes de ahora');
      }
    }
    for (let dia = 0; dia < 7; dia++) {
      const nuevos = r.bloques.filter((b) => b.dia === dia);
      if (!nuevos.length) continue;
      const todos = [...existentes.filter((b) => b.dia === dia), ...nuevos];
      const temasDia = nuevos.map((b) => m.normalizar(m.temaDe(b.titulo)));
      assert.equal(new Set(temasDia).size, temasDia.length, 'dos veces el mismo tema en un día');
      for (const t of temasDia) assert.ok(!existentes.some((b) => b.dia === dia && m.normalizar(m.temaDe(b.titulo)) === t), 'tema ya presente ese día');
      const ocupado = todos.reduce((s, b) => s + minutosVisibles(b, e.ajustes.horas), 0);
      assert.ok((ocupado / disponibles) * 100 <= e.ajustes.capacidad + 10 + 1e-9, 'capacidad + 10 %');
      if (nuevos.some((b) => esEst(b.tipo))) assert.ok(todos.filter((b) => esEst(b.tipo)).reduce((s, b) => s + b.fin - b.inicio, 0) <= e.ajustes.foco_max * 60, 'foco máximo');
    }
    // necesidades: piezas ≥ 1 h, simulacro cuando toca y orden ★ → examen → proyectos (por rondas)
    const n = necesidades(e);
    assert.ok(n.every((x) => x.minutos >= 60 && x.minutos <= 90), 'piezas de 1 a 1,5 h');
    const clave = (x) => [x.rel ? 0 : 1, x.clase, x.pieza, x.examen ?? '9999'];
    for (let i = 1; i < n.length; i++) {
      const [a, b] = [clave(n[i - 1]), clave(n[i])];
      const cmp = a.findIndex((v, k) => v !== b[k]);
      assert.ok(cmp < 0 || a[cmp] < b[cmp], `orden: ${JSON.stringify(a)} antes que ${JSON.stringify(b)}`);
    }
    const referencia = e.hoy > f.lunesDe(e.id) ? e.hoy : f.lunesDe(e.id);
    for (const t of e.temas) {
      const piezas = n.filter((x) => x.tema === t.nombre);
      const yaSim = existentes.some((b) => b.subtipo === 'simulacro' && m.mismoTema(m.temaDe(b.titulo), t.nombre));
      const sin = semanasSinSimulacro(t, referencia);
      if (piezas.length) assert.equal(piezas[0].subtipo === 'simulacro', sin != null && sin >= 2 && !yaSim, `simulacro de ${t.nombre}`);
    }
    // lo que no cabe se lista: con margen fijo, piezas colocadas + no caben = necesidades
    const minutosPorTema = (lista) => lista.reduce((acc, x) => ({ ...acc, [x.tema]: (acc[x.tema] ?? 0) + x.minutos }), {});
    const pedido = minutosPorTema(n), sobra = minutosPorTema(r.noCaben);
    for (const [tema, min] of Object.entries(sobra)) assert.ok(min <= pedido[tema], `no caben más minutos de ${tema} de los pedidos`);
    if (e.ajustes.margen === 'fijo') {
      const puesto = r.bloques.reduce((acc, b) => ({ ...acc, [m.temaDe(b.titulo)]: (acc[m.temaDe(b.titulo)] ?? 0) + b.fin - b.inicio }), {});
      for (const tema of Object.keys(pedido)) assert.equal((puesto[tema] ?? 0) + (sobra[tema] ?? 0), pedido[tema], `cuentas de ${tema}`);
    }
  });
  assert.ok(colocados > 1000 && conNoCaben > 20, `${colocados} colocados, ${conNoCaben} con «no caben»`);
});

test('semana.proponer: no toca semanas cerradas ni pasadas y deshacer lo quita todo', () => {
  paraCada(150, (azar) => {
    const e = escenario(azar);
    const est = vacio('estudio');
    for (const t of e.temas) {
      est.lineas.push({ t: 'h2', texto: t.nombre, seccion: t.nombre }, festudio.kv('horas_semana', t.horasSemana));
      if (t.examen) est.lineas.push(festudio.kv('examen', t.examen));
    }
    const pro = vacio('proyectos');
    for (const p of e.proyectos) pro.lineas.push({ t: 'h2', texto: p.nombre, seccion: p.nombre }, fproyectos.kv('estado', p.estado));
    const ruta = `semanas/${e.id}.md`;
    const cerrar = azar.bool(0.2);
    if (cerrar) e.doc.lineas[1] = fsem.estado('cerrada');
    const mundo = { ficheros: { [ruta]: e.doc, 'estudio.md': est, 'proyectos.md': pro, 'ajustes.md': null, 'tipos.md': null, 'plantilla.md': null } };
    const ctx = { hoy: e.hoy, ahora: e.ahora, factores: e.factores };
    if (cerrar || e.id < f.semanaDe(e.hoy)) { assert.throws(() => aplicar(mundo, { op: 'semana.proponer', args: { semana: e.id } }, ctx), /cerrada|pasadas|solo lectura/); return; }
    const r = aplicar(mundo, { op: 'semana.proponer', args: { semana: e.id } }, ctx);
    assert.ok(m.bloquesDe(r.mundo.ficheros[ruta]).filter((b) => !b.sugerido).every((b) => m.bloquesDe(e.doc).some((o) => m.huellaDe(o) === m.huellaDe(b))), 'no mueve ni cambia lo que ya había');
    assert.equal(serializar(aplicar(r.mundo, r.inversa, ctx).mundo.ficheros[ruta]), serializar(e.doc), 'deshacer lo quita todo');
  });
});

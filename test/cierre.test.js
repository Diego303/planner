import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar } from '../src/core/ops.js';
import { serializar } from '../src/core/formato/index.js';
import { prepararCierre, resumenSemana, estadoSemana } from '../src/core/semanas.js';
import { factores } from '../src/core/factor.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const HOY = '2026-11-02';

function mundo() {
  const mu = mundoEjemplo();
  const vacios = ['tema.md', 'archivo/tareas-2026-10.md', 'archivo/tareas-2026-11.md', 'archivo/inbox-2026-11.md', 'semanas/2026-W46.md'];
  for (const d of ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']) vacios.push(`diario/${d}.md`);
  for (const r of vacios) mu.ficheros[r] ??= null;
  return mu;
}
const docsDe = (mu) => Object.fromEntries(Object.entries(mu.ficheros).filter(([r, d]) => r.startsWith('semanas/') && d).map(([r, d]) => [r.slice(8, -3), d]));

function preparar(mu, id = '2026-W44') {
  const f = mu.ficheros;
  const docs = docsDe(mu);
  const tipos = m.tiposDe(f['tipos.md']);
  const diarios = Object.fromEntries(Object.entries(f).filter(([r]) => r.startsWith('diario/')).map(([r, d]) => [r.slice(7, -3), d]));
  return prepararCierre({ id, actual: '2026-W45', hoy: HOY, docsSemanas: docs, tipos, tareasDocs: [f['tareas.md']], tareasDoc: f['tareas.md'], estudioDoc: f['estudio.md'], proyectosDoc: f['proyectos.md'], inboxDoc: f['inbox.md'], diarios, factores: factores(docs, tipos, '2026-W45') });
}

/** Decisiones de ejemplo: una por fila con su primera opción, salvo «mantener» en las antiguas. */
function decidir(p) {
  return p.pendientes.map((f) => ({ clase: f.clase, id: f.id, huella: f.huella, tema: f.tema, minutos: f.minutos, nombre: f.nombre,
    opcion: f.clase === 'antigua' ? 'archivar' : f.clase === 'proyecto' ? 'pausar' : f.opciones[0][0] }));
}

test('preparar el cierre: resumen, pendientes de cada clase y valores de la semana nueva', () => {
  const mu = mundo();
  const p = preparar(mu);
  assert.equal(p.nueva, '2026-W45');
  assert.match(p.resumen.texto, /^estudio: [\d,]+\/[\d,]+ h · proyectos: [\d,]+\/[\d,]+ h · entreno: 6\/6 h · personal: [\d,]+\/0,5 h · tareas: \d+ · ánimo: 3,2$/);
  const clases = new Set(p.pendientes.map((x) => x.clase));
  for (const c of ['horas', 'tarea', 'antigua', 'proyecto', 'inbox']) assert.ok(clases.has(c), c);
  assert.deepEqual(p.siguiente.las3.map((o) => o.texto), ['Entregar el lab de RAG', 'Simulacro MLA-C01 ≥ 70 %', 'Cerrar la demo del agente']);
  assert.ok(p.siguiente.horas.every((h) => typeof h.acumulado === 'number'));
});

test('cerrar → reabrir → cerrar no duplica ni pierde nada', () => {
  const ctx = { hoy: HOY, ahora: 10 * 60 };
  let mu = mundo();
  ctx.factores = factores(docsDe(mu), m.tiposDe(mu.ficheros['tipos.md']), '2026-W45');
  // un bloque no hecho en la 44 para decidir «a la semana nueva» y «más adelante»
  mu = aplicar(mu, { op: 'linea.cambiar', args: { ruta: 'semanas/2026-W44.md', indice: 0, cambios: {} } }, ctx).mundo;
  const w44 = mu.ficheros['semanas/2026-W44.md'];
  const extra = aplicar(mu, { op: 'lineas.insertar', args: { ruta: 'semanas/2026-W44.md', indice: w44.lineas.length, lineas: [
    { t: 'bloque', dia: 1, inicio: 1200, fin: 1290, tipo: 'estudio', titulo: 'Curso · lab RAG', subtipo: 'aprender', paso: null, hecho: null, nota: null, plantilla: false, sugerido: false, extra: [], comentario: null },
    { t: 'bloque', dia: 3, inicio: 1260, fin: 1320, tipo: 'personal', titulo: 'Llamar al banco', subtipo: null, paso: null, hecho: null, nota: null, plantilla: false, sugerido: true, extra: [], comentario: null },
  ] } }, ctx).mundo;
  mu = extra;
  const p = preparar(mu);
  const decisiones = decidir(p);
  assert.ok(decisiones.some((d) => d.clase === 'bloque'));
  const args = {
    semana: '2026-W44', lecciones: { funciono: 'Bloques cortos', cambio: 'Nada los jueves' }, decisiones,
    proyectos: [{ nombre: 'huddle', siguiente: 'probar con usuarios' }],
    siguiente: { las3: [{ texto: 'Entregar el lab de RAG', rel: 'Curso', si: 'llego tarde', entonces: 'el sábado' }, { texto: 'Simulacro MLA-C01 ≥ 70 %', rel: 'MLA-C01' }], horas: { 'AI-102': 6, 'MLA-C01': 3, 'Curso': 6 } },
  };
  const r1 = aplicar(mu, { op: 'semana.cerrar', args }, ctx);
  const f1 = r1.mundo.ficheros;
  const w44t = serializar(f1['semanas/2026-W44.md']);
  assert.match(w44t, /^estado: cerrada$/m);
  assert.match(w44t, /^- funcionó: Bloques cortos$/m);
  assert.ok(!/sugerido/.test(w44t), 'sin sugerencias');
  assert.equal(estadoSemana('2026-W44', f1['semanas/2026-W44.md'], '2026-W45'), 'cerrada');
  const w45t = serializar(f1['semanas/2026-W45.md']);
  assert.match(w45t, /^## Estudio\n- AI-102: 6 h$/m);
  assert.match(w45t, /^- \[ \] Entregar el lab de RAG \| rel: Curso \| si: llego tarde \| entonces: el sábado$/m);
  assert.equal(m.las3De(f1['semanas/2026-W45.md']).length, 2);
  // sin `rel` en la petición se conserva el que ya tenía
  const sinRel = aplicar(mu, { op: 'semana.cerrar', args: { ...args, siguiente: { ...args.siguiente, las3: [{ texto: 'Cerrar la demo del agente' }] } } }, ctx);
  assert.equal(m.las3De(sinRel.mundo.ficheros['semanas/2026-W45.md'])[0].rel, 'agente soporte');
  assert.ok(r1.resultado.n > 0);
  assert.equal(m.notasInbox(f1['inbox.md']).length, 0);
  assert.equal(m.proyectosDe(f1['proyectos.md']).find((x) => x.nombre === 'gymhub').estado, 'pausado');
  assert.equal(m.proyectosDe(f1['proyectos.md']).find((x) => x.nombre === 'huddle').siguiente, 'probar con usuarios');

  // reabrir no toca la semana siguiente
  const r2 = aplicar(r1.mundo, { op: 'semana.reabrir', args: { semana: '2026-W44' } }, ctx);
  assert.deepEqual(r2.tocados, ['semanas/2026-W44.md']);
  assert.equal(serializar(r2.mundo.ficheros['semanas/2026-W45.md']), w45t);

  // volver a cerrar con lo que pida ahora el asistente: mismos ficheros
  const p2 = preparar(r2.mundo);
  const r3 = aplicar(r2.mundo, { op: 'semana.cerrar', args: { ...args, decisiones: decidir(p2) } }, ctx);
  for (const ruta of Object.keys(f1)) {
    assert.equal(r3.mundo.ficheros[ruta] && serializar(r3.mundo.ficheros[ruta]), f1[ruta] && serializar(f1[ruta]), ruta);
  }
  // y todo el cierre se puede deshacer
  const vuelta = aplicar(r1.mundo, r1.inversa, ctx).mundo;
  for (const ruta of r1.tocados) assert.equal(vuelta.ficheros[ruta] && serializar(vuelta.ficheros[ruta]), mu.ficheros[ruta] && serializar(mu.ficheros[ruta]), ruta);
});

test('resumen: horas reales por tipo, tareas hechas en la semana y ánimo medio', () => {
  const mu = mundo();
  const r = resumenSemana({ id: '2026-W43', doc: mu.ficheros['semanas/2026-W43.md'], tipos: m.tiposDe(mu.ficheros['tipos.md']) });
  assert.equal(r.porTipo.find((x) => x.tipo === 'entreno').real, 6 * 60);
  assert.ok(!r.porTipo.some((x) => x.tipo === 'trabajo'));
  assert.match(r.texto, / · tareas: 0 · ánimo: —$/);
});

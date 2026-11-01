// Proponer semana (§4.4). Determinista: misma entrada → mismas sugerencias. Nunca solapa, nunca el mismo tema
// dos veces en un día, nunca en semanas cerradas ni en días pasados.
import { lunesDe, semanaDe, compararSemanas, diaSemana } from './fechas.js';
import { bloquesDe, las3De, temaDe, mismoTema, tipoPorNombre, tipoEstudio, tipoProyectos } from './modelo.js';
import { minutosVisibles } from './capacidad.js';
import { objetivoSemana, semanasSinSimulacro } from './progreso.js';
import { factorDe } from './factor.js';

export const COLCHON = 15; // minutos libres alrededor de cada bloque
export const MAX_RESERVA = 150; // 2,5 h

/** Piezas de 90 min; la última de 60–90; nunca < 60 (2 h → 60 + 60). */
export function trocear(minutos) {
  let r = Math.round(minutos / 30) * 30;
  const piezas = [];
  while (r >= 60) {
    if (r >= 150) { piezas.push(90); r -= 90; } else if (r <= 90) { piezas.push(r); r = 0; } else { piezas.push(60, 60); r = 0; }
  }
  return piezas;
}

const redondeo30 = (min) => Math.round(min / 30) * 30;

/** ¿El hueco [inicio, fin) choca con algún bloque (con colchón)? */
const choca = (bloques, dia, inicio, fin) => bloques.some((b) => b.dia === dia && inicio < b.fin + COLCHON && fin > b.inicio - COLCHON);

function preferencia(mejores, inicio) {
  const h = inicio / 60;
  switch (mejores) {
    case 'mañanas': return h < 13 ? 0 : 1;
    case 'tardes': return h >= 13 && h < 19 ? 0 : 1;
    case 'noches': return h >= 19 ? 0 : 1;
    default: return h >= 9 ? 0 : 1; // sin preferencia: evita madrugar
  }
}

/** Necesidades de la semana: piezas de estudio y proyectos activos sin bloque, ya ordenadas. */
export function necesidades({ doc, temas, proyectos, tipos, hoy, id }) {
  const existentes = bloquesDe(doc).filter((b) => !b.sugerido);
  const rels = las3De(doc).map((o) => o.rel).filter(Boolean);
  const avanza = (tema) => rels.some((r) => mismoTema(r, tema));
  const tEst = tipoEstudio(tipos), tPro = tipoProyectos(tipos);
  const esEst = (b) => !!tipoPorNombre(tipos, b.tipo)?.estudio;
  const lunes = lunesDe(id);
  const referencia = hoy > lunes ? hoy : lunes;
  const lista = [];
  if (tEst) {
    temas.forEach((t, orden) => {
      if (t.examen && t.examen < lunes) return; // ese examen ya pasó
      const delTema = existentes.filter((b) => mismoTema(temaDe(b.titulo), t.nombre));
      const planificado = delTema.filter(esEst).reduce((s, b) => s + b.fin - b.inicio, 0);
      const piezas = trocear(objetivoSemana(t, doc) * 60 - planificado);
      const sinSim = semanasSinSimulacro(t, referencia);
      const conSimulacro = sinSim != null && sinSim >= 2 && !delTema.some((b) => b.subtipo === 'simulacro');
      piezas.forEach((minutos, i) => {
        const subtipo = i === 0 && conSimulacro ? 'simulacro' : i % 2 ? 'repasar' : 'aprender';
        lista.push({ clase: 0, tema: t.nombre, tipo: tEst, minutos, subtipo, titulo: `${t.nombre} · ${subtipo}`, rel: avanza(t.nombre), examen: t.examen, orden: orden, pieza: i });
      });
    });
  }
  if (tPro) {
    proyectos.filter((p) => p.estado !== 'pausado').forEach((p, orden) => {
      if (existentes.some((b) => mismoTema(temaDe(b.titulo), p.nombre))) return;
      lista.push({ clase: 1, tema: p.nombre, tipo: tPro, minutos: 90, subtipo: null, titulo: p.siguiente ? `${p.nombre} · ${p.siguiente}` : p.nombre, rel: avanza(p.nombre), examen: null, orden, pieza: 0 });
    });
  }
  // ★ primero lo que avanza Las 3, luego estudio con examen más cercano, luego proyectos.
  // Las piezas van por rondas (la 1.ª de cada tema, luego la 2.ª…): así se reparte y ningún tema se queda sin nada.
  return lista.sort((a, b) => (b.rel - a.rel) || (a.clase - b.clase) || a.pieza - b.pieza
    || (a.examen ?? '9999').localeCompare(b.examen ?? '9999') || a.orden - b.orden);
}

/**
 * Propone bloques sugeridos para la semana `id`.
 * → { bloques: [{ dia, inicio, fin, tipo, titulo, subtipo, sugerido: true }], noCaben: [{ tema, minutos }] }
 */
export function proponer({ id, doc, temas, proyectos, ajustes, tipos, factores, hoy, ahora = null }) {
  const actual = semanaDe(hoy);
  if (compararSemanas(id, actual) < 0) return { bloques: [], noCaben: [] };
  const h0 = ajustes.horas.desde * 60, h1 = ajustes.horas.hasta * 60;
  const tope = Math.min(h1, ajustes.cierre);
  const disponibles = h1 - h0;
  const todos = bloquesDe(doc).filter((b) => !b.sugerido).map((b) => ({ ...b }));
  const esEst = (tipo) => !!tipoPorNombre(tipos, tipo)?.estudio;
  const hoyIdx = id === actual ? diaSemana(hoy) : -1;
  const primerDia = Math.max(0, hoyIdx);
  const trabajoLargo = todos.filter((b) => tipoPorNombre(tipos, b.tipo)?.trabajo && b.fin - b.inicio > 240);
  const bloques = [], noCaben = [];

  for (const n of necesidades({ doc, temas, proyectos, tipos, hoy, id })) {
    const reserva = ajustes.margen === 'auto'
      ? Math.min(MAX_RESERVA, Math.max(30, redondeo30(n.minutos * factorDe(factores, n.tipo))))
      : n.minutos;
    let mejor = null;
    for (let dia = primerDia; dia < 7; dia++) {
      const delDia = todos.filter((b) => b.dia === dia);
      if (delDia.some((b) => mismoTema(temaDe(b.titulo), n.tema))) continue; // nunca dos veces el mismo tema en un día
      const ocupado = delDia.reduce((s, b) => s + minutosVisibles(b, ajustes.horas), 0);
      if (((ocupado + reserva) / disponibles) * 100 > ajustes.capacidad + 10) continue;
      if (esEst(n.tipo)) {
        const estudio = delDia.filter((b) => esEst(b.tipo)).reduce((s, b) => s + b.fin - b.inicio, 0);
        if (estudio + reserva > ajustes.foco_max * 60) continue;
      }
      const mismoTipo = delDia.filter((b) => mismoTema(b.tipo, n.tipo)).reduce((s, b) => s + b.fin - b.inicio, 0);
      const desde = dia === hoyIdx && ahora != null ? Math.max(h0, Math.ceil(ahora / 30) * 30) : h0;
      for (let inicio = desde; inicio + reserva <= tope; inicio += 30) {
        if (choca(todos, dia, inicio, inicio + reserva)) continue;
        const tras = trabajoLargo.some((b) => b.dia === dia && inicio >= b.fin && inicio - b.fin <= 30) ? 1 : 0;
        const nota = [mismoTipo, preferencia(ajustes.mejores_horas, inicio), tras, dia, inicio];
        if (!mejor || menor(nota, mejor.nota)) mejor = { nota, dia, inicio };
      }
    }
    if (!mejor) { noCaben.push({ tema: n.tema, minutos: n.minutos }); continue; }
    const b = { dia: mejor.dia, inicio: mejor.inicio, fin: mejor.inicio + reserva, tipo: n.tipo, titulo: n.titulo, subtipo: n.subtipo, sugerido: true };
    bloques.push(b);
    todos.push(b);
  }
  // lo que no cabe, agrupado por tema
  const agrupado = [];
  for (const x of noCaben) {
    const g = agrupado.find((y) => y.tema === x.tema);
    if (g) g.minutos += x.minutos; else agrupado.push({ ...x });
  }
  return { bloques, noCaben: agrupado };
}

function menor(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

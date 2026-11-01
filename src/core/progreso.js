// Métricas (§4.6). Puras: reciben las semanas parseadas y la fecha de hoy.
import { sumarSemanas, compararSemanas, diasEntre, diaSemana, lunesDe, sumarDias, semanaDe } from './fechas.js';
import { bloquesDe, tipoPorNombre, temaDe, mismoTema, minutosHechos, duracion, objetivosDe, normalizar } from './modelo.js';

const esBloqueEstudio = (b, tipos) => !!tipoPorNombre(tipos, b.tipo)?.estudio;

/** Constancia (nunca rachas): días con estudio hecho esta semana y semanas con estudio de las `n` anteriores. */
export function constancia(docsSemanas, tipos, actual, n = 7) {
  const hechos = (id) => bloquesDe(docsSemanas[id]).filter((b) => b.hecho != null && esBloqueEstudio(b, tipos));
  const dias = new Set(hechos(actual).map((b) => b.dia)).size;
  let semanas = 0;
  for (let i = 1; i <= n; i++) if (hechos(sumarSemanas(actual, -i)).length) semanas++;
  return { dias, semanas, de: n };
}

/** Horas objetivo de un tema en una semana: las de `## Estudio` de la semana o `horas_semana`. */
export function objetivoSemana(tema, docSemana) {
  return objetivosDe(docSemana)[normalizar(tema.nombre)] ?? tema.horasSemana;
}

/** Planificado y hecho (minutos) de un tema en una semana (solo bloques de tipo estudio, sin sugerencias). */
export function estudioDeSemana(tema, docSemana, tipos) {
  const bs = bloquesDe(docSemana).filter((b) => !b.sugerido && esBloqueEstudio(b, tipos) && mismoTema(temaDe(b.titulo), tema.nombre));
  return {
    planificado: bs.reduce((s, b) => s + duracion(b), 0),
    hecho: bs.reduce((s, b) => s + minutosHechos(b), 0),
    objetivo: objetivoSemana(tema, docSemana) * 60,
  };
}

/** Semanas completas desde el último simulacro (o desde el inicio si no hay); null si no se sabe. */
export function semanasSinSimulacro(tema, hoy) {
  const fechas = tema.simulacros.map((s) => s.fecha).filter(Boolean).sort();
  const desde = fechas.at(-1) ?? tema.inicio;
  if (!desde) return null;
  return Math.max(0, Math.floor(diasEntre(desde, hoy) / 7));
}

/** Encuadre (Bonezzi et al.): «llevas» mientras < 50 %, «te faltan» desde el 50 %. */
export const encuadre = (hecho, objetivo) => (objetivo > 0 && hecho / objetivo >= 0.5 ? 'faltan' : 'llevas');

/** Cuándo se actualizó un proyecto, en palabras; y si está parado (> 10 días). */
export function actualizadoHace(fecha, hoy) {
  if (!fecha) return { texto: 'nuevo', parado: false };
  const d = diasEntre(fecha, hoy);
  return { texto: d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`, parado: d > 10, dias: d };
}

export { lunesDe, sumarDias, diaSemana, semanaDe, compararSemanas };

/** Minutos de estudio acumulados de un tema: `previo` + todo lo hecho en todas las semanas. */
export function acumulado(tema, docsSemanas, tipos) {
  let min = (tema.previo ?? 0) * 60;
  for (const doc of Object.values(docsSemanas)) {
    for (const b of bloquesDe(doc)) {
      if (b.hecho != null && esBloqueEstudio(b, tipos) && mismoTema(temaDe(b.titulo), tema.nombre)) min += minutosHechos(b);
    }
  }
  return min;
}

/**
 * Ritmo hasta el examen con `horas` a la semana desde el lunes de `semana`.
 * → { estado: 'llega' | 'justo' | 'no', necesarias } o null si faltan datos (total o examen).
 */
export function ritmo(tema, acumuladoMin, horas, semana) {
  if (!tema.total || !tema.examen) return null;
  const resto = Math.max(0, tema.total * 60 - acumuladoMin) / 60;
  const semanas = Math.max(1, Math.ceil((diasEntre(lunesDe(semana), tema.examen) + 1) / 7));
  const necesarias = resto / semanas;
  const estado = horas >= necesarias * 1.1 ? 'llega' : horas >= necesarias * 0.95 ? 'justo' : 'no';
  return { estado, necesarias };
}

// ---------- Pestaña Progreso ----------

const mediaDe = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function mediana(xs) {
  const o = [...xs].sort((a, b) => a - b);
  if (!o.length) return null;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Minutos hechos de estudio por semana (todas o de un tema), de la más antigua a la actual. */
export function estudioPorSemana(docsSemanas, tipos, actual, n = 8, tema = null) {
  return Array.from({ length: n }, (_, i) => sumarSemanas(actual, i - n + 1)).map((id) => bloquesDe(docsSemanas[id])
    .filter((b) => b.hecho != null && esBloqueEstudio(b, tipos) && (!tema || mismoTema(temaDe(b.titulo), tema)))
    .reduce((s, b) => s + minutosHechos(b), 0));
}

/** Minutos que «deberías llevar» hoy: total × avance del calendario entre inicio y examen. */
export function esperado(tema, hoy, inicioPorDefecto = null) {
  const inicio = tema.inicio ?? inicioPorDefecto;
  if (!tema.total || !tema.examen || !inicio) return null;
  const dur = diasEntre(inicio, tema.examen);
  const t = dur > 0 ? Math.min(1, Math.max(0, diasEntre(inicio, hoy) / dur)) : 1;
  return tema.total * 60 * t;
}

/** Fila de «Certificaciones y curso» de cada tema. */
export function certificaciones({ temas, docsSemanas, tipos, hoy, actual }) {
  return temas.map((t) => {
    const acum = acumulado(t, docsSemanas, tipos);
    const esp = esperado(t, hoy);
    return {
      nombre: t.nombre, examen: t.examen, total: t.total, horasSemana: t.horasSemana,
      acumulado: acum, esperado: esp, diferencia: esp == null ? null : acum - esp,
      encuadre: t.total ? encuadre(acum, t.total * 60) : null,
      soloSemanal: !t.total || !t.examen,
      horas8: estudioPorSemana(docsSemanas, tipos, actual, 8, t.nombre),
      simulacros: t.simulacros.map((s) => s.nota),
      sinSimulacro: semanasSinSimulacro(t, hoy),
    };
  });
}

/** Plan frente a real por tipo (sin los de trabajo) de una semana: [{ tipo, plan, real }] */
export function planFrenteAReal(doc, tipos) {
  const filas = [];
  for (const b of bloquesDe(doc).filter((x) => !x.sugerido)) {
    const t = tipoPorNombre(tipos, b.tipo);
    if (t?.trabajo) continue;
    const nombre = t?.nombre ?? b.tipo;
    let f = filas.find((x) => normalizar(x.tipo) === normalizar(nombre));
    if (!f) filas.push(f = { tipo: nombre, plan: 0, real: 0 });
    f.plan += b.fin - b.inicio;
    f.real += minutosHechos(b);
  }
  const orden = (n) => { const i = tipos.findIndex((t) => normalizar(t.nombre) === normalizar(n)); return i < 0 ? 99 : i; };
  return filas.sort((a, b) => orden(a.tipo) - orden(b.tipo));
}

/** Rejilla de constancia de 16 semanas desde el inicio más antiguo (o las 16 últimas si ya pasaron). */
export function rejillaConstancia({ temas, docsSemanas, tipos, actual, n = 16 }) {
  const inicios = temas.map((t) => t.inicio).filter(Boolean).sort();
  let desde = inicios.length ? semanaDe(inicios[0]) : sumarSemanas(actual, -(n - 1));
  if (compararSemanas(sumarSemanas(desde, n - 1), actual) < 0) desde = sumarSemanas(actual, -(n - 1));
  if (compararSemanas(desde, actual) > 0) desde = actual;
  return Array.from({ length: n }, (_, i) => {
    const id = sumarSemanas(desde, i);
    const futura = compararSemanas(id, actual) > 0;
    return { id, futura, actual: id === actual, minutos: futura ? null : estudioPorSemana(docsSemanas, tipos, id, 1)[0] };
  });
}

/** Ánimo medio por semana (de diario/), de la más antigua a la actual; null si no hay entradas. */
export function animoPorSemana(diarios, actual, n = 8) {
  return Array.from({ length: n }, (_, i) => sumarSemanas(actual, i - n + 1)).map((id) => {
    const lunes = lunesDe(id);
    const valores = Array.from({ length: 7 }, (_, d) => diarios[sumarDias(lunes, d)]?.animo).filter((x) => x != null);
    return mediaDe(valores);
  });
}

/**
 * Ánimo en semanas con más o menos estudio que la mediana (semanas completas con diario).
 * → { mediana (min), conMas, conMenos } o null si no hay datos suficientes.
 */
export function animoYEstudio(horas, animos) {
  const pares = horas.map((h, i) => [h, animos[i]]).slice(0, -1).filter(([, a]) => a != null);
  if (pares.length < 2) return null;
  const med = mediana(pares.map(([h]) => h));
  return {
    mediana: med,
    conMas: mediaDe(pares.filter(([h]) => h >= med).map(([, a]) => a)),
    conMenos: mediaDe(pares.filter(([h]) => h < med).map(([, a]) => a)),
  };
}

/** Lecciones de los cierres, de la semana más reciente a la más antigua. */
export function lecciones(docsSemanas) {
  return Object.keys(docsSemanas).sort().reverse().map((id) => {
    const lineas = docsSemanas[id].lineas.filter((l) => l.t === 'leccion');
    return { semana: id, funciono: lineas.find((l) => l.clase === 'funciono')?.texto ?? null, cambio: lineas.find((l) => l.clase === 'cambio')?.texto ?? null };
  }).filter((x) => x.funciono || x.cambio);
}

/** Todo lo de la pestaña Progreso (lo calcula el servidor, que tiene todas las semanas). */
export function calcularProgreso({ docsSemanas, temas, tipos, diarios, hoy, actual }) {
  const cerradas = Object.keys(docsSemanas).filter((id) => compararSemanas(id, actual) <= 0
    && docsSemanas[id].lineas.some((l) => l.t === 'estado' && l.valor === 'cerrada')).sort();
  const ultimaCerrada = cerradas.at(-1) ?? null;
  const estudio8 = estudioPorSemana(docsSemanas, tipos, actual, 8);
  const animo8 = animoPorSemana(diarios, actual, 8);
  return {
    certificaciones: certificaciones({ temas, docsSemanas, tipos, hoy, actual }),
    ultimaCerrada,
    planReal: ultimaCerrada ? planFrenteAReal(docsSemanas[ultimaCerrada], tipos) : [],
    rejilla: rejillaConstancia({ temas, docsSemanas, tipos, actual }),
    estudio8, animo8,
    comparacion: animoYEstudio(estudio8, animo8),
    meta: temas.reduce((s, t) => s + (t.horasSemana ?? 0), 0),
    semanasConEstudio: estudio8.slice(0, -1).filter((x) => x > 0).length,
    lecciones: lecciones(docsSemanas),
  };
}

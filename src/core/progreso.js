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

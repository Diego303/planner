// Capacidad y foco (§4.2): ocupación de cada día y aviso de estudio intenso.
import { tipoPorNombre } from './modelo.js';

/** Minutos de un bloque dentro de las horas visibles (se recorta al pintar, no al guardar). */
export function minutosVisibles(b, horas) {
  return Math.max(0, Math.min(b.fin, horas.hasta * 60) - Math.max(b.inicio, horas.desde * 60));
}

export function nivelOcupacion(pct, capacidad) {
  if (pct <= capacidad) return 'ok';
  if (pct <= capacidad + 15) return 'aviso';
  return 'exceso';
}

/** Ocupación del día: Σ bloques no sugeridos / horas visibles. → { minutos, disponibles, pct, nivel } */
export function ocupacionDia(bloques, dia, ajustes) {
  const disponibles = (ajustes.horas.hasta - ajustes.horas.desde) * 60;
  const minutos = bloques.filter((b) => b.dia === dia && !b.sugerido).reduce((s, b) => s + minutosVisibles(b, ajustes.horas), 0);
  const pct = disponibles ? (minutos / disponibles) * 100 : 0;
  return { minutos, disponibles, pct, nivel: nivelOcupacion(pct, ajustes.capacidad) };
}

/** Minutos de estudio (tipos con bandera «estudio») del día, sin sugerencias. → { minutos, aviso } */
export function estudioDia(bloques, dia, tipos, ajustes) {
  const minutos = bloques
    .filter((b) => b.dia === dia && !b.sugerido && tipoPorNombre(tipos, b.tipo)?.estudio)
    .reduce((s, b) => s + (b.fin - b.inicio), 0);
  return { minutos, aviso: minutos > ajustes.foco_max * 60 };
}

/** ¿Es trabajo después de la hora de cierre? (☾, rayado gris) */
export const trabajoTrasCierre = (b, tipos, ajustes) => !!tipoPorNombre(tipos, b.tipo)?.trabajo && b.fin > ajustes.cierre;

// Lo que tardas de verdad (§4.3): media de (duración + diferencia) / duración de los bloques hechos
// de las últimas 8 semanas, por tipo. Con menos de 5 muestras, ×1,0. Acotado a [0,7 · 2,0].
import { sumarSemanas } from './fechas.js';
import { bloquesDe, normalizar, tipoPorNombre } from './modelo.js';

export const MIN_MUESTRAS = 5;
export const LIMITES = [0.7, 2.0];

/** → { nombreTipo: { factor, muestras, media } } (factor acotado; 1 si no hay muestras suficientes) */
export function factores(docsSemanas, tipos, actual, semanas = 8) {
  const acumulado = {};
  for (let i = 0; i < semanas; i++) {
    for (const b of bloquesDe(docsSemanas[sumarSemanas(actual, -i)])) {
      if (b.hecho == null) continue;
      const dur = b.fin - b.inicio;
      const nombre = tipoPorNombre(tipos, b.tipo)?.nombre ?? b.tipo;
      const k = acumulado[normalizar(nombre)] ??= { nombre, suma: 0, n: 0 };
      k.suma += Math.max(0, dur + b.hecho) / dur;
      k.n++;
    }
  }
  const out = {};
  for (const t of tipos) acumulado[normalizar(t.nombre)] ??= { nombre: t.nombre, suma: 0, n: 0 };
  for (const { nombre, suma, n } of Object.values(acumulado)) {
    const media = n ? suma / n : 1;
    const factor = n >= MIN_MUESTRAS ? Math.min(LIMITES[1], Math.max(LIMITES[0], media)) : 1;
    out[nombre] = { factor, muestras: n, media };
  }
  return out;
}

/** Factor de un tipo (1 si no hay datos). */
export const factorDe = (fs, tipo) => (fs && Object.entries(fs).find(([k]) => normalizar(k) === normalizar(tipo))?.[1].factor) ?? 1;

/** Para mostrar: redondeado a 0,1. */
export const redondearFactor = (f) => Math.round(f * 10) / 10;

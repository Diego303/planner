// Generador aleatorio con semilla (mulberry32) para pruebas de propiedades. Sin dependencias.
// Repetir un fallo: PLANNER_SEMILLA=<n> pnpm test
import { limpiarTexto } from '../src/core/formato/comun.js';

export const SEMILLA = Number(process.env.PLANNER_SEMILLA ?? 20261101);

export function crearAzar(semilla = SEMILLA) {
  let a = semilla >>> 0;
  const sig = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    sig,
    entero: (min, max) => min + Math.floor(sig() * (max - min + 1)),
    bool: (p = 0.5) => sig() < p,
    elegir: (xs) => xs[Math.floor(sig() * xs.length)],
    algunos: (xs, p = 0.5) => xs.filter(() => sig() < p),
    lista: (min, max, fn) => Array.from({ length: r.entero(min, max) }, (_, i) => fn(i)),
  };
  return r;
}

/** Ejecuta `fn(azar, i)` `n` veces; si falla, el error dice la semilla y la iteración para repetirlo. */
export function paraCada(n, fn, semilla = SEMILLA) {
  const azar = crearAzar(semilla);
  for (let i = 0; i < n; i++) {
    try { fn(azar, i); } catch (e) {
      e.message = `${e.message}\n  → semilla ${semilla}, caso ${i} (repite con PLANNER_SEMILLA=${semilla})`;
      throw e;
    }
  }
}

// Trozos de texto hostiles: separadores del formato, marcas, tildes, emojis, RTL y HTML.
export const TROZOS = ['Curso', 'AI-102', 'lab', 'RAG', 'ñandú', 'acción', 'Ü', 'ç', '😀', '🧪', '👩‍💻', 'שלום', 'مرحبا',
  '|', '·', ' · ', '#', '!', ':', ': ', '[ ]', '[x]', '"', "'", '`', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>',
  '&amp;', '\\', '%', '@', ',', ';', '1,5', '09:00', '-', '- ', '*', '  ', '\t', ' ', 'tipo: aprender', 'hecho: +30m',
  'rel: x', 'fecha: 2026-02-30', 'prioridad', 'plantilla', 'sugerido', '​', ' '];

/** Texto libre crudo (puede llevar cualquier trozo hostil). */
export function textoCrudo(azar, max = 6) {
  let t = azar.lista(1, max, () => azar.elegir(TROZOS)).join(azar.bool(0.5) ? ' ' : '');
  if (azar.bool(0.03)) t += ' ' + 'largo '.repeat(400); // > 2.000 caracteres
  return t;
}

/** Texto tal y como lo deja la interfaz (limpiarTexto): nunca vacío ni empezando por #. */
export function textoModelo(azar, max = 6) {
  const t = limpiarTexto(textoCrudo(azar, max));
  return !t || t.startsWith('#') ? `a ${t}`.trim() : t;
}

export const fecha = (azar) => `${azar.entero(2020, 2032)}-${String(azar.entero(1, 12)).padStart(2, '0')}-${String(azar.entero(1, 28)).padStart(2, '0')}`;
export const numero2 = (azar, max = 100) => Math.round(azar.sig() * max * 100) / 100;

// Utilidades compartidas por los tests (no es un fichero de test).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';

export const EJEMPLO = new URL('../ejemplo/', import.meta.url).pathname;

let enCache = null;

/** Todos los ficheros del planner dentro de ejemplo/: [{ ruta, texto }] (se leen una vez por proceso). */
export function ficherosEjemplo() {
  if (enCache) return enCache;
  const out = [];
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) recorrer(p);
      else {
        const ruta = relative(EJEMPLO, p).split('\\').join('/');
        if (tipoDeRuta(ruta)) out.push({ ruta, texto: readFileSync(p, 'utf8') });
      }
    }
  };
  recorrer(EJEMPLO);
  enCache = out.sort((a, b) => a.ruta.localeCompare(b.ruta));
  return enCache;
}

/** Mundo con todos los ficheros de ejemplo parseados. */
export function mundoEjemplo() {
  const ficheros = {};
  for (const { ruta, texto } of ficherosEjemplo()) ficheros[ruta] = parsear(ruta, texto);
  return { ficheros };
}

/** Copia sin los campos internos `_raw` y `_canon` (para comparar modelos tras editar). */
export function sinInternos(v) {
  if (Array.isArray(v)) return v.map(sinInternos);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [k, sinInternos(x)]));
  }
  return v;
}

export const vuelta = (ruta, texto) => serializar(parsear(ruta, texto));

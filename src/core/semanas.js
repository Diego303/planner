// Semanas: estados, creación desde plantilla y lista para Gestión → Semanas.
import { compararSemanas, sumarSemanas, esSemana } from './fechas.js';
import { bloquesDe, estadoGuardado, plantillaDe } from './modelo.js';
import * as fsem from './formato/semana.js';
import { nuevoDoc } from './formato/comun.js';

export const ICONO_ESTADO = {
  'cerrada': '✓', 'sin cerrar': '!', 'reabierta': '↺', 'en curso': '●', 'planificada': '◐',
  'solo plantilla': '↻', 'sin planificar': '○', 'sin datos': '·',
};

/**
 * Estado de una semana según su fichero y la semana actual (§4.5 del plan).
 * Solo `cerrada` y `reabierta` vienen del fichero; el resto se calcula con la fecha.
 */
export function estadoSemana(id, doc, actual) {
  const c = compararSemanas(id, actual);
  if (!doc) return c < 0 ? 'sin datos' : 'sin planificar';
  const guardado = estadoGuardado(doc);
  if (guardado === 'cerrada' || guardado === 'reabierta') return guardado;
  if (c === 0) return 'en curso';
  if (c < 0) return 'sin cerrar';
  return bloquesDe(doc).some((b) => !b.plantilla && !b.sugerido) ? 'planificada' : 'solo plantilla';
}

export const soloLectura = (estado) => estado === 'cerrada' || estado === 'sin datos';
export const pendienteDeCerrar = (estado) => estado === 'sin cerrar' || estado === 'reabierta';

/** Bloques de la plantilla expandidos por día, marcados con `plantilla`. */
export function bloquesDePlantilla(plantillaDoc) {
  const out = [];
  for (const e of plantillaDe(plantillaDoc)) {
    for (const dia of e.dias) {
      out.push(fsem.bloque({ dia, inicio: e.inicio, fin: e.fin, tipo: e.tipo, titulo: e.titulo, subtipo: e.subtipo, paso: e.paso, plantilla: true }));
    }
  }
  return out;
}

/** Documento nuevo de la semana `id` a partir de la plantilla. */
export function crearDesdePlantilla(id, plantillaDoc, actual) {
  const doc = fsem.vacia(id, compararSemanas(id, actual) === 0 ? 'en curso' : 'solo plantilla');
  doc.lineas.push(...bloquesDePlantilla(plantillaDoc));
  return doc;
}

/** Lista de semanas [desde, hasta] con su estado: [{ id, estado }] */
export function listaSemanas(desde, hasta, docs, actual) {
  const out = [];
  for (let id = desde; compararSemanas(id, hasta) <= 0; id = sumarSemanas(id, 1)) {
    out.push({ id, estado: estadoSemana(id, docs[id] ?? null, actual) });
  }
  return out;
}

/** Semanas pasadas con fichero que faltan por cerrar (sin cerrar o reabiertas), de la más antigua a la más reciente. */
export function pendientesDeCerrar(docs, actual) {
  return Object.keys(docs).filter(esSemana).sort()
    .filter((id) => compararSemanas(id, actual) < 0 && pendienteDeCerrar(estadoSemana(id, docs[id], actual)));
}

export { nuevoDoc };

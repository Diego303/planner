// Ruta relativa dentro de la carpeta de datos → formato (parse/serialize).
import * as semana from './semana.js';
import * as tareas from './tareas.js';
import * as tiposPlantilla from './tipos.js';
import { ajustes, estudio, proyectos, diario, tema } from './listas.js';
import { clasificar, partirTexto, documento, serializarDoc, canonComun, nuevoDoc } from './comun.js';

// inbox.md: texto libre. Cada línea no vacía que no es título es una nota (nunca «no reconocida»).
const canonInbox = (l) => canonComun(l) ?? l.texto;
const inbox = {
  parsear(texto) {
    const p = partirTexto(texto);
    const nota = (raw) => ({ t: 'nota', texto: raw });
    const lineas = clasificar(p.lineas, { seccionDe: (t) => t, enCabecera: nota, enSeccion: nota, canon: canonInbox });
    return documento('inbox', p, lineas);
  },
  serializar: (doc) => serializarDoc(doc, canonInbox),
};

export const FORMATOS = {
  semana: { parsear: semana.parsear, serializar: semana.serializar },
  tareas: { parsear: tareas.parsear, serializar: tareas.serializar },
  archivo: { parsear: tareas.parsearArchivo, serializar: tareas.serializar },
  tipos: { parsear: tiposPlantilla.parsearTipos, serializar: tiposPlantilla.serializarTipos },
  plantilla: { parsear: tiposPlantilla.parsearPlantilla, serializar: tiposPlantilla.serializarPlantilla },
  ajustes, estudio, proyectos, diario, tema, inbox,
};

const RUTAS = [
  [/^ajustes\.md$/, 'ajustes'],
  [/^tipos\.md$/, 'tipos'],
  [/^plantilla\.md$/, 'plantilla'],
  [/^tareas\.md$/, 'tareas'],
  [/^estudio\.md$/, 'estudio'],
  [/^proyectos\.md$/, 'proyectos'],
  [/^inbox\.md$/, 'inbox'],
  [/^tema\.md$/, 'tema'],
  [/^semanas\/\d{4}-W\d{2}\.md$/, 'semana'],
  [/^diario\/\d{4}-\d{2}-\d{2}\.md$/, 'diario'],
  [/^archivo\/tareas-\d{4}-\d{2}\.md$/, 'archivo'],
  [/^archivo\/inbox-\d{4}-\d{2}\.md$/, 'inbox'],
];

/** Tipo de documento de una ruta relativa ('semanas/2026-W45.md' → 'semana'); null si no es un fichero del planner. */
export function tipoDeRuta(ruta) {
  for (const [re, tipo] of RUTAS) if (re.test(ruta)) return tipo;
  return null;
}

export function parsear(ruta, texto) {
  const tipo = tipoDeRuta(ruta);
  if (!tipo) throw new Error(`ruta desconocida: ${ruta}`);
  return FORMATOS[tipo].parsear(texto);
}

export const serializar = (doc) => FORMATOS[doc.tipo].serializar(doc);

export { nuevoDoc };

// Rutas de cada fichero
export const ruta = {
  semana: (id) => `semanas/${id}.md`,
  diario: (fecha) => `diario/${fecha}.md`,
  archivoTareas: (mes) => `archivo/tareas-${mes}.md`,
  archivoInbox: (mes) => `archivo/inbox-${mes}.md`,
};

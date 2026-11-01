// Modelo: constantes, valores por defecto y accesores de solo lectura sobre los documentos parseados.
// Los elementos se identifican por su índice de línea (`id`) dentro de su fichero.
import { normalizar, limpiarTexto } from './formato/comun.js';
import { AJUSTES_DEFECTO, TEMAS, TOKENS } from './formato/listas.js';

export { normalizar, limpiarTexto, AJUSTES_DEFECTO, TEMAS, TOKENS };

/** Paleta de colores de tipo (maqueta, `PAL`). */
export const PAL = ['#3D5A80', '#5B4E8C', '#2F6B4F', '#A04E33', '#86651F', '#A1466B', '#55722B', '#6B706B', '#B03A3A', '#2D7A80'];

export const TIPOS_DEFECTO = [
  { nombre: 'trabajo', color: '#3D5A80', trabajo: true, estudio: false },
  { nombre: 'estudio', color: '#5B4E8C', trabajo: false, estudio: true },
  { nombre: 'proyectos', color: '#2F6B4F', trabajo: false, estudio: false },
  { nombre: 'entreno', color: '#A04E33', trabajo: false, estudio: false },
  { nombre: 'personal', color: '#86651F', trabajo: false, estudio: false },
];

export const COLOR_SIN_TIPO = '#888780';

// ---------- Genéricos ----------

/** Elementos de un tipo con su `id` (índice de línea). */
export function entidades(doc, t) {
  const out = [];
  doc?.lineas.forEach((l, i) => { if (l.t === t) out.push({ ...l, id: i }); });
  return out;
}

/** Líneas no reconocidas: [{ indice, texto }] */
export function desconocidas(doc) {
  const out = [];
  doc?.lineas.forEach((l, i) => { if (l.t === '?') out.push({ indice: i, texto: l._raw }); });
  return out;
}

/**
 * Huella de un elemento: lo que lo identifica para la UI. Las operaciones que apuntan a una línea por índice
 * pueden mandarla; si la línea ya no es esa (el fichero cambió mientras se editaba), se rechaza.
 */
export function huellaDe(l) {
  if (!l) return null;
  switch (l.t) {
    case 'bloque': return `${l.dia}|${l.inicio}|${l.fin}|${l.titulo}`;
    case 'tarea': case 'las3': return `${l.texto}`;
    case 'plantilla': return `${l.dias.join(',')}|${l.inicio}|${l.titulo}`;
    case 'h2': return l.texto;
    default: return l.t;
  }
}

export const esTitulo = (l) => l.t === 'h2' || (l.t === '?' && l.h2);

/** Índice de la primera sección `clave` (o -1). */
export const indiceSeccion = (doc, clave) => doc.lineas.findIndex((l) => l.t === 'h2' && l.seccion === clave);

/** Fin (exclusivo) de la sección que empieza en `i`. */
export function finSeccion(doc, i) {
  let j = i + 1;
  while (j < doc.lineas.length && !esTitulo(doc.lineas[j])) j++;
  return j;
}

/** Posición donde añadir un elemento al final de la sección que empieza en `i` (antes de las líneas vacías finales). */
export function finContenido(doc, i) {
  let j = finSeccion(doc, i);
  while (j - 1 > i && doc.lineas[j - 1].t === 'vacia') j--;
  return j;
}

// ---------- Texto y temas ----------

/** Tema de un bloque = texto antes del primer « · » del título. */
export const temaDe = (titulo) => String(titulo ?? '').split(' · ')[0].trim();
export const mismoTema = (a, b) => !!a && !!b && normalizar(a) === normalizar(b);

/** ¿Aparece `nombre` como palabra dentro de `texto`? (sin tildes ni mayúsculas) */
export function contieneNombre(texto, nombre) {
  const k = normalizar(nombre);
  if (!k) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u');
  return re.test(normalizar(texto));
}

/** `rel` de una de Las 3 deducido del texto: el nombre más largo de tema o proyecto que aparezca. */
export function relDeTexto(texto, nombres) {
  let mejor = null;
  for (const n of nombres) if (contieneNombre(texto, n) && (!mejor || n.length > mejor.length)) mejor = n;
  return mejor;
}

/** ★: el tema del bloque coincide con el `rel` de alguna de Las 3. */
export const avanzaLas3 = (titulo, las3) => las3.some((o) => o.rel && mismoTema(temaDe(titulo), o.rel));

/** ★ en tareas: el texto contiene el `rel` de alguna de Las 3, o la bandera `las3`. */
export const tareaAvanzaLas3 = (tarea, las3) => tarea.las3 || las3.some((o) => o.rel && contieneNombre(tarea.texto, o.rel));

export const duracion = (b) => b.fin - b.inicio;
/** Minutos reales de un bloque hecho (duración + diferencia); 0 si no está hecho. */
export const minutosHechos = (b) => (b.hecho == null ? 0 : Math.max(0, b.fin - b.inicio + b.hecho));

// ---------- Semana ----------

export const bloquesDe = (doc) => entidades(doc, 'bloque');
export const las3De = (doc) => entidades(doc, 'las3');
export const notasSemana = (doc) => entidades(doc, 'nota').map((n) => n.texto.replace(/^\s*[-*]\s+/, ''));
export const estadoGuardado = (doc) => doc?.lineas.find((l) => l.t === 'estado')?.valor ?? null;

/** Horas objetivo de esta semana por tema (sección `## Estudio`): { temaNormalizado: horas } */
export function objetivosDe(doc) {
  const out = {};
  for (const o of entidades(doc, 'objetivo')) out[normalizar(o.tema)] ??= o.horas;
  return out;
}

export function cierreDe(doc) {
  const resumen = entidades(doc, 'resumen')[0] ?? null;
  const lecciones = entidades(doc, 'leccion');
  return {
    resumen,
    funciono: lecciones.filter((l) => l.clase === 'funciono'),
    cambio: lecciones.filter((l) => l.clase === 'cambio'),
  };
}

// ---------- Tareas ----------

export function tareasDe(doc) {
  const out = { hoy: [], mas: [], algun: [] };
  for (const t of entidades(doc, 'tarea')) out[t.seccion]?.push(t);
  return out;
}

// ---------- Ajustes, tipos, plantilla ----------

export function valoresAjustes(doc) {
  const v = { ...AJUSTES_DEFECTO };
  for (const l of entidades(doc, 'kv')) v[l.clave] = l.valor;
  return v;
}

/** Lista de tipos; si no hay tipos.md se usan los de por defecto. */
export function tiposDe(doc) {
  if (!doc) return TIPOS_DEFECTO.map((t) => ({ ...t, id: null }));
  return entidades(doc, 'tipo').map(({ nombre, color, trabajo, estudio, id }) => ({ nombre, color, trabajo, estudio, id }));
}

export const tipoPorNombre = (tipos, nombre) => tipos.find((t) => normalizar(t.nombre) === normalizar(nombre)) ?? null;
export const colorDeTipo = (tipos, nombre) => tipoPorNombre(tipos, nombre)?.color ?? COLOR_SIN_TIPO;
export const esEstudio = (tipos, nombre) => !!tipoPorNombre(tipos, nombre)?.estudio;
export const esTrabajo = (tipos, nombre) => !!tipoPorNombre(tipos, nombre)?.trabajo;

/** Tipo para las piezas de estudio (el primero con bandera «estudio») y de proyectos (el llamado «proyectos»). */
export const tipoEstudio = (tipos) => tipos.find((t) => t.estudio)?.nombre ?? null;
export const tipoProyectos = (tipos) =>
  tipos.find((t) => ['proyectos', 'proyecto'].includes(normalizar(t.nombre)))?.nombre ?? null;

export const plantillaDe = (doc) => entidades(doc, 'plantilla');

// ---------- Estudio y proyectos (una sección por tema) ----------

/** Secciones `## nombre` con sus claves: [{ id, nombre, fin, claves: { clave: { id, valor } } }] */
export function seccionesDe(doc) {
  const out = [];
  doc?.lineas.forEach((l, i) => {
    if (l.t !== 'h2') return;
    const fin = finSeccion(doc, i);
    const claves = {};
    for (let j = i + 1; j < fin; j++) {
      const k = doc.lineas[j];
      if (k.t === 'kv' && !claves[k.clave]) claves[k.clave] = { id: j, valor: k.valor };
    }
    out.push({ id: i, nombre: l.texto, fin, claves });
  });
  return out;
}

export function temasEstudio(doc) {
  return seccionesDe(doc).map((s) => ({
    id: s.id, nombre: s.nombre, claves: s.claves,
    horasSemana: s.claves.horas_semana?.valor ?? 0,
    examen: s.claves.examen?.valor ?? null,
    inicio: s.claves.inicio?.valor ?? null,
    total: s.claves.total?.valor ?? null,
    previo: s.claves.previo?.valor ?? 0,
    simulacros: s.claves.simulacros?.valor ?? [],
    dejado: s.claves.dejado?.valor ?? null,
  }));
}

export function proyectosDe(doc) {
  return seccionesDe(doc).map((s) => ({
    id: s.id, nombre: s.nombre, claves: s.claves,
    siguiente: s.claves.siguiente?.valor ?? null,
    estado: s.claves.estado?.valor ?? 'activo',
    actualizado: s.claves.actualizado?.valor ?? null,
    dejado: s.claves.dejado?.valor ?? null,
  }));
}

export const buscarTema = (lista, nombre) => lista.find((x) => mismoTema(x.nombre, nombre)) ?? null;

// ---------- Diario, inbox, tema ----------

export function diarioDe(doc) {
  const v = { animo: null, linea: null, avanzado: [], manana: null };
  for (const l of entidades(doc, 'kv')) v[l.clave] = l.valor;
  return v;
}

export const notasInbox = (doc) => entidades(doc, 'nota');

export function valoresTema(doc) {
  const v = { base: 'nordico-claro', tokens: {} };
  for (const l of entidades(doc, 'kv')) {
    if (l.clave === 'base') v.base = l.valor;
    else v.tokens[l.clave] = l.valor;
  }
  return v;
}

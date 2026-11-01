// Formatos de lista `- clave: valor`: ajustes, estudio, proyectos, diario y tema — ver docs/DISENO.md §3.2 y §3.7–3.9
import {
  clasificar, partirTexto, documento, serializarDoc, canonComun, nuevoDoc, lineaClaveValor, canonClaveValor,
  parsearNumero, formatoNumero, parsearEntero, parsearNota, parsearSiNo, textoLibre, normalizar,
} from './comun.js';
import { esFecha, aMinutos, deMinutos } from '../fechas.js';

// ---------- Tipos de valor ----------

const fecha = { parsear: (t) => (esFecha(t.trim()) ? t.trim() : null), formato: (v) => v };
const numero = (min = 0, max = Infinity) => ({
  parsear: (t) => { const n = parsearNumero(t); return n != null && n >= min && n <= max ? n : null; },
  formato: formatoNumero,
});
const entero = (min, max) => ({ parsear: (t) => parsearEntero(t, min, max), formato: String });
const opcion = (valores) => ({
  parsear: (t) => valores.find((v) => normalizar(v) === normalizar(t)) ?? null,
  formato: (v) => v,
});
const siNo = { parsear: parsearSiNo, formato: (v) => (v ? 'sí' : 'no') };
const hora = { parsear: (t) => aMinutos(t), formato: deMinutos };
const horasVisibles = {
  parsear: (t) => {
    const m = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(t.trim());
    if (!m) return null;
    const [desde, hasta] = [+m[1], +m[2]];
    return desde < hasta && hasta <= 24 ? { desde, hasta } : null;
  },
  formato: (v) => `${v.desde}-${v.hasta}`,
};
const simulacros = {
  parsear: (t) => {
    if (!t.trim()) return [];
    const lista = [];
    for (const parte of t.split(',')) {
      const m = /^\s*(\d{1,3})\s*%?\s*(?:@\s*(\S+))?\s*$/.exec(parte);
      const nota = m && parsearNota(m[1]);
      if (nota == null || (m[2] && !esFecha(m[2]))) return null;
      lista.push({ nota, fecha: m[2] ?? null });
    }
    return lista;
  },
  formato: (v) => v.map((s) => (s.fecha ? `${s.nota} @${s.fecha}` : `${s.nota}`)).join(', '),
};
const lista = {
  parsear: (t) => t.split(';').map((x) => x.trim()).filter(Boolean),
  formato: (v) => v.join('; '),
  libre: true,
};

const def = (nombre, tipo) => ({ nombre, ...tipo });

// ---------- Fábrica de formatos ----------

function formatoLista(tipo, claves, { secciones }) {
  const canon = (l) => canonComun(l) ?? (l.t === 'kv' ? canonClaveValor(l, claves) : (() => {
    throw new Error(`línea desconocida en ${tipo}: ${l.t}`);
  })());
  const parsear = (texto) => {
    const p = partirTexto(texto);
    const lineas = clasificar(p.lineas, {
      seccionDe: (t) => (secciones ? t : null),
      enCabecera: (raw, ctx) => (secciones ? null : lineaClaveValor(raw, claves, ctx)),
      enSeccion: (raw, _sec, ctx) => lineaClaveValor(raw, claves, ctx),
      canon,
    });
    return documento(tipo, p, lineas);
  };
  const kv = (clave, valor) => ({ t: 'kv', clave, valor, comentario: null });
  return { tipo, claves, parsear, serializar: (doc) => serializarDoc(doc, canon), canon, kv };
}

// ---------- ajustes.md ----------

export const TEMAS = ['nordico-claro', 'nordico-oscuro', 'automatico', 'papel', 'universo', 'halloween',
  'alto-contraste', 'personalizado'];

export const ajustes = formatoLista('ajustes', {
  capacidad: def('capacidad', entero(50, 100)),
  tareas_hoy: def('tareas_hoy', entero(1, 20)),
  horas: def('horas', horasVisibles),
  cierre: def('cierre', hora),
  inicio_semana: def('inicio_semana', opcion(['lunes', 'domingo'])),
  foco_max: def('foco_max', numero(0.5, 24)),
  mejores_horas: def('mejores_horas', opcion(['sin preferencia', 'mañanas', 'tardes', 'noches'])),
  margen: def('margen', opcion(['auto', 'fijo'])),
  copias: def('copias', opcion(['diaria', 'al cerrar semana', 'git'])),
  puerto: def('puerto', entero(1024, 65535)),
  tema: def('tema', opcion(TEMAS)),
  tema_temporada: def('tema_temporada', siNo),
  decoracion: def('decoracion', siNo),
}, { secciones: false });

export const AJUSTES_DEFECTO = {
  capacidad: 70, tareas_hoy: 5, horas: { desde: 7, hasta: 24 }, cierre: 22 * 60 + 30, inicio_semana: 'lunes',
  foco_max: 3, mejores_horas: 'sin preferencia', margen: 'auto', copias: 'diaria', puerto: 4321,
  tema: 'nordico-claro', tema_temporada: false, decoracion: true,
};

// ---------- estudio.md ----------

export const estudio = formatoLista('estudio', {
  horas_semana: def('horas_semana', numero(0, 100)),
  examen: def('examen', fecha),
  inicio: def('inicio', fecha),
  total: def('total', numero(0, 100000)),
  previo: def('previo', numero(0, 100000)),
  simulacros: def('simulacros', simulacros),
  dejado: def('dejado', textoLibre),
}, { secciones: true });

// ---------- proyectos.md ----------

export const proyectos = formatoLista('proyectos', {
  siguiente: def('siguiente', textoLibre),
  estado: def('estado', opcion(['activo', 'pausado'])),
  actualizado: def('actualizado', fecha),
  dejado: def('dejado', textoLibre),
}, { secciones: true });

// ---------- diario/AAAA-MM-DD.md ----------

export const diario = formatoLista('diario', {
  animo: def('ánimo', entero(1, 5)),
  linea: def('línea', textoLibre),
  avanzado: def('avanzado', lista),
  manana: def('mañana', textoLibre),
}, { secciones: false });

// ---------- tema.md ----------

export const TOKENS = ['fondo', 'superficie', 'superficie-2', 'texto', 'texto-2', 'texto-3', 'borde', 'acento',
  'acento-texto', 'aviso', 'aviso-fondo', 'ok', 'ok-fondo', 'peligro', 'sombra', 'sombra-alta', 'radio', 'fuente',
  'fondo-deco', 'enlace'];
const valorCss = {
  parsear: (t) => (/^[^;{}<>\\]+$/.test(t.trim()) && t.trim() ? t.trim() : null),
  formato: (v) => v,
  libre: true,
};
export const tema = formatoLista('tema', {
  base: def('base', opcion(TEMAS.filter((t) => t !== 'personalizado' && t !== 'automatico'))),
  ...Object.fromEntries(TOKENS.map((k) => [k, def(k, valorCss)])),
}, { secciones: false });

export const vacio = (tipo, titulo) => nuevoDoc(tipo, titulo ? [{ t: 'h1', texto: titulo }] : []);

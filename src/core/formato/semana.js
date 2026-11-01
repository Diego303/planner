// semanas/AAAA-Www.md — ver docs/DISENO.md §3.5
import {
  clasificar, partirTexto, serializarDoc, canonComun, nuevoDoc, elementoLista, casilla, separarComentario,
  conComentario, dividirCampos, claveValor, normalizar, parsearNumero, formatoNumero, parsearNota,
} from './comun.js';
import { DIAS, parsearRango, formatoRango, parsearDelta, formatoDelta, lunesDe, sumarDias, numeroSemana } from '../fechas.js';

export const ESTADOS = ['en curso', 'sin cerrar', 'cerrada', 'reabierta', 'planificada', 'solo plantilla'];
export const SUBTIPOS = ['aprender', 'repasar', 'simulacro'];
export const SECCIONES = { las3: 'Las 3', bloques: 'Bloques', estudio: 'Estudio', notas: 'Notas', cierre: 'Cierre' };
export const ORDEN_SECCIONES = ['las3', 'bloques', 'estudio', 'notas', 'cierre'];

const CLAVE_SECCION = { 'las 3': 'las3', 'bloques': 'bloques', 'estudio': 'estudio', 'notas': 'notas', 'cierre': 'cierre' };

// ---------- Constructores (forma completa de cada elemento) ----------

export const bloque = (c) => ({
  t: 'bloque', dia: c.dia, inicio: c.inicio, fin: c.fin, tipo: c.tipo, titulo: c.titulo,
  subtipo: c.subtipo ?? null, paso: c.paso ?? null, hecho: c.hecho ?? null, nota: c.nota ?? null,
  plantilla: !!c.plantilla, sugerido: !!c.sugerido, extra: c.extra ?? [], comentario: c.comentario ?? null,
});

export const objetivo3 = (c) => ({
  t: 'las3', hecha: !!c.hecha, texto: c.texto, rel: c.rel ?? null, si: c.si ?? null,
  entonces: c.entonces ?? null, extra: c.extra ?? [], comentario: c.comentario ?? null,
});

export const estado = (valor) => ({ t: 'estado', valor, comentario: null });
export const objetivoEstudio = (tema, horas) => ({ t: 'objetivo', tema, horas, comentario: null });
export const leccion = (clase, texto) => ({ t: 'leccion', clase, texto, comentario: null });
export const resumen = (texto) => ({ t: 'resumen', texto });

export function cabecera(id) {
  const lunes = lunesDe(id);
  return { t: 'h1', texto: `Semana ${numeroSemana(id)} · ${lunes} → ${sumarDias(lunes, 6)}` };
}

export const seccion = (clave) => ({ t: 'h2', texto: SECCIONES[clave], seccion: clave });

// ---------- Lectura ----------

function leerEstado(raw) {
  const { cuerpo, comentario } = separarComentario(raw, true);
  const kv = claveValor(cuerpo);
  if (!kv || kv.clave !== 'estado') return null;
  const valor = normalizar(kv.valor);
  return ESTADOS.includes(valor) ? { t: 'estado', valor, comentario } : null;
}

function leerLas3(raw) {
  const c = elementoLista(raw);
  const cas = c && casilla(c);
  if (!cas) return null;
  const { cuerpo, comentario } = separarComentario(cas.resto);
  const [texto, ...resto] = dividirCampos(cuerpo);
  if (!texto) return null;
  const o = objetivo3({ hecha: cas.hecha, texto, comentario });
  for (const campo of resto) {
    const kv = claveValor(campo);
    if (kv && ['rel', 'si', 'entonces'].includes(kv.clave)) {
      if (o[kv.clave] != null || !kv.valor) return null;
      o[kv.clave] = kv.valor;
    } else o.extra.push(campo);
  }
  return o;
}

export function leerBloque(raw) {
  const c = elementoLista(raw);
  if (c == null) return null;
  const { cuerpo, comentario } = separarComentario(c);
  const campos = dividirCampos(cuerpo);
  if (campos.length < 3) return null;
  const m = /^([LMXJVSD])[ \t]+(.+)$/i.exec(campos[0]);
  const rango = m && parsearRango(m[2]);
  const [tipo, titulo] = [campos[1], campos[2]];
  if (!rango || !tipo || !titulo || claveValor(tipo)) return null;
  const b = bloque({ dia: DIAS.indexOf(m[1].toUpperCase()), ...rango, tipo, titulo, comentario });
  for (const campo of campos.slice(3)) {
    const bandera = normalizar(campo);
    if (bandera === 'plantilla' && !b.plantilla) { b.plantilla = true; continue; }
    if (bandera === 'sugerido' && !b.sugerido) { b.sugerido = true; continue; }
    const kv = claveValor(campo);
    const valor = kv ? leerCampoBloque(kv) : undefined;
    if (valor === undefined) { b.extra.push(campo); continue; }
    const clave = kv.clave === 'tipo' ? 'subtipo' : kv.clave;
    if (valor === null || b[clave] != null) return null; // clave conocida con valor inválido o repetida
    b[clave] = valor;
  }
  return b;
}

/** undefined = clave desconocida (se conserva); null = valor inválido */
function leerCampoBloque({ clave, valor }) {
  switch (clave) {
    case 'tipo': return SUBTIPOS.includes(normalizar(valor)) ? normalizar(valor) : null;
    case 'paso': return valor || null;
    case 'hecho': return parsearDelta(valor);
    case 'nota': return parsearNota(valor);
    default: return undefined;
  }
}

function leerObjetivo(raw) {
  const c = elementoLista(raw);
  if (c == null) return null;
  const { cuerpo, comentario } = separarComentario(c, true);
  const m = /^(.+?)[ \t]*:[ \t]*(\d+(?:[.,]\d+)?)[ \t]*h?$/.exec(cuerpo);
  const horas = m && parsearNumero(m[2]);
  return horas == null ? null : { t: 'objetivo', tema: m[1].trim(), horas, comentario };
}

function leerCierre(raw, ctx) {
  const c = elementoLista(raw);
  if (c == null) return null;
  const { cuerpo, comentario } = separarComentario(c);
  const kv = claveValor(cuerpo);
  if (kv && (kv.clave === 'funciono' || kv.clave === 'cambio') && kv.valor) {
    return { t: 'leccion', clase: kv.clave, texto: kv.valor, comentario };
  }
  if (!ctx.resumen && c.includes(' · ')) {
    ctx.resumen = true;
    return { t: 'resumen', texto: c };
  }
  return null;
}

export function parsear(texto) {
  const p = partirTexto(texto);
  const lineas = clasificar(p.lineas, {
    seccionDe: (t) => CLAVE_SECCION[normalizar(t)] ?? null,
    enCabecera: (raw, ctx) => {
      if (ctx.estado) return null;
      const l = leerEstado(raw);
      if (l) ctx.estado = true;
      return l;
    },
    enSeccion: (raw, sec, ctx) => {
      if (sec === 'las3') return leerLas3(raw);
      if (sec === 'bloques') return leerBloque(raw);
      if (sec === 'estudio') return leerObjetivo(raw);
      if (sec === 'notas') return { t: 'nota', texto: raw }; // texto libre (lo escribe /planner:repaso o tú)
      return leerCierre(raw, ctx);
    },
    canon,
  });
  return { tipo: 'semana', lineas, bom: p.bom, eol: p.eol, finalNL: p.finalNL };
}

// ---------- Escritura ----------

export function canonBloque(b) {
  const partes = [`${DIAS[b.dia]} ${formatoRango(b.inicio, b.fin)}`, b.tipo, b.titulo];
  if (b.subtipo) partes.push(`tipo: ${b.subtipo}`);
  if (b.paso) partes.push(`paso: ${b.paso}`);
  if (b.hecho != null) partes.push(`hecho: ${formatoDelta(b.hecho)}`);
  if (b.nota != null) partes.push(`nota: ${b.nota}`);
  if (b.plantilla) partes.push('plantilla');
  if (b.sugerido) partes.push('sugerido');
  partes.push(...b.extra);
  return conComentario(`- ${partes.join(' | ')}`, b.comentario);
}

export function canon(l) {
  const comun = canonComun(l);
  if (comun != null) return comun;
  switch (l.t) {
    case 'estado': return conComentario(`estado: ${l.valor}`, l.comentario);
    case 'bloque': return canonBloque(l);
    case 'las3': {
      const partes = [l.texto];
      for (const k of ['rel', 'si', 'entonces']) if (l[k]) partes.push(`${k}: ${l[k]}`);
      partes.push(...l.extra);
      return conComentario(`- [${l.hecha ? 'x' : ' '}] ${partes.join(' | ')}`, l.comentario);
    }
    case 'objetivo': return conComentario(`- ${l.tema}: ${formatoNumero(l.horas)} h`, l.comentario);
    case 'leccion': return conComentario(`- ${l.clase === 'funciono' ? 'funcionó' : 'cambio'}: ${l.texto}`, l.comentario);
    case 'resumen': return `- ${l.texto}`;
    case 'nota': return l.texto;
    default: throw new Error(`línea desconocida en semana: ${l.t}`);
  }
}

export const serializar = (doc) => serializarDoc(doc, canon);

/** Documento de semana vacío (cabecera, estado y secciones). */
export function vacia(id, valorEstado) {
  return nuevoDoc('semana', [
    cabecera(id), estado(valorEstado), { t: 'vacia' },
    seccion('las3'), { t: 'vacia' },
    seccion('bloques'),
  ]);
}

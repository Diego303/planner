// tipos.md y plantilla.md — ver docs/DISENO.md §3.3 y §3.4
import {
  clasificar, partirTexto, serializarDoc, canonComun, nuevoDoc, elementoLista, separarComentario,
  conComentario, dividirCampos, claveValor, normalizar,
} from './comun.js';
import { DIAS, parsearRango, formatoRango } from '../fechas.js';
import { SUBTIPOS } from './semana.js';

// ---------- tipos.md ----------

export const tipo = (c) => ({
  t: 'tipo', nombre: c.nombre, color: c.color.toUpperCase(), trabajo: !!c.trabajo, estudio: !!c.estudio,
  extra: c.extra ?? [], comentario: c.comentario ?? null,
});

function leerTipo(raw, ctx) {
  const c = elementoLista(raw);
  if (c == null) return null;
  const { cuerpo, comentario } = separarComentario(c);
  const [nombre, color, ...resto] = dividirCampos(cuerpo);
  if (!nombre || claveValor(nombre) || !/^#[0-9a-fA-F]{6}$/.test(color ?? '')) return null;
  const clave = normalizar(nombre);
  if (ctx.nombres?.has(clave)) return null;
  (ctx.nombres ??= new Set()).add(clave);
  const t = tipo({ nombre, color, comentario });
  for (const campo of resto) {
    const b = normalizar(campo);
    if ((b === 'trabajo' || b === 'estudio') && !t[b]) t[b] = true;
    else t.extra.push(campo);
  }
  return t;
}

const canonTipo = (l) => {
  const partes = [l.nombre, l.color];
  if (l.trabajo) partes.push('trabajo');
  if (l.estudio) partes.push('estudio');
  partes.push(...l.extra);
  return conComentario(`- ${partes.join(' | ')}`, l.comentario);
};

export const canonTipos = (l) => canonComun(l) ?? canonTipo(l);

export function parsearTipos(texto) {
  const p = partirTexto(texto);
  const ctx = {};
  const lineas = clasificar(p.lineas, {
    seccionDe: () => null,
    enCabecera: (raw) => leerTipo(raw, ctx),
    canon: canonTipos,
  });
  return { tipo: 'tipos', lineas, bom: p.bom, eol: p.eol, finalNL: p.finalNL };
}

export const serializarTipos = (doc) => serializarDoc(doc, canonTipos);

// ---------- plantilla.md ----------

export const entradaPlantilla = (c) => ({
  t: 'plantilla', dias: [...new Set(c.dias)].sort((a, b) => a - b), inicio: c.inicio, fin: c.fin, tipo: c.tipo,
  titulo: c.titulo, subtipo: c.subtipo ?? null, paso: c.paso ?? null, extra: c.extra ?? [], comentario: c.comentario ?? null,
});

function leerEntrada(raw) {
  const c = elementoLista(raw);
  if (c == null) return null;
  const { cuerpo, comentario } = separarComentario(c);
  const campos = dividirCampos(cuerpo);
  if (campos.length < 3) return null;
  const m = /^([LMXJVSD](?:[ \t]*,[ \t]*[LMXJVSD])*)[ \t]+(.+)$/i.exec(campos[0]);
  const rango = m && parsearRango(m[2]);
  const [tipoBloque, titulo] = [campos[1], campos[2]];
  if (!rango || !tipoBloque || !titulo || claveValor(tipoBloque)) return null;
  const dias = m[1].split(',').map((d) => DIAS.indexOf(d.trim().toUpperCase()));
  const e = entradaPlantilla({ dias, ...rango, tipo: tipoBloque, titulo, comentario });
  for (const campo of campos.slice(3)) {
    const kv = claveValor(campo);
    if (kv?.clave === 'tipo') {
      if (e.subtipo || !SUBTIPOS.includes(normalizar(kv.valor))) return null;
      e.subtipo = normalizar(kv.valor);
    } else if (kv?.clave === 'paso') {
      if (e.paso || !kv.valor) return null;
      e.paso = kv.valor;
    } else e.extra.push(campo);
  }
  return e;
}

const canonEntrada = (l) => {
  const partes = [`${l.dias.map((d) => DIAS[d]).join(',')} ${formatoRango(l.inicio, l.fin)}`, l.tipo, l.titulo];
  if (l.subtipo) partes.push(`tipo: ${l.subtipo}`);
  if (l.paso) partes.push(`paso: ${l.paso}`);
  partes.push(...l.extra);
  return conComentario(`- ${partes.join(' | ')}`, l.comentario);
};

export const canonPlantilla = (l) => canonComun(l) ?? canonEntrada(l);

export function parsearPlantilla(texto) {
  const p = partirTexto(texto);
  const lineas = clasificar(p.lineas, { seccionDe: () => null, enCabecera: leerEntrada, canon: canonPlantilla });
  return { tipo: 'plantilla', lineas, bom: p.bom, eol: p.eol, finalNL: p.finalNL };
}

export const serializarPlantilla = (doc) => serializarDoc(doc, canonPlantilla);

export const tiposVacio = () => nuevoDoc('tipos', [{ t: 'h1', texto: 'Tipos de bloque' }]);
export const plantillaVacia = () => nuevoDoc('plantilla', [{ t: 'h1', texto: 'Plantilla de semana' }]);

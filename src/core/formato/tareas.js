// tareas.md y archivo/tareas-AAAA-MM.md — ver docs/DISENO.md §3.6
import {
  clasificar, partirTexto, documento, serializarDoc, canonComun, nuevoDoc, elementoLista, casilla, separarComentario,
  conComentario, dividirCampos, claveValor, normalizar,
} from './comun.js';
import { esFecha, parsearDuracion, formatoDuracion } from '../fechas.js';

export const SECCIONES = { hoy: 'Hoy', mas: 'Más adelante', algun: 'Algún día' };
export const ORDEN_SECCIONES = ['hoy', 'mas', 'algun'];
const CLAVE_SECCION = { 'hoy': 'hoy', 'mas adelante': 'mas', 'algun dia': 'algun' };
const BANDERAS = new Set(['prioridad', 'las3']);

export const tarea = (c) => ({
  t: 'tarea', seccion: c.seccion ?? 'mas', hecha: !!c.hecha, texto: c.texto, tipo: c.tipo ?? null,
  prioridad: !!c.prioridad, las3: !!c.las3, fecha: c.fecha ?? null, dur: c.dur ?? null,
  creada: c.creada ?? null, fechaHecha: c.fechaHecha ?? null, extra: c.extra ?? [], comentario: c.comentario ?? null,
});

export const seccion = (clave) => ({ t: 'h2', texto: SECCIONES[clave], seccion: clave });

const LECTORES = {
  fecha: (v) => (esFecha(v) ? v : null),
  creada: (v) => (esFecha(v) ? v : null),
  hecha: (v) => (esFecha(v) ? v : null),
  dur: (v) => parsearDuracion(v),
};
const DESTINO = { fecha: 'fecha', creada: 'creada', hecha: 'fechaHecha', dur: 'dur' };

export function leerTarea(raw, seccionClave) {
  const c = elementoLista(raw);
  const cas = c && casilla(c);
  if (!cas) return null;
  const { cuerpo, comentario } = separarComentario(cas.resto);
  const [texto, ...resto] = dividirCampos(cuerpo);
  if (!texto) return null;
  const t = tarea({ seccion: seccionClave, hecha: cas.hecha, texto, comentario });
  if (resto.length && resto[0] && !claveValor(resto[0]) && !BANDERAS.has(normalizar(resto[0]))) {
    t.tipo = resto.shift();
  }
  for (const campo of resto) {
    const bandera = normalizar(campo);
    if (BANDERAS.has(bandera) && !t[bandera]) { t[bandera] = true; continue; }
    const kv = claveValor(campo);
    if (kv && LECTORES[kv.clave]) {
      const valor = LECTORES[kv.clave](kv.valor);
      const destino = DESTINO[kv.clave];
      if (valor == null || t[destino] != null) return null;
      t[destino] = valor;
    } else t.extra.push(campo);
  }
  return t;
}

export function canonTarea(t) {
  const partes = [t.texto];
  if (t.tipo) partes.push(t.tipo);
  if (t.prioridad) partes.push('prioridad');
  if (t.las3) partes.push('las3');
  if (t.fecha) partes.push(`fecha: ${t.fecha}`);
  if (t.dur != null) partes.push(`dur: ${formatoDuracion(t.dur)}`);
  if (t.creada) partes.push(`creada: ${t.creada}`);
  if (t.fechaHecha) partes.push(`hecha: ${t.fechaHecha}`);
  partes.push(...t.extra);
  return conComentario(`- [${t.hecha ? 'x' : ' '}] ${partes.join(' | ')}`, t.comentario);
}

export function canon(l) {
  const comun = canonComun(l);
  if (comun != null) return comun;
  if (l.t === 'tarea') return canonTarea(l);
  throw new Error(`línea desconocida en tareas: ${l.t}`);
}

export function parsear(texto) {
  const p = partirTexto(texto);
  const lineas = clasificar(p.lineas, {
    seccionDe: (t) => CLAVE_SECCION[normalizar(t)] ?? null,
    enSeccion: (raw, sec) => leerTarea(raw, sec),
    canon,
  });
  return documento('tareas', p, lineas);
}

export const serializar = (doc) => serializarDoc(doc, canon);

export const vacio = () => nuevoDoc('tareas', [
  seccion('hoy'), { t: 'vacia' }, seccion('mas'), { t: 'vacia' }, seccion('algun'),
]);

// ---------- Archivo mensual ----------

export function parsearArchivo(texto) {
  const p = partirTexto(texto);
  const lineas = clasificar(p.lineas, {
    seccionDe: () => 'archivo',
    enCabecera: (raw) => leerTarea(raw, 'archivo'),
    enSeccion: (raw) => leerTarea(raw, 'archivo'),
    canon,
  });
  return documento('archivo', p, lineas);
}

export const archivoVacio = (mes) => nuevoDoc('archivo', [{ t: 'h1', texto: `Archivo de tareas · ${mes}` }, { t: 'vacia' }]);

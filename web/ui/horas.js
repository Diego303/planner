// Horas escritas por la persona («de 8:30 a 18:00») en vez de duraciones fijas.
import * as f from '/core/fechas.js';
import { html } from './dom.js';

/** Lo que se escribe a mano → «HH:MM»: «9» → 09:00, «930» → 09:30, «9.30» / «9h30» → 09:30. null si no es una hora. */
export function normalizarHora(texto) {
  let t = String(texto ?? '').trim().toLowerCase().replace(/[.,h]/g, ':').replace(/:$/, '');
  if (/^\d{1,2}$/.test(t)) t = `${t}:00`;
  else if (/^\d{3,4}$/.test(t)) t = `${t.slice(0, -2)}:${t.slice(-2)}`;
  const min = f.aMinutos(t);
  return min == null ? null : (min === 1440 ? '24:00' : f.deMinutos(min));
}

/** «HH:MM» de un <input type="time"> → minutos. Como hora de fin, «00:00» es medianoche (24:00). */
export function minutosDeHora(v, { esFin = false } = {}) {
  const min = f.aMinutos(normalizarHora(v) ?? '');
  if (min == null) return null;
  return esFin && min === 0 ? 1440 : min;
}

/** Minutos → «HH:MM» (las 24:00 se escriben «24:00»). */
export const horaDeMinutos = (min) => (min >= 1440 ? '24:00' : f.deMinutos(min));

/** Campo de hora en 24 h (siempre «21:30», sea cual sea el idioma del navegador) con sugerencias cada media hora. */
export const campoHora = (id, valor, etiqueta) =>
  html`<input type="text" class="hora" id="${id}" value="${valor}" inputmode="numeric" maxlength="5" placeholder="hh:mm" list="horas-30" aria-label="${etiqueta}" autocomplete="off">`;
export const sugerenciasHora = () =>
  html`<datalist id="horas-30">${Array.from({ length: 48 }, (_, i) => html`<option value="${f.deMinutos(i * 30)}"></option>`)}</datalist>`;

/** 570 → «9 h 30 min» */
export function textoDuracion(min) {
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60), r = min % 60;
  return [h ? `${h} h` : '', r ? `${r} min` : ''].filter(Boolean).join(' ');
}

/** Lee «de» y «a» → { inicio, fin } o { error } en palabras claras. */
export function leerHoras(de, a) {
  const inicio = minutosDeHora(de), fin = minutosDeHora(a, { esFin: true });
  if (inicio == null || fin == null) return { error: 'Pon la hora de inicio y la de fin' };
  if (fin <= inicio) return { error: 'La hora de fin tiene que ser después de la de inicio' };
  return { inicio, fin };
}

// Utilidades de DOM: plantillas HTML con escape automático y lectura del tema activo.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Html {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

/** Marca un texto como HTML ya seguro. */
export const raw = (s) => new Html(String(s ?? ''));

function valor(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(valor).join('');
  return esc(v);
}

/** Plantilla: html`<b>${texto}</b>` escapa lo interpolado salvo raw() y otras plantillas. */
export function html(partes, ...valores) {
  let out = partes[0];
  valores.forEach((v, i) => { out += valor(v) + partes[i + 1]; });
  return new Html(out);
}

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Sustituye el contenido si cambió, conservando el foco y la selección del campo activo (por id). */
export function pintar(el, contenido) {
  const s = String(contenido);
  if (el.innerHTML === s) return;
  const activo = document.activeElement;
  const id = activo && el.contains(activo) ? activo.id : null;
  const sel = id && 'selectionStart' in activo ? [activo.selectionStart, activo.selectionEnd] : null;
  el.innerHTML = s;
  if (id) {
    const nuevo = document.getElementById(id);
    nuevo?.focus();
    if (sel && nuevo?.setSelectionRange) try { nuevo.setSelectionRange(...sel); } catch { /* no aplica */ }
  }
}

/** Modo y superficie del tema activo (para los colores de tipo de core/color.js). */
export function temaActual() {
  const cs = getComputedStyle(document.documentElement);
  return {
    modo: cs.getPropertyValue('--modo').trim() || 'claro',
    superficie: cs.getPropertyValue('--superficie').trim(), // si no es hexadecimal, core/color.js usa su valor por defecto
  };
}

/** Delegación de eventos: on(raiz, 'click', '[data-x]', (ev, el) => …) */
export function on(raiz, tipo, selector, fn, opciones) {
  raiz.addEventListener(tipo, (ev) => {
    const el = ev.target.closest?.(selector);
    if (el && raiz.contains(el)) fn(ev, el);
  }, opciones);
}

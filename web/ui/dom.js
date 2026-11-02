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

/**
 * Sustituye el contenido conservando el foco y la selección del campo activo (por id) y lo que se esté
 * escribiendo: un repintado de fondo (otra operación, un cambio de fuera) no borra un formulario a medias.
 * Lo escrito solo vuelve a un campo con el mismo id y el mismo valor de partida (no pasa de una tarea a otra).
 */
export function sustituir(el, contenido) {
  const activo = document.activeElement;
  const id = activo && el.contains(activo) ? activo.id : null;
  const sel = id && 'selectionStart' in activo ? [activo.selectionStart, activo.selectionEnd] : null;
  const escritos = [...el.querySelectorAll('input[id], textarea[id]')]
    .filter((x) => x.type !== 'checkbox' && x.type !== 'radio' && x.value !== x.defaultValue)
    .map((x) => [x.id, x.defaultValue, x.value]);
  el.innerHTML = String(contenido);
  for (const [cual, base, valor] of escritos) {
    const nuevo = document.getElementById(cual);
    if (nuevo && el.contains(nuevo) && nuevo.defaultValue === base && nuevo.value === base) nuevo.value = valor;
  }
  if (id) {
    const nuevo = document.getElementById(id);
    nuevo?.focus();
    if (sel && nuevo?.setSelectionRange) try { nuevo.setSelectionRange(...sel); } catch { /* no aplica */ }
  }
}

// Zonas que no se repintaron porque había una interacción en marcha: se repintan al terminar (ver app.js).
const aplazadas = new Set();
export const hayRepintadoAplazado = () => aplazadas.size > 0;
export const olvidarAplazados = () => aplazadas.clear();

/** ¿Se está escribiendo en un texto editable o se tiene un bloque agarrado dentro de `el`? */
function ocupado(el) {
  const a = document.activeElement;
  return (a && a.isContentEditable && el.contains(a)) || !!el.querySelector('.agarrado');
}

/**
 * Como sustituir(), pero solo si el contenido cambió. Si hay una interacción en marcha dentro (con el disco lento,
 * la respuesta de una operación llega mientras haces la siguiente), se aplaza: repintar en ese momento borraría lo
 * que escribes o soltaría el bloque que arrastras.
 */
export function pintar(el, contenido) {
  const s = String(contenido);
  if (el.innerHTML === s) return;
  if (ocupado(el)) { aplazadas.add(el); return; }
  sustituir(el, s);
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

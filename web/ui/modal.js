// Modal único: se abre con contenido HTML, se cierra con ×, Esc o clic fuera. Al cerrar devuelve el foco.
import { html, raw, sustituir } from './dom.js';

let anterior = null;
let alCerrar = null;
const raiz = () => document.getElementById('modal');

export const modalAbierto = () => !!raiz().firstElementChild;
export const cuerpoModal = () => raiz().querySelector('.mod');

/** Cabecera estándar de modal: título + botón de cerrar. */
export const cabecera = (titulo) => html`<div class="mod-cab"><b>${titulo}</b><button type="button" class="cerrar" data-cerrar-modal aria-label="Cerrar">×</button></div>`;

export function abrirModal(contenido, { etiqueta = 'Diálogo', onCerrar = null } = {}) {
  const yaAbierto = modalAbierto();
  if (!yaAbierto) anterior = document.activeElement;
  alCerrar = onCerrar;
  const scroll = yaAbierto ? cuerpoModal().scrollTop : 0;
  // abierto ya (repintado tras un cambio): sin perder lo que se esté escribiendo ni el foco
  sustituir(raiz(), html`<div class="mwrap" data-velo><div class="mod" role="dialog" aria-modal="true" aria-label="${etiqueta}">${raw(contenido)}</div></div>`);
  const mod = cuerpoModal();
  mod.scrollTop = scroll;
  if (!yaAbierto) (mod.querySelector('[autofocus], input, select, button:not(.cerrar)') ?? mod).focus?.();
  return mod;
}

export function cerrarModal() {
  if (!modalAbierto()) return;
  raiz().innerHTML = '';
  const f = alCerrar;
  alCerrar = null;
  f?.();
  anterior?.focus?.();
}

export function iniciarModal() {
  raiz().addEventListener('click', (ev) => {
    if (ev.target.matches('[data-velo]') || ev.target.closest('[data-cerrar-modal]')) cerrarModal();
  });
}

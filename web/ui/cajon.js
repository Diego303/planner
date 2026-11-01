// Cajón derecho: pestañas Hoy · Metas · Diario (en la vista Hoy, sin «Hoy» para no duplicar).
// Cada pestaña la aporta su fase: `pestanasCajon.hoy = { titulo, pintar() → html, iniciar(raiz) }`.
import { html, $, on, pintar } from './dom.js';
import { st } from '../estado.js';

export const pestanasCajon = {};
const ORDEN = ['hoy', 'metas', 'diario'];

export function pintarCajon() {
  const raiz = $('#drawer');
  const disponibles = ORDEN.filter((t) => pestanasCajon[t] && !(st.ui.vista === 'hoy' && t === 'hoy'));
  if (!disponibles.length) { raiz.hidden = true; return; }
  raiz.hidden = st.ui.vista === 'progreso';
  if (!disponibles.includes(st.ui.cajon)) st.ui.cajon = disponibles[0];
  const actual = pestanasCajon[st.ui.cajon];
  pintar(raiz, html`<div class="dr" role="tablist">${disponibles.map((t) => html`<button type="button" role="tab" aria-selected="${(t === st.ui.cajon) ? 'true' : 'false'}" class="${t === st.ui.cajon ? 'on' : ''}" data-cajon="${t}">${pestanasCajon[t].titulo}</button>`)}</div><div role="tabpanel">${actual.pintar()}</div>`);
}

export function iniciarCajon() {
  const raiz = $('#drawer');
  on(raiz, 'click', '[data-cajon]', (_ev, el) => { st.ui.cajon = el.dataset.cajon; pintarCajon(); });
  for (const p of Object.values(pestanasCajon)) p.iniciar?.(raiz);
}

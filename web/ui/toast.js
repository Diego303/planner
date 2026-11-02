// Toasts: mensaje + «deshacer» (y otra acción, como «✎ editar») durante 10 s. Los errores se ven siempre, nunca en silencio.
import { html } from './dom.js';

let temporizador = null;

export function cerrarToast() {
  clearTimeout(temporizador);
  document.getElementById('toast').innerHTML = '';
}

/** Toast con «deshacer» (opcional) y otra acción (opcional: { texto, fn }, p. ej. «✎ editar»). */
export function toast(mensaje, { deshacer = null, accion = null, duracion = 10000 } = {}) {
  const raiz = document.getElementById('toast');
  raiz.innerHTML = String(html`<div class="toast ${deshacer || accion ? '' : 'solo'}"><span>${mensaje}</span>${accion ? html`<button type="button" data-accion-toast>${accion.texto}</button>` : ''}${deshacer ? html`<button type="button" data-deshacer>deshacer</button>` : ''}</div>`);
  const boton = raiz.querySelector('[data-deshacer]');
  if (boton) boton.onclick = () => { cerrarToast(); deshacer(); };
  const otro = raiz.querySelector('[data-accion-toast]');
  if (otro) otro.onclick = () => { cerrarToast(); accion.fn(); };
  clearTimeout(temporizador);
  temporizador = setTimeout(cerrarToast, duracion);
}

export const toastError = (mensaje) => toast(`⚠ ${mensaje}`, { duracion: 7000 });

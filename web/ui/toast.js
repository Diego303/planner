// Toasts: mensaje + «deshacer» durante 10 s. Los errores se ven siempre, nunca en silencio.
import { html } from './dom.js';

let temporizador = null;

export function cerrarToast() {
  clearTimeout(temporizador);
  document.getElementById('toast').innerHTML = '';
}

export function toast(mensaje, { deshacer = null, duracion = 10000 } = {}) {
  const raiz = document.getElementById('toast');
  raiz.innerHTML = String(html`<div class="toast ${deshacer ? '' : 'solo'}"><span>${mensaje}</span>${deshacer ? html`<button type="button" data-deshacer>deshacer</button>` : ''}</div>`);
  const boton = raiz.querySelector('[data-deshacer]');
  if (boton) boton.onclick = () => { cerrarToast(); deshacer(); };
  clearTimeout(temporizador);
  temporizador = setTimeout(cerrarToast, duracion);
}

export const toastError = (mensaje) => toast(`⚠ ${mensaje}`, { duracion: 7000 });

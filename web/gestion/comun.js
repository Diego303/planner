// Piezas comunes de los modales de Gestión.
import { html } from '../ui/dom.js';
import { menuGestion } from '../app.js';
import * as f from '/core/fechas.js';

/** Registra una entrada del menú Gestión ▾ en su posición (orden). */
export function entradaMenu(entrada) {
  menuGestion.push(entrada);
  menuGestion.sort((a, b) => a.orden - b.orden);
}

export const itemMenu = (id, izquierda, derecha = '') =>
  html`<button type="button" role="menuitem" class="it" data-gestion="${id}"><span>${izquierda}</span>${derecha}</button>`;

/** Opciones de hora cada 30 min entre dos horas (en minutos). */
export const opcionesHora = (desde, hasta, elegida) => {
  const out = [];
  for (let t = desde; t < hasta; t += 30) out.push(html`<option value="${t}" ${t === elegida ? 'selected' : ''}>${f.horaCorta(t)}</option>`);
  return out;
};

export const etiquetaDuracion = (min) => (min < 60 ? `${min} min` : `${f.numero(min / 60)} h`);

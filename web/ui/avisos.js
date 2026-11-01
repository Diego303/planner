// Aviso de líneas no reconocidas: se conservan en el fichero y se enseñan con su texto original.
import { html } from './dom.js';
import { desconocidas } from '/core/modelo.js';

export function avisoLineas(ruta, doc) {
  const lista = desconocidas(doc);
  if (!lista.length) return '';
  const n = lista.length;
  return html`<details class="desconocidas"><summary>⚠ ${n} línea${n === 1 ? '' : 's'} no reconocida${n === 1 ? '' : 's'} en ${ruta} · se conserva${n === 1 ? '' : 'n'} tal cual</summary>${lista.map((l) => html`<code>⚠ línea no reconocida · ${l.texto}</code>`)}</details>`;
}

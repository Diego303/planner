// Rejilla de miniaturas de los temas (Gestión → Tema y Ajustes). Sin estado: recibe el tema activo y tema.md.
import { html, raw } from './dom.js';
import { TEMAS, cssPersonalizado, tieneTemaPersonal } from '/core/temas.js';
import { valoresTema } from '/core/modelo.js';

const ANCHOS = ['78%', '55%', '66%'];

/** Una miniatura por tema: fondo, tarjeta y tres bloques de muestra. */
export function rejillaTemas(activo, temaDoc) {
  const hayPersonal = tieneTemaPersonal(temaDoc);
  return html`<div class="temas-grid" role="radiogroup" aria-label="Tema">${TEMAS.map((t) => {
    const personal = t.id === 'personalizado';
    const muestra = personal ? valoresTema(temaDoc).base : t.id;
    const on = activo === t.id;
    // los valores de tema.md pueden llevar comillas (fuentes): van escapados, nunca con raw()
    return html`<button type="button" class="miniatura ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-elegir-tema="${t.id}" ${personal && !hayPersonal ? raw('disabled title="Crea tema.md en tu carpeta de datos (base y colores)"') : ''}><div class="muestra" data-tema-muestra="${muestra}" style="${personal ? cssPersonalizado(temaDoc) : ''}"><div class="m-tarjeta"><span class="m-titulo"></span>${ANCHOS.map((w, i) => html`<span class="m-blk" data-muestra-bloque="${i}" style="width:${w}"></span>`)}</div></div>${t.nombre}</button>`;
  })}</div>`;
}

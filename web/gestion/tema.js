// Gestión → Tema (y también en Ajustes): miniaturas de cada tema, decoración y tema de temporada.
import { html, raw, on, $$ } from '../ui/dom.js';
import { abrirModal, cabecera, cuerpoModal, modalAbierto } from '../ui/modal.js';
import { st, enviar, derivados, alCambiar } from '../estado.js';
import { seccionesAjustes, alPintarAjustes } from './ajustes.js';
import { entradaMenu, itemMenu } from './comun.js';
import { TEMAS, cssPersonalizado, tieneTemaPersonal, atributosTema } from '/core/temas.js';
import { valoresTema } from '/core/modelo.js';
import { colorBloque, contraste, hexARgb } from '/core/color.js';
import * as m from '/core/modelo.js';

let abierta = false;

/** Contraste del tema personalizado (solo con colores hexadecimales). */
function avisoContraste() {
  const d = derivados();
  if (atributosTema(d.ajustes, st.datos.ficheros['tema.md'], d.meta.hoy).personalizado === false) return '';
  const cs = getComputedStyle(document.documentElement);
  const v = (k) => cs.getPropertyValue(`--${k}`).trim();
  const pares = [['texto', 'fondo'], ['texto', 'superficie'], ['acento-texto', 'acento']];
  const malos = pares.filter(([a, b]) => hexARgb(v(a)) && hexARgb(v(b)) && contraste(v(a), v(b)) < 4.5);
  return malos.length ? html`<div class="aviso-contraste" role="alert">⚠ El texto sobre tu fondo tiene poco contraste (${malos.map(([a, b]) => `${a} sobre ${b}`).join(', ')}). Se respeta tu tema; revisa tema.md.</div>` : '';
}

/** Cuadrícula de miniaturas: fondo, tarjeta y tres bloques de muestra en cada tema. */
export function selectorTemas() {
  const d = derivados();
  const temaDoc = st.datos.ficheros['tema.md'];
  const hayPersonal = tieneTemaPersonal(temaDoc);
  const anchos = ['78%', '55%', '66%'];
  return html`<div class="temas-grid" role="radiogroup" aria-label="Tema">${TEMAS.map((t) => {
    const personal = t.id === 'personalizado';
    const muestra = personal ? valoresTema(temaDoc).base : t.id;
    const on = d.ajustes.tema === t.id;
    return html`<button type="button" class="miniatura ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-elegir-tema="${t.id}" ${personal && !hayPersonal ? raw('disabled title="Crea tema.md en tu carpeta de datos (base y colores)"') : ''}><div class="muestra" data-tema-muestra="${muestra}" style="${personal ? raw(cssPersonalizado(temaDoc)) : ''}"><div class="m-tarjeta"><span class="m-titulo"></span>${anchos.map((w, i) => html`<span class="m-blk" data-muestra-bloque="${i}" style="width:${w}"></span>`)}</div></div>${t.nombre}</button>`;
  })}</div>
<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px"><label class="fila" style="margin:0"><input type="checkbox" data-ajuste-tema="decoracion" ${d.ajustes.decoracion ? 'checked' : ''}> Decoración del tema <span class="mut">(Universo y Halloween)</span></label><label class="fila" style="margin:0"><input type="checkbox" data-ajuste-tema="tema_temporada" ${d.ajustes.tema_temporada ? 'checked' : ''}> Halloween del 25 al 31 de octubre</label></div>${avisoContraste()}`;
}

/** Pinta los bloques de muestra con los colores de tipo de cada tema (core/color.js). */
export function colorearMuestras(raiz) {
  const tipos = derivados().tipos.slice(0, 3);
  for (const blk of $$('[data-muestra-bloque]', raiz)) {
    const cs = getComputedStyle(blk.closest('.muestra'));
    const tema = { modo: cs.getPropertyValue('--modo').trim() || 'claro', superficie: cs.getPropertyValue('--superficie').trim() };
    const tipo = tipos[+blk.dataset.muestraBloque] ?? tipos[0];
    blk.style.background = colorBloque(m.colorDeTipo(derivados().tipos, tipo?.nombre), tema).fondo;
    blk.style.borderLeft = `3px solid ${colorBloque(m.colorDeTipo(derivados().tipos, tipo?.nombre), tema).texto}`;
  }
}

export function enlazarSelector(raiz) {
  on(raiz, 'click', '[data-elegir-tema]', (_ev, el) => enviar('ajustes.cambiar', { clave: 'tema', valor: el.dataset.elegirTema }));
  on(raiz, 'change', '[data-ajuste-tema]', (_ev, el) => enviar('ajustes.cambiar', { clave: el.dataset.ajusteTema, valor: el.checked }));
}

function repintar() {
  if (!abierta || !modalAbierto()) return;
  abrirModal(contenido(), { etiqueta: 'Tema', onCerrar: () => { abierta = false; } });
  enlazarSelector(cuerpoModal());
  colorearMuestras(cuerpoModal());
}

const contenido = () => html`${cabecera('Tema')}<div class="mut mod-nota">Se aplica al momento y se guarda en ajustes.md. «Automático» sigue el modo claro u oscuro del sistema; «Personalizado» lee tema.md.</div>${selectorTemas()}`;

export function abrirTema() {
  abierta = true;
  abrirModal(contenido(), { etiqueta: 'Tema', onCerrar: () => { abierta = false; } });
  enlazarSelector(cuerpoModal());
  colorearMuestras(cuerpoModal());
}

alCambiar(repintar);
entradaMenu({ id: 'tema', orden: 50, pintar: () => itemMenu('tema', 'Tema', html`<span class="mut">${TEMAS.find((t) => t.id === derivados().ajustes.tema)?.nombre ?? ''}</span>`), accion: abrirTema });
seccionesAjustes.push(() => html`<label>Tema</label>${selectorTemas()}`);
alPintarAjustes.push((mod) => { enlazarSelector(mod); colorearMuestras(mod); });

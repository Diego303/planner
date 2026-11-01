// Editor de bloque (popover): título, tipo, subtipo de estudio, cuándo, primer paso y ↻ plantilla.
// Los pasos «Hecho ✓» y «A medias» se enganchan desde vistas/hecho.js (registro `pasosEditor`).
import { html, raw, $, $$ } from '../ui/dom.js';
import { abrirPopover, cerrarPopover, repintarPopover } from '../ui/popover.js';
import { st, enviar, derivados } from '../estado.js';
import { toast } from '../ui/toast.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { textoSobre } from '/core/color.js';

const DURACIONES = [30, 60, 90, 120, 150, 180, 240, 510];

/** Pasos extra del editor (los registra la fase de «Hecho» y «A medias»): { nombre: { pie(b), cuerpo(b, ed), alAbrir(el, b, ed) } } */
export const pasosEditor = {};
/** Botones extra del pie: [(b) → html] */
export const botonesPie = [];

let ed = null; // estado del editor abierto: { id, huella, tipo, subtipo, modo }

export const editorAbierto = () => ed;

const etiquetaDuracion = (min) => (min < 60 ? `${min} min` : `${f.numero(min / 60)} h`);

/** Aviso «la última vez lo dejaste en…» del tema del bloque (estudio o proyecto). */
export function dejadoDe(d, titulo) {
  const tema = m.temaDe(titulo);
  return (m.buscarTema(d.temas, tema) ?? m.buscarTema(d.proyectos, tema))?.dejado ?? null;
}

function contenido(b, d) {
  const esEstudio = m.esEstudio(d.tipos, ed.tipo);
  const dej = dejadoDe(d, b.titulo);
  const las3 = m.las3De(d.semanaDoc);
  const h0 = d.ajustes.horas.desde * 60, h1 = d.ajustes.horas.hasta * 60;
  const inicios = [];
  for (let t = h0; t < h1; t += 30) inicios.push(t);
  if (!inicios.includes(b.inicio)) inicios.push(b.inicio), inicios.sort((x, y) => x - y);
  const duraciones = DURACIONES.includes(b.fin - b.inicio) ? DURACIONES : [...DURACIONES, b.fin - b.inicio].sort((x, y) => x - y);
  const fechas = f.diasDeSemana(st.ui.semana);
  const paso = ed.modo && pasosEditor[ed.modo];
  return html`<div class="pop-cab"><b>${b.sugerido ? 'Sugerencia' : 'Bloque'}${m.avanzaLas3(b.titulo, las3) ? html` <span class="pill" style="margin-left:4px">★ avanza las 3</span>` : ''}</b><button type="button" class="cerrar" data-ed="cerrar" aria-label="Cerrar">×</button></div>
${dej && b.hecho == null ? html`<div class="nota-dejado">La última vez lo dejaste en: <b>${dej}</b></div>` : ''}
<label for="ed-titulo">Título</label><input id="ed-titulo" value="${b.titulo}" maxlength="140" autocomplete="off">
<label>Tipo</label><div class="chips" role="radiogroup" aria-label="Tipo">${d.tipos.map((t) => {
    const on = m.normalizar(t.nombre) === m.normalizar(ed.tipo);
    return html`<button type="button" class="ac ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-tipo="${t.nombre}" style="${on ? raw(`background:${t.color};color:${textoSobre(t.color)}`) : ''}">${t.nombre}</button>`;
  })}</div>
<div data-subtipos ${esEstudio ? '' : 'hidden'}><label>Cómo vas a estudiar</label><div class="chips">${[['aprender', 'aprender'], ['repasar', '⟲ repasar'], ['simulacro', '◎ simulacro']].map(([k, t]) => html`<button type="button" class="ac ${ed.subtipo === k ? 'on' : ''}" data-subtipo="${k}" aria-pressed="${ed.subtipo === k}">${t}</button>`)}</div></div>
<label>Cuándo</label><div class="cuando">
  <select id="ed-dia" aria-label="Día">${f.DIAS.map((l, i) => html`<option value="${i}" ${i === b.dia ? 'selected' : ''}>${l} ${+fechas[i].slice(8)}</option>`)}</select>
  <select id="ed-inicio" aria-label="Hora de inicio">${inicios.map((t) => html`<option value="${t}" ${t === b.inicio ? 'selected' : ''}>${f.horaCorta(t)}</option>`)}</select>
  <select id="ed-dur" aria-label="Duración">${duraciones.map((x) => html`<option value="${x}" ${x === b.fin - b.inicio ? 'selected' : ''}>${etiquetaDuracion(x)}</option>`)}</select>
</div>
<label for="ed-paso">Primer paso <span style="color:var(--texto-3)">(opcional · qué abres y qué haces primero)</span></label><input id="ed-paso" value="${b.paso ?? ''}" maxlength="200" placeholder="p. ej. abrir el PDF del tema 4 y hacer las 10 preguntas" autocomplete="off">
<label class="fila" style="margin-top:10px"><input type="checkbox" id="ed-plantilla" ${b.plantilla ? 'checked' : ''}> ↻ en la plantilla (cada semana)</label>
${paso ? paso.cuerpo(b, ed) : html`<div class="pie">${b.sugerido
    ? html`<button type="button" class="dark" data-ed="aceptar">Aceptar</button>`
    : html`<button type="button" data-ed="guardar">Guardar</button>${botonesPie.map((fn) => fn(b))}`}<button type="button" class="peligro-texto" data-ed="eliminar">Eliminar</button></div>
${b.plantilla ? html`<div class="mut pista">Los cambios aquí solo afectan a esta semana. La plantilla se edita en Gestión → Plantilla.</div>` : ''}`}`;
}

/** Lee el formulario del editor → cambios para bloque.editar. */
export function leerCambios(el, b) {
  const d = derivados();
  const inicio = +$('#ed-inicio', el).value;
  const fin = Math.min(d.ajustes.horas.hasta * 60, inicio + +$('#ed-dur', el).value);
  const cambios = {
    titulo: $('#ed-titulo', el).value.trim() || 'Sin título',
    tipo: ed.tipo,
    subtipo: m.esEstudio(d.tipos, ed.tipo) ? ed.subtipo : null,
    dia: +$('#ed-dia', el).value, inicio, fin: Math.max(fin, inicio + 30),
    paso: $('#ed-paso', el).value.trim() || null,
  };
  const plantilla = $('#ed-plantilla', el).checked;
  if (plantilla !== b.plantilla) cambios.plantilla = plantilla;
  return cambios;
}

const bloqueActual = () => m.bloquesDe(derivados().semanaDoc).find((x) => x.id === ed?.id);

/** Guarda lo que haya en el formulario (sin cerrar si `seguir`). */
export function guardarFormulario(el, extra = {}) {
  const b = bloqueActual();
  if (!b) return null;
  const cambios = { ...leerCambios(el, b), ...extra };
  const igual = Object.entries(cambios).every(([k, v]) => b[k] === v);
  if (!igual) enviar('bloque.editar', { semana: st.ui.semana, id: ed.id, huella: ed.huella, cambios });
  if (cambios.plantilla === false) toast('Solo en esta semana: la plantilla se cambia en Gestión → Plantilla');
  // tras editar, la huella cambia: la del bloque ya actualizado en local
  const nuevo = m.bloquesDe(derivados().semanaDoc).find((x) => x.id === ed.id);
  if (nuevo) ed.huella = m.huellaDe(nuevo);
  return nuevo ?? b;
}

export function cerrarEditor() {
  ed = null;
  cerrarPopover();
}

export function abrirEditor(id, { modo = null } = {}) {
  const d = derivados();
  const b = m.bloquesDe(d.semanaDoc).find((x) => x.id === id);
  const card = $('#wk');
  const ancla = card?.querySelector(`.blk[data-id="${id}"]`);
  if (!b || !ancla) return;
  ed = { id, huella: m.huellaDe(b), tipo: b.tipo, subtipo: b.subtipo, modo };
  const el = abrirPopover(card, ancla, contenido(b, d));
  enlazar(el, b);
  (modo ? el.querySelector('[data-paso-foco]') : $('#ed-titulo', el))?.focus();
}

/** Cambia el editor abierto a otro paso (Hecho, A medias) conservando lo escrito. */
export function cambiarPaso(el, modo) {
  const b = guardarFormulario(el);
  if (!b) return;
  ed.modo = modo;
  const nuevo = repintarPopover(contenido(b, derivados()));
  enlazar(nuevo, b);
  nuevo.querySelector('[data-paso-foco]')?.focus();
}

function enlazar(el, b) {
  el.onclick = (ev) => {
    const t = ev.target.closest('[data-tipo],[data-subtipo],[data-ed],[data-paso]');
    if (!t) return;
    if (t.dataset.tipo) {
      ed.tipo = t.dataset.tipo;
      const d = derivados();
      for (const x of $$('[data-tipo]', el)) {
        const on = x.dataset.tipo === ed.tipo;
        const tipo = m.tipoPorNombre(d.tipos, x.dataset.tipo);
        x.classList.toggle('on', on);
        x.setAttribute('aria-checked', on);
        x.style.cssText = on ? `background:${tipo.color};color:${textoSobre(tipo.color)}` : '';
      }
      $('[data-subtipos]', el).hidden = !m.esEstudio(d.tipos, ed.tipo);
    } else if (t.dataset.subtipo) {
      ed.subtipo = ed.subtipo === t.dataset.subtipo ? null : t.dataset.subtipo;
      for (const x of $$('[data-subtipo]', el)) { x.classList.toggle('on', x.dataset.subtipo === ed.subtipo); x.setAttribute('aria-pressed', x.dataset.subtipo === ed.subtipo); }
    } else if (t.dataset.ed === 'cerrar') cerrarEditor();
    else if (t.dataset.ed === 'guardar') { guardarFormulario(el); cerrarEditor(); }
    else if (t.dataset.ed === 'aceptar') { guardarFormulario(el, { sugerido: false }); cerrarEditor(); }
    else if (t.dataset.ed === 'eliminar') {
      const actual = bloqueActual();
      if (!actual) return cerrarEditor();
      enviar('bloque.eliminar', { semana: st.ui.semana, id: ed.id, huella: m.huellaDe(actual) }, { mensaje: () => `Bloque «${actual.titulo}» eliminado` });
      cerrarEditor();
    } else if (t.dataset.paso) {
      cambiarPaso(el, t.dataset.paso);
    }
  };
  el.onkeydown = (ev) => {
    if (ev.key === 'Enter' && ev.target.matches('#ed-titulo, #ed-paso')) {
      ev.preventDefault();
      guardarFormulario(el, b.sugerido ? { sugerido: false } : {});
      cerrarEditor();
    }
  };
  pasosEditor[ed.modo]?.alAbrir?.(el, b, ed);
}


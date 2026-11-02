// Editor de bloque (popover): título, tipo, subtipo de estudio, cuándo, primer paso y ↻ plantilla.
// Los pasos «Hecho ✓» y «A medias» se enganchan desde vistas/hecho.js (registro `pasosEditor`).
import { html, raw, $, $$, pintar } from '../ui/dom.js';
import { abrirPopover, cerrarPopover, repintarPopover } from '../ui/popover.js';
import { st, enviar, derivados } from '../estado.js';
import { toast } from '../ui/toast.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { textoSobre } from '/core/color.js';
import { horaDeMinutos, textoDuracion, leerHoras, campoHora, sugerenciasHora, normalizarHora } from '../ui/horas.js';

/** Pasos extra del editor (los registra la fase de «Hecho» y «A medias»): { nombre: { pie(b), cuerpo(b, ed), alAbrir(el, b, ed) } } */
export const pasosEditor = {};
/** Botones extra del pie: [(b) → html] */
export const botonesPie = [];
/** Acciones de esos botones (data-ed="nombre"): { nombre(el, bloque) } */
export const accionesEditor = {};

let ed = null; // estado del editor abierto: { id, huella, tipo, subtipo, modo }

export const editorAbierto = () => ed;
export { bloqueActual };


/** Aviso «la última vez lo dejaste en…» del tema del bloque (estudio o proyecto). */
export function dejadoDe(d, titulo) {
  const tema = m.temaDe(titulo);
  return (m.buscarTema(d.temas, tema) ?? m.buscarTema(d.proyectos, tema))?.dejado ?? null;
}

function contenido(b, d) {
  const esEstudio = m.esEstudio(d.tipos, ed.tipo);
  const dej = dejadoDe(d, b.titulo);
  const las3 = m.las3De(d.semanaDoc);
  const columnas = f.columnasSemana(st.ui.semana, d.ajustes.inicio_semana);
  if (!columnas.some((c) => c.semana === ed.semana && c.dia === b.dia)) columnas.push({ semana: ed.semana, dia: b.dia, fecha: f.fechaDeDia(ed.semana, b.dia) });
  const paso = ed.modo && pasosEditor[ed.modo];
  return html`<div class="pop-cab"><b>${b.sugerido ? 'Sugerencia' : 'Bloque'}${m.avanzaLas3(b.titulo, las3) ? html` <span class="pill" style="margin-left:4px">★ avanza las 3</span>` : ''}</b><button type="button" class="cerrar" data-ed="cerrar" aria-label="Cerrar">×</button></div>
${dej && b.hecho == null ? html`<div class="nota-dejado">La última vez lo dejaste en: <b>${dej}</b></div>` : ''}
<label for="ed-titulo">Título</label><input id="ed-titulo" value="${b.titulo}" maxlength="140" autocomplete="off">
<label>Tipo</label><div class="chips" role="radiogroup" aria-label="Tipo">${d.tipos.map((t) => {
    const on = m.normalizar(t.nombre) === m.normalizar(ed.tipo);
    return html`<button type="button" class="ac ${on ? 'on' : ''}" role="radio" aria-checked="${(on) ? 'true' : 'false'}" data-tipo="${t.nombre}" style="${on ? raw(`background:${t.color};color:${textoSobre(t.color)}`) : ''}">${t.nombre}</button>`;
  })}<button type="button" class="ac" data-ed="tipo-nuevo" aria-label="Nuevo tipo">＋ nuevo</button><span data-tipo-nuevo hidden><input id="ed-tipo-nuevo" placeholder="nombre del tipo" aria-label="Nombre del tipo nuevo" style="width:120px;font-size:11.5px" autocomplete="off"></span></div>
<div data-subtipos ${esEstudio ? '' : 'hidden'}><label>Cómo vas a estudiar</label><div class="chips">${[['aprender', 'aprender'], ['repasar', '⟲ repasar'], ['simulacro', '◎ simulacro']].map(([k, t]) => html`<button type="button" class="ac ${ed.subtipo === k ? 'on' : ''}" data-subtipo="${k}" aria-pressed="${(ed.subtipo === k) ? 'true' : 'false'}">${t}</button>`)}</div></div>
<label>Cuándo</label><div class="cuando">
  <select id="ed-dia" aria-label="Día">${columnas.map((c) => html`<option value="${c.semana}|${c.dia}" ${c.semana === ed.semana && c.dia === b.dia ? 'selected' : ''}>${f.DIAS[c.dia]} ${+c.fecha.slice(8)}</option>`)}<option value="otra">otra fecha…</option></select>
  <input type="date" id="ed-fecha" value="${f.fechaDeDia(ed.semana, b.dia)}" aria-label="Fecha" hidden>
</div><div class="cuando" style="margin-top:5px">
  <span class="mut">de</span>${campoHora('ed-inicio', horaDeMinutos(b.inicio), 'Empieza')}
  <span class="mut">a</span>${campoHora('ed-fin', horaDeMinutos(b.fin), 'Termina')}${sugerenciasHora()}
  <span class="mut" style="font-size:11px" id="ed-dur-texto">${textoDuracion(b.fin - b.inicio)}</span>
</div><div class="aviso-texto" style="font-size:11px;margin-top:3px" id="ed-aviso-horas">${avisoHoras(b.inicio, b.fin, d)}</div><div class="error-form" role="alert" id="ed-error"></div>
<label for="ed-paso">Primer paso <span style="color:var(--texto-3)">(opcional · qué abres y qué haces primero)</span></label><input id="ed-paso" value="${b.paso ?? ''}" maxlength="200" placeholder="p. ej. abrir el PDF del tema 4 y hacer las 10 preguntas" autocomplete="off">
<label class="fila" style="margin-top:10px"><input type="checkbox" id="ed-plantilla" ${b.plantilla ? 'checked' : ''}> ↻ en la plantilla (cada semana)</label>
${b.hecho != null && !paso ? html`<label>Cuánto duró de verdad</label><div class="chips">${DURO.map(([t, v]) => html`<button type="button" class="ac ${b.hecho === v ? 'on' : ''}" aria-pressed="${b.hecho === v ? 'true' : 'false'}" data-real-cambiar="${v}">${t}</button>`)}</div>` : ''}
${!b.sugerido && !paso ? html`<details class="duplicar" style="margin-top:8px"><summary class="mut" style="font-size:11.5px;cursor:pointer">Duplicar en otros días…</summary><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:5px">${f.DIAS.map((l, i) => html`<label class="fila" style="margin:0;gap:2px"><input type="checkbox" data-dup-dia="${i}" ${i === b.dia ? 'disabled' : ''}>${l}</label>`)}<button type="button" data-ed="duplicar">Duplicar</button></div></details>` : ''}
${paso ? paso.cuerpo(b, ed) : html`<div class="pie">${b.sugerido
    ? html`<button type="button" class="dark" data-ed="aceptar">Aceptar</button>`
    : html`<button type="button" data-ed="guardar">Guardar</button>${botonesPie.map((fn) => fn(b))}`}<button type="button" class="peligro-texto" data-ed="eliminar">Eliminar</button></div>
${b.plantilla ? html`<div class="mut pista">Los cambios aquí solo afectan a esta semana. La plantilla se edita en Gestión → Plantilla.</div>` : ''}`}`;
}

const DURO = [['menos', -30], ['lo previsto', 0], ['+30 min', 30], ['+1 h', 60]];

/** Aviso si el bloque cae fuera de las horas que se ven en el calendario (se guardaría, pero no se vería entero). */
function avisoHoras(inicio, fin, d) {
  const { desde, hasta } = d.ajustes.horas;
  if (inicio >= desde * 60 && fin <= hasta * 60) return '';
  const nd = Math.min(desde, Math.floor(inicio / 60)), nh = Math.max(hasta, Math.ceil(fin / 60));
  return html`Fuera de las horas que ves (${desde}–${hasta}): no se verá entero. <button type="button" class="add" data-ed="ampliar" data-horas="${nd}-${nh}">Ver de ${nd} a ${nh}</button>`;
}

/** ¿Las horas del formulario valen? Si no, lo dice en el editor y no se guarda. */
export function horasValidas(el) {
  const h = leerHoras($('#ed-inicio', el).value, $('#ed-fin', el).value);
  const otra = $('#ed-dia', el).value === 'otra';
  const error = h.error ?? (otra && !f.esFecha($('#ed-fecha', el).value) ? 'Elige la fecha' : null);
  const caja = $('#ed-error', el);
  if (caja) caja.textContent = error ?? '';
  if (h.error) $('#ed-fin', el)?.focus();
  return !error;
}

/** Lee el formulario del editor → { cambios, destino } (destino = semana del día elegido). Horas libres. */
export function leerCambios(el, b) {
  const d = derivados();
  // «otra fecha…»: el bloque se va a la semana de esa fecha (aunque no sea la que estás viendo)
  const fecha = $('#ed-dia', el).value === 'otra' ? $('#ed-fecha', el).value : null;
  const [destino, dia] = fecha && f.esFecha(fecha) ? [f.semanaDe(fecha), f.diaSemana(fecha)] : $('#ed-dia', el).value.split('|');
  const h = leerHoras($('#ed-inicio', el).value, $('#ed-fin', el).value);
  const cambios = {
    titulo: $('#ed-titulo', el).value.trim() || 'Sin título',
    tipo: ed.tipo,
    subtipo: m.esEstudio(d.tipos, ed.tipo) ? ed.subtipo : null,
    dia: +dia, inicio: h.error ? b.inicio : h.inicio, fin: h.error ? b.fin : h.fin,
    paso: $('#ed-paso', el).value.trim() || null,
  };
  const plantilla = $('#ed-plantilla', el).checked;
  if (plantilla !== b.plantilla) cambios.plantilla = plantilla;
  return { cambios, destino };
}

const docDe = (semana) => st.datos.ficheros[`semanas/${semana}.md`];
const bloqueActual = () => (ed ? m.bloquesDe(docDe(ed.semana)).find((x) => x.id === ed.id) : null);

/** Guarda lo que haya en el formulario (sin cerrar si `seguir`). */
export function guardarFormulario(el, extra = {}) {
  const b = bloqueActual();
  if (!b) return null;
  const leido = leerCambios(el, b);
  const cambios = { ...leido.cambios, ...extra };
  if (leido.destino !== ed.semana) {
    // otro día de otra semana (la vista que empieza en domingo): el bloque cambia de fichero
    const { local } = enviar('bloque.mover', { semana: ed.semana, id: ed.id, huella: ed.huella, destino: leido.destino, cambios });
    if (local?.id == null) return null;
    ed.semana = leido.destino;
    ed.id = local.id;
  } else {
    const igual = Object.entries(cambios).every(([k, v]) => b[k] === v);
    if (!igual) enviar('bloque.editar', { semana: ed.semana, id: ed.id, huella: ed.huella, cambios });
  }
  if (cambios.plantilla === false) toast('Solo en esta semana: la plantilla se cambia en Gestión → Plantilla');
  // tras editar, la huella cambia: la del bloque ya actualizado en local
  const nuevo = bloqueActual();
  if (nuevo) ed.huella = m.huellaDe(nuevo);
  return nuevo ?? b;
}

/** «＋ nuevo» tipo desde el editor: lo crea y lo deja elegido para este bloque. */
function crearTipoAqui(el, nombre) {
  if (!nombre) return;
  const d = derivados();
  const ya = m.tipoPorNombre(d.tipos, nombre);
  if (!ya) {
    const { local } = enviar('tipo.crear', { nombre, color: m.PAL[d.tipos.length % m.PAL.length] }, { mensaje: () => `Tipo «${nombre}» creado` });
    if (local === null && !m.tipoPorNombre(derivados().tipos, nombre)) return; // no válido: el aviso ya lo dice
  }
  const t = m.tipoPorNombre(derivados().tipos, nombre);
  ed.tipo = t?.nombre ?? nombre;
  let chip = $$('[data-tipo]', el).find((x) => m.normalizar(x.dataset.tipo) === m.normalizar(ed.tipo));
  if (!chip) {
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ac';
    chip.setAttribute('role', 'radio');
    chip.dataset.tipo = ed.tipo;
    chip.textContent = ed.tipo;
    $('[data-ed="tipo-nuevo"]', el).before(chip);
  }
  chip.click();
  $('[data-tipo-nuevo]', el).hidden = true;
  $('#ed-tipo-nuevo', el).value = '';
}

export function cerrarEditor() {
  ed = null;
  cerrarPopover();
}

export function abrirEditor(id, { semana = st.ui.semana, modo = null } = {}) {
  const d = derivados();
  const b = m.bloquesDe(docDe(semana)).find((x) => x.id === id);
  const card = $('#wk');
  const ancla = card?.querySelector(`.blk[data-semana="${semana}"][data-id="${id}"]`);
  if (!b || !ancla) return;
  ed = { semana, id, huella: m.huellaDe(b), tipo: b.tipo, subtipo: b.subtipo, modo };
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
    const t = ev.target.closest('[data-tipo],[data-subtipo],[data-ed],[data-paso],[data-real-cambiar]');
    if (!t) return;
    if (t.dataset.realCambiar != null) {
      // cambiar cuánto duró un bloque ya hecho, sin desmarcarlo
      const actual = bloqueActual();
      if (actual) enviar('bloque.hecho', { semana: ed.semana, id: ed.id, huella: m.huellaDe(actual), delta: +t.dataset.realCambiar }, { mensaje: () => 'Duración real cambiada' });
      cerrarEditor();
      return;
    }
    if (t.dataset.ed === 'tipo-nuevo') {
      $('[data-tipo-nuevo]', el).hidden = false;
      $('#ed-tipo-nuevo', el).focus();
      return;
    }
    if (t.dataset.ed === 'ampliar') {
      const [desde, hasta] = t.dataset.horas.split('-').map(Number);
      enviar('ajustes.cambiar', { clave: 'horas', valor: { desde, hasta } }, { mensaje: () => `Ahora ves de ${desde} a ${hasta}` });
      $('#ed-aviso-horas', el).textContent = '';
      return;
    }
    if (t.dataset.ed === 'duplicar') {
      const dias = $$('[data-dup-dia]', el).filter((c) => c.checked).map((c) => +c.dataset.dupDia);
      if (!dias.length) { $('#ed-error', el).textContent = 'Marca en qué días'; return; }
      if (!horasValidas(el)) return;
      const b2 = guardarFormulario(el); // primero lo que hayas cambiado, para duplicar ya cambiado
      if (!b2) return;
      enviar('bloque.duplicar', { semana: ed.semana, id: ed.id, huella: ed.huella, dias }, {
        mensaje: (r) => (r.n ? `«${b2.titulo}» duplicado en ${r.n} día${r.n === 1 ? '' : 's'}${r.solapes ? ` · ⚠ ${r.solapes} se solapa${r.solapes === 1 ? '' : 'n'}` : ''}` : 'Ya estaba en esos días'),
      });
      cerrarEditor();
      return;
    }
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
    else if (t.dataset.ed === 'guardar') { if (horasValidas(el)) { guardarFormulario(el); cerrarEditor(); } }
    else if (t.dataset.ed === 'aceptar') { if (horasValidas(el)) { guardarFormulario(el, { sugerido: false }); cerrarEditor(); } }
    else if (t.dataset.ed === 'eliminar') {
      const actual = bloqueActual();
      if (!actual) return cerrarEditor();
      enviar('bloque.eliminar', { semana: ed.semana, id: ed.id, huella: m.huellaDe(actual) }, { mensaje: () => `Bloque «${actual.titulo}» eliminado` });
      cerrarEditor();
    } else if (t.dataset.paso) {
      if (horasValidas(el)) cambiarPaso(el, t.dataset.paso);
    } else if (accionesEditor[t.dataset.ed]) {
      accionesEditor[t.dataset.ed](el, bloqueActual());
    }
  };
  el.onchange = (ev) => {
    if (ev.target.id !== 'ed-dia') return;
    const otra = ev.target.value === 'otra';
    $('#ed-fecha', el).hidden = !otra;
    if (otra) $('#ed-fecha', el).focus();
  };
  el.onkeydown = (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'ed-tipo-nuevo') {
      ev.preventDefault();
      crearTipoAqui(el, ev.target.value.trim());
      return;
    }
    if (ev.key === 'Enter' && ev.target.matches('#ed-titulo, #ed-paso, #ed-inicio, #ed-fin')) {
      ev.preventDefault();
      if (!horasValidas(el)) return;
      guardarFormulario(el, b.sugerido ? { sugerido: false } : {});
      cerrarEditor();
    }
  };
  el.addEventListener('focusout', (ev) => {
    if (!ev.target.matches?.('#ed-inicio, #ed-fin')) return;
    const n = normalizarHora(ev.target.value);
    if (n) ev.target.value = n;
  });
  // la duración se ve al cambiar las horas
  el.oninput = (ev) => {
    if (!ev.target.matches('#ed-inicio, #ed-fin')) return;
    const h = leerHoras($('#ed-inicio', el).value, $('#ed-fin', el).value);
    $('#ed-dur-texto', el).textContent = h.error ? '' : textoDuracion(h.fin - h.inicio);
    pintar($('#ed-aviso-horas', el), h.error ? '' : avisoHoras(h.inicio, h.fin, derivados()));
    $('#ed-error', el).textContent = '';
  };
  pasosEditor[ed.modo]?.alAbrir?.(el, b, ed);
}


// Gestión → Plantilla de semana: lo que se crea solo cada semana. Cada entrada se puede editar (días, horas,
// título, tipo) y, con la casilla «aplicar», los cambios llegan también a la semana actual (desde hoy) y a las
// futuras ya creadas. Horas libres: «de 8:30 a 18:00», sin duraciones fijas.
import { html, on, $, temaActual } from '../ui/dom.js';
import { abrirModal, cabecera, cuerpoModal, modalAbierto } from '../ui/modal.js';
import { st, enviar, derivados, alCambiar } from '../estado.js';
import { avisoLineas } from '../ui/avisos.js';
import { entradaMenu, itemMenu } from './comun.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie } from '/core/color.js';
import { minutosDeHora, horaDeMinutos, textoDuracion, leerHoras, campoHora, sugerenciasHora, normalizarHora } from '../ui/horas.js';

let abierta = false;
let error = '';
let aplicar = true; // también en las semanas ya creadas (la actual desde hoy y las futuras)

const formVacio = () => ({ id: null, huella: null, titulo: '', tipo: null, dias: new Set(), inicio: '09:00', fin: '10:00' });
let form = formVacio();

/** Texto del toast tras añadir, cambiar o quitar con «aplicar». */
function enSemanas(r, verbo) {
  if (!r?.semanas) return '';
  return ` · ${verbo} en ${r.n} bloque${r.n === 1 ? '' : 's'} de ${r.semanas} semana${r.semanas === 1 ? '' : 's'}${r.solapes ? ` (⚠ ${r.solapes} se solapa${r.solapes === 1 ? '' : 'n'}: muévelo${r.solapes === 1 ? '' : 's'})` : ''}`;
}

const ATAJOS = [['L–V', [0, 1, 2, 3, 4]], ['fin de semana', [5, 6]], ['todos', [0, 1, 2, 3, 4, 5, 6]], ['ninguno', []]];

function formulario(d) {
  const ini = minutosDeHora(form.inicio), fin = minutosDeHora(form.fin, { esFin: true });
  const dur = ini != null && fin != null && fin > ini ? textoDuracion(fin - ini) : '';
  const tipo = form.tipo ?? d.tipos[0]?.nombre;
  return html`<div class="frm" style="margin-top:10px" data-form-plantilla>
  <div class="lab" style="margin:0">${form.id != null ? `Editar «${form.titulo}»` : 'Añadir a la plantilla'}</div>
  <div style="display:flex;gap:5px;flex-wrap:wrap"><input id="pl-titulo" value="${form.titulo}" placeholder="qué es (trabajo, inglés, gimnasio…)" style="flex:1;font-size:12px" aria-label="Título" autocomplete="off"><select id="pl-tipo" style="font-size:12px" aria-label="Tipo">${d.tipos.map((t) => html`<option ${m.normalizar(t.nombre) === m.normalizar(tipo ?? '') ? 'selected' : ''}>${t.nombre}</option>`)}</select></div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span class="mut" style="font-size:11.5px;width:38px">días</span>${f.DIAS.map((l, i) => html`<label class="fila" style="margin:0;gap:2px"><input type="checkbox" data-dia="${i}" ${form.dias.has(i) ? 'checked' : ''}>${l}</label>`)}
    <span class="mut" style="font-size:11px">·</span>${ATAJOS.map(([t]) => html`<button type="button" class="add" style="font-size:11px" data-atajo-dias="${t}">${t}</button>`)}</div>
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="mut" style="font-size:11.5px;width:38px">de</span>${campoHora('pl-inicio', form.inicio, 'Empieza')}<span class="mut" style="font-size:11.5px">a</span>${campoHora('pl-fin', form.fin, 'Termina')}${sugerenciasHora()}<span class="mut" style="font-size:11px" id="pl-dur-texto">${dur}</span></div>
  <label class="fila" style="margin:4px 0 0"><input type="checkbox" id="pl-aplicar" ${aplicar ? 'checked' : ''}> ${form.id != null ? 'Cambiar' : 'Añadir'} también en esta semana (desde hoy) y en las siguientes ya creadas</label>
  <div class="error-form" role="alert">${error}</div>
  <div class="pie" style="margin-top:2px">${form.id != null
    ? html`<button type="button" class="dark" data-guardar-plantilla>Guardar cambios</button><button type="button" data-cancelar-plantilla>Cancelar</button>`
    : html`<button type="button" class="dark" data-anadir>Añadir a la plantilla</button>`}</div>
</div>`;
}

function contenido() {
  const d = derivados(), tema = temaActual();
  const entradas = m.plantillaDe(st.datos.ficheros['plantilla.md']);
  return html`${cabecera('Plantilla de semana')}<div class="mut mod-nota">Lo que se repite cada semana. Las semanas nuevas salen ya con esto. Lo que añadas, cambies o quites aquí llega también a esta semana (desde hoy) y a las siguientes que ya tengas, si dejas marcada la casilla. Las pasadas no cambian nunca.</div>
${entradas.map((e) => html`<div class="pend ${form.id === e.id ? 'on' : ''}"><span><span class="dot" style="background:${colorSerie(m.colorDeTipo(d.tipos, e.tipo), tema)}"></span>${e.titulo} <span class="mut" style="font-size:10.5px">${e.dias.map((x) => f.DIAS[x]).join(',')} · ${f.horaCorta(e.inicio)}–${f.horaCorta(e.fin)}</span></span><span class="opts"><button type="button" data-editar-plantilla="${e.id}" aria-label="Editar ${e.titulo}">editar</button><button type="button" class="peligro-texto" data-quitar="${e.id}" aria-label="Quitar ${e.titulo}">quitar</button></span></div>`)}
${entradas.length ? '' : html`<div class="mut" style="font-size:12px;padding:8px 0">La plantilla está vacía. Añade abajo lo que haces cada semana.</div>`}
${formulario(d)}${avisoLineas('plantilla.md', st.datos.ficheros['plantilla.md'])}`;
}

function repintar() { if (abierta && modalAbierto()) { abrirModal(contenido(), { etiqueta: 'Plantilla de semana', onCerrar: cerrado }); enlazar(); } }
function cerrado() { abierta = false; form = formVacio(); error = ''; }

/** Lee y valida el formulario → { dias, inicio, fin, tipo, titulo } o null (con el error puesto). */
function leerFormulario() {
  const titulo = form.titulo.trim();
  const dias = [...form.dias].sort((a, b) => a - b);
  const h = leerHoras(form.inicio, form.fin);
  if (!titulo) error = 'Pon qué es (el título)';
  else if (!dias.length) error = 'Elige al menos un día';
  else if (h.error) error = h.error;
  else { error = ''; return { dias, inicio: h.inicio, fin: h.fin, tipo: form.tipo ?? derivados().tipos[0]?.nombre, titulo }; }
  repintar();
  return null;
}

function enlazar() {
  const mod = cuerpoModal();
  on(mod, 'input', '#pl-titulo', (_ev, el) => { form.titulo = el.value; });
  on(mod, 'change', '#pl-tipo', (_ev, el) => { form.tipo = el.value; });
  on(mod, 'change', '[data-dia]', (_ev, el) => { if (el.checked) form.dias.add(+el.dataset.dia); else form.dias.delete(+el.dataset.dia); });
  on(mod, 'click', '[data-atajo-dias]', (_ev, el) => { form.dias = new Set(ATAJOS.find(([t]) => t === el.dataset.atajoDias)[1]); repintar(); });
  on(mod, 'input', '#pl-inicio, #pl-fin', (_ev, el) => {
    form[el.id === 'pl-inicio' ? 'inicio' : 'fin'] = el.value;
    const ini = minutosDeHora(form.inicio), fin = minutosDeHora(form.fin, { esFin: true });
    const t = $('#pl-dur-texto', mod);
    if (t) t.textContent = ini != null && fin != null && fin > ini ? textoDuracion(fin - ini) : '';
  });
  on(mod, 'focusout', '#pl-inicio, #pl-fin', (_ev, el) => {
    const n = normalizarHora(el.value);
    if (n) { el.value = n; form[el.id === 'pl-inicio' ? 'inicio' : 'fin'] = n; }
  });
  on(mod, 'change', '#pl-aplicar', (_ev, el) => { aplicar = el.checked; });
  on(mod, 'click', '[data-quitar]', (_ev, el) => {
    const e = m.plantillaDe(st.datos.ficheros['plantilla.md']).find((x) => x.id === +el.dataset.quitar);
    if (!e) return;
    if (form.id === e.id) form = formVacio();
    enviar('plantilla.eliminar', { id: e.id, huella: m.huellaDe(e), aplicar }, { mensaje: (r) => `«${e.titulo}» quitado de la plantilla${enSemanas(r, 'y quitado')}` });
  });
  on(mod, 'click', '[data-editar-plantilla]', (_ev, el) => {
    const e = m.plantillaDe(st.datos.ficheros['plantilla.md']).find((x) => x.id === +el.dataset.editarPlantilla);
    if (!e) return;
    form = { id: e.id, huella: m.huellaDe(e), titulo: e.titulo, tipo: e.tipo, dias: new Set(e.dias), inicio: horaDeMinutos(e.inicio), fin: horaDeMinutos(e.fin) };
    error = '';
    repintar();
    const titulo = $('#pl-titulo', cuerpoModal());
    titulo?.focus();
    titulo?.closest('[data-form-plantilla]')?.scrollIntoView({ block: 'nearest' });
  });
  on(mod, 'click', '[data-cancelar-plantilla]', () => { form = formVacio(); error = ''; repintar(); });
  on(mod, 'click', '[data-anadir]', () => {
    const c = leerFormulario();
    if (!c) return;
    enviar('plantilla.crear', { ...c, aplicar }, { mensaje: (r) => `«${c.titulo}» añadido a la plantilla${enSemanas(r, 'y añadido')}` });
    form = formVacio();
  });
  on(mod, 'click', '[data-guardar-plantilla]', () => {
    const c = leerFormulario();
    if (!c) return;
    const { id, huella } = form;
    enviar('plantilla.editar', { id, huella, cambios: c, aplicar }, { mensaje: (r) => `«${c.titulo}» cambiado en la plantilla${enSemanas(r, 'y cambiado')}` });
    form = formVacio();
  });
  on(mod, 'keydown', '#pl-titulo', (ev) => { if (ev.key === 'Enter') (form.id != null ? $('[data-guardar-plantilla]', mod) : $('[data-anadir]', mod))?.click(); });
}

export function abrirPlantilla() {
  abierta = true;
  error = '';
  form = formVacio();
  abrirModal(contenido(), { etiqueta: 'Plantilla de semana', onCerrar: cerrado });
  enlazar();
}

alCambiar(repintar);
entradaMenu({ id: 'plantilla', orden: 30, pintar: () => itemMenu('plantilla', 'Plantilla de semana', html`<span class="mut">↻</span>`), accion: abrirPlantilla });

// Vista Hoy: horario del día con «ahora», Las 3 con su «si → entonces», tareas de hoy, más adelante
// por grupos y el cierre del día en 4 pasos (termina siempre en «mañana empiezo por…»).
import { html, raw, $, on, pintar, temaActual } from '../ui/dom.js';
import { st, enviar, derivados, ahora } from '../estado.js';
import { vistas } from '../app.js';
import { agendaDeHoy, tareaVencida } from './cajon-hoy.js';
import { avisoLineas } from '../ui/avisos.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie, tono } from '/core/color.js';
import { etiquetaFecha } from '/core/captura.js';

// Estado del formulario de cierre (solo en memoria hasta pulsar «Cerrar el día ✓»).
let cierre = null;
function estadoCierre(hoy) {
  if (!cierre || cierre.fecha !== hoy) cierre = { fecha: hoy, animo: null, linea: '', manana: null, decision: {}, editando: false };
  return cierre;
}

const punto = (d, tipo, tema) => html`<span class="dot" style="background:${colorSerie(m.colorDeTipo(d.tipos, tipo), tema)}"></span>`;

function horario(d, tema) {
  const a = agendaDeHoy(d);
  const minuto = ahora();
  const filas = a.bloques.map((b) => {
    const esAhora = minuto >= b.inicio && minuto < b.fin;
    const color = esAhora ? '' : `background:${tono(m.colorDeTipo(d.tipos, b.tipo), tema, 0.53)}`;
    return html`<div class="tl ${esAhora ? 'ahora' : ''} ${b.hecho != null ? 'hecho' : ''}"><span class="mut" style="font-size:11px">${f.horaCorta(b.inicio)}</span><span class="tl-punto ${esAhora ? 'ahora' : ''}" style="${raw(color)}"></span><span class="tl-t">${b.titulo} <span class="mut" style="font-size:10.5px">${f.horaCorta(b.inicio)}–${f.horaCorta(b.fin)}${esAhora ? ' · ahora' : ''}</span></span></div>`;
  });
  return html`<div class="card"><div class="lab">${f.capitalizar(f.fechaLarga(d.meta.hoy))}</div>${filas.length ? filas : html`<div class="mut">Hoy no hay bloques.</div>`}</div>`;
}

function las3Hoy(d) {
  return html`<div class="card"><div class="lab">Las 3 de la semana</div>${d.las3Actual.length ? d.las3Actual.map((o) => html`<div class="b3h ${o.hecha ? 'hecha' : ''}"><div class="t" style="font-size:12.5px">${o.hecha ? '✓' : '○'} ${o.texto}</div>${o.si ? html`<div class="mut" style="font-size:11px;margin-left:16px">si ${o.si} → ${o.entonces ?? '…'}</div>` : ''}</div>`) : html`<div class="vacio">Aún no has elegido Las 3 de esta semana: escríbelas en la vista Semana.</div>`}</div>`;
}

// ---------- Editar y borrar tareas ----------

let editando = null; // id de la tarea que se está editando
const DURACIONES = [15, 30, 45, 60, 90, 120, 180, 240];
const SECCIONES = [['hoy', 'Hoy'], ['mas', 'Más adelante'], ['algun', 'Algún día']];

function formularioTarea(d, t) {
  const durs = t.dur && !DURACIONES.includes(t.dur) ? [...DURACIONES, t.dur].sort((a, b) => a - b) : DURACIONES;
  return html`<div class="frm" data-form-tarea="${t.id}" style="margin:6px 0">
<input id="et-texto" value="${t.texto}" maxlength="200" aria-label="Texto de la tarea">
<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
  <select id="et-tipo" aria-label="Tipo" style="font-size:11.5px"><option value="">sin tipo</option>${d.tipos.map((x) => html`<option ${m.normalizar(x.nombre) === m.normalizar(t.tipo ?? '') ? 'selected' : ''}>${x.nombre}</option>`)}</select>
  <select id="et-seccion" aria-label="Sección" style="font-size:11.5px">${SECCIONES.map(([k, n]) => html`<option value="${k}" ${k === t.seccion ? 'selected' : ''}>${n}</option>`)}</select>
  <input id="et-fecha" type="date" value="${t.fecha ?? ''}" aria-label="Fecha (opcional)" style="font-size:11.5px">
  <select id="et-dur" aria-label="Duración" style="font-size:11.5px"><option value="">sin duración</option>${durs.map((x) => html`<option value="${x}" ${x === t.dur ? 'selected' : ''}>${f.formatoDuracion(x)}</option>`)}</select>
  <label class="fila" style="margin:0"><input type="checkbox" id="et-prioridad" ${t.prioridad ? 'checked' : ''}> prioridad</label>
</div>
<div class="pie" style="margin-top:4px"><button type="button" class="dark" data-et="guardar">Guardar</button><button type="button" data-et="cancelar">Cancelar</button><button type="button" class="peligro-texto" data-et="eliminar">Eliminar</button></div></div>`;
}

const botonEditar = (t) => html`<button type="button" class="mv" data-editar-tarea aria-label="Editar: ${t.texto}" title="Editar o borrar">✎</button>`;

function guardarTarea(form) {
  const t = m.entidades(st.datos.ficheros['tareas.md'], 'tarea').find((x) => x.id === +form.dataset.formTarea);
  editando = null;
  if (!t) { pintarHoy(); return; }
  const texto = $('#et-texto', form).value.trim();
  if (!texto) { $('#et-texto', form).focus(); editando = t.id; return; }
  const cambios = {
    texto, tipo: $('#et-tipo', form).value || null, fecha: $('#et-fecha', form).value || null,
    dur: $('#et-dur', form).value ? +$('#et-dur', form).value : null, prioridad: $('#et-prioridad', form).checked,
  };
  const seccion = $('#et-seccion', form).value;
  if (seccion !== t.seccion) enviar('tarea.mover', { id: t.id, huella: m.huellaDe(t), seccion, cambios });
  else if (Object.entries(cambios).some(([k, v]) => (t[k] ?? null) !== v)) enviar('tarea.editar', { id: t.id, huella: m.huellaDe(t), cambios });
  else pintarHoy();
}

function filaTarea(d, t, tema) {
  if (editando === t.id) return formularioTarea(d, t);
  const estrella = m.tareaAvanzaLas3(t, d.las3Actual);
  return html`<div class="task ${t.hecha ? 'done' : ''}" data-tarea="${t.id}"><button type="button" class="cb ${t.hecha ? 'on' : ''}" data-marcar aria-label="${t.hecha ? 'Desmarcar' : 'Marcar como hecha'}: ${t.texto}">${t.hecha ? '✓' : ''}</button><span class="tx">${punto(d, t.tipo, tema)}${t.prioridad ? html`<b class="peligro-texto">! </b>` : ''}${estrella ? html`<span title="avanza las 3" class="aviso-texto">★ </span>` : ''}${t.texto}${t.dur ? html` <span class="mut" style="font-size:10.5px">${f.formatoDuracion(t.dur)}</span>` : ''}</span>${tareaVencida(t, d.meta.hoy) ? html`<span style="font-size:10.5px" class="peligro-texto">vencida</span>` : html`<span></span>`}<span style="display:flex;gap:4px">${botonEditar(t)}<button type="button" class="mv" data-bajar aria-label="Bajar a más adelante: ${t.texto}">↓ luego</button></span></div>`;
}

function tareasHoy(d, tema) {
  const abiertas = d.tareas.hoy.filter((t) => !t.hecha).length;
  const lleno = abiertas >= d.ajustes.tareas_hoy;
  return html`<div class="card"><div class="fila-lab"><span class="lab">Tareas de hoy</span><span class="mut" style="font-size:12px">${abiertas}/${d.ajustes.tareas_hoy}</span></div>${d.tareas.hoy.map((t) => filaTarea(d, t, tema))}${d.tareas.hoy.length ? '' : html`<div class="vacio" style="padding:8px 0">Nada para hoy. Apunta algo arriba o sube algo de «Más adelante».</div>`}${lleno ? html`<div class="lleno">Hoy está lleno (${d.ajustes.tareas_hoy}). Lo nuevo irá a Más adelante.</div>` : ''}</div>`;
}

function masAdelante(d, tema) {
  const hoy = d.meta.hoy;
  const lleno = d.tareas.hoy.filter((t) => !t.hecha).length >= d.ajustes.tareas_hoy;
  const abiertas = d.tareas.mas.filter((t) => !t.hecha);
  const grupos = [
    ['Vencidas', abiertas.filter((t) => t.fecha && t.fecha < hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))],
    ['Con fecha', abiertas.filter((t) => t.fecha && t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))],
    ['Sin fecha', abiertas.filter((t) => !t.fecha)],
    ['Algún día', d.tareas.algun.filter((t) => !t.hecha)],
  ];
  const total = grupos.reduce((s, [, l]) => s + l.length, 0);
  const recordatorio = d.las3Actual.length ? html`<div class="recuadro" style="font-size:11.5px;margin-bottom:12px;line-height:1.5"><span class="mut">Antes de subir algo a Hoy, recuerda tus 3:</span><br>${raw(d.las3Actual.map((o) => String(html`<b style="font-weight:500">★ ${o.texto}</b>`)).join(' · '))}</div>` : '';
  return html`<div class="card">${recordatorio}<div class="fila-lab"><span class="lab">Más adelante</span><span class="mut" style="font-size:12px">${total}</span></div>${grupos.map(([nombre, lista]) => (lista.length ? html`<div class="grp ${nombre === 'Vencidas' ? 'vencidas' : ''}">${nombre} · ${lista.length}</div>${lista.map((t) => (editando === t.id ? formularioTarea(d, t) : html`<div class="lt" data-tarea="${t.id}" style="${nombre === 'Algún día' ? 'opacity:.7' : ''}"><span>${punto(d, t.tipo, tema)}${t.prioridad ? html`<b class="peligro-texto">! </b>` : ''}${m.tareaAvanzaLas3(t, d.las3Actual) ? html`<span title="avanza las 3" class="aviso-texto">★ </span>` : ''}${t.texto}${t.dur ? html` <span class="mut" style="font-size:10.5px">${f.formatoDuracion(t.dur)}</span>` : ''}</span><span class="mut" style="font-size:10.5px">${t.fecha && nombre !== 'Vencidas' ? etiquetaFecha(t.fecha, hoy) : ''}</span><span style="display:flex;gap:4px">${botonEditar(t)}<button type="button" class="mv" data-subir ${lleno ? raw('disabled title="Hoy está lleno"') : ''} aria-label="Subir a hoy: ${t.texto}">↑ hoy</button></span></div>`))}` : ''))}${total ? '' : html`<div class="mut">Vacío</div>`}${avisoLineas('tareas.md', st.datos.ficheros['tareas.md'])}</div>`;
}

// ---------- Cierre del día ----------

const diarioDeHoy = (d) => {
  const doc = st.datos.ficheros[`diario/${d.meta.hoy}.md`];
  if (!doc) return null;
  const v = m.diarioDe(doc);
  return v.animo != null || v.linea || v.manana ? v : null;
};

function avancesDeHoy(d) {
  const a = agendaDeHoy(d);
  return [...a.bloques.filter((b) => b.hecho != null).map((b) => b.titulo), ...d.tareas.hoy.filter((t) => t.hecha && (!t.fechaHecha || t.fechaHecha === d.meta.hoy)).map((t) => t.texto)];
}

/** «Mañana empiezo por…»: primer paso del primer bloque no laboral de mañana, o su título, o la primera tarea abierta. */
export function sugerenciaManana(d, c) {
  const manana = f.sumarDias(d.meta.hoy, 1);
  const doc = st.datos.ficheros[`semanas/${f.semanaDe(manana)}.md`];
  const dia = f.diaSemana(manana);
  const b = m.bloquesDe(doc).filter((x) => x.dia === dia && !x.sugerido && !m.esTrabajo(d.tipos, x.tipo)).sort((x, y) => x.inicio - y.inicio)[0];
  if (b) return b.paso ? `${m.temaDe(b.titulo)}: ${b.paso}` : b.titulo;
  return d.tareas.hoy.find((t) => !t.hecha && c.decision[t.texto] !== 'mas')?.texto ?? '';
}

function cierreDelDia(d) {
  const c = estadoCierre(d.meta.hoy);
  const hecho = diarioDeHoy(d);
  const cab = html`<div class="fila-lab"><span class="lab">Cierre del día</span><span class="mut" style="font-size:12px">a las ${f.horaCorta(d.ajustes.cierre)}</span></div>`;
  if (hecho && !c.editando) {
    return html`<div class="card">${cab}<div style="font-size:12.5px">Día cerrado ✓ · ánimo ${hecho.animo ?? '—'}</div><div class="mut" style="font-size:11.5px;margin-top:4px">Guardado en diario/${d.meta.hoy}.md. <button type="button" class="add" data-cierre="editar">editar</button></div>
<div class="recuadro" style="margin-top:10px;padding:10px 12px"><div class="mut" style="font-size:11px">Mañana empiezo por</div><div style="font-size:13px;font-weight:500;margin-top:2px">${hecho.manana || '—'}</div></div>
<div class="mut" style="font-size:11px;margin-top:10px">☾ A partir de ahora, nada de trabajo. Lo apuntado ya no tiene que dar vueltas en la cabeza.</div></div>`;
  }
  const avances = avancesDeHoy(d);
  const abiertas = d.tareas.hoy.filter((t) => !t.hecha);
  const manana = c.manana ?? sugerenciaManana(d, c);
  return html`<div class="card">${cab}
<div class="mut paso" style="margin-top:0">1 · Hoy avanzaste en</div><div style="display:flex;gap:5px;flex-wrap:wrap">${avances.length ? avances.map((a) => html`<span class="pill ganado">✓ ${a}</span>`) : html`<span class="mut" style="font-size:11.5px">Nada marcado todavía · también cuenta lo pequeño</span>`}</div>
<div class="mut paso">2 · Lo que no hiciste</div>${abiertas.length ? abiertas.map((t) => html`<div class="lt" style="grid-template-columns:1fr auto"><span>${t.texto}</span><span class="chips">${[['manana', 'mañana'], ['mas', 'más adelante']].map(([k, txt]) => html`<button type="button" class="ac ${c.decision[t.texto] === k ? 'on' : ''}" aria-pressed="${(c.decision[t.texto] === k) ? 'true' : 'false'}" data-decidir="${k}" data-texto="${t.texto}">${txt}</button>`)}</span></div>`) : html`<div style="font-size:11.5px">Nada pendiente ✓</div>`}
<div class="mut paso">3 · ¿Cómo ha ido?</div><div class="mood" role="radiogroup" aria-label="Ánimo de 1 a 5">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" role="radio" aria-checked="${(c.animo === n) ? 'true' : 'false'}" class="${c.animo === n ? 'on' : ''}" data-animo="${n}">${n}</button>`)}</div><input id="cierre-linea" data-cierre-campo="linea" value="${c.linea}" maxlength="200" placeholder="una línea para tu diario" style="width:100%" aria-label="Una línea para tu diario">
<div class="paso ultimo">4 · Mañana empiezo por…</div><input id="cierre-manana" data-cierre-campo="manana" value="${manana}" maxlength="200" placeholder="concreto: qué abres y qué haces primero" style="width:100%" aria-label="Mañana empiezo por"><div class="mut" style="font-size:10.5px;margin-top:4px">Sale del primer paso de tu primer bloque de mañana. Cámbialo si quieres.</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="mut" style="font-size:11px">☾ después, desconecta</span><button type="button" class="dark" data-cierre="cerrar" ${st.caido ? 'disabled' : ''}>Cerrar el día ✓</button></div></div>`;
}

function cerrarDia() {
  const d = derivados();
  const c = estadoCierre(d.meta.hoy);
  const manana = (c.manana ?? sugerenciaManana(d, c)).trim();
  const aplazar = d.tareas.hoy.filter((t) => !t.hecha && c.decision[t.texto] === 'mas').map((t) => ({ id: t.id, huella: m.huellaDe(t) }));
  enviar('dia.cerrar', { animo: c.animo, linea: c.linea, manana, avanzado: avancesDeHoy(d), aplazar }, { mensaje: () => 'Día cerrado ✓ · ☾ a partir de ahora, nada de trabajo' });
  cierre = { ...c, editando: false, decision: {} };
}

// ---------- Vista ----------

export function pintarHoy() {
  const raiz = $('#v-hoy');
  if (!raiz.firstElementChild) {
    raiz.innerHTML = '<div class="hoy-grid"><div class="hoy-col"><div id="hoy-horario"></div><div id="hoy-las3"></div></div><div class="hoy-col"><div id="hoy-tareas"></div><div id="hoy-mas"></div><div id="hoy-cierre"></div></div></div>';
  }
  const d = derivados(), tema = temaActual();
  pintar($('#hoy-horario'), horario(d, tema));
  pintar($('#hoy-las3'), las3Hoy(d));
  pintar($('#hoy-tareas'), tareasHoy(d, tema));
  pintar($('#hoy-mas'), masAdelante(d, tema));
  pintar($('#hoy-cierre'), cierreDelDia(d));
}

function tareaDe(el) {
  const id = +el.closest('[data-tarea]').dataset.tarea;
  return m.entidades(st.datos.ficheros['tareas.md'], 'tarea').find((t) => t.id === id);
}

function iniciarHoy() {
  const raiz = $('#v-hoy');
  on(raiz, 'click', '[data-tarea]', (ev, el) => {
    const t = tareaDe(el);
    if (!t) return;
    if (ev.target.closest('[data-editar-tarea]')) { editando = t.id; pintarHoy(); $('#et-texto')?.focus(); return; }
    if (ev.target.closest('[data-bajar]')) { enviar('tarea.mover', { id: t.id, huella: m.huellaDe(t), seccion: 'mas' }); return; }
    if (ev.target.closest('[data-subir]')) { enviar('tarea.mover', { id: t.id, huella: m.huellaDe(t), seccion: 'hoy' }); return; }
    if (el.classList.contains('task')) enviar('tarea.marcar', { id: t.id, huella: m.huellaDe(t), hecha: !t.hecha });
  });
  on(raiz, 'click', '[data-et]', (_ev, el) => {
    const form = el.closest('[data-form-tarea]');
    if (el.dataset.et === 'guardar') return guardarTarea(form);
    const t = m.entidades(st.datos.ficheros['tareas.md'], 'tarea').find((x) => x.id === +form.dataset.formTarea);
    editando = null;
    if (el.dataset.et === 'eliminar' && t) enviar('tarea.eliminar', { id: t.id, huella: m.huellaDe(t) }, { mensaje: () => `Tarea «${t.texto}» eliminada` });
    else pintarHoy();
  });
  on(raiz, 'keydown', '[data-form-tarea]', (ev, form) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); editando = null; pintarHoy(); }
    if (ev.key === 'Enter' && ev.target.id === 'et-texto') { ev.preventDefault(); guardarTarea(form); }
  });
  on(raiz, 'click', '[data-decidir]', (_ev, el) => {
    const c = estadoCierre(derivados().meta.hoy);
    c.decision[el.dataset.texto] = c.decision[el.dataset.texto] === el.dataset.decidir ? undefined : el.dataset.decidir;
    pintarHoy();
  });
  on(raiz, 'click', '[data-animo]', (_ev, el) => {
    const c = estadoCierre(derivados().meta.hoy);
    c.animo = c.animo === +el.dataset.animo ? null : +el.dataset.animo;
    pintarHoy();
  });
  on(raiz, 'input', '[data-cierre-campo]', (_ev, el) => { estadoCierre(derivados().meta.hoy)[el.dataset.cierreCampo] = el.value; });
  on(raiz, 'click', '[data-cierre]', (_ev, el) => {
    if (el.dataset.cierre === 'cerrar') cerrarDia();
    if (el.dataset.cierre === 'editar') {
      const d = derivados(), v = diarioDeHoy(d) ?? {};
      cierre = { fecha: d.meta.hoy, animo: v.animo ?? null, linea: v.linea ?? '', manana: v.manana ?? null, decision: {}, editando: true };
      pintarHoy();
    }
  });
}

vistas.hoy = { titulo: 'Hoy', pintar: pintarHoy, iniciar: iniciarHoy };

// Pestaña «Metas» del cajón: constancia (sin rachas), estudio de la semana con «llevas / te faltan»,
// simulacros y proyectos con su siguiente paso editable en línea.
import { html, raw, on, $, temaActual } from '../ui/dom.js';
import { st, enviar, derivados } from '../estado.js';
import { pestanasCajon, pintarCajon } from '../ui/cajon.js';
import { avisoLineas } from '../ui/avisos.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie, tono } from '/core/color.js';
import { estudioDeSemana, semanasSinSimulacro, encuadre, actualizadoHace } from '/core/progreso.js';

let formulario = null; // 'estudio' | 'proyecto' | null
let editandoProyecto = null; // id del proyecto cuyo «siguiente» se edita
let errorForm = '';

const docSemanaMetas = (d) => (st.ui.vista === 'semana' ? d.semanaDoc : d.actualDoc);

function filaEstudio(d, t, tema) {
  const tipoEst = m.tipoEstudio(d.tipos);
  const color = m.colorDeTipo(d.tipos, tipoEst);
  const e = estudioDeSemana(t, docSemanaMetas(d), d.tipos);
  const obj = e.objetivo || 1;
  const texto = encuadre(e.hecho, e.objetivo) === 'llevas'
    ? html`llevas <b style="font-weight:600">${f.horas(e.hecho)} h</b>`
    : html`te faltan <b style="font-weight:600">${f.horas(Math.max(0, e.objetivo - e.hecho))} h</b>`;
  const sinSim = semanasSinSimulacro(t, d.meta.hoy);
  const ultimos = t.simulacros.slice(-3);
  return html`<div class="row" style="display:block"><div style="display:flex;justify-content:space-between;align-items:baseline"><span><span class="dot" style="background:${colorSerie(color, tema)}"></span>${t.nombre}</span><span style="font-size:12px">${texto} <button type="button" class="x" data-quitar-estudio="${t.id}" aria-label="Quitar ${t.nombre}">×</button></span></div>
<div class="bar" role="img" aria-label="${f.horas(e.planificado)} h planificadas y ${f.horas(e.hecho)} h hechas de ${f.horas(e.objetivo)} h"><div style="width:${Math.min(100, (e.planificado / obj) * 100)}%;background:${tono(color, tema, 0.22)}"></div><div style="width:${Math.min(100, (e.hecho / obj) * 100)}%;background:${colorSerie(color, tema)}"></div></div>
<div class="mut" style="font-size:10.5px">de ${f.horas(e.objetivo)} h${t.examen ? ` · examen ${f.fechaCorta(t.examen)}` : ''}${e.planificado >= e.objetivo ? ' · planificado ✓' : ` · faltan ${f.horas(e.objetivo - e.planificado)} h por planificar`}</div>
<div style="font-size:10.5px;margin-top:2px">${ultimos.length ? html`<span class="mut">simulacros </span>${raw(ultimos.map((s, j) => String(html`<span class="${j === ultimos.length - 1 ? '' : 'mut'}" style="${j === ultimos.length - 1 ? 'font-weight:600' : ''}">${s.nota}</span>`)).join('<span class="mut"> → </span>'))}<span class="mut"> %</span>` : ''}${sinSim != null && sinSim >= 2 ? html`<span class="aviso-texto">${ultimos.length ? ' · ' : ''}◎ sin simulacro hace ${sinSim} semanas</span>` : ''}</div></div>`;
}

function filaProyecto(d, p, tema) {
  const color = m.colorDeTipo(d.tipos, m.tipoProyectos(d.tipos));
  const a = actualizadoHace(p.actualizado, d.meta.hoy);
  const pausado = p.estado === 'pausado';
  const siguiente = editandoProyecto === p.id
    ? html`<input id="metas-siguiente" data-siguiente="${p.id}" value="${p.siguiente ?? ''}" style="font-size:11px;width:170px" aria-label="Siguiente paso de ${p.nombre}">`
    : html`<button type="button" class="add mut" style="font-size:11px;margin-left:13px;color:var(--mut);text-align:left" data-editar-siguiente="${p.id}" title="Cambiar el siguiente paso">→ ${p.siguiente ?? 'sin siguiente paso'}</button>`;
  return html`<div class="row" style="${pausado ? 'opacity:.6' : ''}"><span><span class="dot" style="background:${colorSerie(color, tema)}"></span>${p.nombre}<div>${siguiente}</div></span><span style="font-size:10.5px" class="${a.parado && !pausado ? 'aviso-texto' : 'mut'}">${pausado ? 'pausado' : a.texto}${a.parado && !pausado ? ' · parado' : ''} <button type="button" class="x" data-quitar-proyecto="${p.id}" aria-label="Quitar ${p.nombre}">×</button></span></div>`;
}

function formularioHtml() {
  if (formulario === 'estudio') {
    return html`<div class="frm"><input id="fe-nombre" placeholder="nombre (AI-102, curso…)" aria-label="Nombre"><div style="display:flex;gap:5px"><input id="fe-horas" type="number" min="0.5" max="40" step="0.5" placeholder="h/semana" style="width:80px" aria-label="Horas a la semana"><input id="fe-examen" type="date" style="flex:1" aria-label="Fecha del examen (opcional)" title="Fecha del examen (opcional)"></div><div class="error-form" role="alert">${errorForm}</div><button type="button" data-guardar-form="estudio">Añadir</button></div>`;
  }
  if (formulario === 'proyecto') {
    return html`<div class="frm"><input id="fp-nombre" placeholder="nombre del proyecto" aria-label="Nombre del proyecto"><input id="fp-siguiente" placeholder="siguiente paso" aria-label="Siguiente paso"><div class="error-form" role="alert">${errorForm}</div><button type="button" data-guardar-form="proyecto">Añadir</button></div>`;
  }
  return '';
}

pestanasCajon.metas = {
  titulo: 'Metas',
  pintar() {
    const d = derivados(), tema = temaActual();
    const c = d.meta.constancia ?? { dias: 0, semanas: 0, de: 7 };
    return html`<div class="mut" style="font-size:11.5px;margin-bottom:10px">Constancia: esta semana llevas <b style="color:var(--texto);font-weight:500">${c.dias} ${c.dias === 1 ? 'día' : 'días'}</b> con estudio · <b style="color:var(--texto);font-weight:500">${c.semanas} de ${c.de}</b> semanas anteriores. Un día flojo no rompe nada.</div>
<div class="fila-lab"><span class="lab">Estudio · ${st.ui.vista === 'semana' && st.ui.semana !== d.meta.semanaActual ? `semana ${f.numeroSemana(st.ui.semana)}` : 'esta semana'}</span><button type="button" class="add" data-abrir-form="estudio">+ añadir</button></div>
${formulario === 'estudio' ? formularioHtml() : ''}${d.temas.length ? d.temas.map((t) => filaEstudio(d, t, tema)) : html`<div class="mut" style="font-size:11px">Nada todavía.</div>`}
<div class="fila-lab" style="margin-top:18px"><span class="lab">Proyectos · siguiente paso</span><button type="button" class="add" data-abrir-form="proyecto">+ añadir</button></div>
${formulario === 'proyecto' ? formularioHtml() : ''}${d.proyectos.length ? d.proyectos.map((p) => filaProyecto(d, p, tema)) : html`<div class="mut" style="font-size:11px">Nada todavía.</div>`}
${avisoLineas('estudio.md', st.datos.ficheros['estudio.md'])}${avisoLineas('proyectos.md', st.datos.ficheros['proyectos.md'])}`;
  },
  iniciar(raiz) {
    on(raiz, 'click', '[data-abrir-form]', (_ev, el) => {
      formulario = formulario === el.dataset.abrirForm ? null : el.dataset.abrirForm;
      errorForm = '';
      pintarCajon();
      $(formulario === 'estudio' ? '#fe-nombre' : '#fp-nombre')?.focus();
    });
    on(raiz, 'click', '[data-guardar-form]', () => guardarFormulario());
    on(raiz, 'keydown', '.frm input', (ev) => { if (ev.key === 'Enter') guardarFormulario(); });
    on(raiz, 'click', '[data-quitar-estudio]', (_ev, el) => {
      const t = derivados().temas.find((x) => x.id === +el.dataset.quitarEstudio);
      if (t) enviar('estudio.eliminar', { id: t.id }, { mensaje: () => `«${t.nombre}» quitado` });
    });
    on(raiz, 'click', '[data-quitar-proyecto]', (_ev, el) => {
      const p = derivados().proyectos.find((x) => x.id === +el.dataset.quitarProyecto);
      if (p) enviar('proyecto.eliminar', { id: p.id }, { mensaje: () => `«${p.nombre}» quitado` });
    });
    on(raiz, 'click', '[data-editar-siguiente]', (_ev, el) => {
      editandoProyecto = +el.dataset.editarSiguiente;
      pintarCajon();
      $('#metas-siguiente')?.focus();
    });
    on(raiz, 'keydown', '[data-siguiente]', (ev, el) => {
      if (ev.key === 'Escape') { editandoProyecto = null; pintarCajon(); ev.stopPropagation(); return; }
      if (ev.key !== 'Enter') return;
      const p = derivados().proyectos.find((x) => x.id === +el.dataset.siguiente);
      editandoProyecto = null;
      const valor = el.value.trim();
      if (p && valor && valor !== p.siguiente) enviar('proyecto.cambiar', { id: p.id, clave: 'siguiente', valor }, { mensaje: () => `«${p.nombre}» → ${valor}` });
      else pintarCajon();
    });
  },
};

function guardarFormulario() {
  if (formulario === 'estudio') {
    const nombre = $('#fe-nombre').value.trim();
    const horas = parseFloat(String($('#fe-horas').value).replace(',', '.'));
    if (!nombre || !(horas > 0)) { errorForm = 'Pon un nombre y las horas a la semana'; pintarCajon(); return; }
    enviar('estudio.crear', { nombre, horas_semana: horas, examen: $('#fe-examen').value || null });
  } else if (formulario === 'proyecto') {
    const nombre = $('#fp-nombre').value.trim(), siguiente = $('#fp-siguiente').value.trim();
    if (!nombre || !siguiente) { errorForm = 'Pon el nombre y el siguiente paso'; pintarCajon(); return; }
    enviar('proyecto.crear', { nombre, siguiente });
  }
  formulario = null;
  errorForm = '';
}

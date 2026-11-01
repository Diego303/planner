// Gestión → Ajustes: todos los de ajustes.md, aplicados al momento.
import { html, on, $, raw } from '../ui/dom.js';
import { abrirModal, cabecera, cuerpoModal, modalAbierto } from '../ui/modal.js';
import { st, enviar, derivados, alCambiar } from '../estado.js';
import { avisoLineas } from '../ui/avisos.js';
import { entradaMenu, itemMenu, opcionesHora } from './comun.js';

/** Lo que hacen las secciones extra al pintarse (p. ej. colorear las miniaturas de tema): [(mod) → void] */
export const alPintarAjustes = [];
import * as f from '/core/fechas.js';

let abierta = false;

/** Bloques extra del modal (tema, factor…) que añaden otras fases: [() → html] */
export const seccionesAjustes = [];

const opciones = (lista, elegida) => lista.map(([v, t]) => html`<option value="${v}" ${String(v) === String(elegida) ? 'selected' : ''}>${t}</option>`);

function contenido() {
  const a = derivados().ajustes;
  const factor = derivados().meta.factores?.estudio;
  return html`${cabecera('Ajustes')}
<label for="aj-capacidad">Capacidad: ocupar como máximo el <b id="aj-capacidad-v" style="color:var(--texto)">${a.capacidad} %</b> de tu día (el resto es margen)</label><input type="range" id="aj-capacidad" data-ajuste="capacidad" min="50" max="100" step="5" value="${a.capacidad}" style="width:100%">
<label for="aj-tareas">Tareas máximas en Hoy</label><input type="number" id="aj-tareas" data-ajuste="tareas_hoy" min="1" max="20" value="${a.tareas_hoy}" style="width:70px;font-size:12px">
<label>Horas visibles en el calendario</label><div style="display:flex;gap:6px;align-items:center"><select id="aj-desde" data-ajuste="horas" style="font-size:12px" aria-label="Desde">${opciones([5, 6, 7, 8, 9, 10].map((h) => [h, h]), a.horas.desde)}</select> a <select id="aj-hasta" data-ajuste="horas" style="font-size:12px" aria-label="Hasta">${opciones([20, 21, 22, 23, 24].map((h) => [h, h]), a.horas.hasta)}</select> h</div>
<label for="aj-cierre">Hora del cierre del día</label><select id="aj-cierre" data-ajuste="cierre" style="font-size:12px">${opcionesHora(19 * 60, 24 * 60, a.cierre)}</select>
<label for="aj-foco">Máximo de estudio intenso en un día</label><select id="aj-foco" data-ajuste="foco_max" style="font-size:12px">${opciones([1, 1.5, 2, 2.5, 3, 3.5, 4, 5].map((h) => [h, `${f.numero(h)} h`]), a.foco_max)}</select>
<label for="aj-mejores">Mis mejores horas para estudiar <span style="color:var(--texto-3)">(opcional · «Proponer» las usa primero)</span></label><select id="aj-mejores" data-ajuste="mejores_horas" style="font-size:12px">${opciones(['sin preferencia', 'mañanas', 'tardes', 'noches'].map((x) => [x, x]), a.mejores_horas)}</select>
<label for="aj-margen">Margen al proponer</label><select id="aj-margen" data-ajuste="margen" style="font-size:12px">${opciones([['auto', `según lo que tardas de verdad (estudio ×${factor ? f.numero(factor.factor) : '1'})`], ['fijo', 'solo la capacidad']], a.margen)}</select>
<label for="aj-copias">Copia de seguridad de tus ficheros</label><select id="aj-copias" data-ajuste="copias" style="font-size:12px">${opciones([['diaria', 'diaria'], ['al cerrar semana', 'al cerrar semana'], ['git', 'con git local']], a.copias)}</select>
<label for="aj-puerto">Puerto <span style="color:var(--texto-3)">(se usa la próxima vez que arranques el planner)</span></label><input type="number" id="aj-puerto" data-ajuste="puerto" min="1024" max="65535" value="${a.puerto}" style="width:90px;font-size:12px">
${seccionesAjustes.map((fn) => raw(String(fn())))}
<div class="mut" style="font-size:10.5px;margin-top:10px">Todo se guarda en ${st.datos.meta.datos.ruta}/ajustes.md. Los cambios se aplican al momento.</div>${avisoLineas('ajustes.md', st.datos.ficheros['ajustes.md'])}`;
}

function valorDe(el, mod) {
  switch (el.dataset.ajuste) {
    case 'horas': return { desde: +$('#aj-desde', mod).value, hasta: +$('#aj-hasta', mod).value };
    case 'capacidad': case 'tareas_hoy': case 'cierre': case 'foco_max': case 'puerto': return Number(el.value);
    default: return el.value;
  }
}

function repintar() {
  if (!abierta || !modalAbierto()) return;
  if (cuerpoModal().contains(document.activeElement) && document.activeElement.matches('input[type=number]')) return; // no pisar lo que se escribe
  abrirModal(contenido(), { etiqueta: 'Ajustes', onCerrar: () => { abierta = false; } });
  enlazar();
}

function enlazar() {
  const mod = cuerpoModal();
  for (const fn of alPintarAjustes) fn(mod);
  on(mod, 'input', '#aj-capacidad', (_ev, el) => { $('#aj-capacidad-v', mod).textContent = `${el.value} %`; });
  on(mod, 'change', '[data-ajuste]', (_ev, el) => {
    const clave = el.dataset.ajuste, valor = valorDe(el, mod);
    if (clave === 'horas' && valor.desde >= valor.hasta) { repintar(); return; }
    enviar('ajustes.cambiar', { clave, valor });
  });
}

export function abrirAjustes() {
  abierta = true;
  abrirModal(contenido(), { etiqueta: 'Ajustes', onCerrar: () => { abierta = false; } });
  enlazar();
}

alCambiar(repintar);
entradaMenu({ id: 'ajustes', orden: 60, pintar: () => itemMenu('ajustes', 'Ajustes'), accion: abrirAjustes });

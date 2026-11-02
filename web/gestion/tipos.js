// Gestión → Tipos de bloque: color (paleta), alta y quitar (bloqueado si el tipo está en uso).
import { html, on, $, temaActual } from '../ui/dom.js';
import { abrirModal, cabecera, cuerpoModal, modalAbierto } from '../ui/modal.js';
import { st, enviar, derivados, alCambiar } from '../estado.js';
import { avisoLineas } from '../ui/avisos.js';
import { entradaMenu, itemMenu } from './comun.js';
import * as m from '/core/modelo.js';
import { colorSerie } from '/core/color.js';

let abierta = false;
let error = '';

/** Usos de un tipo en todas las semanas (lo calcula el servidor), la plantilla y las tareas. */
function usos(nombre) {
  const d = derivados(), n = m.normalizar(nombre);
  return (d.meta.usoTipos[n] ?? 0)
    + m.plantillaDe(st.datos.ficheros['plantilla.md']).filter((e) => m.normalizar(e.tipo) === n).length
    + m.entidades(st.datos.ficheros['tareas.md'], 'tarea').filter((t) => m.normalizar(t.tipo ?? '') === n).length;
}

function contenido() {
  const d = derivados();
  return html`${cabecera('Tipos de bloque')}<div class="mut mod-nota">Los tipos dan color y agrupan horas en el resumen semanal.</div>
${d.tipos.map((t) => {
    const enUso = usos(t.nombre);
    return html`<div class="pend"><span style="display:flex;gap:8px;align-items:center"><span style="display:flex;gap:3px" role="radiogroup" aria-label="Color de ${t.nombre}">${m.PAL.map((c) => html`<button type="button" class="paleta ${c === t.color ? 'on' : ''}" role="radio" aria-checked="${(c === t.color) ? 'true' : 'false'}" aria-label="${c}" data-color="${c}" data-tipo="${t.nombre}" style="background:${c}"></button>`)}</span><b style="font-weight:500">${t.nombre}</b>${['trabajo', 'estudio'].map((k) => html`<button type="button" class="ac ${t[k] ? 'on' : ''}" aria-pressed="${(t[k]) ? 'true' : 'false'}" data-bandera="${k}" data-tipo-bandera="${t.nombre}" title="${k === 'trabajo' ? 'Cuenta para la hora de desconexión (☾)' : 'Subtipos, foco máximo y simulacros'}">${k}</button>`)}</span><span class="opts"><button type="button" class="peligro-texto" data-quitar="${t.nombre}" ${enUso ? html`disabled title="En uso (${enUso}): cámbiales el tipo primero"` : ''}>quitar</button></span></div>`;
  })}
<div class="frm" style="margin-top:10px;grid-template-columns:1fr auto"><input id="nt-nombre" placeholder="nuevo tipo (salud, familia, lectura…)" style="font-size:11.5px" aria-label="Nuevo tipo"><button type="button" data-anadir>Añadir</button><div class="error-form" role="alert">${error}</div></div>
<div class="mut" style="font-size:10.5px;margin-top:8px">«trabajo»: cuenta para la hora de desconexión (☾). «estudio»: subtipos (aprender, repasar, simulacro), foco máximo y lo que propone «Proponer».</div>${avisoLineas('tipos.md', st.datos.ficheros['tipos.md'])}`;
}

function repintar() { if (abierta && modalAbierto()) { abrirModal(contenido(), { etiqueta: 'Tipos de bloque', onCerrar: () => { abierta = false; } }); enlazar(); } }

function enlazar() {
  const mod = cuerpoModal();
  on(mod, 'click', '[data-color]', (_ev, el) => enviar('tipo.color', { nombre: el.dataset.tipo, color: el.dataset.color }));
  on(mod, 'click', '[data-bandera]', (_ev, el) => {
    const t = m.tipoPorNombre(derivados().tipos, el.dataset.tipoBandera);
    if (t) enviar('tipo.banderas', { nombre: t.nombre, [el.dataset.bandera]: !t[el.dataset.bandera] });
  });
  on(mod, 'click', '[data-quitar]', (_ev, el) => enviar('tipo.eliminar', { nombre: el.dataset.quitar }, { mensaje: () => `Tipo «${el.dataset.quitar}» quitado` }));
  const anadir = () => {
    const nombre = $('#nt-nombre', mod).value.trim().toLowerCase();
    const d = derivados();
    if (!nombre) { error = 'Escribe un nombre'; repintar(); return; }
    if (m.tipoPorNombre(d.tipos, nombre)) { error = 'Ya existe'; repintar(); return; }
    error = '';
    enviar('tipo.crear', { nombre, color: m.PAL[d.tipos.length % m.PAL.length] });
  };
  on(mod, 'click', '[data-anadir]', anadir);
  on(mod, 'keydown', '#nt-nombre', (ev) => { if (ev.key === 'Enter') anadir(); });
}

export function abrirTipos() {
  abierta = true;
  error = '';
  abrirModal(contenido(), { etiqueta: 'Tipos de bloque', onCerrar: () => { abierta = false; } });
  enlazar();
}

alCambiar(repintar);
entradaMenu({
  id: 'tipos', orden: 40,
  pintar: (d) => itemMenu('tipos', 'Tipos de bloque', html`<span style="display:flex;gap:2px">${d.tipos.slice(0, 5).map((t) => html`<span class="dot" style="background:${colorSerie(t.color, temaActual())};margin:0;width:6px;height:6px"></span>`)}</span>`),
  accion: abrirTipos,
});

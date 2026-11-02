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

let renombrando = null; // nombre del tipo cuyo nombre se está cambiando
let quitando = null; // nombre del tipo en uso que se quiere quitar (se elige a qué tipo pasar sus usos)

function filaTipo(d, t) {
  const enUso = usos(t.nombre);
  const paleta = html`<span style="display:flex;gap:3px" role="radiogroup" aria-label="Color de ${t.nombre}">${m.PAL.map((c) => html`<button type="button" class="paleta ${c === t.color ? 'on' : ''}" role="radio" aria-checked="${(c === t.color) ? 'true' : 'false'}" aria-label="${c}" data-color="${c}" data-tipo="${t.nombre}" style="background:${c}"></button>`)}</span>`;
  const nombre = renombrando === t.nombre
    ? html`<input id="rt-nombre" value="${t.nombre}" aria-label="Nuevo nombre de ${t.nombre}" style="font-size:12px;width:130px" autocomplete="off"><button type="button" class="dark" data-renombrar-guardar="${t.nombre}">Guardar</button><button type="button" data-renombrar-cancelar>Cancelar</button>`
    : html`<button type="button" class="add" style="font-weight:500;color:var(--texto)" data-renombrar="${t.nombre}" aria-label="Cambiar el nombre de ${t.nombre}" title="Cambiar el nombre (también en tus bloques, plantilla y tareas)">${t.nombre} <span class="mut">✎</span></button>`;
  const banderas = html`<span class="mut" style="font-size:10.5px">cuenta como</span>${[['trabajo', '☾ trabajo', 'Cuenta para la hora de desconexión (☾)'], ['estudio', '📚 estudio', 'Subtipos (aprender, repasar, simulacro), foco máximo y simulacros']].map(([k, texto, ayuda]) => html`<button type="button" class="ac ${t[k] ? 'on' : ''}" aria-pressed="${(t[k]) ? 'true' : 'false'}" data-bandera="${k}" data-tipo-bandera="${t.nombre}" aria-label="${t.nombre} cuenta como ${k}" title="${ayuda}">${texto}</button>`)}`;
  const otros = d.tipos.filter((x) => x.nombre !== t.nombre);
  const quitar = quitando === t.nombre
    ? html`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;font-size:11.5px">Se usa en ${enUso} sitio${enUso === 1 ? '' : 's'}. Pásalos a <select id="qt-destino" aria-label="Tipo al que pasar los bloques de ${t.nombre}">${otros.map((x) => html`<option>${x.nombre}</option>`)}</select><button type="button" class="peligro-texto" data-quitar-pasando="${t.nombre}">Quitar «${t.nombre}»</button><button type="button" data-quitar-cancelar>Cancelar</button></div>`
    : '';
  return html`<div class="pend" style="flex-wrap:wrap"><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${paleta}${nombre}${banderas}</span><span class="opts"><button type="button" class="peligro-texto" data-quitar="${t.nombre}" aria-label="Quitar ${t.nombre}" title="${enUso ? `En uso (${enUso}): te pregunta a qué tipo pasarlos` : 'Quitar'}">quitar</button></span>${quitar}</div>`;
}

function contenido() {
  const d = derivados();
  return html`${cabecera('Tipos de bloque')}<div class="mut mod-nota">Los tipos dan color y agrupan horas. Pulsa un nombre para cambiarlo (se cambia también en tus bloques, plantilla y tareas).</div>
${d.tipos.map((t) => filaTipo(d, t))}
<div class="frm" style="margin-top:10px;grid-template-columns:1fr auto"><input id="nt-nombre" placeholder="nuevo tipo (salud, familia, lectura…)" style="font-size:11.5px" aria-label="Nuevo tipo"><button type="button" data-anadir>Añadir</button><div class="error-form" role="alert">${error}</div></div>
<div class="mut" style="font-size:10.5px;margin-top:8px">«cuenta como ☾ trabajo»: avisa si se alarga después de tu hora de cierre. «cuenta como 📚 estudio»: subtipos (aprender, repasar, simulacro), foco máximo y lo que propone «Proponer». Lo normal es que solo el tipo «trabajo» cuente como trabajo y solo «estudio» como estudio.</div>${avisoLineas('tipos.md', st.datos.ficheros['tipos.md'])}`;
}

function repintar() { if (abierta && modalAbierto()) { abrirModal(contenido(), { etiqueta: 'Tipos de bloque', onCerrar: () => { abierta = false; } }); enlazar(); } }

function enlazar() {
  const mod = cuerpoModal();
  on(mod, 'click', '[data-color]', (_ev, el) => enviar('tipo.color', { nombre: el.dataset.tipo, color: el.dataset.color }));
  on(mod, 'click', '[data-bandera]', (_ev, el) => {
    const t = m.tipoPorNombre(derivados().tipos, el.dataset.tipoBandera);
    if (t) enviar('tipo.banderas', { nombre: t.nombre, [el.dataset.bandera]: !t[el.dataset.bandera] });
  });
  on(mod, 'click', '[data-quitar]', (_ev, el) => {
    const nombre = el.dataset.quitar;
    if (usos(nombre)) { quitando = nombre; repintar(); $('#qt-destino', cuerpoModal())?.focus(); return; }
    enviar('tipo.eliminar', { nombre }, { mensaje: () => `Tipo «${nombre}» quitado` });
  });
  on(mod, 'click', '[data-quitar-pasando]', (_ev, el) => {
    const nombre = el.dataset.quitarPasando, destino = $('#qt-destino', mod).value;
    quitando = null;
    enviar('tipo.eliminar', { nombre, pasarA: destino }, { mensaje: () => `Tipo «${nombre}» quitado · sus bloques, plantilla y tareas ahora son «${destino}»` });
  });
  on(mod, 'click', '[data-quitar-cancelar]', () => { quitando = null; repintar(); });
  on(mod, 'click', '[data-renombrar]', (_ev, el) => { renombrando = el.dataset.renombrar; repintar(); const i = $('#rt-nombre', cuerpoModal()); i?.focus(); i?.select(); });
  on(mod, 'click', '[data-renombrar-cancelar]', () => { renombrando = null; repintar(); });
  const renombrar = () => {
    const nombre = renombrando, nuevo = $('#rt-nombre', mod)?.value.trim();
    renombrando = null;
    if (!nuevo || nuevo === nombre) { repintar(); return; }
    enviar('tipo.renombrar', { nombre, nuevo }, { mensaje: (r) => `«${nombre}» ahora se llama «${nuevo}»${r.usos ? ` (cambiado en ${r.usos} sitio${r.usos === 1 ? '' : 's'})` : ''}` });
  };
  on(mod, 'click', '[data-renombrar-guardar]', renombrar);
  on(mod, 'keydown', '#rt-nombre', (ev) => { if (ev.key === 'Enter') renombrar(); if (ev.key === 'Escape') { ev.stopPropagation(); renombrando = null; repintar(); } });
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
  renombrando = null;
  quitando = null;
  abrirModal(contenido(), { etiqueta: 'Tipos de bloque', onCerrar: () => { abierta = false; } });
  enlazar();
}

alCambiar(repintar);
entradaMenu({
  id: 'tipos', orden: 40,
  pintar: (d) => itemMenu('tipos', 'Tipos de bloque', html`<span style="display:flex;gap:2px">${d.tipos.slice(0, 5).map((t) => html`<span class="dot" style="background:${colorSerie(t.color, temaActual())};margin:0;width:6px;height:6px"></span>`)}</span>`),
  accion: abrirTipos,
});

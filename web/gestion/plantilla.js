// Gestión → Plantilla de semana: lo que se crea solo cada semana (afecta a las semanas que aún no existen).
import { html, on, $, $$, temaActual } from '../ui/dom.js';
import { abrirModal, cabecera, cuerpoModal, modalAbierto } from '../ui/modal.js';
import { st, enviar, derivados, alCambiar } from '../estado.js';
import { avisoLineas } from '../ui/avisos.js';
import { entradaMenu, itemMenu, opcionesHora, etiquetaDuracion } from './comun.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie } from '/core/color.js';

let abierta = false;
let error = '';
let aplicar = true; // añadir o quitar también en las semanas ya creadas (la actual desde hoy y las futuras)

/** Texto del toast tras añadir o quitar con «aplicar». */
function enSemanas(r, verbo) {
  if (!r?.semanas) return '';
  return ` · ${verbo} en ${r.n} bloque${r.n === 1 ? '' : 's'} de ${r.semanas} semana${r.semanas === 1 ? '' : 's'}${r.solapes ? ` (⚠ ${r.solapes} se solapa${r.solapes === 1 ? '' : 'n'}: muévelo${r.solapes === 1 ? '' : 's'})` : ''}`;
}

function contenido() {
  const d = derivados(), tema = temaActual();
  const entradas = m.plantillaDe(st.datos.ficheros['plantilla.md']);
  const h0 = d.ajustes.horas.desde * 60, h1 = d.ajustes.horas.hasta * 60;
  return html`${cabecera('Plantilla de semana')}<div class="mut mod-nota">Lo que se crea solo cada semana. Las semanas nuevas salen ya con esto; con la casilla de abajo, también cambian la semana actual (desde hoy) y las futuras que ya tengas. Las pasadas no cambian nunca.</div>
${entradas.map((e) => html`<div class="pend"><span><span class="dot" style="background:${colorSerie(m.colorDeTipo(d.tipos, e.tipo), tema)}"></span>${e.titulo} <span class="mut" style="font-size:10.5px">${e.dias.map((x) => f.DIAS[x]).join(',')} ${f.horaCorta(e.inicio)}–${f.horaCorta(e.fin)}</span></span><span class="opts"><button type="button" class="peligro-texto" data-quitar="${e.id}">quitar</button></span></div>`)}
${entradas.length ? '' : html`<div class="mut" style="font-size:12px;padding:8px 0">La plantilla está vacía.</div>`}
<div class="frm" style="margin-top:10px">
  <div style="display:flex;gap:5px;flex-wrap:wrap"><input id="pl-titulo" placeholder="título" style="flex:1;font-size:11.5px" aria-label="Título"><select id="pl-tipo" style="font-size:11.5px" aria-label="Tipo">${d.tipos.map((t) => html`<option>${t.nombre}</option>`)}</select></div>
  <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">${f.DIAS.map((l, i) => html`<label class="fila" style="margin:0;gap:2px"><input type="checkbox" data-dia="${i}">${l}</label>`)}
    <select id="pl-inicio" style="font-size:11.5px" aria-label="Hora de inicio">${opcionesHora(h0, h1, 9 * 60)}</select>
    <select id="pl-dur" style="font-size:11.5px" aria-label="Duración">${[30, 60, 90, 120, 180, 510].map((x) => html`<option value="${x}" ${x === 60 ? 'selected' : ''}>${etiquetaDuracion(x)}</option>`)}</select></div>
  <label class="fila" style="margin:4px 0 0"><input type="checkbox" id="pl-aplicar" ${aplicar ? 'checked' : ''}> Aplicar también a esta semana (desde hoy) y a las siguientes ya creadas, aunque se solape</label>
  <div class="error-form" role="alert">${error}</div><button type="button" data-anadir>Añadir a la plantilla</button>
</div>${avisoLineas('plantilla.md', st.datos.ficheros['plantilla.md'])}`;
}

function repintar() { if (abierta && modalAbierto()) { abrirModal(contenido(), { etiqueta: 'Plantilla de semana', onCerrar: () => { abierta = false; } }); enlazar(); } }

function enlazar() {
  const mod = cuerpoModal();
  on(mod, 'click', '[data-quitar]', (_ev, el) => {
    const e = m.plantillaDe(st.datos.ficheros['plantilla.md']).find((x) => x.id === +el.dataset.quitar);
    if (e) enviar('plantilla.eliminar', { id: e.id, huella: m.huellaDe(e), aplicar }, { mensaje: (r) => `«${e.titulo}» quitado de la plantilla${enSemanas(r, 'y quitado')}` });
  });
  on(mod, 'change', '#pl-aplicar', (_ev, el) => { aplicar = el.checked; });
  on(mod, 'click', '[data-anadir]', () => {
    const titulo = $('#pl-titulo', mod).value.trim();
    const dias = $$('[data-dia]', mod).filter((c) => c.checked).map((c) => +c.dataset.dia);
    if (!titulo || !dias.length) { error = 'Pon un título y al menos un día'; repintar(); return; }
    const inicio = +$('#pl-inicio', mod).value;
    const fin = Math.min(derivados().ajustes.horas.hasta * 60, inicio + +$('#pl-dur', mod).value);
    error = '';
    enviar('plantilla.crear', { dias, inicio, fin, tipo: $('#pl-tipo', mod).value, titulo, aplicar }, { mensaje: (r) => `«${titulo}» añadido a la plantilla${enSemanas(r, 'y añadido')}` });
  });
}

export function abrirPlantilla() {
  abierta = true;
  error = '';
  abrirModal(contenido(), { etiqueta: 'Plantilla de semana', onCerrar: () => { abierta = false; } });
  enlazar();
}

alCambiar(repintar);
entradaMenu({ id: 'plantilla', orden: 30, pintar: () => itemMenu('plantilla', 'Plantilla de semana', html`<span class="mut">↻</span>`), accion: abrirPlantilla });

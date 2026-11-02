// Arranque y orquestación: barra superior, cambio de vista, menú Gestión, teclado y repintado.
import { html, $, on, pintar, hayRepintadoAplazado, olvidarAplazados } from './ui/dom.js';
import { st, cargar, alCambiar, iniciarSondeo, derivados, acciones, irASemana } from './estado.js';
import * as f from '/core/fechas.js';
import { iniciarModal, cerrarModal, modalAbierto, abrirModal, cabecera } from './ui/modal.js';
import { cerrarPopover, popoverAbierto } from './ui/popover.js';
import { pintarCajon, iniciarCajon } from './ui/cajon.js';
import { pintarSemana, iniciarSemana } from './vistas/semana.js';
import './vistas/cajon-hoy.js';
import { atributosTema, avisoTemaDesconocido } from '/core/temas.js';

/** Vistas principales: { id: { titulo, pintar(), iniciar?() } }. Las fases añaden las suyas. */
export const vistas = {
  semana: { titulo: 'Semana', pintar: pintarSemana, iniciar: iniciarSemana },
};

/** Entradas del menú Gestión ▾: [{ id, pintar(d) → html | null, accion() }] */
export const menuGestion = [];

let menuAbierto = false;

function pintarBarra() {
  pintar($('#seg'), html`${Object.entries(vistas).map(([id, v]) => html`<button type="button" class="${id === st.ui.vista ? 'on' : ''}" aria-pressed="${(id === st.ui.vista) ? 'true' : 'false'}" data-vista="${id}">${v.titulo}</button>`)}`);
  const d = derivados();
  const pendiente = d.meta.pendientes.length > 0;
  $('#gbtn').innerHTML = String(html`${pendiente ? html`<span class="d" aria-label="hay una semana sin cerrar"></span>` : ''}Gestión ▾`);
  $('#gbtn').setAttribute('aria-expanded', menuAbierto);
  pintar($('#gmenu'), menuAbierto ? html`<div class="dd" role="menu">${menuGestion.map((e) => e.pintar(d))}<div class="sep"></div><div class="mut" style="font-size:11px;padding:4px 10px 6px">Guardado en ${d.meta.datos.ruta} · copia ${d.ajustes.copias}</div></div>` : '');
}

/** Aplica el tema al <html> (atributos y tokens del personalizado). Los colores de tipo se recalculan al pintar. */
function aplicarTema() {
  const d = derivados();
  const a = atributosTema(d.ajustes, st.datos.ficheros['tema.md'], d.meta.hoy);
  const raiz = document.documentElement;
  if (raiz.dataset.tema !== a.tema) raiz.dataset.tema = a.tema;
  if (raiz.dataset.deco !== a.deco) raiz.dataset.deco = a.deco;
  raiz.toggleAttribute('data-personalizado', a.personalizado);
  let estilo = document.getElementById('tema-personalizado');
  if (a.personalizado && !estilo) {
    estilo = document.createElement('style');
    estilo.id = 'tema-personalizado';
    document.head.appendChild(estilo);
  }
  if (estilo) estilo.textContent = a.personalizado ? `:root[data-personalizado][data-tema]{${a.css}}` : '';
  // la barra de la app instalada toma el fondo del tema
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(raiz).getPropertyValue('--fondo').trim();
}

function pintarBanda() {
  const d = derivados();
  const tema = avisoTemaDesconocido(st.datos.ficheros['ajustes.md']);
  const avisos = [...d.meta.avisos, ...(tema ? [tema] : []), ...(acciones.avisosExtra?.() ?? [])];
  pintar($('#banda'), html`${st.caido ? html`<div class="banda-global" role="alert"><span>Servidor parado · solo lectura. Reintento cada 5 s.</span></div>` : ''}${avisos.map((a) => html`<div class="banda-global"><span>⚠ ${a}</span></div>`)}`);
}

export function pintarTodo() {
  if (!st.datos) return;
  const t0 = performance.now();
  if (!vistas[st.ui.vista]) st.ui.vista = 'semana';
  aplicarTema();
  pintarBarra();
  pintarBanda();
  for (const id of Object.keys(vistas)) $(`#v-${id}`).hidden = id !== st.ui.vista;
  $('#maingrid').classList.toggle('ancho', st.ui.vista === 'progreso');
  vistas[st.ui.vista].pintar();
  pintarCajon();
  acciones.trasPintar?.();
  const ms = performance.now() - t0;
  if (ms > 50) console.warn(`planner: pintar tardó ${ms.toFixed(0)} ms`);
}

acciones.irA = (vista) => {
  if (!vistas[vista]) return;
  st.ui.vista = vista;
  cerrarPopover();
  pintarTodo();
};

function cerrarMenu() {
  if (!menuAbierto) return false;
  menuAbierto = false;
  pintarBarra();
  return true;
}

function iniciarBarra() {
  on($('#seg'), 'click', '[data-vista]', (_ev, el) => acciones.irA(el.dataset.vista));
  $('#gbtn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    menuAbierto = !menuAbierto;
    pintarBarra();
    if (menuAbierto) $('#gmenu [role=menuitem]')?.focus();
  });
  on($('#gmenu'), 'click', '[data-gestion]', (_ev, el) => {
    const e = menuGestion.find((x) => x.id === el.dataset.gestion);
    cerrarMenu();
    // el foco vuelve a «Gestión ▾» (la entrada del menú desaparece): al cerrar el modal, ahí sigue
    $('#gbtn').focus();
    e?.accion();
  });
  document.addEventListener('click', (ev) => { if (menuAbierto && !ev.target.closest('.gm')) cerrarMenu(); });
  document.addEventListener('pointerdown', (ev) => {
    if (popoverAbierto() && !ev.target.closest('.pop') && !ev.target.closest('.blk')) cerrarPopover();
  });
  // Lo que no se repintó durante una interacción (escribir en Las 3, arrastrar), se repinta al terminarla.
  const alTerminar = () => setTimeout(() => { if (hayRepintadoAplazado()) { olvidarAplazados(); pintarTodo(); } });
  document.addEventListener('focusout', alTerminar);
  document.addEventListener('pointerup', alTerminar);
  document.addEventListener('pointercancel', alTerminar);
  // Esc cierra lo de más arriba: popover, modal, menú
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (cerrarPopover()) { ev.preventDefault(); return; }
    if (modalAbierto()) { cerrarModal(); ev.preventDefault(); return; }
    if (cerrarMenu()) { $('#gbtn').focus(); ev.preventDefault(); return; }
    acciones.escapeExtra?.(ev);
  });
  document.addEventListener('keydown', atajo);
}

const ATAJOS = [
  ['n', 'apuntar algo (va a la barra «＋ apunta algo»)'],
  ['1 · 2 · 3', 'ir a Semana · Hoy · Progreso'],
  ['← · →', 'semana anterior · siguiente (en Semana)'],
  ['h', 'volver a la semana actual (en Semana)'],
  ['?', 'esta ayuda'],
  ['Esc', 'cerrar lo que esté abierto'],
];

function ayudaAtajos() {
  abrirModal(html`${cabecera('Atajos de teclado')}<table class="atajos">${ATAJOS.map(([k, t]) => html`<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`)}</table><div class="mut" style="font-size:11.5px;margin-top:8px">No funcionan mientras escribes en un campo.</div>`, { etiqueta: 'Atajos de teclado' });
}

acciones.atajos = ayudaAtajos;

/** Atajos de una tecla: solo si no se está escribiendo, ni hay modal o popover abierto, ni modificadores. */
function atajo(ev) {
  if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
  const t = ev.target;
  if (t.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (!st.datos) return;
  if (ev.key === '?') { if (!modalAbierto()) { ev.preventDefault(); cerrarPopover(); ayudaAtajos(); } return; }
  if (modalAbierto() || popoverAbierto() || menuAbierto) return;
  const ids = Object.keys(vistas);
  const orden = ['semana', 'hoy', 'progreso'].filter((v) => ids.includes(v));
  if (/^[1-9]$/.test(ev.key) && orden[+ev.key - 1]) { ev.preventDefault(); acciones.irA(orden[+ev.key - 1]); return; }
  if (ev.key === 'n' || ev.key === 'N') { const c = $('#cap'); if (c) { ev.preventDefault(); c.focus(); } return; }
  if (st.ui.vista !== 'semana') return;
  // las flechas sobre un bloque o un botón no cambian de semana (el foco está en otra cosa)
  if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && !t.closest?.('.blk')) {
    ev.preventDefault();
    irASemana(f.sumarSemanas(st.ui.semana, ev.key === 'ArrowLeft' ? -1 : 1));
  } else if (ev.key === 'h') {
    ev.preventDefault();
    irASemana(derivados().meta.semanaActual);
  }
}

export async function iniciar() {
  iniciarModal();
  iniciarBarra();
  for (const v of Object.values(vistas)) v.iniciar?.();
  iniciarCajon();
  acciones.alIniciar?.();
  alCambiar(pintarTodo);
  // «Automático» sigue al sistema: al cambiar, se recalculan los colores de los bloques.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintarTodo);
  await cargar();
  iniciarSondeo();
}

// Las fases registran vistas, pestañas y menús antes de arrancar (módulos importados en extensiones.js).
import('./extensiones.js')
  .catch((e) => {
    console.error(e);
    const aviso = `No se pudo cargar una parte del planner: ${e.message}`;
    acciones.avisosExtra = () => [aviso];
  })
  .finally(iniciar);

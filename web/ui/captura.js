// «Apunta algo»: escribe qué es y Enter. Al pulsar la barra se abre un panel con botones para el tipo, el cuándo
// y si es importante (no hace falta saberse nada de memoria). «/» abre la lista de tipos. Lo que se escribe a mano
// (#trabajo, mañana, !, 45m, algún día; core/captura.js) también vale y se ve marcado en los botones.
// Al guardar, el aviso ofrece «✎ editar» para poner la duración, la fecha exacta, etc.
import { html, raw, $, pintar, temaActual } from './dom.js';
import { enviar, derivados, acciones } from '../estado.js';
import { parsearCaptura, destinoCaptura, tareaDeCaptura, NOMBRE_DESTINO, etiquetaFecha } from '/core/captura.js';
import { colorSerie } from '/core/color.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';

// Lo elegido con los botones manda sobre lo escrito. undefined = sin elegir (vale lo escrito).
let elegido = { tipo: undefined, cuando: undefined, fecha: null, prioridad: undefined, idea: false };
let borrarAviso = null;
let sugerencia = 0; // tipo resaltado en la lista de «/»

const CUANDO = [['hoy', 'hoy'], ['manana', 'mañana'], ['fecha', 'otro día…'], ['mas', 'más adelante'], ['algun', 'algún día']];

/** «/tra» al final del texto (se está eligiendo un tipo) → { filtro, tipos } o null. */
function barra(texto, tipos) {
  const x = /(?:^|\s)\/([\p{L}\d_-]*)$/u.exec(texto);
  if (!x) return null;
  const filtro = m.normalizar(x[1]);
  return { filtro, desde: x.index + (x[0].startsWith('/') ? 0 : 1), tipos: tipos.filter((t) => m.normalizar(t.nombre).startsWith(filtro)) };
}

/** Lo que se va a guardar con el texto y lo elegido en los botones. */
function analizar(texto) {
  const d = derivados(), hoy = d.meta.hoy, manana = f.sumarDias(hoy, 1);
  const b = barra(texto, d.tipos);
  const r = parsearCaptura(b ? texto.slice(0, b.desde) : texto, { tipos: d.tipos, hoy });
  if (b && b.tipos.length === 1 && b.filtro) r.tipo = b.tipos[0].nombre; // «/estu» ya dice cuál
  if (elegido.tipo !== undefined) r.tipo = elegido.tipo;
  if (elegido.prioridad !== undefined) r.prioridad = elegido.prioridad;
  let forzado = null;
  switch (elegido.cuando) {
    case 'hoy': r.fecha = hoy; r.algunDia = false; break;
    case 'manana': r.fecha = manana; r.algunDia = false; break;
    case 'fecha': r.fecha = elegido.fecha; r.algunDia = false; break;
    case 'mas': r.fecha = null; r.algunDia = false; forzado = 'mas'; break;
    case 'algun': r.fecha = null; r.algunDia = true; break;
    default:
  }
  const abiertasHoy = d.tareas.hoy.filter((t) => !t.hecha).length;
  let destino = forzado ?? destinoCaptura(r, { hoy, abiertasHoy, limite: d.ajustes.tareas_hoy });
  // «hoy» elegido a mano: va a Hoy aunque esté lleno (el límite es una guía; se avisa)
  const excede = elegido.cuando === 'hoy' && abiertasHoy >= d.ajustes.tareas_hoy;
  if (elegido.cuando === 'hoy') destino = 'hoy';
  const lleno = !excede && !r.algunDia && destino === 'mas' && abiertasHoy >= d.ajustes.tareas_hoy && (r.fecha === hoy || (!r.fecha && !r.tipo && !forzado));
  const cuando = r.algunDia ? 'algun' : destino === 'hoy' || r.fecha === hoy ? 'hoy' : r.fecha === manana ? 'manana' : r.fecha ? 'fecha' : 'mas';
  return { d, r, destino, lleno, excede, cuando, b };
}

function pintarPanel(input) {
  const panel = $('#cap-panel');
  if (!panel || panel.hidden) return;
  const { d, r, destino, lleno, excede, cuando, b } = analizar(input.value);
  const tema = temaActual();
  // `dato`: nombre fijo del atributo data-* (nuestro), `valor`: escapado (puede ser el nombre de un tipo)
  const chip = (on, dato, valor, contenido) => html`<button type="button" class="ac ${on ? 'on' : ''}" aria-pressed="${on ? 'true' : 'false'}" ${raw(dato)}="${valor}">${contenido}</button>`;
  const punto = (tipo) => html`<span class="dot" style="background:${colorSerie(m.colorDeTipo(d.tipos, tipo), tema)}"></span>`;
  const tipos = b ? b.tipos : d.tipos;
  if (sugerencia >= tipos.length) sugerencia = 0;
  pintar(panel, html`${b ? html`<div class="cp-fila"><span class="cp-lab">Elige tipo</span>${tipos.length
    ? tipos.map((t, i) => html`<button type="button" class="ac ${i === sugerencia ? 'on' : ''}" data-cap-tipo="${t.nombre}">${punto(t.nombre)}${t.nombre}</button>`)
    : html`<span class="mut" style="font-size:11.5px">ningún tipo empieza así</span>`}<span class="mut" style="font-size:10.5px">↑↓ y Enter</span></div>` : elegido.idea ? html`
<div class="cp-fila"><span class="cp-lab"></span>${chip(true, 'data-cap-idea', '1', '💡 es una idea (sin fecha ni lista)')}<span class="mut" style="font-size:11px">púlsalo otra vez para que sea una tarea</span></div>` : html`
<div class="cp-fila"><span class="cp-lab">Tipo</span>${chip(!r.tipo, 'data-cap-tipo', '', 'sin tipo')}${d.tipos.map((t) => chip(m.normalizar(r.tipo ?? '') === m.normalizar(t.nombre), 'data-cap-tipo', t.nombre, html`${punto(t.nombre)}${t.nombre}`))}</div>
<div class="cp-fila"><span class="cp-lab">Cuándo</span>${CUANDO.map(([k, t]) => chip(cuando === k, 'data-cap-cuando', k, k === 'fecha' && cuando === 'fecha' && r.fecha ? etiquetaFecha(r.fecha, d.meta.hoy) : t))}${elegido.cuando === 'fecha' ? html`<input type="date" id="cap-fecha" value="${elegido.fecha ?? ''}" aria-label="Fecha" style="font-size:11.5px">` : ''}</div>
<div class="cp-fila"><span class="cp-lab"></span>${chip(r.prioridad, 'data-cap-prioridad', '1', '! importante')}${chip(elegido.idea, 'data-cap-idea', '1', '💡 es una idea (sin fecha ni lista)')}</div>`}
<div class="cp-pie"><span>${elegido.idea && input.value.trim() ? html`Irá a <b>Ideas</b> (inbox): la ordenas cuando quieras` : r.titulo ? html`Irá a <b>${NOMBRE_DESTINO[destino]}</b>${lleno ? ' (Hoy está lleno: pulsa «hoy» para ponerla igualmente)' : ''}${excede ? ` (pasarás de ${d.ajustes.tareas_hoy})` : ''}${r.dur ? ` · ${f.formatoDuracion(r.dur)}` : ''}` : 'Escribe qué es y pulsa Enter'}</span>${elegido.idea ? '' : html`<span class="mut">duración y demás: «✎ editar» al guardar</span>`}<button type="button" class="dark" data-cap-guardar ${r.titulo || (elegido.idea && input.value.trim()) ? '' : 'disabled'}>Guardar</button></div>`);
}

function abrirPanel(input) {
  const panel = $('#cap-panel');
  if (!panel) return;
  panel.hidden = false;
  pintarPanel(input);
}

function cerrarPanel() {
  const panel = $('#cap-panel');
  if (panel) { panel.hidden = true; pintar(panel, ''); }
}

const olvidar = () => { elegido = { tipo: undefined, cuando: undefined, fecha: null, prioridad: undefined, idea: false }; sugerencia = 0; };

/** Elige un tipo de la lista de «/»: quita «/…» del texto y lo marca. */
function elegirTipo(input, nombre) {
  const b = barra(input.value, derivados().tipos);
  if (b) input.value = input.value.slice(0, b.desde).replace(/\s+$/, '') + (input.value.slice(0, b.desde).trim() ? ' ' : '');
  elegido.tipo = nombre || null;
  sugerencia = 0;
  input.focus();
  pintarPanel(input);
}

function guardar(input) {
  const texto = input.value.trim();
  if (!texto) return;
  if (elegido.idea) {
    // una idea va al inbox tal cual la escribiste (sin interpretar fechas ni tipos)
    enviar('inbox.crear', { texto }, { mensaje: () => 'Idea guardada ✓ · la ves en Hoy, en «Ideas»' });
    input.value = '';
    olvidar();
    pintarPanel(input);
    return;
  }
  const { d, r, destino, lleno, excede } = analizar(input.value);
  if (!r.titulo) { pintar($('#capp'), html`<span class="pv aviso-texto">Escribe qué es (solo hay fecha, tipo o duración)</span>`); return; }
  const tarea = tareaDeCaptura(r, destino, d.meta.hoy);
  enviar('tarea.crear', { seccion: destino, tarea, exceder: excede }, {
    mensaje: () => `Guardado en ${NOMBRE_DESTINO[destino]} ✓${lleno ? ' · Hoy estaba lleno' : ''}`,
    accion: (res) => ({ texto: '✎ editar', fn: () => acciones.editarTarea?.({ id: res.id, texto: tarea.texto }) }),
  });
  input.value = '';
  olvidar();
  pintar($('#capp'), html`<span class="pv">guardado en ${NOMBRE_DESTINO[destino]} ✓${lleno ? ' · Hoy está lleno' : ''}</span>`);
  clearTimeout(borrarAviso);
  borrarAviso = setTimeout(() => { if (!input.value) pintar($('#capp'), ''); }, 2500);
  pintarPanel(input);
}

export function iniciarCaptura() {
  const input = $('#cap');
  const capw = input.closest('.capw');
  let panel = $('#cap-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cap-panel';
    panel.className = 'cap-panel';
    panel.hidden = true;
    capw.appendChild(panel);
  }
  input.placeholder = '＋ apunta algo…  (Enter guarda · / para elegir el tipo)';
  input.addEventListener('focus', () => abrirPanel(input));
  input.addEventListener('input', () => { pintar($('#capp'), ''); abrirPanel(input); });
  // pulsar en el panel no quita el foco a la barra (si no, se cerraría)
  panel.addEventListener('mousedown', (ev) => { if (!ev.target.matches('input')) ev.preventDefault(); });
  panel.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-cap-tipo],[data-cap-cuando],[data-cap-prioridad],[data-cap-idea],[data-cap-guardar]');
    if (!t) return;
    if (t.dataset.capTipo !== undefined) {
      if (barra(input.value, derivados().tipos)) return elegirTipo(input, t.dataset.capTipo);
      const actual = analizar(input.value).r.tipo;
      elegido.tipo = t.dataset.capTipo === '' || m.normalizar(actual ?? '') === m.normalizar(t.dataset.capTipo) ? null : t.dataset.capTipo;
    } else if (t.dataset.capCuando) {
      const k = t.dataset.capCuando;
      elegido.cuando = k;
      if (k === 'fecha' && !elegido.fecha) elegido.fecha = f.sumarDias(derivados().meta.hoy, 2);
    } else if (t.hasAttribute('data-cap-idea')) {
      elegido.idea = !elegido.idea;
    } else if (t.hasAttribute('data-cap-prioridad')) {
      elegido.prioridad = !analizar(input.value).r.prioridad;
    } else if (t.hasAttribute('data-cap-guardar')) {
      guardar(input);
      return;
    }
    input.focus();
    pintarPanel(input);
    if (elegido.cuando === 'fecha' && t.dataset.capCuando === 'fecha') $('#cap-fecha')?.focus();
  });
  panel.addEventListener('change', (ev) => {
    if (ev.target.id === 'cap-fecha') { elegido.fecha = f.esFecha(ev.target.value) ? ev.target.value : null; pintarPanel(input); }
  });
  input.addEventListener('keydown', (ev) => {
    const b = barra(input.value, derivados().tipos);
    if (b && b.tipos.length && ['ArrowDown', 'ArrowUp'].includes(ev.key)) {
      ev.preventDefault();
      sugerencia = (sugerencia + (ev.key === 'ArrowDown' ? 1 : b.tipos.length - 1)) % b.tipos.length;
      pintarPanel(input);
      return;
    }
    if (ev.key === 'Enter' || (ev.key === 'Tab' && b && b.tipos.length)) {
      ev.preventDefault();
      if (b && b.tipos.length) elegirTipo(input, b.tipos[sugerencia]?.nombre ?? b.tipos[0].nombre);
      else guardar(input);
    }
    if (ev.key === 'Escape') { input.value = ''; olvidar(); pintar($('#capp'), ''); cerrarPanel(); input.blur(); ev.stopPropagation(); }
  });
  // se cierra al salir de la barra y del panel
  document.addEventListener('focusin', (ev) => { if (!capw.contains(ev.target)) cerrarPanel(); });
  document.addEventListener('mousedown', (ev) => { if (!capw.contains(ev.target)) cerrarPanel(); });
}

acciones.alIniciar = ((previa) => () => { previa?.(); iniciarCaptura(); })(acciones.alIniciar);

// «Apunta algo»: vista previa en chips mientras escribes y Enter para guardar (sin IA, core/captura.js).
import { html, $, pintar, temaActual } from './dom.js';
import { enviar, derivados, acciones } from '../estado.js';
import { parsearCaptura, destinoCaptura, tareaDeCaptura, NOMBRE_DESTINO, etiquetaFecha } from '/core/captura.js';
import { colorSerie } from '/core/color.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';

let borrarAviso = null;

function analizar(texto) {
  const d = derivados();
  const r = parsearCaptura(texto, { tipos: d.tipos, hoy: d.meta.hoy });
  const abiertasHoy = d.tareas.hoy.filter((t) => !t.hecha).length;
  const destino = destinoCaptura(r, { hoy: d.meta.hoy, abiertasHoy, limite: d.ajustes.tareas_hoy });
  const lleno = !r.algunDia && destino === 'mas' && abiertasHoy >= d.ajustes.tareas_hoy && (r.fecha === d.meta.hoy || (!r.fecha && !r.tipo));
  return { d, r, destino, lleno };
}

function vistaPrevia(texto) {
  const caja = $('#capp');
  if (!texto.trim()) { pintar(caja, ''); return; }
  const { d, r, destino, lleno } = analizar(texto);
  const tema = temaActual();
  pintar(caja, html`${r.tipo ? html`<span class="pv"><span class="dot" style="background:${colorSerie(m.colorDeTipo(d.tipos, r.tipo), tema)}"></span>${r.tipo}</span>` : html`<span class="pv">sin tipo</span>`}${r.fecha ? html`<span class="pv">${etiquetaFecha(r.fecha, d.meta.hoy)}</span>` : ''}${r.prioridad ? html`<span class="pv peligro-texto">prioridad</span>` : ''}${r.dur ? html`<span class="pv">${f.formatoDuracion(r.dur)}</span>` : ''}${r.titulo ? '' : html`<span class="pv aviso-texto">falta el título</span>`}<span class="pv destino">→ ${NOMBRE_DESTINO[destino]}${lleno ? ' (Hoy está lleno)' : ''}</span>`);
}

function guardar(input) {
  const texto = input.value.trim();
  if (!texto) return;
  const { d, r, destino, lleno } = analizar(texto);
  if (!r.titulo) { pintar($('#capp'), html`<span class="pv aviso-texto">Escribe qué es: solo hay fecha, área o duración</span>`); return; }
  enviar('tarea.crear', { seccion: destino, tarea: tareaDeCaptura(r, destino, d.meta.hoy) });
  input.value = '';
  pintar($('#capp'), html`<span class="pv">guardado en ${NOMBRE_DESTINO[destino]} ✓${lleno ? ' · Hoy está lleno' : ''}</span>`);
  clearTimeout(borrarAviso);
  borrarAviso = setTimeout(() => { if (!input.value) pintar($('#capp'), ''); }, 2500);
}

export function iniciarCaptura() {
  const input = $('#cap');
  input.addEventListener('input', () => vistaPrevia(input.value));
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); guardar(input); }
    if (ev.key === 'Escape') { input.value = ''; pintar($('#capp'), ''); input.blur(); ev.stopPropagation(); }
  });
}

acciones.alIniciar = ((previa) => () => { previa?.(); iniciarCaptura(); })(acciones.alIniciar);

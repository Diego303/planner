// Vista Semana: cabecera, banda de estado, Las 3, rejilla con carriles y capacidad, y arrastrar/estirar/crear.
import { html, raw, $, on, pintar, temaActual } from '../ui/dom.js';
import { st, enviar, derivados, irASemana, acciones } from '../estado.js';
import { toast } from '../ui/toast.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { carriles, contarSolapes } from '/core/carriles.js';
import { ocupacionDia, estudioDia, trabajoTrasCierre } from '/core/capacidad.js';
import { estadoSemana, soloLectura } from '/core/semanas.js';
import { colorBloque, colorSerie } from '/core/color.js';
import { abrirEditor } from './editor-bloque.js';
import { avisoLineas } from '../ui/avisos.js';

export const PX = 23; // px por hora (plan §3)

// Decoración de Halloween: telaraña de trazo fino en una esquina (solo se ve con ese tema y la decoración activa).
const TELARANA = '<svg class="deco-halloween deco-telarana" aria-hidden="true" viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width=".7"><path d="M100 0L-40 0M100 0L-35 39M100 0L-19 74M100 0L6 104M100 0L39 126M100 0L76 138M100 0L100 140"/><path d="M82 0Q84.5 2.2 82.7 5Q85.7 6.4 84.7 9.5Q88 10.1 88 13.4Q91.2 13 92.1 16.2Q95.2 14.9 96.9 17.7Q98.6 15.7 100 18M66 0Q70.7 4.1 67.3 9.4Q72.9 12.1 71.2 18Q77.3 19 77.2 25.3Q83.4 24.6 85.1 30.6Q90.8 28.2 94.1 33.5Q97.4 29.7 100 34M48 0Q55.1 6.3 50 14.3Q58.6 18.4 55.9 27.6Q65.3 29.1 65.2 38.6Q74.7 37.6 77.2 46.7Q86 43.1 91 51.2Q96 45.4 100 52M28 0Q37.9 8.7 30.8 19.8Q42.7 25.5 38.9 38.2Q51.9 40.3 51.8 53.5Q64.9 52 68.4 64.7Q80.6 59.7 87.5 70.9Q94.5 62.9 100 72M6 0Q18.9 11.4 9.6 25.9Q25.2 33.3 20.3 49.8Q37.2 52.7 37.1 69.9Q54.2 67.9 58.8 84.5Q74.7 77.9 83.7 92.6Q92.8 82.1 100 94"/></g></svg>';

const BANDAS = {
  'cerrada': (id) => [`Semana cerrada · solo lectura · su resumen está en semanas/${id}.md`, 'Reabrir', 'reabrir', 'cerrada'],
  'sin cerrar': () => ['Semana pasada sin cerrar. Puedes editarla y cerrarla cuando quieras.', 'Cerrar ahora', 'cerrar', 'aviso'],
  'reabierta': () => ['Semana reabierta. Edita lo que necesites: la semana siguiente no cambia.', 'Cerrar de nuevo', 'cerrar', 'aviso'],
  'solo plantilla': () => ['Semana futura · ya tiene tus bloques ↻. Añade lo que sepas o pulsa Proponer.', '', '', ''],
  'planificada': () => ['Semana futura planificada. Puedes seguir moviéndola hasta que llegue.', '', '', ''],
  'sin datos': () => ['Semana pasada sin datos · solo lectura.', '', '', 'cerrada'],
};

/** Todo lo que necesita la vista, calculado una vez por pintura. */
export function modeloSemana() {
  const d = derivados();
  const id = st.ui.semana;
  const estado = estadoSemana(id, d.semanaDoc, d.meta.semanaActual);
  return {
    d, id, estado,
    ro: soloLectura(estado) || st.caido || !d.semanaDoc,
    bloques: m.bloquesDe(d.semanaDoc),
    las3: m.las3De(d.semanaDoc),
    tema: temaActual(),
    esActual: id === d.meta.semanaActual,
    pasada: id < d.meta.semanaActual,
    hoyIdx: id === d.meta.semanaActual ? f.diaSemana(d.meta.hoy) : -1,
  };
}

// ---------- Pintura ----------

function cabecera(v) {
  const { d, id, estado, bloques } = v;
  const sug = bloques.filter((b) => b.sugerido).length;
  const solapes = contarSolapes(bloques);
  const mas = d.tareas.mas.filter((t) => !t.hecha).length + d.tareas.algun.filter((t) => !t.hecha).length;
  const clasePill = estado === 'sin cerrar' || estado === 'reabierta' ? 'aviso' : estado === 'en curso' ? 'ok' : '';
  return html`<div class="wk-cab">
    <div class="wk-titulo"><span class="wk-rango">${f.rangoSemana(id)}</span><button type="button" class="wk-num" data-accion="semanas" title="Elegir semana">semana ${f.numeroSemana(id)}</button><span class="pill ${clasePill}">${estado}</span></div>
    <div class="wk-acciones"><span class="wk-plan mut"><button type="button" data-accion="ir-hoy">más adelante · ${mas}</button>${sug ? ` · ${sug} sugerencia${sug === 1 ? '' : 's'}` : ''}${solapes ? html` · <span class="peligro-texto">⚠ ${solapes} solape${solapes === 1 ? '' : 's'}</span>` : ''}</span>
      <button type="button" data-accion="anterior" aria-label="Semana anterior" style="padding:4px 10px">‹</button><button type="button" data-accion="hoy">hoy</button><button type="button" data-accion="siguiente" aria-label="Semana siguiente" style="padding:4px 10px">›</button>${acciones.proponer && !v.pasada ? html`<button type="button" class="dark" data-accion="proponer" ${v.ro ? 'disabled' : ''}>Proponer semana</button>` : ''}</div>
  </div>`;
}

function banda(v) {
  const def = BANDAS[v.estado];
  if (!def) return '';
  const [texto, boton, accion, clase] = def(v.id);
  const mostrarBoton = boton && (accion !== 'cerrar' || acciones.cerrarSemana);
  return html`<div class="banda ${clase}"><span>${texto}</span>${mostrarBoton ? html`<button type="button" data-accion="${accion}" ${st.caido ? 'disabled' : ''}>${boton}</button>` : ''}</div>`;
}

function las3(v) {
  const editable = !v.ro;
  return html`<div class="las3"><span class="mut" style="font-size:12px;margin-right:4px">Las 3</span>${v.las3.map((o) => html`<div class="b3 ${o.hecha ? 'hecha' : ''}" data-las3="${o.id}">
      <button type="button" class="cb ${o.hecha ? 'on' : ''}" data-las3-marcar ${editable ? '' : 'disabled'} aria-label="${o.hecha ? 'Desmarcar' : 'Marcar como hecha'}: ${o.texto}">${o.hecha ? '✓' : ''}</button>
      <span ${editable ? raw('contenteditable="true" spellcheck="false"') : ''} data-las3-texto role="textbox" aria-label="Objetivo de la semana">${o.texto}</span></div>`)}${editable && v.las3.length < 3 ? html`<div class="b3"><span class="cb" aria-hidden="true"></span><input data-las3-nueva maxlength="140" aria-label="Añadir uno de Las 3" placeholder="＋ añadir lo que hará que la semana merezca la pena"></div>` : ''}${!v.las3.length && !editable ? html`<span class="mut" style="font-size:12px">—</span>` : ''}</div>`;
}

function cabeceraDias(v) {
  const { d, bloques, hoyIdx } = v;
  const fechas = f.diasDeSemana(v.id);
  return html`<div class="dias"><div></div>${f.DIAS.map((letra, i) => {
    const o = ocupacionDia(bloques, i, d.ajustes);
    const e = estudioDia(bloques, i, d.tipos, d.ajustes);
    const titulo = `${f.horas(o.minutos)} h de ${f.horas(o.disponibles)} h (${Math.round(o.pct)} %) · capacidad ${d.ajustes.capacidad} %`;
    return html`<div title="${titulo}"><div class="dia-cab ${i === hoyIdx ? 'hoy' : 'mut'}">${letra} ${+fechas[i].slice(8)}</div><div class="capb"><div class="${o.nivel}" style="width:${Math.min(100, o.pct)}%"></div></div>${e.aviso ? html`<div class="foco" title="Más de ${f.numero(d.ajustes.foco_max)} h de estudio intenso en un día">${f.horas(e.minutos)} h estudio</div>` : ''}</div>`;
  })}</div>`;
}

function bloqueHtml(b, carril, v) {
  const { d } = v;
  const h0 = d.ajustes.horas.desde * 60, h1 = d.ajustes.horas.hasta * 60;
  const c = colorBloque(m.colorDeTipo(d.tipos, b.tipo), v.tema);
  const noche = !b.sugerido && trabajoTrasCierre(b, d.tipos, d.ajustes);
  const estrella = m.avanzaLas3(b.titulo, v.las3);
  const ancho = 100 / carril.n;
  const y1 = Math.max(h0, b.inicio), y2 = Math.min(h1, b.fin);
  const top = ((y1 - h0) / 60) * PX + 1, alto = Math.max(PX / 2 - 2, ((y2 - y1) / 60) * PX - 2);
  const estilo = b.sugerido ? `border-color:${c.borde};color:${c.texto}` : noche ? '' : `background:${c.fondo};color:${c.texto}`;
  const clases = ['blk', b.sugerido && 'sug', b.hecho != null && 'done', carril.solapa && 'ovl', noche && 'noche'].filter(Boolean).join(' ');
  const titulo = `${b.titulo} · ${f.horaCorta(b.inicio)}–${f.horaCorta(b.fin)}${b.plantilla ? ' · se repite cada semana' : ''}`
    + `${noche ? ' · trabajo después de tu hora de cierre' : ''}${carril.solapa ? ' · se solapa con otro bloque' : ''}`
    + `${b.sugerido ? ' · sugerencia: arrástrala o ábrela para aceptarla' : ''}${b.hecho != null ? ' · hecho' : ''}`;
  const marcas = `${noche ? '☾ ' : ''}${estrella ? '★ ' : ''}${b.subtipo === 'simulacro' ? '◎ ' : b.subtipo === 'repasar' ? '⟲ ' : ''}${b.plantilla ? '↻ ' : ''}`;
  return html`<div class="${clases}" data-id="${b.id}" role="button" tabindex="0" aria-label="${titulo}" title="${titulo}"
    style="left:calc(${carril.carril * ancho}% + 2px);width:calc(${ancho}% - 4px);top:${top}px;height:${alto}px;${raw(estilo)}">${marcas}${carril.solapa ? html`<span class="alerta">⚠ </span>` : ''}${b.titulo}${v.ro ? '' : html`<div class="rs" aria-hidden="true"></div>`}</div>`;
}

function rejilla(v) {
  const { d } = v;
  const h0 = d.ajustes.horas.desde, h1 = d.ajustes.horas.hasta, horas = h1 - h0;
  const alto = horas * PX;
  const etiquetas = Array.from({ length: horas }, (_, i) => (i % 2 === 0 ? html`<span style="top:${i * PX - 7}px">${h0 + i}</span>` : ''));
  const lineas = raw(Array.from({ length: horas }, (_, i) => `<div class="hl" style="top:${i * PX}px"></div>`).join(''));
  const cols = f.DIAS.map((letra, dia) => {
    const delDia = v.bloques.filter((b) => b.dia === dia && b.fin > h0 * 60 && b.inicio < h1 * 60);
    const lanes = carriles(delDia);
    return html`<div class="col" data-dia="${dia}" style="height:${alto}px" aria-label="${f.NOMBRES_DIA[dia]}">${lineas}${delDia.map((b, i) => bloqueHtml(b, lanes[i], v))}</div>`;
  });
  return html`<div class="rejilla ${v.ro ? 'ro' : ''}" id="rejilla"><div class="horas" style="height:${alto}px">${etiquetas}</div>${cols}</div>`;
}

function leyenda(v) {
  const { d } = v;
  return html`<div class="leyenda mut">${d.tipos.map((t) => html`<span><span class="dot" style="background:${colorSerie(t.color, v.tema)}"></span>${t.nombre}</span>`)}<span>↻ plantilla</span><span>┄ sugerido</span><span>◎ simulacro · ⟲ repaso</span><span>★ avanza las 3</span><span>☾ trabajo tras el cierre</span><span>línea bajo el día: ocupación (≤ ${d.ajustes.capacidad} %)</span></div>`;
}

export function pintarSemana() {
  const raiz = $('#v-semana');
  if (!raiz.firstElementChild) raiz.innerHTML = `<div class="card" id="wk">${TELARANA}<div id="wk-c"></div></div>`;
  const v = modeloSemana();
  pintar($('#wk-c'), html`${cabecera(v)}${banda(v)}${las3(v)}${cabeceraDias(v)}${rejilla(v)}${leyenda(v)}${avisoLineas(v.d.semanaRuta, v.d.semanaDoc)}`);
}

// ---------- Interacción ----------

const bloquePorId = (id) => m.bloquesDe(derivados().semanaDoc).find((b) => b.id === id);
const tipoPorDefecto = (tipos) => (m.tipoPorNombre(tipos, 'personal') ?? tipos[0])?.nombre ?? 'personal';

function crearEnHueco(col, ev) {
  const v = modeloSemana();
  if (v.ro) return;
  const h0 = v.d.ajustes.horas.desde * 60, h1 = v.d.ajustes.horas.hasta * 60;
  const r = col.getBoundingClientRect();
  const inicio = Math.max(h0, Math.min(h1 - 60, h0 + Math.floor(((ev.clientY - r.top) / PX) * 2) * 30));
  const { local } = enviar('bloque.crear', { semana: v.id, bloque: { dia: +col.dataset.dia, inicio, fin: inicio + 60, tipo: tipoPorDefecto(v.d.tipos), titulo: 'Nuevo bloque' } });
  if (local?.id != null) requestAnimationFrame(() => abrirEditor(local.id, { nuevo: true }));
}

/** Arrastrar para mover (ajuste a 30 min y a día) o estirar desde el borde inferior; sin moverse = abrir editor. */
function empezarArrastre(ev, el) {
  if (ev.button !== 0) return;
  const v = modeloSemana();
  const id = +el.dataset.id;
  if (v.ro) { return; }
  const b = bloquePorId(id);
  if (!b) return;
  const estirar = ev.target.classList.contains('rs');
  const col = el.parentElement;
  const anchoCol = col.getBoundingClientRect().width + 4;
  const sx = ev.clientX, sy = ev.clientY;
  const altoInicial = el.getBoundingClientRect().height;
  let movido = false;
  el.setPointerCapture(ev.pointerId);
  ev.preventDefault();

  el.onpointermove = (mv) => {
    const dx = mv.clientX - sx, dy = mv.clientY - sy;
    if (!movido && Math.abs(dx) + Math.abs(dy) < 4) return;
    movido = true;
    el.classList.add('drag');
    if (estirar) el.style.height = `${Math.max(PX / 2, altoInicial + dy)}px`;
    else el.style.transform = `translate(${dx}px,${dy}px)`;
  };
  el.onpointerup = (up) => {
    el.onpointermove = el.onpointerup = null;
    if (!movido) { abrirEditor(id); return; }
    const h0 = v.d.ajustes.horas.desde * 60, h1 = v.d.ajustes.horas.hasta * 60;
    const dy = ((up.clientY - sy) / PX) * 60;
    const cambios = {};
    if (estirar) {
      cambios.fin = Math.max(b.inicio + 30, Math.min(h1, Math.round((b.fin + dy) / 30) * 30));
    } else {
      const largo = b.fin - b.inicio;
      cambios.dia = Math.max(0, Math.min(6, b.dia + Math.round((up.clientX - sx) / anchoCol)));
      cambios.inicio = Math.max(h0, Math.min(h1 - largo, Math.round((b.inicio + dy) / 30) * 30));
      cambios.fin = cambios.inicio + largo;
    }
    if (b.sugerido) cambios.sugerido = false; // mover una sugerencia es aceptarla
    const igual = Object.entries(cambios).every(([k, x]) => b[k] === x);
    if (igual) { pintarSemana(); return; }
    enviar('bloque.editar', { semana: v.id, id, huella: m.huellaDe(b), cambios });
  };
}

function textoLas3(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}

function guardarLas3(span) {
  const v = modeloSemana();
  const id = +span.closest('[data-las3]').dataset.las3;
  const o = v.las3.find((x) => x.id === id);
  if (!o) return;
  const texto = textoLas3(span);
  if (texto === o.texto) return;
  if (!texto) {
    enviar('las3.eliminar', { semana: v.id, id, huella: m.huellaDe(o) }, { mensaje: () => `«${o.texto}» quitado de Las 3` });
    return;
  }
  const cambios = { texto };
  if (!o.rel) cambios.rel = m.relDeTexto(texto, [...v.d.temas, ...v.d.proyectos].map((x) => x.nombre));
  enviar('las3.editar', { semana: v.id, id, huella: m.huellaDe(o), cambios });
}

export function iniciarSemana() {
  const raiz = $('#v-semana');
  on(raiz, 'click', '[data-accion]', (ev, el) => {
    const v = modeloSemana();
    switch (el.dataset.accion) {
      case 'anterior': irASemana(f.sumarSemanas(v.id, -1)); break;
      case 'siguiente': irASemana(f.sumarSemanas(v.id, 1)); break;
      case 'hoy': irASemana(v.d.meta.semanaActual); break;
      case 'ir-hoy': acciones.irA?.('hoy'); break;
      case 'semanas': acciones.semanas?.(); break;
      case 'proponer': acciones.proponer?.(v.id); break;
      case 'cerrar': acciones.cerrarSemana?.(v.id); break;
      case 'reabrir': {
        const n = f.numeroSemana(v.id), sig = f.numeroSemana(f.sumarSemanas(v.id, 1));
        enviar('semana.reabrir', { semana: v.id }, { mensaje: () => `Semana ${n} reabierta · la semana ${sig} sigue igual` });
        break;
      }
      default:
    }
  });
  on(raiz, 'dblclick', '.col', (ev, col) => { if (ev.target === col) crearEnHueco(col, ev); });
  on(raiz, 'pointerdown', '.blk', (ev, el) => empezarArrastre(ev, el));
  on(raiz, 'keydown', '.blk', (ev, el) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && !modeloSemana().ro) { ev.preventDefault(); abrirEditor(+el.dataset.id); }
  });
  // Las 3
  on(raiz, 'click', '[data-las3-marcar]', (ev, el) => {
    const v = modeloSemana();
    const id = +el.closest('[data-las3]').dataset.las3;
    const o = v.las3.find((x) => x.id === id);
    if (o && !v.ro) enviar('las3.editar', { semana: v.id, id, huella: m.huellaDe(o), cambios: { hecha: !o.hecha } });
  });
  raiz.addEventListener('focusout', (ev) => { if (ev.target.matches?.('[data-las3-texto]')) guardarLas3(ev.target); });
  on(raiz, 'keydown', '[data-las3-texto]', (ev, el) => {
    if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
    if (ev.key === 'Escape') {
      const o = modeloSemana().las3.find((x) => x.id === +el.closest('[data-las3]').dataset.las3);
      el.textContent = o?.texto ?? '';
      el.blur();
      ev.stopPropagation();
    }
  });
  on(raiz, 'keydown', '[data-las3-nueva]', (ev, el) => {
    if (ev.key !== 'Enter') return;
    const texto = el.value.replace(/\s+/g, ' ').trim();
    if (!texto) return;
    const v = modeloSemana();
    const rel = m.relDeTexto(texto, [...v.d.temas, ...v.d.proyectos].map((x) => x.nombre));
    enviar('las3.crear', { semana: v.id, texto, rel });
    requestAnimationFrame(() => $('[data-las3-nueva]')?.focus());
  });
}

export function semanaToast(mensaje) { toast(mensaje); }

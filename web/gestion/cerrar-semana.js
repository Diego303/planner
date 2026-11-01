// Gestión → Cerrar semana N: asistente de 4 pasos (Resumen · Pendientes · Proyectos y algún día · Nueva semana).
// Nada se arrastra en silencio: cada pendiente se decide con un botón y todo se aplica en una sola operación.
import { html, on, temaActual } from '../ui/dom.js';
import { abrirModal, cerrarModal, cabecera, cuerpoModal } from '../ui/modal.js';
import { st, enviar, derivados, irASemana, acciones, hoy } from '../estado.js';
import { api } from '../api.js';
import { toastError } from '../ui/toast.js';
import { entradaMenu, itemMenu } from './comun.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie } from '/core/color.js';
import { ritmo } from '/core/progreso.js';
import { redondearFactor, MIN_MUESTRAS } from '/core/factor.js';

const PASOS = ['Resumen', 'Pendientes', 'Proyectos y algún día', 'Nueva semana'];
let cw = null;

const h = (min) => f.horas(min);

function horasPorDefecto(x) {
  const sumar = cw.decision[`horas:${x.tema}`] === 'sumar';
  const faltaron = sumar ? (cw.datos.pendientes.find((p) => p.clave === `horas:${x.tema}`)?.minutos ?? 0) / 60 : 0;
  return { base: x.base, faltaron, valor: cw.horas[x.tema] ?? x.base + faltaron };
}

function pasoResumen(d) {
  const { resumen } = d;
  const fila = (n) => resumen.porTipo.find((x) => m.normalizar(x.tipo) === m.normalizar(n));
  const est = fila(m.tipoEstudio(derivados().tipos)) ?? { real: 0, plan: 0 };
  const pro = fila(m.tipoProyectos(derivados().tipos)) ?? { real: 0, bloques: 0 };
  const tarjetas = [
    ['Estudio', `${h(est.real)} h`, `plan ${h(est.plan)} h`],
    ['Proyectos', `${h(pro.real)} h`, `${pro.bloques} bloque${pro.bloques === 1 ? '' : 's'}`],
    ['Tareas', `${resumen.tareasHechas} hechas`, `${d.abiertasMasAdelante} en más adelante`],
    ['Ánimo', resumen.animo == null ? '—' : `${f.numero(resumen.animo)} / 5`, resumen.mejorDia ? `mejor: ${resumen.mejorDia.slice(0, 3)}` : 'sin diario'],
  ];
  const tema = temaActual();
  const colorEst = m.colorDeTipo(derivados().tipos, m.tipoEstudio(derivados().tipos));
  const fs = d.factores ?? {};
  const fe = fs[m.tipoEstudio(derivados().tipos)], fp = fs[m.tipoProyectos(derivados().tipos)];
  const fx = (x) => (x && x.muestras >= MIN_MUESTRAS ? `×${f.numero(redondearFactor(x.factor))}` : null);
  return html`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${tarjetas.map(([a, b, c]) => html`<div style="background:var(--superficie-2);border-radius:8px;padding:8px 10px"><div class="lab" style="margin:0">${a}</div><div style="font-size:16px;font-weight:500">${b}</div><div class="mut" style="font-size:10.5px">${c}</div></div>`)}</div>
<div style="margin-top:10px;font-size:12px">${d.estudio.filter((x) => x.objetivo || x.hecho).map((x) => html`<div style="display:grid;grid-template-columns:90px 1fr 60px;gap:8px;align-items:center;padding:3px 0"><span>${x.tema}</span><div style="height:6px;border-radius:3px;background:var(--superficie-2)"><div style="height:6px;border-radius:3px;width:${Math.min(100, (x.hecho / (x.objetivo || 1)) * 100)}%;background:${colorSerie(colorEst, tema)}"></div></div><span class="mut">${h(x.hecho)}/${h(x.objetivo)} h</span></div>`)}</div>
<div class="mut" style="font-size:11px;margin-top:8px">Las 3 de la semana: ${d.las3.hechas} de ${d.las3.total} ✓ · Se guarda en semanas/${d.id}.md</div>
<div class="recuadro" style="margin-top:12px">⏱ ${fx(fe) ? html`Tus bloques de estudio duraron <b style="font-weight:600">${fx(fe)}</b> de lo previsto (${fe.muestras} bloques)${fx(fp) ? html` y los de proyectos <b style="font-weight:600">${fx(fp)}</b>` : ''}. «Proponer» reservará ese margen.` : 'Aún no hay datos de lo que tardas de verdad: marca «Hecho ✓» en tus bloques y «Proponer» aprenderá.'}</div>
<label style="margin-top:14px;color:var(--texto);font-weight:500">Dos lecciones de la semana <span class="mut" style="font-weight:400">· 1 minuto, una línea cada una</span></label>
<input id="cw-funciono" data-cw="funciono" value="${cw.lecciones.funciono}" maxlength="200" placeholder="Qué funcionó…" style="width:100%;margin-bottom:6px" aria-label="Qué funcionó"><input id="cw-cambio" data-cw="cambio" value="${cw.lecciones.cambio}" maxlength="200" placeholder="Qué cambio la semana que viene…" style="width:100%" aria-label="Qué cambio la semana que viene">`;
}

function pasoPendientes(d) {
  return html`<div class="mut" style="font-size:11px;margin-bottom:4px">Decide qué hacer con cada cosa. Nada se arrastra en silencio: lo que no decidas se queda como está.</div>
${d.pendientes.length ? d.pendientes.map((p) => html`<div class="pend"><div>${p.titulo}<div class="mut" style="font-size:10.5px">${p.sub}</div></div><div class="opts">${p.opciones.map(([k, t]) => html`<button type="button" class="${cw.decision[p.clave] === k ? 'on' : ''}" aria-pressed="${(cw.decision[p.clave] === k) ? 'true' : 'false'}" data-decision="${p.clave}" data-opcion="${k}">${t}</button>`)}</div></div>`) : html`<div class="mut" style="font-size:12px;padding:10px 0">Nada pendiente ✓</div>`}`;
}

function pasoProyectos(d) {
  const tema = temaActual();
  const colorPro = colorSerie(m.colorDeTipo(derivados().tipos, m.tipoProyectos(derivados().tipos)), tema);
  const activos = d.proyectos.filter((p) => p.estado !== 'pausado' && cw.decision[`proyecto:${p.id}`] !== 'pausar');
  return html`<div class="lab">Cada proyecto con una siguiente acción</div>${activos.length ? activos.map((p) => html`<div class="pend"><span><span class="dot" style="background:${colorPro}"></span>${p.nombre}${p.parado ? html` <span class="aviso-texto" style="font-size:10.5px">· parado</span>` : ''}</span><input id="cw-pro-${p.id}" data-proyecto="${p.nombre}" value="${cw.proyectos[p.nombre] ?? p.siguiente}" style="font-size:11.5px;width:230px" aria-label="Siguiente paso de ${p.nombre}" ${cw.decision[`proyecto:${p.id}`] === 'cambiar' ? 'autofocus' : ''}></div>`) : html`<div class="mut" style="font-size:12px">Sin proyectos activos.</div>`}
<div class="lab" style="margin-top:12px">Algún día · repásalo, sin presión</div>${d.algunDia.length ? d.algunDia.map((t) => html`<div class="pend"><span><span class="dot" style="background:${colorSerie(m.colorDeTipo(derivados().tipos, t.tipo), tema)}"></span>${t.texto}</span><span class="mut" style="font-size:10.5px">sigue en algún día</span></div>`) : html`<div class="mut">Vacío</div>`}`;
}

function avisoRitmo(x) {
  const { base, faltaron, valor } = horasPorDefecto(x);
  if (faltaron) return html`<span class="aviso-texto" style="font-size:10.5px">te faltaron ${f.numero(faltaron)} h: esta semana ${f.numero(base)} + ${f.numero(faltaron)} = ${f.numero(base + faltaron)} h ⚠</span>`;
  const r = ritmo({ total: x.total, examen: x.examen }, x.acumulado, valor, cw.datos.nueva);
  if (!r) return '';
  const fecha = f.fechaCorta(x.examen);
  if (r.estado === 'llega') return html`<span class="mut" style="font-size:10.5px">a ${f.numero(valor)} h/sem llegas al ${fecha} ✓</span>`;
  if (r.estado === 'justo') return html`<span class="mut" style="font-size:10.5px">a ${f.numero(valor)} h/sem llegas justo al ${fecha}</span>`;
  return html`<span class="aviso-texto" style="font-size:10.5px">a ${f.numero(valor)} h/sem no llegas al ${fecha}: harían falta ${f.numero(r.necesarias)} h ⚠</span>`;
}

function pasoNueva(d) {
  const n = f.numeroSemana(d.nueva);
  const tema = temaActual();
  const colorEst = colorSerie(m.colorDeTipo(derivados().tipos, m.tipoEstudio(derivados().tipos)), tema);
  return html`<label>Las 3 de la semana ${n} · lo que hará que la semana haya merecido la pena</label>${cw.las3.map((o, i) => html`<div style="margin-bottom:10px"><input id="cw-l3-${i}" data-l3="${i}" data-campo="texto" value="${o.texto}" maxlength="140" style="width:100%;font-size:12.5px" placeholder="${['La más importante…', 'La segunda…', 'La tercera…'][i]}" aria-label="Objetivo ${i + 1}"><div style="display:flex;gap:5px;margin-top:4px;align-items:center"><span class="mut" style="font-size:11px">si</span><input id="cw-si-${i}" data-l3="${i}" data-campo="si" value="${o.si}" placeholder="obstáculo probable (opcional)" style="flex:1;font-size:11.5px" aria-label="Si (obstáculo)"><span class="mut" style="font-size:11px">→</span><input id="cw-en-${i}" data-l3="${i}" data-campo="entonces" value="${o.entonces}" placeholder="entonces haré…" style="flex:1;font-size:11.5px" aria-label="Entonces haré"></div></div>`)}
<div style="font-size:11.5px;margin-top:8px">${d.siguiente.horas.map((x) => html`<div class="pend"><span><span class="dot" style="background:${colorEst}"></span>${x.tema} ${avisoRitmo(x)}</span><span><input id="cw-h-${m.normalizar(x.tema).replace(/\W/g, '')}" type="number" data-horas="${x.tema}" value="${horasPorDefecto(x).valor}" min="0" max="40" step="0.5" style="width:56px;font-size:11.5px" aria-label="Horas de ${x.tema}"> h</span></div>`)}</div>`;
}

function contenido() {
  const d = cw.datos;
  const pasos = [pasoResumen, pasoPendientes, pasoProyectos, pasoNueva];
  const fin = cw.paso === 3;
  return html`${cabecera(`Cerrar semana ${f.numeroSemana(d.id)} · ${PASOS[cw.paso]}`)}<div class="steps">${PASOS.map((_, i) => html`<span class="${i <= cw.paso ? 'on' : ''}"></span>`)}</div>
${pasos[cw.paso](d)}
<div class="nav-modal"><button type="button" data-paso-cw="-1" ${cw.paso === 0 ? 'disabled' : ''}>← atrás</button>${fin
    ? html`<button type="button" data-cerrar-final style="background:var(--resalte);color:var(--acento-texto);border-color:var(--resalte)" ${st.caido ? 'disabled' : ''}>Cerrar y planificar la semana ${f.numeroSemana(d.nueva)}</button>`
    : html`<button type="button" data-paso-cw="1">siguiente →</button>`}</div>`;
}

function pintarPaso() {
  abrirModal(contenido(), { etiqueta: `Cerrar semana ${f.numeroSemana(cw.datos.id)}`, onCerrar: () => { cw = null; } });
  enlazar();
}

function enlazar() {
  const mod = cuerpoModal();
  on(mod, 'click', '[data-paso-cw]', (_ev, el) => { cw.paso = Math.max(0, Math.min(3, cw.paso + +el.dataset.pasoCw)); pintarPaso(); });
  on(mod, 'click', '[data-decision]', (_ev, el) => {
    const k = el.dataset.decision;
    cw.decision[k] = cw.decision[k] === el.dataset.opcion ? undefined : el.dataset.opcion;
    pintarPaso();
  });
  on(mod, 'input', '[data-cw]', (_ev, el) => { cw.lecciones[el.dataset.cw] = el.value; });
  on(mod, 'input', '[data-proyecto]', (_ev, el) => { cw.proyectos[el.dataset.proyecto] = el.value; });
  on(mod, 'input', '[data-l3]', (_ev, el) => { cw.las3[+el.dataset.l3][el.dataset.campo] = el.value; });
  on(mod, 'change', '[data-horas]', (_ev, el) => {
    const v = parseFloat(String(el.value).replace(',', '.'));
    if (Number.isFinite(v) && v >= 0) cw.horas[el.dataset.horas] = v;
    pintarPaso();
  });
  on(mod, 'click', '[data-cerrar-final]', terminar);
}

function terminar() {
  const d = cw.datos;
  const decisiones = d.pendientes.filter((p) => cw.decision[p.clave]).map((p) => ({
    clase: p.clase, id: p.id, huella: p.huella, tema: p.tema, minutos: p.minutos, nombre: p.nombre, opcion: cw.decision[p.clave],
  }));
  const nombres = [...derivados().temas, ...derivados().proyectos].map((x) => x.nombre);
  const horas = Object.fromEntries(d.siguiente.horas.map((x) => [x.tema, horasPorDefecto(x).valor]));
  const args = {
    semana: d.id, lecciones: cw.lecciones, decisiones,
    proyectos: Object.entries(cw.proyectos).map(([nombre, siguiente]) => ({ nombre, siguiente })),
    siguiente: { las3: cw.las3.filter((o) => o.texto.trim()).map((o) => ({ ...o, rel: o.rel || m.relDeTexto(o.texto, nombres) })), horas },
  };
  const n = f.numeroSemana(d.id), nueva = d.nueva;
  cerrarModal();
  const { respuesta } = enviar('semana.cerrar', args, {
    mensaje: (r) => (r.nuevaCerrada
      ? `Semana ${n} cerrada · la ${f.numeroSemana(nueva)} ya está cerrada: no se toca`
      : `Semana ${n} cerrada · ${r.n} sugerencia${r.n === 1 ? '' : 's'} para la ${f.numeroSemana(nueva)} (lo que ya tenía se queda)`),
  });
  respuesta.then((r) => { if (r) { acciones.irA('semana'); irASemana(nueva); } });
}

export async function abrirCierre(id) {
  try {
    const datos = await api.cierre({ semana: id, hoy: hoy() });
    if (datos.estado === 'cerrada') { toastError(`La semana ${f.numeroSemana(id)} ya está cerrada`); return; }
    const vacias = Array.from({ length: 3 }, (_, i) => datos.siguiente.las3[i] ?? { texto: '', rel: null, si: '', entonces: '' });
    cw = { datos, paso: 0, lecciones: { ...datos.lecciones }, decision: {}, proyectos: {}, las3: vacias.map((o) => ({ ...o })), horas: {} };
    pintarPaso();
  } catch (e) {
    toastError(`No se pudo preparar el cierre: ${e.message}`);
  }
}

acciones.cerrarSemana = abrirCierre;

/** Semana que ofrece el menú: la pendiente más antigua, o la actual si es sábado o domingo. */
function semanaACerrar(d) {
  if (d.meta.pendientes.length) return d.meta.pendientes[0];
  const actual = d.meta.semanas.find((s) => s.id === d.meta.semanaActual);
  return f.diaSemana(d.meta.hoy) >= 5 && actual && actual.estado !== 'cerrada' ? d.meta.semanaActual : null;
}

entradaMenu({
  id: 'cerrar', orden: 20,
  pintar: (d) => {
    const id = semanaACerrar(d);
    return id
      ? itemMenu('cerrar', `Cerrar semana ${f.numeroSemana(id)}`, d.meta.pendientes.length ? html`<span class="dot" style="background:var(--aviso);margin:0"></span>` : '')
      : html`<div class="it off" role="menuitem" aria-disabled="true"><span>Todas las semanas cerradas</span><span>✓</span></div>`;
  },
  accion: () => { const id = semanaACerrar(derivados()); if (id) abrirCierre(id); },
});

entradaMenu({ id: 'sep-1', orden: 25, pintar: () => html`<div class="sep"></div>`, accion: () => {} });

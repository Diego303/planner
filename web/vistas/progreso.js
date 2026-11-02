// Pestaña Progreso (ancho completo, sin cajón): certificaciones, plan frente a real, constancia, ánimo y lecciones.
import { html, $, pintar, temaActual } from '../ui/dom.js';
import { derivados } from '../estado.js';
import { vistas } from '../app.js';
import { sparkline, bullet, planReal, rejilla } from '../ui/graficos.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { colorSerie, tono } from '/core/color.js';
import { redondearFactor, MIN_MUESTRAS } from '/core/factor.js';

const h = (min) => f.horas(min);

function certificaciones(p, d, tema) {
  const base = m.colorDeTipo(d.tipos, m.tipoEstudio(d.tipos));
  const color = colorSerie(base, tema);
  const verde = colorSerie(m.colorDeTipo(d.tipos, m.tipoProyectos(d.tipos)), tema);
  const filas = p.certificaciones.map((c) => {
    const total = (c.total ?? 0) * 60;
    const max8 = Math.max(c.horasSemana + 2, ...c.horas8.map((x) => x / 60), 1);
    const texto = c.soloSemanal
      ? html`<span class="mut">solo horas semanales · añade <b>total</b> y <b>examen</b> en estudio.md para ver el ritmo</span>`
      : html`<span>${c.encuadre === 'llevas' ? html`llevas <b style="font-weight:600">${h(c.acumulado)} h</b> de ${c.total}` : html`te faltan <b style="font-weight:600">${h(Math.max(0, total - c.acumulado))} h</b> de ${c.total}`}</span><span class="${c.diferencia >= 0 ? 'ok-texto' : 'aviso-texto'}" style="font-size:11.5px">${c.diferencia >= 0 ? `+${h(c.diferencia)} h sobre lo previsto` : `${h(-c.diferencia)} h por detrás`}</span>`;
    return html`<div style="display:grid;grid-template-columns:120px minmax(0,1fr) 150px 150px;gap:18px;align-items:center;padding:14px 0;border-top:1px solid var(--linea)">
<div><div style="font-weight:600">${c.nombre}</div><div class="mut" style="font-size:11px">${c.examen ? `examen ${f.fechaCorta(c.examen)}` : 'sin examen'}</div></div>
<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">${texto}</div>${c.soloSemanal ? '' : html`${bullet({ valor: c.acumulado, esperado: c.esperado, total, color, zona: tono(base, tema, 0.18) })}<div class="mut" style="font-size:10.5px;margin-top:5px">barra = hecho · zona clara y marca = donde deberías ir hoy</div>`}</div>
<div><div class="mut" style="font-size:10.5px;margin-bottom:3px">horas · 8 semanas</div>${sparkline(c.horas8.map((x) => x / 60), 140, 32, { barras: true, max: max8, color, colorSuave: tono(base, tema, 0.45), etiqueta: `horas de ${c.nombre} en 8 semanas` })}</div>
<div><div class="mut" style="font-size:10.5px;margin-bottom:3px">${c.simulacros.length ? html`simulacros · último <b style="color:var(--texto)">${c.simulacros.at(-1)} %</b>` : 'simulacros'}</div>${c.simulacros.length ? sparkline(c.simulacros, 120, 32, { min: 40, max: 100, ref: 70, refEtiqueta: '70', color: verde, etiqueta: `simulacros de ${c.nombre}` }) : html`<div class="aviso-texto" style="font-size:11.5px;padding:8px 0">◎ ninguno todavía${c.sinSimulacro != null ? ` · hace ${c.sinSimulacro} sem que no` : ''}</div>`}</div></div>`;
  });
  return html`<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:16px;font-weight:600;letter-spacing:-.01em">Certificaciones y curso</span><span class="mut" style="font-size:11.5px">se actualiza al marcar «Hecho» · sale de tus ficheros, sin IA</span></div>${filas.length ? filas : html`<div class="mut" style="padding:12px 0">Añade un tema de estudio en Metas para ver su progreso.</div>`}</div>`;
}

function planYFactor(p, d, tema) {
  const max = Math.max(1, ...p.planReal.map((x) => Math.max(x.plan, x.real)));
  const fs = d.meta.factores ?? {};
  const orden = (k) => { const i = d.tipos.findIndex((t) => m.normalizar(t.nombre) === m.normalizar(k)); return i < 0 ? 99 : i; };
  const tarjetas = Object.entries(fs).filter(([k, x]) => !m.esTrabajo(d.tipos, k) && x.muestras > 0).sort(([a], [b]) => orden(a) - orden(b)).slice(0, 3);
  const fe = fs[m.tipoEstudio(d.tipos)];
  const reserva = fe && fe.muestras >= MIN_MUESTRAS ? Math.min(150, Math.round((90 * fe.factor) / 30) * 30) : 90;
  return html`<div class="card"><div class="lab">Plan frente a real · ${p.ultimaCerrada ? `semana ${f.numeroSemana(p.ultimaCerrada)}` : 'sin semanas cerradas'}</div>
${p.planReal.map((x) => {
    const base = m.colorDeTipo(d.tipos, x.tipo);
    return html`<div style="display:grid;grid-template-columns:96px minmax(0,1fr) 70px;gap:10px;align-items:center;padding:6px 0"><span data-plan-tipo title="${x.tipo}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="dot" style="background:${colorSerie(base, tema)}"></span>${x.tipo}</span>${planReal({ plan: x.plan, real: x.real, max, color: colorSerie(base, tema), contorno: tono(base, tema, 0.55) })}<span class="mut" style="font-size:11.5px;text-align:right">${h(x.real)} / ${h(x.plan)} h</span></div>`;
  })}${p.planReal.length ? '' : html`<div class="mut" style="font-size:12px">Cierra una semana para comparar lo planificado con lo hecho.</div>`}
<div class="mut" style="font-size:10.5px;margin:4px 0 12px">contorno = planificado · relleno = hecho</div>
<div class="lab">Lo que tardas de verdad</div><div style="display:flex;gap:8px">${tarjetas.map(([tipo, x]) => html`<div class="recuadro" style="flex:1;padding:9px 11px"><div class="mut" style="font-size:11px">${tipo}</div><div style="font-size:18px;font-weight:600;letter-spacing:-.01em">${x.muestras >= MIN_MUESTRAS ? `×${f.numero(redondearFactor(x.factor))}` : '×1'}</div><div class="mut" style="font-size:10.5px">${x.muestras >= MIN_MUESTRAS ? `${x.muestras} bloques` : 'aún no hay datos'}</div></div>`)}</div>
<div class="mut" style="font-size:11px;margin-top:8px">Si planificas 1,5 h de estudio, «Proponer» reserva ${f.numero(reserva / 60)} h.</div></div>`;
}

function constancia(p, d, tema) {
  const base = m.colorDeTipo(d.tipos, m.tipoEstudio(d.tipos));
  const lleno = Math.max(1, p.meta || 6) * 60;
  const celdas = p.rejilla.map((c) => ({
    ...c, fondo: c.futura ? '' : tono(base, tema, 0.15 + Math.min(1, (c.minutos ?? 0) / lleno) * 0.75),
    titulo: `semana ${f.numeroSemana(c.id)}${c.minutos != null ? ` · ${h(c.minutos)} h` : ''}`,
  }));
  const iActual = p.rejilla.findIndex((c) => c.actual);
  const desde = p.rejilla[0] ? f.fechaCorta(f.lunesDe(p.rejilla[0].id)) : '';
  const color = colorSerie(base, tema);
  return html`<div class="card"><div class="lab">Constancia · ${p.rejilla.length} semanas desde el ${desde}</div>${rejilla(celdas)}
<div class="mut" style="font-size:10.5px;display:flex;justify-content:space-between;margin-top:4px"><span>sem 1</span><span>hoy · sem ${iActual + 1}</span><span>sem ${p.rejilla.length}</span></div>
<div class="lab" style="margin-top:16px">Estudio total por semana · 8 semanas</div>${sparkline(p.estudio8.map((x) => x / 60), 300, 44, { barras: true, ref: p.meta || null, refEtiqueta: `meta ${f.numero(p.meta)} h`, color, colorSuave: tono(base, tema, 0.45), etiqueta: 'estudio total por semana' })}
<div style="font-size:12px;margin-top:10px">${p.semanasConEstudio} de 7 semanas con estudio. <span class="mut">Sin rachas: una semana floja no borra nada.</span></div></div>`;
}

function animo(p, d, tema) {
  const verde = colorSerie(m.colorDeTipo(d.tipos, m.tipoProyectos(d.tipos)) ?? '', tema);
  const color = colorSerie(m.colorDeTipo(d.tipos, m.tipoEstudio(d.tipos)), tema);
  const c = p.comparacion;
  return html`<div class="card"><div class="lab">Ánimo y horas de estudio · 8 semanas</div><div style="display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center;font-size:11.5px"><span class="mut">ánimo</span>${sparkline(p.animo8, 260, 34, { min: 1, max: 5, color: verde, etiqueta: 'ánimo medio por semana' })}<span class="mut">estudio</span>${sparkline(p.estudio8.map((x) => x / 60), 260, 34, { color, etiqueta: 'horas de estudio por semana' })}</div>
${c ? html`<div style="font-size:12px;margin-top:12px">Semanas con ${h(c.mediana)} h o más de estudio: ánimo medio <b style="font-weight:600">${c.conMas == null ? '—' : f.numero(c.conMas)}</b> · con menos: <b style="font-weight:600">${c.conMenos == null ? '—' : f.numero(c.conMenos)}</b>.</div><div class="mut" style="font-size:10.5px;margin-top:4px">Es una correlación, no una causa. Sirve para fijarte.</div>` : html`<div class="mut" style="font-size:12px;margin-top:12px">Cierra algunos días (ánimo en el diario) para comparar.</div>`}</div>`;
}

function lecciones(p) {
  return html`<div class="card"><div class="lab">Lecciones · de cada cierre de semana</div>${p.lecciones.length ? p.lecciones.map((l) => html`<div style="padding:8px 0;border-top:1px solid var(--linea);font-size:12.5px"><div class="mut" style="font-size:11px">semana ${f.numeroSemana(l.semana)}</div>${l.funciono ? html`<div><span class="ok-texto">✓</span> ${l.funciono}</div>` : ''}${l.cambio ? html`<div><span class="aviso-texto">→</span> ${l.cambio}</div>` : ''}</div>`) : html`<div class="mut" style="font-size:12px">Aparecerán al cerrar semanas.</div>`}</div>`;
}

export function pintarProgreso() {
  const d = derivados(), p = d.meta.progreso, tema = temaActual();
  if (!p) return;
  pintar($('#v-progreso'), html`<div style="display:flex;flex-direction:column;gap:14px">${certificaciones(p, d, tema)}
<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">${planYFactor(p, d, tema)}${constancia(p, d, tema)}</div>
<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">${animo(p, d, tema)}${lecciones(p)}</div></div>`);
}

vistas.progreso = { titulo: 'Progreso', pintar: pintarProgreso };

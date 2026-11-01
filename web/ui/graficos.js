// Gráficos de Progreso (Few): sparklines, barras, bullet graph y rejilla. Sin tartas ni velocímetros.
// Líneas de referencia con --texto-3; series con el color del tipo (que llega ya calculado por core/color.js).
import { html, raw } from './dom.js';

const n2 = (x) => Math.round(x * 10) / 10;

/**
 * Sparkline o barras en SVG.
 * o = { min, max, ref, refEtiqueta, barras, color, colorSuave }
 */
export function sparkline(valores, ancho, alto, o = {}) {
  const vs = valores.map((v) => (v == null ? null : v));
  const definidos = vs.filter((v) => v != null);
  const max = o.max ?? Math.max(...definidos, o.ref ?? 0, 1);
  const min = o.min ?? 0;
  const n = vs.length;
  const X = (i) => (n < 2 ? ancho / 2 : 3 + (i * (ancho - 6)) / (n - 1));
  const Y = (v) => alto - 3 - ((Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (alto - 6);
  let cuerpo = '';
  if (o.ref != null) {
    cuerpo += `<line x1="0" x2="${ancho}" y1="${n2(Y(o.ref))}" y2="${n2(Y(o.ref))}" style="stroke:var(--texto-3)" stroke-dasharray="3 3"/>`;
    cuerpo += `<text x="${ancho + 4}" y="${n2(Y(o.ref) + 3)}" font-size="9" style="fill:var(--texto-3)">${o.refEtiqueta ?? o.ref}</text>`;
  }
  if (o.barras) {
    cuerpo += vs.map((v, i) => (v == null ? '' : `<rect x="${n2(X(i) - 3)}" y="${n2(Y(v))}" width="6" height="${n2(alto - 3 - Y(v))}" rx="1.5" style="fill:${i === n - 1 ? o.color : o.colorSuave ?? o.color}"/>`)).join('');
  } else if (definidos.length) {
    // tramos continuos entre semanas con dato
    let tramo = [];
    const tramos = [];
    vs.forEach((v, i) => { if (v == null) { if (tramo.length) tramos.push(tramo); tramo = []; } else tramo.push(`${n2(X(i))},${n2(Y(v))}`); });
    if (tramo.length) tramos.push(tramo);
    cuerpo += tramos.map((t) => (t.length > 1 ? `<polyline points="${t.join(' ')}" fill="none" style="stroke:${o.color}" stroke-width="1.6" stroke-linejoin="round"/>` : `<circle cx="${t[0].split(',')[0]}" cy="${t[0].split(',')[1]}" r="1.8" style="fill:${o.color}"/>`)).join('');
    const ultimo = vs.map((v, i) => [v, i]).filter(([v]) => v != null).at(-1);
    cuerpo += `<circle cx="${n2(X(ultimo[1]))}" cy="${n2(Y(ultimo[0]))}" r="2.6" style="fill:${o.color}"/>`;
  }
  return raw(`<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" style="display:block;overflow:visible" role="img" aria-label="${o.etiqueta ?? 'gráfico'}">${cuerpo}</svg>`);
}

/** Bullet graph: relleno = hecho; zona clara y marca = donde deberías ir hoy. Valores en las mismas unidades. */
export function bullet({ valor, esperado, total, color, zona }) {
  const pct = (x) => `${Math.min(100, Math.max(0, (x / (total || 1)) * 100))}%`;
  return html`<div style="position:relative;height:12px;border-radius:3px;background:var(--linea)" role="img" aria-label="hecho ${Math.round(valor / 60)} h de ${Math.round(total / 60)} h">
${esperado != null ? html`<div style="position:absolute;left:0;top:0;bottom:0;width:${pct(esperado)};background:${zona};border-radius:3px"></div>` : ''}
<div style="position:absolute;left:0;top:3px;height:6px;width:${pct(valor)};background:${color};border-radius:2px"></div>
${esperado != null ? html`<div title="donde deberías ir hoy" style="position:absolute;left:${pct(esperado)};top:-3px;bottom:-3px;width:2px;background:var(--texto)"></div>` : ''}</div>`;
}

/** Barra de plan frente a real: contorno = planificado, relleno = hecho. */
export function planReal({ plan, real, max, color, contorno }) {
  const pct = (x) => `${(x / (max || 1)) * 100}%`;
  return html`<div style="position:relative;height:14px"><div style="position:absolute;left:0;top:0;height:14px;width:${pct(plan)};border:1.5px dashed ${contorno};border-radius:4px;box-sizing:border-box"></div><div style="position:absolute;left:0;top:3px;height:8px;width:${pct(real)};background:${color};border-radius:3px"></div></div>`;
}

/** Rejilla de constancia: una celda por semana; intensidad ya calculada (`fondo`), actual con contorno, futuras discontinuas. */
export function rejilla(celdas) {
  return html`<div style="display:grid;grid-template-columns:repeat(${celdas.length},1fr);gap:4px">${celdas.map((c) => html`<div title="${c.titulo}" style="aspect-ratio:1;border-radius:5px;${raw(c.futura ? 'border:1px dashed var(--borde)' : `background:${c.fondo}`)};${raw(c.actual ? 'outline:2px solid var(--texto);outline-offset:1px' : '')}"></div>`)}</div>`;
}

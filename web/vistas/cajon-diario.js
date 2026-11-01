// Pestaña «Diario» del cajón: ánimo de los últimos 7 días y las últimas líneas escritas.
import { html } from '../ui/dom.js';
import { st, derivados } from '../estado.js';
import { pestanasCajon } from '../ui/cajon.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';

/** Entradas del diario cargadas (últimos 56 días): [{ fecha, animo, linea, … }] de la más reciente a la más antigua. */
export function entradasDiario() {
  return Object.entries(st.datos.ficheros)
    .filter(([r, doc]) => r.startsWith('diario/') && doc)
    .map(([r, doc]) => ({ fecha: r.slice(7, -3), ...m.diarioDe(doc) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

pestanasCajon.diario = {
  titulo: 'Diario',
  pintar() {
    const d = derivados();
    const entradas = entradasDiario();
    const porFecha = Object.fromEntries(entradas.map((e) => [e.fecha, e]));
    const dias = Array.from({ length: 7 }, (_, i) => f.sumarDias(d.meta.hoy, i - 6));
    const conAnimo = dias.map((x) => porFecha[x]).filter((e) => e?.animo != null);
    const media = conAnimo.length ? conAnimo.reduce((s, e) => s + e.animo, 0) / conAnimo.length : null;
    const mejor = conAnimo.length ? conAnimo.reduce((a, b) => (b.animo > a.animo ? b : a)) : null;
    const lineas = entradas.filter((e) => e.linea).slice(0, 3);
    return html`<div class="lab">Últimos 7 días</div>
<div class="dias7">${dias.map((x) => {
      const e = porFecha[x];
      return html`<div title="${f.fechaLarga(x)}${e?.animo ? ` · ánimo ${e.animo}` : ' · sin cierre'}"><div class="circulo" ${e?.animo ? html`data-animo="${e.animo}"` : ''}></div><span class="mut" style="font-size:11px">${f.DIAS[f.diaSemana(x)]}</span></div>`;
    })}</div>
<div style="font-size:12.5px;margin-top:14px;line-height:1.5">
${media != null ? html`<div class="mut" style="font-size:12px">Ánimo medio ${f.numero(media)} · mejor día: ${f.NOMBRES_DIA[f.diaSemana(mejor.fecha)]}</div>` : html`<div class="mut" style="font-size:12px">Sin cierres del día esta semana.</div>`}
${lineas.map((e) => html`<div style="margin-top:10px"><span class="mut">${f.capitalizar(f.NOMBRES_DIA[f.diaSemana(e.fecha)])}${e.fecha < f.sumarDias(d.meta.hoy, -6) ? ` ${+e.fecha.slice(8)}/${+e.fecha.slice(5, 7)}` : ''}</span><br>«${e.linea}»</div>`)}
</div>`;
  },
};

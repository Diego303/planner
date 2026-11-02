// Pestaña «Diario» del cajón: ánimo de los últimos 7 días y las últimas líneas escritas.
import { html, on, $ } from '../ui/dom.js';
import { st, derivados, enviar } from '../estado.js';
import { pestanasCajon, pintarCajon } from '../ui/cajon.js';

let editandoDia = null; // fecha del diario que se está editando (hoy o anterior)

/** Formulario del diario de un día: ánimo, una línea y «mañana empiezo por». */
function formularioDia(fecha, e) {
  return html`<div class="frm" data-form-diario style="margin-top:10px"><div class="lab" style="margin:0">${f.capitalizar(f.fechaLarga(fecha))}</div>
<div class="mood" role="radiogroup" aria-label="Ánimo de 1 a 5">${[1, 2, 3, 4, 5].map((n) => html`<button type="button" role="radio" aria-checked="${e?.animo === n ? 'true' : 'false'}" class="${e?.animo === n ? 'on' : ''}" data-dia-animo="${n}">${n}</button>`)}</div>
<input id="ed-linea" value="${e?.linea ?? ''}" placeholder="una línea para tu diario" aria-label="Línea del diario" autocomplete="off">
<input id="ed-manana" value="${e?.manana ?? ''}" placeholder="al día siguiente empiezo por…" aria-label="Empiezo por" autocomplete="off">
<div class="pie"><button type="button" class="dark" data-guardar-diario>Guardar</button><button type="button" data-cancelar-diario>Cancelar</button></div></div>`;
}
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
      return html`<button type="button" class="dia7 ${editandoDia === x ? 'on' : ''}" data-editar-dia="${x}" aria-label="Diario del ${f.fechaLarga(x)}${e?.animo ? ` · ánimo ${e.animo}` : ' · sin cierre'} · editar" title="${f.fechaLarga(x)}${e?.animo ? ` · ánimo ${e.animo}` : ' · sin cierre'} · pulsa para editarlo"><div class="circulo" ${e?.animo ? html`data-animo="${e.animo}"` : ''}></div><span class="mut" style="font-size:11px">${f.DIAS[f.diaSemana(x)]}</span></button>`;
    })}</div>${editandoDia ? formularioDia(editandoDia, porFecha[editandoDia]) : html`<div class="mut" style="font-size:10.5px;margin-top:4px">Pulsa un día para escribir o cambiar su diario.</div>`}
<div style="font-size:12.5px;margin-top:14px;line-height:1.5">
${media != null ? html`<div class="mut" style="font-size:12px">Ánimo medio ${f.numero(media)} · mejor día: ${f.NOMBRES_DIA[f.diaSemana(mejor.fecha)]}</div>` : html`<div class="mut" style="font-size:12px">Sin cierres del día esta semana.</div>`}
${lineas.map((e) => html`<div style="margin-top:10px"><span class="mut">${f.capitalizar(f.NOMBRES_DIA[f.diaSemana(e.fecha)])}${e.fecha < f.sumarDias(d.meta.hoy, -6) ? ` ${+e.fecha.slice(8)}/${+e.fecha.slice(5, 7)}` : ''}</span><br>«${e.linea}»</div>`)}
</div>`;
  },
  iniciar(raiz) {
    let animo;
    on(raiz, 'click', '[data-editar-dia]', (_ev, el) => {
      editandoDia = editandoDia === el.dataset.editarDia ? null : el.dataset.editarDia;
      animo = undefined;
      pintarCajon();
      $('#ed-linea')?.focus();
    });
    on(raiz, 'click', '[data-dia-animo]', (_ev, el) => {
      animo = +el.dataset.diaAnimo;
      for (const b of raiz.querySelectorAll('[data-dia-animo]')) { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', b === el ? 'true' : 'false'); }
    });
    on(raiz, 'click', '[data-cancelar-diario]', () => { editandoDia = null; pintarCajon(); });
    const guardar = () => {
      const fecha = editandoDia;
      editandoDia = null;
      const args = { fecha, linea: $('#ed-linea').value.trim(), manana: $('#ed-manana').value.trim() };
      if (animo !== undefined) args.animo = animo;
      enviar('diario.editar', args, { mensaje: () => `Diario del ${f.fechaLarga(fecha)} guardado` });
    };
    on(raiz, 'click', '[data-guardar-diario]', guardar);
    on(raiz, 'keydown', '[data-form-diario] input', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); guardar(); }
      if (ev.key === 'Escape') { ev.stopPropagation(); editandoDia = null; pintarCajon(); }
    });
  },
};

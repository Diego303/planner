// Pestaña «Hoy» del cajón: ahora / después, tareas de hoy y «Abrir Hoy →».
import { html, on } from '../ui/dom.js';
import { derivados, enviar, ahora, acciones } from '../estado.js';
import { pestanasCajon } from '../ui/cajon.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';

/** Bloques de hoy (sin sugerencias) ordenados, el actual y el siguiente. */
export function agendaDeHoy(d, minuto = ahora()) {
  const dia = f.diaSemana(d.meta.hoy);
  const bloques = m.bloquesDe(d.actualDoc).filter((b) => b.dia === dia && !b.sugerido).sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  return {
    dia, bloques,
    ahora: bloques.find((b) => minuto >= b.inicio && minuto < b.fin) ?? null,
    despues: bloques.find((b) => b.inicio > minuto) ?? null,
  };
}

export const tareaVencida = (t, hoy) => !t.hecha && t.fecha && t.fecha < hoy;

pestanasCajon.hoy = {
  titulo: 'Hoy',
  pintar() {
    const d = derivados();
    const a = agendaDeHoy(d);
    const abiertas = d.tareas.hoy.filter((t) => !t.hecha).length;
    const dia = `${f.capitalizar(f.NOMBRES_DIA[a.dia])} ${+d.meta.hoy.slice(8)}`;
    return html`<div class="mut" style="font-size:12px">${dia} · ahora</div>
<div class="ahora-titulo">${a.ahora ? a.ahora.titulo : 'Libre'} <span>${a.ahora ? `hasta ${f.horaCorta(a.ahora.fin)}` : ''}</span></div>
<div class="mut" style="font-size:12px;margin-bottom:14px">${a.despues ? `Después: ${a.despues.titulo} · ${f.horaCorta(a.despues.inicio)}` : ''}</div>
<div style="display:flex;justify-content:space-between"><span class="lab">Tareas</span><span class="mut" style="font-size:12px">${abiertas}/${d.ajustes.tareas_hoy}</span></div>
${d.tareas.hoy.map((t) => html`<div class="task ${t.hecha ? 'done' : ''}" style="grid-template-columns:18px 1fr" data-tarea-cajon="${t.id}"><button type="button" class="cb ${t.hecha ? 'on' : ''}" aria-label="${t.hecha ? 'Desmarcar' : 'Marcar como hecha'}: ${t.texto}">${t.hecha ? '✓' : ''}</button><span class="tx">${t.prioridad ? html`<b class="peligro-texto">! </b>` : ''}${t.texto}${tareaVencida(t, d.meta.hoy) ? html` <span class="peligro-texto" style="font-size:11px">vencida</span>` : ''}</span></div>`)}
${d.tareas.hoy.length ? '' : html`<div class="vacio" style="padding:8px 0">Nada para hoy.</div>`}
<button type="button" class="add" style="margin-top:10px" data-abrir-hoy>Abrir Hoy →</button>`;
  },
  iniciar(raiz) {
    on(raiz, 'click', '[data-tarea-cajon]', (_ev, el) => {
      const t = derivados().tareas.hoy.find((x) => x.id === +el.dataset.tareaCajon);
      if (t) enviar('tarea.marcar', { id: t.id, huella: m.huellaDe(t), hecha: !t.hecha });
    });
    on(raiz, 'click', '[data-abrir-hoy]', () => acciones.irA?.('hoy'));
  },
};

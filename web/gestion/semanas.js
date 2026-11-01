// Gestión → Semanas: −4…+5 semanas con su estado y acciones (ver, planificar, reabrir, cerrar).
import { html, on } from '../ui/dom.js';
import { abrirModal, cerrarModal, cabecera, cuerpoModal } from '../ui/modal.js';
import { derivados, irASemana, enviar, acciones, st } from '../estado.js';
import { entradaMenu, itemMenu } from './comun.js';
import * as f from '/core/fechas.js';
import { ICONO_ESTADO } from '/core/semanas.js';

function contenido() {
  const d = derivados();
  const actual = d.meta.semanaActual;
  return html`${cabecera('Semanas')}<div class="mut mod-nota">Cada semana es un fichero (semanas/${actual}.md). Abre cualquiera: las pasadas para consultar o reabrir, las futuras para planificar con tiempo.</div>
${d.meta.semanas.map(({ id, estado }) => html`<div class="pend" style="${id === st.ui.semana ? 'font-weight:500' : ''}"><span>${ICONO_ESTADO[estado]} Semana ${f.numeroSemana(id)} <span class="mut" style="font-size:10.5px">${f.rangoSemana(id)} · ${estado}</span></span><span class="opts"><button type="button" data-ir="${id}" class="${id === st.ui.semana ? 'on' : ''}">${id < actual ? 'ver' : id === actual ? 'hoy' : 'planificar'}</button>${estado === 'cerrada' ? html`<button type="button" data-reabrir="${id}">reabrir</button>` : ''}${(estado === 'sin cerrar' || estado === 'reabierta') && acciones.cerrarSemana ? html`<button type="button" data-cerrar="${id}">cerrar</button>` : ''}</span></div>`)}`;
}

export function abrirSemanas() {
  abrirModal(contenido(), { etiqueta: 'Semanas' });
  const mod = cuerpoModal();
  on(mod, 'click', '[data-ir]', (_ev, el) => { cerrarModal(); acciones.irA('semana'); irASemana(el.dataset.ir); });
  on(mod, 'click', '[data-reabrir]', (_ev, el) => {
    const id = el.dataset.reabrir;
    cerrarModal();
    enviar('semana.reabrir', { semana: id }, { mensaje: () => `Semana ${f.numeroSemana(id)} reabierta · la semana ${f.numeroSemana(f.sumarSemanas(id, 1))} sigue igual` });
    acciones.irA('semana');
    irASemana(id);
  });
  on(mod, 'click', '[data-cerrar]', (_ev, el) => acciones.cerrarSemana(el.dataset.cerrar));
}

acciones.semanas = abrirSemanas;

entradaMenu({
  id: 'semanas', orden: 10,
  pintar: (d) => itemMenu('semanas', 'Semanas', html`<span class="mut">W${f.numeroSemana(st.ui.semana ?? d.meta.semanaActual)}</span>`),
  accion: abrirSemanas,
});

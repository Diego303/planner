// «Hecho ✓» (cuánto duró de verdad + nota del simulacro), «A medias» (dónde lo dejaste), Desmarcar,
// Proponer semana y «lo que tardas de verdad» en Ajustes.
import { html, $ } from '../ui/dom.js';
import { st, enviar, derivados, acciones } from '../estado.js';
import { pasosEditor, botonesPie, accionesEditor, cerrarEditor, editorAbierto } from './editor-bloque.js';
import { seccionesAjustes } from '../gestion/ajustes.js';
import * as f from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { destinoDejado } from '/core/ops.js';
import { redondearFactor, MIN_MUESTRAS } from '/core/factor.js';

const DURACIONES = [['menos', -30], ['lo previsto', 0], ['+30 min', 30], ['+1 h o más', 60]];

const puedeAMedias = (b) => !!destinoDejado(b.titulo, st.datos.ficheros['estudio.md'], st.datos.ficheros['proyectos.md']);

botonesPie.push((b) => (b.hecho != null
  ? html`<button type="button" data-ed="desmarcar">Desmarcar</button>`
  : html`<button type="button" class="dark" data-paso="hecho">Hecho ✓</button>${puedeAMedias(b) ? html`<button type="button" data-paso="medias">A medias</button>` : html`<button type="button" disabled title="Solo para temas de estudio o proyectos: el título tiene que empezar por su nombre">A medias</button>`}`));

accionesEditor.desmarcar = (_el, b) => {
  if (b) enviar('bloque.desmarcar', { semana: editorAbierto().semana, id: b.id, huella: m.huellaDe(b) }, { mensaje: () => `«${b.titulo}» ya no está hecho` });
  cerrarEditor();
};

function textoFactor(tipo, respuesta) {
  const fs = respuesta?.estado?.meta.factores ?? derivados().meta.factores ?? {};
  const x = Object.entries(fs).find(([k]) => m.normalizar(k) === m.normalizar(tipo))?.[1];
  if (!x || x.muestras < MIN_MUESTRAS) return `aún no hay datos para saber cuánto tardas (${x?.muestras ?? 0} de ${MIN_MUESTRAS} bloques)`;
  return `tus bloques de ${tipo} duran ×${f.numero(redondearFactor(x.factor))} de lo previsto`;
}

pasosEditor.hecho = {
  cuerpo: (b) => html`<div class="paso2"><label style="margin-top:0">¿Cuánto duró de verdad?</label><div class="chips">${DURACIONES.map(([t, v]) => html`<button type="button" class="ac" data-real="${v}" ${v === DURACIONES[0][1] ? 'data-paso-foco' : ''}>${t}</button>`)}</div>
${b.subtipo === 'simulacro' ? html`<label for="ed-nota">Nota del simulacro</label><div style="display:flex;gap:6px;align-items:center"><input id="ed-nota" type="number" min="0" max="100" placeholder="70" style="width:70px"> %</div>` : ''}
<div class="mut pista" style="margin-top:8px">Un clic. Con esto el planner aprende cuánto tardas de verdad y lo usa al proponer.</div></div>`,
  alAbrir(el, b) {
    el.addEventListener('click', (ev) => {
      const boton = ev.target.closest('[data-real]');
      if (!boton) return;
      const nota = $('#ed-nota', el)?.value;
      const ed = editorAbierto();
      enviar('bloque.hecho', { semana: ed.semana, id: ed.id, huella: ed.huella, delta: +boton.dataset.real, nota: nota === '' || nota == null ? null : Number(nota) },
        { mensaje: (_r, resp) => `Hecho ✓ · ${textoFactor(b.tipo, resp)}` });
      cerrarEditor();
    });
  },
};

pasosEditor.medias = {
  cuerpo: (b) => html`<div class="paso2"><label for="ed-dejado" style="margin-top:0">¿Dónde lo dejaste?</label><input id="ed-dejado" class="dejado-input" data-paso-foco maxlength="200" placeholder="p. ej. celda 14, falta evaluar el reranking"><div class="pie" style="margin-top:8px"><button type="button" class="dark" data-guardar-dejado>Guardar nota</button></div><div class="mut pista">Aparecerá la próxima vez que abras un bloque de «${m.temaDe(b.titulo)}».</div></div>`,
  alAbrir(el, b) {
    const guardar = () => {
      const dejado = $('#ed-dejado', el).value.trim();
      if (!dejado) { $('#ed-dejado', el).focus(); return; }
      const ed = editorAbierto();
      enviar('bloque.aMedias', { semana: ed.semana, id: ed.id, huella: ed.huella, dejado }, { mensaje: (r) => `Nota guardada: «${r.tema ?? m.temaDe(b.titulo)}» · ${dejado}` });
      cerrarEditor();
    };
    el.addEventListener('click', (ev) => { if (ev.target.closest('[data-guardar-dejado]')) guardar(); });
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.id === 'ed-dejado') { ev.preventDefault(); ev.stopPropagation(); guardar(); } }, true);
  },
};

acciones.proponer = (id) => enviar('semana.proponer', { semana: id }, {
  mensaje: (r, resp) => {
    const d = derivados();
    const fe = resp?.estado?.meta.factores?.[m.tipoEstudio(d.tipos)]?.factor ?? 1;
    const margen = d.ajustes.margen === 'auto' ? `margen ×${f.numero(redondearFactor(fe))} en estudio` : 'margen: solo la capacidad';
    const partes = r.n
      ? [`${r.n} sugerencia${r.n === 1 ? '' : 's'}`, '★ primero lo que avanza las 3', margen, 'nunca el mismo tema dos veces en un día']
      : ['Nada que proponer: lo de estudio y proyectos ya está planificado'];
    for (const x of r.noCaben ?? []) partes.push(`no caben ${f.horas(x.minutos)} h de ${x.tema} → baja horas o sube capacidad`);
    return partes.join(' · ');
  },
});

seccionesAjustes.push(() => {
  const fs = derivados().meta.factores ?? {};
  const lista = Object.entries(fs).filter(([, x]) => x.muestras > 0);
  return html`<label>Lo que tardas de verdad <span style="color:var(--texto-3)">(bloques hechos de las últimas 8 semanas)</span></label><div style="display:flex;gap:6px;flex-wrap:wrap">${lista.length ? lista.map(([tipo, x]) => html`<span class="pill" title="${x.muestras} bloques">${tipo} ${x.muestras >= MIN_MUESTRAS ? `×${f.numero(redondearFactor(x.factor))}` : '· aún no hay datos'} · ${x.muestras}</span>`) : html`<span class="mut" style="font-size:11.5px">Aún no hay datos: marca «Hecho ✓» en tus bloques.</span>`}</div>`;
});

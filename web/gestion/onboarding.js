// Onboarding (carpeta inexistente o vacía): 1) semana tipo · 2) estudio y proyectos · 3) proponer la primera semana.
// Se oculta al completarse. Crea ajustes.md, tipos.md y plantilla.md por defecto.
import { html, $, on, pintar } from '../ui/dom.js';
import { st, enviar, derivados, acciones } from '../estado.js';
import { PLANTILLAS_RAPIDAS } from '/core/ops.js';

let sesion = { visto: false, paso2: false, plantillas: new Set(['trabajo']), error: '' };
const clave = () => `planner:onboarding:${st.datos.meta.datos.ruta}`;
const terminado = () => localStorage.getItem(clave()) === 'hecho';

/** Se enseña con la carpeta vacía (o sin ninguna semana) hasta completarlo u ocultarlo; dentro de la sesión, hasta el final. */
function visible() {
  if (!st.datos || terminado()) return false;
  const meta = st.datos.meta;
  const sinSemanas = meta.semanas.every((s) => s.estado === 'sin planificar' || s.estado === 'sin datos');
  if (meta.datos.vacia || sinSemanas) sesion.visto = true;
  return sesion.visto;
}

function contenido() {
  const d = derivados(), meta = d.meta;
  const f = st.datos.ficheros;
  const paso1 = !!(f['ajustes.md'] && f['plantilla.md']);
  const paso2 = paso1 && (sesion.paso2 || d.temas.length > 0 || d.proyectos.length > 0);
  const actual = paso2 ? 3 : paso1 ? 2 : 1;
  return html`<div class="card" style="margin-bottom:14px">
<div class="fila-lab"><b style="font-weight:600;font-size:15px">Empecemos · 3 pasos</b><button type="button" class="add" data-onb="ocultar">ocultar</button></div>
<div class="mut" style="font-size:12px;margin-top:2px">Todo se guarda en <b>${meta.datos.ruta}</b> como ficheros Markdown que puedes leer y editar a mano.</div>
${meta.datos.existe ? '' : html`<div class="banda aviso" style="margin-top:10px"><span>Esa carpeta todavía no existe. Se creará al guardar el primer paso.</span></div>`}
<div class="steps">${[1, 2, 3].map((n) => html`<span class="${n <= actual ? 'on' : ''}"></span>`)}</div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">
  <div style="${actual === 1 ? '' : 'opacity:.55'}"><div class="lab" style="color:var(--texto);font-weight:500">1 · Tu semana tipo</div>
    <div class="chips">${Object.entries(PLANTILLAS_RAPIDAS).map(([k, v]) => html`<button type="button" class="ac ${sesion.plantillas.has(k) ? 'on' : ''}" aria-pressed="${(sesion.plantillas.has(k)) ? 'true' : 'false'}" data-onb-plantilla="${k}" ${paso1 ? 'disabled' : ''}>${v.titulo}</button>`)}<button type="button" class="ac ${sesion.plantillas.size ? '' : 'on'}" data-onb-plantilla="" ${paso1 ? 'disabled' : ''}>vacía</button></div>
    <div class="mut" style="font-size:10.5px;margin-top:6px">Se repite cada semana. Luego la cambias en Gestión → Plantilla.</div>
    ${paso1 ? html`<div class="ok-texto" style="font-size:12px;margin-top:8px">✓ Guardada en plantilla.md</div>` : html`<button type="button" class="dark" style="margin-top:8px" data-onb="paso1">Guardar semana tipo</button>`}</div>
  <div style="${actual === 2 ? '' : 'opacity:.55'}"><div class="lab" style="color:var(--texto);font-weight:500">2 · Estudio y proyectos</div>
    <div class="mut" style="font-size:11.5px">Añádelos con «+ añadir» en el cajón <b>Metas</b> de la derecha: horas a la semana y fecha de examen, o el siguiente paso de cada proyecto.</div>
    <div style="font-size:12px;margin-top:6px">${d.temas.length} de estudio · ${d.proyectos.length} proyecto${d.proyectos.length === 1 ? '' : 's'}</div>
    ${paso1 && !paso2 ? html`<button type="button" style="margin-top:8px" data-onb="paso2">${d.temas.length || d.proyectos.length ? 'Listo' : 'Ahora no'}</button>` : ''}</div>
  <div style="${actual === 3 ? '' : 'opacity:.55'}"><div class="lab" style="color:var(--texto);font-weight:500">3 · Tu primera semana</div>
    <div class="mut" style="font-size:11.5px">El planner coloca tus horas de estudio y proyectos sin solapar, respetando tu capacidad. Sin IA: reglas fijas.</div>
    <button type="button" class="dark" style="margin-top:8px" data-onb="paso3" ${actual === 3 ? '' : 'disabled'}>Proponer mi primera semana</button></div>
</div><div class="error-form" role="alert">${sesion.error}</div></div>`;
}

function pintarOnboarding() {
  const raiz = $('#onboarding');
  const mostrar = visible() && st.ui.vista !== 'progreso';
  raiz.hidden = !mostrar;
  pintar(raiz, mostrar ? contenido() : '');
}

function iniciarOnboarding() {
  const raiz = $('#onboarding');
  on(raiz, 'click', '[data-onb-plantilla]', (_ev, el) => {
    const k = el.dataset.onbPlantilla;
    if (!k) sesion.plantillas.clear();
    else if (sesion.plantillas.has(k)) sesion.plantillas.delete(k); else sesion.plantillas.add(k);
    pintarOnboarding();
  });
  on(raiz, 'click', '[data-onb]', (_ev, el) => {
    const d = derivados();
    switch (el.dataset.onb) {
      case 'paso1': enviar('datos.inicializar', { plantillas: [...sesion.plantillas] }, { mensaje: () => 'Semana tipo guardada en plantilla.md ✓' }); break;
      case 'paso2': sesion.paso2 = true; st.ui.cajon = 'metas'; acciones.irA(st.ui.vista); break;
      case 'paso3':
        localStorage.setItem(clave(), 'hecho');
        acciones.irA('semana');
        acciones.proponer?.(d.meta.semanaActual);
        break;
      case 'ocultar': localStorage.setItem(clave(), 'hecho'); pintarOnboarding(); break;
      default:
    }
  });
}

acciones.trasPintar = ((previa) => () => { previa?.(); pintarOnboarding(); })(acciones.trasPintar);
acciones.alIniciar = ((previa) => () => { previa?.(); iniciarOnboarding(); })(acciones.alIniciar);

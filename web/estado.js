// Almacén del cliente: estado del servidor, operaciones optimistas en cola, deshacer y sondeo.
//
// `base` es la última respuesta del servidor; `datos` = base + operaciones pendientes aplicadas en local
// con el mismo core/ops.js que usa el servidor (por eso la interfaz responde al instante).
import { aplicar, ErrorOp } from '/core/ops.js';
import { fechaDe } from '/core/fechas.js';
import * as m from '/core/modelo.js';
import { api, ErrorApi } from './api.js';
import { toast, toastError } from './ui/toast.js';

export const st = {
  base: null,
  datos: null,
  ui: { vista: 'semana', semana: null, cajon: 'hoy' },
  caido: false,
  cargando: false,
};

/** Acciones que registran las vistas y la gestión (los botones solo aparecen si su acción existe). */
export const acciones = {};

const oyentes = new Set();
export const alCambiar = (fn) => oyentes.add(fn);
const avisar = () => { for (const fn of oyentes) fn(); };

export const hoy = () => st.base?.meta.hoySimulado ?? fechaDe(new Date());
export const ahora = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/** Contexto de las operaciones locales (el mismo que construye el servidor). */
const contexto = () => ({ hoy: hoy(), ahora: ahora(), usoTipos: st.base?.meta.usoTipos ?? {}, factores: st.base?.meta.factores ?? {} });

// ---------- Carga ----------

let generacion = 0;
const pendientes = []; // [{ op, args }]

function recomponer() {
  let ficheros = st.base.ficheros;
  for (const p of pendientes) {
    try { ficheros = aplicar({ ficheros }, p, contexto()).mundo.ficheros; } catch { /* la respuesta del servidor manda */ }
  }
  st.datos = { ...st.base, ficheros };
}

export async function cargar(semana = st.ui.semana) {
  st.cargando = true;
  try {
    const e = await api.estado({ semana, hoy: hoy(), ahora: ahora() });
    st.base = e;
    st.caido = false;
    st.ui.semana = e.meta.semana;
    recomponer();
    avisar();
    asegurarSemana();
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 0) { st.caido = true; avisar(); } else toastError(e.message);
  } finally {
    st.cargando = false;
  }
}

/** La semana visible se crea desde la plantilla al abrirla por primera vez (si es la actual o futura). */
function asegurarSemana() {
  const id = st.ui.semana, meta = st.base.meta;
  if (!meta.datos.existe || meta.datos.vacia) return;
  if (st.base.ficheros[`semanas/${id}.md`] === null && id >= meta.semanaActual && !pendientes.some((p) => p.op === 'semana.crear' && p.args.semana === id)) {
    enviar('semana.crear', { semana: id });
  }
}

export const irASemana = (id) => { st.ui.semana = id; return cargar(id); };

// ---------- Operaciones ----------

let cola = Promise.resolve();

function manejarError(e) {
  generacion++;
  pendientes.length = 0;
  if (e instanceof ErrorApi && e.estado === 0) { st.caido = true; recomponer(); avisar(); toastError('Servidor parado · solo lectura'); return; }
  if (e instanceof ErrorApi && e.estado === 409) toast(e.message);
  else toastError(e.message);
  cargar();
}

/**
 * Envía una operación. La aplica al momento en local (si puede) y la pone en cola para el servidor.
 * Devuelve { local: resultado local o null, respuesta: Promise<respuesta|null> }.
 * `mensaje(resultado)` → texto del toast con «deshacer».
 */
export function enviar(op, args, { mensaje = null } = {}) {
  if (st.caido) { toastError('Servidor parado · solo lectura'); return { local: null, respuesta: Promise.resolve(null) }; }
  let local = null;
  try {
    local = aplicar({ ficheros: st.datos.ficheros }, { op, args }, contexto());
  } catch (e) {
    if (e instanceof ErrorOp) { toastError(e.message); return { local: null, respuesta: Promise.resolve(null) }; }
    // FaltaFichero u otro: sin optimismo, decide el servidor
  }
  const pendiente = { op, args };
  pendientes.push(pendiente);
  if (local) { st.datos = { ...st.datos, ficheros: local.mundo.ficheros }; avisar(); }
  const gen = generacion;
  const respuesta = cola.then(async () => {
    if (gen !== generacion) return null; // una operación anterior falló: esta se basaba en ella
    try {
      const r = await api.op({ op, args, versiones: st.base.versiones, hoy: hoy(), ahora: ahora(), semana: st.ui.semana });
      pendientes.splice(pendientes.indexOf(pendiente), 1);
      st.base = r.estado;
      st.ui.semana = r.estado.meta.semana;
      recomponer();
      avisar();
      if (mensaje && r.inversaId) toast(mensaje(r.resultado ?? local?.resultado ?? {}), { deshacer: () => deshacer(r.inversaId) });
      else if (mensaje) toast(mensaje(r.resultado ?? {}));
      return r;
    } catch (e) {
      manejarError(e);
      return null;
    }
  });
  cola = respuesta.catch(() => null);
  return { local: local?.resultado ?? null, respuesta };
}

export function deshacer(inversaId) {
  cola = cola.then(async () => {
    try {
      const r = await api.deshacer({ inversaId, hoy: hoy(), ahora: ahora(), semana: st.ui.semana });
      st.base = r.estado;
      recomponer();
      avisar();
      toast('Deshecho', { duracion: 2500 });
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 0) manejarError(e);
      else { toastError(e.message); cargar(); }
    }
  });
  return cola;
}

// ---------- Sondeo ----------

export function iniciarSondeo() {
  const ciclo = async () => {
    const espera = st.caido ? 5000 : 2000;
    if (!document.hidden && !pendientes.length && !st.cargando && st.base) {
      try {
        const { version } = await api.version({ hoy: hoy() });
        if (st.caido || version !== st.base.version || st.base.meta.hoy !== hoy()) await cargar();
      } catch {
        if (!st.caido) { st.caido = true; recomponer(); avisar(); }
      }
    }
    setTimeout(ciclo, espera);
  };
  setTimeout(ciclo, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st.base) cargar(); });
}

// ---------- Derivados (se recalculan una vez por versión de los datos) ----------

let cacheDerivados = { datos: null, valor: null };

export function derivados() {
  if (cacheDerivados.datos === st.datos) return cacheDerivados.valor;
  const f = st.datos.ficheros, meta = st.datos.meta;
  const semanaRuta = `semanas/${st.ui.semana}.md`;
  const actualRuta = `semanas/${meta.semanaActual}.md`;
  const v = {
    meta,
    ajustes: m.valoresAjustes(f['ajustes.md']),
    tipos: m.tiposDe(f['tipos.md']),
    semanaRuta, semanaDoc: f[semanaRuta] ?? null,
    actualRuta, actualDoc: f[actualRuta] ?? null,
    tareas: m.tareasDe(f['tareas.md']),
    temas: m.temasEstudio(f['estudio.md']),
    proyectos: m.proyectosDe(f['proyectos.md']),
  };
  v.las3Actual = m.las3De(v.actualDoc);
  cacheDerivados = { datos: st.datos, valor: v };
  return v;
}

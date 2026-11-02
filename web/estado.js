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

// Solo vale la respuesta de la última carga pedida: al pasar semanas deprisa con el disco lento, una respuesta
// de antes que llega tarde devolvería la vista a una semana que ya has dejado atrás.
let ultimaCarga = 0;

export async function cargar(semana = st.ui.semana) {
  const n = ++ultimaCarga;
  st.cargando = true;
  try {
    const e = await api.estado({ semana, hoy: hoy(), ahora: ahora() });
    if (n !== ultimaCarga) return;
    st.base = e;
    st.caido = false;
    st.ui.semana = e.meta.semana;
    recomponer();
    avisar();
    asegurarSemana();
  } catch (e) {
    if (n !== ultimaCarga) return;
    if (e instanceof ErrorApi && e.estado === 0) { st.caido = true; avisar(); } else toastError(e.message);
  } finally {
    if (n === ultimaCarga) st.cargando = false;
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

// ---------- ¿Está todo guardado? (indicador de la barra) ----------
// `enVuelo`: operaciones y deshaceres que aún no ha confirmado el servidor (en disco).
let enVuelo = 0;
let fallo = null; // hora del último cambio que no se pudo guardar (se enseña unos segundos)
let ultimoGuardado = null;
/** 'caido' | 'guardando' | 'fallo' | 'guardado' */
export function estadoGuardado() {
  if (st.caido) return 'caido';
  if (enVuelo > 0) return 'guardando';
  if (fallo && performance.now() - fallo < 6000) return 'fallo';
  return 'guardado';
}
export const horaUltimoGuardado = () => ultimoGuardado;
function enCamino(delta) {
  enVuelo = Math.max(0, enVuelo + delta);
  if (delta < 0 && enVuelo === 0 && !st.caido) ultimoGuardado = new Date();
  acciones.alGuardar?.();
}
// Cerrar la pestaña con un cambio aún en camino: el navegador pregunta antes.
addEventListener('beforeunload', (ev) => { if (enVuelo > 0) ev.preventDefault(); });

function manejarError(e) {
  generacion++;
  pendientes.length = 0;
  if (!(e instanceof ErrorApi && e.estado === 0)) { fallo = performance.now(); setTimeout(() => acciones.alGuardar?.(), 6100); }
  if (e instanceof ErrorApi && e.estado === 0) { st.caido = true; recomponer(); avisar(); toastError('Servidor parado · solo lectura'); return; }
  if (e instanceof ErrorApi && e.estado === 409) toast(e.message);
  else toastError(e.message);
  // dentro de la cola: la siguiente operación sale ya con las versiones recargadas (si no, otro 409)
  return cargar();
}

/**
 * Envía una operación. La aplica al momento en local (si puede) y la pone en cola para el servidor.
 * Devuelve { local: resultado local o null, respuesta: Promise<respuesta|null> }.
 * `mensaje(resultado)` → texto del toast con «deshacer».
 */
export function enviar(op, args, { mensaje = null, accion = null } = {}) {
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
  enCamino(+1);
  if (local) { st.datos = { ...st.datos, ficheros: local.mundo.ficheros }; avisar(); }
  const gen = generacion;
  const respuesta = cola.then(async () => {
    try {
      if (gen !== generacion) return null; // una operación anterior falló: esta se basaba en ella
      return await enviarAhora();
    } finally {
      enCamino(-1);
    }
  });
  async function enviarAhora() {
    try {
      const semanaPedida = st.ui.semana;
      const r = await api.op({ op, args, versiones: st.base.versiones, hoy: hoy(), ahora: ahora(), semana: semanaPedida });
      pendientes.splice(pendientes.indexOf(pendiente), 1);
      st.base = r.estado;
      recomponer();
      // si mientras tanto se cambió de semana, se carga la que se está viendo
      if (st.ui.semana !== r.estado.meta.semana) cargar(); else avisar();
      const extra = accion?.(r.resultado ?? local?.resultado ?? {}, r) ?? null;
      if (mensaje && r.inversaId) toast(mensaje(r.resultado ?? local?.resultado ?? {}, r), { deshacer: () => deshacer(r.inversaId), accion: extra });
      else if (mensaje) toast(mensaje(r.resultado ?? {}, r), { accion: extra });
      return r;
    } catch (e) {
      await manejarError(e);
      return null;
    }
  }
  cola = respuesta.catch(() => null);
  return { local: local?.resultado ?? null, respuesta };
}

/**
 * Varias operaciones que el usuario hizo como una sola (un formulario): un único aviso y un «deshacer»
 * que las deshace todas, de la última a la primera.
 */
export function enviarVarias(lista, { mensaje = null } = {}) {
  const envios = lista.map(([op, args]) => enviar(op, args));
  if (!mensaje) return envios;
  Promise.all(envios.map((e) => e.respuesta)).then((rs) => {
    if (rs.some((r) => r == null)) return; // alguna falló: su error ya se avisó
    const ids = rs.map((r) => r.inversaId).filter(Boolean);
    toast(mensaje(), ids.length ? { deshacer: () => ids.reverse().reduce((p, id) => p.then(() => deshacer(id)), Promise.resolve()) } : {});
  });
  return envios;
}

export function deshacer(inversaId) {
  enCamino(+1);
  cola = cola.then(async () => {
    try {
      const r = await api.deshacer({ inversaId, hoy: hoy(), ahora: ahora(), semana: st.ui.semana });
      st.base = r.estado;
      recomponer();
      avisar();
      toast('Deshecho', { duracion: 2500 });
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 0) await manejarError(e);
      else { toastError(e.message); await cargar(); }
    } finally {
      enCamino(-1);
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

// Compone el estado que pinta el navegador y el contexto de las operaciones.
import { semanaDe, sumarSemanas, sumarDias, esSemana } from '../core/fechas.js';
import { listaSemanas, pendientesDeCerrar } from '../core/semanas.js';
import { bloquesDe, normalizar, notasInbox, valoresAjustes } from '../core/modelo.js';
import { SEMANAS_VIGILADAS, DIAS_VIGILADOS, FRESCO_LEJANO } from './store.js';

export const FIJOS = ['ajustes.md', 'tipos.md', 'plantilla.md', 'tareas.md', 'estudio.md', 'proyectos.md', 'inbox.md', 'tema.md'];
export const DIAS_DIARIO = 56;

/**
 * Todas las semanas con fichero: { 'AAAA-Www': doc }. Las lejanas (fuera de las que vigila el sondeo) se toman de
 * la caché si se comprobaron hace poco: con años de semanas en /mnt/d, mirarlas todas en cada petición es lo que más
 * tarda. Las cercanas, y cualquier fichero que se vaya a escribir, se comprueban siempre.
 */
export async function todasLasSemanas(store, hoy = null) {
  const nombres = await store.listar('semanas');
  const desde = hoy ? sumarSemanas(semanaDe(hoy), -SEMANAS_VIGILADAS) : null, hasta = hoy ? sumarSemanas(semanaDe(hoy), SEMANAS_VIGILADAS) : null;
  const lejana = (id) => hoy && (id < desde || id > hasta);
  const leidos = await Promise.all(nombres.map((n) => store.leerSeguro(`semanas/${n}`, lejana(n.slice(0, -3)) ? { fresco: FRESCO_LEJANO } : undefined)));
  const docs = {};
  nombres.forEach((n, i) => { if (leidos[i].doc) docs[n.slice(0, -3)] = leidos[i].doc; });
  return docs;
}

/** Usos de cada tipo en todas las semanas: { tipoNormalizado: n } */
export function usoTipos(docsSemanas) {
  const uso = {};
  for (const doc of Object.values(docsSemanas)) {
    for (const b of bloquesDe(doc)) { const k = normalizar(b.tipo); uso[k] = (uso[k] ?? 0) + 1; }
  }
  return uso;
}

/** Contexto de las operaciones (lo que necesitan y no está en los ficheros que tocan). */
export async function contexto(store, { hoy, ahora }, extras = []) {
  const docs = await todasLasSemanas(store, hoy);
  const ctx = { hoy, ahora, usoTipos: usoTipos(docs) };
  for (const extra of extras) Object.assign(ctx, await extra({ store, docs, hoy, ahora }));
  return ctx;
}

const unicos = (lista) => [...new Set(lista)];

export async function construirEstado(store, { semana, hoy, ahora, hoySimulado = null, metricas = [] }) {
  const actual = semanaDe(hoy);
  const vista = esSemana(semana) ? semana : actual;
  const docsSemanas = await todasLasSemanas(store, hoy);
  const ids = unicos([-1, 0, 1].flatMap((d) => [sumarSemanas(vista, d), sumarSemanas(actual, d)]));
  const desde = sumarDias(hoy, -DIAS_DIARIO);
  const diario = (await store.listar('diario')).map((n) => n.slice(0, -3)).filter((f) => f >= desde && f <= hoy);
  // el diario de hoy aunque no exista, para que el cliente sepa su versión
  const rutas = unicos([...FIJOS, ...ids.map((id) => `semanas/${id}.md`), ...diario.map((f) => `diario/${f}.md`), `diario/${hoy}.md`]);
  // el diario de hace más de DIAS_VIGILADOS días (solo para las métricas) vale de la caché si es reciente
  const viejo = sumarDias(hoy, -DIAS_VIGILADOS);
  const leidos = await Promise.all(rutas.map((r) => store.leerSeguro(r, r.startsWith('diario/') && r.slice(7, -3) < viejo ? { fresco: FRESCO_LEJANO } : undefined)));
  const ficheros = {}, versiones = {};
  rutas.forEach((r, i) => { ficheros[r] = leidos[i].doc; versiones[r] = leidos[i].version; });

  const existe = store.existe();
  const meta = {
    hoy, ahora: ahora ?? null, hoySimulado, semanaActual: actual, semana: vista,
    semanas: listaSemanas(sumarSemanas(actual, -4), sumarSemanas(actual, 5), docsSemanas, actual),
    pendientes: pendientesDeCerrar(docsSemanas, actual),
    usoTipos: usoTipos(docsSemanas),
    inbox: notasInbox(ficheros['inbox.md']).length,
    ajustes: valoresAjustes(ficheros['ajustes.md']),
    avisos: [...store.avisos].map(([ruta, motivo]) => `${ruta} ignorado: ${motivo}`),
    datos: {
      ruta: store.raiz, existe,
      vacia: !existe || (FIJOS.every((r) => !ficheros[r]) && !Object.keys(docsSemanas).length),
    },
  };
  for (const m of metricas) Object.assign(meta, m({ docsSemanas, ficheros, hoy, actual, vista }));
  return { ficheros, versiones, version: await store.versionGlobal(hoy), meta };
}

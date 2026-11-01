// Semanas: estados, creación desde plantilla y lista para Gestión → Semanas.
import { compararSemanas, sumarSemanas, esSemana, diasDeSemana, numero, diasEntre, diaSemana, NOMBRES_DIA, semanaDe } from './fechas.js';
import {
  bloquesDe, estadoGuardado, plantillaDe, tipoPorNombre, minutosHechos, entidades, diarioDe, las3De, tareasDe,
  temasEstudio, proyectosDe, notasInbox, normalizar, cierreDe, temaDe, mismoTema,
} from './modelo.js';
import { estudioDeSemana, actualizadoHace, acumulado, ritmo, objetivoSemana } from './progreso.js';
import * as fsem from './formato/semana.js';
import { nuevoDoc } from './formato/comun.js';

export const ICONO_ESTADO = {
  'cerrada': '✓', 'sin cerrar': '!', 'reabierta': '↺', 'en curso': '●', 'planificada': '◐',
  'solo plantilla': '↻', 'sin planificar': '○', 'sin datos': '·',
};

/**
 * Estado de una semana según su fichero y la semana actual (§4.5 del plan).
 * Solo `cerrada` y `reabierta` vienen del fichero; el resto se calcula con la fecha.
 */
export function estadoSemana(id, doc, actual) {
  const c = compararSemanas(id, actual);
  if (!doc) return c < 0 ? 'sin datos' : 'sin planificar';
  const guardado = estadoGuardado(doc);
  if (guardado === 'cerrada' || guardado === 'reabierta') return guardado;
  if (c === 0) return 'en curso';
  if (c < 0) return 'sin cerrar';
  return bloquesDe(doc).some((b) => !b.plantilla && !b.sugerido) ? 'planificada' : 'solo plantilla';
}

export const soloLectura = (estado) => estado === 'cerrada' || estado === 'sin datos';
export const pendienteDeCerrar = (estado) => estado === 'sin cerrar' || estado === 'reabierta';

/** Bloques de la plantilla expandidos por día, marcados con `plantilla`. */
export function bloquesDePlantilla(plantillaDoc) {
  const out = [];
  for (const e of plantillaDe(plantillaDoc)) {
    for (const dia of e.dias) {
      out.push(fsem.bloque({ dia, inicio: e.inicio, fin: e.fin, tipo: e.tipo, titulo: e.titulo, subtipo: e.subtipo, paso: e.paso, plantilla: true }));
    }
  }
  return out;
}

/** Documento nuevo de la semana `id` a partir de la plantilla. */
export function crearDesdePlantilla(id, plantillaDoc, actual) {
  const doc = fsem.vacia(id, compararSemanas(id, actual) === 0 ? 'en curso' : 'solo plantilla');
  doc.lineas.push(...bloquesDePlantilla(plantillaDoc));
  return doc;
}

/** Lista de semanas [desde, hasta] con su estado: [{ id, estado }] */
export function listaSemanas(desde, hasta, docs, actual) {
  const out = [];
  for (let id = desde; compararSemanas(id, hasta) <= 0; id = sumarSemanas(id, 1)) {
    out.push({ id, estado: estadoSemana(id, docs[id] ?? null, actual) });
  }
  return out;
}

/** Semanas pasadas con fichero que faltan por cerrar (sin cerrar o reabiertas), de la más antigua a la más reciente. */
export function pendientesDeCerrar(docs, actual) {
  return Object.keys(docs).filter(esSemana).sort()
    .filter((id) => compararSemanas(id, actual) < 0 && pendienteDeCerrar(estadoSemana(id, docs[id], actual)));
}

export { nuevoDoc };

// ---------- Cierre de semana ----------

/** Semana que se planifica al cerrar `id`: la siguiente, o la actual si la siguiente ya pasó. */
export const semanaNueva = (id, actual) => (compararSemanas(sumarSemanas(id, 1), actual) < 0 ? actual : sumarSemanas(id, 1));

/**
 * Resumen de una semana: horas real/plan por tipo (sin los de trabajo), tareas hechas y ánimo medio.
 * `tareasDocs`: tareas.md y los archivos de los meses de la semana. `diarios`: { fecha: doc }.
 */
export function resumenSemana({ id, doc, tipos, tareasDocs = [], diarios = {} }) {
  const porTipo = [];
  for (const b of bloquesDe(doc).filter((x) => !x.sugerido)) {
    const t = tipoPorNombre(tipos, b.tipo);
    if (t?.trabajo) continue;
    const nombre = t?.nombre ?? b.tipo;
    let fila = porTipo.find((x) => normalizar(x.tipo) === normalizar(nombre));
    if (!fila) porTipo.push(fila = { tipo: nombre, plan: 0, real: 0, bloques: 0, hechos: 0 });
    fila.plan += b.fin - b.inicio;
    fila.real += minutosHechos(b);
    fila.bloques++;
    if (b.hecho != null) fila.hechos++;
  }
  const orden = (n) => { const i = tipos.findIndex((t) => normalizar(t.nombre) === normalizar(n)); return i < 0 ? tipos.length : i; };
  porTipo.sort((a, b) => orden(a.tipo) - orden(b.tipo));
  const dias = diasDeSemana(id);
  const tareasHechas = tareasDocs.flatMap((d) => entidades(d, 'tarea')).filter((t) => t.hecha && t.fechaHecha >= dias[0] && t.fechaHecha <= dias[6]).length;
  const animos = dias.map((f) => ({ f, a: diarioDe(diarios[f]).animo })).filter((x) => x.a != null);
  const animo = animos.length ? animos.reduce((s, x) => s + x.a, 0) / animos.length : null;
  const mejor = animos.length ? animos.reduce((a, b) => (b.a > a.a ? b : a)) : null;
  const h = (min) => numero(min / 60);
  const texto = [
    ...porTipo.filter((x) => x.plan > 0).map((x) => `${x.tipo}: ${h(x.real)}/${h(x.plan)} h`),
    `tareas: ${tareasHechas}`,
    `ánimo: ${animo == null ? '—' : numero(animo)}`,
  ].join(' · ');
  return { porTipo, tareasHechas, animo, mejorDia: mejor ? NOMBRES_DIA[diaSemana(mejor.f)] : null, texto };
}

/** Filas del paso 2 (Pendientes): cada una con sus opciones. Nada se arrastra en silencio. */
export function pendientesCierre({ id, doc, tipos, tareasDoc, temas, proyectos, inboxDoc, hoy }) {
  const filas = [];
  for (const b of bloquesDe(doc)) {
    if (b.sugerido || b.plantilla || b.hecho != null || tipoPorNombre(tipos, b.tipo)?.trabajo) continue;
    filas.push({ clase: 'bloque', id: b.id, huella: `${b.dia}|${b.inicio}|${b.fin}|${b.titulo}`, titulo: `${b.titulo} (${NOMBRES_DIA[b.dia].slice(0, 3)})`, sub: 'bloque no hecho', opciones: [['siguiente', 'a la semana nueva'], ['mas', 'más adelante'], ['descartar', 'descartar']] });
  }
  for (const t of temas) {
    const e = estudioDeSemana(t, doc, tipos);
    const falta = Math.round((e.objetivo - e.hecho) / 30) * 30;
    if (falta >= 30) filas.push({ clase: 'horas', tema: t.nombre, minutos: falta, titulo: `${t.nombre}: faltaron ${numero(falta / 60)} h`, sub: 'horas de estudio', opciones: [['sumar', 'sumar a esta semana'], ['dejar', 'dejarlo']] });
  }
  const t = tareasDe(tareasDoc);
  for (const x of [...t.hoy, ...t.mas].filter((y) => !y.hecha && y.fecha && y.fecha < hoy)) {
    filas.push({ clase: 'tarea', id: x.id, huella: x.texto, titulo: x.texto, sub: 'tarea vencida', opciones: [['hoy', 'a Hoy'], ['mas', 'más adelante'], ['archivar', 'archivar']] });
  }
  for (const x of t.mas.filter((y) => !y.hecha && !y.fecha && y.creada && diasEntre(y.creada, hoy) > 30)) {
    filas.push({ clase: 'antigua', id: x.id, huella: x.texto, titulo: x.texto, sub: `más adelante sin fecha desde hace ${diasEntre(x.creada, hoy)} días`, opciones: [['archivar', 'archivar'], ['mantener', 'mantener']] });
  }
  for (const p of proyectos.filter((y) => y.estado !== 'pausado')) {
    const a = actualizadoHace(p.actualizado, hoy);
    if (a.parado) filas.push({ clase: 'proyecto', id: p.id, nombre: p.nombre, titulo: `${p.nombre} · ${a.dias} días sin avances`, sub: 'proyecto', opciones: [['cambiar', 'cambiar siguiente paso'], ['pausar', 'pausar'], ['mantener', 'mantener']] });
  }
  const notas = notasInbox(inboxDoc).length;
  if (notas) filas.push({ clase: 'inbox', titulo: `INBOX: ${notas} nota${notas === 1 ? '' : 's'} sin ordenar`, sub: 'captura', opciones: [['tareas', 'convertir en tareas'], ['archivar', 'archivar']] });
  filas.forEach((f, i) => { f.clave = `${f.clase}:${f.id ?? f.tema ?? i}`; });
  return filas;
}

/** Todo lo que necesita el asistente «Cerrar semana» (lo calcula el servidor, que tiene todas las semanas). */
export function prepararCierre({ id, actual, hoy, docsSemanas, tipos, tareasDocs, tareasDoc, estudioDoc, proyectosDoc, inboxDoc, diarios, factores }) {
  const doc = docsSemanas[id] ?? null;
  const nueva = semanaNueva(id, actual);
  const docNueva = docsSemanas[nueva] ?? null;
  const temas = temasEstudio(estudioDoc), proyectos = proyectosDe(proyectosDoc);
  const las3 = las3De(doc);
  const prev = las3De(docNueva);
  const c = cierreDe(doc);
  return {
    id, nueva, estado: estadoSemana(id, doc, actual),
    resumen: resumenSemana({ id, doc, tipos, tareasDocs, diarios }),
    abiertasMasAdelante: tareasDe(tareasDoc).mas.filter((t) => !t.hecha).length,
    las3: { hechas: las3.filter((o) => o.hecha).length, total: las3.length },
    estudio: temas.map((t) => ({ tema: t.nombre, ...estudioDeSemana(t, doc, tipos) })),
    factores,
    lecciones: { funciono: c.funciono[0]?.texto ?? '', cambio: c.cambio[0]?.texto ?? '' },
    pendientes: pendientesCierre({ id, doc, tipos, tareasDoc, temas, proyectos, inboxDoc, hoy }),
    proyectos: proyectos.map((p) => ({ id: p.id, nombre: p.nombre, siguiente: p.siguiente ?? '', estado: p.estado, parado: actualizadoHace(p.actualizado, hoy).parado })),
    algunDia: tareasDe(tareasDoc).algun.filter((t) => !t.hecha).map((t) => ({ texto: t.texto, tipo: t.tipo })),
    siguiente: {
      las3: (prev.length ? prev : las3.filter((o) => !o.hecha)).slice(0, 3).map((o) => ({ texto: o.texto, rel: o.rel ?? null, si: o.si ?? '', entonces: o.entonces ?? '' })),
      horas: temas.filter((t) => !t.examen || t.examen >= hoy).map((t) => {
        const acum = acumulado(t, docsSemanas, tipos);
        return { tema: t.nombre, base: objetivoSemana(t, docNueva), horasSemana: t.horasSemana, examen: t.examen, acumulado: acum, total: t.total, ritmo: null };
      }),
    },
  };
}

export { ritmo, temaDe, mismoTema, semanaDe };

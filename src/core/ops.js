// Operaciones puras: aplicar(mundo, { op, args }, ctx) → { mundo, inversa, tocados, resultado }.
//
// mundo.ficheros = { ruta: documento | null (no existe) }. Si una operación necesita un fichero que no está
// en el mundo, lanza FaltaFichero: quien llama (servidor o navegador) lo carga y repite (es pura, repetir es seguro).
// Toda operación se reduce a primitivas exactas sobre líneas; su inversa es la lista de inversas al revés.
// ctx = { hoy: 'AAAA-MM-DD', ahora?: minutos, factores?, usoTipos? }. Nunca se lee el reloj.
import { esFecha, esSemana, semanaDe, compararSemanas, DIAS, sumarSemanas, lunesDe, sumarDias } from './fechas.js';
import { normalizar, limpiarTexto, claveValor } from './formato/comun.js';
import * as fsem from './formato/semana.js';
import * as ftar from './formato/tareas.js';
import { entradaPlantilla, tipo as nuevoTipo, tiposVacio, plantillaVacia } from './formato/tipos.js';
import { ajustes as fajustes, estudio as festudio, proyectos as fproyectos, diario as fdiario, vacio as listaVacia, AJUSTES_DEFECTO as AJUSTES_DEFECTO_OPS } from './formato/listas.js';
import {
  indiceSeccion, finContenido, finSeccion, entidades, bloquesDe, tareasDe, valoresAjustes, tiposDe, TIPOS_DEFECTO,
  seccionesDe, temaDe, mismoTema, temasEstudio, proyectosDe, buscarTema, tipoPorNombre, las3De, huellaDe,
} from './modelo.js';
import { estadoSemana, crearDesdePlantilla, soloLectura, semanaNueva, resumenSemana } from './semanas.js';
import { proponer } from './proponer.js';
import { fechaDeDia, diasDeSemana } from './fechas.js';

export class ErrorOp extends Error {
  constructor(mensaje) { super(mensaje); this.name = 'ErrorOp'; }
}

export class FaltaFichero extends Error {
  constructor(ruta) { super(`falta ${ruta}`); this.name = 'FaltaFichero'; this.ruta = ruta; }
}

const OPS = {};
export const registrar = (nombre, fn) => { OPS[nombre] = fn; };
export const existeOp = (nombre) => Object.hasOwn(OPS, nombre);
/** Primitivas: solo las usan las inversas que guarda el servidor (deshacer), nunca una petición de fuera. */
export const PRIMITIVAS = new Set(['lineas.insertar', 'lineas.quitar', 'linea.cambiar', 'fichero.crear', 'fichero.borrar', 'lote']);
export const esOpPublica = (nombre) => typeof nombre === 'string' && existeOp(nombre) && !PRIMITIVAS.has(nombre);

// ---------- Transacción ----------

function transaccion(mundo, ctx) {
  const ficheros = { ...mundo.ficheros };
  const copiados = new Set(), tocados = new Set(), inversas = [];

  const doc = (ruta) => {
    if (!(ruta in ficheros)) throw new FaltaFichero(ruta);
    return ficheros[ruta];
  };
  const editable = (ruta) => {
    const d = doc(ruta);
    if (!d) throw new ErrorOp(`No existe ${ruta}`);
    if (!copiados.has(ruta)) { ficheros[ruta] = { ...d, lineas: d.lineas.slice() }; copiados.add(ruta); }
    tocados.add(ruta);
    return ficheros[ruta];
  };

  const tx = {
    ctx,
    doc,
    insertar(ruta, indice, lineas) {
      const d = editable(ruta);
      if (!(indice >= 0 && indice <= d.lineas.length)) throw new ErrorOp('Posición fuera del fichero');
      d.lineas.splice(indice, 0, ...lineas);
      inversas.push({ op: 'lineas.quitar', args: { ruta, indice, n: lineas.length } });
    },
    quitar(ruta, indice, n = 1) {
      const d = editable(ruta);
      if (!(indice >= 0 && n >= 1 && indice + n <= d.lineas.length)) throw new ErrorOp('Línea fuera del fichero');
      const quitadas = d.lineas.splice(indice, n);
      inversas.push({ op: 'lineas.insertar', args: { ruta, indice, lineas: quitadas } });
      return quitadas;
    },
    cambiar(ruta, indice, cambios) {
      const d = editable(ruta);
      const l = d.lineas[indice];
      if (!l) throw new ErrorOp('Línea fuera del fichero');
      const antes = {}, nueva = { ...l };
      for (const [k, v] of Object.entries(cambios)) {
        antes[k] = l[k];
        if (v === undefined) delete nueva[k]; else nueva[k] = v;
      }
      d.lineas[indice] = nueva;
      inversas.push({ op: 'linea.cambiar', args: { ruta, indice, cambios: antes } });
    },
    crear(ruta, nuevo) {
      if (doc(ruta) != null) throw new ErrorOp(`${ruta} ya existe`);
      ficheros[ruta] = nuevo; copiados.add(ruta); tocados.add(ruta);
      inversas.push({ op: 'fichero.borrar', args: { ruta } });
    },
    borrar(ruta) {
      const d = doc(ruta);
      if (d == null) return;
      ficheros[ruta] = null; tocados.add(ruta);
      inversas.push({ op: 'fichero.crear', args: { ruta, doc: d } });
    },
    /** Devuelve el documento, creándolo con `crearVacio()` si no existe. */
    asegurar(ruta, crearVacio) {
      if (doc(ruta) == null) tx.crear(ruta, crearVacio());
      return ficheros[ruta];
    },
    aplicar(op, args) {
      const fn = OPS[op];
      if (!fn) throw new ErrorOp(`Operación desconocida: ${op}`);
      return fn(tx, args ?? {});
    },
  };
  const fin = () => ({
    mundo: { ...mundo, ficheros },
    inversa: { op: 'lote', args: { ops: inversas.slice().reverse() } },
    tocados: [...tocados],
  });
  return { tx, fin };
}

/** Aplica una operación. Lanza ErrorOp (operación inválida) o FaltaFichero (hay que cargar un fichero). */
export function aplicar(mundo, { op, args }, ctx = {}) {
  const { tx, fin } = transaccion(mundo, { ...ctx, semanaActual: ctx.hoy && esFecha(ctx.hoy) ? semanaDe(ctx.hoy) : null });
  const resultado = tx.aplicar(op, args);
  return { ...fin(), resultado: resultado ?? null };
}

// ---------- Primitivas ----------

registrar('lineas.insertar', (tx, a) => tx.insertar(a.ruta, a.indice, a.lineas));
registrar('lineas.quitar', (tx, a) => { tx.quitar(a.ruta, a.indice, a.n); });
registrar('linea.cambiar', (tx, a) => tx.cambiar(a.ruta, a.indice, a.cambios));
registrar('fichero.crear', (tx, a) => tx.crear(a.ruta, a.doc));
registrar('fichero.borrar', (tx, a) => tx.borrar(a.ruta));
registrar('lote', (tx, a) => { for (const o of a.ops ?? []) tx.aplicar(o.op, o.args); });

// ---------- Validación ----------

const exigir = (cond, mensaje) => { if (!cond) throw new ErrorOp(mensaje); };
/** Lista que llega del cliente: nada = vacía; cualquier otra cosa que no sea una lista es un error claro. */
const listaDe = (v, que) => { if (v == null) return []; exigir(Array.isArray(v), `${que}: se esperaba una lista`); return v; };
const esObjeto = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
/** Lista de objetos del cliente ([{ clase, id… }]). */
const objetosDe = (v, que) => { const l = listaDe(v, que); exigir(l.every(esObjeto), `${que}: elemento no válido`); return l; };

function textoObligatorio(v, que) {
  const t = limpiarTexto(v);
  exigir(t, `Falta ${que}`);
  exigir(!t.startsWith('#'), `${que[0].toUpperCase() + que.slice(1)} no puede empezar por #`);
  return t;
}
const textoOpcional = (v) => (v == null ? null : limpiarTexto(v) || null);

/**
 * Nombre de tipo que el formato puede volver a leer: no puede parecer «clave: valor» (en tipos.md, en los
 * bloques y en las tareas se leería como un campo) ni ser una bandera de tarea («prioridad», «las3»).
 */
function nombreTipo(v, obligatorio = true) {
  const t = obligatorio ? textoObligatorio(v, 'el tipo') : textoOpcional(v);
  if (t == null) return null;
  exigir(!claveValor(t) && !['prioridad', 'las3'].includes(normalizar(t)), `Ese nombre de tipo no se puede usar: «${t}» (sin «:» detrás de una palabra, ni «prioridad» ni «las3»)`);
  return t;
}
const esEntero = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function exigirHoy(tx) {
  exigir(esFecha(tx.ctx.hoy), 'Falta la fecha de hoy');
  return tx.ctx.hoy;
}

/** Elemento `t` en la línea `id` del fichero (y, si se da, con esa huella). */
function elemento(tx, ruta, id, t, que, huella = null) {
  const l = tx.doc(ruta)?.lineas[id];
  exigir(l && l.t === t, `${que} ya no existe: recarga`);
  exigir(huella == null || huellaDe(l) === huella, `${que} cambió mientras lo editabas: vuelve a abrirlo`);
  return l;
}

// ---------- Secciones ----------

/** Índice del título de la sección `clave`; la crea (en su orden) si falta. */
function asegurarSeccion(tx, ruta, clave, orden, crearTitulo) {
  const doc = tx.doc(ruta);
  let i = indiceSeccion(doc, clave);
  if (i >= 0) return i;
  const posterior = orden.slice(orden.indexOf(clave) + 1).map((k) => indiceSeccion(doc, k)).filter((x) => x >= 0);
  if (posterior.length) {
    i = Math.min(...posterior);
    tx.insertar(ruta, i, [crearTitulo(clave), { t: 'vacia' }]);
    return i;
  }
  const lineas = doc.lineas;
  const separar = lineas.length && lineas[lineas.length - 1].t !== 'vacia';
  i = lineas.length + (separar ? 1 : 0);
  tx.insertar(ruta, lineas.length, separar ? [{ t: 'vacia' }, crearTitulo(clave)] : [crearTitulo(clave)]);
  return i;
}

/** Añade `lineas` al final del contenido de una sección (creándola si falta). Devuelve el índice insertado. */
function anadirEnSeccion(tx, ruta, clave, orden, crearTitulo, lineas) {
  const i = asegurarSeccion(tx, ruta, clave, orden, crearTitulo);
  const pos = finContenido(tx.doc(ruta), i);
  tx.insertar(ruta, pos, lineas);
  return pos;
}

// ---------- Semanas ----------

const rutaSemana = (id) => {
  exigir(esSemana(id), 'Semana no válida');
  return `semanas/${id}.md`;
};

/** Crea la semana desde la plantilla si no existe (solo la actual o futuras). */
function crearSemanaSiFalta(tx, id) {
  const ruta = rutaSemana(id);
  if (tx.doc(ruta)) return ruta;
  const actual = tx.ctx.semanaActual;
  exigir(actual, 'Falta la fecha de hoy');
  exigir(compararSemanas(id, actual) >= 0, 'Semana pasada sin datos: solo lectura');
  tx.crear(ruta, crearDesdePlantilla(id, tx.doc('plantilla.md'), actual));
  return ruta;
}

/** Ruta de una semana que se puede editar (existe o se crea, y no está cerrada). */
function semanaEditable(tx, id) {
  const ruta = crearSemanaSiFalta(tx, id);
  const estado = estadoSemana(id, tx.doc(ruta), tx.ctx.semanaActual);
  exigir(!soloLectura(estado), 'La semana está cerrada: reábrela para editarla');
  return ruta;
}

const anadirBloque = (tx, ruta, b) =>
  anadirEnSeccion(tx, ruta, 'bloques', fsem.ORDEN_SECCIONES, fsem.seccion, [b]);

registrar('semana.crear', (tx, a) => {
  const ruta = rutaSemana(a.semana);
  exigir(!tx.doc(ruta), 'La semana ya existe');
  crearSemanaSiFalta(tx, a.semana);
});

function validarCamposBloque(c, parcial) {
  const out = {};
  const tiene = (k) => Object.hasOwn(c, k);
  if (!parcial || tiene('dia')) { exigir(esEntero(c.dia, 0, 6), 'Día no válido'); out.dia = c.dia; }
  if (!parcial || tiene('inicio')) { exigir(esEntero(c.inicio, 0, 1439), 'Hora de inicio no válida'); out.inicio = c.inicio; }
  if (!parcial || tiene('fin')) { exigir(esEntero(c.fin, 1, 1440), 'Hora de fin no válida'); out.fin = c.fin; }
  if (!parcial || tiene('tipo')) out.tipo = nombreTipo(c.tipo);
  if (!parcial || tiene('titulo')) out.titulo = textoObligatorio(c.titulo, 'el título');
  if (tiene('subtipo')) {
    exigir(c.subtipo == null || fsem.SUBTIPOS.includes(c.subtipo), 'Subtipo no válido');
    out.subtipo = c.subtipo ?? null;
  }
  if (tiene('paso')) out.paso = textoOpcional(c.paso);
  if (tiene('sugerido')) out.sugerido = !!c.sugerido;
  return out;
}

registrar('bloque.crear', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  const c = validarCamposBloque(a.bloque ?? {}, false);
  exigir(c.fin > c.inicio, 'El bloque termina antes de empezar');
  return { id: anadirBloque(tx, ruta, fsem.bloque(c)) };
});

/** Cambios de un bloque (mover, estirar, editar, aceptar). `plantilla: true` además lo añade a plantilla.md. */
registrar('bloque.editar', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  const b = elemento(tx, ruta, a.id, 'bloque', 'El bloque', a.huella);
  const cambios = validarCamposBloque(a.cambios ?? {}, true);
  const inicio = cambios.inicio ?? b.inicio, fin = cambios.fin ?? b.fin;
  exigir(fin > inicio, 'El bloque termina antes de empezar');
  if (a.cambios?.plantilla === true && !b.plantilla) {
    const nuevo = { ...b, ...cambios };
    tx.aplicar('plantilla.crear', { dias: [nuevo.dia], inicio, fin, tipo: nuevo.tipo, titulo: nuevo.titulo, subtipo: nuevo.subtipo, paso: nuevo.paso });
    cambios.plantilla = true;
  } else if (a.cambios?.plantilla === false) cambios.plantilla = false;
  if (cambios.tipo && !tipoEsEstudio(tx, cambios.tipo)) cambios.subtipo = null;
  tx.cambiar(ruta, a.id, cambios);
});

/** Mueve un bloque a otra semana (la columna del domingo anterior cuando la semana empieza en domingo). */
registrar('bloque.mover', (tx, a) => {
  if (a.destino === a.semana) return tx.aplicar('bloque.editar', a);
  const origen = semanaEditable(tx, a.semana);
  const b = elemento(tx, origen, a.id, 'bloque', 'El bloque', a.huella);
  const destino = semanaEditable(tx, a.destino);
  const c = validarCamposBloque(a.cambios ?? {}, true);
  const nuevo = fsem.bloque({ ...b, ...c, extra: b.extra, comentario: b.comentario });
  exigir(nuevo.fin > nuevo.inicio, 'El bloque termina antes de empezar');
  tx.quitar(origen, a.id);
  return { id: anadirBloque(tx, destino, nuevo), semana: a.destino };
});

registrar('bloque.eliminar', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'bloque', 'El bloque', a.huella);
  tx.quitar(ruta, a.id);
});

registrar('las3.crear', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  const o = fsem.objetivo3({
    texto: textoObligatorio(a.texto, 'el texto'), rel: textoOpcional(a.rel), si: textoOpcional(a.si), entonces: textoOpcional(a.entonces),
  });
  return { id: anadirEnSeccion(tx, ruta, 'las3', fsem.ORDEN_SECCIONES, fsem.seccion, [o]) };
});

registrar('las3.editar', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'las3', 'Ese objetivo', a.huella);
  const c = a.cambios ?? {}, cambios = {};
  if (Object.hasOwn(c, 'texto')) cambios.texto = textoObligatorio(c.texto, 'el texto');
  if (Object.hasOwn(c, 'hecha')) cambios.hecha = !!c.hecha;
  for (const k of ['rel', 'si', 'entonces']) if (Object.hasOwn(c, k)) cambios[k] = textoOpcional(c[k]);
  tx.cambiar(ruta, a.id, cambios);
});

registrar('las3.eliminar', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'las3', 'Ese objetivo', a.huella);
  tx.quitar(ruta, a.id);
});

// ---------- Proponer, Hecho y A medias ----------

/** Quita las sugerencias no aceptadas de una semana (de abajo arriba para no mover índices). */
function quitarSugerencias(tx, ruta) {
  const ids = bloquesDe(tx.doc(ruta)).filter((b) => b.sugerido).map((b) => b.id).sort((x, y) => y - x);
  for (const i of ids) tx.quitar(ruta, i);
  return ids.length;
}

registrar('semana.proponer', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  exigir(compararSemanas(a.semana, tx.ctx.semanaActual) >= 0, 'Las semanas pasadas no se proponen');
  exigirHoy(tx);
  const r = proponerEn(tx, ruta, a.semana);
  return { n: r.bloques.length, noCaben: r.noCaben };
});

const DELTA_MAX = 4 * 60;

registrar('bloque.hecho', (tx, a) => {
  const hoy = exigirHoy(tx);
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'bloque', 'El bloque', a.huella);
  if (a.cambios) tx.aplicar('bloque.editar', { semana: a.semana, id: a.id, cambios: a.cambios });
  const b = tx.doc(ruta).lineas[a.id];
  const dur = b.fin - b.inicio;
  exigir(Number.isInteger(a.delta) && a.delta % 15 === 0 && a.delta >= -dur && a.delta <= DELTA_MAX, 'Duración real no válida');
  const cambios = { hecho: a.delta, sugerido: false };
  if (a.nota != null && a.nota !== '') {
    exigir(esEntero(a.nota, 0, 100), 'La nota va de 0 a 100');
    cambios.nota = a.nota;
  }
  tx.cambiar(ruta, a.id, cambios);
  const tema = temaDe(b.titulo);
  const est = () => buscarTema(temasEstudio(tx.doc('estudio.md')), tema);
  if (est()?.dejado) fijarClave(tx, 'estudio', est().id, 'dejado', null);
  if (est() && cambios.nota != null) {
    fijarClave(tx, 'estudio', est().id, 'simulacros', [...est().simulacros, { nota: cambios.nota, fecha: fechaDeDia(a.semana, b.dia) }]);
  }
  const pro = () => buscarTema(proyectosDe(tx.doc('proyectos.md')), tema);
  if (pro()) {
    if (pro().dejado) fijarClave(tx, 'proyecto', pro().id, 'dejado', null);
    fijarClave(tx, 'proyecto', pro().id, 'actualizado', hoy);
  }
  return { tipo: b.tipo, titulo: b.titulo };
});

registrar('bloque.desmarcar', (tx, a) => {
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'bloque', 'El bloque', a.huella);
  tx.cambiar(ruta, a.id, { hecho: null, nota: null });
});

/** ¿Tiene «dejado» el tema del título? → 'estudio' | 'proyecto' | null */
export function destinoDejado(tituloBloque, estudioDoc, proyectosDoc) {
  const tema = temaDe(tituloBloque);
  if (buscarTema(temasEstudio(estudioDoc), tema)) return 'estudio';
  if (buscarTema(proyectosDe(proyectosDoc), tema)) return 'proyecto';
  return null;
}

registrar('bloque.aMedias', (tx, a) => {
  const hoy = exigirHoy(tx);
  const ruta = semanaEditable(tx, a.semana);
  elemento(tx, ruta, a.id, 'bloque', 'El bloque', a.huella);
  if (a.cambios) tx.aplicar('bloque.editar', { semana: a.semana, id: a.id, cambios: a.cambios });
  const b = tx.doc(ruta).lineas[a.id];
  const tema = temaDe(b.titulo);
  const dejado = textoObligatorio(a.dejado, 'dónde lo dejaste');
  const cual = destinoDejado(b.titulo, tx.doc('estudio.md'), tx.doc('proyectos.md'));
  exigir(cual, `«${tema}» no es un tema de estudio ni un proyecto: el título tiene que empezar por su nombre (p. ej. «${tema} · …»)`);
  const lista = cual === 'estudio' ? temasEstudio(tx.doc('estudio.md')) : proyectosDe(tx.doc('proyectos.md'));
  const x = buscarTema(lista, tema);
  fijarClave(tx, cual, x.id, 'dejado', dejado);
  if (cual === 'proyecto') fijarClave(tx, 'proyecto', buscarTema(proyectosDe(tx.doc('proyectos.md')), tema).id, 'actualizado', hoy);
  return { tema: x.nombre, dejado };
});

// ---------- Cerrar semana ----------

/** Escribe `## Cierre`: el resumen (regenerado) y las lecciones (si se dan; si no, se conservan). */
function escribirCierre(tx, ruta, resumen, lecciones) {
  const titulo = asegurarSeccion(tx, ruta, 'cierre', fsem.ORDEN_SECCIONES, fsem.seccion);
  const doc = () => tx.doc(ruta);
  const enSeccion = (t) => {
    const fin = finSeccion(doc(), indiceSeccion(doc(), 'cierre'));
    for (let i = indiceSeccion(doc(), 'cierre') + 1; i < fin; i++) if (t(doc().lineas[i])) return i;
    return -1;
  };
  const r = enSeccion((l) => l.t === 'resumen');
  if (r >= 0) tx.cambiar(ruta, r, { texto: resumen });
  else tx.insertar(ruta, titulo + 1, [fsem.resumen(resumen)]);
  for (const clase of ['funciono', 'cambio']) {
    const texto = textoOpcional(lecciones?.[clase]);
    if (!texto) continue;
    const i = enSeccion((l) => l.t === 'leccion' && l.clase === clase);
    if (i >= 0) tx.cambiar(ruta, i, { texto });
    else tx.insertar(ruta, finContenido(doc(), indiceSeccion(doc(), 'cierre')), [fsem.leccion(clase, texto)]);
  }
}

/** Las 3 de la semana nueva: se sustituyen (si no cambian, no se toca nada; se respeta lo ya marcado). */
function reemplazarLas3(tx, ruta, lista) {
  const actuales = las3De(tx.doc(ruta));
  // si no llega `rel` y ya había una igual, se conserva la suya (★ no se pierde)
  const relPrevio = (texto) => actuales.find((x) => normalizar(x.texto) === normalizar(texto))?.rel ?? null;
  const nuevas = lista.map((o) => ({ texto: limpiarTexto(o.texto), rel: textoOpcional(o.rel) ?? relPrevio(limpiarTexto(o.texto)), si: textoOpcional(o.si), entonces: textoOpcional(o.entonces) }))
    .filter((o) => o.texto).slice(0, 3);
  const igual = actuales.length === nuevas.length && actuales.every((o, i) => ['texto', 'rel', 'si', 'entonces'].every((k) => (o[k] ?? null) === (nuevas[i][k] ?? null)));
  if (igual) return;
  for (const o of actuales.slice().reverse()) tx.quitar(ruta, o.id);
  const lineas = nuevas.map((o) => fsem.objetivo3({ ...o, hecha: actuales.find((x) => x.texto === o.texto)?.hecha ?? false }));
  if (lineas.length) anadirEnSeccion(tx, ruta, 'las3', fsem.ORDEN_SECCIONES, fsem.seccion, lineas);
}

/** Horas de estudio de la semana nueva: solo se escriben las que difieren de `horas_semana`. */
function fijarObjetivos(tx, ruta, horas, temas) {
  for (const t of temas) {
    const h = horas[t.nombre];
    if (h == null) continue;
    exigir(typeof h === 'number' && h >= 0 && h <= 100, `Horas no válidas para ${t.nombre}`);
    const linea = entidades(tx.doc(ruta), 'objetivo').find((o) => mismoTema(o.tema, t.nombre));
    if (h === t.horasSemana) { if (linea) tx.quitar(ruta, linea.id); continue; }
    if (linea) { if (linea.horas !== h) tx.cambiar(ruta, linea.id, { horas: h }); continue; }
    anadirEnSeccion(tx, ruta, 'estudio', fsem.ORDEN_SECCIONES, fsem.seccion, [fsem.objetivoEstudio(t.nombre, h)]);
  }
}

function proponerEn(tx, ruta, id) {
  quitarSugerencias(tx, ruta);
  const r = proponer({
    id, doc: tx.doc(ruta), temas: temasEstudio(tx.doc('estudio.md')), proyectos: proyectosDe(tx.doc('proyectos.md')),
    ajustes: valoresAjustes(tx.doc('ajustes.md')), tipos: tipos(tx), factores: tx.ctx.factores ?? {}, hoy: tx.ctx.hoy, ahora: tx.ctx.ahora ?? null,
  });
  for (const b of r.bloques) anadirBloque(tx, ruta, fsem.bloque(b));
  return r;
}

const textoNota = (t) => limpiarTexto(String(t).replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, ''));

/**
 * Cerrar semana: resumen y lecciones, estado cerrada, sin sugerencias, decisiones del paso 2 como operaciones,
 * siguientes pasos de proyectos, y la semana nueva con Las 3, sus horas de estudio y Proponer.
 * Repetirlo (tras reabrir) no duplica: los bloques y tareas que ya existen no se vuelven a crear.
 */
registrar('semana.cerrar', (tx, a) => {
  const hoy = exigirHoy(tx);
  const actual = tx.ctx.semanaActual;
  const id = a.semana;
  const ruta = rutaSemana(id);
  exigir(tx.doc(ruta), 'Esa semana no tiene fichero');
  exigir(compararSemanas(id, actual) <= 0, 'Solo se cierran la semana actual o las pasadas');
  exigir(estadoSemana(id, tx.doc(ruta), actual) !== 'cerrada', 'La semana ya está cerrada');
  const nueva = semanaNueva(id, actual);
  const rutaNueva = rutaSemana(nueva);
  const decisiones = objetosDe(a.decisiones, 'Las decisiones');
  for (const k of ['lecciones', 'siguiente']) exigir(a[k] == null || esObjeto(a[k]), `${k}: no válido`);
  exigir(a.siguiente?.horas == null || esObjeto(a.siguiente.horas), 'Las horas: no válidas');

  // Referencias antes de mover nada (los índices cambian al quitar y poner líneas)
  const bloques = decisiones.filter((d) => d.clase === 'bloque').map((d) => ({ d, l: elemento(tx, ruta, d.id, 'bloque', 'El bloque', d.huella) }));
  const tareas = decisiones.filter((d) => d.clase === 'tarea' || d.clase === 'antigua').map((d) => ({ d, l: elemento(tx, 'tareas.md', d.id, 'tarea', 'La tarea', d.huella) }));

  // 1. Semana N
  quitarSugerencias(tx, ruta);
  const dias = diasDeSemana(id);
  const meses = [...new Set([dias[0].slice(0, 7), dias[6].slice(0, 7)])];
  const tareasDocs = [tx.doc('tareas.md'), ...meses.map((mes) => tx.doc(`archivo/tareas-${mes}.md`))].filter(Boolean);
  const diarios = Object.fromEntries(dias.map((f) => [f, tx.doc(`diario/${f}.md`)]));
  const res = resumenSemana({ id, doc: tx.doc(ruta), tipos: tipos(tx), tareasDocs, diarios });
  escribirCierre(tx, ruta, res.texto, a.lecciones);
  cambiarEstadoSemana(tx, ruta, 'cerrada');

  // 2. Decisiones
  const nuevaAbierta = () => !tx.doc(rutaNueva) || estadoSemana(nueva, tx.doc(rutaNueva), actual) !== 'cerrada';
  for (const { d, l } of bloques) {
    if (d.opcion === 'siguiente' && nuevaAbierta()) {
      crearSemanaSiFalta(tx, nueva);
      const yaEsta = bloquesDe(tx.doc(rutaNueva)).some((b) => b.dia === l.dia && b.inicio === l.inicio && normalizar(b.titulo) === normalizar(l.titulo));
      if (!yaEsta) anadirBloque(tx, rutaNueva, fsem.bloque({ dia: l.dia, inicio: l.inicio, fin: l.fin, tipo: l.tipo, titulo: l.titulo, subtipo: l.subtipo, paso: l.paso }));
    } else if (d.opcion === 'mas') {
      asegurarTareas(tx);
      const ya = tareasDe(tx.doc('tareas.md')).mas.some((t) => !t.hecha && normalizar(t.texto) === normalizar(l.titulo));
      if (!ya) anadirTarea(tx, 'mas', ftar.tarea({ texto: l.titulo, tipo: l.tipo, creada: hoy }));
    }
  }
  for (const { d, l } of tareas) {
    if (d.opcion === 'hoy') moverLinea(tx, l, 'hoy', { fecha: null });
    else if (d.opcion === 'mas') moverLinea(tx, l, 'mas', { fecha: null });
    else if (d.opcion === 'archivar') archivarTareas(tx, [l], hoy);
  }
  const proyecto = (nombre) => buscarTema(proyectosDe(tx.doc('proyectos.md')), nombre);
  for (const d of decisiones.filter((x) => x.clase === 'proyecto')) {
    if (!proyecto(d.nombre)) continue;
    if (d.opcion === 'pausar') fijarClave(tx, 'proyecto', proyecto(d.nombre).id, 'estado', 'pausado');
    if (d.opcion === 'mantener') fijarClave(tx, 'proyecto', proyecto(d.nombre).id, 'actualizado', hoy);
  }
  for (const p of objetosDe(a.proyectos, 'Los proyectos')) {
    const siguiente = limpiarTexto(p.siguiente);
    if (!proyecto(p.nombre) || !siguiente || siguiente === proyecto(p.nombre).siguiente) continue;
    fijarClave(tx, 'proyecto', proyecto(p.nombre).id, 'siguiente', siguiente);
    fijarClave(tx, 'proyecto', proyecto(p.nombre).id, 'actualizado', hoy);
  }
  const inbox = decisiones.find((x) => x.clase === 'inbox');
  const notas = entidades(tx.doc('inbox.md'), 'nota');
  if (inbox && notas.length) {
    if (inbox.opcion === 'tareas') {
      asegurarTareas(tx);
      for (const n of notas) {
        const texto = textoNota(n.texto);
        if (texto && !tareasDe(tx.doc('tareas.md')).mas.some((t) => normalizar(t.texto) === normalizar(texto))) anadirTarea(tx, 'mas', ftar.tarea({ texto, creada: hoy }));
      }
    } else if (inbox.opcion === 'archivar') {
      const rutaArch = `archivo/inbox-${hoy.slice(0, 7)}.md`;
      const arch = tx.asegurar(rutaArch, () => listaVacia('inbox', `Inbox archivado · ${hoy.slice(0, 7)}`));
      tx.insertar(rutaArch, arch.lineas.length, notas.map((n) => ({ t: 'nota', texto: n.texto })));
    }
    for (const n of notas.slice().reverse()) tx.quitar('inbox.md', n.id);
  }

  // 3. Semana nueva: Las 3, horas de estudio y Proponer (solo lo que falte)
  if (!nuevaAbierta()) return { nueva, n: 0, noCaben: [], nuevaCerrada: true, resumen: res.texto };
  crearSemanaSiFalta(tx, nueva);
  if (a.siguiente?.las3) reemplazarLas3(tx, rutaNueva, objetosDe(a.siguiente.las3, 'Las 3'));
  const temas = temasEstudio(tx.doc('estudio.md'));
  if (a.siguiente?.horas) fijarObjetivos(tx, rutaNueva, a.siguiente.horas, temas);
  const r = proponerEn(tx, rutaNueva, nueva);
  return { nueva, n: r.bloques.length, noCaben: r.noCaben, resumen: res.texto };
});

function cambiarEstadoSemana(tx, ruta, valor) {
  const i = tx.doc(ruta).lineas.findIndex((l) => l.t === 'estado');
  if (i >= 0) tx.cambiar(ruta, i, { valor });
  else {
    const h1 = tx.doc(ruta).lineas.findIndex((l) => l.t === 'h1');
    tx.insertar(ruta, h1 + 1, [fsem.estado(valor)]);
  }
}

registrar('semana.reabrir', (tx, a) => {
  const ruta = rutaSemana(a.semana);
  exigir(tx.doc(ruta), 'Esa semana no tiene fichero');
  exigir(estadoSemana(a.semana, tx.doc(ruta), tx.ctx.semanaActual) === 'cerrada', 'La semana no está cerrada');
  cambiarEstadoSemana(tx, ruta, 'reabierta');
});

// ---------- Tipos ----------

const tipos = (tx) => tiposDe(tx.doc('tipos.md'));
const tipoEsEstudio = (tx, nombre) => !!tipoPorNombre(tipos(tx), nombre)?.estudio;

function asegurarTipos(tx) {
  return tx.asegurar('tipos.md', () => {
    const d = tiposVacio();
    d.lineas.push(...TIPOS_DEFECTO.map((t) => nuevoTipo(t)));
    return d;
  });
}

const COLOR = /^#[0-9a-fA-F]{6}$/;

registrar('tipo.crear', (tx, a) => {
  const nombre = nombreTipo(a.nombre).toLowerCase();
  exigir(COLOR.test(a.color ?? ''), 'Color no válido');
  asegurarTipos(tx);
  exigir(!tipoPorNombre(tipos(tx), nombre), 'Ya existe');
  tx.insertar('tipos.md', finUltimo(tx.doc('tipos.md'), 'tipo'), [nuevoTipo({ nombre, color: a.color })]);
});

/** Índice tras el último elemento `t` del documento (o el final si no hay). */
function finUltimo(doc, t) {
  for (let i = doc.lineas.length - 1; i >= 0; i--) if (doc.lineas[i].t === t) return i + 1;
  let j = doc.lineas.length;
  while (j > 0 && doc.lineas[j - 1].t === 'vacia') j--;
  return j;
}

registrar('tipo.color', (tx, a) => {
  exigir(COLOR.test(a.color ?? ''), 'Color no válido');
  asegurarTipos(tx);
  const t = tipoPorNombre(tipos(tx), a.nombre);
  exigir(t, 'Ese tipo ya no existe');
  tx.cambiar('tipos.md', t.id, { color: a.color.toUpperCase() });
});

/** Banderas de un tipo: «trabajo» (hora de desconexión) y «estudio» (subtipos, foco y simulacros). */
registrar('tipo.banderas', (tx, a) => {
  asegurarTipos(tx);
  const t = tipoPorNombre(tipos(tx), a.nombre);
  exigir(t, 'Ese tipo ya no existe');
  const cambios = {};
  for (const k of ['trabajo', 'estudio']) if (Object.hasOwn(a, k)) cambios[k] = !!a[k];
  tx.cambiar('tipos.md', t.id, cambios);
});

/** Cuántos usos tiene un tipo: semanas (ctx.usoTipos, lo calcula quien llama), plantilla y tareas. */
export function usosDeTipo(tx, nombre) {
  const n = normalizar(nombre);
  let usos = tx.ctx.usoTipos?.[n] ?? 0;
  usos += entidades(tx.doc('plantilla.md'), 'plantilla').filter((e) => normalizar(e.tipo) === n).length;
  usos += entidades(tx.doc('tareas.md'), 'tarea').filter((e) => normalizar(e.tipo ?? '') === n).length;
  return usos;
}

registrar('tipo.eliminar', (tx, a) => {
  asegurarTipos(tx);
  const t = tipoPorNombre(tipos(tx), a.nombre);
  exigir(t, 'Ese tipo ya no existe');
  exigir(usosDeTipo(tx, t.nombre) === 0, `«${t.nombre}» está en uso: cámbiales el tipo primero`);
  tx.quitar('tipos.md', t.id);
});

// ---------- Plantilla ----------

registrar('plantilla.crear', (tx, a) => {
  exigir(Array.isArray(a.dias) && a.dias.length && a.dias.every((d) => esEntero(d, 0, 6)), 'Elige al menos un día');
  const c = validarCamposBloque({ dia: a.dias[0], inicio: a.inicio, fin: a.fin, tipo: a.tipo, titulo: a.titulo, subtipo: a.subtipo ?? null, paso: a.paso ?? null }, false);
  exigir(c.fin > c.inicio, 'El bloque termina antes de empezar');
  const doc = tx.asegurar('plantilla.md', plantillaVacia);
  tx.insertar('plantilla.md', finUltimo(doc, 'plantilla'), [entradaPlantilla({ ...c, dias: a.dias })]);
});

registrar('plantilla.eliminar', (tx, a) => {
  elemento(tx, 'plantilla.md', a.id, 'plantilla', 'Esa entrada de la plantilla', a.huella);
  tx.quitar('plantilla.md', a.id);
});

// ---------- Ajustes ----------

registrar('ajustes.cambiar', (tx, a) => {
  const def = fajustes.claves[a.clave];
  exigir(def, 'Ajuste desconocido');
  let valido;
  try { valido = def.parsear(def.formato(a.valor)); } catch { valido = null; }
  exigir(valido != null, `Valor no válido para ${def.nombre}`);
  const doc = tx.asegurar('ajustes.md', () => listaVacia('ajustes', 'Ajustes'));
  const i = doc.lineas.findIndex((l) => l.t === 'kv' && l.clave === a.clave);
  if (i >= 0) tx.cambiar('ajustes.md', i, { valor: valido });
  else tx.insertar('ajustes.md', finUltimo(doc, 'kv'), [fajustes.kv(a.clave, valido)]);
});

// ---------- Tareas ----------

const SECCIONES_TAREA = ftar.ORDEN_SECCIONES;

function asegurarTareas(tx) {
  return tx.asegurar('tareas.md', ftar.vacio);
}

function anadirTarea(tx, seccion, t) {
  return anadirEnSeccion(tx, 'tareas.md', seccion, SECCIONES_TAREA, ftar.seccion, [{ ...t, seccion }]);
}

export function hoyLleno(tareasDoc, ajustesDoc) {
  return tareasDe(tareasDoc).hoy.filter((t) => !t.hecha).length >= valoresAjustes(ajustesDoc).tareas_hoy;
}

function camposTarea(c) {
  const out = {};
  if (Object.hasOwn(c, 'texto')) out.texto = textoObligatorio(c.texto, 'el texto');
  if (Object.hasOwn(c, 'tipo')) out.tipo = nombreTipo(c.tipo, false);
  if (Object.hasOwn(c, 'prioridad')) out.prioridad = !!c.prioridad;
  if (Object.hasOwn(c, 'las3')) out.las3 = !!c.las3;
  if (Object.hasOwn(c, 'fecha')) { exigir(c.fecha == null || esFecha(c.fecha), 'Fecha no válida'); out.fecha = c.fecha ?? null; }
  if (Object.hasOwn(c, 'dur')) { exigir(c.dur == null || esEntero(c.dur, 1, 24 * 60), 'Duración no válida'); out.dur = c.dur ?? null; }
  return out;
}

registrar('tarea.crear', (tx, a) => {
  const hoy = exigirHoy(tx);
  exigir(SECCIONES_TAREA.includes(a.seccion), 'Sección no válida');
  asegurarTareas(tx);
  if (a.seccion === 'hoy') exigir(!hoyLleno(tx.doc('tareas.md'), tx.doc('ajustes.md')), 'Hoy está lleno: va a Más adelante');
  const c = camposTarea({ ...a.tarea, texto: a.tarea?.texto });
  return { id: anadirTarea(tx, a.seccion, ftar.tarea({ ...c, creada: hoy })) };
});

registrar('tarea.editar', (tx, a) => {
  elemento(tx, 'tareas.md', a.id, 'tarea', 'La tarea', a.huella);
  tx.cambiar('tareas.md', a.id, camposTarea(a.cambios ?? {}));
});

registrar('tarea.marcar', (tx, a) => {
  const hoy = exigirHoy(tx);
  elemento(tx, 'tareas.md', a.id, 'tarea', 'La tarea', a.huella);
  tx.cambiar('tareas.md', a.id, { hecha: !!a.hecha, fechaHecha: a.hecha ? hoy : null });
});

/** Mueve una tarea al final de otra sección (↑ hoy, ↓ luego, más adelante…). */
registrar('tarea.mover', (tx, a) => {
  const t = elemento(tx, 'tareas.md', a.id, 'tarea', 'La tarea', a.huella);
  exigir(SECCIONES_TAREA.includes(a.seccion), 'Sección no válida');
  if (t.seccion === a.seccion) return { id: a.id };
  if (a.seccion === 'hoy' && !t.hecha) {
    exigir(!hoyLleno(tx.doc('tareas.md'), tx.doc('ajustes.md')), 'Hoy está lleno: termina o baja alguna tarea primero');
  }
  const [linea] = tx.quitar('tareas.md', a.id);
  const cambios = a.cambios ? camposTarea(a.cambios) : {};
  return { id: anadirTarea(tx, a.seccion, { ...linea, ...cambios }) };
});

registrar('tarea.eliminar', (tx, a) => {
  elemento(tx, 'tareas.md', a.id, 'tarea', 'La tarea', a.huella);
  tx.quitar('tareas.md', a.id);
});

/** Mueve tareas (referencias a sus líneas) al archivo del mes de su fecha de hecha (o de hoy). */
function archivarTareas(tx, lineas, hoy) {
  for (const l of lineas) {
    const i = tx.doc('tareas.md').lineas.indexOf(l);
    if (i < 0) continue;
    tx.quitar('tareas.md', i);
    const mes = (l.fechaHecha ?? hoy).slice(0, 7);
    const ruta = `archivo/tareas-${mes}.md`;
    const doc = tx.asegurar(ruta, () => ftar.archivoVacio(mes));
    const pos = doc.lineas.some((x) => x.t === 'tarea') ? finUltimo(doc, 'tarea') : doc.lineas.length;
    tx.insertar(ruta, pos, [{ ...l, seccion: 'archivo' }]);
  }
}

/** Líneas de tarea a partir de [{ id, huella }] del cliente (antes de mover nada, los índices cambian). */
function lineasDeTareas(tx, lista) {
  return listaDe(lista, 'Las tareas').map((x) => {
    exigir(x && typeof x === 'object', 'Tarea no válida');
    return elemento(tx, 'tareas.md', x.id, 'tarea', 'La tarea', x.huella ?? null);
  });
}

/** Mueve una tarea (por referencia de línea) al final de una sección. */
function moverLinea(tx, l, seccion, cambios = {}) {
  const i = tx.doc('tareas.md').lineas.indexOf(l);
  if (i < 0) return;
  tx.quitar('tareas.md', i);
  anadirTarea(tx, seccion, { ...l, ...cambios });
}

/**
 * Cierre del día: escribe diario/AAAA-MM-DD.md, aplaza a «Más adelante» lo elegido, pone fecha a las tareas
 * marcadas a mano sin fecha y archiva las hechas antes de hoy.
 */
registrar('dia.cerrar', (tx, a) => {
  const hoy = exigirHoy(tx);
  const ruta = `diario/${hoy}.md`;
  tx.asegurar(ruta, () => listaVacia('diario'));
  const fijar = (clave, valor) => {
    const i = tx.doc(ruta).lineas.findIndex((l) => l.t === 'kv' && l.clave === clave);
    const vacio = valor == null || valor === '' || (Array.isArray(valor) && !valor.length);
    if (vacio) { if (i >= 0) tx.quitar(ruta, i); return; }
    if (i >= 0) tx.cambiar(ruta, i, { valor });
    else tx.insertar(ruta, finUltimo(tx.doc(ruta), 'kv'), [fdiario.kv(clave, valor)]);
  };
  if (a.animo != null) exigir(esEntero(a.animo, 1, 5), 'El ánimo va de 1 a 5');
  fijar('animo', a.animo ?? null);
  fijar('linea', textoOpcional(a.linea));
  const avanzado = listaDe(a.avanzado, 'Lo avanzado');
  exigir(avanzado.every((x) => typeof x === 'string'), 'Lo avanzado: se esperaban textos');
  fijar('avanzado', avanzado.map((x) => limpiarTexto(x).replace(/;/g, ',')).filter(Boolean));
  fijar('manana', textoOpcional(a.manana));

  if (tx.doc('tareas.md')) {
    const aplazar = lineasDeTareas(tx, a.aplazar);
    for (const l of aplazar) if (!l.hecha) moverLinea(tx, l, 'mas');
    const lineas = tx.doc('tareas.md').lineas;
    lineas.forEach((l, i) => { if (l.t === 'tarea' && l.hecha && !l.fechaHecha) tx.cambiar('tareas.md', i, { fechaHecha: hoy }); });
    archivarTareas(tx, tx.doc('tareas.md').lineas.filter((l) => l.t === 'tarea' && l.hecha && l.fechaHecha && l.fechaHecha < hoy), hoy);
  }
});

// ---------- Estudio y proyectos ----------

const LISTAS = {
  estudio: { ruta: 'estudio.md', formato: festudio, titulo: 'Estudio', lista: temasEstudio },
  proyecto: { ruta: 'proyectos.md', formato: fproyectos, titulo: 'Proyectos', lista: proyectosDe },
};

function seccionPorId(tx, cual, id) {
  const { ruta } = LISTAS[cual];
  const s = seccionesDe(tx.doc(ruta)).find((x) => x.id === id);
  exigir(s, cual === 'estudio' ? 'Ese tema ya no existe' : 'Ese proyecto ya no existe');
  return s;
}

/** Fija (o quita, con valor null) una clave de un tema/proyecto. */
function fijarClave(tx, cual, id, clave, valor) {
  const { ruta, formato } = LISTAS[cual];
  const def = formato.claves[clave];
  exigir(def, 'Campo desconocido');
  const s = seccionPorId(tx, cual, id);
  const actual = s.claves[clave];
  if (valor == null || valor === '') {
    if (actual) tx.quitar(ruta, actual.id);
    return;
  }
  let valido;
  try { valido = def.parsear(def.formato(def.libre ? limpiarTexto(valor) : valor)); } catch { valido = null; }
  exigir(valido != null, `Valor no válido para ${def.nombre}`);
  if (actual) tx.cambiar(ruta, actual.id, { valor: valido });
  else tx.insertar(ruta, finContenido(tx.doc(ruta), id), [formato.kv(clave, valido)]);
}

function crearSeccionLista(tx, cual, nombre, campos) {
  const { ruta, formato, titulo, lista } = LISTAS[cual];
  const limpio = textoObligatorio(nombre, 'el nombre');
  const doc = tx.asegurar(ruta, () => listaVacia(cual === 'estudio' ? 'estudio' : 'proyectos', titulo));
  exigir(!buscarTema(lista(doc), limpio), 'Ya existe');
  const lineas = [{ t: 'h2', texto: limpio, seccion: limpio }];
  for (const [clave, valor] of Object.entries(campos)) {
    if (valor == null || valor === '') continue;
    const def = formato.claves[clave];
    const v = def.parsear(def.formato(def.libre ? limpiarTexto(valor) : valor));
    exigir(v != null, `Valor no válido para ${def.nombre}`);
    lineas.push(formato.kv(clave, v));
  }
  let pos = doc.lineas.length;
  while (pos > 0 && doc.lineas[pos - 1].t === 'vacia') pos--;
  tx.insertar(ruta, pos, pos > 0 ? [{ t: 'vacia' }, ...lineas] : lineas);
  return { id: pos > 0 ? pos + 1 : pos };
}

function eliminarSeccionLista(tx, cual, id) {
  const { ruta } = LISTAS[cual];
  seccionPorId(tx, cual, id);
  const doc = tx.doc(ruta);
  let desde = id, hasta = finSeccion(doc, id);
  if (hasta === doc.lineas.length) while (desde > 0 && doc.lineas[desde - 1].t === 'vacia') desde--;
  tx.quitar(ruta, desde, hasta - desde);
}

registrar('estudio.crear', (tx, a) => {
  exigir(typeof a.horas_semana === 'number' && a.horas_semana > 0, 'Pon las horas a la semana');
  return crearSeccionLista(tx, 'estudio', a.nombre, {
    horas_semana: a.horas_semana, examen: a.examen, inicio: a.inicio ?? exigirHoy(tx), total: a.total,
  });
});
registrar('estudio.cambiar', (tx, a) => fijarClave(tx, 'estudio', a.id, a.clave, a.valor));
registrar('estudio.eliminar', (tx, a) => eliminarSeccionLista(tx, 'estudio', a.id));

registrar('proyecto.crear', (tx, a) => crearSeccionLista(tx, 'proyecto', a.nombre, {
  siguiente: textoObligatorio(a.siguiente, 'el siguiente paso'), estado: 'activo', actualizado: exigirHoy(tx),
}));
registrar('proyecto.cambiar', (tx, a) => {
  fijarClave(tx, 'proyecto', a.id, a.clave, a.valor);
  if (a.clave === 'siguiente' || a.clave === 'dejado') fijarClave(tx, 'proyecto', a.id, 'actualizado', exigirHoy(tx));
});
registrar('proyecto.eliminar', (tx, a) => eliminarSeccionLista(tx, 'proyecto', a.id));

// ---------- Onboarding ----------

/** Plantillas rápidas del primer paso del onboarding. */
export const PLANTILLAS_RAPIDAS = {
  trabajo: { titulo: 'trabajo L–V 9–17:30', entradas: [{ dias: [0, 1, 2, 3, 4], inicio: 540, fin: 1050, tipo: 'trabajo', titulo: 'Trabajo' }] },
  gimnasio: { titulo: 'gimnasio L/X/V', entradas: [{ dias: [0, 2, 4], inicio: 1080, fin: 1170, tipo: 'entreno', titulo: 'Gimnasio' }] },
};

/** Crea lo mínimo para empezar (ajustes.md, tipos.md y plantilla.md) sin pisar nada que ya exista. */
registrar('datos.inicializar', (tx, a) => {
  if (!tx.doc('ajustes.md')) {
    const doc = listaVacia('ajustes', 'Ajustes');
    for (const [clave, valor] of Object.entries(fajustes.claves).map(([k]) => [k, AJUSTES_DEFECTO_OPS[k]])) doc.lineas.push(fajustes.kv(clave, valor));
    tx.crear('ajustes.md', doc);
  }
  asegurarTipos(tx);
  tx.asegurar('plantilla.md', plantillaVacia);
  for (const nombre of listaDe(a.plantillas, 'Las plantillas')) {
    const def = typeof nombre === 'string' && Object.hasOwn(PLANTILLAS_RAPIDAS, nombre) ? PLANTILLAS_RAPIDAS[nombre] : null;
    exigir(def, 'Plantilla rápida desconocida');
    for (const e of def.entradas) {
      const ya = entidades(tx.doc('plantilla.md'), 'plantilla').some((x) => normalizar(x.titulo) === normalizar(e.titulo));
      if (!ya) tx.aplicar('plantilla.crear', e);
    }
  }
});

// ---------- Utilidades para otras operaciones ----------

export const util = {
  exigir, exigirHoy, textoObligatorio, textoOpcional, elemento, rutaSemana, semanaEditable, crearSemanaSiFalta,
  anadirBloque, anadirEnSeccion, anadirTarea, asegurarTareas, cambiarEstadoSemana, fijarClave, tipos, finUltimo,
  archivarTareas, lineasDeTareas, moverLinea, quitarSugerencias, proponerEn,
};
export { DIAS, sumarSemanas, lunesDe, sumarDias, temaDe, mismoTema, bloquesDe, las3De, temasEstudio, proyectosDe };

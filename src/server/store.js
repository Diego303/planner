// Acceso a la carpeta de datos: lectura con caché (mtime, ctime, tamaño, inodo), escritura atómica y versiones.
import { open, readFile, rename, unlink, stat, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, unlinkSync, mkdirSync, linkSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../core/formato/index.js';
import { semanaDe, sumarDias } from '../core/fechas.js';

export const TAMANO_MAXIMO = 1024 * 1024;
/** Lo que vigila el sondeo (y se lee siempre del disco): semanas a ±10 de hoy y el diario de los últimos 14 días. */
export const SEMANAS_VIGILADAS = 10;
export const DIAS_VIGILADOS = 14;
/** Lo demás se da por bueno durante este tiempo sin volver a mirar el disco. */
export const FRESCO_LEJANO = 60_000;
const RAIZ_FIJOS = ['ajustes.md', 'tipos.md', 'plantilla.md', 'tareas.md', 'estudio.md', 'proyectos.md', 'inbox.md', 'tema.md'];
const DIRECTORIOS = ['semanas', 'diario', 'archivo'];

/**
 * Firma de un fichero para la caché: mtime, ctime, tamaño e inodo. El ctime lo cambia el sistema en cada
 * escritura y ningún editor puede restaurarlo, así que una edición con el mismo tamaño y el mtime de antes
 * también invalida la caché.
 */
const firma = (st) => `${st.mtimeMs}|${st.ctimeMs}|${st.size}|${st.ino}`;

export const versionDe = (texto) => createHash('sha1').update(texto).digest('hex').slice(0, 12);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** No se pudo escribir: lleva la ruta relativa y el código del sistema (ENOSPC, EACCES…), nunca rutas absolutas. */
export class ErrorEscritura extends Error {
  constructor(ruta, causa) {
    super(`${ruta}: ${causa?.code ?? 'error'}`);
    this.ruta = ruta;
    this.code = causa?.code ?? null;
  }
}

/** El fichero cambió en disco desde que se leyó: no se escribe para no pisar ese cambio. */
export class ConflictoEscritura extends Error {
  constructor(ruta) { super(`${ruta} cambió en disco`); this.ruta = ruta; }
}

export class FicheroIgnorado extends Error {
  constructor(ruta, motivo) { super(`${ruta}: ${motivo}`); this.ruta = ruta; this.motivo = motivo; }
}

export function crearStore(carpeta) {
  const raiz = resolve(carpeta);
  const cache = new Map(); // ruta → { firma, version, doc }
  const avisos = new Map(); // ruta → motivo (ficheros ignorados)
  let contador = 0;

  /** Ruta absoluta segura: solo ficheros del planner y siempre dentro de la carpeta. */
  function absoluta(ruta) {
    if (typeof ruta !== 'string' || !tipoDeRuta(ruta)) throw new Error(`ruta no permitida: ${ruta}`);
    const abs = resolve(raiz, ruta);
    if (!abs.startsWith(raiz + sep)) throw new Error(`ruta fuera de la carpeta: ${ruta}`);
    return abs;
  }

  const existe = () => existsSync(raiz);
  const crearCarpeta = () => mkdirSync(raiz, { recursive: true });

  /**
   * Lee y parsea un fichero: { doc, version } (doc null si no existe). Lanza FicheroIgnorado si es enorme o binario.
   * `fresco` (ms): si se comprobó contra el disco hace menos, se usa la caché sin volver a hacer stat (para lo
   * lejano: semanas y diario viejos, que el sondeo tampoco vigila). Escribir siempre comprueba el disco.
   */
  async function leer(ruta, { fresco = 0 } = {}) {
    if (fresco) {
      const e = cache.get(ruta);
      if (e && Date.now() - e.comprobado < fresco) return e;
    }
    const abs = absoluta(ruta);
    const ignorar = (motivo) => { cache.delete(ruta); avisos.set(ruta, motivo); return new FicheroIgnorado(ruta, motivo); };
    let st, buf;
    try {
      st = await stat(abs);
      if (st.isDirectory()) throw ignorar('es una carpeta, no un fichero');
      const enCache = cache.get(ruta);
      if (enCache && enCache.firma === firma(st)) { enCache.comprobado = Date.now(); return enCache; }
      if (st.size > TAMANO_MAXIMO) throw ignorar('muy grande (más de 1 MB)');
      buf = await readFile(abs);
    } catch (e) {
      if (e instanceof FicheroIgnorado) throw e;
      if (e.code === 'ENOENT') { cache.delete(ruta); avisos.delete(ruta); return { doc: null, version: null }; }
      // sin permiso u otro fallo del disco: se avisa (sin rutas absolutas) y el resto sigue funcionando
      throw ignorar(['EACCES', 'EPERM'].includes(e.code) ? 'sin permiso para leerlo' : `no se puede leer (${e.code ?? 'error'})`);
    }
    if (buf.includes(0)) throw ignorar('parece binario');
    avisos.delete(ruta);
    const texto = buf.toString('utf8');
    const entrada = { firma: firma(st), version: versionDe(texto), doc: parsear(ruta, texto), comprobado: Date.now() };
    cache.set(ruta, entrada);
    return entrada;
  }

  /** Como `leer`, pero un fichero ignorado cuenta como inexistente (para pintar). */
  async function leerSeguro(ruta, opciones) {
    try { return await leer(ruta, opciones); } catch (e) {
      if (e instanceof FicheroIgnorado) return { doc: null, version: null, ignorado: e.motivo };
      throw e;
    }
  }

  // Todas las escrituras van de una en una: una operación de varios ficheros es una sola unidad.
  let cola = Promise.resolve();
  const enSerie = (tarea) => {
    const p = cola.then(tarea, tarea);
    cola = p.catch(() => {});
    return p;
  };

  async function renombrar(tmp, abs) {
    for (let intento = 0; ; intento++) {
      try { return await rename(tmp, abs); } catch (e) {
        // Windows (antivirus, indexador, OneDrive) puede bloquear el fichero un momento
        if (intento < 3 && ['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) { await esperar(60 * (intento + 1)); continue; }
        throw e;
      }
    }
  }

  /**
   * Escribe varios ficheros como una unidad: primero todos a sus temporales (con fsync) y, solo si todos
   * se han escrito, los renombra seguidos. Si falla un temporal (disco lleno, permisos…) se borran los
   * demás y no cambia nada.
   * Antes de renombrar comprueba que cada fichero sigue como se leyó (`esperada`): si alguien lo editó
   * entretanto (Obsidian, el Bloc de notas…), lanza ConflictoEscritura y tampoco cambia nada.
   * cambios: [{ ruta, texto, esperada? }] (texto null = borrar; esperada: versión leída, null = no existía,
   * undefined = no comprobar) → { ruta: versión nueva | null }
   */
  async function escribirVarios(cambios) {
    if (!existe()) throw new ErrorEscritura(cambios[0]?.ruta ?? '', Object.assign(new Error('sin carpeta'), { code: 'ENOENT' }));
    return enSerie(async () => {
      const preparados = [];
      const descartar = () => Promise.all(preparados.map((p) => (p.tmp ? unlink(p.tmp).catch(() => {}) : null)));
      let actual = null;
      try {
        for (const c of cambios) {
          actual = c.ruta;
          const p = { ...c, abs: absoluta(c.ruta), tmp: null };
          preparados.push(p);
          if (c.texto == null) continue;
          await mkdir(dirname(p.abs), { recursive: true });
          p.tmp = join(dirname(p.abs), `.${basename(p.abs)}.tmp-${process.pid}-${++contador}`);
          const fh = await open(p.tmp, 'w');
          try { await fh.writeFile(c.texto, 'utf8'); await fh.sync(); } finally { await fh.close(); }
        }
      } catch (e) {
        await descartar();
        throw new ErrorEscritura(actual, e);
      }
      // Lo que hay ahora en disco: para comprobar que nadie lo ha editado y para poder volver atrás.
      for (const p of preparados) {
        p.original = await leerOriginal(p.abs);
        if (p.esperada !== undefined && (p.original == null ? null : versionDe(p.original.toString('utf8'))) !== p.esperada) {
          cache.delete(p.ruta);
          await descartar();
          throw new ConflictoEscritura(p.ruta);
        }
      }
      // Primero los que ganan contenido y al final los que pierden: si el proceso muere entre dos rename,
      // lo que se mueve de un fichero a otro (archivar, mover) queda repetido, nunca perdido.
      const gana = (p) => (p.texto == null ? -Infinity : Buffer.byteLength(p.texto) - (p.original?.length ?? 0));
      const orden = preparados.slice().sort((a, b) => gana(b) - gana(a));
      const hechos = [];
      const versiones = {};
      for (const p of orden) {
        let choque = false;
        try {
          if (p.texto == null) await unlink(p.abs).catch((e) => { if (e.code !== 'ENOENT') throw e; });
          else if (p.esperada !== undefined) choque = await reemplazarVigilando(p);
          else { await renombrar(p.tmp, p.abs); p.tmp = null; }
        } catch (e) {
          await descartar();
          const parcial = !(await volverAtras(hechos));
          throw Object.assign(new ErrorEscritura(p.ruta, e), { parcial });
        }
        if (choque) {
          // alguien guardó entre la comprobación y el rename: su versión ya está de vuelta; lo demás, como estaba
          cache.delete(p.ruta);
          await descartar();
          await volverAtras(hechos);
          throw new ConflictoEscritura(p.ruta);
        }
        hechos.push(p);
        if (p.texto == null) { cache.delete(p.ruta); versiones[p.ruta] = null; continue; }
        const st = await stat(p.abs);
        const entrada = { firma: firma(st), version: versionDe(p.texto), doc: parsear(p.ruta, p.texto) };
        cache.set(p.ruta, entrada);
        versiones[p.ruta] = entrada.version;
      }
      return versiones;
    });
  }

  const temporal = (abs) => join(dirname(abs), `.${basename(abs)}.tmp-${process.pid}-${++contador}`);
  const SIN_ENLACES = new Set(['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV', 'EMLINK', 'ENOSYS', 'EINVAL']);

  /**
   * Pone el temporal en su sitio sin pisar lo que alguien haya guardado después de la comprobación.
   * Hay un hueco entre comprobar y renombrar: un editor que guarde justo ahí perdería su cambio. Para cerrarlo,
   * se hace un enlace duro a lo que hay en ese instante y se renombra en la misma vuelta (síncrono, sin nada en
   * medio); luego se mira el enlace: si no es lo que se comprobó, se devuelve su versión y hay conflicto.
   * Un fichero nuevo se crea con link(), que falla si otro lo ha creado entretanto.
   * Si el sistema de ficheros no tiene enlaces duros, se queda la comprobación de antes. → ¿hubo conflicto?
   */
  async function reemplazarVigilando(p) {
    if (p.original == null) {
      try { linkSync(p.tmp, p.abs); } catch (e) {
        if (e.code === 'EEXIST') return true;
        if (!SIN_ENLACES.has(e.code)) throw e;
        await renombrar(p.tmp, p.abs);
        p.tmp = null;
        return false;
      }
      await unlink(p.tmp).catch(() => {});
      p.tmp = null;
      return false;
    }
    const enlace = temporal(p.abs);
    try { linkSync(p.abs, enlace); } catch (e) {
      if (e.code === 'ENOENT') return true; // lo han borrado entretanto
      if (!SIN_ENLACES.has(e.code)) throw e;
      await renombrar(p.tmp, p.abs);
      p.tmp = null;
      return false;
    }
    try {
      try { renameSync(p.tmp, p.abs); } catch (e) {
        if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e;
        await renombrar(p.tmp, p.abs); // Windows lo tiene bloqueado un momento: con reintentos
      }
    } catch (e) {
      await unlink(enlace).catch(() => {});
      throw e;
    }
    p.tmp = null;
    const habia = await readFile(enlace);
    if (versionDe(habia.toString('utf8')) !== p.esperada) {
      await renombrar(enlace, p.abs);
      return true;
    }
    await unlink(enlace).catch(() => {});
    return false;
  }

  async function leerOriginal(abs) {
    try { return await readFile(abs); } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  /** Deja como estaban los ficheros ya escritos de una operación que ha fallado a medias. ¿Lo consiguió? */
  async function volverAtras(hechos) {
    let ok = true;
    for (const p of hechos.reverse()) {
      cache.delete(p.ruta);
      try {
        if (p.original == null) await unlink(p.abs).catch((e) => { if (e.code !== 'ENOENT') throw e; });
        else {
          const tmp = temporal(p.abs);
          const fh = await open(tmp, 'w');
          try { await fh.writeFile(p.original); await fh.sync(); } finally { await fh.close(); }
          await renombrar(tmp, p.abs);
        }
      } catch { ok = false; }
    }
    return ok;
  }

  async function escribir(ruta, doc) {
    return (await escribirVarios([{ ruta, texto: doc == null ? null : serializar(doc) }]))[ruta];
  }

  const borrar = (ruta) => escribir(ruta, null);

  /** Nombres de los ficheros del planner en un subdirectorio ('semanas' → ['2026-W45.md', …]). */
  async function listar(dir) {
    try {
      return (await readdir(join(raiz, dir))).filter((n) => tipoDeRuta(`${dir}/${n}`)).sort();
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  /**
   * Hash global para el sondeo: mtime y tamaño (sin leer) de los ficheros fijos, de las semanas cercanas a `hoy`
   * y del diario reciente, más los nombres de todo lo demás (detecta altas y bajas). En /mnt/d cada stat cuesta ~4 ms:
   * se hacen en paralelo y solo de lo que se ve.
   */
  async function versionGlobal(hoy = null) {
    const h = createHash('sha1');
    const rutas = [...RAIZ_FIJOS];
    const cercanas = hoy ? new Set(Array.from({ length: 2 * SEMANAS_VIGILADAS + 1 }, (_, i) => semanaDe(sumarDias(hoy, (i - SEMANAS_VIGILADAS) * 7)))) : null;
    const desde = hoy ? sumarDias(hoy, -DIAS_VIGILADOS) : null;
    for (const d of DIRECTORIOS) {
      for (const n of await listar(d)) {
        const ruta = `${d}/${n}`, base = n.slice(0, -3);
        const relevante = !hoy || (d === 'semanas' && cercanas.has(base)) || (d === 'diario' && base >= desde);
        if (relevante) rutas.push(ruta); else h.update(`${ruta};`);
      }
    }
    // lo que se acaba de comprobar (el estado que se está construyendo) no se vuelve a mirar
    const ahora = Date.now();
    const firmas = await Promise.all(rutas.map((r) => {
      const e = cache.get(r);
      if (e && ahora - e.comprobado < 250) return e.firma;
      return stat(join(raiz, r)).then(firma, () => null);
    }));
    rutas.forEach((r, i) => { if (firmas[i]) h.update(`${r}:${firmas[i]};`); });
    return h.digest('hex').slice(0, 12);
  }

  /** Borra temporales huérfanos de escrituras interrumpidas. */
  function limpiarTemporales() {
    for (const d of ['', ...DIRECTORIOS]) {
      let nombres = [];
      try { nombres = readdirSync(join(raiz, d)); } catch { continue; }
      for (const n of nombres) if (/^\..+\.tmp-\d+-\d+$/.test(n)) { try { unlinkSync(join(raiz, d, n)); } catch { /* en uso */ } }
    }
  }

  return { raiz, existe, crearCarpeta, leer, leerSeguro, escribir, escribirVarios, borrar, listar, versionGlobal, limpiarTemporales, avisos, absoluta };
}

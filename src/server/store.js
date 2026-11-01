// Acceso a la carpeta de datos: lectura con caché (mtime, ctime, tamaño, inodo), escritura atómica y versiones.
import { open, readFile, rename, unlink, stat, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../core/formato/index.js';
import { semanaDe, sumarDias } from '../core/fechas.js';

export const TAMANO_MAXIMO = 1024 * 1024;
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

  /** Lee y parsea un fichero: { doc, version } (doc null si no existe). Lanza FicheroIgnorado si es enorme o binario. */
  async function leer(ruta) {
    const abs = absoluta(ruta);
    let st;
    try { st = await stat(abs); } catch (e) {
      if (e.code === 'ENOENT') { cache.delete(ruta); avisos.delete(ruta); return { doc: null, version: null }; }
      throw e;
    }
    const enCache = cache.get(ruta);
    if (enCache && enCache.firma === firma(st)) return enCache;
    if (st.size > TAMANO_MAXIMO) { avisos.set(ruta, 'muy grande (más de 1 MB)'); throw new FicheroIgnorado(ruta, 'muy grande (más de 1 MB)'); }
    const buf = await readFile(abs);
    if (buf.includes(0)) { avisos.set(ruta, 'parece binario'); throw new FicheroIgnorado(ruta, 'parece binario'); }
    avisos.delete(ruta);
    const texto = buf.toString('utf8');
    const entrada = { firma: firma(st), version: versionDe(texto), doc: parsear(ruta, texto) };
    cache.set(ruta, entrada);
    return entrada;
  }

  /** Como `leer`, pero un fichero ignorado cuenta como inexistente (para pintar). */
  async function leerSeguro(ruta) {
    try { return await leer(ruta); } catch (e) {
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
        try {
          if (p.texto == null) await unlink(p.abs).catch((e) => { if (e.code !== 'ENOENT') throw e; });
          else { await renombrar(p.tmp, p.abs); p.tmp = null; }
        } catch (e) {
          await descartar();
          const parcial = !(await volverAtras(hechos));
          throw Object.assign(new ErrorEscritura(p.ruta, e), { parcial });
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
          const tmp = join(dirname(p.abs), `.${basename(p.abs)}.tmp-${process.pid}-${++contador}`);
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
    const cercanas = hoy ? new Set(Array.from({ length: 21 }, (_, i) => semanaDe(sumarDias(hoy, (i - 10) * 7)))) : null;
    const desde = hoy ? sumarDias(hoy, -60) : null;
    for (const d of DIRECTORIOS) {
      for (const n of await listar(d)) {
        const ruta = `${d}/${n}`, base = n.slice(0, -3);
        const relevante = !hoy || (d === 'semanas' && cercanas.has(base)) || (d === 'diario' && base >= desde);
        if (relevante) rutas.push(ruta); else h.update(`${ruta};`);
      }
    }
    const stats = await Promise.all(rutas.map((r) => stat(join(raiz, r)).catch(() => null)));
    rutas.forEach((r, i) => { if (stats[i]) h.update(`${r}:${firma(stats[i])};`); });
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

// Acceso a la carpeta de datos: lectura con caché por mtime+tamaño, escritura atómica y versiones.
import { open, readFile, rename, unlink, stat, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../core/formato/index.js';
import { semanaDe, sumarDias } from '../core/fechas.js';

export const TAMANO_MAXIMO = 1024 * 1024;
const RAIZ_FIJOS = ['ajustes.md', 'tipos.md', 'plantilla.md', 'tareas.md', 'estudio.md', 'proyectos.md', 'inbox.md', 'tema.md'];
const DIRECTORIOS = ['semanas', 'diario', 'archivo'];

export const versionDe = (texto) => createHash('sha1').update(texto).digest('hex').slice(0, 12);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class FicheroIgnorado extends Error {
  constructor(ruta, motivo) { super(`${ruta}: ${motivo}`); this.ruta = ruta; this.motivo = motivo; }
}

export function crearStore(carpeta) {
  const raiz = resolve(carpeta);
  const cache = new Map(); // ruta → { mtimeMs, size, version, doc }
  const colas = new Map(); // ruta → promesa de la última escritura
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

  /** Lee y parsea un fichero: { doc, version } (doc null si no existe). Lanza FicheroIgnorado si es enorme o binario. */
  async function leer(ruta) {
    const abs = absoluta(ruta);
    let st;
    try { st = await stat(abs); } catch (e) {
      if (e.code === 'ENOENT') { cache.delete(ruta); avisos.delete(ruta); return { doc: null, version: null }; }
      throw e;
    }
    const enCache = cache.get(ruta);
    if (enCache && enCache.mtimeMs === st.mtimeMs && enCache.size === st.size) return enCache;
    if (st.size > TAMANO_MAXIMO) { avisos.set(ruta, 'muy grande (más de 1 MB)'); throw new FicheroIgnorado(ruta, 'muy grande (más de 1 MB)'); }
    const buf = await readFile(abs);
    if (buf.includes(0)) { avisos.set(ruta, 'parece binario'); throw new FicheroIgnorado(ruta, 'parece binario'); }
    avisos.delete(ruta);
    const texto = buf.toString('utf8');
    const entrada = { mtimeMs: st.mtimeMs, size: st.size, version: versionDe(texto), doc: parsear(ruta, texto) };
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

  function enCola(ruta, tarea) {
    const previa = colas.get(ruta) ?? Promise.resolve();
    const siguiente = previa.catch(() => {}).then(tarea);
    colas.set(ruta, siguiente);
    return siguiente;
  }

  /** Escritura atómica: temporal → fsync → rename (con reintentos si Windows bloquea el fichero). */
  async function escribirTexto(ruta, texto) {
    const abs = absoluta(ruta);
    if (!existe()) throw new Error('La carpeta de datos no existe');
    return enCola(ruta, async () => {
      await mkdir(dirname(abs), { recursive: true });
      const tmp = join(dirname(abs), `.${basename(abs)}.tmp-${process.pid}-${++contador}`);
      const fh = await open(tmp, 'w');
      try { await fh.writeFile(texto, 'utf8'); await fh.sync(); } finally { await fh.close(); }
      for (let intento = 0; ; intento++) {
        try { await rename(tmp, abs); break; } catch (e) {
          if (intento < 3 && ['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) { await esperar(60 * (intento + 1)); continue; }
          await unlink(tmp).catch(() => {});
          throw e;
        }
      }
      const st = await stat(abs);
      const entrada = { mtimeMs: st.mtimeMs, size: st.size, version: versionDe(texto), doc: parsear(ruta, texto) };
      cache.set(ruta, entrada);
      return entrada.version;
    });
  }

  async function escribir(ruta, doc) {
    if (doc == null) return borrar(ruta);
    return escribirTexto(ruta, serializar(doc));
  }

  async function borrar(ruta) {
    const abs = absoluta(ruta);
    return enCola(ruta, async () => {
      await unlink(abs).catch((e) => { if (e.code !== 'ENOENT') throw e; });
      cache.delete(ruta);
      return null;
    });
  }

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
    rutas.forEach((r, i) => { if (stats[i]) h.update(`${r}:${stats[i].mtimeMs}:${stats[i].size};`); });
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

  return { raiz, existe, leer, leerSeguro, escribir, escribirTexto, borrar, listar, versionGlobal, limpiarTemporales, avisos, absoluta };
}

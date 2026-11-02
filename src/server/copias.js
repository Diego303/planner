// Copias de seguridad: diaria (antes de la primera escritura del día), al cerrar semana, o git local.
//
// La copia diaria va en segundo plano: con años de datos en /mnt/d, copiar la carpeta entera tarda decenas de
// segundos y no puede bloquear el servidor. Para que siga siendo la foto de antes del primer cambio, cada fichero
// que se va a escribir mientras la copia está en marcha se copia antes (en su versión de ahora) y la copia ya no
// lo vuelve a tocar. Se copia a una carpeta temporal y se renombra al final: una copia a medias nunca queda con
// nombre de copia buena.
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { fechaDe } from '../core/fechas.js';

export const MAXIMO_COPIAS = 14;
const EXCLUIDOS = new Set(['.copias', '.cache', '.git']);
const TEMPORAL = /\.tmp-\d+-\d+$/;
const PARALELO = 8;

/** Rutas relativas de todos los ficheros de la carpeta (sin .copias, .cache, .git ni temporales). */
async function listarTodo(raiz, rel = '') {
  const out = [];
  for (const e of await readdir(join(raiz, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if ((!rel && EXCLUIDOS.has(e.name)) || TEMPORAL.test(e.name)) continue;
    if (e.isDirectory()) out.push(...await listarTodo(raiz, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

export function crearCopias(raiz, { hoy = () => fechaDe(new Date()), avisar = () => {} } = {}) {
  let curso = null; // copia en marcha: { fecha, temporal, hechos: Map(ruta → promesa), promesa }
  let hecha = null; // fecha de la última copia terminada
  let error = null; // último fallo de la copia en segundo plano (se enseña hasta que una sale bien)
  let n = 0;

  /** Copia un fichero a la copia en marcha (una sola vez; si ya está copiándose, espera a esa). */
  function copiarUno(c, rel) {
    if (!c.hechos.has(rel)) {
      c.hechos.set(rel, (async () => {
        await mkdir(dirname(join(c.temporal, rel)), { recursive: true });
        try { await copyFile(join(raiz, rel), join(c.temporal, rel)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      })());
    }
    return c.hechos.get(rel);
  }

  /** Empieza la copia del día en segundo plano si aún no está hecha ni en marcha. Devuelve su promesa. */
  function empezar() {
    const fecha = hoy();
    if (curso?.fecha === fecha) return curso.promesa;
    if (hecha === fecha || !existsSync(raiz)) return Promise.resolve(false);
    const destino = join(raiz, '.copias', fecha);
    if (existsSync(destino)) { hecha = fecha; return Promise.resolve(false); }
    const c = { fecha, temporal: join(raiz, '.copias', `.${fecha}.tmp-${process.pid}-${++n}`), hechos: new Map() };
    c.promesa = (async () => {
      try {
        await mkdir(c.temporal, { recursive: true });
        const rutas = await listarTodo(raiz);
        for (let i = 0; i < rutas.length; i += PARALELO) await Promise.all(rutas.slice(i, i + PARALELO).map((r) => copiarUno(c, r)));
        await Promise.all(c.hechos.values()); // y las que se copiaron antes de escribir
        await rename(c.temporal, destino);
        hecha = fecha;
        error = null;
        rotar();
        return true;
      } catch (e) {
        error = e;
        await rm(c.temporal, { recursive: true, force: true }).catch(() => {});
        throw e;
      } finally {
        if (curso === c) curso = null;
      }
    })();
    c.promesa.catch((e) => avisar(`No se pudo hacer la copia de seguridad: ${e.code ?? e.message}`));
    curso = c;
    return c.promesa;
  }

  /** Deja solo las MAXIMO_COPIAS copias más recientes (y borra restos de copias interrumpidas). */
  function rotar() {
    const dir = join(raiz, '.copias');
    let nombres = [];
    try { nombres = readdirSync(dir); } catch { return; }
    for (const x of nombres.filter((y) => /^\.\d{4}-\d{2}-\d{2}\.tmp-/.test(y) && !(curso && join(dir, y) === curso.temporal))) {
      rmSync(join(dir, x), { recursive: true, force: true });
    }
    const copias = nombres.filter((y) => /^\d{4}-\d{2}-\d{2}$/.test(y)).sort().reverse();
    for (const viejo of copias.slice(MAXIMO_COPIAS)) rmSync(join(dir, viejo), { recursive: true, force: true });
  }

  function git(args) {
    return new Promise((ok, mal) => execFile('git', ['-C', raiz, ...args], { timeout: 20000 }, (e, so, se) => (e ? mal(Object.assign(e, { stderr: se })) : ok(so))));
  }

  /** Modo git: repositorio local en la carpeta de datos y un commit por cierre de día. Nunca hay remoto. */
  async function commitDelDia(fecha) {
    try {
      if (!existsSync(join(raiz, '.git'))) {
        await git(['init', '-q']);
        if (!existsSync(join(raiz, '.gitignore'))) writeFileSync(join(raiz, '.gitignore'), '.copias/\n.cache/\n.*.tmp-*\n');
      }
      await git(['add', '-A']);
      await git(['-c', 'user.name=planner', '-c', 'user.email=planner@localhost', 'commit', '-q', '-m', `cierre del día ${fecha}`]);
    } catch (e) {
      if (!/nothing to commit|nada para hacer commit/.test(`${e.stderr}${e.message}`)) avisar(`No se pudo hacer el commit local: ${e.message}`);
    }
  }

  const tocaCopia = (modo, op) => modo === 'diaria' || (modo === 'al cerrar semana' && op === 'semana.cerrar');

  /**
   * Antes de escribir `rutas` por una operación: empieza la copia del día si toca y, si está en marcha, copia antes
   * esos ficheros (su versión de antes del cambio). Si eso falla (disco lleno), lanza: se guarda igual y se avisa.
   */
  async function antesDeEscribir(modo, op, rutas = []) {
    if (!tocaCopia(modo, op)) return;
    empezar();
    const c = curso;
    if (c) await Promise.all(rutas.map((r) => copiarUno(c, r)));
    else if (error && hecha !== hoy()) throw error;
  }

  /** Se llama después de escribir por una operación. */
  async function despuesDeEscribir(modo, op, ctx) {
    if (modo === 'git' && op === 'dia.cerrar') await commitDelDia(ctx.hoy);
  }

  /** Espera a que termine la copia en marcha (al parar el servidor y en las pruebas). */
  const esperar = () => (curso ? curso.promesa.catch(() => false) : Promise.resolve(false));

  return { empezar, rotar, antesDeEscribir, despuesDeEscribir, commitDelDia, esperar, error: () => error };
}

// Copias de seguridad: diaria (antes de la primera escritura del día), al cerrar semana, o git local.
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { fechaDe } from '../core/fechas.js';

export const MAXIMO_COPIAS = 14;
const EXCLUIDOS = new Set(['.copias', '.cache', '.git']);

export function crearCopias(raiz, { hoy = () => fechaDe(new Date()), avisar = () => {} } = {}) {
  let ultimaCopia = null;

  /** Copia la carpeta (sin .copias, .cache ni .git) a .copias/AAAA-MM-DD/ si aún no hay copia de hoy. */
  function copiaDelDia() {
    const fecha = hoy();
    if (ultimaCopia === fecha) return false;
    const destino = join(raiz, '.copias', fecha);
    if (!existsSync(destino) && existsSync(raiz)) {
      // Entrada a entrada: cpSync no deja copiar una carpeta dentro de sí misma aunque se filtre.
      for (const nombre of readdirSync(raiz)) {
        if (EXCLUIDOS.has(nombre) || /\.tmp-\d+-\d+$/.test(nombre)) continue;
        cpSync(join(raiz, nombre), join(destino, nombre), {
          recursive: true,
          filter: (origen) => !/\.tmp-\d+-\d+$/.test(origen),
        });
      }
      rotar();
    }
    ultimaCopia = fecha;
    return true;
  }

  /** Deja solo las MAXIMO_COPIAS copias más recientes. */
  function rotar() {
    const dir = join(raiz, '.copias');
    let nombres = [];
    try { nombres = readdirSync(dir); } catch { return; }
    const copias = nombres.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort().reverse();
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

  /** Se llama antes de escribir por una operación. */
  function antesDeEscribir(modo, op) {
    if (modo === 'diaria' || (modo === 'al cerrar semana' && op === 'semana.cerrar')) copiaDelDia();
  }

  /** Se llama después de escribir por una operación. */
  async function despuesDeEscribir(modo, op, ctx) {
    if (modo === 'git' && op === 'dia.cerrar') await commitDelDia(ctx.hoy);
  }

  return { copiaDelDia, rotar, antesDeEscribir, despuesDeEscribir, commitDelDia };
}

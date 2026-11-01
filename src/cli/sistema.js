// Piezas de sistema de la CLI: fichero PID, puerto libre, abrir el navegador y copia de ejemplo/.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync, cpSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ---------- PID ----------

export const dirPlanner = () => process.env.PLANNER_HOME || join(homedir(), '.planner');
const rutaPid = () => join(dirPlanner(), 'pid');

export function leerPid() {
  try {
    const p = JSON.parse(readFileSync(rutaPid(), 'utf8'));
    return Number.isInteger(p.pid) ? p : null;
  } catch { return null; }
}

export function escribirPid(info) {
  mkdirSync(dirPlanner(), { recursive: true });
  writeFileSync(rutaPid(), JSON.stringify(info));
}

export function borrarPid(pid = process.pid) {
  const p = leerPid();
  if (p && p.pid === pid) rmSync(rutaPid(), { force: true });
}

export function vivo(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** ¿Responde un planner en ese puerto? Devuelve su /api/salud o null. */
export async function salud(puerto) {
  try {
    const r = await fetch(`http://127.0.0.1:${puerto}/api/salud`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    return j.app === 'planner' ? j : null;
  } catch { return null; }
}

// ---------- Puerto ----------

const libre = (puerto, host) => new Promise((ok) => {
  const s = createServer();
  s.once('error', () => ok(false));
  s.listen(puerto, host, () => s.close(() => ok(true)));
});

/** El puerto pedido o el siguiente libre (hasta 20 más). 0 = lo elige el sistema. */
export async function puertoLibre(desde, host = '127.0.0.1') {
  if (desde === 0) return 0;
  for (let p = desde; p < desde + 20 && p <= 65535; p++) if (await libre(p, host)) return p;
  throw new Error(`No hay puertos libres entre ${desde} y ${desde + 19}`);
}

// ---------- Navegador ----------

export const esWSL = () => !!process.env.WSL_DISTRO_NAME || (() => {
  try { return /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { return false; }
})();

function lanzar(cmd, args) {
  return new Promise((ok) => {
    try {
      const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
      p.once('error', () => ok(false));
      p.once('spawn', () => { p.unref(); ok(true); });
    } catch { ok(false); }
  });
}

/** Abre la URL: wslview → explorer.exe en WSL; xdg-open/open/start fuera. Devuelve si lo consiguió. */
export async function abrirNavegador(url) {
  const intentos = esWSL()
    ? [['wslview', [url]], ['explorer.exe', [url]], ['cmd.exe', ['/c', 'start', '', url]]]
    : process.platform === 'darwin' ? [['open', [url]]]
      : process.platform === 'win32' ? [['cmd', ['/c', 'start', '', url]]]
        : [['xdg-open', [url]]];
  for (const [cmd, args] of intentos) if (await lanzar(cmd, args)) return true;
  return false;
}

// ---------- Datos ----------

export const CARPETA_POR_DEFECTO = '/mnt/d/planner';
export const RAIZ_EJEMPLO = fileURLToPath(new URL('../../ejemplo/', import.meta.url));

/** Copia ejemplo/ a un directorio temporal nuevo y devuelve su ruta. */
export function copiarEjemplo() {
  const destino = mkdtempSync(join(tmpdir(), 'planner-ejemplo-'));
  cpSync(RAIZ_EJEMPLO, destino, { recursive: true });
  return destino;
}

export const existe = existsSync;

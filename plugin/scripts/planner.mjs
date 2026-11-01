#!/usr/bin/env node
// Ayudas del plugin (sin dependencias): localizar la carpeta de datos, hacer la copia antes de escribir y
// listar semanas con su estado para no tocar las cerradas.
//   node planner.mjs carpeta [ruta]     → carpeta de datos
//   node planner.mjs copia [ruta]       → copia en .copias/AAAA-MM-DD-plugin-HHMMSS/ (se guardan 10)
//   node planner.mjs semanas [ruta]     → semanas y si se pueden tocar
//   node planner.mjs hoy                → fecha local y semana ISO
import { existsSync, readFileSync, readdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const dos = (n) => String(n).padStart(2, '0');
const ahora = new Date();
const hoy = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;

function semanaISO(fecha) {
  const d = new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)));
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia + 3);
  const año = d.getUTCFullYear();
  const ene4 = new Date(Date.UTC(año, 0, 4));
  const n = 1 + Math.round(((d - ene4) / 86400000 - 3 + ((ene4.getUTCDay() + 6) % 7)) / 7);
  return `${año}-W${dos(n)}`;
}

function carpeta(arg) {
  if (arg) return resolve(arg);
  if (process.env.PLANNER_DATOS) return resolve(process.env.PLANNER_DATOS);
  try {
    const pid = JSON.parse(readFileSync(join(process.env.PLANNER_HOME || join(homedir(), '.planner'), 'pid'), 'utf8'));
    if (pid.datos) return pid.datos;
  } catch { /* sin instancia en marcha */ }
  return '/mnt/d/planner';
}

function copia(dir) {
  if (!existsSync(dir)) throw new Error(`No existe ${dir}`);
  const marca = `${hoy}-plugin-${dos(ahora.getHours())}${dos(ahora.getMinutes())}${dos(ahora.getSeconds())}`;
  const destino = join(dir, '.copias', marca);
  for (const n of readdirSync(dir)) {
    if (['.copias', '.cache', '.git'].includes(n) || /\.tmp-\d+-\d+$/.test(n)) continue;
    cpSync(join(dir, n), join(destino, n), { recursive: true });
  }
  const viejas = readdirSync(join(dir, '.copias')).filter((n) => /^\d{4}-\d{2}-\d{2}-plugin-\d{6}$/.test(n)).sort().reverse().slice(10);
  for (const v of viejas) rmSync(join(dir, '.copias', v), { recursive: true, force: true });
  return destino;
}

function semanas(dir) {
  const actual = semanaISO(hoy);
  const d = join(dir, 'semanas');
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((n) => /^\d{4}-W\d{2}\.md$/.test(n)).sort().map((n) => {
    const id = n.slice(0, -3);
    const m = /^estado:\s*(.+?)\s*(?:\s{2,}#.*)?$/m.exec(readFileSync(join(d, n), 'utf8'));
    const guardado = m?.[1] ?? '';
    const cerrada = guardado === 'cerrada';
    const estado = cerrada || guardado === 'reabierta' ? guardado : id === actual ? 'en curso' : id < actual ? 'sin cerrar' : 'futura';
    return `${id}\t${estado}\t${cerrada ? 'NO TOCAR (cerrada)' : 'se puede editar'}`;
  });
}

const [orden, arg] = process.argv.slice(2);
try {
  if (orden === 'carpeta') {
    const dir = carpeta(arg);
    console.log(dir);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`(no existe: ${dir})`); process.exitCode = 2; }
  } else if (orden === 'copia') console.log(copia(carpeta(arg)));
  else if (orden === 'semanas') console.log(semanas(carpeta(arg)).join('\n'));
  else if (orden === 'hoy') console.log(`${hoy}\t${semanaISO(hoy)}`);
  else { console.error('uso: planner.mjs carpeta|copia|semanas|hoy [ruta]'); process.exitCode = 1; }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

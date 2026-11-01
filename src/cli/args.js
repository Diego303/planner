// Lectura de argumentos de la CLI.
import { esFecha } from '../core/fechas.js';

export const AYUDA = `Uso: planner [start|stop|status] [opciones]

  planner                 arranca el servidor (http://localhost:4321) y abre el navegador
  planner stop            para el planner que esté en marcha
  planner status          dice si está en marcha, en qué puerto y con qué carpeta

Opciones:
  --datos <ruta>          carpeta de datos (por defecto /mnt/d/planner o $PLANNER_DATOS)
  --puerto <n>            puerto (por defecto el de ajustes.md o 4321; si está ocupado, el siguiente libre)
  --silencioso            no abre el navegador
  --ejemplo               trabaja sobre una copia temporal de ejemplo/ (nunca toca tus datos)
  --hoy <AAAA-MM-DD>      simula la fecha de hoy (desarrollo y demos)
  --version, --ayuda`;

export class ErrorArgs extends Error {}

export function parsearArgs(argv) {
  const o = { comando: 'start', datos: null, puerto: null, silencioso: false, ejemplo: false, hoy: null, ayuda: false, version: false };
  const valor = (i, nombre) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new ErrorArgs(`Falta el valor de ${nombre}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['start', 'stop', 'status'].includes(a) && i === 0) o.comando = a;
    else if (a === '--datos') { o.datos = valor(i, a); i++; }
    else if (a.startsWith('--datos=')) o.datos = a.slice(8);
    else if (a === '--puerto' || a.startsWith('--puerto=')) {
      const v = a.includes('=') ? a.split('=')[1] : valor(i, a);
      if (!a.includes('=')) i++;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 65535) throw new ErrorArgs(`Puerto no válido: ${v}`);
      o.puerto = n;
    } else if (a === '--hoy' || a.startsWith('--hoy=')) {
      const v = a.includes('=') ? a.split('=')[1] : valor(i, a);
      if (!a.includes('=')) i++;
      if (!esFecha(v)) throw new ErrorArgs(`Fecha no válida: ${v} (usa AAAA-MM-DD)`);
      o.hoy = v;
    } else if (a === '--silencioso') o.silencioso = true;
    else if (a === '--ejemplo') o.ejemplo = true;
    else if (a === '--ayuda' || a === '-h' || a === '--help') o.ayuda = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else throw new ErrorArgs(`Opción desconocida: ${a}`);
  }
  if (o.ejemplo && o.datos) throw new ErrorArgs('--ejemplo y --datos no se pueden usar juntos');
  return o;
}

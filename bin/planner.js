#!/usr/bin/env node
// CLI del planner: start (por defecto) | stop | status.
import { readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parsearArgs, AYUDA, ErrorArgs } from '../src/cli/args.js';
import {
  leerPid, escribirPid, borrarPid, vivo, salud, puertoLibre, abrirNavegador, copiarEjemplo, CARPETA_POR_DEFECTO, existe,
} from '../src/cli/sistema.js';
import { arrancar } from '../src/server/index.js';
import { parsear } from '../src/core/formato/index.js';
import { valoresAjustes } from '../src/core/modelo.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function puertoDeAjustes(datos) {
  try { return valoresAjustes(parsear('ajustes.md', readFileSync(join(datos, 'ajustes.md'), 'utf8'))).puerto; } catch { return null; }
}

/** Instancia normal en marcha (según el fichero PID y /api/salud) o null. */
async function enMarcha() {
  const p = leerPid();
  if (!p || !vivo(p.pid)) return null;
  const s = await salud(p.puerto);
  return s && s.pid === p.pid ? { ...p, ...s } : null;
}

async function start(o) {
  if (!o.ejemplo) {
    const previa = await enMarcha();
    if (previa) {
      const pedida = resolve(o.datos ?? process.env.PLANNER_DATOS ?? CARPETA_POR_DEFECTO);
      if (pedida !== previa.datos) {
        console.error(`Ya hay un planner en marcha con otra carpeta (${previa.datos}). Páralo con «planner stop».`);
        process.exit(1);
      }
      const url = `http://localhost:${previa.puerto}/`;
      console.log(`planner ya está en marcha en ${url}`);
      if (!o.silencioso) await abrirNavegador(url);
      return;
    }
  }

  const datos = o.ejemplo ? copiarEjemplo() : resolve(o.datos ?? process.env.PLANNER_DATOS ?? CARPETA_POR_DEFECTO);
  const preferido = o.puerto ?? puertoDeAjustes(datos) ?? 4321;
  const puerto = await puertoLibre(preferido);
  if (preferido && puerto !== preferido) {
    console.warn(`⚠ El puerto ${preferido} está ocupado: uso el ${puerto}. Si instalaste planner como app, ábrelo desde el navegador.`);
  }
  const app = await arrancar({ datos, puerto, hoySimulado: o.hoy });
  if (!o.ejemplo) escribirPid({ pid: process.pid, puerto: app.puerto, datos });

  console.log(`planner ${pkg.version} en ${app.url}`);
  console.log(`datos: ${datos}${o.ejemplo ? '  (copia temporal de ejemplo/)' : ''}${existe(datos) ? '' : '  (no existe: el planner te ofrecerá crearla)'}`);
  if (o.hoy) console.log(`fecha simulada: ${o.hoy}`);
  console.log('Ctrl+C para parar');
  if (!o.silencioso && !(await abrirNavegador(app.url))) console.log(`Abre ${app.url} en el navegador.`);

  const salir = async () => {
    if (o.ejemplo) rmSync(datos, { recursive: true, force: true }); // la copia temporal no se reutiliza
    else borrarPid();
    await app.cerrar();
    process.exit(0);
  };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}

async function stop() {
  const p = leerPid();
  if (!p || !vivo(p.pid)) {
    borrarPid(p?.pid);
    console.log('planner no está en marcha');
    return;
  }
  process.kill(p.pid, 'SIGTERM');
  for (let i = 0; i < 30 && vivo(p.pid); i++) await new Promise((r) => setTimeout(r, 100));
  console.log(vivo(p.pid) ? `No se pudo parar el proceso ${p.pid}` : 'planner parado');
}

async function status() {
  const p = await enMarcha();
  if (!p) { console.log('planner parado'); process.exitCode = 3; return; }
  console.log(`planner en marcha en http://localhost:${p.puerto}/ · datos: ${p.datos} · pid ${p.pid}`);
}

try {
  const o = parsearArgs(process.argv.slice(2));
  if (o.version) console.log(pkg.version);
  else if (o.ayuda) console.log(AYUDA);
  else if (o.comando === 'stop') await stop();
  else if (o.comando === 'status') await status();
  else await start(o);
} catch (e) {
  if (e instanceof ErrorArgs) { console.error(`${e.message}\n\n${AYUDA}`); process.exit(2); }
  console.error(`planner: ${e.message}`);
  process.exit(1);
}

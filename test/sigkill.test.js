// Q3 · 200 SIGKILL a mitad de escritura: ningún fichero queda a medias y ninguna tarea confirmada se pierde.
// PLANNER_SIGKILL=<n> cambia el número de muertes: 40 en «pnpm test», 200 en «pnpm test:todo» (en 4 carpetas a la vez).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';
import { crearStore } from '../src/server/store.js';
import { copiaEjemplo } from './ayudas.js';
import { crearAzar } from './azar.js';

const MUERTES = Number(process.env.PLANNER_SIGKILL ?? 40);
const CARPETAS = 4;
const HIJO = new URL('./sigkill-hijo.js', import.meta.url).pathname;

function ficheros(dir) {
  const out = {};
  for (const d of ['', 'semanas', 'diario', 'archivo']) {
    if (!existsSync(join(dir, d))) continue;
    for (const n of readdirSync(join(dir, d))) if (tipoDeRuta(d ? `${d}/${n}` : n)) out[d ? `${d}/${n}` : n] = readFileSync(join(dir, d, n), 'utf8');
  }
  return out;
}
const desconocidas = (fs) => Object.entries(fs).reduce((s, [r, t]) => s + parsear(r, t).lineas.filter((l) => l.t === '?').length, 0);

/** Arranca el hijo y lo mata con SIGKILL `ms` milisegundos después de que esté listo. Devuelve los índices confirmados. */
function vivirYMorir(dir, desde, ms) {
  return new Promise((ok, mal) => {
    const hijo = spawn(process.execPath, [HIJO, dir, String(desde)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const creadas = [];
    let salida = '', errores = '';
    hijo.stdout.on('data', (d) => {
      salida += d;
      const lineas = salida.split('\n');
      salida = lineas.pop();
      for (const l of lineas) {
        if (l === 'listo') setTimeout(() => hijo.kill('SIGKILL'), ms);
        else if (l.startsWith('creada ')) creadas.push(Number(l.slice(7)));
      }
    });
    hijo.stderr.on('data', (d) => { errores += d; });
    hijo.on('exit', (code, senal) => (senal === 'SIGKILL' ? ok(creadas) : mal(new Error(`el hijo terminó solo (${code}): ${errores}`))));
  });
}

test(`${MUERTES} SIGKILL a mitad de escritura: nada a medias ni perdido`, { timeout: 600_000 }, async () => {
  const azar = crearAzar();
  const porCarpeta = Math.ceil(MUERTES / CARPETAS);
  await Promise.all(Array.from({ length: CARPETAS }, async () => {
    const c = copiaEjemplo('planner-sigkill-');
    try {
      const base = desconocidas(ficheros(c.dir));
      const confirmadas = [];
      let siguiente = 0;
      for (let k = 0; k < porCarpeta; k++) {
        const creadas = await vivirYMorir(c.dir, siguiente, azar.entero(0, 400));
        confirmadas.push(...creadas);
        siguiente = Math.max(siguiente, ...creadas.map((i) => i + 1)) + 1; // día nuevo para el siguiente hijo
        const fs = ficheros(c.dir);
        for (const [ruta, texto] of Object.entries(fs)) assert.equal(serializar(parsear(ruta, texto)), texto, ruta);
        assert.equal(desconocidas(fs), base, 'ninguna línea a medias');
        const todo = Object.entries(fs).filter(([r]) => r === 'tareas.md' || r.startsWith('archivo/')).map(([, t]) => t).join('\n');
        for (const i of confirmadas) assert.ok(todo.includes(`T${i} tarea de prueba`), `T${i} se ha perdido (muerte ${k})`);
      }
      // al arrancar se limpian los temporales que dejó la última muerte
      crearStore(c.dir).limpiarTemporales();
      const tmp = ['', 'semanas', 'diario', 'archivo'].flatMap((d) => (existsSync(join(c.dir, d)) ? readdirSync(join(c.dir, d)) : [])).filter((n) => n.includes('.tmp-'));
      assert.deepEqual(tmp, []);
      assert.ok(confirmadas.length > porCarpeta / 2, `pocas tareas confirmadas: ${confirmadas.length}`);
    } finally { c.borrar(); }
  }));
});

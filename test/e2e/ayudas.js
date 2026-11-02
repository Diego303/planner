// Fixtures de los e2e: servidor propio sobre una copia de ejemplo/ (o una carpeta vacía) y página vigilada.
import { test as base, expect } from '@playwright/test';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arrancar } from '../../src/server/index.js';
import { generar } from '../rendimiento/generar.js';

export const EJEMPLO = fileURLToPath(new URL('../../ejemplo/', import.meta.url));
export const HOY = '2026-11-02'; // lunes de la semana 45 del ejemplo

/** Servidor sobre una copia nueva. `datos: 'vacia'` (carpeta vacía) o `'inexistente'` para el onboarding; `'tres-años'` para rendimiento. */
export async function servidor({ datos = 'ejemplo', hoy = HOY } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'planner-e2e-'));
  // 'inexistente': la carpeta de datos aún no existe (se crea en el primer paso del onboarding)
  const dir = datos === 'inexistente' ? join(base, 'mis datos') : base;
  if (datos === 'ejemplo') cpSync(EJEMPLO, dir, { recursive: true });
  if (datos === 'tres-años') generar(dir, { hoy });
  let app = await arrancar({ datos: dir, puerto: 0, hoySimulado: hoy });
  const puerto = app.puerto;
  const s = {
    dir,
    get url() { return `http://localhost:${puerto}/`; },
    leer: (ruta) => (existsSync(join(dir, ruta)) ? readFileSync(join(dir, ruta), 'utf8') : null),
    /** Escribe como un editor externo (temporal + rename). */
    escribir(ruta, texto) {
      mkdirSync(dirname(join(dir, ruta)), { recursive: true });
      writeFileSync(join(dir, `${ruta}.editor`), texto);
      renameSync(join(dir, `${ruta}.editor`), join(dir, ruta));
    },
    async parar() { await app.cerrar(); app = null; },
    async volver() { app = await arrancar({ datos: dir, puerto, hoySimulado: hoy }); },
    async cerrar() { if (app) await app.cerrar(); rmSync(base, { recursive: true, force: true }); },
  };
  return s;
}

export const test = base.extend({
  datos: ['ejemplo', { option: true }],
  hoy: [HOY, { option: true }],
  app: async ({ datos, hoy }, use) => {
    const s = await servidor({ datos, hoy });
    await use(s);
    await s.cerrar();
  },
  // Cero errores en la consola y ninguna excepción sin capturar, en todos los tests.
  page: async ({ page, app, hoy }, use, info) => {
    const errores = [];
    page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    page.on('dialog', (d) => { errores.push(`dialog: ${d.message()}`); d.dismiss(); });
    // la hora del navegador fija (lunes 2 de noviembre a las 10:00): «ahora» y los toasts son deterministas
    await page.clock.setFixedTime(new Date(`${hoy}T10:00:00`));
    page.permitirErrores = (re) => { page.erroresPermitidos = re; };
    await use(page);
    const quedan = errores.filter((e) => !(page.erroresPermitidos && page.erroresPermitidos.test(e)));
    expect(quedan, `errores en la página (${info.title})`).toEqual([]);
  },
});

export { expect };

/** Abre la app y espera a que pinte la semana. */
export async function abrir(page, app) {
  await page.goto(app.url);
  await expect(page.locator('#wk .rejilla')).toBeVisible();
}

/** Bloque de la rejilla por su título (el primero). */
export const bloque = (page, titulo) => page.locator('#wk .blk', { hasText: titulo }).first();

/** Espera a que el servidor haya guardado (la cola de operaciones vacía) mirando el fichero. */
export async function esperarFichero(app, ruta, comprobar, ms = 5000) {
  const fin = Date.now() + ms;
  let ultimo;
  for (;;) {
    ultimo = app.leer(ruta);
    if (comprobar(ultimo)) return ultimo;
    if (Date.now() > fin) throw new Error(`${ruta} no llegó a cumplir la condición. Contenido:\n${ultimo}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

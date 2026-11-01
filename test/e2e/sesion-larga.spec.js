// e2e · Sesión larga con tres años de datos: operaciones al azar y el sondeo activo durante PLANNER_SESION_MIN minutos
// (30 para la prueba completa; «pnpm test:todo» usa 3). Ni el servidor ni la pestaña crecen en memoria, y no se
// acumulan nodos, listeners ni timers. Sin PLANNER_SESION_MIN, se salta.
import { test, expect, abrir } from './ayudas.js';
import v8 from 'node:v8';
import { crearAzar } from '../azar.js';

const MINUTOS = Number(process.env.PLANNER_SESION_MIN ?? 0);
test.use({ datos: 'tres-años' });
test.skip(!MINUTOS, 'solo con PLANNER_SESION_MIN');

test(`sesión de ${MINUTOS} min sin fugas`, async ({ page, app }) => {
  test.setTimeout((MINUTOS + 8) * 60_000);
  // timers vivos de la página (setTimeout pendientes + setInterval activos)
  await page.addInitScript(() => {
    const vivos = new Set();
    const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
    window.setTimeout = (fn, ms, ...a) => { const id = st(() => { vivos.delete(id); typeof fn === 'function' ? fn(...a) : 0; }, ms); vivos.add(id); return id; };
    window.clearTimeout = (id) => { vivos.delete(id); ct(id); };
    window.setInterval = (...a) => { const id = si(...a); vivos.add(id); return id; };
    window.clearInterval = (id) => { vivos.delete(id); ci(id); };
    window.__timers = () => vivos.size;
  });
  await abrir(page, app);
  page.setDefaultTimeout(5000); // una acción que no aplica falla rápido en vez de esperar sin fin
  const cdp = await page.context().newCDPSession(page);
  const medir = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters');
    globalThis.gc?.();
    return { pestaña: usedSize, nodos: dom.nodes, listeners: dom.jsEventListeners, timers: await page.evaluate(() => window.__timers()), servidor: v8.getHeapStatistics().used_heap_size };
  };
  const azar = crearAzar(7);
  const acciones = [
    async () => { await page.locator('#cap').fill(`tarea ${azar.entero(1, 1e6)} mañana`); await page.keyboard.press('Enter'); },
    async () => page.locator('#seg').getByRole('button', { name: azar.elegir(['Semana', 'Hoy', 'Progreso']) }).click(),
    async () => { await page.locator('#seg').getByRole('button', { name: 'Semana' }).click(); await page.getByRole('button', { name: azar.elegir(['Semana anterior', 'Semana siguiente', 'hoy']) }).click(); },
    async () => { await page.locator('#gbtn').click(); await page.locator('#gmenu').getByRole('menuitem', { name: azar.elegir([/Ajustes/, /Tipos/, /^Semanas/]) }).click(); await page.keyboard.press('Escape'); },
    async () => { await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click(); const b = page.locator('#hoy-tareas [data-marcar]').first(); if (await b.count()) await b.click(); },
    async () => { await page.locator('#drawer [role=tab]').nth(azar.entero(0, 1)).click().catch(() => {}); },
  ];
  const muestras = [];
  // reloj monotónico: en WSL el de pared salta (se ajusta con el de Windows) y alargaba el bucle
  const ahora = () => performance.now();
  const fin = ahora() + MINUTOS * 60_000;
  let siguiente = ahora() + 60_000;
  const anotar = async () => { const x = await medir(); muestras.push(x); console.log('muestra', muestras.length - 1, JSON.stringify(x)); };
  await anotar();
  while (ahora() < fin) {
    await azar.elegir(acciones)().catch(() => {}); // una acción que no aplica (p. ej. sin tareas) no cuenta
    await page.waitForTimeout(azar.entero(200, 1500));
    if (ahora() > siguiente) { await anotar(); siguiente += 60_000; }
  }
  await page.locator('#seg').getByRole('button', { name: 'Semana' }).click();
  await page.getByRole('button', { name: 'hoy', exact: true }).click();
  await page.waitForTimeout(3000);
  muestras.push(await medir());
  console.log(JSON.stringify(muestras.map((m) => ({ ...m, pestaña: Math.round(m.pestaña / 1e6 * 10) / 10, servidor: Math.round(m.servidor / 1e6 * 10) / 10 }))));
  const [base, ultima] = [muestras[Math.min(1, muestras.length - 1)], muestras.at(-1)];
  expect(ultima.pestaña, 'memoria de la pestaña').toBeLessThan(base.pestaña * 1.3 + 2e6);
  expect(ultima.servidor, 'memoria del servidor').toBeLessThan(base.servidor * 1.3 + 5e6);
  expect(ultima.listeners, 'listeners').toBeLessThanOrEqual(base.listeners + 20);
  expect(ultima.nodos, 'nodos del DOM').toBeLessThan(base.nodos * 1.5 + 200);
  expect(ultima.timers, 'timers vivos').toBeLessThanOrEqual(6);
});

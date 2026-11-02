// e2e · Rendimiento con tres años de datos: pintar, Progreso y el sondeo (que no escribe ni recarga solo).
import { test, expect, abrir } from './ayudas.js';
import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test.use({ datos: 'tres-años' });

/** Milisegundos que tarda el clic en la pestaña en pintar la vista (se pinta de forma síncrona en el clic). */
const pintar = (page, vista) => page.evaluate((v) => {
  const t = performance.now();
  document.querySelector(`#seg [data-vista="${v}"]`).click();
  return performance.now() - t;
}, vista);

test('pintar la Semana < 50 ms y Progreso < 200 ms (mediana de 7) @tiempo', async ({ page, app }) => {
  const lentos = [];
  page.on('console', (m) => { if (/pintar tardó/.test(m.text())) lentos.push(m.text()); });
  await abrir(page, app);
  const medidas = { semana: [], progreso: [], hoy: [] };
  for (let i = 0; i < 7; i++) {
    medidas.progreso.push(await pintar(page, 'progreso'));
    medidas.hoy.push(await pintar(page, 'hoy'));
    medidas.semana.push(await pintar(page, 'semana'));
  }
  const mediana = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const m = Object.fromEntries(Object.entries(medidas).map(([k, v]) => [k, Math.round(mediana(v))]));
  console.log('pintar (ms)', JSON.stringify(m));
  expect(m.semana).toBeLessThan(50);
  expect(m.hoy).toBeLessThan(50);
  expect(m.progreso).toBeLessThan(200);
  // navegar de semana también (carga del servidor + pintar)
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 44');
  expect(Date.now() - t0).toBeLessThan(500);
});

test('el sondeo no escribe nada en disco ni recarga el estado si no cambia nada @tiempo', async ({ page, app }) => {
  const peticiones = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) peticiones.push(new URL(r.url()).pathname); });
  await abrir(page, app);
  await page.waitForTimeout(1500);
  const firmas = () => {
    const out = {};
    for (const d of ['', 'semanas', 'diario', 'archivo']) for (const n of readdirSync(join(app.dir, d))) {
      if (n.startsWith('.copias')) continue;
      const st = statSync(join(app.dir, d, n));
      if (st.isFile()) out[`${d}/${n}`] = `${st.mtimeMs}|${st.size}`;
    }
    return out;
  };
  const antes = firmas();
  peticiones.length = 0;
  await page.waitForTimeout(9000); // unos 4 sondeos
  expect(firmas()).toEqual(antes);
  const version = peticiones.filter((p) => p === '/api/version').length;
  expect(version).toBeGreaterThanOrEqual(3);
  expect(peticiones.filter((p) => p !== '/api/version'), 'nada más que el sondeo').toEqual([]);
});

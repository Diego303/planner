// Diseño adaptable: anchos 1024/1280/1440/1920 y zoom del navegador 80/125/200 % (zoom Z en un ancho W = ventana W/Z
// con densidad Z). Nada se sale en horizontal, nada se solapa en la cabecera y los popovers y modales caben.
import { test, expect, abrir, bloque } from '../e2e/ayudas.js';

const ANCHOS = [1024, 1280, 1440, 1920];
const ZOOMS = [0.8, 1, 1.25, 2];

/** Rectángulos que se solapan entre sí (por selector). */
const solapes = (page, selectores) => page.evaluate((sels) => {
  const r = sels.map((s) => [s, document.querySelector(s)?.getBoundingClientRect()]).filter(([, x]) => x && x.width && x.height);
  const out = [];
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const [a, A] = r[i], [b, B] = r[j];
    if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) out.push(`${a} × ${b}`);
  }
  return out;
}, selectores);

const desborde = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** El elemento cabe en la ventana en horizontal y, haciendo scroll, se llega a su parte de abajo sin que nada lo tape. */
async function cabe(page, sel, pie) {
  const r = await page.locator(sel).evaluate((e) => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top + scrollY, w: innerWidth }; });
  expect(r.l, `${sel} se sale por la izquierda`).toBeGreaterThanOrEqual(0);
  expect(r.r, `${sel} se sale por la derecha`).toBeLessThanOrEqual(r.w + 1);
  expect(r.t, `${sel} se sale por arriba`).toBeGreaterThanOrEqual(0);
  const boton = page.locator(sel).locator(pie).last();
  await boton.scrollIntoViewIfNeeded();
  const visible = await boton.evaluate((b) => { const x = b.getBoundingClientRect(); const e = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return !!e && (e === b || b.contains(e)); });
  expect(visible, `el pie de ${sel} (${pie}) queda tapado o cortado`).toBe(true);
}

for (const ancho of ANCHOS) {
  for (const zoom of ZOOMS) {
    test.describe(`${ancho} px al ${zoom * 100} %`, () => {
      test.use({ viewport: { width: Math.round(ancho / zoom), height: Math.round(860 / zoom) }, deviceScaleFactor: zoom });
      test('vistas, popover y modal sin cortes ni solapes', async ({ page, app }) => {
        await abrir(page, app);
        for (const vista of ['Semana', 'Hoy', 'Progreso']) {
          await page.locator('#seg').getByRole('button', { name: vista }).click();
          expect(await desborde(page), `${vista}: scroll horizontal`).toBeLessThanOrEqual(1);
          expect(await solapes(page, ['#logo', '#seg', '.capw', '.gm']), `${vista}: cabecera`).toEqual([]);
        }
        await page.locator('#seg').getByRole('button', { name: 'Semana' }).click();
        expect(await solapes(page, ['.wk-titulo', '.wk-acciones']), 'cabecera de la semana').toEqual([]);
        // popover de un bloque a la derecha y abajo (domingo) y de uno a la izquierda y abajo (lunes, 20:00)
        for (const t of ['AI-102 · repasar', 'AI-102 · visión', 'Deploy del pipeline']) {
          await bloque(page, t).click();
          await cabe(page, '.pop', '[data-ed="eliminar"]');
          await page.keyboard.press('Escape');
        }
        await page.locator('#gbtn').click();
        await page.locator('#gmenu').getByRole('menuitem', { name: /Ajustes/ }).click();
        await cabe(page, '#modal .mod', 'select, input');
        await page.keyboard.press('Escape');
      });
    });
  }
}

test('Plan frente a real: el nombre del tipo no se parte en dos líneas, ni en temas con letra ancha', async ({ page, app }) => {
  app.escribir('tipos.md', `${app.leer('tipos.md')}- familia y amigos | #6B5B95\n`);
  for (const tema of ['papel', 'nordico-claro']) {
    app.escribir('ajustes.md', app.leer('ajustes.md').replace(/- tema: \S+/, `- tema: ${tema}`));
    await abrir(page, app);
    await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
    const alturas = await page.locator('#v-progreso .card', { hasText: 'Plan frente a real' }).evaluate((card) => [...card.querySelectorAll('[data-plan-tipo]')].map((e) => [e.textContent.trim(), e.getBoundingClientRect().height]));
    expect(alturas.length, tema).toBeGreaterThanOrEqual(4);
    const una = Math.min(...alturas.map(([, h]) => h));
    for (const [tipo, h] of alturas) expect(h, `${tema}: «${tipo}» ocupa más de una línea`).toBeLessThan(una * 1.5);
  }
});

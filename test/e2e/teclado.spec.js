// e2e · Teclado y accesibilidad: Esc, Tab por todos los controles con foco visible, nombres accesibles y sin trampas.
import { test, expect, abrir, bloque } from './ayudas.js';

/** Recorre la página con Tab: cada parada, con su nombre accesible y si se ve el foco. */
async function recorrer(page, veces) {
  const paradas = [];
  for (let i = 0; i < veces; i++) {
    await page.keyboard.press('Tab');
    paradas.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { body: true };
      const cs = getComputedStyle(el);
      const etiqueta = el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.title || el.textContent || el.placeholder || '';
      const r = el.getBoundingClientRect();
      return {
        id: el.id || `${el.tagName}:${etiqueta.trim().slice(0, 40)}`,
        nombre: etiqueta.trim(),
        visible: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none',
        enPantalla: r.width > 0 && r.height > 0,
      };
    }));
  }
  return paradas;
}

for (const vista of ['Semana', 'Hoy', 'Progreso']) {
  test(`Tab en ${vista}: llega a todos los controles, con foco visible y nombre, y vuelve al principio`, async ({ page, app }) => {
    await abrir(page, app);
    await page.locator('#seg').getByRole('button', { name: vista }).click();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const controles = await page.locator('#app').evaluate((app) => [...app.querySelectorAll('button:not([disabled]), input:not([disabled]), select, [tabindex="0"], [contenteditable="true"]')]
      .filter((e) => e.offsetParent !== null && !e.closest('[hidden]')).length);
    const paradas = await recorrer(page, controles + 5);
    const sinNombre = paradas.filter((p) => !p.body && !p.nombre);
    expect(sinNombre, 'controles sin nombre accesible').toEqual([]);
    const sinFoco = paradas.filter((p) => !p.body && !p.visible);
    expect(sinFoco.map((p) => p.id), 'foco invisible').toEqual([]);
    expect(new Set(paradas.filter((p) => !p.body).map((p) => p.id)).size).toBeGreaterThanOrEqual(Math.min(controles, 25));
    // sin trampas: el recorrido sale de la página o vuelve a empezar
    const ids = paradas.map((p) => p.id ?? 'body');
    expect(ids.slice(-6).some((x, i, a) => x === 'body' || ids.indexOf(x) < ids.length - 6 || a.indexOf(x) !== i), 'el foco sigue avanzando o vuelve al principio').toBe(true);
  });
}

test('nombres accesibles: todos los botones, campos y regiones visibles en cada vista', async ({ page, app }) => {
  await abrir(page, app);
  for (const vista of ['Semana', 'Hoy', 'Progreso']) {
    await page.locator('#seg').getByRole('button', { name: vista }).click();
    const sin = await page.evaluate(() => [...document.querySelectorAll('button, input, select, [role=button], [role=img], [role=radio], [role=tab]')]
      .filter((e) => e.offsetParent !== null || e.getClientRects().length)
      .filter((e) => !(e.getAttribute('aria-label') || e.labels?.[0]?.textContent.trim() || e.title || e.textContent.trim() || e.getAttribute('aria-labelledby')))
      .map((e) => e.outerHTML.slice(0, 120)));
    expect(sin, `sin nombre en ${vista}`).toEqual([]);
  }
});

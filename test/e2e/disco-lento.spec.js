// e2e · Con el disco lento (/mnt/d), la respuesta de una operación llega mientras haces la siguiente:
// el repintado no puede cortar lo que estás escribiendo ni el arrastre que tienes en la mano.
import { test, expect, abrir, bloque, esperarFichero } from './ayudas.js';

const W45 = 'semanas/2026-W45.md';
/** Cada operación tarda `ms` en volver (como guardar en /mnt/d con años de datos). */
const lento = (page, ms) => page.route('**/api/op', async (r) => { await new Promise((ok) => setTimeout(ok, ms)); await r.continue(); });

async function arrastrar(page, el, dx, dy, { desde = null } = {}) {
  await expect(el).toBeVisible();
  const c = await el.boundingBox();
  const [x, y] = desde ? desde(c) : [c.x + c.width / 2, c.y + Math.min(8, c.height / 2)];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12); await page.waitForTimeout(40); }
  await page.mouse.up();
}

test('editar Las 3 mientras vuelve la respuesta de otro cambio no pierde lo escrito', async ({ page, app }) => {
  await abrir(page, app);
  await lento(page, 600);
  const p = page.locator('#wk [data-las3]');
  await p.first().locator('[data-las3-marcar]').click();
  const texto = p.nth(1).locator('[data-las3-texto]');
  await texto.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (y repasar fallos)', { delay: 60 }); // la respuesta llega a mitad
  await page.keyboard.press('Enter');
  await esperarFichero(app, W45, (t) => t.includes('- [x] Entregar el lab de RAG') && t.includes('- [ ] Simulacro MLA-C01 ≥ 70 % (y repasar fallos) | rel: MLA-C01'));
});

test('dos arrastres seguidos con el disco lento: los dos se guardan', async ({ page, app }) => {
  await abrir(page, app);
  await lento(page, 700);
  const anchoCol = (await page.locator('#wk .col').first().boundingBox()).width + 4;
  await arrastrar(page, bloque(page, 'Deploy del pipeline'), anchoCol, 0);
  await arrastrar(page, bloque(page, 'MLA-C01 · simulacro'), anchoCol * 2, 0); // la respuesta del primero llega durante este
  await esperarFichero(app, W45, (t) => /^- V 21:30-23:00 \| trabajo \| Deploy del pipeline$/m.test(t) && /^- S 20:00-21:00 \| estudio \| MLA-C01 · simulacro/m.test(t), 8000);
});


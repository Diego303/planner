// Temas: sin parpadeo al cargar (data-tema ya en el primer HTML), decoración on/off y Halloween de temporada.
import { test, expect, abrir } from '../e2e/ayudas.js';

const TEMA_MD = '# Tema\n- base: nordico-oscuro\n- acento: #E07A3F\n- fondo: #1E2328\n';
const conTema = (app, tema, temporada = 'no') => app.escribir('ajustes.md', app.leer('ajustes.md')
  .replace(/- tema: \S+/, `- tema: ${tema}`).replace(/- tema_temporada: \S+/, `- tema_temporada: ${temporada}`));

for (const tema of ['nordico-claro', 'nordico-oscuro', 'papel', 'universo', 'halloween', 'alto-contraste', 'personalizado']) {
  test(`sin parpadeo: ${tema} ya está en la primera pintura, antes del JavaScript`, async ({ page, app }) => {
    conTema(app, tema);
    if (tema === 'personalizado') app.escribir('tema.md', TEMA_MD);
    // el JavaScript llega tarde: lo que se ve mientras tanto es lo que manda el servidor
    let soltar;
    const js = new Promise((r) => { soltar = r; });
    await page.route('**/app.js', async (r) => { await js; await r.continue(); });
    await page.goto(app.url, { waitUntil: 'commit' });
    // el HTML y sus hojas de estilo (que bloquean la pintura) ya están; app.js no
    await page.waitForFunction(() => document.body && [...document.querySelectorAll('link[rel=stylesheet]')].every((l) => l.sheet));
    const antes = await page.evaluate(() => ({ tema: document.documentElement.dataset.tema, fondo: getComputedStyle(document.body).backgroundColor, personal: !!document.getElementById('tema-personalizado') }));
    soltar();
    await expect(page.locator('#wk .rejilla')).toBeVisible();
    const despues = await page.evaluate(() => ({ tema: document.documentElement.dataset.tema, fondo: getComputedStyle(document.body).backgroundColor, personal: !!document.getElementById('tema-personalizado') }));
    expect(antes).toEqual(despues);
    expect(antes.tema).toBe(tema === 'personalizado' ? 'nordico-oscuro' : tema);
    if (tema === 'personalizado') expect(antes.fondo).toBe('rgb(30, 35, 40)');
  });
}

test('decoración de Universo y Halloween: se activa y se desactiva', async ({ page, app }) => {
  for (const tema of ['universo', 'halloween']) {
    conTema(app, tema);
    await abrir(page, app);
    const deco = () => page.evaluate(() => ({ fondo: getComputedStyle(document.body).backgroundImage, murcielago: getComputedStyle(document.querySelector('.deco-murcielago')).display }));
    const con = await deco();
    if (tema === 'universo') expect(con.fondo, 'universo: fondo de estrellas').not.toBe('none');
    if (tema === 'halloween') expect(con.murcielago, 'halloween: murciélago').toBe('block');
    await page.locator('#gbtn').click();
    await page.locator('#gmenu').getByRole('menuitem', { name: /^Tema/ }).click();
    await page.locator('#modal').getByLabel(/Decoración del tema/).uncheck();
    await expect(page.locator('html')).toHaveAttribute('data-deco', 'no');
    const sin = await deco();
    expect(sin.fondo).toBe('none');
    expect(sin.murcielago).toBe('none');
    await page.locator('#modal').getByLabel(/Decoración del tema/).check();
    await expect(page.locator('html')).toHaveAttribute('data-deco', 'sí');
    await page.keyboard.press('Escape');
  }
});

test.describe('Halloween de temporada', () => {
  test.use({ hoy: '2026-10-28' });
  test('del 25 al 31 de octubre se ve Halloween sin tocar el tema elegido', async ({ page, app }) => {
    conTema(app, 'papel', 'sí');
    await abrir(page, app);
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'halloween');
    expect(app.leer('ajustes.md')).toMatch(/- tema: papel/);
  });
});

test('fuera de temporada, el tema elegido', async ({ page, app }) => {
  conTema(app, 'papel', 'sí');
  await abrir(page, app);
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'papel');
});

// Capturas de cada vista y cada modal en todos los temas (6, automático claro y oscuro, y personalizado).
import { test, expect, abrir, bloque } from '../e2e/ayudas.js';

const TEMAS = [
  ['nordico-claro'], ['nordico-oscuro'], ['papel'], ['universo'], ['halloween'], ['alto-contraste'],
  ['automatico', 'light'], ['automatico', 'dark'], ['personalizado'],
];
const TEMA_MD = '# Tema\n- base: nordico-oscuro\n- acento: #E07A3F\n- fondo: #1E2328\n- superficie: #272D33\n- fuente: "Georgia", serif\n';

async function menu(page, nombre) {
  await page.locator('#gbtn').click();
  await page.locator('#gmenu').getByRole('menuitem', { name: nombre }).click();
  await expect(page.locator('#modal .mod')).toBeVisible();
}

// [nombre, cómo llegar, qué capturar (null = la página entera; si no, ese elemento; los modales, la ventana)]
const PANTALLAS = [
  ['semana', async () => {}, null],
  ['hoy', async (page) => page.locator('#seg').getByRole('button', { name: 'Hoy' }).click(), null],
  ['progreso', async (page) => page.locator('#seg').getByRole('button', { name: 'Progreso' }).click(), null],
  ['editor', async (page) => bloque(page, 'Curso · lab RAG').click(), '#wk'],
  ['hecho', async (page) => { await bloque(page, 'MLA-C01 · simulacro').click(); await page.locator('.pop').getByRole('button', { name: 'Hecho ✓' }).click(); }, '.pop'],
  ['metas', async (page) => page.locator('#drawer').getByRole('tab', { name: 'Metas' }).click(), '#drawer'],
  ['diario', async (page) => page.locator('#drawer').getByRole('tab', { name: 'Diario' }).click(), '#drawer'],
  ['menu', async (page) => page.locator('#gbtn').click(), '.gm .dd'],
  ['semanas', (page) => menu(page, /^Semanas/), '#modal .mod'],
  ['cerrar-1', (page) => menu(page, 'Cerrar semana 44'), '#modal .mod'],
  ['cerrar-2', async (page) => { await menu(page, 'Cerrar semana 44'); await page.locator('#modal').getByRole('button', { name: 'siguiente →' }).click(); }, '#modal .mod'],
  ['cerrar-4', async (page) => { await menu(page, 'Cerrar semana 44'); for (let i = 0; i < 3; i++) await page.locator('#modal').getByRole('button', { name: 'siguiente →' }).click(); }, '#modal .mod'],
  ['plantilla', (page) => menu(page, /Plantilla/), '#modal .mod'],
  ['tipos', (page) => menu(page, /Tipos/), '#modal .mod'],
  ['ajustes', (page) => menu(page, /Ajustes/), '#modal .mod'],
  ['tema', (page) => menu(page, /^Tema/), '#modal .mod'],
];

for (const [tema, esquema] of TEMAS) {
  const nombre = esquema ? `${tema}-${esquema === 'light' ? 'claro' : 'oscuro'}` : tema;
  test.describe(nombre, () => {
    if (esquema) test.use({ colorScheme: esquema });
    for (const [pantalla, ir, zona] of PANTALLAS) {
      test(pantalla, async ({ page, app }) => {
        app.escribir('ajustes.md', app.leer('ajustes.md').replace(/- tema: \S+/, `- tema: ${tema}`));
        if (tema === 'personalizado') app.escribir('tema.md', TEMA_MD);
        await abrir(page, app);
        await ir(page);
        await page.waitForTimeout(150);
        // la ruta de la carpeta temporal cambia en cada ejecución: se tapa
        const mask = [page.locator('.dd > .mut, .mod .mut', { hasText: 'planner-e2e-' })];
        if (zona) await expect(page.locator(zona)).toHaveScreenshot(`${nombre}/${pantalla}.png`, { mask });
        else await expect(page).toHaveScreenshot(`${nombre}/${pantalla}.png`, { fullPage: true, mask });
      });
    }
  });
}

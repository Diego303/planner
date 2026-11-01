// e2e · Sincronización con los ficheros: ediciones a mano con la web abierta, conflicto en vuelo y servidor parado.
import { test, expect, abrir, bloque, esperarFichero } from './ayudas.js';

const W45 = 'semanas/2026-W45.md';

test('una edición a mano con la web abierta se ve en ≤ 3 s', async ({ page, app }) => {
  await abrir(page, app);
  app.escribir(W45, app.leer(W45).replace('## Bloques\n', '## Bloques\n- S 16:00-17:00 | personal | Añadido en el Bloc de notas\n'));
  await expect(bloque(page, 'Añadido en el Bloc de notas')).toBeVisible({ timeout: 3000 });
  // y un borrado a mano también
  app.escribir(W45, app.leer(W45).replace('- J 21:30-23:00 | trabajo | Deploy del pipeline\n', ''));
  await expect(bloque(page, 'Deploy del pipeline')).toHaveCount(0, { timeout: 3000 });
});

test('si había una operación en vuelo y el fichero cambió fuera: aviso de recarga, sin pisar nada', async ({ page, app }) => {
  page.permitirErrores(/status of 409/); // Chrome apunta en la consola toda respuesta 4xx
  await abrir(page, app);
  // la petición tarda: mientras, alguien guarda tareas.md en Obsidian
  let soltar;
  const retenida = new Promise((r) => { soltar = r; });
  await page.route('**/api/op', async (ruta) => { await retenida; await ruta.continue(); });
  await page.locator('#cap').fill('Comprar pilas');
  await page.keyboard.press('Enter');
  app.escribir('tareas.md', `${app.leer('tareas.md')}- [ ] escrita en Obsidian\n`);
  soltar();
  await expect(page.locator('#toast')).toContainText('Cambiaste el fichero fuera del planner, recargado');
  expect(app.leer('tareas.md')).toContain('- [ ] escrita en Obsidian');
  expect(app.leer('tareas.md')).not.toContain('Comprar pilas');
  await page.unroute('**/api/op');
  // tras recargar, se puede repetir y entonces sí se guarda
  await page.locator('#cap').fill('Comprar pilas');
  await page.keyboard.press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => t.includes('Comprar pilas') && t.includes('escrita en Obsidian'));
});

test('servidor parado: banda de solo lectura; al volver se recupera sin perder nada', async ({ page, app }) => {
  page.permitirErrores(/Failed to load resource|ERR_CONNECTION_REFUSED/); // el navegador lo apunta él solo
  await abrir(page, app);
  await page.locator('#cap').fill('Antes de parar');
  await page.keyboard.press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => t.includes('Antes de parar'));
  await app.parar();
  await expect(page.locator('#banda')).toContainText('Servidor parado · solo lectura', { timeout: 4000 });
  // en solo lectura no se puede editar: ni proponer, ni editar bloques, ni Las 3
  await expect(page.getByRole('button', { name: 'Proponer semana' })).toBeDisabled();
  await expect(page.locator('#wk .col.ro')).toHaveCount(7);
  await page.locator('#cap').fill('Mientras está parado');
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('Servidor parado · solo lectura');
  await app.volver();
  await expect(page.locator('#banda')).not.toContainText('Servidor parado', { timeout: 8000 });
  await expect(page.locator('#wk .col.ro')).toHaveCount(0);
  expect(app.leer('tareas.md')).toContain('Antes de parar');
  await page.locator('#cap').fill('Después de volver');
  await page.keyboard.press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => t.includes('Después de volver') && t.includes('Antes de parar'));
});

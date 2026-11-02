// e2e · Cajón: pestañas, constancia, llevas/te faltan, simulacros, siguiente paso en línea y altas/bajas con validación.
import { test, expect, abrir, esperarFichero, HOY } from './ayudas.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsear } from '../../src/core/formato/index.js';
import * as m from '../../src/core/modelo.js';
import * as f from '../../src/core/fechas.js';
import { estudioDeSemana, encuadre, constancia } from '../../src/core/progreso.js';

const cajon = (page) => page.locator('#drawer');
const metas = async (page) => { await cajon(page).getByRole('tab', { name: 'Metas' }).click(); await expect(cajon(page).getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true'); };

test('pestañas: Hoy · Metas · Diario en Semana; sin «Hoy» en la vista Hoy; oculto en Progreso', async ({ page, app }) => {
  await abrir(page, app);
  await expect(cajon(page).getByRole('tab')).toHaveText(['Hoy', 'Metas', 'Diario']);
  await expect(cajon(page).getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true');
  await expect(cajon(page)).toContainText('Revisar PR del pipeline');
  await cajon(page).getByRole('tab', { name: 'Diario' }).click();
  await expect(cajon(page)).toContainText('Últimos 7 días');
  await expect(cajon(page)).toContainText('Ánimo medio');
  await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click();
  await expect(cajon(page).getByRole('tab')).toHaveText(['Metas', 'Diario']);
  await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
  await expect(cajon(page)).toBeHidden();
});

test('Metas: constancia, llevas / te faltan y simulacros coinciden con el núcleo', async ({ page, app }) => {
  await abrir(page, app);
  await metas(page);
  // lo mismo calculado con el núcleo a partir de los ficheros
  const leer = (r) => parsear(r, readFileSync(join(app.dir, r), 'utf8'));
  const tipos = m.tiposDe(leer('tipos.md'));
  const docs = Object.fromEntries(['2026-W38', '2026-W39', '2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44', '2026-W45'].map((s) => [s, leer(`semanas/${s}.md`)]));
  const c = constancia(docs, tipos, f.semanaDe(HOY));
  await expect(cajon(page)).toContainText(`esta semana llevas ${c.dias} ${c.dias === 1 ? 'día' : 'días'} con estudio · ${c.semanas} de ${c.de} semanas anteriores`);
  for (const t of m.temasEstudio(leer('estudio.md'))) {
    const e = estudioDeSemana(t, docs['2026-W45'], tipos);
    const texto = encuadre(e.hecho, e.objetivo) === 'llevas' ? `llevas ${f.horas(e.hecho)} h` : `te faltan ${f.horas(Math.max(0, e.objetivo - e.hecho))} h`;
    const fila = cajon(page).locator('.row', { hasText: t.nombre }).first();
    await expect(fila).toContainText(texto);
    await expect(fila).toContainText(`de ${f.horas(e.objetivo)} h`);
    if (t.simulacros.length) await expect(fila).toContainText(`simulacros ${t.simulacros.slice(-3).map((s) => s.nota).join(' → ')} %`);
  }
});

test('siguiente paso en línea: Enter guarda, Esc cancela', async ({ page, app }) => {
  await abrir(page, app);
  await metas(page);
  await cajon(page).getByRole('button', { name: '→ cargar historial real' }).click();
  const input = cajon(page).getByLabel('Siguiente paso de gymhub');
  await expect(input).toBeFocused();
  await input.fill('importar el CSV de 2025');
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('«gymhub» → importar el CSV de 2025');
  await esperarFichero(app, 'proyectos.md', (t) => /## gymhub\n- siguiente: importar el CSV de 2025\n- estado: activo\n- actualizado: 2026-11-02/.test(t));
  await cajon(page).getByRole('button', { name: '→ pestaña Mañana' }).click();
  await cajon(page).getByLabel('Siguiente paso de huddle').fill('no se guarda');
  await page.keyboard.press('Escape');
  await expect(cajon(page).getByRole('button', { name: '→ pestaña Mañana' })).toBeVisible();
  expect(app.leer('proyectos.md')).not.toContain('no se guarda');
});

test('añadir y quitar estudio y proyectos, con la validación de los formularios', async ({ page, app }) => {
  await abrir(page, app);
  await metas(page);
  const c = cajon(page);
  await c.locator('[data-abrir-form="estudio"]').click();
  await expect(c.getByLabel('Nombre', { exact: true })).toBeFocused();
  await c.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(c.getByRole('alert')).toHaveText('Pon un nombre y las horas a la semana');
  await c.getByLabel('Nombre', { exact: true }).fill('Kubernetes CKA');
  await c.getByLabel('Horas a la semana').fill('2.5');
  await c.getByLabel('Fecha del examen (opcional)').fill('2027-03-01');
  await c.getByRole('button', { name: 'Añadir', exact: true }).click();
  await esperarFichero(app, 'estudio.md', (t) => /## Kubernetes CKA\n- horas_semana: 2,5\n- examen: 2027-03-01/.test(t));
  await expect(c.locator('.row', { hasText: 'Kubernetes CKA' })).toContainText('llevas 0 h'); // el lunes, el encuadre de progreso.js empieza por lo hecho
  // nombre repetido: error claro del núcleo
  await c.locator('[data-abrir-form="estudio"]').click();
  await c.getByLabel('Nombre', { exact: true }).fill('ai-102');
  await c.getByLabel('Horas a la semana').fill('1');
  await c.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.locator('#toast')).toContainText(/ya existe|Ya hay/i);
  // proyecto
  await c.locator('[data-abrir-form="proyecto"]').click();
  await c.getByLabel('Nombre del proyecto').fill('blog');
  await c.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(c.getByRole('alert')).toHaveText('Pon el nombre y el siguiente paso');
  await c.getByLabel('Siguiente paso').fill('escribir el borrador');
  await page.keyboard.press('Enter');
  await esperarFichero(app, 'proyectos.md', (t) => /## blog\n- siguiente: escribir el borrador\n- estado: activo/.test(t));
  // quitar, con deshacer
  await c.getByRole('button', { name: 'Quitar Kubernetes CKA' }).click();
  await expect(page.locator('#toast')).toContainText('«Kubernetes CKA» quitado');
  await esperarFichero(app, 'estudio.md', (t) => !t.includes('Kubernetes CKA'));
  await c.getByRole('button', { name: 'Quitar blog' }).click();
  await esperarFichero(app, 'proyectos.md', (t) => !t.includes('## blog'));
  await expect(page.locator('#toast')).toContainText('«blog» quitado'); // el deshacer de este, no el del anterior
  await page.locator('#toast [data-deshacer]').click();
  await esperarFichero(app, 'proyectos.md', (t) => t.includes('## blog'));
});

test('lo que se está escribiendo en un formulario no se borra al repintar (un cambio de fuera)', async ({ page, app }) => {
  await abrir(page, app);
  await metas(page);
  const c = cajon(page);
  await c.locator('[data-abrir-form="proyecto"]').click();
  await c.getByLabel('Nombre del proyecto').fill('a medio escribir');
  await c.getByLabel('Siguiente paso').fill('y esto también');
  // alguien edita proyectos.md fuera: el sondeo recarga y repinta el cajón en ≤ 3 s
  app.escribir('proyectos.md', app.leer('proyectos.md').replace('cargar historial real', 'cambiado en Obsidian'));
  await expect(c).toContainText('→ cambiado en Obsidian', { timeout: 4000 });
  await expect(c.getByLabel('Nombre del proyecto')).toHaveValue('a medio escribir');
  await expect(c.getByLabel('Siguiente paso')).toHaveValue('y esto también');
  await expect(c.getByLabel('Siguiente paso')).toBeFocused();
});

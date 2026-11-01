// e2e · XSS: texto con HTML en cada campo de cada fichero se ve como texto en todas las vistas.
import { test, expect, abrir } from './ayudas.js';

const P = '<img src=x onerror=alert(1)>';

test('<img onerror> en bloque, tarea, proyecto, estudio, lección, diario, tipo, Las 3 e inbox: siempre texto', async ({ page, app }) => {
  const W44 = 'semanas/2026-W44.md', W45 = 'semanas/2026-W45.md';
  app.escribir(W45, app.leer(W45).replace('## Bloques\n', `## Bloques\n- S 16:00-17:00 | personal | ${P} bloque\n- S 17:00-18:00 | ${P}tipo | otro bloque\n`)
    .replace('- [ ] Cerrar la demo del agente | rel: agente soporte', `- [ ] ${P} objetivo | si: ${P} | entonces: ${P}`));
  app.escribir('tareas.md', app.leer('tareas.md').replace('## Hoy\n', `## Hoy\n- [ ] ${P} tarea | personal\n`));
  app.escribir('proyectos.md', `${app.leer('proyectos.md')}\n## ${P} proyecto\n- siguiente: ${P} paso\n- estado: activo\n`);
  app.escribir('estudio.md', `${app.leer('estudio.md')}\n## ${P} tema\n- horas_semana: 2\n- dejado: ${P} dejado\n`);
  app.escribir('tipos.md', `${app.leer('tipos.md')}- ${P}tipo | #123456\n`);
  app.escribir('diario/2026-11-01.md', `- ánimo: 3\n- línea: ${P} diario\n- mañana: ${P} mañana\n`);
  app.escribir('inbox.md', `# Inbox\n- ${P} nota\n`);
  app.escribir('semanas/2026-W43.md', app.leer('semanas/2026-W43.md').replace(/- funcionó: .*/, `- funcionó: ${P} lección`));
  await abrir(page, app);
  const sinImg = async (donde) => {
    expect(await page.locator('img[src="x"]').count(), donde).toBe(0);
  };
  await expect(page.locator('#wk')).toContainText(`${P} bloque`);
  await expect(page.locator('#wk')).toContainText(`${P} objetivo`);
  await sinImg('semana');
  await page.locator('#wk .blk', { hasText: `${P} bloque` }).click();
  await expect(page.locator('.pop #ed-titulo')).toHaveValue(`${P} bloque`);
  await page.keyboard.press('Escape');
  for (const pestaña of ['Hoy', 'Metas', 'Diario']) {
    await page.locator('#drawer').getByRole('tab', { name: pestaña }).click();
    await sinImg(`cajón ${pestaña}`);
  }
  await expect(page.locator('#drawer')).toContainText(`${P} diario`);
  await page.locator('#drawer').getByRole('tab', { name: 'Metas' }).click();
  await expect(page.locator('#drawer')).toContainText(`${P} proyecto`);
  await expect(page.locator('#drawer')).toContainText(`${P} tema`);
  await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('#v-hoy')).toContainText(`${P} tarea`);
  await sinImg('hoy');
  await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
  await expect(page.locator('#v-progreso')).toContainText(`${P} lección`);
  await sinImg('progreso');
  await page.locator('#seg').getByRole('button', { name: 'Semana' }).click();
  for (const entrada of [/^Semanas/, /Tipos/, /Plantilla/, /Ajustes/, /^Tema/, /Cerrar semana 44/]) {
    await page.locator('#gbtn').click();
    await page.locator('#gmenu').getByRole('menuitem', { name: entrada }).click();
    await expect(page.locator('#modal .mod')).toBeVisible();
    await sinImg(String(entrada));
    if (String(entrada).includes('Cerrar')) {
      for (let i = 0; i < 3; i++) { await page.locator('#modal').getByRole('button', { name: 'siguiente →' }).click(); await sinImg(`cierre paso ${i + 2}`); }
      await expect(page.locator('#modal [data-l3="2"][data-campo="texto"]')).toHaveValue(`${P} objetivo`);
    }
    await page.keyboard.press('Escape');
  }
  expect(app.leer(W44)).toBeTruthy();
});

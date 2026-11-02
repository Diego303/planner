// e2e · Inicio vacío: onboarding en 3 pasos → primera semana propuesta; la guía no vuelve a salir.
import { test, expect, esperarFichero } from './ayudas.js';

for (const datos of ['vacia', 'inexistente']) {
  test.describe(`carpeta ${datos}`, () => {
    test.use({ datos });
    test('3 pasos, primera semana propuesta y la guía no vuelve', async ({ page, app }) => {
      await page.goto(app.url);
      const onb = page.locator('#onboarding');
      await expect(onb).toBeVisible();
      await expect(onb).toContainText('Empecemos · 3 pasos');
      if (datos === 'inexistente') await expect(onb).toContainText('Esa carpeta todavía no existe');
      await expect(onb.getByRole('button', { name: 'Proponer mi primera semana' })).toBeDisabled();
      // 1 · semana tipo: trabajo (marcado) + gimnasio
      await onb.getByRole('button', { name: 'gimnasio L/X/V' }).click();
      await expect(onb.getByRole('button', { name: 'gimnasio L/X/V' })).toHaveAttribute('aria-pressed', 'true');
      await onb.getByRole('button', { name: 'Guardar semana tipo' }).click();
      await expect(onb).toContainText('✓ Guardada en plantilla.md');
      const plantilla = await esperarFichero(app, 'plantilla.md', (t) => t != null);
      expect(plantilla).toMatch(/L,M,X,J,V 09:00-17:30 \| trabajo \| Trabajo/);
      expect(plantilla).toMatch(/L,X,V 18:00-19:30 \| entreno \| Gimnasio/);
      expect(app.leer('ajustes.md')).toMatch(/- capacidad: 70/);
      expect(app.leer('tipos.md')).toMatch(/- estudio \|/);
      // 2 · estudio y proyectos desde el cajón Metas
      const c = page.locator('#drawer');
      await c.getByRole('tab', { name: 'Metas' }).click();
      await c.locator('[data-abrir-form="estudio"]').click();
      await c.getByLabel('Nombre', { exact: true }).fill('AI-102');
      await c.getByLabel('Horas a la semana').fill('4');
      await c.getByRole('button', { name: 'Añadir', exact: true }).click();
      await esperarFichero(app, 'estudio.md', (t) => /## AI-102\n- horas_semana: 4/.test(t ?? ''));
      // con un tema ya creado el paso 2 está hecho; sin nada, «Ahora no» lo salta
      await expect(onb.getByRole('button', { name: 'Ahora no' })).toHaveCount(0);
      // 3 · proponer
      await onb.getByRole('button', { name: 'Proponer mi primera semana' }).click();
      await expect(onb).toBeHidden();
      await expect(page.locator('#toast')).toContainText(/sugerencias?/);
      const semana = await esperarFichero(app, 'semanas/2026-W45.md', (t) => /\| sugerido/.test(t ?? ''));
      expect(semana).toMatch(/- L 09:00-17:30 \| trabajo \| Trabajo \| plantilla/);
      expect(semana).toMatch(/\| estudio \| AI-102 .*\| sugerido/);
      // al recargar, la guía no vuelve
      await page.reload();
      await expect(page.locator('#wk .rejilla')).toBeVisible();
      await expect(onb).toBeHidden();
    });
  });
}

// e2e · Progreso: cada tarjeta con datos llenos, vacíos y parciales; los números son los de core/progreso.js.
import { test, expect, abrir, HOY } from './ayudas.js';
import * as f from '../../src/core/fechas.js';

const h = (min) => f.horas(min);
async function progreso(page, app) {
  await abrir(page, app);
  await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
  await expect(page.locator('#v-progreso')).toBeVisible();
  // lo mismo que pinta la web, tal cual sale de calcularProgreso() en el servidor
  return (await (await fetch(`${app.url}api/estado?hoy=${HOY}`)).json()).meta.progreso;
}

test('con datos llenos: certificaciones, plan frente a real, constancia, ánimo y lecciones', async ({ page, app }) => {
  const p = await progreso(page, app);
  const v = page.locator('#v-progreso');
  expect(p.certificaciones.length).toBe(3);
  for (const c of p.certificaciones) {
    const fila = v.locator('div', { has: page.locator(`div:text-is("${c.nombre}")`) }).last();
    const total = c.total * 60;
    await expect(v).toContainText(c.encuadre === 'llevas' ? `llevas ${h(c.acumulado)} h de ${c.total}` : `te faltan ${h(Math.max(0, total - c.acumulado))} h de ${c.total}`);
    await expect(v).toContainText(`examen ${f.fechaCorta(c.examen)}`);
    await expect(v).toContainText(c.diferencia >= 0 ? `+${h(c.diferencia)} h sobre lo previsto` : `${h(-c.diferencia)} h`);
    if (c.simulacros.length) await expect(v.getByRole('img', { name: `simulacros de ${c.nombre}` })).toBeVisible();
    await expect(v.getByRole('img', { name: `horas de ${c.nombre} en 8 semanas` })).toBeVisible();
    expect(fila).toBeTruthy();
  }
  await expect(v).toContainText(`Plan frente a real · semana ${f.numeroSemana(p.ultimaCerrada)}`);
  for (const x of p.planReal) await expect(v.locator('span', { hasText: x.tipo }).first()).toBeVisible();
  await expect(v).toContainText(`Constancia · ${p.rejilla.length} semanas`);
  await expect(v.locator('[style*="aspect-ratio:1"]')).toHaveCount(p.rejilla.length);
  await expect(v).toContainText(`${p.semanasConEstudio} de 7 semanas con estudio`);
  if (p.comparacion) await expect(v).toContainText(`Semanas con ${h(p.comparacion.mediana)} h o más de estudio: ánimo medio ${p.comparacion.conMas == null ? '—' : f.numero(p.comparacion.conMas)}`);
  expect(p.lecciones.length).toBeGreaterThan(0);
  for (const l of p.lecciones) if (l.funciono) await expect(v).toContainText(l.funciono);
});

test.describe('con la carpeta recién creada (vacía)', () => {
  test.use({ datos: 'vacia' });
  test('cada tarjeta explica qué falta, sin ceros engañosos', async ({ page, app }) => {
    await fetch(`${app.url}api/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'datos.inicializar', hoy: HOY, args: {} }) });
    await page.goto(app.url);
    await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
    const v = page.locator('#v-progreso');
    await expect(v).toContainText('Añade un tema de estudio en Metas para ver su progreso.');
    await expect(v).toContainText('Plan frente a real · sin semanas cerradas');
    await expect(v).toContainText('Cierra una semana para comparar lo planificado con lo hecho.');
    await expect(v).toContainText('Aparecerán al cerrar semanas.');
    await expect(v).toContainText('0 de 7 semanas con estudio');
  });
});

test('con datos parciales: tema sin total ni examen y sin simulacros', async ({ page, app }) => {
  app.escribir('estudio.md', `${app.leer('estudio.md')}\n## Rust\n- horas_semana: 2\n`);
  const p = await progreso(page, app);
  const rust = p.certificaciones.find((c) => c.nombre === 'Rust');
  expect(rust.soloSemanal).toBe(true);
  const v = page.locator('#v-progreso');
  await expect(v).toContainText('solo horas semanales · añade total y examen en estudio.md para ver el ritmo');
  await expect(v).toContainText('sin examen');
  await expect(v).toContainText('◎ ninguno todavía');
});

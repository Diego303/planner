// e2e · Hoy: horario con «ahora», límite de tareas, ↑ ↓, grupos de Más adelante, Las 3, cierre del día y captura.
import { test, expect, abrir, esperarFichero } from './ayudas.js';

async function irAHoy(page, app) {
  await abrir(page, app);
  await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('#v-hoy')).toBeVisible();
}

test('horario del día con «ahora» (a las 10:00, el trabajo de 9:00 a 17:30)', async ({ page, app }) => {
  await irAHoy(page, app);
  await expect(page.locator('#hoy-horario .lab')).toHaveText('Lunes 2 de noviembre');
  const ahora = page.locator('#hoy-horario .tl.ahora');
  await expect(ahora).toHaveCount(1);
  await expect(ahora).toContainText('Trabajo 9:00–17:30 · ahora');
  await expect(page.locator('#hoy-horario .tl')).toHaveCount(3); // trabajo, gimnasio y AI-102
  await expect(page.locator('#hoy-horario .tl.hecho')).toContainText('AI-102 · visión');
});

test('límite de Hoy: ↑ sube hasta llenarlo, entonces ↑ se desactiva; ↓ baja', async ({ page, app }) => {
  await irAHoy(page, app);
  const contador = page.locator('#hoy-tareas .fila-lab .mut');
  await expect(contador).toHaveText('4/5');
  await page.getByRole('button', { name: 'Subir a hoy: Revisar contrato del piso' }).click();
  await expect(contador).toHaveText('5/5');
  await expect(page.locator('#hoy-tareas .lleno')).toHaveText('Hoy está lleno (5). Lo nuevo irá a Más adelante.');
  await expect(page.getByRole('button', { name: 'Subir a hoy: Post del blog: evaluar RAG' })).toBeDisabled();
  await esperarFichero(app, 'tareas.md', (t) => /## Hoy[^#]*Revisar contrato del piso[\s\S]*## Más adelante/.test(t));
  await page.getByRole('button', { name: 'Bajar a más adelante: Llamar al gestor' }).click();
  await expect(contador).toHaveText('4/5');
  await expect(page.getByRole('button', { name: 'Subir a hoy: Post del blog: evaluar RAG' })).toBeEnabled();
  await esperarFichero(app, 'tareas.md', (t) => /## Más adelante[\s\S]*Llamar al gestor/.test(t) && !/## Hoy[^#]*Llamar al gestor/.test(t));
  // con Hoy lleno, la captura manda lo de hoy a Más adelante
  await page.getByRole('button', { name: 'Subir a hoy: Llamar al gestor' }).click();
  await expect(contador).toHaveText('5/5');
  await page.locator('#cap').fill('Comprar pilas');
  await expect(page.locator('#cap-panel')).toContainText('Irá a Más adelante (Hoy está lleno)');
  await page.keyboard.press('Enter');
  await expect(page.locator('#capp')).toContainText('guardado en Más adelante ✓ · Hoy está lleno');
});

test('Más adelante por grupos, con las vencidas primero; recordatorio de Las 3 y ★ en las tareas', async ({ page, app }) => {
  await irAHoy(page, app);
  const grupos = page.locator('#hoy-mas .grp');
  await expect(grupos).toHaveText(['Vencidas · 1', 'Con fecha · 3', 'Sin fecha · 1', 'Algún día · 1']);
  await expect(grupos.first()).toHaveClass(/vencidas/);
  await expect(page.locator('#hoy-mas .grp.vencidas + .lt')).toContainText('Renovar DNI');
  await expect(page.locator('#hoy-mas .recuadro')).toContainText('★ Entregar el lab de RAG · ★ Simulacro MLA-C01 ≥ 70 % · ★ Cerrar la demo del agente');
  await expect(page.locator('#hoy-mas .lt', { hasText: 'Simulacro MLA-C01' })).toContainText('★');
  await expect(page.locator('#hoy-las3')).toContainText('si el jueves llego tarde → lo hago el sábado a las 10');
});

test('cierre del día: los 4 pasos, «mañana empiezo por» prellenado y el diario escrito', async ({ page, app }) => {
  await irAHoy(page, app);
  const cierre = page.locator('#hoy-cierre');
  await page.getByRole('button', { name: 'Marcar como hecha: Revisar PR del pipeline de evaluación' }).click();
  await expect(cierre.locator('.pill.ganado')).toHaveText(['✓ AI-102 · visión', '✓ Revisar PR del pipeline de evaluación']);
  // 2 · lo que no hice: «Llamar al gestor» a más adelante; «Reservar fisio» para mañana
  const fila = (t) => cierre.locator('.lt', { hasText: t });
  await fila('Llamar al gestor').getByRole('button', { name: 'más adelante' }).click();
  await fila('Reservar fisio').getByRole('button', { name: 'mañana' }).click();
  await expect(fila('Llamar al gestor').getByRole('button', { name: 'más adelante' })).toHaveAttribute('aria-pressed', 'true');
  // 3 · ánimo y línea
  await cierre.getByRole('radio', { name: '4' }).click();
  await expect(cierre.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true');
  await cierre.getByLabel('Una línea para tu diario').fill('Buen lunes | sin prisas');
  // 4 · prellenado con el primer paso del primer bloque no laboral de mañana
  await expect(cierre.getByLabel('Mañana empiezo por')).toHaveValue('Curso: abrir el notebook rag-eval y lanzar la celda 14');
  await cierre.getByRole('button', { name: 'Cerrar el día ✓' }).click();
  await expect(page.locator('#toast')).toContainText('Día cerrado ✓');
  const diario = await esperarFichero(app, 'diario/2026-11-02.md', (t) => t != null && /mañana/.test(t));
  expect(diario).toMatch(/ánimo: 4/);
  expect(diario).toMatch(/línea: Buen lunes \/ sin prisas/);
  expect(diario).toMatch(/avanzado: AI-102 · visión; Revisar PR del pipeline de evaluación/);
  expect(diario).toMatch(/mañana: Curso: abrir el notebook rag-eval y lanzar la celda 14/);
  const tareas = app.leer('tareas.md');
  expect(tareas).toMatch(/## Más adelante[\s\S]*Llamar al gestor/);
  expect(tareas).toMatch(/## Hoy[^#]*Reservar fisio/);
  expect(tareas).toMatch(/- \[x\] Revisar PR del pipeline de evaluación .*hecha: 2026-11-02|- \[x\] Revisar PR del pipeline de evaluación/);
  await expect(cierre).toContainText('Día cerrado ✓ · ánimo 4');
  await expect(cierre.locator('.recuadro')).toContainText('Curso: abrir el notebook rag-eval y lanzar la celda 14');
  // editar lo guardado
  await cierre.getByRole('button', { name: 'editar' }).click();
  await expect(cierre.getByLabel('Una línea para tu diario')).toHaveValue('Buen lunes / sin prisas');
  await cierre.getByRole('radio', { name: '5' }).click();
  await cierre.getByRole('button', { name: 'Cerrar el día ✓' }).click();
  await esperarFichero(app, 'diario/2026-11-02.md', (t) => /ánimo: 5/.test(t));
});

test('captura escrita: lo de siempre (#tipo, mañana, !, 45m, algún día) sigue valiendo y se ve en los botones', async ({ page, app }) => {
  await irAHoy(page, app);
  const cap = page.locator('#cap'), panel = page.locator('#cap-panel');
  const activo = (texto) => panel.locator('.ac[aria-pressed="true"]', { hasText: texto });
  const casos = [
    ['Llamar a Marta mañana #personal ! 45m', ['personal', 'mañana', '! importante'], 'Más adelante', /- \[ \] Llamar a Marta \| personal \| prioridad \| fecha: 2026-11-03 \| dur: 45m/],
    ['Revisar el informe hoy #trabajo', ['trabajo', 'hoy'], 'Hoy', /## Hoy[^#]*- \[ \] Revisar el informe \| trabajo/],
    ['Aprender Go algún día', ['sin tipo', 'algún día'], 'Algún día', /## Algún día[\s\S]*- \[ \] Aprender Go/],
    ['Pagar el seguro 15/11', ['sin tipo', '15 nov'], 'Más adelante', /- \[ \] Pagar el seguro .*fecha: 2026-11-15/],
  ];
  for (const [texto, chips, destino, re] of casos) {
    await cap.fill(texto);
    for (const c of chips) await expect(activo(c)).toBeVisible();
    await expect(panel).toContainText(`Irá a ${destino}`);
    await page.keyboard.press('Enter');
    await expect(page.locator('#toast')).toContainText(`Guardado en ${destino} ✓`);
    await expect(cap).toHaveValue('');
    await esperarFichero(app, 'tareas.md', (t) => re.test(t));
  }
  await cap.fill('mañana #trabajo 30m');
  await page.keyboard.press('Enter');
  await expect(page.locator('#capp')).toContainText('Escribe qué es');
  await page.keyboard.press('Escape');
  await expect(cap).toHaveValue('');
  await expect(panel).toBeHidden();
});

test('captura con botones: tipo, cuándo e importante sin saberse nada; «/» elige el tipo; «✎ editar» al guardar', async ({ page, app }) => {
  await abrir(page, app);
  const cap = page.locator('#cap'), panel = page.locator('#cap-panel');
  await cap.click();
  await expect(panel).toBeVisible();
  await cap.fill('Comprar regalo de Ana');
  await panel.getByRole('button', { name: 'personal' }).click();
  await panel.getByRole('button', { name: 'mañana' }).click();
  await panel.getByRole('button', { name: '! importante' }).click();
  await expect(cap).toBeFocused(); // pulsar un botón no quita el foco de la barra
  await expect(panel.getByRole('button', { name: 'personal' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel).toContainText('Irá a Más adelante');
  await panel.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'tareas.md', (t) => /- \[ \] Comprar regalo de Ana \| personal \| prioridad \| fecha: 2026-11-03/.test(t));
  // lo elegido no se queda para la siguiente
  await expect(panel.getByRole('button', { name: 'sin tipo' })).toHaveAttribute('aria-pressed', 'true');
  // otro día con calendario
  await cap.fill('Cita del dentista');
  await panel.getByRole('button', { name: 'otro día…' }).click();
  await panel.getByLabel('Fecha').fill('2026-11-20');
  await expect(panel.locator('.ac[aria-pressed="true"]', { hasText: '20 nov' })).toBeVisible();
  await cap.press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => /- \[ \] Cita del dentista \| fecha: 2026-11-20/.test(t));
  // «/»: lista de tipos, se filtra al escribir, flechas y Enter
  await cap.fill('Leer el capítulo 3 /');
  await expect(panel).toContainText('Elige tipo');
  await cap.press('e');
  await expect(panel.locator('[data-cap-tipo]')).toHaveText(['estudio', 'entreno']);
  await cap.press('ArrowDown');
  await cap.press('Enter'); // elige «entreno», no guarda
  await expect(cap).toHaveValue('Leer el capítulo 3 ');
  await expect(panel.getByRole('button', { name: 'entreno' })).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'estudio' }).click(); // cambiar de idea
  await cap.press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => /- \[ \] Leer el capítulo 3 \| estudio/.test(t));
  // y al guardar, «✎ editar» abre la tarea para poner la duración
  await page.locator('#toast [data-accion-toast]').click();
  await expect(page.locator('#v-hoy')).toBeVisible();
  await expect(page.getByLabel('Texto de la tarea')).toHaveValue('Leer el capítulo 3');
  await page.getByLabel('Duración (opcional)').fill('1h30');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'tareas.md', (t) => /- \[ \] Leer el capítulo 3 \| estudio \| dur: 1h30/.test(t));
  // una duración que no se entiende no se guarda
  await page.getByRole('button', { name: 'Editar: Leer el capítulo 3' }).click();
  await page.getByLabel('Duración (opcional)').fill('mucho');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByLabel('Texto de la tarea')).toBeVisible();
  expect(app.leer('tareas.md')).toMatch(/Leer el capítulo 3 \| estudio \| dur: 1h30/);
});

test('editar y borrar una tarea desde Hoy', async ({ page, app }) => {
  await irAHoy(page, app);
  await page.getByRole('button', { name: 'Editar: Llamar al gestor' }).click();
  await page.getByLabel('Texto de la tarea').fill('Llamar al gestor por la renta');
  await page.getByLabel('Fecha (opcional)').fill('2026-11-04');
  await page.getByLabel('Duración (opcional)').fill('30m');
  await page.locator('#et-prioridad').check();
  await page.locator('#et-seccion').selectOption('mas');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'tareas.md', (t) => /## Más adelante[\s\S]*- \[ \] Llamar al gestor por la renta \| personal \| prioridad \| fecha: 2026-11-04 \| dur: 30m/.test(t));
  await page.getByRole('button', { name: 'Editar: Reservar fisio' }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#toast')).toContainText('Tarea «Reservar fisio» eliminada');
  await esperarFichero(app, 'tareas.md', (t) => !t.includes('Reservar fisio'));
  await page.locator('#toast [data-deshacer]').click();
  await esperarFichero(app, 'tareas.md', (t) => t.includes('- [ ] Reservar fisio | personal | fecha: 2026-10-30'));
});

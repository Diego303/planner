// e2e · Flexibilidad: renombrar y reasignar tipos, editar metas, mover a otra fecha, duplicar, plan B,
// quitar sugerencias, horas fuera de lo visible, tipo nuevo desde el editor, duración real, ideas (inbox),
// subir igualmente, ir a una fecha, plantilla con subtipo y paso, diario de otros días y atajos de teclado.
import { test, expect, abrir, bloque, esperarFichero } from './ayudas.js';

const W45 = 'semanas/2026-W45.md';
const W46 = 'semanas/2026-W46.md';
const menu = async (page, texto) => {
  await page.locator('#gbtn').click();
  await page.locator('#gmenu').getByRole('menuitem', { name: texto }).click();
};
const modal = (page) => page.locator('#modal .mod');
const cajon = (page) => page.locator('#drawer');
const toast = (page) => page.locator('#toast');

test('Tipos: renombrar cambia bloques, plantilla y tareas; quitar uno en uso pasa sus usos a otro; deshacer lo devuelve', async ({ page, app }) => {
  await abrir(page, app);
  const antes = { w45: app.leer(W45), w44: app.leer('semanas/2026-W44.md'), plantilla: app.leer('plantilla.md'), tipos: app.leer('tipos.md') };
  await menu(page, /Tipos/);
  const m = modal(page);
  await m.getByRole('button', { name: 'Cambiar el nombre de personal' }).click();
  await expect(m.locator('#rt-nombre')).toBeFocused();
  await m.locator('#rt-nombre').fill('vida');
  await m.locator('#rt-nombre').press('Enter');
  await expect(toast(page)).toContainText('«personal» ahora se llama «vida»');
  await esperarFichero(app, 'tipos.md', (t) => /^- vida \| #86651F/m.test(t) && !/personal/.test(t));
  await esperarFichero(app, W45, (t) => /^- D 17:00-17:30 \| vida \| Cerrar semana \| plantilla$/m.test(t) && !/\| personal \|/.test(t));
  expect(app.leer('plantilla.md')).toMatch(/^- D 17:00-17:30 \| vida \| Cerrar semana$/m);
  // en la rejilla, el bloque sigue con su color (el del tipo renombrado)
  await expect(bloque(page, 'Cerrar semana')).toBeVisible();
  // un nombre que ya existe no se acepta y no cambia nada
  await m.getByRole('button', { name: 'Cambiar el nombre de vida' }).click();
  await m.locator('#rt-nombre').fill('Trabajo');
  await m.getByRole('button', { name: 'Guardar' }).click();
  await expect(toast(page)).toContainText('Ya hay un tipo');
  expect(app.leer('tipos.md')).toMatch(/^- vida \|/m);
  // quitar «entreno» (en uso) pasando sus bloques a «vida»
  await m.getByRole('button', { name: 'Quitar entreno' }).click();
  await m.locator('#qt-destino').selectOption('vida');
  await m.getByRole('button', { name: 'Quitar «entreno»' }).click();
  await expect(toast(page)).toContainText('ahora son «vida»');
  await esperarFichero(app, 'tipos.md', (t) => !/entreno/.test(t));
  await esperarFichero(app, W45, (t) => /^- L 18:00-19:30 \| vida \| Gimnasio \| plantilla$/m.test(t) && !/entreno/.test(t));
  expect(app.leer('plantilla.md')).not.toContain('entreno');
  // deshacer la quita y luego el renombrado: todo vuelve byte a byte
  await toast(page).locator('[data-deshacer]').click();
  await esperarFichero(app, 'tipos.md', (t) => /entreno/.test(t));
  await esperarFichero(app, W45, (t) => /\| entreno \| Gimnasio/.test(t));
  await m.getByRole('button', { name: 'Cambiar el nombre de vida' }).click();
  await m.locator('#rt-nombre').fill('personal');
  await m.locator('#rt-nombre').press('Enter');
  await esperarFichero(app, W45, (t) => t === antes.w45);
  await esperarFichero(app, 'plantilla.md', (t) => t === antes.plantilla);
  // W44 (escrita a mano en otro orden) queda con el mismo contenido; la línea tocada, en su orden canónico
  const w44 = app.leer('semanas/2026-W44.md');
  expect(w44).toMatch(/^- D 17:00-17:30 \| personal \| Cerrar semana \| hecho: 0 \| plantilla$/m);
  expect(w44.replace(/\| hecho: 0 \| plantilla\n/, '| plantilla | hecho: 0\n')).toBe(antes.w44);
});

test('Metas: editar un estudio (nombre, horas, examen, simulacro) y un proyecto (paso, pausa y reactivar)', async ({ page, app }) => {
  await abrir(page, app);
  await cajon(page).getByRole('tab', { name: 'Metas' }).click();
  const c = cajon(page);
  const antesEstudio = app.leer('estudio.md'), antesW45 = app.leer(W45);
  await c.getByRole('button', { name: 'Editar AI-102' }).click();
  await expect(c.locator('#em-nombre')).toBeFocused();
  await c.locator('#em-nombre').fill('AI-102 Azure');
  await c.locator('#em-horas').fill('6');
  await c.locator('#em-examen').fill('2026-12-19');
  await c.locator('#em-sim-nota').fill('78');
  await c.getByRole('button', { name: 'Guardar' }).click();
  await expect(toast(page)).toContainText('«AI-102 Azure» actualizado');
  const e = await esperarFichero(app, 'estudio.md', (t) => t.includes('## AI-102 Azure') && /78 @2026-11-02/.test(t));
  expect(e).toMatch(/## AI-102 Azure\n- horas_semana: 6\n- examen: 2026-12-19/);
  expect(e).toContain('simulacros: 61 @2026-10-05, 66 @2026-10-19, 72 @2026-10-26, 78 @2026-11-02');
  // los bloques del tema cambian de nombre, también en las semanas cerradas, y siguen contando
  await esperarFichero(app, W45, (t) => /\| AI-102 Azure · visión \| tipo: aprender \| hecho: \+30m$/m.test(t) && !/\| AI-102 · /.test(t));
  expect(app.leer('semanas/2026-W43.md')).not.toMatch(/\| AI-102 · /);
  await expect(c).toContainText('AI-102 Azure');
  // un solo «deshacer» deshace todo lo del formulario (nombre, horas, examen y simulacro)
  await toast(page).locator('[data-deshacer]').click();
  await esperarFichero(app, 'estudio.md', (t) => t === antesEstudio);
  await esperarFichero(app, W45, (t) => t === antesW45);
  await expect(c).not.toContainText('AI-102 Azure');
  // un nombre vacío se explica y no guarda
  await c.getByRole('button', { name: 'Editar MLA-C01' }).click();
  await c.locator('#em-nombre').fill('');
  await c.getByRole('button', { name: 'Guardar' }).click();
  await expect(c.locator('[data-form-meta] .error-form')).toHaveText('Pon un nombre');
  await c.getByRole('button', { name: 'Cancelar' }).click();
  // proyecto: siguiente paso y pausa; luego reactivarlo
  await c.getByRole('button', { name: 'Editar gymhub' }).click();
  await c.locator('#em-siguiente').fill('subir la versión 2');
  await c.locator('#em-pausado').check();
  await c.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'proyectos.md', (t) => /## gymhub\n- siguiente: subir la versión 2\n- estado: pausado/.test(t));
  await c.getByRole('button', { name: 'Editar gymhub' }).click();
  await expect(c.locator('#em-pausado')).toBeChecked();
  await c.locator('#em-pausado').uncheck();
  await c.locator('#em-nombre').fill('gymhub app');
  await c.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'proyectos.md', (t) => /## gymhub app\n- siguiente: subir la versión 2\n- estado: activo/.test(t));
});

test('editor: mover a otra fecha (otra semana), aviso de horas fuera de lo visible con «ampliar», tipo nuevo y duplicar', async ({ page, app }) => {
  await abrir(page, app);
  const pop = page.locator('.pop');
  // otra fecha: el jueves de la semana siguiente (que aún no existe)
  expect(app.leer(W46)).toBeNull();
  await bloque(page, 'Deploy del pipeline').click();
  await pop.locator('#ed-dia').selectOption('otra');
  await expect(pop.locator('#ed-fecha')).toBeVisible();
  await pop.locator('#ed-fecha').fill('2026-11-12');
  await pop.locator('[data-ed="guardar"]').click();
  await expect(pop).toBeHidden();
  await esperarFichero(app, W46, (t) => t != null && /^- J 21:30-23:00 \| trabajo \| Deploy del pipeline$/m.test(t));
  await esperarFichero(app, W45, (t) => !t.includes('Deploy del pipeline'));
  await expect(bloque(page, 'Deploy del pipeline')).toHaveCount(0);
  // fuera de las horas visibles (7–24): avisa y deja ampliar
  await bloque(page, 'Curso · módulo 6').click();
  await pop.getByLabel('Empieza').fill('06:00');
  await pop.getByLabel('Termina').fill('07:30');
  await expect(pop.locator('#ed-aviso-horas')).toContainText('Fuera de las horas que ves (7–24)');
  await pop.getByRole('button', { name: 'Ver de 6 a 24' }).click();
  await esperarFichero(app, 'ajustes.md', (t) => /- horas: 6-24/.test(t));
  await expect(pop.locator('#ed-aviso-horas')).toHaveText('');
  // tipo nuevo desde el editor: se crea y queda elegido
  await pop.getByRole('button', { name: 'Nuevo tipo' }).click();
  await pop.locator('#ed-tipo-nuevo').fill('lectura');
  await pop.locator('#ed-tipo-nuevo').press('Enter');
  await expect(pop.getByRole('radio', { name: 'lectura' })).toHaveAttribute('aria-checked', 'true');
  await pop.locator('[data-ed="guardar"]').click();
  await esperarFichero(app, 'tipos.md', (t) => /^- lectura \| #[0-9A-F]{6}$/m.test(t));
  await esperarFichero(app, W45, (t) => /^- D 06:00-07:30 \| lectura \| Curso · módulo 6$/m.test(t));
  await expect(page.locator('#wk .horas span').first()).toHaveText('6');
  // duplicar en otros días (sin marcar ninguno, lo explica)
  await bloque(page, 'Curso · lab RAG').click();
  await pop.locator('details.duplicar summary').click();
  await pop.getByRole('button', { name: 'Duplicar' }).click();
  await expect(pop.locator('#ed-error')).toHaveText('Marca en qué días');
  await pop.locator('[data-dup-dia="2"]').check();
  await pop.locator('[data-dup-dia="4"]').check();
  await pop.getByRole('button', { name: 'Duplicar' }).click();
  await expect(toast(page)).toContainText('«Curso · lab RAG» duplicado en 2 días');
  const t = await esperarFichero(app, W45, (x) => (x.match(/\| Curso · lab RAG \|/g) ?? []).length === 3);
  expect(t).toMatch(/^- X 19:30-21:00 \| estudio \| Curso · lab RAG \| tipo: aprender \| paso: abrir el notebook rag-eval y lanzar la celda 14$/m);
  expect(t).toMatch(/^- V 19:30-21:00 \| estudio \| Curso · lab RAG \|/m);
  await expect(page.locator('#wk .blk', { hasText: 'Curso · lab RAG' })).toHaveCount(3);
  await toast(page).locator('[data-deshacer]').click();
  await esperarFichero(app, W45, (x) => (x.match(/\| Curso · lab RAG \|/g) ?? []).length === 1);
});

test('duración real de un bloque ya hecho: se cambia sin desmarcarlo', async ({ page, app }) => {
  await abrir(page, app);
  const pop = page.locator('.pop');
  await bloque(page, 'AI-102 · visión').click();
  await expect(pop.getByRole('button', { name: '+30 min' })).toHaveAttribute('aria-pressed', 'true');
  await pop.getByRole('button', { name: '+1 h' }).click();
  await expect(pop).toBeHidden();
  await esperarFichero(app, W45, (t) => /^- L 20:00-21:30 \| estudio \| AI-102 · visión \| tipo: aprender \| hecho: \+1h$/m.test(t));
  await bloque(page, 'AI-102 · visión').click();
  await pop.getByRole('button', { name: 'lo previsto' }).click();
  await esperarFichero(app, W45, (t) => /^- L 20:00-21:30 \| estudio \| AI-102 · visión \| tipo: aprender \| hecho: 0$/m.test(t));
});

test('Semana: plan B (si → entonces) de Las 3 y «Quitar sugerencias» (las aceptadas se quedan)', async ({ page, app }) => {
  await abrir(page, app);
  await page.getByRole('button', { name: 'Plan B de «Simulacro MLA-C01 ≥ 70 %» (si → entonces)' }).click();
  await expect(page.locator('#l3-si')).toBeFocused();
  await page.locator('#l3-si').fill('el jueves no me da tiempo');
  await page.locator('#l3-entonces').fill('lo hago el domingo por la mañana');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, W45, (t) => /^- \[ \] Simulacro MLA-C01 ≥ 70 % \| rel: MLA-C01 \| si: el jueves no me da tiempo \| entonces: lo hago el domingo por la mañana$/m.test(t));
  // el que ya tenía plan B lo enseña para cambiarlo; vaciar los dos campos lo quita
  await page.getByRole('button', { name: 'Plan B de «Entregar el lab de RAG» (si → entonces)' }).click();
  await expect(page.locator('#l3-si')).toHaveValue('el jueves llego tarde');
  await page.locator('#l3-si').fill('');
  await page.locator('#l3-entonces').fill('');
  await page.locator('#l3-entonces').press('Enter');
  await esperarFichero(app, W45, (t) => /^- \[ \] Entregar el lab de RAG \| rel: Curso$/m.test(t));
  // Proponer y quitar las sugerencias, menos la aceptada
  await page.getByRole('button', { name: 'Proponer semana' }).click();
  const sug = page.locator('#wk .blk.sug');
  await expect(sug.first()).toBeVisible();
  const n = await sug.count();
  await esperarFichero(app, W45, (x) => (x.match(/\| sugerido/g) ?? []).length === n);
  await sug.first().click();
  await page.locator('.pop').getByRole('button', { name: 'Aceptar' }).click();
  await expect(sug).toHaveCount(n - 1);
  const conAceptada = await esperarFichero(app, W45, (x) => (x.match(/\| sugerido/g) ?? []).length === n - 1);
  if (n > 1) {
    await page.getByRole('button', { name: 'Quitar sugerencias' }).click();
    await expect(toast(page)).toContainText(`${n - 1} sugerencia`);
    await esperarFichero(app, W45, (x) => !/\| sugerido/.test(x));
    await expect(sug).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Quitar sugerencias' })).toHaveCount(0);
    await toast(page).locator('[data-deshacer]').click();
    await esperarFichero(app, W45, (x) => x === conAceptada);
  }
});

test('Ideas (inbox): apuntar una idea, pasarla a tarea y borrar otra; Hoy lleno: «hoy» en la captura la pone igualmente', async ({ page, app }) => {
  await abrir(page, app);
  await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click();
  const ideas = page.locator('#hoy-ideas');
  await expect(ideas.locator('[data-idea]')).toHaveCount(2);
  await expect(ideas).toContainText('idea: comparar rerankers con un dataset propio');
  // una idea va al inbox tal cual (sin interpretar «mañana»)
  await page.locator('#cap').fill('probar mañana el modo oscuro del editor');
  await page.locator('[data-cap-idea]').click();
  await expect(page.locator('#cap-panel')).toContainText('Irá a Ideas (inbox)');
  // en modo idea no se ofrecen tipo ni cuándo (no se usan)
  await expect(page.locator('[data-cap-cuando]')).toHaveCount(0);
  await expect(page.locator('[data-cap-tipo]')).toHaveCount(0);
  await page.locator('#cap').press('Enter');
  await expect(toast(page)).toContainText('Idea guardada');
  await esperarFichero(app, 'inbox.md', (t) => /^- probar mañana el modo oscuro del editor$/m.test(t));
  await expect(ideas.locator('[data-idea]')).toHaveCount(3);
  expect(app.leer('tareas.md')).not.toContain('modo oscuro');
  // → tarea: sale del inbox y entra en Más adelante
  await ideas.getByRole('button', { name: 'Pasar a tarea: mirar el curso de evaluación de agentes' }).click();
  await esperarFichero(app, 'inbox.md', (t) => !t.includes('mirar el curso de evaluación'));
  await esperarFichero(app, 'tareas.md', (t) => /## Más adelante[\s\S]*mirar el curso de evaluación de agentes/.test(t));
  await expect(page.locator('#hoy-mas')).toContainText('mirar el curso de evaluación de agentes');
  // × borra, y deshacer la devuelve
  await ideas.getByRole('button', { name: 'Borrar idea: probar mañana el modo oscuro del editor' }).click();
  await esperarFichero(app, 'inbox.md', (t) => !t.includes('modo oscuro'));
  await toast(page).locator('[data-deshacer]').click();
  await esperarFichero(app, 'inbox.md', (t) => t.includes('probar mañana el modo oscuro del editor'));
  // Hoy lleno (5/5): por defecto va a Más adelante; pulsando «hoy» va a Hoy igualmente
  await page.getByRole('button', { name: 'Subir a hoy: Revisar contrato del piso' }).click();
  await expect(page.locator('#hoy-tareas .fila-lab .mut')).toHaveText('5/5');
  await page.locator('#cap').fill('Llamar al banco');
  await expect(page.locator('#cap-panel')).toContainText('Hoy está lleno: pulsa «hoy» para ponerla igualmente');
  await page.locator('[data-cap-cuando="hoy"]').click();
  await expect(page.locator('#cap-panel')).toContainText('(pasarás de 5)');
  await page.locator('#cap').press('Enter');
  await esperarFichero(app, 'tareas.md', (t) => /## Hoy[^#]*Llamar al banco/.test(t));
  await expect(page.locator('#hoy-tareas .fila-lab .mut')).toHaveText('6/5');
});

test('Semanas: ir a la semana de cualquier fecha', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /^Semanas/);
  await modal(page).locator('#ir-fecha').fill('2027-02-10');
  await modal(page).getByRole('button', { name: 'Ir', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page.locator('.wk-num')).toHaveText('semana 6');
  await menu(page, /^Semanas/);
  await modal(page).locator('#ir-fecha').fill('2026-09-16');
  await modal(page).locator('#ir-fecha').press('Enter');
  await expect(page.locator('.wk-num')).toHaveText('semana 38');
});

test('Plantilla con subtipo y primer paso: llegan a las semanas', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /Plantilla de semana/);
  const m = modal(page);
  await m.getByLabel('Título').fill('AI-102 · repaso');
  await m.locator('#pl-tipo').selectOption('estudio');
  await m.locator('[data-pl-subtipo="repasar"]').click();
  await expect(m.locator('[data-pl-subtipo="repasar"]')).toHaveAttribute('aria-pressed', 'true');
  await m.locator('[data-dia="5"]').check();
  await m.getByLabel('Empieza').fill('08:00');
  await m.getByLabel('Termina').fill('09:00');
  await m.locator('#pl-paso').fill('abrir las tarjetas de visión');
  await m.getByRole('button', { name: 'Añadir a la plantilla' }).click();
  await esperarFichero(app, 'plantilla.md', (t) => /^- S 08:00-09:00 \| estudio \| AI-102 · repaso \| tipo: repasar \| paso: abrir las tarjetas de visión$/m.test(t));
  await esperarFichero(app, W45, (t) => /^- S 08:00-09:00 \| estudio \| AI-102 · repaso \| tipo: repasar \| paso: abrir las tarjetas de visión \| plantilla$/m.test(t));
  await expect(m).toContainText('repasar · → abrir las tarjetas de visión');
  // con un tipo que no es de estudio, el subtipo desaparece
  await m.locator('#pl-tipo').selectOption('personal');
  await expect(m.locator('[data-pl-subtipo]')).toHaveCount(0);
});

test('Diario: editar un día anterior (ánimo, línea y «mañana») y escribir uno que no tenía', async ({ page, app }) => {
  await abrir(page, app);
  await cajon(page).getByRole('tab', { name: 'Diario' }).click();
  const c = cajon(page);
  await c.locator('[data-editar-dia="2026-10-29"]').click();
  await expect(c.locator('#ed-linea')).toHaveValue('Me costó arrancar pero cumplí.');
  await c.locator('[data-dia-animo="4"]').click();
  await c.locator('#ed-linea').fill('Al final salió bien.');
  await c.locator('#ed-manana').fill('repasar visión');
  await c.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'diario/2026-10-29.md', (t) => /- ánimo: 4/.test(t) && /- línea: Al final salió bien\./.test(t) && /repasar visión/.test(t));
  // un día sin diario (el 31) se crea
  expect(app.leer('diario/2026-10-31.md')).toBeNull();
  await c.locator('[data-editar-dia="2026-10-31"]').click();
  await c.locator('[data-dia-animo="3"]').click();
  await c.getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'diario/2026-10-31.md', (t) => t != null && /- ánimo: 3/.test(t));
  // cancelar no toca nada
  const antes = app.leer('diario/2026-11-01.md');
  await c.locator('[data-editar-dia="2026-11-01"]').click();
  await c.locator('#ed-linea').fill('esto no se guarda');
  await c.getByRole('button', { name: 'Cancelar' }).click();
  await expect(c.locator('#ed-linea')).toHaveCount(0);
  expect(app.leer('diario/2026-11-01.md')).toBe(antes);
});

test('atajos de teclado: ← → h en Semana, 1 2 3 para las vistas, n para apuntar, ? ayuda; no actúan al escribir', async ({ page, app }) => {
  await abrir(page, app);
  const num = page.locator('.wk-num');
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('ArrowRight');
  await expect(num).toHaveText('semana 46');
  await page.keyboard.press('ArrowRight');
  await expect(num).toHaveText('semana 47');
  await page.keyboard.press('h');
  await expect(num).toHaveText('semana 45');
  await page.keyboard.press('ArrowLeft');
  await expect(num).toHaveText('semana 44');
  await page.keyboard.press('h');
  await page.keyboard.press('2');
  await expect(page.locator('#v-hoy')).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.locator('#v-progreso')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('#v-semana')).toBeVisible();
  // n: a la barra de apuntar; lo que se escribe ahí no son atajos
  await page.keyboard.press('n');
  await expect(page.locator('#cap')).toBeFocused();
  await page.keyboard.type('2 h ? ');
  await expect(page.locator('#cap')).toHaveValue('2 h ? ');
  await expect(page.locator('#v-semana')).toBeVisible();
  await expect(modal(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#cap').fill('');
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  // ?: la ayuda; con ella abierta, los atajos no hacen nada; Esc la cierra
  await page.keyboard.press('?');
  await expect(modal(page)).toContainText('Atajos de teclado');
  await page.keyboard.press('ArrowRight');
  await expect(num).toHaveText('semana 45');
  await page.keyboard.press('Escape');
  await expect(modal(page)).toHaveCount(0);
  // también desde Gestión ▾
  await menu(page, /Atajos de teclado/);
  await expect(modal(page)).toContainText('volver a la semana actual');
  await page.keyboard.press('Escape');
  // con un bloque enfocado, las flechas no cambian de semana
  await bloque(page, 'Gimnasio').focus();
  await page.keyboard.press('ArrowRight');
  await expect(num).toHaveText('semana 45');
});

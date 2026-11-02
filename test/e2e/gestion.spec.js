// e2e · Gestión: semanas, cerrar semana (4 pasos y todas las decisiones), reabrir, plantilla, tipos, ajustes y tema.
import { test, expect, abrir, bloque, esperarFichero } from './ayudas.js';

const menu = async (page, texto) => {
  await page.locator('#gbtn').click();
  await page.locator('#gmenu').getByRole('menuitem', { name: texto }).click();
};
const modal = (page) => page.locator('#modal .mod');

test('Semanas: cada estado con su acción (ver, cerrar, reabrir)', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /^Semanas/);
  const m = modal(page);
  await expect(m.locator('.pend', { hasText: 'Semana 43' })).toContainText('cerrada');
  await expect(m.locator('.pend', { hasText: 'Semana 44' })).toContainText('sin cerrar');
  await expect(m.locator('.pend', { hasText: 'Semana 45' })).toContainText('en curso');
  await expect(m.locator('.pend', { hasText: 'Semana 46' })).toContainText('sin planificar');
  await m.locator('.pend', { hasText: 'Semana 43' }).locator('[data-ir]').click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page.locator('.wk-num')).toHaveText('semana 43');
  await menu(page, /^Semanas/);
  await modal(page).locator('[data-reabrir="2026-W43"]').click();
  await expect(page.locator('#toast')).toContainText('Semana 43 reabierta · la semana 44 sigue igual');
  await esperarFichero(app, 'semanas/2026-W43.md', (t) => /estado: reabierta/.test(t));
  await expect(page.locator('.wk-titulo .pill')).toHaveText('reabierta');
});

test('cerrar semana: 4 pasos con todas las decisiones, lecciones en Progreso y Las 3 con «si → entonces»', async ({ page, app }) => {
  const W45antes = app.leer('semanas/2026-W45.md');
  await abrir(page, app);
  await menu(page, 'Cerrar semana 44');
  const m = modal(page);
  await expect(m.locator('.mod-cab')).toContainText('Cerrar semana 44 · Resumen');
  await m.getByLabel('Qué funcionó').fill('Estudiar antes de cenar');
  await m.getByLabel('Qué cambio la semana que viene').fill('Menos reuniones el jueves');
  await m.getByRole('button', { name: 'siguiente →' }).click();
  await expect(m.locator('.mod-cab')).toContainText('Pendientes');
  const decidir = (clave, opcion) => m.locator(`[data-decision="${clave}"][data-opcion="${opcion}"]`).click();
  await decidir('horas:Curso', 'sumar');
  await decidir('tarea:5', 'archivar'); // Reservar fisio
  await decidir('tarea:12', 'hoy'); // Renovar DNI
  await decidir('antigua:13', 'archivar'); // Post del blog
  await decidir('proyecto:7', 'pausar'); // gymhub
  await decidir('inbox:5', 'tareas');
  await expect(m.locator('[data-decision="tarea:12"][data-opcion="hoy"]')).toHaveAttribute('aria-pressed', 'true');
  await m.getByRole('button', { name: 'siguiente →' }).click();
  await expect(m.locator('.mod-cab')).toContainText('Proyectos y algún día');
  await expect(m.locator('[data-proyecto="gymhub"]')).toHaveCount(0); // pausado en el paso anterior
  await m.locator('[data-proyecto="huddle"]').fill('pantalla de inicio');
  await expect(m).toContainText('Aprender Rust');
  await m.getByRole('button', { name: 'siguiente →' }).click();
  await expect(m.locator('.mod-cab')).toContainText('Nueva semana');
  await expect(m.getByLabel('Horas de Curso')).toHaveValue('8.5'); // 6 + 2,5 que faltaron
  await m.getByLabel('Objetivo 3').fill('Publicar el post del blog');
  await m.locator('[data-l3="2"][data-campo="si"]').fill('el viernes estoy cansado');
  await m.locator('[data-l3="2"][data-campo="entonces"]').fill('lo dejo listo el jueves');
  // atrás y adelante no pierde nada
  await m.getByRole('button', { name: '← atrás' }).click();
  await expect(m.locator('[data-proyecto="huddle"]')).toHaveValue('pantalla de inicio');
  await m.getByRole('button', { name: 'siguiente →' }).click();
  await expect(m.getByLabel('Objetivo 3')).toHaveValue('Publicar el post del blog');
  await m.getByRole('button', { name: 'Cerrar y planificar la semana 45' }).click();
  await expect(page.locator('#toast')).toContainText('Semana 44 cerrada');
  const W44 = await esperarFichero(app, 'semanas/2026-W44.md', (t) => /estado: cerrada/.test(t));
  expect(W44).toMatch(/## Cierre[\s\S]*- funcionó: Estudiar antes de cenar[\s\S]*- cambio: Menos reuniones el jueves/);
  const tareas = app.leer('tareas.md');
  expect(tareas).not.toContain('Reservar fisio');
  expect(tareas).not.toContain('Post del blog');
  expect(tareas).toMatch(/## Hoy[^#]*Renovar DNI/);
  expect(tareas).toMatch(/## Más adelante[\s\S]*idea: comparar rerankers con un dataset propio[\s\S]*mirar el curso de evaluación de agentes/);
  expect(app.leer('archivo/tareas-2026-11.md') ?? app.leer('archivo/tareas-2026-10.md')).toMatch(/Reservar fisio|Post del blog/);
  expect(app.leer('inbox.md')).not.toContain('rerankers');
  const pro = app.leer('proyectos.md');
  expect(pro).toMatch(/## gymhub\n- siguiente: cargar historial real\n- estado: pausado/);
  expect(pro).toMatch(/## huddle\n- siguiente: pantalla de inicio/);
  const W45 = app.leer('semanas/2026-W45.md');
  expect(W45).toMatch(/- \[ \] Publicar el post del blog .*\| si: el viernes estoy cansado \| entonces: lo dejo listo el jueves/);
  expect(W45).toMatch(/## Estudio[\s\S]*- Curso: 8,5 h/);
  // lo que ya tenía la semana 45 se queda
  for (const l of W45antes.split('\n').filter((x) => x.startsWith('- L 09:00') || x.startsWith('- J 21:30'))) expect(W45).toContain(l);
  // y las lecciones aparecen en Progreso
  await page.locator('#seg').getByRole('button', { name: 'Progreso' }).click();
  await expect(page.locator('#v-progreso')).toContainText('Estudiar antes de cenar');
  await expect(page.locator('#v-progreso')).toContainText('Menos reuniones el jueves');
});

test('Plantilla: alta (también en las semanas ya creadas), quitar y deshacer; sin la casilla, solo la plantilla', async ({ page, app }) => {
  await abrir(page, app);
  // la semana 46 ya existe (creada antes de cambiar la plantilla)
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await esperarFichero(app, 'semanas/2026-W46.md', (t) => t != null);
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await menu(page, /Plantilla de semana/);
  const m = modal(page);
  await m.getByLabel('Título').fill('Inglés');
  await m.getByRole('button', { name: 'Añadir a la plantilla' }).click();
  await expect(m.getByRole('alert')).toHaveText('Elige al menos un día');
  await expect(m.getByLabel('Título')).toHaveValue('Inglés');
  await m.locator('[data-dia="1"]').check();
  await m.locator('[data-dia="3"]').check();
  await m.locator('#pl-tipo').selectOption('estudio');
  await m.getByLabel('Empieza').fill('07:30');
  await m.getByLabel('Termina').fill('08:30');
  await expect(m.locator('#pl-dur-texto')).toHaveText('1 h');
  await expect(m.locator('#pl-aplicar')).toBeChecked(); // por defecto, también en las semanas ya creadas
  await m.getByRole('button', { name: 'Añadir a la plantilla' }).click();
  await expect(page.locator('#toast')).toContainText('«Inglés» añadido a la plantilla · y añadido en 4 bloques de 2 semanas');
  await esperarFichero(app, 'plantilla.md', (t) => /^- M,J 07:30-08:30 \| estudio \| Inglés$/m.test(t));
  for (const id of ['2026-W45', '2026-W46']) {
    await esperarFichero(app, `semanas/${id}.md`, (t) => /^- M 07:30-08:30 \| estudio \| Inglés \| plantilla$/m.test(t) && /^- J 07:30-08:30 \| estudio \| Inglés \| plantilla$/m.test(t));
  }
  const W44 = app.leer('semanas/2026-W44.md');
  // quitarlo lo quita también de esas semanas (y se puede deshacer)
  await m.locator('.pend', { hasText: 'Inglés' }).locator('[data-quitar]').click();
  await expect(page.locator('#toast')).toContainText('«Inglés» quitado de la plantilla · y quitado en 4 bloques de 2 semanas');
  await esperarFichero(app, 'semanas/2026-W46.md', (t) => !t.includes('Inglés'));
  await page.locator('#toast [data-deshacer]').click();
  await esperarFichero(app, 'semanas/2026-W46.md', (t) => t.includes('Inglés'));
  await esperarFichero(app, 'plantilla.md', (t) => t.includes('Inglés'));
  expect(app.leer('semanas/2026-W44.md')).toBe(W44); // la pasada, nunca
  // sin la casilla: solo la plantilla
  const W45 = app.leer('semanas/2026-W45.md');
  await m.locator('#pl-aplicar').uncheck();
  await expect(m.getByLabel('Título')).toHaveValue(''); // el formulario se vació tras añadir
  await m.getByLabel('Título').fill('Mercado');
  await m.locator('[data-dia="5"]').check();
  await m.getByRole('button', { name: 'Añadir a la plantilla' }).click();
  await expect(page.locator('#toast span')).toHaveText('«Mercado» añadido a la plantilla');
  await esperarFichero(app, 'plantilla.md', (t) => t.includes('Mercado'));
  expect(app.leer('semanas/2026-W45.md')).toBe(W45);
});

test('Plantilla: editar una entrada (días y horas) cambia también las semanas ya creadas; lo que moviste se queda', async ({ page, app }) => {
  app.escribir('plantilla.md', `${app.leer('plantilla.md')}- L,M,X,J,V 21:00-23:00 | entreno | Entreno\n`);
  await abrir(page, app);
  await page.getByRole('button', { name: '↻ Aplicar plantilla' }).click(); // la 45 ya lo tiene (desde hoy, lunes)
  await esperarFichero(app, 'semanas/2026-W45.md', (t) => (t.match(/\| Entreno \| plantilla/g) ?? []).length === 5);
  // el martes lo cambias esta semana a mano
  await page.locator('#wk .blk', { hasText: 'Entreno' }).nth(1).click();
  await page.locator('.pop').getByLabel('Empieza').fill('20:00');
  await page.locator('.pop').getByLabel('Termina').fill('22:00');
  await page.locator('.pop').getByRole('button', { name: 'Guardar' }).click();
  await esperarFichero(app, 'semanas/2026-W45.md', (t) => /^- M 20:00-22:00 \| entreno \| Entreno \| plantilla$/m.test(t));
  // ahora solo L, X y V, de 20:30 a 22:30
  await menu(page, /Plantilla de semana/);
  const m = modal(page);
  await m.getByRole('button', { name: 'Editar Entreno' }).click();
  await expect(m.locator('.lab', { hasText: 'Editar «Entreno»' })).toBeVisible();
  await expect(m.getByLabel('Título')).toHaveValue('Entreno');
  await expect(m.locator('[data-dia="4"]')).toBeChecked();
  await m.getByRole('button', { name: 'ninguno' }).click();
  for (const d of ['0', '2', '4']) await m.locator(`[data-dia="${d}"]`).check();
  await m.getByLabel('Empieza').fill('20:30');
  await m.getByLabel('Termina').fill('22:30');
  await m.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('#toast')).toContainText('«Entreno» cambiado en la plantilla · y cambiado en 4 bloques de 1 semana');
  await esperarFichero(app, 'plantilla.md', (t) => /^- L,X,V 20:30-22:30 \| entreno \| Entreno$/m.test(t));
  const W45 = await esperarFichero(app, 'semanas/2026-W45.md', (t) => /^- L 20:30-22:30 \| entreno \| Entreno \| plantilla$/m.test(t));
  expect(W45).toMatch(/^- X 20:30-22:30 \| entreno \| Entreno \| plantilla$/m);
  expect(W45).toMatch(/^- V 20:30-22:30 \| entreno \| Entreno \| plantilla$/m);
  expect(W45).not.toMatch(/^- J .*Entreno/m); // el jueves ya no está
  expect(W45).toMatch(/^- M 20:00-22:00 \| entreno \| Entreno \| plantilla$/m); // el martes que cambiaste se queda
  await expect(m.getByLabel('Título')).toHaveValue(''); // vuelve a «añadir»
  // cancelar una edición no cambia nada
  await m.getByRole('button', { name: 'Editar Entreno' }).click();
  await m.getByLabel('Título').fill('Otra cosa');
  await m.getByRole('button', { name: 'Cancelar' }).click();
  await expect(m.locator('.pend', { hasText: 'Entreno' })).toBeVisible();
  expect(app.leer('plantilla.md')).not.toContain('Otra cosa');
});

test('↻ Aplicar plantilla en la semana: añade lo que falta aunque se solape, avisa, y los solapes se ven', async ({ page, app }) => {
  // algo en la plantilla que la semana 45 no tiene y choca con el trabajo
  app.escribir('plantilla.md', `${app.leer('plantilla.md')}- L,M,X,J,V 17:00-18:00 | personal | Llamar a casa\n`);
  await abrir(page, app);
  await page.getByRole('button', { name: '↻ Aplicar plantilla' }).click();
  await expect(page.locator('#toast')).toContainText('Plantilla aplicada: 5 bloques ↻ · ⚠ 5 se solapan');
  await esperarFichero(app, 'semanas/2026-W45.md', (t) => (t.match(/\| Llamar a casa \| plantilla/g) ?? []).length === 5);
  await expect(page.locator('.wk-plan')).toContainText('⚠ 5 solapes');
  await expect(page.locator('#wk .blk.ovl', { hasText: 'Llamar a casa' })).toHaveCount(5);
  // otra vez: nada que añadir
  await page.getByRole('button', { name: '↻ Aplicar plantilla' }).click();
  await expect(page.locator('#toast')).toContainText('Esta semana ya tiene todo lo de la plantilla');
  // en una semana pasada no se ofrece
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 44');
  await expect(page.getByRole('button', { name: '↻ Aplicar plantilla' })).toHaveCount(0);
});

test('Tipos: color, banderas, alta y quitar bloqueado si está en uso', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /Tipos/);
  const m = modal(page);
  await m.getByRole('radiogroup', { name: 'Color de personal' }).getByRole('radio').nth(1).click();
  await esperarFichero(app, 'tipos.md', (t) => !/- personal \| #86651F/.test(t) && /- personal \| #[0-9A-F]{6}/.test(t));
  await expect(m.locator('[data-quitar="personal"]')).toBeDisabled();
  await expect(m.locator('[data-quitar="personal"]')).toHaveAttribute('title', /En uso/);
  await m.getByLabel('Nuevo tipo').fill('lectura');
  await m.getByRole('button', { name: 'Añadir', exact: true }).click();
  await esperarFichero(app, 'tipos.md', (t) => /^- lectura \| #[0-9A-F]{6}$/m.test(t));
  await m.getByLabel('Nuevo tipo').fill('prioridad');
  await m.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Ese nombre de tipo no se puede usar');
  await expect(m.locator('[data-quitar="lectura"]')).toBeEnabled();
  await m.locator('[data-quitar="lectura"]').click();
  await esperarFichero(app, 'tipos.md', (t) => !t.includes('lectura'));
  // bandera «estudio» en proyectos
  await m.locator('.pend', { hasText: 'proyectos' }).getByRole('button', { name: 'estudio' }).click();
  await esperarFichero(app, 'tipos.md', (t) => /^- proyectos \| #2F6B4F \| estudio$/m.test(t));
});

test('Ajustes: cada uno cambia la interfaz al momento', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /Ajustes/);
  const m = modal(page);
  await m.locator('#aj-hasta').selectOption('22');
  await esperarFichero(app, 'ajustes.md', (t) => /- horas: 7-22/.test(t));
  await expect(page.locator('#wk .horas span').last()).toHaveText('21');
  await m.locator('#aj-inicio').selectOption('domingo');
  await esperarFichero(app, 'ajustes.md', (t) => /- inicio_semana: domingo/.test(t));
  await expect(page.locator('#wk .dia-cab').first()).toContainText('D 1');
  await m.locator('#aj-tareas').fill('2');
  await m.locator('#aj-tareas').press('Tab');
  await esperarFichero(app, 'ajustes.md', (t) => /- tareas_hoy: 2/.test(t));
  await m.locator('#aj-cierre').selectOption({ label: '21:00' });
  await esperarFichero(app, 'ajustes.md', (t) => /- cierre: 21:00/.test(t));
  await m.locator('#aj-foco').selectOption({ label: '5 h' });
  await esperarFichero(app, 'ajustes.md', (t) => /- foco_max: 5/.test(t));
  // capacidad 50 %: el lunes (690 min de 900 visibles, 77 %, «aviso» con 70 %) pasa a «exceso»
  const lunes = page.locator('#wk .dias > div', { has: page.locator('.dia-cab', { hasText: 'L 2' }) }).locator('.capb > div');
  await expect(lunes).toHaveClass('aviso');
  await m.locator('#aj-capacidad').evaluate((el) => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await esperarFichero(app, 'ajustes.md', (t) => /- capacidad: 50/.test(t));
  await expect(lunes).toHaveClass('exceso');
  await expect(m.locator('#aj-capacidad-v')).toHaveText('50 %');
  for (const [sel, valor, re] of [['#aj-mejores', 'noches', /- mejores_horas: noches/], ['#aj-margen', 'fijo', /- margen: fijo/], ['#aj-copias', 'al cerrar semana', /- copias: al cerrar semana/]]) {
    await m.locator(sel).selectOption(valor);
    await esperarFichero(app, 'ajustes.md', (t) => re.test(t));
  }
  await m.locator('#aj-puerto').fill('4400');
  await m.locator('#aj-puerto').press('Tab');
  await esperarFichero(app, 'ajustes.md', (t) => /- puerto: 4400/.test(t));
  await page.keyboard.press('Escape');
  await page.locator('#gbtn').click();
  await expect(page.locator('#gmenu')).toContainText('copia al cerrar semana');
  await page.keyboard.press('Escape');
  await expect(page.locator('#wk .foco')).toHaveCount(0); // 3,5 h el domingo ya no pasa de 5 h
  await expect(bloque(page, 'Gimnasio')).toBeVisible();
  await expect(bloque(page, 'Deploy del pipeline')).toContainText('☾'); // 21:30 > 21:00
  await page.locator('#seg').getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('#hoy-tareas .fila-lab .mut')).toHaveText('4/2');
  await expect(page.locator('#hoy-cierre .fila-lab')).toContainText('a las 21:00');
  // los comentarios del fichero se conservan
  expect(app.leer('ajustes.md')).toContain('# % máximo del día ocupado (50–100)');
});

test('Tema: elegir cada tema lo aplica y lo guarda; decoración y temporada', async ({ page, app }) => {
  await abrir(page, app);
  await menu(page, /^Tema/);
  const m = modal(page);
  for (const [id, nombre] of [['nordico-oscuro', 'Nórdico oscuro'], ['papel', 'Papel'], ['universo', 'Universo'], ['halloween', 'Halloween'], ['alto-contraste', 'Alto contraste'], ['nordico-claro', 'Nórdico claro']]) {
    await m.getByRole('radio', { name: nombre }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', id);
    await expect(m.getByRole('radio', { name: nombre })).toHaveAttribute('aria-checked', 'true');
    await esperarFichero(app, 'ajustes.md', (t) => new RegExp(`- tema: ${id}`).test(t));
  }
  await expect(m.getByRole('radio', { name: 'Personalizado' })).toBeDisabled(); // no hay tema.md
  await m.getByLabel(/Decoración del tema/).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-deco', 'no');
  await esperarFichero(app, 'ajustes.md', (t) => /- decoracion: no/.test(t));
});

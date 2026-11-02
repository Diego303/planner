// e2e · Semana: crear, arrastrar, estirar, editar, hecho, a medias, eliminar y deshacer, marcas, Las 3, Proponer y navegar.
import { test, expect, abrir, bloque, esperarFichero } from './ayudas.js';

const W45 = 'semanas/2026-W45.md';

test('crear con doble clic en un hueco: bloque de 1 h a la media hora del clic', async ({ page, app }) => {
  await abrir(page, app);
  const col = page.locator('#wk .col[data-dia="2"]'); // miércoles
  const caja = await col.boundingBox();
  // la rejilla empieza a las 07:00 con 23 px por hora: 13 h 10 min más abajo son las 20:10 → se ajusta a las 20:00
  await page.mouse.dblclick(caja.x + 5, caja.y + 13 * 23 + 4);
  await expect(page.locator('.pop #ed-titulo')).toBeFocused();
  await page.locator('#ed-titulo').fill('Escribir el informe');
  await page.keyboard.press('Enter');
  await esperarFichero(app, W45, (t) => /^- X 20:00-21:00 \| personal \| Escribir el informe$/m.test(t));
  await expect(bloque(page, 'Escribir el informe')).toBeVisible();
});

/** Arrastra con el ratón desde el centro de `origen` (o desde un punto) moviendo dx, dy en pasos. */
async function arrastrar(page, el, dx, dy, { desde = null } = {}) {
  await expect(el).toBeVisible();
  const c = await el.boundingBox();
  const [x, y] = desde ? desde(c) : [c.x + c.width / 2, c.y + Math.min(8, c.height / 2)];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8);
  await page.mouse.up();
}

test('arrastrar a otro día y otra hora (ajuste a 30 min) y soltar fuera de la rejilla', async ({ page, app }) => {
  await abrir(page, app);
  const anchoCol = (await page.locator('#wk .col').first().boundingBox()).width + 4;
  // jueves 21:30–23:00 → un día a la derecha y 2 h antes (+5 px que se redondean): viernes 19:30–21:00
  await arrastrar(page, bloque(page, 'Deploy del pipeline'), anchoCol, -2 * 23 + 5);
  await esperarFichero(app, W45, (t) => /^- V 19:30-21:00 \| trabajo \| Deploy del pipeline$/m.test(t));
  // muy a la derecha y muy abajo: se queda en el domingo y termina a las 24:00
  await arrastrar(page, bloque(page, 'AI-102 · visión'), anchoCol * 20, 2000);
  await esperarFichero(app, W45, (t) => /^- D 22:30-24:00 \| estudio \| AI-102 · visión \| tipo: aprender \| hecho: \+30m$/m.test(t));
  // y muy arriba a la izquierda: el lunes a las 07:00
  await arrastrar(page, bloque(page, 'Curso · lab RAG'), -anchoCol * 20, -2000);
  await esperarFichero(app, W45, (t) => /^- L 07:00-08:30 \| estudio \| Curso · lab RAG/m.test(t));
});

test('estirar: mínimo 30 min y como mucho hasta la última hora visible', async ({ page, app }) => {
  await abrir(page, app);
  const borde = (c) => [c.x + c.width / 2, c.y + c.height - 2];
  await arrastrar(page, bloque(page, 'MLA-C01 · simulacro'), 0, -500, { desde: borde });
  await esperarFichero(app, W45, (t) => /^- J 20:00-20:30 \| estudio \| MLA-C01 · simulacro/m.test(t));
  await arrastrar(page, bloque(page, 'MLA-C01 · simulacro'), 0, 2000, { desde: borde });
  await esperarFichero(app, W45, (t) => /^- J 20:00-24:00 \| estudio \| MLA-C01 · simulacro/m.test(t));
  // estirar media hora justa
  await arrastrar(page, bloque(page, 'Gimnasio'), 0, 23 / 2 + 1, { desde: borde });
  await esperarFichero(app, W45, (t) => /^- L 18:00-20:00 \| entreno \| Gimnasio \| plantilla$/m.test(t));
});

test('editar todos los campos: título, tipo, subtipo, día, hora, duración, primer paso y plantilla', async ({ page, app }) => {
  await abrir(page, app);
  await bloque(page, 'Deploy del pipeline').click();
  const pop = page.locator('.pop');
  await expect(pop).toBeVisible();
  await pop.locator('#ed-titulo').fill('AI-102 · laboratorio 3');
  await pop.getByRole('radio', { name: 'estudio' }).click();
  await expect(pop.locator('[data-subtipos]')).toBeVisible();
  await pop.locator('[data-subtipo="repasar"]').click();
  await pop.locator('#ed-dia').selectOption({ label: 'S 7' });
  await pop.locator('#ed-inicio').selectOption({ label: '16:30' });
  await pop.locator('#ed-dur').selectOption({ label: '2 h' });
  await pop.locator('#ed-paso').fill('abrir el lab 3 | y leer el enunciado');
  await pop.locator('#ed-plantilla').check();
  await pop.locator('[data-ed="guardar"]').click();
  await expect(pop).toBeHidden();
  const t = await esperarFichero(app, W45, (x) => x.includes('AI-102 · laboratorio 3'));
  expect(t).toMatch(/^- S 16:30-18:30 \| estudio \| AI-102 · laboratorio 3 \| tipo: repasar \| paso: abrir el lab 3 \/ y leer el enunciado \| plantilla$/m);
  expect(t).not.toContain('Deploy del pipeline');
  // tipo sin subtipos: al pasar a «personal» el subtipo se va
  await bloque(page, 'AI-102 · laboratorio 3').click();
  await expect(pop.locator('[data-subtipo="repasar"]')).toHaveAttribute('aria-pressed', 'true');
  await pop.getByRole('radio', { name: 'personal' }).click();
  await expect(pop.locator('[data-subtipos]')).toBeHidden();
  await pop.locator('#ed-plantilla').uncheck();
  await pop.locator('[data-ed="guardar"]').click();
  await expect(page.locator('#toast')).toContainText('Solo en esta semana');
  await esperarFichero(app, W45, (x) => /^- S 16:30-18:30 \| personal \| AI-102 · laboratorio 3 \| paso: abrir el lab 3 \/ y leer el enunciado$/m.test(x));
});

test('Hecho con cada duración real, nota de simulacro y A medias con el aviso «lo dejaste en»', async ({ page, app }) => {
  app.escribir(W45, `${app.leer(W45)}- S 16:00-17:00 | estudio | AI-102 · lectura | tipo: aprender\n`);
  await abrir(page, app);
  const pop = page.locator('.pop');
  const casos = [['Gimnasio', 'menos', /^- L 18:00-19:30 \| entreno \| Gimnasio \| hecho: -30m \| plantilla$/m],
    ['Trabajo', 'lo previsto', /^- L 09:00-17:30 \| trabajo \| Trabajo \| hecho: 0 \| plantilla$/m],
    ['Curso · lab RAG', '+30 min', /^- M 19:30-21:00 \| estudio \| Curso · lab RAG \| tipo: aprender \| paso: .* \| hecho: \+30m$/m],
    ['Curso · módulo 6', '+1 h o más', /^- D 10:00-12:00 \| estudio \| Curso · módulo 6 \| tipo: aprender \| hecho: \+1h$/m]];
  for (const [titulo, opcion, re] of casos) {
    await bloque(page, titulo).click();
    await pop.getByRole('button', { name: 'Hecho ✓' }).click();
    await pop.getByRole('button', { name: opcion, exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Hecho ✓');
    await esperarFichero(app, W45, (t) => re.test(t));
  }
  await expect(bloque(page, 'Gimnasio')).toHaveClass(/done/);
  // simulacro con nota: va al bloque y a los simulacros de estudio.md
  await bloque(page, 'MLA-C01 · simulacro').click();
  await pop.getByRole('button', { name: 'Hecho ✓' }).click();
  await pop.locator('#ed-nota').fill('74');
  await pop.getByRole('button', { name: 'lo previsto' }).click();
  await esperarFichero(app, W45, (t) => /^- J 20:00-21:00 \| estudio \| MLA-C01 · simulacro \| tipo: simulacro \| hecho: 0 \| nota: 74$/m.test(t));
  await esperarFichero(app, 'estudio.md', (t) => /simulacros: 58 @2026-10-02, 64 @2026-10-16, 74 @2026-11-05/.test(t));
  // desmarcar
  await bloque(page, 'Gimnasio').click();
  await pop.getByRole('button', { name: 'Desmarcar' }).click();
  await esperarFichero(app, W45, (t) => /^- L 18:00-19:30 \| entreno \| Gimnasio \| plantilla$/m.test(t));
  // A medias: la nota va a estudio.md y aparece al abrir otro bloque del mismo tema
  await bloque(page, 'AI-102 · repasar').click();
  await expect(pop.locator('.nota-dejado')).toHaveCount(0);
  await pop.getByRole('button', { name: 'A medias' }).click();
  await pop.locator('#ed-dejado').fill('pregunta 23 de visión');
  await pop.getByRole('button', { name: 'Guardar nota' }).click();
  await esperarFichero(app, 'estudio.md', (t) => /## AI-102[\s\S]*- dejado: pregunta 23 de visión/.test(t));
  await page.keyboard.press('Escape');
  await bloque(page, 'AI-102 · lectura').click();
  await expect(pop.locator('.nota-dejado')).toContainText('La última vez lo dejaste en: pregunta 23 de visión');
  // en un bloque ya hecho no se recuerda
  await page.keyboard.press('Escape');
  await bloque(page, 'AI-102 · visión').click();
  await expect(pop.locator('.nota-dejado')).toHaveCount(0);
  // A medias no se ofrece a lo que no es estudio ni proyecto
  await page.keyboard.press('Escape');
  await bloque(page, 'Trabajo').click();
  await expect(pop.getByRole('button', { name: 'A medias' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await bloque(page, 'Deploy del pipeline').click();
  await expect(pop.getByRole('button', { name: 'A medias' })).toBeDisabled();
});

test('eliminar y deshacer dentro de los 10 s; pasados los 10 s ya no se ofrece', async ({ page, app }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00') });
  await abrir(page, app);
  const original = app.leer(W45);
  const pop = page.locator('.pop');
  await bloque(page, 'Deploy del pipeline').click();
  await pop.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#toast')).toContainText('Bloque «Deploy del pipeline» eliminado');
  await esperarFichero(app, W45, (t) => !t.includes('Deploy del pipeline'));
  await page.clock.runFor(9000);
  await page.locator('#toast [data-deshacer]').click();
  await expect(page.locator('#toast')).toContainText('Deshecho');
  await esperarFichero(app, W45, (t) => t === original);
  // otra vez, pero esperando 10 s: el toast (y su deshacer) desaparece
  await bloque(page, 'Deploy del pipeline').click();
  await pop.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#toast [data-deshacer]')).toBeVisible();
  await page.clock.runFor(10_500);
  await expect(page.locator('#toast [data-deshacer]')).toHaveCount(0);
  await esperarFichero(app, W45, (t) => !t.includes('Deploy del pipeline'));
});

test('solapes visibles y marcas ↻ ★ ◎ ⟲ ☾', async ({ page, app }) => {
  app.escribir(W45, app.leer(W45).replace('## Bloques\n', '## Bloques\n- S 11:00-12:30 | personal | Comida con Ana\n'));
  await abrir(page, app);
  await expect(page.locator('.wk-plan')).toContainText('⚠ 1 solape');
  for (const t of ['Comida con Ana']) await expect(bloque(page, t)).toHaveClass(/ovl/);
  await expect(page.locator('#wk .blk.ovl')).toHaveCount(2); // la comida y el gimnasio del sábado
  await expect(bloque(page, 'Comida con Ana')).toHaveAttribute('aria-label', /se solapa con otro bloque/);
  await expect(bloque(page, 'Gimnasio')).toContainText('↻');
  await expect(bloque(page, 'Curso · lab RAG')).toContainText('★'); // avanza «Entregar el lab de RAG» (rel: Curso)
  await expect(bloque(page, 'MLA-C01 · simulacro')).toContainText('★ ◎');
  await expect(bloque(page, 'AI-102 · repasar')).toContainText('⟲');
  await expect(bloque(page, 'Deploy del pipeline')).toContainText('☾'); // trabajo tras la hora de cierre (22:30)
  await expect(bloque(page, 'Deploy del pipeline')).toHaveClass(/noche/);
  await expect(bloque(page, 'Trabajo')).not.toContainText('☾');
});

test('línea de ocupación con sus 3 colores y aviso de foco', async ({ page, app }) => {
  // sábado: 90 min de gimnasio + 15 h → exceso; viernes: 600 + 240 min → aviso; lunes: ok
  app.escribir(W45, app.leer(W45).replace('## Bloques\n', '## Bloques\n- S 08:00-23:00 | personal | Mudanza\n- V 20:00-24:00 | personal | Fiesta\n'));
  await abrir(page, app);
  const linea = (i) => page.locator('#wk .dias > div').nth(i + 1).locator('.capb > div');
  await expect(linea(0)).toHaveClass('ok');
  await expect(linea(4)).toHaveClass('aviso');
  await expect(linea(5)).toHaveClass('exceso');
  const colores = await Promise.all([0, 4, 5].map((i) => linea(i).evaluate((e) => getComputedStyle(e).backgroundColor)));
  expect(new Set(colores).size).toBe(3);
  // domingo: Curso 2 h + AI-102 1,5 h = 3,5 h de estudio > 3 h (foco_max)
  await expect(page.locator('#wk .dias > div').nth(7).locator('.foco')).toHaveText('3,5 h estudio');
  await expect(page.locator('#wk .dias > div').nth(1).locator('.foco')).toHaveCount(0);
});

test('Las 3 en pastillas: marcar, editar en línea, quitar vaciando y añadir', async ({ page, app }) => {
  await abrir(page, app);
  const p = page.locator('#wk [data-las3]');
  await expect(p).toHaveCount(3);
  await p.first().locator('[data-las3-marcar]').click();
  await esperarFichero(app, W45, (t) => t.includes('- [x] Entregar el lab de RAG | rel: Curso'));
  const texto = p.nth(1).locator('[data-las3-texto]');
  await texto.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (y repasar fallos)');
  await page.keyboard.press('Enter');
  await esperarFichero(app, W45, (t) => t.includes('- [ ] Simulacro MLA-C01 ≥ 70 % (y repasar fallos) | rel: MLA-C01'));
  // Esc deshace lo escrito sin guardar
  await texto.click();
  await page.keyboard.type('XXXX');
  await page.keyboard.press('Escape');
  await expect(texto).toHaveText('Simulacro MLA-C01 ≥ 70 % (y repasar fallos)');
  // vaciarla la quita (con deshacer)
  await p.nth(2).locator('[data-las3-texto]').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('quitado de Las 3');
  await esperarFichero(app, W45, (t) => !t.includes('Cerrar la demo del agente'));
  await page.locator('[data-las3-nueva]').fill('Publicar el post del blog');
  await page.keyboard.press('Enter');
  await esperarFichero(app, W45, (t) => /- \[ \] Publicar el post del blog$/m.test(t));
});

test('Proponer semana y aceptar una sugerencia (abriéndola o arrastrándola)', async ({ page, app }) => {
  await abrir(page, app);
  await page.getByRole('button', { name: 'Proponer semana' }).click();
  await expect(page.locator('#toast')).toContainText(/sugerencias? · ★ primero lo que avanza las 3/);
  const sug = page.locator('#wk .blk.sug');
  await expect(sug.first()).toBeVisible();
  const n = await sug.count();
  const t = await esperarFichero(app, W45, (x) => (x.match(/\| sugerido/g) ?? []).length === n);
  expect(t).toMatch(/\| sugerido/);
  // abrirla y aceptarla
  const titulo = (await sug.first().getAttribute('aria-label')).split(' · ').slice(0, 2).join(' · ');
  await sug.first().click();
  await page.locator('.pop').getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.locator('#wk .blk.sug')).toHaveCount(n - 1);
  await esperarFichero(app, W45, (x) => (x.match(/\| sugerido/g) ?? []).length === n - 1 && x.includes(titulo));
  // arrastrar otra también la acepta
  await arrastrar(page, page.locator('#wk .blk.sug').first(), 0, 23);
  await esperarFichero(app, W45, (x) => (x.match(/\| sugerido/g) ?? []).length === n - 2);
});

test('navegar ‹ hoy ›: pasadas, cerradas en solo lectura de verdad, futuras y cambio de año', async ({ page, app }) => {
  await abrir(page, app);
  const pill = page.locator('.wk-titulo .pill');
  await expect(pill).toHaveText('en curso');
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 44');
  await expect(pill).toHaveText('sin cerrar');
  await expect(page.locator('.banda')).toContainText('Semana pasada sin cerrar');
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(pill).toHaveText('cerrada');
  await expect(page.locator('.banda')).toContainText('solo lectura');
  // solo lectura real: ni doble clic, ni arrastrar, ni estirar, ni abrir el editor
  const W43 = 'semanas/2026-W43.md';
  const antes = app.leer(W43);
  const col = page.locator('#wk .col').nth(2);
  const c = await col.boundingBox();
  await page.mouse.dblclick(c.x + 5, c.y + 13 * 23 + 4);
  const b = page.locator('#wk .blk').first();
  await arrastrar(page, b, 150, 46);
  await expect(page.locator('#wk .blk .rs')).toHaveCount(0);
  await b.click();
  await expect(page.locator('.pop')).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(app.leer(W43)).toBe(antes);
  await expect(page.locator('[data-las3-nueva]')).toHaveCount(0);
  // hoy vuelve a la actual; las futuras sin fichero
  await page.getByRole('button', { name: 'hoy', exact: true }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 45');
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 46');
  // cambio de año: 2026 tiene semana 53 y después viene la 1 de 2027
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 53');
  await expect(page.locator('.wk-rango')).toHaveText('28 dic – 3 ene');
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.locator('.wk-num')).toHaveText('semana 1');
  await expect(page.locator('.wk-rango')).toHaveText('4 – 10 ene');
});

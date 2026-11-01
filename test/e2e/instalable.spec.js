// e2e · La app se puede instalar (Chrome/Edge): manifest correcto, iconos que cargan y ningún error de instalabilidad.
import { test, expect, abrir } from './ayudas.js';

test('instalable: Chrome no pone ninguna pega y el manifest tiene lo necesario', async ({ page, app }) => {
  await abrir(page, app);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  const r = await page.request.get(`${app.url}manifest.webmanifest`);
  expect(r.headers()['content-type']).toMatch(/application\/manifest\+json/);
  const m = await r.json();
  expect(m).toMatchObject({ name: expect.any(String), short_name: expect.any(String), start_url: '/', display: 'standalone' });
  for (const tam of ['192x192', '512x512']) {
    const icono = m.icons.find((i) => i.sizes === tam);
    expect(icono, tam).toBeTruthy();
    const ir = await page.request.get(new URL(icono.src, app.url).href);
    expect(ir.status(), icono.src).toBe(200);
    expect(ir.headers()['content-type']).toBe('image/png');
  }
  // y la barra de la app instalada toma el color de fondo del tema
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /\S/);
});

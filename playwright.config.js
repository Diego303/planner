// e2e de la web con Playwright (Chromium). Cada test arranca su servidor con una copia nueva de ejemplo/.
// En WSL, Chromium necesita libnss3: una vez, «sudo pnpm exec playwright install-deps chromium».
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '*.spec.js',
  fullyParallel: true,
  workers: 4,
  retries: 0, // nada de reintentos: un test intermitente es un bug que hay que encontrar
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  outputDir: '.tmp-qa/e2e-resultados',
});

// e2e de la web con Playwright (Chromium). Cada test arranca su servidor con una copia nueva de ejemplo/.
// Los que miden tiempos (@tiempo: ≤ 3 s, < 50 ms, sesión larga) se pasan aparte y de uno en uno (pnpm test:e2e):
// con 4 navegadores a la vez, la contienda de CPU retrasa los timers y la medida deja de ser la de un uso normal.
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

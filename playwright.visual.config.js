// Capturas de referencia (test/visual/capturas/) y comprobaciones de diseño adaptable. pnpm test:visual
// Si un cambio visual es intencionado: pnpm test:visual --update-snapshots y revisa las capturas nuevas.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/visual',
  testMatch: '*.spec.js',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 60_000,
  snapshotPathTemplate: '{testDir}/capturas/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.003, animations: 'disabled', caret: 'hide' } },
  reporter: [['list']],
  use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  outputDir: '.tmp-qa/visual-resultados',
});

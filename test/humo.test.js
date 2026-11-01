// Test de humo: el esqueleto cumple las reglas del proyecto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', raiz), 'utf8'));

test('package.json: módulos ES, pnpm, node >= 20 y sin dependencias', () => {
  assert.equal(pkg.type, 'module');
  assert.match(pkg.packageManager, /^pnpm@/);
  assert.equal(pkg.engines.node, '>=20');
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.equal(pkg.bin.planner, './bin/planner.js');
});

test('la estructura de carpetas existe', () => {
  for (const dir of ['bin', 'src/core/formato', 'src/server', 'src/cli', 'web/temas', 'web/vistas',
    'web/gestion', 'web/ui', 'ejemplo', 'scripts/windows', 'test', 'docs/maquetas']) {
    assert.ok(existsSync(new URL(dir, raiz)), `falta ${dir}`);
  }
});

test('la CLI arranca y responde a --version', () => {
  const salida = execFileSync(process.execPath, [new URL('bin/planner.js', raiz).pathname, '--version'], { encoding: 'utf8' });
  assert.equal(salida.trim(), pkg.version);
});

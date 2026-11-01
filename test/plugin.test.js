import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EJEMPLO } from './ayudas.js';
import { semanaDe, fechaDe } from '../src/core/fechas.js';

const PLUGIN = new URL('../plugin/', import.meta.url).pathname;
const SCRIPT = join(PLUGIN, 'scripts/planner.mjs');
const correr = (args, env = {}) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }).trim();

test('manifiesto y comandos del plugin', () => {
  const p = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(p.name, 'planner');
  const comandos = readdirSync(join(PLUGIN, 'commands')).sort();
  assert.deepEqual(comandos, ['dividir.md', 'ordenar.md', 'plan-estudio.md', 'repaso.md']);
  for (const c of comandos) {
    const texto = readFileSync(join(PLUGIN, 'commands', c), 'utf8');
    assert.match(texto, /^---\ndescription: .+\n[\s\S]*?\n---\n/, c);
    assert.match(texto, /copia/, `${c} hace copia antes de escribir`);
    assert.match(texto, /confirmación/, `${c} pide confirmación`);
    assert.match(texto, /diario/, `${c} recuerda no tocar el diario`);
  }
});

test('ayudas: hoy, carpeta, semanas (las cerradas no se tocan) y copia', () => {
  const [fecha, semana] = correr(['hoy']).split('\t');
  assert.equal(fecha, fechaDe(new Date()));
  assert.equal(semana, semanaDe(fecha));
  const dir = mkdtempSync(join(tmpdir(), 'planner-plugin-'));
  cpSync(EJEMPLO, dir, { recursive: true });
  try {
    assert.equal(correr(['carpeta', dir]), dir);
    assert.equal(correr(['carpeta'], { PLANNER_DATOS: dir, PLANNER_HOME: dir }), dir);
    const semanas = correr(['semanas', dir]).split('\n');
    assert.ok(semanas.some((l) => l.startsWith('2026-W43\tcerrada\tNO TOCAR')));
    const destino = correr(['copia', dir]);
    assert.match(destino, /\.copias\/\d{4}-\d{2}-\d{2}-plugin-\d{6}$/);
    assert.ok(existsSync(join(destino, 'semanas', '2026-W45.md')));
    assert.ok(!existsSync(join(destino, '.copias')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

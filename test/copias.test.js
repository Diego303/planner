import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { crearCopias, MAXIMO_COPIAS } from '../src/server/copias.js';

function carpeta() {
  const dir = mkdtempSync(join(tmpdir(), 'planner-copias-'));
  mkdirSync(join(dir, 'semanas'));
  writeFileSync(join(dir, 'tareas.md'), '## Hoy\n');
  writeFileSync(join(dir, 'semanas', '2026-W45.md'), '# Semana 45\n');
  writeFileSync(join(dir, '.tareas.md.tmp-1-1'), 'basura');
  return dir;
}

test('copia diaria una vez al día, sin .copias ni temporales, y rotación a 14', () => {
  const dir = carpeta();
  let hoy = '2026-11-02';
  const c = crearCopias(dir, { hoy: () => hoy });
  c.antesDeEscribir('diaria', 'tarea.crear');
  assert.ok(existsSync(join(dir, '.copias', '2026-11-02', 'semanas', '2026-W45.md')));
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-02', '.tareas.md.tmp-1-1')));
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-02', '.copias')));
  for (let d = 1; d <= 20; d++) mkdirSync(join(dir, '.copias', `2026-10-${String(d).padStart(2, '0')}`));
  hoy = '2026-11-03';
  c.antesDeEscribir('diaria', 'tarea.crear');
  const copias = readdirSync(join(dir, '.copias')).sort();
  assert.equal(copias.length, MAXIMO_COPIAS);
  assert.equal(copias.at(-1), '2026-11-03');
  // modo «al cerrar semana»: solo al cerrar
  hoy = '2026-11-04';
  c.antesDeEscribir('al cerrar semana', 'tarea.crear');
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-04')));
  c.antesDeEscribir('al cerrar semana', 'semana.cerrar');
  assert.ok(existsSync(join(dir, '.copias', '2026-11-04')));
  rmSync(dir, { recursive: true, force: true });
});

test('modo git: repositorio local y un commit por cierre del día (sin remotos)', async (t) => {
  try { execFileSync('git', ['--version']); } catch { t.skip('git no está instalado'); return; }
  const dir = carpeta();
  const c = crearCopias(dir);
  await c.despuesDeEscribir('git', 'dia.cerrar', { hoy: '2026-11-02' });
  await c.despuesDeEscribir('git', 'dia.cerrar', { hoy: '2026-11-02' }); // nada que commitear: sin error
  const log = execFileSync('git', ['-C', dir, 'log', '--oneline'], { encoding: 'utf8' });
  assert.match(log, /cierre del día 2026-11-02/);
  assert.equal(execFileSync('git', ['-C', dir, 'remote'], { encoding: 'utf8' }).trim(), '');
  rmSync(dir, { recursive: true, force: true });
});

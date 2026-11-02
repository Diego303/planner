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

test('copia diaria una vez al día, sin .copias ni temporales, y rotación a 14', async () => {
  const dir = carpeta();
  let hoy = '2026-11-02';
  const c = crearCopias(dir, { hoy: () => hoy });
  await c.antesDeEscribir('diaria', 'tarea.crear');
  await c.esperar();
  assert.ok(existsSync(join(dir, '.copias', '2026-11-02', 'semanas', '2026-W45.md')));
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-02', '.tareas.md.tmp-1-1')));
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-02', '.copias')));
  for (let d = 1; d <= 20; d++) mkdirSync(join(dir, '.copias', `2026-10-${String(d).padStart(2, '0')}`));
  hoy = '2026-11-03';
  await c.antesDeEscribir('diaria', 'tarea.crear');
  await c.esperar();
  const copias = readdirSync(join(dir, '.copias')).sort();
  assert.equal(copias.length, MAXIMO_COPIAS);
  assert.equal(copias.at(-1), '2026-11-03');
  // modo «al cerrar semana»: solo al cerrar
  hoy = '2026-11-04';
  await c.antesDeEscribir('al cerrar semana', 'tarea.crear');
  await c.esperar();
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-04')));
  await c.antesDeEscribir('al cerrar semana', 'semana.cerrar');
  await c.esperar();
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

test('si la copia de seguridad falla, se guarda igual pero el usuario recibe el aviso', async () => {
  const { copiaEjemplo, apiDirecta } = await import('./ayudas.js');
  const { readFileSync } = await import('node:fs');
  const c = copiaEjemplo();
  try {
    let lleno = true;
    const copias = { antesDeEscribir() { if (lleno) throw Object.assign(new Error(`ENOSPC: no space left, mkdir '${c.dir}/.copias'`), { code: 'ENOSPC' }); }, async despuesDeEscribir() {} };
    const p = apiDirecta(c.dir, { copias });
    const r = await p.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'sin copia' } } });
    assert.match(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), /sin copia/);
    assert.match(r.aviso ?? '', /No se pudo hacer la copia de seguridad de hoy/);
    assert.match(r.aviso, /espacio/);
    assert.ok(!r.aviso.includes(c.dir), 'sin rutas absolutas');
    // y se queda en la banda de avisos hasta que una copia sale bien
    assert.ok(r.estado.meta.avisos.includes(r.aviso));
    assert.ok((await p.estado({ hoy: '2026-11-02' })).meta.avisos.includes(r.aviso));
    lleno = false;
    const r2 = await p.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'con copia' } } });
    assert.equal(r2.aviso, undefined);
    assert.ok(!r2.estado.meta.avisos.some((a) => /copia de seguridad/.test(a)));
  } finally { c.borrar(); }
});

test('una copia que falla a medias no se da por buena: se reintenta y queda completa', async (t) => {
  const fsp = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const dir = carpeta();
  writeFileSync(join(dir, 'zz-ultimo.md'), 'x');
  mkdirSync(join(dir, '.copias', '.2026-10-30.tmp-999-1'), { recursive: true }); // resto de un proceso que murió
  const avisos = [];
  const c = crearCopias(dir, { hoy: () => '2026-11-02', avisar: (m) => avisos.push(m) });
  const original = fsp.copyFile;
  t.mock.method(fsp, 'copyFile', async (a, b, ...r) => {
    if (String(a).endsWith('zz-ultimo.md')) throw Object.assign(new Error('ENOSPC simulado'), { code: 'ENOSPC' });
    return original(a, b, ...r);
  });
  syncBuiltinESMExports();
  await c.antesDeEscribir('diaria', 'tarea.crear');
  await c.esperar();
  assert.ok(!existsSync(join(dir, '.copias', '2026-11-02')), 'no queda una copia a medias con nombre de copia buena');
  assert.equal(c.error()?.code, 'ENOSPC', 'el fallo queda para avisar');
  assert.match(avisos.join(), /ENOSPC/);
  t.mock.restoreAll();
  syncBuiltinESMExports();
  // el siguiente cambio la vuelve a intentar (antesDeEscribir avisa del fallo anterior mientras tanto)
  await c.antesDeEscribir('diaria', 'tarea.crear').catch(() => {});
  await c.esperar();
  assert.ok(existsSync(join(dir, '.copias', '2026-11-02', 'zz-ultimo.md')), 'el reintento la completa');
  assert.ok(existsSync(join(dir, '.copias', '2026-11-02', 'semanas', '2026-W45.md')));
  assert.equal(c.error(), null);
  assert.deepEqual(readdirSync(join(dir, '.copias')), ['2026-11-02'], 'sin restos');
  rmSync(dir, { recursive: true, force: true });
});

test('la copia diaria no bloquea: la operación responde enseguida y la copia guarda lo de antes del cambio', async (t) => {
  const fs = (await import('node:fs')).default;
  const fsp = (await import('node:fs/promises')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { copiaEjemplo, apiDirecta } = await import('./ayudas.js');
  const { readFileSync } = await import('node:fs');
  const c = copiaEjemplo();
  for (let i = 0; i < 300; i++) writeFileSync(join(c.dir, 'diario', `2020-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + Math.floor(i / 12)).padStart(2, '0')}.md`), '- ánimo: 3\n');
  // disco lento: copiar un fichero cuesta 5 ms (con la API síncrona, bloqueando; con la asíncrona, esperando)
  const parar = (ms) => { const fin = Date.now() + ms; while (Date.now() < fin); };
  const cpSync = fs.cpSync, copyFile = fsp.copyFile;
  t.mock.method(fs, 'cpSync', (a, b, o) => cpSync(a, b, { ...o, filter: (x, y) => { if (fs.statSync(x).isFile()) parar(5); return o?.filter ? o.filter(x, y) : true; } }));
  t.mock.method(fsp, 'copyFile', async (...a) => { await new Promise((r) => setTimeout(r, 5)); return copyFile(...a); });
  syncBuiltinESMExports();
  try {
    const copias = crearCopias(c.dir, { hoy: () => '2026-11-02' });
    const p = apiDirecta(c.dir, { copias, hoySimulado: '2026-11-02' });
    const original = readFileSync(join(c.dir, 'tareas.md'), 'utf8');
    const t0 = Date.now();
    await p.op({ op: 'tarea.crear', hoy: '2026-11-02', args: { seccion: 'mas', tarea: { texto: 'durante la copia' } } });
    const ms = Date.now() - t0;
    assert.ok(ms < 600, `la operación esperó a la copia entera (${ms} ms)`);
    await copias.esperar();
    assert.equal(readFileSync(join(c.dir, '.copias', '2026-11-02', 'tareas.md'), 'utf8'), original, 'la copia tiene tareas.md de antes del cambio');
    assert.ok(existsSync(join(c.dir, '.copias', '2026-11-02', 'diario', '2020-01-01.md')));
  } finally { t.mock.restoreAll(); syncBuiltinESMExports(); c.borrar(); }
});

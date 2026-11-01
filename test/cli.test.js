import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { parsearArgs, ErrorArgs } from '../src/cli/args.js';
import { puertoLibre } from '../src/cli/sistema.js';

const BIN = new URL('../bin/planner.js', import.meta.url).pathname;
const ejecutar = promisify(execFile);

test('argumentos de la CLI', () => {
  assert.deepEqual(parsearArgs([]).comando, 'start');
  const o = parsearArgs(['--datos', '/tmp/x', '--puerto=5000', '--silencioso', '--hoy', '2026-12-31']);
  assert.deepEqual([o.datos, o.puerto, o.silencioso, o.hoy], ['/tmp/x', 5000, true, '2026-12-31']);
  assert.equal(parsearArgs(['stop']).comando, 'stop');
  assert.equal(parsearArgs(['--ejemplo']).ejemplo, true);
  assert.throws(() => parsearArgs(['--puerto', 'mucho']), ErrorArgs);
  assert.throws(() => parsearArgs(['--hoy', '31/12']), ErrorArgs);
  assert.throws(() => parsearArgs(['--ejemplo', '--datos', 'x']), ErrorArgs);
  assert.throws(() => parsearArgs(['--rara']), ErrorArgs);
});

test('puerto ocupado → el siguiente libre', async () => {
  const ocupado = createServer();
  await new Promise((ok) => ocupado.listen(0, '127.0.0.1', ok));
  const p = ocupado.address().port;
  const elegido = await puertoLibre(p);
  assert.ok(elegido > p && elegido < p + 20);
  ocupado.close();
});

/** Arranca la CLI y espera a que imprima la URL. */
function arrancarCli(args, env) {
  const hijo = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((ok, mal) => {
    let salida = '';
    const t = setTimeout(() => mal(new Error(`sin respuesta: ${salida}`)), 8000);
    hijo.stdout.on('data', (d) => {
      salida += d;
      const m = /en (http:\/\/localhost:(\d+)\/)/.exec(salida);
      if (m && salida.includes('Ctrl+C')) { clearTimeout(t); ok({ hijo, url: m[1], puerto: +m[2], salida }); }
    });
    hijo.on('exit', (c) => { clearTimeout(t); mal(new Error(`salió con ${c}: ${salida}`)); });
  });
}

test('start, status, segunda instancia y stop (con PID en un directorio temporal)', async () => {
  const home = mkdtempSync(join(tmpdir(), 'planner-home-'));
  const datos = mkdtempSync(join(tmpdir(), 'planner-datos-'));
  const env = { PLANNER_HOME: home };
  const { hijo, puerto } = await arrancarCli(['--datos', datos, '--puerto', '0', '--silencioso'], env);
  try {
    assert.ok(existsSync(join(home, 'pid')));
    assert.equal(JSON.parse(readFileSync(join(home, 'pid'), 'utf8')).puerto, puerto);
    const estado = execFileSync(process.execPath, [BIN, 'status'], { env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.match(estado, new RegExp(`en marcha en http://localhost:${puerto}/`));
    const segunda = execFileSync(process.execPath, [BIN, '--datos', datos, '--silencioso'], { env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.match(segunda, /ya está en marcha/);
    const r = await fetch(`http://127.0.0.1:${puerto}/api/estado?hoy=2026-11-02`);
    assert.equal((await r.json()).meta.datos.vacia, true);
    // asíncrono: el proceso de test tiene que poder recoger al hijo cuando termine
    const { stdout: parar } = await ejecutar(process.execPath, [BIN, 'stop'], { env: { ...process.env, ...env } });
    assert.match(parar, /parado/);
    assert.ok(!existsSync(join(home, 'pid')));
  } finally {
    hijo.kill();
    rmSync(home, { recursive: true, force: true });
    rmSync(datos, { recursive: true, force: true });
  }
});

test('--ejemplo usa una copia temporal y no escribe el fichero PID', async () => {
  const home = mkdtempSync(join(tmpdir(), 'planner-home-'));
  const { hijo, puerto, salida } = await arrancarCli(['--ejemplo', '--puerto', '0', '--silencioso', '--hoy', '2026-11-02'], { PLANNER_HOME: home });
  try {
    const r = await (await fetch(`http://127.0.0.1:${puerto}/api/estado`)).json();
    assert.equal(r.meta.hoySimulado, '2026-11-02');
    assert.match(r.meta.datos.ruta, /planner-ejemplo-/);
    assert.match(salida, /copia temporal de ejemplo/);
    assert.ok(!existsSync(join(home, 'pid')));
  } finally {
    hijo.kill();
    rmSync(home, { recursive: true, force: true });
  }
});

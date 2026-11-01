// Q3 · CLI en situaciones reales: PID huérfano o reutilizado, rutas con espacios y tildes, y abrir el navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = new URL('../bin/planner.js', import.meta.url).pathname;
const ejecutar = promisify(execFile);
const temporal = (p) => mkdtempSync(join(tmpdir(), p));
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function cli(args, env) {
  return ejecutar(process.execPath, [BIN, ...args], { env: { ...process.env, ...env } }).catch((e) => e);
}

test('PID huérfano (proceso muerto) o fichero PID roto: status dice parado y stop lo limpia', async () => {
  const home = temporal('planner-home-');
  try {
    const muerto = spawn(process.execPath, ['-e', '0']);
    await new Promise((r) => muerto.on('exit', r));
    for (const contenido of [JSON.stringify({ pid: muerto.pid, puerto: 4999, datos: '/x' }), '{roto', '']) {
      writeFileSync(join(home, 'pid'), contenido);
      const s = await cli(['status'], { PLANNER_HOME: home });
      assert.match(s.stdout, /planner parado/);
      assert.equal(s.code, 3);
      const p = await cli(['stop'], { PLANNER_HOME: home });
      assert.match(p.stdout, /no está en marcha/);
    }
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('PID reutilizado por otro programa: stop no lo mata', async () => {
  const home = temporal('planner-home-');
  const otro = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)']);
  try {
    await new Promise((r) => otro.on('spawn', r));
    writeFileSync(join(home, 'pid'), JSON.stringify({ pid: otro.pid, puerto: 1, datos: '/x' }));
    const p = await cli(['stop'], { PLANNER_HOME: home });
    assert.ok(vivo(otro.pid), `stop mató a otro proceso (${p.stdout})`);
    assert.match(p.stdout, /no está en marcha/);
    assert.ok(!existsSync(join(home, 'pid')), 'el fichero PID huérfano se borra');
  } finally { otro.kill(); rmSync(home, { recursive: true, force: true }); }
});

test('planner colgado (vivo pero sin responder): stop no lo mata a ciegas y dice cómo pararlo', { skip: process.platform !== 'linux' && 'usa /proc' }, async () => {
  const home = temporal('planner-home-');
  const colgado = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)', 'bin/planner.js']);
  try {
    await new Promise((r) => colgado.on('spawn', r));
    writeFileSync(join(home, 'pid'), JSON.stringify({ pid: colgado.pid, puerto: 1, datos: '/x' }));
    const p = await cli(['stop'], { PLANNER_HOME: home });
    assert.ok(vivo(colgado.pid));
    assert.match(p.stdout, new RegExp(`no responde como planner.*kill ${colgado.pid}`));
    assert.equal(p.code, 1);
    assert.ok(existsSync(join(home, 'pid')));
  } finally { colgado.kill(); rmSync(home, { recursive: true, force: true }); }
});

test('carpeta de datos y PLANNER_HOME con espacios y tildes', async () => {
  const base = temporal('planner rutas ñ-');
  const home = join(base, 'mi carpeta ~ planner');
  const datos = join(base, 'Mis Datos Ñandú (2026)');
  mkdirSync(home);
  const hijo = spawn(process.execPath, [BIN, '--datos', datos, '--puerto', '0', '--silencioso'], { env: { ...process.env, PLANNER_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const puerto = await new Promise((ok, mal) => {
      let salida = '';
      hijo.stdout.on('data', (d) => { salida += d; const m = /localhost:(\d+)\/[\s\S]*Ctrl\+C/.exec(salida); if (m) ok(+m[1]); });
      hijo.on('exit', (c) => mal(new Error(`salió con ${c}: ${salida}`)));
    });
    assert.match(readFileSync(join(home, 'pid'), 'utf8'), /Ñandú/);
    const r = await fetch(`http://127.0.0.1:${puerto}/api/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'datos.inicializar', hoy: '2026-11-02', args: { plantillas: ['trabajo'] } }) });
    assert.equal(r.status, 200);
    assert.ok(existsSync(join(datos, 'ajustes.md')) && existsSync(join(datos, 'plantilla.md')));
    const e = await (await fetch(`http://127.0.0.1:${puerto}/api/estado?hoy=2026-11-02`)).json();
    assert.equal(e.meta.datos.ruta, datos);
    const s = await cli(['status'], { PLANNER_HOME: home });
    assert.ok(s.stdout.includes(datos), s.stdout);
  } finally { hijo.kill(); rmSync(base, { recursive: true, force: true }); }
});

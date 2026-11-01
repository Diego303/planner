// Q3 · La carpeta de datos cambia bajo los pies: solo lectura, borrada, movida, restaurada desde .copias y enlaces simbólicos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, chmodSync, renameSync, rmSync, cpSync, symlinkSync, lstatSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { crearCopias } from '../src/server/copias.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

const HOY = '2026-11-02';
const limpiar = [];
after(() => limpiar.forEach((f) => f()));
const nueva = () => { const c = copiaEjemplo(); limpiar.push(c.borrar); return c; };
const CREAR = (texto) => ({ op: 'tarea.crear', hoy: HOY, args: { seccion: 'mas', tarea: { texto } } });
const comoRoot = process.getuid?.() === 0;

test('carpeta de solo lectura: se lee todo; al guardar, error claro y nada cambia', { skip: comoRoot && 'como root no hay permisos' }, async () => {
  const c = nueva();
  const antes = readFileSync(join(c.dir, 'tareas.md'), 'utf8');
  const dirs = ['', 'semanas', 'diario', 'archivo'].map((d) => join(c.dir, d)).filter(existsSync);
  for (const d of dirs) chmodSync(d, 0o555);
  try {
    const p = apiDirecta(c.dir, { hoySimulado: HOY });
    const e = await p.estado({ hoy: HOY });
    assert.ok(e.ficheros['tareas.md']);
    await assert.rejects(p.op(CREAR('no cabe')), (err) => {
      assert.equal(err.estado, 500);
      assert.match(err.message, /no hay permiso de escritura\. No se ha guardado nada/);
      assert.ok(!err.message.includes(c.dir));
      return true;
    });
    assert.equal(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), antes);
  } finally { for (const d of dirs) chmodSync(d, 0o755); }
});

test('carpeta borrada o movida con el planner en marcha: lo dice y no la vuelve a crear sola', async () => {
  for (const como of ['movida', 'borrada']) {
    const c = nueva();
    const p = apiDirecta(c.dir, { hoySimulado: HOY });
    await p.op(CREAR('antes'));
    if (como === 'movida') { renameSync(c.dir, `${c.dir}-movida`); limpiar.push(() => rmSync(`${c.dir}-movida`, { recursive: true, force: true })); } else rmSync(c.dir, { recursive: true });
    const e = await p.estado({ hoy: HOY });
    assert.equal(e.meta.datos.existe, false, como);
    await assert.rejects(p.op(CREAR('después')), (err) => err.estado === 422 && /no existe/.test(err.message), como);
    assert.ok(!existsSync(c.dir), `${como}: no se crea una carpeta vacía en su lugar`);
  }
});

test('restaurar una copia de .copias/ deja los datos como estaban ese día', async () => {
  const c = nueva();
  const copias = crearCopias(c.dir, { hoy: () => HOY });
  const p = apiDirecta(c.dir, { copias, hoySimulado: HOY });
  const original = readFileSync(join(c.dir, 'tareas.md'), 'utf8');
  await p.op(CREAR('después de la copia'));
  await copias.esperar(); // la copia va en segundo plano
  assert.notEqual(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), original);
  // restaurar a mano, como explica instrucciones.md: copiar la carpeta del día encima
  const copia = join(c.dir, '.copias', HOY);
  assert.equal(readFileSync(join(copia, 'tareas.md'), 'utf8'), original);
  cpSync(copia, c.dir, { recursive: true });
  const e = await apiDirecta(c.dir, { hoySimulado: HOY }).estado({ hoy: HOY });
  assert.ok(!JSON.stringify(e.ficheros['tareas.md']).includes('después de la copia'));
  assert.equal(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), original);
});

test('enlaces simbólicos: se leen; al guardar se sustituye el enlace y el fichero de fuera no se toca (D12)', async () => {
  const c = nueva();
  const fuera = mkdtempSync(join(tmpdir(), 'planner-fuera-'));
  limpiar.push(() => rmSync(fuera, { recursive: true, force: true }));
  const destino = join(fuera, 'tareas-reales.md');
  writeFileSync(destino, readFileSync(join(c.dir, 'tareas.md'), 'utf8'));
  rmSync(join(c.dir, 'tareas.md'));
  symlinkSync(destino, join(c.dir, 'tareas.md'));
  const p = apiDirecta(c.dir, { hoySimulado: HOY });
  const e = await p.estado({ hoy: HOY });
  assert.ok(JSON.stringify(e.ficheros['tareas.md']).includes('Revisar PR'), 'se lee a través del enlace');
  const antes = readFileSync(destino, 'utf8');
  await p.op(CREAR('nueva'));
  assert.equal(readFileSync(destino, 'utf8'), antes, 'el fichero de fuera no se escribe');
  assert.ok(!lstatSync(join(c.dir, 'tareas.md')).isSymbolicLink(), 'el enlace pasa a ser un fichero normal');
  assert.match(readFileSync(join(c.dir, 'tareas.md'), 'utf8'), /nueva/);
  assert.deepEqual(readdirSync(fuera), ['tareas-reales.md'], 'nada escrito fuera de la carpeta');
});

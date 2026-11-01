// Q8 · pnpm qa:validar: encuentra lo que debe y nunca escribe en la carpeta que revisa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { copiaEjemplo } from './ayudas.js';

const SCRIPT = new URL('../scripts/qa-validar.js', import.meta.url).pathname;
const ejecutar = promisify(execFile);

function huella(dir, rel = '') {
  const h = createHash('sha1');
  for (const n of readdirSync(join(dir, rel)).sort()) {
    const r = rel ? `${rel}/${n}` : n;
    const s = statSync(join(dir, r));
    if (s.isDirectory()) h.update(`${r}/${huella(dir, r)}`);
    else h.update(`${r}:${s.mtimeMs}:${readFileSync(join(dir, r)).toString('base64')}`);
  }
  return h.digest('hex');
}

test('qa:validar encuentra líneas rotas, solapes, huérfanos y tipos, y no toca la carpeta', async () => {
  const c = copiaEjemplo();
  try {
    const W45 = join(c.dir, 'semanas', '2026-W45.md');
    writeFileSync(W45, readFileSync(W45, 'utf8').replace('## Bloques\n', '## Bloques\n- Z 10:00-11:00 | personal | día imposible\n- S 25:00-26:00 | personal | hora imposible\n- S 16:00-17:00 | estudio | Kubernetes · lab\n- S 16:30-17:30 | lectura | libro\n'));
    writeFileSync(join(c.dir, 'tareas.md'), `${readFileSync(join(c.dir, 'tareas.md'), 'utf8')}- [ ] pagar | personal | fecha: 2026-02-30\n`);
    writeFileSync(join(c.dir, 'tipos.md'), `${readFileSync(join(c.dir, 'tipos.md'), 'utf8')}- jardín | #55722B\n`);
    writeFileSync(join(c.dir, 'semanas', '2026-W46.md'), Buffer.from([0x23, 0x00, 0x01]));
    const antes = huella(c.dir);
    const r = await ejecutar(process.execPath, [SCRIPT, '--', '--datos', c.dir]).catch((e) => e);
    const out = r.stdout;
    assert.equal(r.code, 1, out);
    assert.match(out, /✓ Ida y vuelta exacta/);
    assert.match(out, /2026-W45\.md:\d+ · bloque con un día no válido .*«- Z 10:00-11:00/);
    assert.match(out, /2026-W45\.md:\d+ · bloque con una hora no válida/);
    assert.match(out, /tareas\.md:\d+ · fecha imposible .*2026-02-30/);
    assert.match(out, /semanas\/2026-W46\.md: parece binario/);
    assert.match(out, /2026-W45\.md · S: .*«Kubernetes · lab» 16:00–17:00/);
    assert.match(out, /bloque «Kubernetes · lab»: «Kubernetes» no está en estudio\.md ni en proyectos\.md/);
    assert.match(out, /## Tipos sin uso[^\n]*\n- jardín/);
    assert.match(out, /lectura · semanas\/2026-W45\.md · libro/);
    assert.match(out, /✓ La carpeta original no ha cambiado/);
    assert.equal(huella(c.dir), antes, 'ni un byte ni una fecha cambian en la carpeta revisada');
  } finally { c.borrar(); }
});

test('qa:validar sin --datos o con una carpeta que no existe: uso y salida 64', async () => {
  for (const args of [[], ['--datos', '/no/existe/planner']]) {
    const r = await ejecutar(process.execPath, [SCRIPT, ...args]).catch((e) => e);
    assert.equal(r.code, 64);
  }
});

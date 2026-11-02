// Aplicar la plantilla a semanas que ya existen: con el botón de la semana y al añadir o quitar en la plantilla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { parsear } from '../src/core/formato/index.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

const HOY = '2026-11-04'; // miércoles de la semana 45
const leer = (dir, r) => readFileSync(join(dir, r), 'utf8');
const bloques = (dir, id) => m.bloquesDe(parsear(`semanas/${id}.md`, leer(dir, `semanas/${id}.md`)));
const op = (p, o, args) => p.op({ op: o, hoy: HOY, args });

async function preparar() {
  const c = copiaEjemplo();
  const p = apiDirecta(c.dir, { hoySimulado: HOY });
  await op(p, 'semana.crear', { semana: '2026-W46' }); // una semana futura ya creada (con la plantilla de antes)
  return { ...c, p };
}

test('«Aplicar plantilla» añade lo que falta (en la semana actual, desde hoy), aunque se solape, y sin duplicar', async () => {
  const { dir, p, borrar } = await preparar();
  try {
    let r = await op(p, 'semana.aplicarPlantilla', { semana: '2026-W45' });
    assert.deepEqual(r.resultado, { n: 0, solapes: 0 }, 'ya tiene todo');
    // algo nuevo en la plantilla, sin aplicar: las semanas ya creadas no cambian
    const W45 = leer(dir, 'semanas/2026-W45.md');
    await op(p, 'plantilla.crear', { dias: [1, 3], inicio: 450, fin: 510, tipo: 'estudio', titulo: 'Inglés' });
    await op(p, 'plantilla.crear', { dias: [0, 2, 4], inicio: 1020, fin: 1080, tipo: 'personal', titulo: 'Llamada' }); // 17:00, dentro del trabajo
    assert.equal(leer(dir, 'semanas/2026-W45.md'), W45);
    r = await op(p, 'semana.aplicarPlantilla', { semana: '2026-W45' });
    // martes (pasado) no; jueves sí · lunes (pasado) no; miércoles y viernes sí, y se solapan con el trabajo
    assert.deepEqual(r.resultado, { n: 3, solapes: 2 });
    const b45 = bloques(dir, '2026-W45');
    assert.deepEqual(b45.filter((b) => b.titulo === 'Inglés').map((b) => b.dia), [3]);
    assert.deepEqual(b45.filter((b) => b.titulo === 'Llamada').map((b) => b.dia).sort(), [2, 4]);
    assert.ok(b45.filter((b) => ['Inglés', 'Llamada'].includes(b.titulo)).every((b) => b.plantilla));
    r = await op(p, 'semana.aplicarPlantilla', { semana: '2026-W45' });
    assert.deepEqual(r.resultado, { n: 0, solapes: 0 }, 'dos veces no duplica');
    // en una futura, todos los días; y se puede deshacer
    const W46 = leer(dir, 'semanas/2026-W46.md');
    r = await op(p, 'semana.aplicarPlantilla', { semana: '2026-W46' });
    assert.deepEqual(r.resultado, { n: 5, solapes: 3 });
    await p.deshacer({ inversaId: r.inversaId, hoy: HOY });
    assert.equal(leer(dir, 'semanas/2026-W46.md'), W46);
    // a una pasada, no
    await assert.rejects(op(p, 'semana.aplicarPlantilla', { semana: '2026-W44' }), /pasada/);
  } finally { borrar(); }
});

test('añadir a la plantilla con «aplicar» lo pone también en las semanas ya creadas; quitar lo quita donde sigue tal cual', async () => {
  const { dir, p, borrar } = await preparar();
  try {
    const W44 = leer(dir, 'semanas/2026-W44.md'), W43 = leer(dir, 'semanas/2026-W43.md');
    let r = await op(p, 'plantilla.crear', { dias: [0, 1, 2, 3, 4], inicio: 1260, fin: 1380, tipo: 'entreno', titulo: 'Entreno', aplicar: true });
    // semana 45 desde el miércoles (X, J, V) y la 46 entera (5)
    assert.deepEqual(r.resultado, { semanas: 2, n: 8, solapes: 1 }); // el jueves de la 45 choca con «Deploy del pipeline» (21:30)
    assert.equal(bloques(dir, '2026-W45').filter((b) => b.titulo === 'Entreno').length, 3);
    assert.equal(bloques(dir, '2026-W46').filter((b) => b.titulo === 'Entreno').length, 5);
    assert.equal(leer(dir, 'semanas/2026-W44.md'), W44, 'las pasadas no se tocan');
    assert.equal(leer(dir, 'semanas/2026-W43.md'), W43, 'ni las cerradas');
    // en la 46: uno movido y uno hecho se quedan al quitarlo de la plantilla
    const b46 = bloques(dir, '2026-W46').filter((b) => b.titulo === 'Entreno');
    await op(p, 'bloque.editar', { semana: '2026-W46', id: b46[0].id, huella: m.huellaDe(b46[0]), cambios: { inicio: 1200, fin: 1320 } });
    const despues = bloques(dir, '2026-W46').filter((b) => b.titulo === 'Entreno');
    const viernes = despues.find((b) => b.dia === 4);
    await op(p, 'bloque.hecho', { semana: '2026-W46', id: viernes.id, huella: m.huellaDe(viernes), delta: 0 });
    const entrada = m.plantillaDe(parsear('plantilla.md', leer(dir, 'plantilla.md'))).find((e) => e.titulo === 'Entreno');
    r = await op(p, 'plantilla.eliminar', { id: entrada.id, huella: m.huellaDe(entrada), aplicar: true });
    assert.deepEqual(r.resultado, { semanas: 2, n: 6, solapes: 0 });
    assert.deepEqual(bloques(dir, '2026-W45').filter((b) => b.titulo === 'Entreno'), []);
    assert.deepEqual(bloques(dir, '2026-W46').filter((b) => b.titulo === 'Entreno').map((b) => [b.dia, b.inicio, b.hecho]).sort(), [[0, 1200, null], [4, 1260, 0]]);
    // y sin «aplicar», como antes: solo la plantilla
    r = await op(p, 'plantilla.crear', { dias: [5], inicio: 600, fin: 660, tipo: 'personal', titulo: 'Mercado' });
    assert.equal(r.resultado, null);
    assert.ok(!bloques(dir, '2026-W46').some((b) => b.titulo === 'Mercado'));
  } finally { borrar(); }
});

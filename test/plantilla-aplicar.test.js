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

test('editar una entrada de la plantilla cambia las semanas ya creadas donde sigue tal cual; lo movido se respeta', async () => {
  const { dir, p, borrar } = await preparar();
  try {
    await op(p, 'plantilla.crear', { dias: [0, 1, 2, 3, 4], inicio: 1260, fin: 1380, tipo: 'entreno', titulo: 'Entreno', aplicar: true });
    // en la 46 el lunes lo moviste a las 19:00
    const lunes = bloques(dir, '2026-W46').find((b) => b.titulo === 'Entreno' && b.dia === 0);
    await op(p, 'bloque.editar', { semana: '2026-W46', id: lunes.id, huella: m.huellaDe(lunes), cambios: { inicio: 1140, fin: 1260 } });
    const W44 = leer(dir, 'semanas/2026-W44.md');
    const entrada = () => m.plantillaDe(parsear('plantilla.md', leer(dir, 'plantilla.md'))).find((e) => e.titulo === 'Entreno');
    // de L–V 21–23 a L, X y V de 20 a 22
    let e = entrada();
    const antes45 = leer(dir, 'semanas/2026-W45.md'), antes46 = leer(dir, 'semanas/2026-W46.md');
    let r = await op(p, 'plantilla.editar', { id: e.id, huella: m.huellaDe(e), cambios: { dias: [0, 2, 4], inicio: 1200, fin: 1320 }, aplicar: true });
    assert.match(leer(dir, 'plantilla.md'), /^- L,X,V 20:00-22:00 \| entreno \| Entreno$/m);
    // 45 (desde el miércoles): X y V cambian, J se va · 46: X y V cambian, M y J se van, el lunes movido se queda
    assert.deepEqual(r.resultado, { semanas: 2, n: 7, solapes: 0 });
    const en = (id) => bloques(dir, id).filter((b) => b.titulo === 'Entreno').map((b) => `${b.dia} ${b.inicio}-${b.fin}`).sort();
    assert.deepEqual(en('2026-W45'), ['2 1200-1320', '4 1200-1320']);
    assert.deepEqual(en('2026-W46'), ['0 1140-1260', '2 1200-1320', '4 1200-1320']);
    assert.equal(leer(dir, 'semanas/2026-W44.md'), W44);
    // deshacer lo devuelve todo
    await p.deshacer({ inversaId: r.inversaId, hoy: HOY });
    assert.equal(leer(dir, 'semanas/2026-W45.md'), antes45);
    assert.equal(leer(dir, 'semanas/2026-W46.md'), antes46);
    // otra vez, ahora a las 19:00: choca con el gimnasio (18:00–19:30) los miércoles y viernes
    e = entrada();
    r = await op(p, 'plantilla.editar', { id: e.id, huella: m.huellaDe(e), cambios: { dias: [0, 2, 4], inicio: 1140, fin: 1260, titulo: 'Gimnasio 2' }, aplicar: true });
    assert.equal(r.resultado.solapes, 4);
    assert.ok(bloques(dir, '2026-W46').some((b) => b.titulo === 'Gimnasio 2' && b.dia === 2 && b.plantilla));
    // sin «aplicar», solo la plantilla
    e = entrada() ?? m.plantillaDe(parsear('plantilla.md', leer(dir, 'plantilla.md'))).find((x) => x.titulo === 'Gimnasio 2');
    const W46 = leer(dir, 'semanas/2026-W46.md');
    r = await op(p, 'plantilla.editar', { id: e.id, huella: m.huellaDe(e), cambios: { titulo: 'Gimnasio' } });
    assert.equal(r.resultado, null);
    assert.equal(leer(dir, 'semanas/2026-W46.md'), W46);
    // con la entrada cambiada por fuera (huella vieja), error claro
    await assert.rejects(op(p, 'plantilla.editar', { id: e.id, huella: m.huellaDe(e), cambios: { titulo: 'x' } }), /cambió mientras lo editabas/);
    await assert.rejects(op(p, 'plantilla.editar', { id: e.id, cambios: { dias: [] } }), /al menos un día/);
  } finally { borrar(); }
});

test('«tal cual» incluye el primer paso: un bloque al que le pusiste uno no se cambia ni se quita; el subtipo se va si deja de ser estudio', async () => {
  const { dir, p, borrar } = await preparar();
  try {
    await op(p, 'plantilla.crear', { dias: [0, 2], inicio: 1260, fin: 1320, tipo: 'estudio', subtipo: 'aprender', titulo: 'Inglés', aplicar: true });
    const x = bloques(dir, '2026-W46').find((b) => b.titulo === 'Inglés' && b.dia === 2);
    await op(p, 'bloque.editar', { semana: '2026-W46', id: x.id, huella: m.huellaDe(x), cambios: { paso: 'repasar la unidad 4' } });
    const e = m.plantillaDe(parsear('plantilla.md', leer(dir, 'plantilla.md'))).find((y) => y.titulo === 'Inglés');
    const r = await op(p, 'plantilla.editar', { id: e.id, huella: m.huellaDe(e), cambios: { inicio: 1200, fin: 1260, tipo: 'personal' }, aplicar: true });
    assert.match(leer(dir, 'plantilla.md'), /^- L,X 20:00-21:00 \| personal \| Inglés$/m, 'sin «tipo: aprender» al dejar de ser estudio');
    const ingles = bloques(dir, '2026-W46').filter((b) => b.titulo === 'Inglés').map((b) => [b.dia, b.inicio, b.tipo, b.paso]).sort();
    assert.deepEqual(ingles, [[0, 1200, 'personal', null], [2, 1260, 'estudio', 'repasar la unidad 4']]);
    assert.equal(r.resultado.n, 2); // lunes de la 46 y miércoles de la 45 (el de la 46 con paso se queda)
    const e2 = m.plantillaDe(parsear('plantilla.md', leer(dir, 'plantilla.md'))).find((y) => y.titulo === 'Inglés');
    await op(p, 'plantilla.eliminar', { id: e2.id, huella: m.huellaDe(e2), aplicar: true });
    assert.deepEqual(bloques(dir, '2026-W46').filter((b) => b.titulo === 'Inglés').map((b) => b.paso), ['repasar la unidad 4']);
  } finally { borrar(); }
});

// Q3 · La API ante peticiones hostiles: argumentos de cualquier forma nunca dan un 500 ni tocan los ficheros a medias.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';
import { ErrorHttp } from '../src/server/api.js';
import { opsPublicas } from '../src/core/ops.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';
import { paraCada, TROZOS } from './azar.js';

const OPS_PUBLICAS = opsPublicas();
const CLAVES = ('id semana huella cambios nombre seccion titulo clave inicio siguiente hecha dias delta tipo texto nota fin color valor horas dia '
  + 'destino animo tarea sugerido subtipo paso total si rel proyectos prioridad plantillas plantilla manana linea lecciones horasSemana extra '
  + 'examen entonces dur decisiones comentario bloque avanzado aplazar fecha desde a aplicar').split(' ');
const HOY = '2026-11-02';

const limpiar = [];
after(() => limpiar.forEach((f) => f()));

function valor(azar, prof = 0) {
  const gen = [() => null, () => azar.entero(-5, 2000), () => azar.sig() * 1e6, () => azar.elegir(TROZOS), () => '', () => azar.bool(),
    () => azar.elegir(['2026-W45', '2026-W44', '2026-W99', HOY, 'x', ' 2026-W45']), () => azar.elegir([0, 1, 2, 3, 6, 7, -1, 1e308, -0]),
    () => azar.elegir(['__proto__', 'constructor', 'toString', 'hasOwnProperty']),
    () => azar.lista(0, 3, () => valor(azar, prof + 1)),
    () => Object.fromEntries(azar.lista(0, 4, () => [azar.elegir(CLAVES), valor(azar, prof + 1)])),
    () => ({ dia: 1, inicio: 600, fin: 660, tipo: azar.elegir(['estudio', 'trabajo', 'x']), titulo: azar.elegir(TROZOS) }),
    () => [{ id: azar.entero(0, 40), huella: azar.elegir([null, 'x']) }, null]];
  return gen[azar.entero(0, prof > 2 ? 8 : gen.length - 1)]();
}

function ficheros(dir) {
  const out = {};
  for (const d of ['', 'semanas', 'diario', 'archivo']) {
    if (!existsSync(join(dir, d))) continue;
    for (const n of readdirSync(join(dir, d))) {
      const ruta = d ? `${d}/${n}` : n;
      if (tipoDeRuta(ruta)) out[ruta] = readFileSync(join(dir, d, n), 'utf8');
    }
  }
  return out;
}

test('el fuzzer cubre todas las operaciones públicas', () => {
  assert.ok(OPS_PUBLICAS.length >= 34 && OPS_PUBLICAS.includes('las3.crear') && !OPS_PUBLICAS.includes('lote'), OPS_PUBLICAS.join(' '));
});

test('2.000 operaciones con argumentos hostiles: solo errores claros (4xx), nunca un 500', async () => {
  const casos = [];
  paraCada(2000, (azar) => {
    const args = azar.bool(0.05) ? valor(azar) : Object.fromEntries(azar.lista(0, 5, () => [azar.elegir(CLAVES), valor(azar)]));
    casos.push({ op: azar.elegir(OPS_PUBLICAS), args, hoy: HOY, versiones: azar.bool(0.1) ? valor(azar) : undefined, semana: azar.bool(0.2) ? valor(azar) : '2026-W45' });
  });
  for (let ronda = 0; ronda < casos.length / 250; ronda++) {
    const c = copiaEjemplo();
    limpiar.push(c.borrar);
    const p = apiDirecta(c.dir, { hoySimulado: HOY });
    for (const cuerpo of casos.slice(ronda * 250, (ronda + 1) * 250)) {
      try { await p.op(cuerpo); } catch (e) {
        assert.ok(e instanceof ErrorHttp && e.estado < 500, `${cuerpo.op} → ${e.constructor.name}: ${e.message}\n  ${JSON.stringify(cuerpo).slice(0, 400)}`);
      }
    }
    for (const [ruta, texto] of Object.entries(ficheros(c.dir))) assert.equal(serializar(parsear(ruta, texto)), texto, ruta);
    assert.ok(await p.estado({ hoy: HOY }));
  }
});

test('las primitivas internas (líneas sueltas, ficheros, lotes) no se aceptan desde fuera', async () => {
  const c = copiaEjemplo();
  limpiar.push(c.borrar);
  const p = apiDirecta(c.dir, { hoySimulado: HOY });
  const antes = ficheros(c.dir);
  const peticiones = [
    { op: 'fichero.borrar', args: { ruta: 'tareas.md' } }, // una petición borraría todas las tareas
    { op: 'lineas.insertar', args: { ruta: 'tareas.md', indice: 0, lineas: [{ t: '?', _raw: 'a\n## Hoy\n- [ ] inyectada' }] } },
    { op: 'lineas.quitar', args: { ruta: 'tareas.md', indice: 0, n: 5 } },
    { op: 'linea.cambiar', args: { ruta: 'ajustes.md', indice: 1, cambios: { _raw: 'x' } } },
    { op: 'fichero.crear', args: { ruta: 'semanas/2030-W01.md', doc: { tipo: 'semana', lineas: [] } } },
    { op: 'lote', args: { ops: [{ op: 'fichero.borrar', args: { ruta: 'estudio.md' } }] } },
  ];
  for (const cuerpo of peticiones) {
    await assert.rejects(p.op({ ...cuerpo, hoy: HOY }), (e) => e.estado === 422 && /desconocida/.test(e.message), cuerpo.op);
  }
  assert.deepEqual(ficheros(c.dir), antes);
  // deshacer sí las usa por dentro
  const r = await p.op({ op: 'tarea.crear', hoy: HOY, args: { seccion: 'mas', tarea: { texto: 'nueva' } } });
  await p.deshacer({ inversaId: r.inversaId, hoy: HOY });
  assert.deepEqual(ficheros(c.dir), antes);
});

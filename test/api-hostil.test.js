// Q3 · La API ante peticiones hostiles: argumentos de cualquier forma nunca dan un 500 ni tocan los ficheros a medias.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';
import { ErrorHttp } from '../src/server/api.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';
import { paraCada, TROZOS } from './azar.js';

const OPS_PUBLICAS = ['semana.crear', 'bloque.crear', 'bloque.editar', 'bloque.mover', 'bloque.eliminar', 'semana.proponer', 'bloque.hecho',
  'bloque.desmarcar', 'bloque.aMedias', 'semana.cerrar', 'semana.reabrir', 'tipo.crear', 'tipo.color', 'tipo.banderas', 'tipo.eliminar',
  'plantilla.crear', 'plantilla.eliminar', 'ajustes.cambiar', 'tarea.crear', 'tarea.editar', 'tarea.marcar', 'tarea.mover', 'tarea.eliminar',
  'dia.cerrar', 'estudio.crear', 'estudio.cambiar', 'estudio.eliminar', 'proyecto.crear', 'proyecto.cambiar', 'proyecto.eliminar', 'datos.inicializar'];
const CLAVES = ('id semana huella cambios nombre seccion titulo clave inicio siguiente hecha dias delta tipo texto nota fin color valor horas dia '
  + 'destino animo tarea sugerido subtipo paso total si rel proyectos prioridad plantillas plantilla manana linea lecciones horasSemana extra '
  + 'examen entonces dur decisiones comentario bloque avanzado aplazar fecha').split(' ');
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

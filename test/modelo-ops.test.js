// Q2 · Basada en modelo: ≥ 1.000 secuencias aleatorias de operaciones válidas e inválidas sobre ejemplo/.
// Tras cada operación: la inversa deja los ficheros byte a byte igual; lo escrito se vuelve a leer igual;
// ninguna operación crea líneas «no reconocidas»; las inválidas dan ErrorOp con mensaje y no cambian nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, ErrorOp, FaltaFichero } from '../src/core/ops.js';
import { parsear, serializar } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { factores } from '../src/core/factor.js';
import { PAL } from '../src/core/modelo.js';
import { mundoEjemplo, sinInternos } from './ayudas.js';
import { paraCada, textoCrudo, textoModelo, fecha } from './azar.js';

const SEMANAS = ['2026-W30', '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W53', '2027-W01'];
const HOYS = ['2026-11-02', '2026-11-05', '2026-11-08', '2026-12-31', '2027-01-04'];
const AJUSTES = ['capacidad', 'tareas_hoy', 'horas', 'cierre', 'inicio_semana', 'foco_max', 'mejores_horas', 'margen', 'copias', 'puerto', 'tema', 'tema_temporada', 'decoracion', 'inventado'];

const texto = (azar) => (azar.bool(0.7) ? textoModelo(azar) : textoCrudo(azar));
const quizas = (azar, fn, p = 0.5) => (azar.bool(p) ? fn() : undefined);
const docSemana = (mu, id) => mu.ficheros[`semanas/${id}.md`];

function idDe(azar, lista) {
  if (!lista.length || azar.bool(0.08)) return azar.entero(-2, 120); // a veces un id que no existe
  return azar.elegir(lista).id;
}

function nombreTipo(azar, mu) {
  const tipos = m.tiposDe(mu.ficheros['tipos.md']).map((t) => t.nombre);
  return azar.bool(0.8) ? azar.elegir(tipos) : textoCrudo(azar, 2);
}

const camposBloque = (azar, mu) => {
  const inicio = azar.entero(0, 47) * 30 + azar.elegir([0, 0, 0, 7]);
  return {
    dia: azar.bool(0.95) ? azar.entero(0, 6) : azar.elegir([7, -1, 2.5]), inicio,
    fin: azar.bool(0.9) ? Math.min(1440, inicio + azar.entero(1, 8) * 30) : inicio, tipo: nombreTipo(azar, mu), titulo: texto(azar),
    subtipo: quizas(azar, () => azar.elegir(['aprender', 'repasar', 'simulacro', null, 'otro'])), paso: quizas(azar, () => texto(azar), 0.3),
  };
};

/** Una operación aleatoria (válida o no) para el mundo actual. */
function generarOp(azar, mu) {
  const semana = azar.elegir(SEMANAS);
  const doc = docSemana(mu, semana);
  const bloques = m.bloquesDe(doc), las3 = m.las3De(doc);
  const tareas = m.entidades(mu.ficheros['tareas.md'], 'tarea');
  const temas = m.temasEstudio(mu.ficheros['estudio.md']), pros = m.proyectosDe(mu.ficheros['proyectos.md']);
  const conHuella = (lista, id) => (azar.bool(0.7) ? m.huellaDe(lista.find((x) => x.id === id) ?? null) : undefined);
  const generadores = [
    () => ({ op: 'bloque.crear', args: { semana, bloque: camposBloque(azar, mu) } }),
    () => { const id = idDe(azar, bloques); const c = camposBloque(azar, mu); return { op: 'bloque.editar', args: { semana, id, huella: conHuella(bloques, id), cambios: Object.fromEntries(azar.algunos(Object.entries({ ...c, sugerido: false, plantilla: azar.bool() }), 0.4)) } }; },
    () => { const id = idDe(azar, bloques); return { op: 'bloque.mover', args: { semana, id, destino: azar.elegir(SEMANAS), cambios: { dia: azar.entero(0, 6) } } }; },
    () => ({ op: 'bloque.eliminar', args: { semana, id: idDe(azar, bloques) } }),
    () => ({ op: 'bloque.hecho', args: { semana, id: idDe(azar, bloques), delta: azar.elegir([-30, 0, 30, 60, 7, -999, 300]), nota: quizas(azar, () => azar.elegir([71, 0, 100, 101, -1, '80'])) } }),
    () => ({ op: 'bloque.desmarcar', args: { semana, id: idDe(azar, bloques) } }),
    () => ({ op: 'bloque.aMedias', args: { semana, id: idDe(azar, bloques), dejado: texto(azar) } }),
    () => ({ op: 'las3.crear', args: { semana, texto: texto(azar), rel: quizas(azar, () => texto(azar)), si: quizas(azar, () => texto(azar)), entonces: quizas(azar, () => texto(azar)) } }),
    () => ({ op: 'las3.editar', args: { semana, id: idDe(azar, las3), cambios: azar.elegir([{ hecha: azar.bool() }, { texto: texto(azar) }, { rel: null }, { si: texto(azar), entonces: texto(azar) }]) } }),
    () => ({ op: 'las3.eliminar', args: { semana, id: idDe(azar, las3) } }),
    () => ({ op: 'semana.crear', args: { semana } }),
    () => ({ op: 'semana.reabrir', args: { semana } }),
    () => ({ op: 'semana.proponer', args: { semana } }),
    () => ({ op: 'semana.cerrar', args: { semana, lecciones: { funciono: quizas(azar, () => texto(azar)), cambio: quizas(azar, () => texto(azar)) }, decisiones: [], siguiente: { las3: azar.lista(0, 3, () => ({ texto: texto(azar), si: texto(azar) })), horas: Object.fromEntries(temas.map((t) => [t.nombre, azar.entero(0, 20)])) } } }),
    () => ({ op: 'tarea.crear', args: { seccion: azar.elegir(['hoy', 'mas', 'algun', 'otra']), tarea: { texto: texto(azar), tipo: quizas(azar, () => nombreTipo(azar, mu)), prioridad: azar.bool(), fecha: quizas(azar, () => (azar.bool(0.9) ? fecha(azar) : '2026-02-30')), dur: quizas(azar, () => azar.elegir([30, 90, 0, 5000])) } } }),
    () => { const id = idDe(azar, tareas); return { op: 'tarea.editar', args: { id, huella: conHuella(tareas, id), cambios: azar.elegir([{ texto: texto(azar) }, { tipo: nombreTipo(azar, mu) }, { fecha: null }, { prioridad: true, dur: 45 }]) } }; },
    () => ({ op: 'tarea.marcar', args: { id: idDe(azar, tareas), hecha: azar.bool() } }),
    () => ({ op: 'tarea.mover', args: { id: idDe(azar, tareas), seccion: azar.elegir(['hoy', 'mas', 'algun']) } }),
    () => ({ op: 'tarea.eliminar', args: { id: idDe(azar, tareas) } }),
    () => ({ op: 'dia.cerrar', args: { animo: azar.elegir([1, 3, 5, null, 6]), linea: texto(azar), manana: texto(azar), avanzado: azar.lista(0, 3, () => texto(azar)), aplazar: azar.algunos(tareas, 0.2).map((t) => ({ id: t.id, huella: m.huellaDe(t) })) } }),
    () => ({ op: 'estudio.crear', args: { nombre: texto(azar), horas_semana: azar.elegir([1, 4.5, 0, -1]), examen: quizas(azar, () => fecha(azar)) } }),
    () => ({ op: 'estudio.cambiar', args: { id: idDe(azar, temas), clave: azar.elegir(['horas_semana', 'examen', 'total', 'dejado', 'simulacros', 'raro']), valor: azar.elegir([5, '2026-12-12', null, texto(azar), [{ nota: 70, fecha: '2026-11-02' }], -3]) } }),
    () => ({ op: 'estudio.eliminar', args: { id: idDe(azar, temas) } }),
    () => ({ op: 'proyecto.crear', args: { nombre: texto(azar), siguiente: texto(azar) } }),
    () => ({ op: 'proyecto.cambiar', args: { id: idDe(azar, pros), clave: azar.elegir(['siguiente', 'estado', 'dejado', 'actualizado']), valor: azar.elegir([texto(azar), 'pausado', 'activo', null, '2026-11-01', 'quizá']) } }),
    () => ({ op: 'proyecto.eliminar', args: { id: idDe(azar, pros) } }),
    () => ({ op: 'plantilla.crear', args: { dias: azar.lista(0, 3, () => azar.entero(0, 7)), ...camposBloque(azar, mu) } }),
    () => ({ op: 'plantilla.eliminar', args: { id: idDe(azar, m.plantillaDe(mu.ficheros['plantilla.md'])) } }),
    () => ({ op: 'tipo.crear', args: { nombre: textoCrudo(azar, 2), color: azar.elegir([...PAL, 'rojo', '#12345']) } }),
    () => ({ op: 'tipo.color', args: { nombre: nombreTipo(azar, mu), color: azar.elegir(PAL) } }),
    () => ({ op: 'tipo.banderas', args: { nombre: nombreTipo(azar, mu), trabajo: azar.bool(), estudio: azar.bool() } }),
    () => ({ op: 'tipo.eliminar', args: { nombre: nombreTipo(azar, mu) } }),
    () => ({ op: 'ajustes.cambiar', args: { clave: azar.elegir(AJUSTES), valor: azar.elegir([70, 101, 3, 'papel', 'domingo', { desde: 8, hasta: 22 }, { desde: 22, hasta: 8 }, 1380, true, 'x', 2.5]) } }),
    () => ({ op: 'datos.inicializar', args: { plantillas: azar.algunos(['trabajo', 'gimnasio', 'otra'], 0.4) } }),
  ];
  return azar.elegir(generadores)();
}

/** Aplica cargando como `null` los ficheros que falten (como hace el servidor si no existen). */
function aplicarCompleto(mu, op, ctx) {
  for (let i = 0; i < 100; i++) {
    try { return aplicar(mu, op, ctx); } catch (e) {
      if (!(e instanceof FaltaFichero)) throw e;
      mu.ficheros[e.ruta] = null;
    }
  }
  throw new Error('demasiados ficheros');
}

const textoDe = (d) => (d == null ? null : serializar(d));

test('≥ 1.000 secuencias de operaciones: inversas exactas, lo escrito se relee igual y las inválidas no cambian nada', () => {
  const cuenta = { validas: 0, invalidas: 0, porOp: {} };
  paraCada(1000, (azar) => {
    let mu = mundoEjemplo();
    const hoy = azar.elegir(HOYS);
    const pasos = azar.entero(3, 10);
    const docs = Object.fromEntries(Object.entries(mu.ficheros).filter(([r, d]) => r.startsWith('semanas/') && d).map(([r, d]) => [r.slice(8, -3), d]));
    const base = { factores: factores(docs, m.tiposDe(mu.ficheros['tipos.md']), '2026-W45'), usoTipos: {} };
    for (const d of Object.values(docs)) for (const b of m.bloquesDe(d)) base.usoTipos[m.normalizar(b.tipo)] = (base.usoTipos[m.normalizar(b.tipo)] ?? 0) + 1;
    for (let p = 0; p < pasos; p++) {
      const ctx = { hoy, ahora: azar.entero(0, 1439), ...base };
      const op = azar.bool(0.05) ? { op: 'lote', args: { ops: [generarOp(azar, mu), generarOp(azar, mu)] } } : generarOp(azar, mu);
      // las operaciones son puras: al fallar, cada fichero tiene que seguir siendo el mismo objeto
      const antes = { ...mu.ficheros };
      let res;
      try { res = aplicarCompleto(mu, op, ctx); } catch (e) {
        assert.ok(e instanceof ErrorOp, `${op.op} lanzó ${e.name}: ${e.message}\n${JSON.stringify(op).slice(0, 400)}`);
        assert.ok(e.message.length > 5, `mensaje vacío en ${op.op}`);
        for (const [r, d] of Object.entries(antes)) assert.equal(mu.ficheros[r], d, `${op.op} cambió ${r} al fallar`);
        for (const [r, d] of Object.entries(mu.ficheros)) if (!(r in antes)) assert.equal(d, null, `${op.op} añadió ${r} al fallar`);
        cuenta.invalidas++;
        continue;
      }
      cuenta.validas++;
      cuenta.porOp[op.op] = (cuenta.porOp[op.op] ?? 0) + 1;
      for (const ruta of res.tocados) {
        const d = res.mundo.ficheros[ruta];
        if (d == null) continue;
        const s = serializar(d);
        const releido = parsear(ruta, s);
        assert.deepEqual(sinInternos(releido.lineas), sinInternos(d.lineas), `${op.op}: ${ruta} no se relee igual\n${JSON.stringify(op).slice(0, 300)}`);
        const nuevas = m.desconocidas(releido).length - m.desconocidas(mu.ficheros[ruta] ?? { lineas: [] }).length;
        assert.ok(nuevas <= 0, `${op.op} creó ${nuevas} línea(s) no reconocida(s) en ${ruta}: ${m.desconocidas(releido).map((x) => x.texto).join(' / ').slice(0, 300)}\n${JSON.stringify(op.args).slice(0, 300)}`);
        assert.equal(serializar(parsear(ruta, s)), s);
      }
      const vuelta = aplicar(res.mundo, res.inversa, ctx).mundo;
      for (const ruta of res.tocados) assert.equal(textoDe(vuelta.ficheros[ruta]), textoDe(mu.ficheros[ruta]), `${op.op}: la inversa no deja ${ruta} igual`);
      mu = res.mundo;
    }
  });
  assert.ok(cuenta.validas > 2000, JSON.stringify(cuenta));
  assert.ok(cuenta.invalidas > 500, JSON.stringify(cuenta));
  assert.ok(Object.keys(cuenta.porOp).length >= 30, JSON.stringify(cuenta.porOp));
});

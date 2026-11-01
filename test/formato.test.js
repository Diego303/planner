import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';
import * as semana from '../src/core/formato/semana.js';
import * as tareas from '../src/core/formato/tareas.js';
import { ajustes } from '../src/core/formato/listas.js';
import * as m from '../src/core/modelo.js';
import { ficherosEjemplo, sinInternos, vuelta } from './ayudas.js';

// ---------- Propiedades generales ----------

test('ejemplo/: serializar(parsear(x)) devuelve los mismos bytes y el modelo es estable', () => {
  const ficheros = ficherosEjemplo();
  assert.ok(ficheros.length > 40);
  for (const { ruta, texto } of ficheros) {
    const doc = parsear(ruta, texto);
    const s1 = serializar(doc);
    assert.equal(s1, texto, ruta);
    assert.deepEqual(parsear(ruta, s1), doc, ruta);
    assert.equal(serializar(parsear(ruta, s1)), s1, ruta);
  }
});

test('ejemplo/: solo la línea de demostración de tareas.md queda sin reconocer', () => {
  const sin = ficherosEjemplo().flatMap(({ ruta, texto }) =>
    m.desconocidas(parsear(ruta, texto)).map((d) => `${ruta}: ${d.texto}`));
  assert.equal(sin.length, 1, sin.join('\n'));
  assert.match(sin[0], /^tareas\.md: - Comprar regalo/);
});

test('se conservan BOM, CRLF y la ausencia de salto final', () => {
  for (const texto of ['﻿# Ajustes\r\n- capacidad: 70\r\n', '- capacidad: 70', '', '\n\n', '- capacidad: 80\n\n\n']) {
    assert.equal(vuelta('ajustes.md', texto), texto, JSON.stringify(texto));
  }
});

test('las rutas se reconocen (incluida la semana 53) y las ajenas no', () => {
  assert.equal(tipoDeRuta('semanas/2026-W53.md'), 'semana');
  assert.equal(tipoDeRuta('diario/2026-11-02.md'), 'diario');
  assert.equal(tipoDeRuta('archivo/tareas-2026-11.md'), 'archivo');
  assert.equal(tipoDeRuta('../ajustes.md'), null);
  assert.equal(tipoDeRuta('semanas/notas.md'), null);
  assert.equal(tipoDeRuta('LEEME.md'), null);
});

// ---------- Semana ----------

const SEMANA = `# Semana 45 · 2026-11-02 → 2026-11-08
estado: en curso          # comentario de estado

## Las 3
- [ ] Entregar el lab de RAG | rel: Curso | si: el jueves llego tarde | entonces: lo hago el sábado a las 10
- [x] Simulacro MLA-C01 ≥ 70 % | rel: MLA-C01
- [-] casilla rara

## Bloques
- L 09:00-17:30 | trabajo | Trabajo | plantilla
- L 20:00-21:30 | estudio | AI-102 · visión | tipo: aprender | hecho: +30m
- M 19:30–21:00 | estudio | Curso · lab RAG | tipo: aprender | paso: abrir el notebook rag-eval y lanzar la celda 14
- J 20:00-21:00 | estudio | MLA-C01 · simulacro | tipo: simulacro | hecho: 0 | nota: 71
- D 10:00-11:30 | estudio | Curso · repasar | tipo: repasar | sugerido
- s 10:00-11:00 | personal | Compra | color: rojo | sin-prisa     # campos desconocidos
- Lunes 09:00-10:00 | x | y
- L 22:00-01:00 | trabajo | Turno de noche
- L 09:00-10:00 | trabajo
- L 09:00-10:00 | estudio | Repetida | tipo: aprender | tipo: repasar
texto suelto

## Notas mías
- [ ] esto no es una sección del planner

## Cierre
- estudio: 9/8 h · proyectos: 3/4 h · tareas: 18 · ánimo: 3,6
- funcionó: Estudiar antes de cenar rinde más que después.
- cambio: Nada de simulacros los jueves.
- otra cosa
`;

test('semana: elementos reconocidos con todos sus campos', () => {
  const doc = parsear('semanas/2026-W45.md', SEMANA);
  assert.equal(serializar(doc), SEMANA);
  assert.equal(m.estadoGuardado(doc), 'en curso');
  const las3 = m.las3De(doc);
  assert.equal(las3.length, 2);
  assert.deepEqual(sinInternos(las3[0]), {
    t: 'las3', hecha: false, texto: 'Entregar el lab de RAG', rel: 'Curso', si: 'el jueves llego tarde',
    entonces: 'lo hago el sábado a las 10', extra: [], comentario: null, id: 4,
  });
  const b = m.bloquesDe(doc);
  assert.equal(b.length, 6);
  assert.deepEqual([b[1].dia, b[1].inicio, b[1].fin, b[1].tipo, b[1].titulo, b[1].subtipo, b[1].hecho],
    [0, 1200, 1290, 'estudio', 'AI-102 · visión', 'aprender', 30]);
  assert.equal(b[2].paso, 'abrir el notebook rag-eval y lanzar la celda 14');
  assert.equal(b[3].nota, 71);
  assert.equal(b[3].hecho, 0);
  assert.ok(b[4].sugerido && !b[4].plantilla);
  assert.ok(b[0].plantilla);
  assert.equal(b[5].dia, 5);
  assert.deepEqual(b[5].extra, ['color: rojo', 'sin-prisa']);
  assert.equal(b[5].comentario, '# campos desconocidos');
  const c = m.cierreDe(doc);
  assert.match(c.resumen.texto, /^estudio: 9\/8 h/);
  assert.equal(c.funciono[0].texto, 'Estudiar antes de cenar rinde más que después.');
  assert.equal(c.cambio[0].texto, 'Nada de simulacros los jueves.');
});

test('semana: líneas no reconocidas conservadas en su sitio', () => {
  const doc = parsear('semanas/2026-W45.md', SEMANA);
  const textos = m.desconocidas(doc).map((d) => d.texto);
  assert.deepEqual(textos, [
    '- [-] casilla rara',
    '- Lunes 09:00-10:00 | x | y',
    '- L 22:00-01:00 | trabajo | Turno de noche',
    '- L 09:00-10:00 | trabajo',
    '- L 09:00-10:00 | estudio | Repetida | tipo: aprender | tipo: repasar',
    'texto suelto',
    '## Notas mías',
    '- [ ] esto no es una sección del planner',
    '- otra cosa',
  ]);
});

test('semana: al cambiar un bloque se reescribe solo esa línea, en forma canónica y con su comentario', () => {
  const doc = parsear('semanas/2026-W45.md', SEMANA);
  const i = m.bloquesDe(doc)[5].id;
  const editado = { ...doc, lineas: doc.lineas.map((l, j) => (j === i ? { ...l, inicio: 600, fin: 690, hecho: -30 } : l)) };
  const s1 = serializar(editado);
  const antes = SEMANA.split('\n'), despues = s1.split('\n');
  assert.equal(despues.length, antes.length);
  antes.forEach((linea, j) => { if (j !== i) assert.equal(despues[j], linea); });
  assert.equal(despues[i], '- S 10:00-11:30 | personal | Compra | hecho: -30m | color: rojo | sin-prisa  # campos desconocidos');
  // parse → serialize → parse: mismo modelo; serializar es idempotente
  const doc2 = parsear('semanas/2026-W45.md', s1);
  assert.deepEqual(sinInternos(doc2), sinInternos(editado));
  assert.equal(serializar(doc2), s1);
});

test('semana: elementos nuevos en forma canónica que se vuelve a leer igual', () => {
  const doc = semana.vacia('2026-W53', 'planificada');
  const bloque = semana.bloque({ dia: 3, inicio: 1200, fin: 1290, tipo: 'estudio', titulo: 'AI-102 · repasar', subtipo: 'repasar', paso: 'abrir el PDF', hecho: 60, nota: 80, plantilla: true, sugerido: true });
  doc.lineas.push(bloque, { t: 'vacia' }, semana.seccion('estudio'), semana.objetivoEstudio('Curso', 7.5),
    { t: 'vacia' }, semana.seccion('cierre'), semana.resumen('estudio: 1/2 h · tareas: 3'), semana.leccion('funciono', 'algo'));
  doc.lineas.splice(4, 0, semana.objetivo3({ texto: 'Lab', rel: 'Curso', si: 'llueve', entonces: 'en casa', hecha: true }));
  const texto = serializar(doc);
  assert.equal(texto, `# Semana 53 · 2026-12-28 → 2027-01-03
estado: planificada

## Las 3
- [x] Lab | rel: Curso | si: llueve | entonces: en casa

## Bloques
- J 20:00-21:30 | estudio | AI-102 · repasar | tipo: repasar | paso: abrir el PDF | hecho: +1h | nota: 80 | plantilla | sugerido

## Estudio
- Curso: 7,5 h

## Cierre
- estudio: 1/2 h · tareas: 3
- funcionó: algo
`);
  const leido = parsear('semanas/2026-W53.md', texto);
  assert.deepEqual(sinInternos(leido), sinInternos(doc));
  assert.equal(serializar(leido), texto);
  assert.deepEqual(m.objetivosDe(leido), { curso: 7.5 });
});

// ---------- Tareas ----------

test('tareas: secciones, campos, banderas y no reconocidas', () => {
  const texto = `# Tareas
- [ ] antes de cualquier sección
## Hoy
- [ ] Revisar PR | trabajo | prioridad
- [x] Leer: chunking y reranking | estudio | hecha: 2026-11-02
- [ ] Sin tipo | las3 | fecha: 2026-11-03
## Mas adelante
- [ ] Simulacro MLA-C01 | estudio | fecha: 2026-11-05 | dur: 1h30 | creada: 2026-10-01 | ojo
- [ ] Fecha mala | fecha: 30/10
- sin casilla
## ALGÚN DÍA
- [ ] Aprender Rust | estudio
## Compras
- [ ] Pan
`;
  const doc = parsear('tareas.md', texto);
  assert.equal(serializar(doc), texto);
  const t = m.tareasDe(doc);
  assert.deepEqual(t.hoy.map((x) => [x.texto, x.tipo, x.prioridad, x.hecha, x.fechaHecha, x.las3, x.fecha]), [
    ['Revisar PR', 'trabajo', true, false, null, false, null],
    ['Leer: chunking y reranking', 'estudio', false, true, '2026-11-02', false, null],
    ['Sin tipo', null, false, false, null, true, '2026-11-03'],
  ]);
  assert.deepEqual([t.mas[0].dur, t.mas[0].creada, t.mas[0].extra], [90, '2026-10-01', ['ojo']]);
  assert.equal(t.algun[0].texto, 'Aprender Rust');
  assert.deepEqual(m.desconocidas(doc).map((d) => d.texto), [
    '- [ ] antes de cualquier sección', '- [ ] Fecha mala | fecha: 30/10', '- sin casilla', '## Compras', '- [ ] Pan',
  ]);
  const nueva = tareas.tarea({ seccion: 'hoy', texto: 'Nueva', tipo: 'personal', prioridad: true, fecha: '2026-11-04', dur: 45, creada: '2026-11-02', hecha: true, fechaHecha: '2026-11-02' });
  assert.equal(tareas.canonTarea(nueva), '- [x] Nueva | personal | prioridad | fecha: 2026-11-04 | dur: 45m | creada: 2026-11-02 | hecha: 2026-11-02');
});

// ---------- Listas clave: valor ----------

test('ajustes: valores, comentarios, inválidos y repetidos', () => {
  const texto = `# Ajustes
- capacidad: 80            # % máximo
- horas: 8-23
- cierre: 23:00 # un espacio basta en valores tipados
- tema: Papel
- tareas_hoy: muchas
- color: azul
- capacidad: 90
- tema_temporada: sí
`;
  const doc = parsear('ajustes.md', texto);
  assert.equal(serializar(doc), texto);
  const v = m.valoresAjustes(doc);
  assert.equal(v.capacidad, 80);
  assert.deepEqual(v.horas, { desde: 8, hasta: 23 });
  assert.equal(v.cierre, 1380);
  assert.equal(v.tema, 'papel');
  assert.equal(v.tareas_hoy, 5); // inválido → por defecto
  assert.equal(v.tema_temporada, true);
  assert.deepEqual(m.desconocidas(doc).map((d) => d.texto), ['- tareas_hoy: muchas', '- color: azul', '- capacidad: 90']);
  // cambiar un valor conserva el comentario
  const i = doc.lineas.findIndex((l) => l.clave === 'capacidad');
  const editado = { ...doc, lineas: doc.lineas.map((l, j) => (j === i ? { ...l, valor: 75 } : l)) };
  assert.equal(serializar(editado).split('\n')[1], '- capacidad: 75  # % máximo');
  assert.equal(ajustes.canon(ajustes.kv('mejores_horas', 'mañanas')), '- mejores_horas: mañanas');
});

test('estudio y proyectos: secciones por tema, simulacros y fechas', () => {
  const texto = `# Estudio
- suelto: antes de la primera sección

## AI-102
- horas_semana: 4,5
- examen: 2026-12-12
- total: 40             # horas objetivo
- simulacros: 61 @2026-10-10, 66 %, 72 @2026-11-05
- dejado: celda 14: falta comparar # no es comentario
- examen: 2027-01-01

## Vacío
`;
  const doc = parsear('estudio.md', texto);
  assert.equal(serializar(doc), texto);
  const [ai, vacio] = m.temasEstudio(doc);
  assert.equal(ai.nombre, 'AI-102');
  assert.equal(ai.horasSemana, 4.5);
  assert.equal(ai.examen, '2026-12-12');
  assert.equal(ai.total, 40);
  assert.deepEqual(ai.simulacros, [{ nota: 61, fecha: '2026-10-10' }, { nota: 66, fecha: null }, { nota: 72, fecha: '2026-11-05' }]);
  assert.equal(ai.dejado, 'celda 14: falta comparar # no es comentario');
  assert.equal(vacio.horasSemana, 0);
  assert.deepEqual(m.desconocidas(doc).map((d) => d.texto), ['- suelto: antes de la primera sección', '- examen: 2027-01-01']);

  const pro = parsear('proyectos.md', '## huddle\n- siguiente: pestaña Mañana\n- estado: pausado\n- actualizado: 2026-11-01\n- estado: quizá\n');
  const [h] = m.proyectosDe(pro);
  assert.deepEqual([h.nombre, h.siguiente, h.estado, h.actualizado], ['huddle', 'pestaña Mañana', 'pausado', '2026-11-01']);
  assert.equal(m.desconocidas(pro).length, 1);
});

test('diario, tipos, plantilla, inbox y tema', () => {
  const d = parsear('diario/2026-11-02.md', '- ánimo: 4\n- linea: Día tranquilo\n- avanzado: AI-102 · visión; Leer\n- mañana: Curso: abrir\n- ánimo: 7\n');
  assert.deepEqual(m.diarioDe(d), { animo: 4, linea: 'Día tranquilo', avanzado: ['AI-102 · visión', 'Leer'], manana: 'Curso: abrir' });
  assert.equal(m.desconocidas(d).length, 1);

  const tipos = parsear('tipos.md', '# Tipos\n- trabajo | #3d5a80 | trabajo      # bandera\n- Trabajo | #000000\n- ocio | azul\n- estudio | #5B4E8C | estudio | raro\n');
  assert.deepEqual(m.tiposDe(tipos).map((t) => [t.nombre, t.color, t.trabajo, t.estudio]), [
    ['trabajo', '#3D5A80', true, false], ['estudio', '#5B4E8C', false, true]]);
  assert.equal(m.desconocidas(tipos).length, 2);
  assert.equal(serializar(tipos), '# Tipos\n- trabajo | #3d5a80 | trabajo      # bandera\n- Trabajo | #000000\n- ocio | azul\n- estudio | #5B4E8C | estudio | raro\n');

  const pl = parsear('plantilla.md', '- L,M, X,J,V 09:00-17:30 | trabajo | Trabajo\n- V,L 18:00-19:30 | entreno | Gimnasio | tipo: aprender\n- L-V 09:00-17:30 | trabajo | Trabajo\n');
  const e = m.plantillaDe(pl);
  assert.deepEqual(e.map((x) => x.dias), [[0, 1, 2, 3, 4], [0, 4]]);
  assert.equal(m.desconocidas(pl).length, 1);

  const inbox = parsear('inbox.md', '# Inbox\n- idea\n\notra idea sin guion\n');
  assert.equal(m.notasInbox(inbox).length, 2);
  assert.equal(m.desconocidas(inbox).length, 0);

  const tema = parsear('tema.md', '- base: nordico-oscuro\n- fondo: #101010\n- acento: red; } body {\n');
  assert.deepEqual(m.valoresTema(tema), { base: 'nordico-oscuro', tokens: { fondo: '#101010' } });
  assert.equal(m.desconocidas(tema).length, 1);
});

test('la sección se cierra también en títulos no reconocidos', () => {
  const doc = parsear('semanas/2026-W45.md', '## Bloques\n- L 09:00-10:00 | a | b\n\n## Otra\n- x\n');
  const i = m.indiceSeccion(doc, 'bloques');
  assert.equal(m.finSeccion(doc, i), 3);
  assert.equal(m.finContenido(doc, i), 2);
});

test('semana: «## Notas» es texto libre reconocido (no se marca)', () => {
  const t = '# Semana 45\n\n## Bloques\n- L 09:00-10:00 | a | b\n\n## Notas\n- repaso: los jueves rinden poco\ncualquier cosa\n';
  const doc = parsear('semanas/2026-W45.md', t);
  assert.equal(serializar(doc), t);
  assert.equal(m.desconocidas(doc).length, 0);
  assert.deepEqual(m.notasSemana(doc), ['repaso: los jueves rinden poco', 'cualquier cosa']);
});

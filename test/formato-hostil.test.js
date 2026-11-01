// Q1 · Entradas hostiles: lo que no se reconoce se conserva exactamente en su sitio y se marca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsear, serializar } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';

const vuelta = (ruta, x) => serializar(parsear(ruta, x));

test('finales de línea mezclados (Bloc de notas + otro editor): cada línea conserva el suyo', () => {
  const x = '# Tareas\r\n## Hoy\n- [ ] uno | personal\r\n- [ ] dos\n\r\n## Más adelante\r\n- [ ] tres\n';
  assert.equal(vuelta('tareas.md', x), x);
  // al cambiar una tarea, el resto de líneas no se toca y la nueva usa el fin de línea más frecuente
  const doc = parsear('tareas.md', x);
  const i = m.tareasDe(doc).hoy[0].id;
  doc.lineas[i] = { ...doc.lineas[i], hecha: true };
  assert.equal(serializar(doc), x.replace('- [ ] uno', '- [x] uno'));
  doc.lineas.push({ t: 'tarea', seccion: 'mas', hecha: false, texto: 'cuatro', tipo: null, prioridad: false, las3: false, fecha: null, dur: null, creada: null, fechaHecha: null, extra: [], comentario: null });
  assert.ok(serializar(doc).endsWith('- [ ] tres\n- [ ] cuatro\r\n'));
});

test('## Estudio de la semana: nombres de tema con « # » o con «:» se leen bien', () => {
  for (const tema of ['AI-102 # parte 2', 'Curso: IA aplicada', 'C# avanzado', 'a: b # c: d']) {
    const x = `## Estudio\n- ${tema}: 6,5 h\n`;
    const doc = parsear('semanas/2026-W45.md', x);
    assert.deepEqual(m.objetivosDe(doc), { [m.normalizar(tema)]: 6.5 }, tema);
    assert.equal(serializar(doc), x);
  }
  // el comentario final sigue funcionando con dos espacios
  assert.deepEqual(m.objetivosDe(parsear('semanas/2026-W45.md', '## Estudio\n- Curso: 6 h   # una semana floja\n')), { curso: 6 });
});

const desconocidas = (ruta, x) => m.desconocidas(parsear(ruta, x)).map((d) => d.texto);

test('Bloc de notas: BOM, CRLF, tabuladores y espacios al final se reconocen y se conservan', () => {
  const casos = {
    'ajustes.md': '﻿# Ajustes\r\n-\tcapacidad: 80   \r\n- horas:\t8-23\t\r\n',
    'tipos.md': '﻿# Tipos\r\n- trabajo\t|\t#3D5A80\t|\ttrabajo  \r\n',
    'plantilla.md': '﻿- L,X\t09:00-10:00 | trabajo | Trabajo \r\n',
    'semanas/2026-W45.md': '﻿# Semana 45\r\nestado: en curso \r\n\r\n## Las 3\r\n- [ ]\tLab | rel: Curso \r\n## Bloques\r\n- L\t09:00-10:00\t|\ttrabajo\t|\tTrabajo\t\r\n',
    'tareas.md': '﻿## Hoy\r\n- [x]\tLeer | estudio | hecha: 2026-11-02   \r\n',
    'estudio.md': '﻿## AI-102\r\n- horas_semana:\t5 \r\n',
    'proyectos.md': '﻿## huddle\r\n- siguiente: pestaña\tMañana  \r\n',
    'diario/2026-11-02.md': '﻿- ánimo: 4 \r\n- línea: bien\t\r\n',
    'tema.md': '﻿- base: papel \r\n- acento: #E0A25A\t\r\n',
    'inbox.md': '﻿# Inbox\r\n\t- idea\t\r\n',
  };
  for (const [ruta, x] of Object.entries(casos)) {
    assert.equal(vuelta(ruta, x), x, ruta);
    assert.deepEqual(desconocidas(ruta, x), [], ruta);
  }
  const s = parsear('semanas/2026-W45.md', casos['semanas/2026-W45.md']);
  assert.deepEqual(m.bloquesDe(s).map((b) => [b.dia, b.inicio, b.tipo, b.titulo]), [[0, 540, 'trabajo', 'Trabajo']]);
  assert.equal(m.valoresAjustes(parsear('ajustes.md', casos['ajustes.md'])).capacidad, 80);
});

test('ficheros vacíos o solo con cabecera: nada que marcar', () => {
  for (const ruta of ['ajustes.md', 'tipos.md', 'plantilla.md', 'semanas/2026-W45.md', 'tareas.md', 'estudio.md', 'proyectos.md', 'diario/2026-11-02.md', 'tema.md', 'inbox.md', 'archivo/tareas-2026-11.md']) {
    for (const x of ['', '\n', '# Título\n', '# Título', '\r\n\r\n']) {
      assert.equal(vuelta(ruta, x), x, `${ruta} ${JSON.stringify(x)}`);
      assert.deepEqual(desconocidas(ruta, x), [], `${ruta} ${JSON.stringify(x)}`);
    }
  }
  assert.equal(m.tiposDe(parsear('tipos.md', '')).length, 0); // tipos.md vacío existe: sin tipos (el defecto es cuando no hay fichero)
});

test('secciones duplicadas, desconocidas y en otro orden', () => {
  const sem = '## Cierre\n- funcionó: algo\n## Bloques\n- L 09:00-10:00 | a | uno\n## Notas raras\n- L 10:00-11:00 | a | no cuenta\n## Bloques\n- M 09:00-10:00 | a | dos\n## Las 3\n- [ ] x\n';
  const d = parsear('semanas/2026-W45.md', sem);
  assert.deepEqual(m.bloquesDe(d).map((b) => b.titulo), ['uno', 'dos']);
  assert.deepEqual(desconocidas('semanas/2026-W45.md', sem), ['## Notas raras', '- L 10:00-11:00 | a | no cuenta']);
  assert.equal(m.las3De(d).length, 1);
  assert.equal(m.cierreDe(d).funciono[0].texto, 'algo');
  const tar = '## Algún día\n- [ ] a\n## Hoy\n- [ ] b\n## Hoy\n- [ ] c\n## Compras\n- [ ] pan\n';
  assert.deepEqual(m.tareasDe(parsear('tareas.md', tar)).hoy.map((t) => t.texto), ['b', 'c']);
  assert.deepEqual(desconocidas('tareas.md', tar), ['## Compras', '- [ ] pan']);
  assert.equal(vuelta('tareas.md', tar), tar);
});

test('títulos con separadores, marcas, comillas, emojis, RTL, HTML y más de 2.000 caracteres', () => {
  const largo = 'x'.repeat(2500);
  const titulos = ['Lab · parte 2 · ¡ya!', 'C#: ¿qué es [x]?', '"comillas" y \'simples\'', 'ñandú 😀 👩‍💻 acción', 'مرحبا שלום',
    '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', largo, 'rel: x', 'hecho: +30m', 'prioridad'];
  for (const titulo of titulos) {
    const x = `## Bloques\n- L 09:00-10:00 | personal | ${titulo}\n`;
    const d = parsear('semanas/2026-W45.md', x);
    assert.equal(m.bloquesDe(d)[0].titulo, titulo);
    assert.equal(serializar(d), x);
    const t = parsear('tareas.md', `## Hoy\n- [ ] ${titulo} | personal\n`);
    assert.equal(m.tareasDe(t).hoy[0].texto, titulo);
  }
  // un «|» escrito a mano parte el título: lo que sobra se conserva como campo extra (no se pierde)
  const d = parsear('semanas/2026-W45.md', '## Bloques\n- L 09:00-10:00 | personal | Lab | parte 2\n');
  assert.deepEqual([m.bloquesDe(d)[0].titulo, m.bloquesDe(d)[0].extra], ['Lab', ['parte 2']]);
});

test('horas, días, fechas y colores inválidos: la línea no se reconoce y se conserva', () => {
  const bloques = ['- L 25:00-26:00 | a | b', '- L 9:7-10:00 | a | b', '- L 10:00-09:00 | a | b', '- L 10:00-10:00 | a | b',
    '- L 24:00-24:30 | a | b', '- L 23:00-01:00 | a | b', '- Q 09:00-10:00 | a | b', '- Lu 09:00-10:00 | a | b', '- L 09:60-10:00 | a | b'];
  const x = `## Bloques\n${bloques.join('\n')}\n- L 23:00-24:00 | a | hasta medianoche\n`;
  assert.deepEqual(desconocidas('semanas/2026-W45.md', x), bloques);
  assert.equal(m.bloquesDe(parsear('semanas/2026-W45.md', x))[0].fin, 1440);
  assert.deepEqual(desconocidas('tareas.md', '## Hoy\n- [ ] a | fecha: 2026-02-30\n- [ ] b | fecha: 2028-02-29\n'), ['- [ ] a | fecha: 2026-02-30']);
  assert.deepEqual(desconocidas('tipos.md', '- a | #12345\n- b | #GGGGGG\n- c | rojo\n- d | #AbCdEf\n'), ['- a | #12345', '- b | #GGGGGG', '- c | rojo']);
  assert.deepEqual(desconocidas('plantilla.md', '- L,Q 09:00-10:00 | a | b\n- 09:00-10:00 | a | b\n'), ['- L,Q 09:00-10:00 | a | b', '- 09:00-10:00 | a | b']);
  assert.deepEqual(desconocidas('estudio.md', '## X\n- examen: 2026-02-30\n- inicio: 2028-02-29\n'), ['- examen: 2026-02-30']);
});

test('claves con mayúsculas, valores vacíos y números con coma decimal', () => {
  const x = '- Capacidad: 70\n- FOCO_MAX: 1,5\n- tareas_hoy:\n- horas: 8 - 23\n- Tema: PAPEL\n';
  const v = m.valoresAjustes(parsear('ajustes.md', x));
  assert.deepEqual([v.capacidad, v.foco_max, v.horas, v.tema], [70, 1.5, { desde: 8, hasta: 23 }, 'papel']);
  assert.deepEqual(desconocidas('ajustes.md', x), ['- tareas_hoy:']);
  const e = m.temasEstudio(parsear('estudio.md', '## A\n- Horas_Semana: 4,5\n- TOTAL: 40.5\n- dejado:\n'))[0];
  assert.deepEqual([e.horasSemana, e.total, e.dejado], [4.5, 40.5, null]);
});

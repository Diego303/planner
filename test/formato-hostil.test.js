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

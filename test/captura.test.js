import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsearCaptura, destinoCaptura, tareaDeCaptura, fechaDeToken, etiquetaFecha } from '../src/core/captura.js';
import { TIPOS_DEFECTO } from '../src/core/modelo.js';

const HOY = '2026-11-02'; // lunes
const p = (t) => parsearCaptura(t, { tipos: TIPOS_DEFECTO, hoy: HOY });

test('tokens: área por prefijo, fecha, prioridad, duración y algún día', () => {
  assert.deepEqual(p('Llamar al gestor #pers mañana ! 45m'), { titulo: 'Llamar al gestor', tipo: 'personal', fecha: '2026-11-03', prioridad: true, dur: 45, algunDia: false });
  assert.deepEqual(p('Simulacro MLA-C01 #est jue 1h30'), { titulo: 'Simulacro MLA-C01', tipo: 'estudio', fecha: '2026-11-05', prioridad: false, dur: 90, algunDia: false });
  assert.equal(p('Aprender Rust algún día #est').algunDia, true);
  assert.equal(p('Aprender Rust algun dia').titulo, 'Aprender Rust');
  assert.equal(p('Comprar pan hoy').fecha, HOY);
  assert.equal(p('Revisar contrato 15/01').fecha, '2027-01-15'); // ya pasó este año → el que viene
  assert.equal(p('Revisar contrato 20/11').fecha, '2026-11-20');
  assert.equal(p('Cena lun').fecha, HOY); // hoy es lunes
  assert.equal(p('Cena dom').fecha, '2026-11-08');
});

test('lo que no es token se queda en el título', () => {
  assert.equal(p('Leer #xyz sobre C#').titulo, 'Leer #xyz sobre C#'); // área desconocida: se conserva
  assert.equal(p('¡Hola! qué tal').titulo, '¡Hola! qué tal');
  assert.equal(p('Ver 31/02').titulo, 'Ver 31/02'); // fecha imposible
  assert.equal(p('   ').titulo, '');
  assert.equal(p('#trab mañana').titulo, '');
  // solo el primer token de cada clase
  const r = p('Ir mar y jue');
  assert.equal(r.fecha, '2026-11-03');
  assert.equal(r.titulo, 'Ir y jue');
});

test('destino: algún día, hoy con hueco, más adelante', () => {
  const ctx = { hoy: HOY, abiertasHoy: 4, limite: 5 };
  assert.equal(destinoCaptura(p('Aprender Rust algún día'), ctx), 'algun');
  assert.equal(destinoCaptura(p('Llamar al gestor'), ctx), 'hoy');
  assert.equal(destinoCaptura(p('Llamar al gestor hoy #pers'), ctx), 'hoy');
  assert.equal(destinoCaptura(p('Revisar PR #trab'), ctx), 'mas'); // con área y sin fecha
  assert.equal(destinoCaptura(p('Llamar mañana'), ctx), 'mas');
  assert.equal(destinoCaptura(p('Llamar'), { ...ctx, abiertasHoy: 5 }), 'mas'); // Hoy lleno
  const lleno = p('Llamar hoy');
  assert.deepEqual(tareaDeCaptura(lleno, 'mas', HOY).fecha, HOY);
  assert.equal(tareaDeCaptura(lleno, 'hoy', HOY).fecha, null);
});

test('fechas de tokens y etiquetas', () => {
  assert.equal(fechaDeToken('Miércoles', HOY), '2026-11-04');
  assert.equal(fechaDeToken('sáb', HOY), '2026-11-07');
  assert.equal(fechaDeToken('29/02', '2027-03-01'), '2028-02-29'); // el próximo 29 de febrero
  assert.equal(etiquetaFecha('2026-11-03', HOY), 'mañana');
  assert.equal(etiquetaFecha('2026-11-05', HOY), 'jue 5');
  assert.equal(etiquetaFecha('2026-12-12', HOY), '12 dic');
});

test('dd/mm imposible este año (29/02) toma el próximo, y «1h30m» es una duración', () => {
  assert.equal(p('Revisar contrato 29/02').fecha, '2028-02-29');
  assert.equal(p('Revisar contrato 29/02').titulo, 'Revisar contrato');
  assert.equal(fechaDeToken('29/02', '2028-03-01'), '2032-02-29');
  assert.equal(fechaDeToken('31/04', HOY), null);
  assert.deepEqual([p('Leer 1h30m').dur, p('Leer 1h30m').titulo], [90, 'Leer']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as f from '../src/core/fechas.js';

test('semana ISO de fechas normales y límites de año', () => {
  assert.equal(f.semanaDe('2026-11-02'), '2026-W45');
  assert.equal(f.semanaDe('2026-11-08'), '2026-W45');
  assert.equal(f.semanaDe('2026-11-09'), '2026-W46');
  assert.equal(f.semanaDe('2026-01-01'), '2026-W01'); // jueves
  assert.equal(f.semanaDe('2027-01-01'), '2026-W53'); // viernes: pertenece a la 53 de 2026
  assert.equal(f.semanaDe('2027-01-03'), '2026-W53');
  assert.equal(f.semanaDe('2027-01-04'), '2027-W01');
  assert.equal(f.semanaDe('2024-12-30'), '2025-W01'); // lunes: ya es la 1 de 2025
  assert.equal(f.semanaDe('2021-01-03'), '2020-W53');
});

test('años con 53 semanas', () => {
  assert.equal(f.semanasDelAño(2026), 53);
  assert.equal(f.semanasDelAño(2020), 53);
  assert.equal(f.semanasDelAño(2032), 53);
  assert.equal(f.semanasDelAño(2025), 52);
  assert.equal(f.semanasDelAño(2027), 52);
  assert.ok(f.esSemana('2026-W53'));
  assert.ok(!f.esSemana('2025-W53'));
  assert.ok(!f.esSemana('2026-W00'));
});

test('lunes, días y aritmética de semanas (incluido 2026-W53 → 2027-W01)', () => {
  assert.equal(f.lunesDe('2026-W45'), '2026-11-02');
  assert.equal(f.lunesDe('2026-W53'), '2026-12-28');
  assert.equal(f.lunesDe('2027-W01'), '2027-01-04');
  assert.equal(f.sumarSemanas('2026-W53', 1), '2027-W01');
  assert.equal(f.sumarSemanas('2027-W01', -1), '2026-W53');
  assert.equal(f.sumarSemanas('2026-W45', -45), '2025-W52');
  assert.equal(f.semanasEntre('2026-W50', '2027-W02'), 5);
  assert.deepEqual(f.diasDeSemana('2026-W53'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
    '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(f.rangoSemana('2026-W45'), '2 – 8 nov');
  assert.equal(f.rangoSemana('2026-W53'), '28 dic – 3 ene');
  assert.ok(f.compararSemanas('2026-W53', '2027-W01') < 0);
});

test('fechas: validez, días entre y cambio de hora', () => {
  assert.ok(f.esFecha('2028-02-29'));
  assert.ok(!f.esFecha('2026-02-29'));
  assert.ok(!f.esFecha('2026-13-01'));
  assert.ok(!f.esFecha('30/10'));
  assert.equal(f.diasEntre('2026-10-24', '2026-10-26'), 2); // cruza el cambio de hora de octubre
  assert.equal(f.sumarDias('2026-03-28', 2), '2026-03-30');
  assert.equal(f.diaSemana('2026-11-02'), 0);
  assert.equal(f.diaSemana('2026-11-08'), 6);
  assert.equal(f.fechaLarga('2026-11-02'), 'lunes 2 de noviembre');
  assert.equal(f.diaCorto('2026-11-03'), 'mar 3');
});

test('horas, rangos, duraciones y diferencias', () => {
  assert.equal(f.aMinutos('09:30'), 570);
  assert.equal(f.aMinutos('9:05'), 545);
  assert.equal(f.aMinutos('24:00'), 1440);
  assert.equal(f.aMinutos('24:30'), null);
  assert.equal(f.aMinutos('10:60'), null);
  assert.equal(f.deMinutos(570), '09:30');
  assert.equal(f.horaCorta(570), '9:30');
  assert.deepEqual(f.parsearRango('09:00-17:30'), { inicio: 540, fin: 1050 });
  assert.deepEqual(f.parsearRango('10:30–12:00'), { inicio: 630, fin: 720 });
  assert.equal(f.parsearRango('22:00-01:00'), null);
  assert.equal(f.parsearRango('10:00-10:00'), null);
  assert.equal(f.parsearDuracion('1h30'), 90);
  assert.equal(f.parsearDuracion('45m'), 45);
  assert.equal(f.parsearDuracion('2h'), 120);
  assert.equal(f.parsearDuracion('90min'), 90);
  assert.equal(f.formatoDuracion(90), '1h30');
  assert.equal(f.formatoDuracion(45), '45m');
  assert.equal(f.parsearDelta('+30m'), 30);
  assert.equal(f.parsearDelta('-30m'), -30);
  assert.equal(f.parsearDelta('0'), 0);
  assert.equal(f.parsearDelta('+1h'), 60);
  assert.equal(f.parsearDelta('30m'), null);
  assert.equal(f.formatoDelta(60), '+1h');
  assert.equal(f.formatoDelta(-30), '-30m');
  assert.equal(f.formatoDelta(0), '0');
  assert.equal(f.numero(1.25), '1,3');
  assert.equal(f.numero(2), '2');
});

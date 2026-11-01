// Q1 · Fechas: los resultados son idénticos en UTC, Europe/Madrid y America/Los_Angeles (cambios de hora incluidos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const SCRIPT = new URL('./zonas-calculo.js', import.meta.url).pathname;
const en = (TZ) => JSON.parse(execFileSync(process.execPath, [SCRIPT], { env: { ...process.env, TZ }, encoding: 'utf8' }));

test('mismos resultados en tres zonas horarias', () => {
  const utc = en('UTC');
  for (const tz of ['Europe/Madrid', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) assert.deepEqual(en(tz), utc, tz);
  // y con sentido: el cambio de hora no salta ni repite días
  assert.ok(utc.cambiosDeHora.every(([, , , dias]) => dias === 1));
  assert.deepEqual(utc.bisiesto, ['2028-W09', '2028-02-29', '2028-03-01', true, false]);
  assert.deepEqual(utc.w53.slice(0, 2), ['2026-12-28', '2027-W01']);
});

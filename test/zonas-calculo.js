// Cálculos con fechas que tienen que dar lo mismo en cualquier zona horaria (lo ejecuta test/zonas.test.js).
import { createHash } from 'node:crypto';
import * as f from '../src/core/fechas.js';
import { parsearCaptura, destinoCaptura } from '../src/core/captura.js';
import { proponer } from '../src/core/proponer.js';
import { factores } from '../src/core/factor.js';
import { calcularProgreso } from '../src/core/progreso.js';
import { serializar } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { mundoEjemplo } from './ayudas.js';

const h = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');
const out = {};
// 1.200 días alrededor de los cambios de hora de 2026 y del 29 de febrero de 2028
const dias = [];
for (let d = '2025-12-01'; d <= '2029-03-15'; d = f.sumarDias(d, 1)) dias.push(d);
out.fechas = h(dias.map((d) => [d, f.semanaDe(d), f.diaSemana(d), f.lunesDe(f.semanaDe(d)), f.diasEntre('2026-03-28', d), f.rangoSemana(f.semanaDe(d)),
  f.columnasSemana(f.semanaDe(d), 'domingo')[0].fecha, f.fechaLarga(d)]));
out.cambiosDeHora = ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26'].map((d) => [d, f.semanaDe(d), f.sumarDias(d, 1), f.diasEntre(d, f.sumarDias(d, 1))]);
out.bisiesto = [f.semanaDe('2028-02-29'), f.sumarDias('2028-02-28', 1), f.sumarDias('2028-02-29', 1), f.esFecha('2028-02-29'), f.esFecha('2026-02-29')];
out.w53 = [f.lunesDe('2026-W53'), f.sumarSemanas('2026-W53', 1), f.diasDeSemana('2026-W53')];
const mu = mundoEjemplo().ficheros;
out.ejemplo = h(Object.entries(mu).map(([r, d]) => [r, serializar(d)]));
const tipos = m.tiposDe(mu['tipos.md']);
const docs = Object.fromEntries(Object.entries(mu).filter(([r]) => r.startsWith('semanas/')).map(([r, d]) => [r.slice(8, -3), d]));
const fs = factores(docs, tipos, '2026-W45');
out.factores = h(fs);
out.proponer = h(proponer({ id: '2026-W46', doc: docs['2026-W45'], temas: m.temasEstudio(mu['estudio.md']), proyectos: m.proyectosDe(mu['proyectos.md']),
  ajustes: m.valoresAjustes(mu['ajustes.md']), tipos, factores: fs, hoy: '2026-11-02' }));
const diarios = Object.fromEntries(Object.entries(mu).filter(([r]) => r.startsWith('diario/')).map(([r, d]) => [r.slice(7, -3), m.diarioDe(d)]));
out.progreso = h(calcularProgreso({ docsSemanas: docs, temas: m.temasEstudio(mu['estudio.md']), tipos, diarios, hoy: '2026-11-02', actual: '2026-W45' }));
out.captura = h(['Cena dom', 'algo mañana', 'x 29/02', 'y 31/12', 'z hoy #est 1h30 !'].flatMap((t) => ['2026-03-29', '2026-10-25', '2026-12-31', '2028-02-28']
  .map((hoy) => { const r = parsearCaptura(t, { tipos, hoy }); return [r, destinoCaptura(r, { hoy, abiertasHoy: 0, limite: 5 })]; })));
process.stdout.write(JSON.stringify(out));

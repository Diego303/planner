// Genera ~3 años de datos realistas para las pruebas de rendimiento (determinista, con semilla):
// 157 semanas (las pasadas cerradas, con resumen y lecciones), ~5.000 tareas archivadas y ~1.000 días de diario.
// Uso: node test/rendimiento/generar.js <carpeta> [hoy AAAA-MM-DD]
import { mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as f from '../../src/core/fechas.js';
import { crearAzar } from '../azar.js';

const EJEMPLO = fileURLToPath(new URL('../../ejemplo/', import.meta.url));
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TEMAS = ['AI-102', 'MLA-C01', 'Curso', 'Rust', 'Inglés'];
const PROYECTOS = ['huddle', 'gymhub', 'agente soporte', 'blog', 'domótica', 'libro', 'fotos', 'web personal'];
const hh = (m) => f.deMinutos(m);

export function generar(dir, { hoy = '2026-11-02', semanas = 157, tareasArchivadas = 5000, diarios = 1000, semilla = 3 } = {}) {
  const az = crearAzar(semilla);
  cpSync(EJEMPLO, dir, { recursive: true, filter: (o) => !o.includes('/semanas/') && !o.includes('/diario/') });
  for (const d of ['semanas', 'diario', 'archivo']) mkdirSync(join(dir, d), { recursive: true });
  const actual = f.semanaDe(hoy);
  let lecciones = 0;
  for (let k = semanas - 1; k >= 0; k--) {
    const id = f.sumarSemanas(actual, -k);
    const pasada = k > 0;
    const lunes = f.lunesDe(id);
    const l = [`# Semana ${f.numeroSemana(id)} · ${lunes} → ${f.sumarDias(lunes, 6)}`, `estado: ${pasada ? 'cerrada' : 'en curso'}`, '', '## Las 3'];
    for (let i = 0; i < 3; i++) l.push(`- [${pasada && az.bool(0.7) ? 'x' : ' '}] ${az.elegir(['Avanzar', 'Terminar', 'Repasar'])} ${az.elegir(TEMAS)} | rel: ${az.elegir(TEMAS)}`);
    l.push('', '## Bloques');
    for (let d = 0; d < 5; d++) l.push(`- ${DIAS[d]} 09:00-17:30 | trabajo | Trabajo | plantilla${pasada ? ' | hecho: 0' : ''}`);
    for (const d of [0, 2, 4]) l.push(`- ${DIAS[d]} 18:00-19:30 | entreno | Gimnasio | plantilla${pasada && az.bool(0.8) ? ' | hecho: 0' : ''}`);
    for (let i = 0; i < az.entero(6, 12); i++) {
      const dia = az.entero(0, 6), inicio = (dia < 5 ? az.entero(39, 44) : az.entero(18, 40)) * 30, dur = az.elegir([60, 90, 120]);
      const tema = az.bool(0.7) ? az.elegir(TEMAS) : null;
      const sub = az.elegir(['aprender', 'repasar', 'simulacro']);
      const base = tema ? `estudio | ${tema} · ${sub === 'simulacro' ? 'simulacro' : az.elegir(['módulo', 'lab', 'lectura'])} | tipo: ${sub}` : `proyectos | ${az.elegir(PROYECTOS)} · avanzar`;
      const hecho = pasada && az.bool(0.75) ? ` | hecho: ${az.elegir(['0', '+30m', '-30m', '+1h'])}${tema && sub === 'simulacro' ? ` | nota: ${az.entero(50, 90)}` : ''}` : '';
      l.push(`- ${DIAS[dia]} ${hh(inicio)}-${hh(Math.min(1440, inicio + dur))} | ${base}${hecho}`);
    }
    l.push('', '## Estudio', ...TEMAS.slice(0, 3).map((t) => `- ${t}: ${az.entero(2, 7)} h`));
    if (pasada) {
      l.push('', '## Cierre', `- estudio: ${az.entero(5, 14)}/${az.entero(8, 14)} h · proyectos: 2/3 h · tareas: ${az.entero(5, 25)} · ánimo: ${az.entero(2, 4)},${az.entero(0, 9)}`);
      if (az.bool(0.6)) { l.push(`- funcionó: lección ${++lecciones} que funcionó`, `- cambio: lección ${lecciones} que cambio`); }
    }
    writeFileSync(join(dir, 'semanas', `${id}.md`), `${l.join('\n')}\n`);
  }
  // archivo: tareas hechas repartidas por meses
  const meses = {};
  for (let i = 0; i < tareasArchivadas; i++) {
    const dia = f.sumarDias(hoy, -az.entero(1, semanas * 7 - 7));
    (meses[dia.slice(0, 7)] ??= []).push(`- [x] Tarea archivada ${i} ${az.elegir(['revisar', 'llamar', 'comprar', 'escribir'])} | ${az.elegir(['trabajo', 'personal', 'estudio'])} | hecha: ${dia}`);
  }
  for (const [mes, ts] of Object.entries(meses)) writeFileSync(join(dir, 'archivo', `tareas-${mes}.md`), `# Tareas archivadas · ${mes}\n\n${ts.join('\n')}\n`);
  for (let i = 1; i <= diarios; i++) {
    const dia = f.sumarDias(hoy, -i);
    writeFileSync(join(dir, 'diario', `${dia}.md`), `- ánimo: ${az.entero(1, 5)}\n- línea: día ${i}, ${az.elegir(['bien', 'cansado', 'productivo', 'flojo'])}\n- avanzado: ${az.elegir(TEMAS)}; ${az.elegir(PROYECTOS)}\n- mañana: seguir con ${az.elegir(TEMAS)}\n`);
  }
  writeFileSync(join(dir, 'estudio.md'), `# Estudio\n${TEMAS.map((t) => `\n## ${t}\n- horas_semana: ${az.entero(2, 6)}\n- examen: 2027-0${az.entero(1, 6)}-15\n- inicio: ${f.sumarDias(hoy, -semanas * 7)}\n- total: ${az.entero(80, 300)}\n- simulacros: ${Array.from({ length: 12 }, (_, j) => `${az.entero(50, 90)} @${f.sumarDias(hoy, -(12 - j) * 30)}`).join(', ')}\n`).join('')}`);
  writeFileSync(join(dir, 'proyectos.md'), `# Proyectos\n${PROYECTOS.map((p) => `\n## ${p}\n- siguiente: paso de ${p}\n- estado: ${az.bool(0.8) ? 'activo' : 'pausado'}\n- actualizado: ${f.sumarDias(hoy, -az.entero(0, 20))}\n`).join('')}`);
  return { semanas, tareasArchivadas, diarios, meses: Object.keys(meses).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(generar(process.argv[2], { hoy: process.argv[3] ?? '2026-11-02' }));
}

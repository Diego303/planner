// Proceso hijo de test/sigkill.test.js: crea, marca y archiva tareas sin parar sobre una carpeta hasta que lo matan.
// Uso: node test/sigkill-hijo.js <carpeta> <primer índice>. Escribe «creada <i>» cuando la tarea i ya está en disco.
import { crearStore } from '../src/server/store.js';
import { crearApi } from '../src/server/api.js';
import { crearDeshacer } from '../src/server/deshacer.js';
import { sumarDias } from '../src/core/fechas.js';
import * as m from '../src/core/modelo.js';

const [dir, desde] = [process.argv[2], Number(process.argv[3])];
const store = crearStore(dir);
store.limpiarTemporales();
const sinCopias = { antesDeEscribir() {}, async despuesDeEscribir() {} };
const api = crearApi({ store, copias: sinCopias, deshacer: crearDeshacer() });
const op = (cuerpo) => api.rutas['POST /api/op'](new URLSearchParams(), cuerpo);
process.stdout.write('listo\n');
for (let i = desde; ; i++) {
  const hoy = sumarDias('2026-01-01', i);
  await op({ op: 'dia.cerrar', hoy, args: { animo: 3, linea: `día ${i}` } }); // archiva la de ayer (otro fichero)
  const r = await op({ op: 'tarea.crear', hoy, args: { seccion: 'mas', tarea: { texto: `T${i} tarea de prueba` } } });
  process.stdout.write(`creada ${i}\n`);
  const t = m.tareasDe(r.estado.ficheros['tareas.md']).mas.find((x) => x.texto === `T${i} tarea de prueba`);
  await op({ op: 'tarea.marcar', hoy, args: { id: t.id, hecha: true } });
}

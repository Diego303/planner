// Servidor del planner en su propio proceso para medir su memoria sin mezclarla con la del que lo prueba.
// Uso: node --expose-gc test/rendimiento/servidor-medido.js <datos> <hoy>. Escribe «listo <puerto>»; con cada
// línea «medir» en la entrada, fuerza el GC y escribe «heap <bytes>».
import { createInterface } from 'node:readline';
import { arrancar } from '../../src/server/index.js';

const [datos, hoy] = process.argv.slice(2);
const app = await arrancar({ datos, puerto: 0, hoySimulado: hoy });
process.stdout.write(`listo ${app.puerto}\n`);
createInterface({ input: process.stdin }).on('line', (l) => {
  if (l.trim() !== 'medir') return;
  globalThis.gc?.();
  process.stdout.write(`heap ${process.memoryUsage().heapUsed}\n`);
});
process.stdin.on('end', async () => { await app.cerrar(); process.exit(0); });

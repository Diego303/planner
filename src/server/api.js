// Rutas /api/*: estado, versión para el sondeo, operaciones con concurrencia optimista y deshacer.
import { aplicar, ErrorOp, FaltaFichero, existeOp } from '../core/ops.js';
import { serializar } from '../core/formato/index.js';
import { esFecha, fechaDe, esSemana, sumarSemanas, semanaDe, diasDeSemana } from '../core/fechas.js';
import { listaSemanas, prepararCierre } from '../core/semanas.js';
import { valoresAjustes, tiposDe } from '../core/modelo.js';
import { FicheroIgnorado } from './store.js';
import { construirEstado, contexto, todasLasSemanas, FIJOS } from './estado.js';

export class ErrorHttp extends Error {
  constructor(estado, mensaje, extra = {}) { super(mensaje); this.estado = estado; this.extra = extra; }
}

export function crearApi({ store, copias, deshacer, hoySimulado = null, extrasContexto = [], metricas = [] }) {
  // Las operaciones se aplican de una en una: así cada fichero tiene una única escritura en curso.
  let cola = Promise.resolve();
  const enSerie = (fn) => {
    const p = cola.then(fn, fn);
    cola = p.catch(() => {});
    return p;
  };

  const hoyServidor = () => hoySimulado ?? fechaDe(new Date());
  // La fecha simulada (--hoy) manda sobre la del navegador.
  const leerHoy = (v) => hoySimulado ?? (esFecha(v) ? v : hoyServidor());
  const leerAhora = (v) => (Number.isInteger(v) && v >= 0 && v < 1440 ? v : null);

  async function modoCopias() {
    return valoresAjustes((await store.leerSeguro('ajustes.md')).doc).copias;
  }

  /** Aplica una operación cargando bajo demanda los ficheros que pida; comprueba versiones; escribe. */
  async function ejecutar(peticion, versionesCliente, ctxBase) {
    if (!existeOp(peticion.op)) throw new ErrorHttp(422, `Operación desconocida: ${peticion.op}`);
    const ctx = await contexto(store, ctxBase, extrasContexto);
    const mundo = { ficheros: {} }, leidas = {};
    // Precarga en paralelo lo que casi todas las operaciones leen; el resto se pide bajo demanda.
    const probables = [...FIJOS, ...(esSemana(peticion.args?.semana) ? [`semanas/${peticion.args.semana}.md`] : [])];
    const precargados = await Promise.all(probables.map((r) => store.leer(r).catch(() => null)));
    probables.forEach((r, i) => { if (precargados[i]) { mundo.ficheros[r] = precargados[i].doc; leidas[r] = precargados[i].version; } });
    let res;
    for (let intento = 0; !res; intento++) {
      if (intento > 200) throw new Error('demasiados ficheros en una operación');
      try { res = aplicar(mundo, peticion, ctx); } catch (e) {
        if (!(e instanceof FaltaFichero)) throw e;
        const r = await store.leer(e.ruta);
        mundo.ficheros[e.ruta] = r.doc;
        leidas[e.ruta] = r.version;
      }
    }
    for (const ruta of res.tocados) {
      if (versionesCliente && Object.hasOwn(versionesCliente, ruta) && (versionesCliente[ruta] ?? null) !== (leidas[ruta] ?? null)) {
        throw new ErrorHttp(409, 'Cambiaste el fichero fuera del planner, recargado', { ruta });
      }
    }
    const cambiados = res.tocados.filter((ruta) => {
      const antes = mundo.ficheros[ruta], despues = res.mundo.ficheros[ruta];
      if (antes == null || despues == null) return antes !== despues;
      return serializar(antes) !== serializar(despues);
    });
    const versiones = {};
    if (cambiados.length) {
      // La carpeta solo se crea cuando el usuario lo pide en el onboarding.
      if (!store.existe() && peticion.op === 'datos.inicializar') store.crearCarpeta();
      if (!store.existe()) throw new ErrorHttp(422, 'La carpeta de datos no existe');
      const modo = await modoCopias();
      try { copias.antesDeEscribir(modo, peticion.op); } catch (e) { console.error('copia:', e.message); }
      for (const ruta of cambiados) versiones[ruta] = await store.escribir(ruta, res.mundo.ficheros[ruta]);
      await copias.despuesDeEscribir(modo, peticion.op, ctx);
    }
    const inversaId = cambiados.length ? deshacer.guardar(res.inversa, versiones, peticion.op) : null;
    return { inversaId, resultado: res.resultado, cambiados };
  }

  const ctxDe = (cuerpo) => ({ hoy: leerHoy(cuerpo.hoy), ahora: leerAhora(cuerpo.ahora) });
  const estadoPara = (ctx, semana) => construirEstado(store, { ...ctx, semana, hoySimulado, metricas });

  async function traducirErrores(fn) {
    try { return await fn(); } catch (e) {
      if (e instanceof ErrorOp) throw new ErrorHttp(422, e.message);
      if (e instanceof FicheroIgnorado) throw new ErrorHttp(422, `${e.ruta} está ignorado: ${e.motivo}`);
      throw e;
    }
  }

  const rutas = {
    'GET /api/salud': async () => ({ app: 'planner', datos: store.raiz, pid: process.pid }),
    'GET /api/version': async (q) => ({ version: await store.versionGlobal(leerHoy(q.get('hoy'))) }),
    'GET /api/estado': async (q) => estadoPara({ hoy: leerHoy(q.get('hoy')), ahora: leerAhora(Number(q.get('ahora'))) }, q.get('semana')),
    'GET /api/semanas': async (q) => {
      const hoy = leerHoy(q.get('hoy'));
      const actual = semanaDe(hoy);
      const desde = esSemana(q.get('desde')) ? q.get('desde') : sumarSemanas(actual, -4);
      const hasta = esSemana(q.get('hasta')) ? q.get('hasta') : sumarSemanas(actual, 5);
      if (desde > hasta) throw new ErrorHttp(400, 'Rango de semanas no válido');
      return { semanas: listaSemanas(desde, hasta, await todasLasSemanas(store), actual) };
    },
    'GET /api/cierre': async (q) => {
      const hoy = leerHoy(q.get('hoy'));
      const id = q.get('semana');
      if (!esSemana(id)) throw new ErrorHttp(400, 'Semana no válida');
      const docsSemanas = await todasLasSemanas(store);
      const leer = async (r) => (await store.leerSeguro(r)).doc;
      const dias = diasDeSemana(id);
      const meses = [...new Set([dias[0].slice(0, 7), dias[6].slice(0, 7)])];
      const tareasDoc = await leer('tareas.md');
      const ctx = await contexto(store, { hoy }, extrasContexto);
      const diarios = Object.fromEntries(await Promise.all(dias.map(async (f) => [f, await leer(`diario/${f}.md`)])));
      return prepararCierre({
        id, actual: semanaDe(hoy), hoy, docsSemanas, tipos: tiposDe(await leer('tipos.md')),
        tareasDocs: [tareasDoc, ...(await Promise.all(meses.map((m) => leer(`archivo/tareas-${m}.md`))))].filter(Boolean),
        tareasDoc, estudioDoc: await leer('estudio.md'), proyectosDoc: await leer('proyectos.md'), inboxDoc: await leer('inbox.md'),
        diarios, factores: ctx.factores ?? {},
      });
    },
    'POST /api/op': (_q, cuerpo) => enSerie(() => traducirErrores(async () => {
      if (typeof cuerpo.op !== 'string') throw new ErrorHttp(400, 'Falta la operación');
      const ctx = ctxDe(cuerpo);
      const r = await ejecutar({ op: cuerpo.op, args: cuerpo.args ?? {} }, cuerpo.versiones ?? null, ctx);
      return { ok: true, ...r, estado: await estadoPara(ctx, cuerpo.semana) };
    })),
    'POST /api/deshacer': (_q, cuerpo) => enSerie(() => traducirErrores(async () => {
      const entrada = deshacer.tomar(cuerpo.inversaId);
      if (!entrada) throw new ErrorHttp(410, 'Ya no se puede deshacer');
      const ctx = ctxDe(cuerpo);
      try {
        const r = await ejecutar(entrada.inversa, entrada.versiones, ctx);
        return { ok: true, ...r, estado: await estadoPara(ctx, cuerpo.semana) };
      } catch (e) {
        if (e.estado === 409) throw new ErrorHttp(409, 'No se puede deshacer: el fichero cambió después', e.extra);
        throw e;
      }
    })),
  };

  return { rutas, ejecutar, hoyServidor };
}

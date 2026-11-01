// Rutas /api/*: estado, versión para el sondeo, operaciones con concurrencia optimista y deshacer.
import { aplicar, ErrorOp, FaltaFichero, existeOp, esOpPublica } from '../core/ops.js';
import { serializar } from '../core/formato/index.js';
import { esFecha, fechaDe, esSemana, sumarSemanas, semanaDe, diasDeSemana } from '../core/fechas.js';
import { listaSemanas, prepararCierre } from '../core/semanas.js';
import { valoresAjustes, tiposDe } from '../core/modelo.js';
import { FicheroIgnorado, ErrorEscritura, ConflictoEscritura } from './store.js';
import { construirEstado, contexto, todasLasSemanas, FIJOS } from './estado.js';

export class ErrorHttp extends Error {
  constructor(estado, mensaje, extra = {}) { super(mensaje); this.estado = estado; this.extra = extra; }
}

/** Errores del disco en palabras claras (sin rutas absolutas). En todos, la operación no ha cambiado nada. */
export function errorDeEscritura(e) {
  // si ni siquiera se pudo volver atrás, se dice tal cual
  const nada = e.parcial ? 'Puede haber quedado a medias: tienes la copia de hoy en .copias/.' : 'No se ha guardado nada.';
  switch (e.code) {
    case 'ENOSPC': return new ErrorHttp(507, `No queda espacio en el disco (${e.ruta}). ${nada}`);
    case 'EACCES': case 'EPERM': case 'EROFS': return new ErrorHttp(500, `No se pudo guardar ${e.ruta}: no hay permiso de escritura. ${nada}`);
    case 'ENOENT': return new ErrorHttp(500, `No se pudo guardar ${e.ruta}: la carpeta de datos ya no existe o se ha movido. ${nada}`);
    default: return new ErrorHttp(500, `No se pudo guardar ${e.ruta} (${e.code ?? 'error del disco'}). ${nada}`);
  }
}

const MOTIVO_COPIA = { ENOSPC: 'no queda espacio en el disco', EACCES: 'sin permiso de escritura', EPERM: 'sin permiso de escritura', EROFS: 'disco de solo lectura' };
const mensajeCopia = (e) => `No se pudo hacer la copia de seguridad de hoy (${MOTIVO_COPIA[e.code] ?? e.code ?? 'error del disco'}). Lo demás se ha guardado; se reintentará en el próximo cambio.`;

export function crearApi({ store, copias, deshacer, hoySimulado = null, extrasContexto = [], metricas = [] }) {
  // Las operaciones se aplican de una en una: así cada fichero tiene una única escritura en curso.
  let cola = Promise.resolve();
  const enSerie = (fn) => {
    const p = cola.then(fn, fn);
    cola = p.catch(() => {});
    return p;
  };

  // Aviso de la última copia fallida: sale en la banda de avisos hasta que una copia salga bien.
  let avisoCopia = null;

  const hoyServidor = () => hoySimulado ?? fechaDe(new Date());
  // La fecha simulada (--hoy) manda sobre la del navegador.
  const leerHoy = (v) => hoySimulado ?? (esFecha(v) ? v : hoyServidor());
  const leerAhora = (v) => (Number.isInteger(v) && v >= 0 && v < 1440 ? v : null);

  async function modoCopias() {
    return valoresAjustes((await store.leerSeguro('ajustes.md')).doc).copias;
  }

  /** Aplica una operación cargando bajo demanda los ficheros que pida; comprueba versiones; escribe. */
  async function ejecutar(peticion, versionesCliente, ctxBase, { interna = false } = {}) {
    if (!(interna ? existeOp(peticion.op) : esOpPublica(peticion.op))) throw new ErrorHttp(422, `Operación desconocida: ${peticion.op}`);
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
    let aviso = null;
    if (cambiados.length) {
      // La carpeta solo se crea cuando el usuario lo pide en el onboarding.
      if (!store.existe() && peticion.op === 'datos.inicializar') store.crearCarpeta();
      if (!store.existe()) throw new ErrorHttp(422, 'La carpeta de datos no existe');
      const modo = await modoCopias();
      // Si la copia falla se guarda igual (no copiar no debe impedir trabajar), pero el usuario lo sabe.
      // (y si la copia del día está en marcha, antes guarda en ella la versión de ahora de lo que se va a escribir)
      try { await copias.antesDeEscribir(modo, peticion.op, cambiados); avisoCopia = null; } catch (e) {
        console.error('copia:', e);
        aviso = avisoCopia = mensajeCopia(e);
      }
      // todos o ninguno: si falla uno, no se escribe nada
      const doc = (ruta) => res.mundo.ficheros[ruta];
      // y sin pisar lo que se haya editado fuera desde que se leyó (esperada = versión leída)
      Object.assign(versiones, await store.escribirVarios(cambiados.map((ruta) => ({
        ruta, texto: doc(ruta) == null ? null : serializar(doc(ruta)), esperada: leidas[ruta] ?? null,
      }))));
      await copias.despuesDeEscribir(modo, peticion.op, ctx);
    }
    const inversaId = cambiados.length ? deshacer.guardar(res.inversa, versiones, peticion.op) : null;
    return { inversaId, resultado: res.resultado, cambiados, ...(aviso ? { aviso } : {}) };
  }

  const ctxDe = (cuerpo) => ({ hoy: leerHoy(cuerpo.hoy), ahora: leerAhora(cuerpo.ahora) });
  const estadoPara = async (ctx, semana) => {
    const e = await construirEstado(store, { ...ctx, semana, hoySimulado, metricas });
    // el fallo de una copia en segundo plano también se enseña (hasta que una sale bien)
    const fallo = avisoCopia ?? (copias.error?.() ? mensajeCopia(copias.error()) : null);
    if (fallo) e.meta.avisos = [...e.meta.avisos, fallo];
    return e;
  };

  async function traducirErrores(fn) {
    try { return await fn(); } catch (e) {
      if (e instanceof ErrorOp) throw new ErrorHttp(422, e.message);
      if (e instanceof FicheroIgnorado) throw new ErrorHttp(422, `${e.ruta} está ignorado: ${e.motivo}`);
      if (e instanceof ErrorEscritura) throw errorDeEscritura(e);
      if (e instanceof ConflictoEscritura) throw new ErrorHttp(409, 'Cambiaste el fichero fuera del planner, recargado', { ruta: e.ruta });
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
      return { semanas: listaSemanas(desde, hasta, await todasLasSemanas(store, hoy), actual) };
    },
    'GET /api/cierre': async (q) => {
      const hoy = leerHoy(q.get('hoy'));
      const id = q.get('semana');
      if (!esSemana(id)) throw new ErrorHttp(400, 'Semana no válida');
      const docsSemanas = await todasLasSemanas(store, hoy);
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
        const r = await ejecutar(entrada.inversa, entrada.versiones, ctx, { interna: true });
        return { ok: true, ...r, estado: await estadoPara(ctx, cuerpo.semana) };
      } catch (e) {
        if (e.estado === 409) throw new ErrorHttp(409, 'No se puede deshacer: el fichero cambió después', e.extra);
        throw e;
      }
    })),
  };

  /** Al arrancar: la copia del día empieza ya, en segundo plano, con los datos aún sin tocar. */
  async function alArrancar() {
    if (!store.existe()) return;
    try { if ((await modoCopias()) === 'diaria') copias.empezar?.(); } catch { /* sin ajustes legibles: ya se copiará al escribir */ }
    // y la caché se llena ya: la primera página que abra el navegador no espera a leer años de semanas
    try { await rutas['GET /api/estado'](new URLSearchParams()); } catch { /* lo dirá la primera petición de verdad */ }
  }

  return { rutas, ejecutar, hoyServidor, alArrancar };
}

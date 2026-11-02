// «Apunta algo» sin IA (§3 Captura): reglas fijas sobre el texto.
//   #área (prefijo de un tipo) · hoy | mañana | lun…dom | dd/mm · ! (prioridad) · 45m | 2h | 1h30 · algún día
// Lo que queda es el título. Si queda vacío, no se guarda.
import { normalizar } from './formato/comun.js';
import { parsearDuracion, sumarDias, diaSemana, esFecha, diaCorto, fechaCorta, diasEntre } from './fechas.js';

const DIAS_SEMANA = [['lun', 'lunes'], ['mar', 'martes'], ['mie', 'miercoles'], ['jue', 'jueves'], ['vie', 'viernes'], ['sab', 'sabado'], ['dom', 'domingo']];

/** Fecha de un token de fecha relativo a `hoy`, o null. */
export function fechaDeToken(token, hoy) {
  const t = normalizar(token);
  if (t === 'hoy') return hoy;
  if (t === 'manana') return sumarDias(hoy, 1);
  const i = DIAS_SEMANA.findIndex(([corto, largo]) => t === corto || t === largo);
  if (i >= 0) return sumarDias(hoy, (i - diaSemana(hoy) + 7) % 7);
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (m) {
    // la próxima vez que llegue ese día (el 29/02 de un año no bisiesto, el del siguiente bisiesto)
    const año = +hoy.slice(0, 4);
    const f = (a) => `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    for (let a = año; a <= año + 8; a++) if (esFecha(f(a)) && f(a) >= hoy) return f(a);
    return null;
  }
  return null;
}

const RE_FECHA = /^(hoy|ma[ñn]ana|lun(es)?|mar(tes)?|mi[eé](rcoles)?|jue(ves)?|vie(rnes)?|s[aá]b(ado)?|dom(ingo)?|\d{1,2}\/\d{1,2})$/i;

/**
 * Analiza el texto de la captura.
 * → { titulo, tipo, fecha, prioridad, dur, algunDia }
 */
export function parsearCaptura(texto, { tipos = [], hoy }) {
  const r = { titulo: '', tipo: null, fecha: null, prioridad: false, dur: null, algunDia: false };
  let s = ` ${String(texto ?? '')} `.replace(/\s+/g, ' ');
  s = s.replace(/ alg[uú]n d[ií]a(?= )/i, () => { r.algunDia = true; return ' '; });
  const palabras = s.trim().split(' ').filter(Boolean);
  const resto = [];
  for (const p of palabras) {
    if (!r.tipo && /^#[\p{L}\d_-]+$/u.test(p)) {
      const pref = normalizar(p.slice(1));
      const tipo = tipos.find((t) => normalizar(t.nombre).startsWith(pref));
      if (tipo) { r.tipo = tipo.nombre; continue; }
    }
    if (!r.prioridad && p === '!') { r.prioridad = true; continue; }
    if (r.dur == null && /^\d{1,3}(h(\d{1,2}(m|min)?)?|m|min)$/i.test(p)) {
      const d = parsearDuracion(p);
      if (d) { r.dur = d; continue; }
    }
    if (!r.fecha && RE_FECHA.test(p)) {
      const f = fechaDeToken(p, hoy);
      if (f) { r.fecha = f; continue; }
    }
    resto.push(p);
  }
  r.titulo = resto.join(' ').trim();
  return r;
}

/** Destino: 'algun' si lo pone; 'hoy' si fecha = hoy o (sin fecha y sin área) y hay hueco; si no, 'mas'. */
export function destinoCaptura(r, { hoy, abiertasHoy, limite }) {
  if (r.algunDia) return 'algun';
  const hayHueco = abiertasHoy < limite;
  if ((r.fecha === hoy || (!r.fecha && !r.tipo)) && hayHueco) return 'hoy';
  return 'mas';
}

export const NOMBRE_DESTINO = { hoy: 'Hoy', mas: 'Más adelante', algun: 'Algún día' };

/** La tarea que se guarda (la fecha de hoy no se escribe si va a Hoy). */
export function tareaDeCaptura(r, destino, hoy) {
  return {
    texto: r.titulo, tipo: r.tipo, prioridad: r.prioridad, dur: r.dur,
    fecha: r.fecha && !(destino === 'hoy' && r.fecha === hoy) ? r.fecha : null,
  };
}

/** Texto corto de una fecha para chips y listas: hoy, mañana, mar 3, 12 dic. */
export function etiquetaFecha(fecha, hoy) {
  if (fecha === hoy) return 'hoy';
  if (fecha === sumarDias(hoy, 1)) return 'mañana';
  const dias = diasEntre(hoy, fecha);
  return dias > 0 && dias < 7 ? diaCorto(fecha) : fechaCorta(fecha);
}

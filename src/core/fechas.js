// Fechas, semanas ISO y horas. Puro: nunca lee el reloj.
// Fechas como texto 'AAAA-MM-DD'; la aritmética se hace en UTC para que el cambio de hora no mueva días.
// Horas como minutos desde las 00:00 (enteros exactos, sin decimales flotantes).

export const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const DIA_MS = 86400000;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_SEMANA = /^(\d{4})-W(\d{2})$/;

const dos = (n) => String(n).padStart(2, '0');

export function esFecha(texto) {
  const m = RE_FECHA.exec(texto ?? '');
  if (!m) return false;
  const [a, mes, d] = [+m[1], +m[2], +m[3]];
  if (mes < 1 || mes > 12 || d < 1) return false;
  return deUTC(Date.UTC(a, mes - 1, d)) === texto;
}

export function aUTC(fecha) {
  const m = RE_FECHA.exec(fecha);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function deUTC(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

/** Fecha local de un objeto Date (para el navegador o el servidor, nunca dentro del core). */
export function fechaDe(date) {
  return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
}

export const sumarDias = (fecha, n) => deUTC(aUTC(fecha) + n * DIA_MS);
export const diasEntre = (desde, hasta) => Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS);
/** 0 = lunes … 6 = domingo */
export const diaSemana = (fecha) => (new Date(aUTC(fecha)).getUTCDay() + 6) % 7;

// ---------- Semanas ISO ----------

function lunesSemana1(año) {
  const ene4 = Date.UTC(año, 0, 4);
  const dow = (new Date(ene4).getUTCDay() + 6) % 7;
  return ene4 - dow * DIA_MS;
}

export function esSemana(id) {
  const m = RE_SEMANA.exec(id ?? '');
  return !!m && +m[2] >= 1 && +m[2] <= semanasDelAño(+m[1]);
}

/** Identificador ISO 'AAAA-Www' de una fecha. El año es el ISO (puede no coincidir con el natural). */
export function semanaDe(fecha) {
  const ms = aUTC(fecha);
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  const jueves = ms + (3 - dow) * DIA_MS;
  const año = new Date(jueves).getUTCFullYear();
  const n = Math.floor((ms - dow * DIA_MS - lunesSemana1(año)) / (7 * DIA_MS)) + 1;
  return `${año}-W${dos(n)}`;
}

export function semanasDelAño(año) {
  return +semanaDe(`${año}-12-28`).slice(6);
}

export function lunesDe(id) {
  const m = RE_SEMANA.exec(id);
  return deUTC(lunesSemana1(+m[1]) + (+m[2] - 1) * 7 * DIA_MS);
}

export const fechaDeDia = (id, dia) => sumarDias(lunesDe(id), dia);
export const diasDeSemana = (id) => DIAS.map((_, i) => fechaDeDia(id, i));
export const sumarSemanas = (id, n) => semanaDe(sumarDias(lunesDe(id), 7 * n));
export const semanasEntre = (desde, hasta) => Math.round(diasEntre(lunesDe(desde), lunesDe(hasta)) / 7);
export const numeroSemana = (id) => +id.slice(6);
/** <0 si a es anterior, 0 si es la misma, >0 si es posterior (el formato ordena bien como texto). */
export const compararSemanas = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- Horas (minutos) ----------

const RE_HORA = /^(\d{1,2}):(\d{2})$/;

export function aMinutos(hora) {
  const m = RE_HORA.exec((hora ?? '').trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** 570 → '09:30' (forma canónica de fichero) */
export const deMinutos = (min) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;
/** 570 → '9:30' (forma de pantalla, como en la maqueta) */
export const horaCorta = (min) => `${Math.floor(min / 60)}:${dos(min % 60)}`;

/** '09:00-17:30' (o con –) → { inicio, fin } en minutos; null si no es válido o fin ≤ inicio. */
export function parsearRango(texto) {
  const m = /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec((texto ?? '').trim());
  if (!m) return null;
  const inicio = aMinutos(m[1]), fin = aMinutos(m[2]);
  if (inicio == null || fin == null || fin <= inicio || inicio >= 24 * 60) return null;
  return { inicio, fin };
}

export const formatoRango = (inicio, fin) => `${deMinutos(inicio)}-${deMinutos(fin)}`;

/** '45m' | '2h' | '1h30' | '1h30m' | '90min' → minutos */
export function parsearDuracion(texto) {
  const t = (texto ?? '').trim().toLowerCase();
  let m = /^(\d+)\s*h(?:\s*(\d{1,2})\s*(?:m|min)?)?$/.exec(t);
  if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
  m = /^(\d+)\s*(?:m|min)$/.exec(t);
  if (m) return +m[1];
  return null;
}

export function formatoDuracion(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h${dos(m)}` : `${h}h`;
}

/** 'hecho:' → '0' | '+30m' | '-30m' | '+1h' … en minutos */
export function parsearDelta(texto) {
  const t = (texto ?? '').trim();
  if (/^[+-]?0$/.test(t)) return 0;
  const m = /^([+-])(.+)$/.exec(t);
  if (!m) return null;
  const d = parsearDuracion(m[2]);
  return d == null ? null : (m[1] === '-' ? -d : d);
}

export function formatoDelta(min) {
  if (!min) return '0';
  return (min < 0 ? '-' : '+') + formatoDuracion(Math.abs(min));
}

// ---------- Textos de pantalla ----------

/** 1.5 → '1,5' · 2 → '2' (una cifra decimal como máximo) */
export function numero(n, decimales = 1) {
  const f = 10 ** decimales;
  return String(Math.round(n * f) / f).replace('.', ',');
}

/** minutos → '1,5' horas */
export const horas = (min) => numero(min / 60);

/**
 * Columnas de la vista de una semana ISO: lunes → domingo, o con `inicio = 'domingo'` el domingo anterior
 * (que pertenece a la semana ISO anterior) y de lunes a sábado. → [{ semana, dia, fecha }]
 */
export function columnasSemana(id, inicio = 'lunes') {
  const dias = DIAS.map((_, dia) => ({ semana: id, dia, fecha: fechaDeDia(id, dia) }));
  if (inicio !== 'domingo') return dias;
  const previa = sumarSemanas(id, -1);
  return [{ semana: previa, dia: 6, fecha: fechaDeDia(previa, 6) }, ...dias.slice(0, 6)];
}

/** '2026-11-01', '2026-11-07' → '1 – 7 nov' */
export function rangoFechas(a, b) {
  const [ma, mb] = [+a.slice(5, 7) - 1, +b.slice(5, 7) - 1];
  return `${+a.slice(8)}${ma !== mb ? ' ' + MESES_CORTOS[ma] : ''} – ${+b.slice(8)} ${MESES_CORTOS[mb]}`;
}

/** '2026-W45' → '2 – 8 nov' · '2026-W53' → '28 dic – 3 ene' */
export function rangoSemana(id) {
  const a = lunesDe(id), b = sumarDias(a, 6);
  const [ma, mb] = [+a.slice(5, 7) - 1, +b.slice(5, 7) - 1];
  return `${+a.slice(8)}${ma !== mb ? ' ' + MESES_CORTOS[ma] : ''} – ${+b.slice(8)} ${MESES_CORTOS[mb]}`;
}

/** '2026-11-02' → 'lunes 2 de noviembre' */
export const fechaLarga = (fecha) =>
  `${NOMBRES_DIA[diaSemana(fecha)]} ${+fecha.slice(8)} de ${MESES[+fecha.slice(5, 7) - 1]}`;

/** '2026-12-12' → '12 dic' */
export const fechaCorta = (fecha) => `${+fecha.slice(8)} ${MESES_CORTOS[+fecha.slice(5, 7) - 1]}`;

/** '2026-11-03' → 'mar 3' */
export const diaCorto = (fecha) => `${DIAS_CORTOS[diaSemana(fecha)]} ${+fecha.slice(8)}`;

export const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

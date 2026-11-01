// Piezas comunes de todos los formatos Markdown.
//
// Un documento es { tipo, lineas, bom, eol, finalNL }. Cada línea del fichero es un objeto de `lineas`:
//   { t: 'vacia' } · { t: 'h1', texto } · { t: 'h2', texto, seccion } · { t: '?' } (no reconocida)
//   o un elemento del formato ({ t: 'bloque', … }, { t: 'tarea', … }…).
// Las líneas leídas guardan `_raw` (texto original) y `_canon` (su forma canónica al leerlas):
// al escribir, si la forma canónica no ha cambiado se escribe `_raw` tal cual.

export function nuevoDoc(tipo, lineas = []) {
  return { tipo, lineas, bom: false, eol: '\n', finalNL: true };
}

/**
 * Parte el texto en líneas recordando BOM, salto final y el fin de línea de cada una: un fichero con CRLF y
 * LF mezclados (Bloc de notas + otro editor) se vuelve a escribir con los mismos bytes.
 */
export function partirTexto(texto) {
  let bom = false;
  if (texto.charCodeAt(0) === 0xfeff) { bom = true; texto = texto.slice(1); }
  if (texto === '') return { lineas: [], fines: [], bom, eol: '\n', finalNL: true };
  const lineas = [], fines = [];
  const re = /\r?\n/g;
  let desde = 0, m;
  while ((m = re.exec(texto))) {
    lineas.push(texto.slice(desde, m.index));
    fines.push(m[0]);
    desde = re.lastIndex;
  }
  const finalNL = desde === texto.length;
  if (!finalNL) { lineas.push(texto.slice(desde)); fines.push(''); }
  // fin de línea del documento: el más frecuente (el de las líneas nuevas)
  const crlf = fines.filter((f) => f === '\r\n').length, lf = fines.filter((f) => f === '\n').length;
  return { lineas, fines, bom, eol: crlf > lf ? '\r\n' : '\n', finalNL };
}

/** Documento a partir de las líneas clasificadas; las que no usan el fin de línea del documento lo guardan en `_fin`. */
export function documento(tipo, p, lineas) {
  lineas.forEach((l, i) => { if (p.fines[i] && p.fines[i] !== p.eol) l._fin = p.fines[i]; });
  return { tipo, lineas, bom: p.bom, eol: p.eol, finalNL: p.finalNL };
}

export function unirTexto(doc, textos) {
  const n = textos.length;
  let out = doc.bom ? '\ufeff' : '';
  textos.forEach((t, i) => {
    const fin = doc.lineas[i]?._fin ?? doc.eol;
    out += t + (i < n - 1 || doc.finalNL ? fin : '');
  });
  return out;
}

export function canonComun(l) {
  switch (l.t) {
    case 'vacia': return '';
    case 'h1': return `# ${l.texto}`;
    case 'h2': return `## ${l.texto}`;
    default: return null;
  }
}

export function textoDeLinea(l, canon) {
  if (l.t === '?') return l._raw;
  const c = canon(l);
  return l._raw != null && c === l._canon ? l._raw : c;
}

export function serializarDoc(doc, canon) {
  return unirTexto(doc, doc.lineas.map((l) => textoDeLinea(l, canon)));
}

export const desconocida = (raw, extra = {}) => ({ t: '?', _raw: raw, ...extra });

/**
 * Clasifica las líneas de un fichero por secciones `## …`.
 *  - `seccionDe(texto)` → clave de sección o null (sección desconocida: su título y su contenido no se reconocen)
 *  - `enCabecera(raw, ctx)` → elemento antes de la primera sección o null
 *  - `enSeccion(raw, clave, ctx)` → elemento dentro de una sección o null
 * `ctx` es un objeto nuevo por sección, para detectar claves repetidas.
 */
export function clasificar(textos, { seccionDe, enCabecera = () => null, enSeccion = () => null, canon }) {
  let seccion = null, haySeccion = false, ctx = {};
  return textos.map((raw) => {
    let l;
    if (raw.trim() === '') {
      l = { t: 'vacia' };
    } else if (/^##[ \t]+\S/.test(raw)) {
      const texto = raw.replace(/^##[ \t]+/, '').trim();
      haySeccion = true;
      seccion = seccionDe(texto);
      ctx = {};
      if (seccion == null) return desconocida(raw, { h2: true });
      l = { t: 'h2', texto, seccion };
    } else if (/^#[ \t]+\S/.test(raw) && !haySeccion) {
      l = { t: 'h1', texto: raw.replace(/^#[ \t]+/, '').trim() };
    } else if (!haySeccion) {
      l = enCabecera(raw, ctx);
    } else if (seccion != null) {
      l = enSeccion(raw, seccion, ctx);
    }
    if (!l) return desconocida(raw);
    l._raw = raw;
    l._canon = canon(l);
    return l;
  });
}

// ---------- Texto ----------

/** minúsculas, sin tildes y con espacios simples: para comparar nombres */
export function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Limpia texto que viene de la UI para que nunca cree campos, comentarios ni líneas nuevas. */
export function limpiarTexto(s) {
  return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
}

// ---------- Líneas de lista y campos ----------

/** '- algo' o '* algo' → 'algo'; si no es elemento de lista, null */
export function elementoLista(raw) {
  const m = /^[-*][ \t]+(\S.*)$/.exec(raw);
  return m ? m[1] : null;
}

/** '[x] texto' → { hecha: true, resto: 'texto' } */
export function casilla(contenido) {
  const m = /^\[([ xX])\][ \t]+(\S.*)$/.exec(contenido);
  return m ? { hecha: m[1] !== ' ', resto: m[2] } : null;
}

/** Separa un comentario final «  # …». Con `laxo`, basta un espacio (para valores tipados). */
export function separarComentario(s, laxo = false) {
  const re = laxo ? /^(.*?\S)\s+(#(?:\s.*)?)$/ : /^(.*?\S)(?: {2,}|\t)\s*(#(?:\s.*)?)$/;
  const m = re.exec(s);
  return m ? { cuerpo: m[1], comentario: m[2].trimEnd() } : { cuerpo: s.trimEnd(), comentario: null };
}

export const conComentario = (texto, comentario) => (comentario ? `${texto}  ${comentario}` : texto);

export const dividirCampos = (s) => s.split('|').map((x) => x.trim());

/** 'clave: valor' → { clave (normalizada), valor }; si no, null */
export function claveValor(campo) {
  const m = /^([\p{L}][\p{L}\d_-]*)[ \t]*:[ \t]*(.*)$/u.exec(campo);
  return m ? { clave: normalizar(m[1]), valor: m[2].trim() } : null;
}

// ---------- Valores ----------

export function parsearNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export const formatoNumero = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

export function parsearEntero(texto, min, max) {
  const t = String(texto ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

/** Nota de simulacro o porcentaje: '71', '71%', '71 %' */
export function parsearNota(texto) {
  const m = /^(\d{1,3})\s*%?$/.exec(String(texto ?? '').trim());
  return m && +m[1] <= 100 ? +m[1] : null;
}

export function parsearSiNo(texto) {
  const n = normalizar(texto);
  return n === 'si' ? true : n === 'no' ? false : null;
}

/**
 * Formato de lista `- clave: valor` (ajustes, estudio, proyectos, diario, tema).
 * `claves` = { claveNormalizada: { parsear(texto) → valor|null, formato(valor) → texto, nombre, libre } }
 * Las claves repetidas en la misma sección (ctx) no se reconocen.
 */
export function lineaClaveValor(raw, claves, ctx) {
  const contenido = elementoLista(raw);
  if (contenido == null) return null;
  const kv = claveValor(separarComentario(contenido).cuerpo);
  if (!kv) return null;
  const def = claves[kv.clave];
  if (!def) return null;
  if (ctx.vistas?.has(kv.clave)) return null;
  // Texto libre: solo «  # …» es comentario. Valores tipados: también « # …».
  let { cuerpo, comentario } = separarComentario(contenido, !def.libre);
  let par = claveValor(cuerpo);
  let valor = par ? def.parsear(par.valor) : null;
  if (valor == null && !def.libre) {
    ({ cuerpo, comentario } = separarComentario(contenido));
    par = claveValor(cuerpo);
    valor = par ? def.parsear(par.valor) : null;
  }
  if (valor == null) return null;
  (ctx.vistas ??= new Set()).add(kv.clave);
  return { t: 'kv', clave: kv.clave, valor, comentario };
}

export function canonClaveValor(l, claves) {
  const def = claves[l.clave];
  return conComentario(`- ${def.nombre}: ${def.formato(l.valor)}`, l.comentario);
}

export const textoLibre = { parsear: (t) => (t.trim() ? t.trim() : null), formato: (v) => v, libre: true };

// Solapes → carriles (§4.1): grupos por intersección transitiva y carril mínimo libre dentro de cada grupo.

const seCruzan = (a, b) => a.inicio < b.fin && b.inicio < a.fin;

/**
 * Para los bloques de UN día devuelve, en el mismo orden, { carril, n, solapa }.
 * `n` = carriles del grupo. `solapa` = el bloque (no sugerido) se cruza con otro no sugerido:
 * las sugerencias ocupan carril para no taparse, pero no cuentan como solape.
 */
export function carriles(bloques) {
  const orden = bloques.map((b, i) => ({ b, i }))
    .sort((x, y) => x.b.inicio - y.b.inicio || y.b.fin - x.b.fin || x.i - y.i);
  const out = new Array(bloques.length);
  let grupo = [], finGrupo = -Infinity;
  const cerrar = () => {
    const finCarril = [];
    for (const { b, i } of grupo) {
      let c = finCarril.findIndex((f) => f <= b.inicio);
      if (c < 0) { c = finCarril.length; finCarril.push(b.fin); } else finCarril[c] = b.fin;
      out[i] = { carril: c, n: 0, solapa: false };
    }
    for (const { b, i } of grupo) {
      out[i].n = finCarril.length;
      out[i].solapa = !b.sugerido && grupo.some((o) => o.i !== i && !o.b.sugerido && seCruzan(o.b, b));
    }
    grupo = [];
    finGrupo = -Infinity;
  };
  for (const x of orden) {
    if (grupo.length && x.b.inicio >= finGrupo) cerrar();
    grupo.push(x);
    finGrupo = Math.max(finGrupo, x.b.fin);
  }
  if (grupo.length) cerrar();
  return out;
}

/** Número de pares de bloques no sugeridos que se solapan en la semana. */
export function contarSolapes(bloques) {
  let n = 0;
  const reales = bloques.filter((b) => !b.sugerido);
  for (let i = 0; i < reales.length; i++) {
    for (let j = i + 1; j < reales.length; j++) {
      if (reales[i].dia === reales[j].dia && seCruzan(reales[i], reales[j])) n++;
    }
  }
  return n;
}

export { seCruzan };

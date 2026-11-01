// Colores de tipo por tema y contraste WCAG. Es el único sitio con colores calculados:
// el resto de la interfaz usa tokens CSS.

export function hexARgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const rgbAHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Mezcla `a` sobre `b` con peso `t` (t = 1 → a). */
export function mezclar(a, b, t) {
  const [x, y] = [hexARgb(a), hexARgb(b)];
  return rgbAHex(x.map((v, i) => v * t + y[i] * (1 - t)));
}

export function luminancia(hex) {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexARgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [la, lb] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

export const AA = 4.5;

/** Acerca `texto` a `hacia` en pasos del 5 % hasta llegar al contraste pedido sobre `fondo`. */
export function ajustarContraste(texto, fondo, hacia, objetivo = AA) {
  let t = texto;
  for (let i = 1; i <= 20 && contraste(t, fondo) < objetivo; i++) t = mezclar(hacia, texto, i * 0.05);
  return t;
}

/** Blanco o negro, el que más contraste dé sobre `fondo` (texto de chips seleccionados). */
export const textoSobre = (fondo) => (contraste('#FFFFFF', fondo) >= contraste('#000000', fondo) ? '#FFFFFF' : '#000000');

/**
 * Colores de un bloque según el modo del tema (§ Temas del plan):
 *  claro: fondo = base al 11 % sobre la superficie, texto = base
 *  oscuro: fondo = base al 22 % sobre la superficie, texto = base mezclado un 45 % con blanco
 *  contraste: fondo = base al 35 %, texto blanco
 * El texto (o el fondo en alto contraste) se ajusta hasta cumplir AA (≥ 4,5:1).
 */
export function colorBloque(base, { modo = 'claro', superficie = '#FFFFFF' } = {}) {
  if (!hexARgb(base)) base = '#888780';
  if (!hexARgb(superficie)) superficie = modo === 'claro' ? '#FFFFFF' : '#1C201E';
  if (modo === 'contraste') {
    let fondo = mezclar(base, superficie, 0.35);
    for (let i = 1; i <= 20 && contraste('#FFFFFF', fondo) < AA; i++) fondo = mezclar('#000000', mezclar(base, superficie, 0.35), i * 0.05);
    return { fondo, texto: '#FFFFFF', borde: base };
  }
  if (modo === 'oscuro') {
    const fondo = mezclar(base, superficie, 0.22);
    return { fondo, texto: ajustarContraste(mezclar('#FFFFFF', base, 0.45), fondo, '#FFFFFF'), borde: mezclar('#FFFFFF', base, 0.45) };
  }
  const fondo = mezclar(base, superficie, 0.11);
  return { fondo, texto: ajustarContraste(base, fondo, '#000000'), borde: base };
}

/** Color de serie para gráficos y puntos: el base en claro, aclarado en oscuro. */
export function colorSerie(base, tema = {}) {
  const modo = tema.modo ?? 'claro', superficie = superficieDe(tema);
  if (!hexARgb(base)) base = '#888780';
  if (modo === 'claro') return ajustarContraste(base, superficie, '#000000', 3);
  return ajustarContraste(mezclar('#FFFFFF', base, 0.3), superficie, '#FFFFFF', 3);
}

const superficieDe = ({ modo = 'claro', superficie } = {}) => (hexARgb(superficie) ? superficie : modo === 'claro' ? '#FFFFFF' : '#1C201E');

/** Variante suave del color de un tipo (puntos, pistas de barras, zonas): `peso` del color sobre la superficie. */
export const tono = (base, tema, peso) => mezclar(colorSerie(hexARgb(base) ? base : '#888780', tema), superficieDe(tema), peso);

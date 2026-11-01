// Temas visuales: cuál se aplica (tema de temporada, personalizado) y el CSS del tema personalizado.
import { valoresTema, entidades, desconocidas } from './modelo.js';

export const TEMAS = [
  { id: 'nordico-claro', nombre: 'Nórdico claro' },
  { id: 'nordico-oscuro', nombre: 'Nórdico oscuro' },
  { id: 'automatico', nombre: 'Automático' },
  { id: 'papel', nombre: 'Papel' },
  { id: 'universo', nombre: 'Universo' },
  { id: 'halloween', nombre: 'Halloween' },
  { id: 'alto-contraste', nombre: 'Alto contraste' },
  { id: 'personalizado', nombre: 'Personalizado' },
];

/** ¿Es temporada de Halloween? (del 25 al 31 de octubre) */
export const esTemporadaHalloween = (hoy) => hoy.slice(5) >= '10-25' && hoy.slice(5) <= '10-31';

/** Declaraciones CSS del tema personalizado (los valores ya vienen saneados por el formato de tema.md). */
export function cssPersonalizado(temaDoc) {
  const { tokens } = valoresTema(temaDoc);
  return Object.entries(tokens).map(([k, v]) => `--${k}: ${v};`).join(' ');
}

/**
 * Atributos del <html> para un estado: { tema (el que lleva data-tema), personalizado, deco: 'sí'|'no', css }.
 * Con «personalizado» se usa su tema base y se sobrescriben sus tokens.
 */
export function atributosTema(ajustes, temaDoc, hoy) {
  let tema = ajustes.tema;
  if (ajustes.tema_temporada && esTemporadaHalloween(hoy)) tema = 'halloween';
  const personalizado = tema === 'personalizado';
  if (personalizado) tema = temaDoc ? valoresTema(temaDoc).base : 'nordico-claro';
  return { tema, personalizado, deco: ajustes.decoracion ? 'sí' : 'no', css: personalizado ? cssPersonalizado(temaDoc) : '' };
}

/** Si ajustes.md pide un tema que no existe, el aviso para enseñarlo (se usa Nórdico claro). */
export function avisoTemaDesconocido(ajustesDoc) {
  const linea = desconocidas(ajustesDoc).find((l) => /^[-*]\s*tema\s*:/i.test(l.texto));
  if (!linea) return null;
  const pedido = linea.texto.replace(/^[-*]\s*tema\s*:\s*/i, '').replace(/\s+#.*$/, '').trim();
  return `Tema «${pedido}» desconocido en ajustes.md: uso Nórdico claro`;
}

export const tieneTemaPersonal = (temaDoc) => entidades(temaDoc, 'kv').length > 0;

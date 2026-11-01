// Punto de composición: servidor + piezas del dominio (tema inicial, factores, métricas).
import { iniciarServidor } from './http.js';
import { valoresAjustes, tiposDe, temasEstudio, diarioDe } from '../core/modelo.js';
import { constancia, calcularProgreso } from '../core/progreso.js';
import { factores } from '../core/factor.js';
import { semanaDe } from '../core/fechas.js';

/** Inyecta el tema en <html> para que la primera pintura ya salga con él. */
async function temaInicial(html, store) {
  const ajustes = valoresAjustes((await store.leerSeguro('ajustes.md')).doc);
  return html.replace('<html lang="es"', `<html lang="es" data-tema="${ajustes.tema}"`);
}

/** Contexto de las operaciones: «lo que tardas de verdad» necesita las últimas 8 semanas. */
async function contextoFactores({ store, docs, hoy }) {
  const tipos = tiposDe((await store.leerSeguro('tipos.md')).doc);
  return { factores: factores(docs, tipos, semanaDe(hoy)) };
}

/** Métricas que necesitan todas las semanas (el navegador solo tiene las cercanas). */
function metricas({ docsSemanas, ficheros, actual, hoy }) {
  const tipos = tiposDe(ficheros['tipos.md']);
  const diarios = {};
  for (const [ruta, doc] of Object.entries(ficheros)) if (ruta.startsWith('diario/') && doc) diarios[ruta.slice(7, -3)] = diarioDe(doc);
  return {
    constancia: constancia(docsSemanas, tipos, actual),
    factores: factores(docsSemanas, tipos, actual),
    progreso: calcularProgreso({ docsSemanas, temas: temasEstudio(ficheros['estudio.md']), tipos, diarios, hoy, actual }),
  };
}

export function arrancar({ datos, puerto, hoySimulado = null }) {
  return iniciarServidor({ datos, puerto, hoySimulado, alServirIndex: temaInicial, extrasContexto: [contextoFactores], metricas: [metricas] });
}

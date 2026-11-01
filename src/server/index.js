// Punto de composición: servidor + piezas del dominio (tema inicial, métricas).
import { iniciarServidor } from './http.js';
import { valoresAjustes, tiposDe } from '../core/modelo.js';
import { constancia } from '../core/progreso.js';

/** Inyecta el tema en <html> para que la primera pintura ya salga con él. */
async function temaInicial(html, store) {
  const ajustes = valoresAjustes((await store.leerSeguro('ajustes.md')).doc);
  return html.replace('<html lang="es"', `<html lang="es" data-tema="${ajustes.tema}"`);
}

/** Métricas que necesitan todas las semanas (el navegador solo tiene las cercanas). */
function metricas({ docsSemanas, ficheros, actual }) {
  const tipos = tiposDe(ficheros['tipos.md']);
  return { constancia: constancia(docsSemanas, tipos, actual) };
}

export function arrancar({ datos, puerto, hoySimulado = null }) {
  return iniciarServidor({ datos, puerto, hoySimulado, alServirIndex: temaInicial, metricas: [metricas] });
}

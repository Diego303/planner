// Punto de composición: servidor + piezas del dominio (tema inicial, factores, métricas).
import { iniciarServidor } from './http.js';
import { valoresAjustes } from '../core/modelo.js';

/** Inyecta el tema en <html> para que la primera pintura ya salga con él. */
async function temaInicial(html, store) {
  const ajustes = valoresAjustes((await store.leerSeguro('ajustes.md')).doc);
  return html.replace('<html lang="es"', `<html lang="es" data-tema="${ajustes.tema}"`);
}

export function arrancar({ datos, puerto, hoySimulado = null }) {
  return iniciarServidor({ datos, puerto, hoySimulado, alServirIndex: temaInicial });
}

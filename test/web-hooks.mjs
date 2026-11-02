// Hook de resolución para cargar módulos de web/ en Node: en el navegador «/core/…» lo sirve el servidor desde src/core/.
const CORE = new URL('../src/core/', import.meta.url);
export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('/core/')) return siguiente(new URL(especificador.slice('/core/'.length), CORE).href, contexto);
  return siguiente(especificador, contexto);
}

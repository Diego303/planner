// Pila de inversas: el toast ofrece deshacer 10 s; aquí se guardan las 20 últimas.
import { randomUUID } from 'node:crypto';

export function crearDeshacer(maximo = 20) {
  const pila = [];
  return {
    /** Guarda la inversa junto con las versiones que deben tener los ficheros para poder aplicarla. */
    guardar(inversa, versiones, descripcion) {
      const id = randomUUID();
      pila.push({ id, inversa, versiones, descripcion });
      while (pila.length > maximo) pila.shift();
      return id;
    },
    tomar(id) {
      const i = pila.findIndex((e) => e.id === id);
      return i < 0 ? null : pila.splice(i, 1)[0];
    },
    get tamano() { return pila.length; },
  };
}

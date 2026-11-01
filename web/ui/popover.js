// Popover anclado a un elemento dentro de un contenedor posicionado (el editor de bloque).
let actual = null;

export const popoverAbierto = () => !!actual;

/** Coloca el popover a la derecha del ancla (o a la izquierda si no cabe) dentro del contenedor. */
export function abrirPopover(contenedor, ancla, contenido, { ancho = 280, alto = 470 } = {}) {
  cerrarPopover();
  const el = document.createElement('div');
  el.className = 'pop';
  el.setAttribute('role', 'dialog');
  el.innerHTML = String(contenido);
  contenedor.appendChild(el);
  colocar(el, contenedor, ancla, ancho, alto);
  actual = { el, contenedor, ancla };
  return el;
}

export function colocar(el, contenedor, ancla, ancho = 280, alto = 470) {
  const r = ancla.getBoundingClientRect(), w = contenedor.getBoundingClientRect();
  let left = r.right - w.left + 6;
  if (left + ancho + 5 > w.width) left = r.left - w.left - ancho - 6;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, Math.min(r.top - w.top - 10, w.height - alto))}px`;
}

export function cerrarPopover() {
  if (!actual) return false;
  actual.el.remove();
  actual = null;
  return true;
}

/** Sustituye el contenido sin moverlo. */
export function repintarPopover(contenido) {
  if (actual) actual.el.innerHTML = String(contenido);
  return actual?.el ?? null;
}

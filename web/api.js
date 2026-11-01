// Peticiones al servidor local. Los errores llevan el código HTTP (0 = servidor parado).

export class ErrorApi extends Error {
  constructor(estado, mensaje, datos = {}) { super(mensaje); this.estado = estado; this.datos = datos; }
}

async function pedir(metodo, ruta, cuerpo) {
  let r;
  try {
    r = await fetch(ruta, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ErrorApi(0, 'Servidor parado');
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(r.status, datos.error || `Error ${r.status}`, datos);
  return datos;
}

const query = (q) => new URLSearchParams(Object.entries(q).filter(([, v]) => v != null)).toString();

export const api = {
  estado: (q) => pedir('GET', `/api/estado?${query(q)}`),
  version: (q) => pedir('GET', `/api/version?${query(q)}`),
  semanas: (q) => pedir('GET', `/api/semanas?${query(q)}`),
  cierre: (q) => pedir('GET', `/api/cierre?${query(q)}`),
  op: (cuerpo) => pedir('POST', '/api/op', cuerpo),
  deshacer: (cuerpo) => pedir('POST', '/api/deshacer', cuerpo),
};

// F2: página «hola» que muestra el estado JSON. La aplicación real llega en F3.
import { fechaDe } from '/core/fechas.js';

const pre = document.getElementById('estado');
fetch(`/api/estado?hoy=${fechaDe(new Date())}`)
  .then((r) => r.json())
  .then((e) => { pre.textContent = JSON.stringify(e, null, 2); })
  .catch((e) => { pre.textContent = `No se pudo leer el estado: ${e.message}`; });

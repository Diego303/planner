// R3 · La caché de lectura no se deja engañar por una edición que deja igual el tamaño y la fecha de modificación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import * as m from '../src/core/modelo.js';
import { copiaEjemplo, apiDirecta } from './ayudas.js';

test('mismo tamaño y mtime restaurado: se lee el contenido nuevo', async () => {
  const { dir, borrar } = copiaEjemplo();
  try {
    const { store } = apiDirecta(dir);
    const ruta = join(dir, 'proyectos.md');
    const FECHA = 1_700_000_000; // segundos exactos: el mismo mtime se puede restaurar sin decimales perdidos
    utimesSync(ruta, FECHA, FECHA);
    const antes = await store.leer('proyectos.md');
    const st = statSync(ruta);
    const texto = readFileSync(ruta, 'utf8').replace('pestaña Mañana', 'pestaña Mañanx');
    assert.equal(Buffer.byteLength(texto), st.size);
    writeFileSync(ruta, texto);
    utimesSync(ruta, FECHA, FECHA);
    assert.equal(statSync(ruta).mtimeMs, st.mtimeMs);
    const despues = await store.leer('proyectos.md');
    assert.notEqual(despues.version, antes.version);
    assert.equal(m.proyectosDe(despues.doc)[0].siguiente, 'pestaña Mañanx');
  } finally { borrar(); }
});

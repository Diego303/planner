// Q1 · Propiedades de los formatos Markdown con modelos y textos aleatorios (semilla en test/azar.js).
//  1. Ida y vuelta: parsear(serializar(m)) = m, y serializar es idempotente byte a byte (≥ 500 modelos por fichero).
//  2. Texto arbitrario: serializar(parsear(x)) = x byte a byte; lo no reconocido queda en su sitio y marcado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsear, serializar } from '../src/core/formato/index.js';
import * as fsem from '../src/core/formato/semana.js';
import * as ftar from '../src/core/formato/tareas.js';
import { tipo, entradaPlantilla, tiposVacio, plantillaVacia } from '../src/core/formato/tipos.js';
import { ajustes, estudio, proyectos, diario, tema, vacio, TEMAS, TOKENS } from '../src/core/formato/listas.js';
import { nuevoDoc } from '../src/core/formato/comun.js';
import { esSemana } from '../src/core/fechas.js';
import { sinInternos } from './ayudas.js';
import { paraCada, textoModelo, textoCrudo, fecha, numero2 } from './azar.js';

const N = 500;
const V = { t: 'vacia' };

// ---------- Generadores de modelos (lo que pueden producir las operaciones) ----------

export const nombreTipo = (azar) => azar.elegir(['trabajo', 'estudio', 'proyectos', 'entreno', 'personal', 'salud', 'lectura', 'idiomas inglés', 'año-nuevo', 'familia_2']);
const delta = (azar) => azar.elegir([null, -30, 0, 30, 60, 90, 15, -15, 120]);
const rango = (azar) => { const inicio = azar.entero(0, 47) * 30; return { inicio, fin: azar.entero(inicio / 30 + 1, 48) * 30 }; };

const bloque = (azar) => fsem.bloque({
  dia: azar.entero(0, 6), ...rango(azar), tipo: nombreTipo(azar), titulo: textoModelo(azar),
  subtipo: azar.elegir([null, ...fsem.SUBTIPOS]), paso: azar.bool(0.3) ? textoModelo(azar) : null,
  hecho: delta(azar), nota: azar.bool(0.2) ? azar.entero(0, 100) : null, plantilla: azar.bool(0.3), sugerido: azar.bool(0.2),
});
const las3 = (azar) => fsem.objetivo3({
  texto: textoModelo(azar), hecha: azar.bool(), rel: azar.bool(0.5) ? textoModelo(azar, 2) : null,
  si: azar.bool(0.3) ? textoModelo(azar) : null, entonces: azar.bool(0.3) ? textoModelo(azar) : null,
});
const tarea = (azar, seccion) => ftar.tarea({
  seccion, texto: textoModelo(azar), tipo: azar.bool(0.7) ? nombreTipo(azar) : null, prioridad: azar.bool(0.2), las3: azar.bool(0.1),
  fecha: azar.bool(0.3) ? fecha(azar) : null, dur: azar.bool(0.2) ? azar.entero(1, 300) : null,
  creada: azar.bool(0.5) ? fecha(azar) : null, hecha: azar.bool(0.3), fechaHecha: azar.bool(0.2) ? fecha(azar) : null,
});

const GENERADORES = {
  'semanas/2026-W53.md': (azar) => {
    const lineas = [fsem.cabecera('2026-W53'), fsem.estado(azar.elegir(fsem.ESTADOS)), V, fsem.seccion('las3'),
      ...azar.lista(0, 4, () => las3(azar)), V, fsem.seccion('bloques'), ...azar.lista(0, 25, () => bloque(azar))];
    if (azar.bool()) lineas.push(V, fsem.seccion('estudio'), ...azar.lista(1, 3, () => fsem.objetivoEstudio(textoModelo(azar, 3), numero2(azar, 40))));
    if (azar.bool(0.3)) lineas.push(V, fsem.seccion('notas'), ...azar.lista(1, 3, () => ({ t: 'nota', texto: `- repaso: ${textoModelo(azar)}` })));
    if (azar.bool()) {
      lineas.push(V, fsem.seccion('cierre'), fsem.resumen(`estudio: ${azar.entero(0, 20)}/${azar.entero(0, 20)} h · tareas: ${azar.entero(0, 30)} · ánimo: 3,5`));
      if (azar.bool()) lineas.push(fsem.leccion('funciono', textoModelo(azar)));
      if (azar.bool()) lineas.push(fsem.leccion('cambio', textoModelo(azar)));
    }
    return nuevoDoc('semana', lineas);
  },
  'tareas.md': (azar) => nuevoDoc('tareas', ['hoy', 'mas', 'algun'].flatMap((s, i) => [
    ...(i ? [V] : []), ftar.seccion(s), ...azar.lista(0, 8, () => tarea(azar, s))])),
  'archivo/tareas-2026-11.md': (azar) => {
    const d = ftar.archivoVacio('2026-11');
    d.lineas.push(...azar.lista(0, 10, () => tarea(azar, 'archivo')));
    return d;
  },
  'tipos.md': (azar) => {
    const d = tiposVacio();
    const nombres = [...new Set(azar.lista(1, 8, () => nombreTipo(azar)))];
    d.lineas.push(...nombres.map((nombre) => tipo({ nombre, color: `#${azar.entero(0, 0xffffff).toString(16).padStart(6, '0')}`, trabajo: azar.bool(0.2), estudio: azar.bool(0.2) })));
    return d;
  },
  'plantilla.md': (azar) => {
    const d = plantillaVacia();
    d.lineas.push(...azar.lista(0, 10, () => entradaPlantilla({
      dias: azar.lista(1, 7, () => azar.entero(0, 6)), ...rango(azar), tipo: nombreTipo(azar), titulo: textoModelo(azar),
      subtipo: azar.elegir([null, ...fsem.SUBTIPOS]), paso: azar.bool(0.3) ? textoModelo(azar) : null,
    })));
    return d;
  },
  'ajustes.md': (azar) => {
    const d = vacio('ajustes', 'Ajustes');
    const valores = {
      capacidad: () => azar.entero(50, 100), tareas_hoy: () => azar.entero(1, 20),
      horas: () => { const desde = azar.entero(0, 23); return { desde, hasta: azar.entero(desde + 1, 24) }; },
      cierre: () => azar.entero(0, 1440), inicio_semana: () => azar.elegir(['lunes', 'domingo']), foco_max: () => azar.entero(1, 48) / 2,
      mejores_horas: () => azar.elegir(['sin preferencia', 'mañanas', 'tardes', 'noches']), margen: () => azar.elegir(['auto', 'fijo']),
      copias: () => azar.elegir(['diaria', 'al cerrar semana', 'git']), puerto: () => azar.entero(1024, 65535),
      tema: () => azar.elegir(TEMAS), tema_temporada: () => azar.bool(), decoracion: () => azar.bool(),
    };
    for (const [k, fn] of Object.entries(valores)) if (azar.bool(0.7)) d.lineas.push(ajustes.kv(k, fn()));
    return d;
  },
  'estudio.md': (azar) => {
    const d = vacio('estudio', 'Estudio');
    const nombres = [...new Set(azar.lista(0, 4, () => textoModelo(azar, 3)))];
    for (const nombre of nombres) {
      d.lineas.push(V, { t: 'h2', texto: nombre, seccion: nombre });
      if (azar.bool(0.8)) d.lineas.push(estudio.kv('horas_semana', numero2(azar, 30)));
      if (azar.bool()) d.lineas.push(estudio.kv('examen', fecha(azar)));
      if (azar.bool()) d.lineas.push(estudio.kv('inicio', fecha(azar)));
      if (azar.bool()) d.lineas.push(estudio.kv('total', numero2(azar, 500)));
      if (azar.bool(0.3)) d.lineas.push(estudio.kv('previo', numero2(azar, 50)));
      if (azar.bool()) d.lineas.push(estudio.kv('simulacros', azar.lista(0, 5, () => ({ nota: azar.entero(0, 100), fecha: azar.bool(0.8) ? fecha(azar) : null }))));
      if (azar.bool(0.4)) d.lineas.push(estudio.kv('dejado', textoModelo(azar)));
    }
    return d;
  },
  'proyectos.md': (azar) => {
    const d = vacio('proyectos', 'Proyectos');
    for (const nombre of [...new Set(azar.lista(0, 4, () => textoModelo(azar, 3)))]) {
      d.lineas.push(V, { t: 'h2', texto: nombre, seccion: nombre });
      if (azar.bool(0.9)) d.lineas.push(proyectos.kv('siguiente', textoModelo(azar)));
      if (azar.bool()) d.lineas.push(proyectos.kv('estado', azar.elegir(['activo', 'pausado'])));
      if (azar.bool()) d.lineas.push(proyectos.kv('actualizado', fecha(azar)));
      if (azar.bool(0.3)) d.lineas.push(proyectos.kv('dejado', textoModelo(azar)));
    }
    return d;
  },
  'diario/2026-11-02.md': (azar) => {
    const d = vacio('diario');
    if (azar.bool(0.8)) d.lineas.push(diario.kv('animo', azar.entero(1, 5)));
    if (azar.bool(0.8)) d.lineas.push(diario.kv('linea', textoModelo(azar)));
    if (azar.bool()) d.lineas.push(diario.kv('avanzado', azar.lista(1, 4, () => textoModelo(azar).replace(/;/g, ','))));
    if (azar.bool(0.8)) d.lineas.push(diario.kv('manana', textoModelo(azar)));
    return d;
  },
  'tema.md': (azar) => {
    const d = vacio('tema');
    if (azar.bool(0.8)) d.lineas.push(tema.kv('base', azar.elegir(TEMAS.filter((t) => t !== 'personalizado' && t !== 'automatico'))));
    for (const k of azar.algunos(TOKENS, 0.3)) d.lineas.push(tema.kv(k, azar.elegir(['#101010', '#FFF', 'rgb(1, 2, 3)', '6px', 'Georgia, serif', 'none'])));
    return d;
  },
  'inbox.md': (azar) => nuevoDoc('inbox', [{ t: 'h1', texto: 'Inbox' }, ...azar.lista(0, 8, () => ({ t: 'nota', texto: `- ${textoModelo(azar)}` }))]),
};

for (const [ruta, generar] of Object.entries(GENERADORES)) {
  test(`${ruta}: parsear(serializar(m)) = m y serializar es idempotente (${N} modelos)`, () => {
    paraCada(N, (azar) => {
      const m = generar(azar);
      const s1 = serializar(m);
      const leido = parsear(ruta, s1);
      assert.deepEqual(sinInternos(leido), sinInternos(m));
      assert.equal(serializar(leido), s1);
      assert.equal(serializar(parsear(ruta, serializar(leido))), s1);
    });
  });
}

// ---------- Texto arbitrario: se conserva byte a byte ----------

/** Una línea: válida de un modelo, válida mutada, o basura. */
function lineaCualquiera(azar, ruta) {
  const doc = GENERADORES[ruta](azar);
  const validas = serializar(doc).split('\n').filter(Boolean);
  const base = validas.length ? azar.elegir(validas) : '';
  switch (azar.entero(0, 7)) {
    case 0: return base;
    case 1: return `${base}${azar.elegir([' ', '\t', '   ', '  # comentario', ' | extra', ' | tipo: x'])}`;
    case 2: { const i = azar.entero(0, base.length); return base.slice(0, i) + textoCrudo(azar, 2) + base.slice(i); }
    case 3: return base.replace(/\d/, azar.elegir(['9', '7', 'x', '']));
    case 4: return azar.elegir(['', ' ', '\t', '#', '# Título', '## ', '## Bloques', '## Hoy', '## Más adelante', '## Cierre', '## Rara', '### h3', '---', '- ', '-', '* x', '  - sangría', '> cita']);
    case 5: return textoCrudo(azar);
    case 6: return azar.elegir(['- L 25:00-26:00 | a | b', '- L 9:7-10:00 | a | b', '- L 10:00-09:00 | a | b', '- L 10:00-10:00 | a | b', '- L 24:00-24:30 | a | b',
      '- L 23:00-01:00 | a | b', '- Q 09:00-10:00 | a | b', '- [ ] x | fecha: 2026-02-30', '- trabajo | #12345', '- trabajo | #GGGGGG', '- Capacidad: 70', '- capacidad:', '- foco_max: 1,5', '- horas: 24-7']);
    default: return `${base}\r`; // retorno de carro suelto
  }
}

function textoCualquiera(azar, ruta) {
  const lineas = azar.lista(0, 30, () => lineaCualquiera(azar, ruta));
  const eol = azar.elegir(['\n', '\r\n', 'mezcla']);
  let texto = lineas.map((l, i) => l + (i === lineas.length - 1 && azar.bool(0.3) ? '' : eol === 'mezcla' ? azar.elegir(['\n', '\r\n']) : eol)).join('');
  if (azar.bool(0.1)) texto = `﻿${texto}`;
  return texto;
}

for (const ruta of Object.keys(GENERADORES)) {
  test(`${ruta}: cualquier texto se conserva byte a byte y lo no reconocido queda en su sitio (${N} textos)`, () => {
    paraCada(N, (azar) => {
      const x = textoCualquiera(azar, ruta);
      const doc = parsear(ruta, x);
      assert.equal(serializar(doc), x);
      const sinBom = x.replace(/^﻿/, '');
      const lineas = sinBom === '' ? [] : sinBom.replace(/(\r?\n)$/, '').split(/\r?\n/);
      assert.equal(doc.lineas.length, lineas.length);
      doc.lineas.forEach((l, i) => { if (l.t === '?') assert.equal(l._raw, lineas[i]); });
      assert.deepEqual(parsear(ruta, serializar(doc)), doc);
    });
  });
}

test('las rutas del generador son del planner', () => {
  assert.ok(esSemana('2026-W53'));
});

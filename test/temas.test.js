import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { colorBloque, colorSerie, contraste, hexARgb } from '../src/core/color.js';
import { PAL } from '../src/core/modelo.js';
import { atributosTema, avisoTemaDesconocido, esTemporadaHalloween } from '../src/core/temas.js';
import { parsear } from '../src/core/formato/index.js';
import { AJUSTES_DEFECTO, TOKENS } from '../src/core/formato/listas.js';

const DIR = new URL('../web/temas/', import.meta.url);

/** Tokens del primer bloque de cada tema: { id: { modo, fondo, superficie, … } } */
function leerTemas() {
  const out = {};
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.css'))) {
    const css = readFileSync(new URL(f, DIR), 'utf8');
    const id = f.slice(0, -4);
    const bloque = css.slice(css.indexOf('{') + 1, css.indexOf('}'));
    out[id] = {};
    for (const m of bloque.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[id][m[1]] = m[2].trim();
  }
  return out;
}
const TEMAS = leerTemas();

test('hay seis temas y todos definen los mismos tokens', () => {
  assert.deepEqual(Object.keys(TEMAS).sort(), ['alto-contraste', 'halloween', 'nordico-claro', 'nordico-oscuro', 'papel', 'universo']);
  const claves = Object.keys(TEMAS['nordico-claro']).filter((k) => k !== 'borde-ancho').sort();
  for (const [id, t] of Object.entries(TEMAS)) {
    assert.deepEqual(Object.keys(t).filter((k) => k !== 'borde-ancho').sort(), claves, id);
    assert.ok(['claro', 'oscuro', 'contraste'].includes(t.modo), id);
  }
  // los tokens que se pueden personalizar en tema.md existen en los temas
  for (const k of TOKENS) assert.ok(claves.includes(k), k);
});

test('contraste AA (≥ 4,5:1) del texto de los bloques en todos los temas × la paleta', () => {
  for (const [id, t] of Object.entries(TEMAS)) {
    for (const base of [...PAL, '#888780']) {
      const c = colorBloque(base, { modo: t.modo, superficie: t.superficie });
      const r = contraste(c.texto, c.fondo);
      assert.ok(r >= 4.5, `${id} · ${base}: ${r.toFixed(2)}`);
    }
  }
});

test('texto principal, acento y avisos legibles en cada tema', () => {
  for (const [id, t] of Object.entries(TEMAS)) {
    assert.ok(contraste(t.texto, t.superficie) >= 7, `${id}: texto/superficie`);
    assert.ok(contraste(t.texto, t.fondo) >= 7, `${id}: texto/fondo`);
    assert.ok(contraste(t['texto-2'], t.superficie) >= 4.5, `${id}: texto-2/superficie ${contraste(t['texto-2'], t.superficie).toFixed(2)}`);
    assert.ok(contraste(t['acento-texto'], t.acento) >= 4.5, `${id}: acento`);
    for (const k of ['aviso', 'ok', 'peligro']) assert.ok(contraste(t[k], t.superficie) >= 3, `${id}: ${k} ${contraste(t[k], t.superficie).toFixed(2)}`);
    for (const base of PAL) assert.ok(contraste(colorSerie(base, { modo: t.modo, superficie: t.superficie }), t.superficie) >= 3, `${id}: serie ${base}`);
    for (const v of Object.values(t)) if (/^#/.test(v)) assert.ok(hexARgb(v), `${id}: ${v}`);
  }
});

test('tema efectivo: temporada de Halloween, personalizado sobre su base y tema desconocido', () => {
  const a = { ...AJUSTES_DEFECTO, tema: 'papel', tema_temporada: true };
  assert.equal(atributosTema(a, null, '2026-10-27').tema, 'halloween');
  assert.equal(atributosTema(a, null, '2026-11-01').tema, 'papel');
  assert.ok(esTemporadaHalloween('2026-10-31') && !esTemporadaHalloween('2026-10-24'));
  const temaDoc = parsear('tema.md', '- base: nordico-oscuro\n- acento: #FF00AA\n- fondo: #000000\n');
  const p = atributosTema({ ...AJUSTES_DEFECTO, tema: 'personalizado', decoracion: false }, temaDoc, '2026-11-02');
  assert.deepEqual(p, { tema: 'nordico-oscuro', personalizado: true, deco: 'no', css: '--acento: #FF00AA; --fondo: #000000;' });
  const raro = parsear('ajustes.md', '- tema: rosa\n');
  assert.equal(avisoTemaDesconocido(raro), 'Tema «rosa» desconocido en ajustes.md: uso Nórdico claro');
  assert.equal(avisoTemaDesconocido(parsear('ajustes.md', '- tema: papel\n')), null);
});

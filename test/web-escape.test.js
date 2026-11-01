// Q3 · Lo que viene de los ficheros (nombres de tema, valores de tema.md) nunca se cuela como HTML en la web.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline } from '../web/ui/graficos.js';

const HOSTIL = 'AI-102" onload="alert(1)"><script>alert(2)</script><b x=\'';

test('sparkline: la etiqueta (nombre del tema) va escapada en el aria-label', () => {
  for (const tipo of ['linea', 'barras']) {
    const svg = String(sparkline([1, 3, null, 2], 120, 24, { etiqueta: HOSTIL, ref: 2, refEtiqueta: HOSTIL, color: 'var(--acento)', barras: tipo === 'barras' }));
    assert.ok(!svg.includes('<script>') && !svg.includes('onload="'), svg);
    assert.match(svg, /aria-label="AI-102&quot; onload=&quot;alert\(1\)&quot;&gt;&lt;script&gt;/);
    assert.match(svg, /<text [^>]*>AI-102&quot; onload/);
    assert.equal((svg.match(/<svg /g) ?? []).length, 1);
  }
});

test('miniatura del tema personalizado: los valores de tema.md no salen del atributo style', async () => {
  const { register } = await import('node:module');
  register('./web-hooks.mjs', import.meta.url);
  const { rejillaTemas } = await import('../web/ui/miniaturas.js');
  const { parsear } = await import('../src/core/formato/index.js');
  const tema = parsear('tema.md', '# Tema\n\n- base: nordico-claro\n- fuente: "Inter" onmouseover="alert(1)" x="\n- acento: #123456\n');
  const out = String(rejillaTemas('personalizado', tema));
  assert.ok(!/onmouseover="/.test(out), out.slice(0, 600));
  assert.match(out, /--fuente: &quot;Inter&quot; onmouseover=&quot;alert\(1\)&quot;/);
  assert.match(out, /--acento: #123456;/);
});

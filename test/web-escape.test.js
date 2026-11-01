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

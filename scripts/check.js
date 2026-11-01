#!/usr/bin/env node
// Lint ligero sin dependencias:
//  1. `node --check` de todos los .js (sintaxis).
//  2. package.json sin dependencias de runtime.
//  3. src/core puro: sin E/S, sin DOM y sin reloj (determinismo).
//  4. Ningún color fijo en web/ fuera de web/temas/ (todo sale de los tokens CSS).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const errores = [];

function recorrer(dir, filtro, acc = []) {
  let entradas;
  try { entradas = readdirSync(dir); } catch { return acc; }
  for (const nombre of entradas) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta, filtro, acc);
    else if (filtro(ruta)) acc.push(ruta);
  }
  return acc;
}

const rel = (r) => relative(raiz, r).split(sep).join('/');

// 1. Sintaxis
const js = ['bin', 'src', 'web', 'test', 'scripts', 'plugin']
  .flatMap((d) => recorrer(join(raiz, d), (r) => r.endsWith('.js') || r.endsWith('.mjs')));
for (const fichero of js) {
  try {
    execFileSync(process.execPath, ['--check', fichero], { stdio: 'pipe' });
  } catch (e) {
    errores.push(`${rel(fichero)}: error de sintaxis\n${String(e.stderr || e.message).trim()}`);
  }
}

// 2. Sin dependencias de runtime
const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
  errores.push('package.json: "dependencies" debe estar vacío');
}

// 3. core puro e isomórfico
const prohibidoCore = [
  [/from\s+['"]node:/, 'importa un módulo de Node'],
  [/\b(document|window|localStorage|navigator)\./, 'usa el DOM'],
  [/\bfetch\(/, 'hace peticiones de red'],
  [/\bprocess\./, 'usa process'],
  [/\bDate\.now\(/, 'lee el reloj (pasa la fecha como parámetro)'],
  [/new Date\(\)/, 'lee el reloj (pasa la fecha como parámetro)'],
  [/Math\.random\(/, 'no es determinista'],
];
for (const fichero of recorrer(join(raiz, 'src/core'), (r) => r.endsWith('.js'))) {
  const texto = readFileSync(fichero, 'utf8');
  for (const [re, motivo] of prohibidoCore) {
    if (re.test(texto)) errores.push(`${rel(fichero)}: src/core debe ser puro (${motivo})`);
  }
}

// 4. Colores fijos fuera de web/temas
const colorFijo = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\brgba?\(|\bhsla?\(/;
const web = recorrer(join(raiz, 'web'), (r) => /\.(js|css|html)$/.test(r))
  .filter((r) => !rel(r).startsWith('web/temas/'));
for (const fichero of web) {
  readFileSync(fichero, 'utf8').split('\n').forEach((linea, i) => {
    if (colorFijo.test(linea)) {
      errores.push(`${rel(fichero)}:${i + 1}: color fijo (usa los tokens de web/temas/): ${linea.trim().slice(0, 90)}`);
    }
  });
}

if (errores.length) {
  console.error(errores.join('\n'));
  console.error(`\n✗ check: ${errores.length} problema(s)`);
  process.exit(1);
}
console.log(`✓ check: ${js.length} ficheros JS, core puro, sin colores fijos, sin dependencias`);

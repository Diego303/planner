#!/usr/bin/env node
// pnpm qa:validar -- --datos <ruta>
// Revisa una carpeta de datos del planner SIN TOCARLA: la copia a un directorio temporal y trabaja sobre la copia.
// Parsea todos los ficheros, comprueba la ida y vuelta byte a byte y lista líneas no reconocidas (y por qué
// parecen fallar: día, hora o fecha no válidos), solapes, temas huérfanos y tipos sin uso.
// Al final comprueba que la carpeta original sigue exactamente igual que antes.
// Salida: 0 si todo está bien, 1 si hay avisos, 2 si alguna ida y vuelta no es exacta (el planner cambiaría bytes).
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { parsear, serializar, tipoDeRuta } from '../src/core/formato/index.js';
import * as m from '../src/core/modelo.js';
import { carriles } from '../src/core/carriles.js';
import { DIAS, horaCorta, parsearRango } from '../src/core/fechas.js';

const NO_COPIAR = new Set(['.copias', '.git', '.cache']);
const TAMANO_MAXIMO = 1024 * 1024;

function argumentos(argv) {
  const a = argv.filter((x) => x !== '--');
  const i = a.indexOf('--datos');
  const datos = i >= 0 ? a[i + 1] : a.find((x) => x.startsWith('--datos='))?.slice(8);
  if (!datos) { console.error('Uso: pnpm qa:validar -- --datos <carpeta>'); process.exit(64); }
  return { datos: resolve(datos), conservar: a.includes('--conservar') };
}

/** Rutas relativas de todos los ficheros (sin .copias, .git ni .cache). */
function ficheros(raiz, rel = '') {
  const out = [];
  for (const e of readdirSync(join(raiz, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (!rel && NO_COPIAR.has(e.name)) continue;
    if (e.isDirectory()) out.push(...ficheros(raiz, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

/** Firma de la carpeta original (ruta → tamaño y fecha de modificación) para comprobar que no cambia. */
const firmas = (raiz) => Object.fromEntries(ficheros(raiz).map((r) => { const s = statSync(join(raiz, r)); return [r, `${s.size}|${s.mtimeMs}`]; }));

/** Por qué parece que una línea no se reconoce (orientativo). */
function motivo(ruta, texto) {
  const t = texto.trim();
  if (/^#{1,2}\s/.test(t)) return 'título o sección que el planner no conoce';
  if (ruta.startsWith('semanas/') && /^-\s+\S+\s+\d/.test(t)) {
    if (!/^-\s+[LMXJVSD]\s/.test(t)) return 'bloque con un día no válido (L, M, X, J, V, S o D)';
    const rango = /^-\s+[LMXJVSD]\s+(\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})\s/.exec(t);
    if (!rango || !parsearRango(rango[1])) return 'bloque con una hora no válida (de 00:00 a 24:00, y el fin después del inicio)';
    return 'bloque con un campo no válido (tipo, «hecho», «nota»…)';
  }
  if (/fecha:\s*\S+/.test(t) && !/fecha:\s*\d{4}-\d{2}-\d{2}(\s|$|\|)/.test(t)) return 'fecha no válida (usa AAAA-MM-DD)';
  if (/\d{4}-\d{2}-\d{2}/.test(t) && /fecha|examen|inicio|creada|hecha/.test(t)) return 'fecha imposible (p. ej. 30 de febrero)';
  if (/^-\s+\[.\]/.test(t)) return 'casilla no válida (usa «[ ]» o «[x]»)';
  if (/^-\s+\w[\w ]*:/.test(t)) return 'clave desconocida o valor no válido';
  return 'formato no reconocido';
}

function validar(copia) {
  const informe = { ficheros: 0, planner: 0, ajenos: [], idaVuelta: [], ilegibles: [], lineas: [], solapes: [], huerfanos: [], tiposSinUso: [], tiposSinDefinir: [] };
  const docs = {};
  for (const ruta of ficheros(copia)) {
    informe.ficheros++;
    if (!tipoDeRuta(ruta)) { informe.ajenos.push(ruta); continue; }
    informe.planner++;
    const buf = readFileSync(join(copia, ruta));
    if (buf.length > TAMANO_MAXIMO) { informe.ilegibles.push([ruta, 'más de 1 MB: el planner lo ignora']); continue; }
    if (buf.includes(0)) { informe.ilegibles.push([ruta, 'parece binario: el planner lo ignora']); continue; }
    const texto = buf.toString('utf8');
    let doc;
    try { doc = parsear(ruta, texto); } catch (e) { informe.ilegibles.push([ruta, `no se puede leer: ${e.message}`]); continue; }
    docs[ruta] = doc;
    if (serializar(doc) !== texto) informe.idaVuelta.push(ruta);
    const crudas = texto.split(/\r?\n/);
    doc.lineas.forEach((l, i) => { if (l.t === '?' && l._raw.trim() && !l.h2) informe.lineas.push([ruta, i + 1, crudas[i] ?? l._raw, motivo(ruta, l._raw)]); });
  }
  // Modelo: tipos, temas, proyectos
  const tipos = m.tiposDe(docs['tipos.md'] ?? null);
  const temas = m.temasEstudio(docs['estudio.md'] ?? null);
  const proyectos = m.proyectosDe(docs['proyectos.md'] ?? null);
  const nombres = [...temas, ...proyectos].map((x) => x.nombre);
  const conocido = (n) => nombres.some((x) => m.mismoTema(x, n));
  const usos = new Map();
  const usar = (tipo, donde) => { if (!tipo) return; const k = m.normalizar(tipo); usos.set(k, (usos.get(k) ?? 0) + 1); if (!m.tipoPorNombre(tipos, tipo)) informe.tiposSinDefinir.push([donde, tipo]); };
  for (const [ruta, doc] of Object.entries(docs)) {
    if (ruta.startsWith('semanas/')) {
      const bloques = m.bloquesDe(doc);
      for (const b of bloques) {
        usar(b.tipo, `${ruta} · ${b.titulo}`);
        const tema = m.temaDe(b.titulo);
        if ((m.esEstudio(tipos, b.tipo) || m.normalizar(b.tipo) === m.normalizar(m.tipoProyectos(tipos) ?? '')) && !conocido(tema)) {
          informe.huerfanos.push([ruta, `bloque «${b.titulo}»: «${tema}» no está en estudio.md ni en proyectos.md`]);
        }
      }
      for (let dia = 0; dia < 7; dia++) {
        const delDia = bloques.filter((b) => b.dia === dia);
        const lanes = carriles(delDia);
        const solapados = delDia.filter((_, i) => lanes[i].solapa);
        if (solapados.length) informe.solapes.push([ruta, `${DIAS[dia]}: ${solapados.map((b) => `«${b.titulo}» ${horaCorta(b.inicio)}–${horaCorta(b.fin)}`).join(', ')}`]);
      }
      for (const o of m.las3De(doc)) if (o.rel && !conocido(o.rel)) informe.huerfanos.push([ruta, `Las 3 «${o.texto}»: rel «${o.rel}» no está en estudio.md ni en proyectos.md`]);
      for (const o of m.entidades(doc, 'objetivo')) if (!temas.some((t) => m.mismoTema(t.nombre, o.tema))) informe.huerfanos.push([ruta, `## Estudio: «${o.tema}» no está en estudio.md`]);
    }
    if (ruta === 'plantilla.md') for (const e of m.plantillaDe(doc)) usar(e.tipo, `plantilla.md · ${e.titulo}`);
    if (ruta === 'tareas.md' || ruta.startsWith('archivo/tareas-')) for (const t of m.entidades(doc, 'tarea')) usar(t.tipo, `${ruta} · ${t.texto}`);
  }
  informe.tiposSinUso = tipos.filter((t) => !usos.get(m.normalizar(t.nombre))).map((t) => t.nombre);
  return informe;
}

function imprimir(informe, origen, copia) {
  const l = [];
  const seccion = (titulo, lista, fmt) => { l.push('', `## ${titulo} (${lista.length})`); for (const x of lista.slice(0, 200)) l.push(`- ${fmt(x)}`); if (lista.length > 200) l.push(`- … y ${lista.length - 200} más`); };
  l.push(`# planner · validación de ${origen}`, '', `Revisado sobre una copia en ${copia} (la carpeta original no se toca).`);
  l.push(`${informe.ficheros} ficheros · ${informe.planner} del planner · ${informe.ajenos.length} que el planner no usa.`);
  l.push('', informe.idaVuelta.length ? `✗ Ida y vuelta: ${informe.idaVuelta.length} ficheros cambiarían de bytes al guardar` : `✓ Ida y vuelta exacta en los ${informe.planner - informe.ilegibles.length} ficheros legibles: guardar no cambia nada que no toques.`);
  if (informe.idaVuelta.length) seccion('Ida y vuelta no exacta (avísame: es un fallo del planner)', informe.idaVuelta, (r) => r);
  seccion('Ficheros que el planner ignora', informe.ilegibles, ([r, m2]) => `${r}: ${m2}`);
  seccion('Líneas no reconocidas (se conservan tal cual, pero el planner no las usa)', informe.lineas, ([r, n, t, mo]) => `${r}:${n} · ${mo} · «${t.trim()}»`);
  seccion('Bloques que se solapan', informe.solapes, ([r, t]) => `${r} · ${t}`);
  seccion('Temas huérfanos', informe.huerfanos, ([r, t]) => `${r} · ${t}`);
  seccion('Tipos sin uso (en tipos.md, pero ningún bloque, tarea ni plantilla los usa)', informe.tiposSinUso, (t) => t);
  seccion('Tipos usados que no están en tipos.md (salen en gris)', informe.tiposSinDefinir, ([d, t]) => `${t} · ${d}`);
  if (informe.ajenos.length) l.push('', `Otros ficheros (el planner no los lee): ${informe.ajenos.slice(0, 20).join(', ')}${informe.ajenos.length > 20 ? '…' : ''}`);
  return l.join('\n');
}

const { datos, conservar } = argumentos(process.argv.slice(2));
if (!existsSync(datos) || !statSync(datos).isDirectory()) { console.error(`No existe la carpeta ${datos}`); process.exit(64); }
const antes = firmas(datos);
const copia = mkdtempSync(join(tmpdir(), 'planner-validar-'));
try {
  for (const n of readdirSync(datos)) if (!NO_COPIAR.has(n)) cpSync(join(datos, n), join(copia, n), { recursive: true });
  const informe = validar(copia);
  console.log(imprimir(informe, datos, copia));
  const despues = firmas(datos);
  const cambiados = Object.keys({ ...antes, ...despues }).filter((r) => antes[r] !== despues[r]);
  console.log('', cambiados.length
    ? `\n⚠ Mientras se validaba, cambiaron en la carpeta original (no ha sido este comando: solo lee): ${cambiados.slice(0, 10).join(', ')}`
    : '\n✓ La carpeta original no ha cambiado.');
  const avisos = informe.lineas.length + informe.solapes.length + informe.huerfanos.length + informe.ilegibles.length + informe.tiposSinDefinir.length;
  process.exitCode = informe.idaVuelta.length ? 2 : avisos ? 1 : 0;
} finally {
  if (!conservar) rmSync(copia, { recursive: true, force: true });
  else console.log(`(copia conservada en ${relative(process.cwd(), copia) || copia})`);
}

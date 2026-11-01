#!/usr/bin/env node
// Genera web/icon-192.png y web/icon-512.png (el mismo dibujo que web/icon.svg) sin dependencias.
// Fondo a sangre (sirve como icono «maskable»). Se ejecuta a mano si cambia el icono: node scripts/iconos.js
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FONDO = [0x1e, 0x23, 0x20];
const BARRAS = [ // x, y, ancho, alto, radio, color (en coordenadas de 512)
  [112, 136, 288, 56, 18, [0x8e, 0x7f, 0xd1]],
  [112, 228, 208, 56, 18, [0x6f, 0xb5, 0x8f]],
  [112, 320, 248, 56, 18, [0xd8, 0x8a, 0x6c]],
];

const dentro = (px, py, [x, y, w, h, r]) => {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
};

function dibujar(tam) {
  const SS = 4; // supermuestreo para suavizar bordes
  const px = Buffer.alloc(tam * tam * 4);
  for (let j = 0; j < tam; j++) {
    for (let i = 0; i < tam; i++) {
      const acc = [0, 0, 0];
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = ((i + (si + 0.5) / SS) / tam) * 512, y = ((j + (sj + 0.5) / SS) / tam) * 512;
          const barra = BARRAS.find((b) => dentro(x, y, b));
          const c = barra ? barra[5] : FONDO;
          for (let k = 0; k < 3; k++) acc[k] += c[k];
        }
      }
      const o = (j * tam + i) * 4;
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(acc[k] / (SS * SS));
      px[o + 3] = 255;
    }
  }
  return px;
}

const TABLA = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function trozo(tipo, datos) {
  const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([len, cuerpo, crc]);
}

function png(tam) {
  const px = dibujar(tam);
  const filas = Buffer.alloc(tam * (tam * 4 + 1));
  for (let j = 0; j < tam; j++) { filas[j * (tam * 4 + 1)] = 0; px.copy(filas, j * (tam * 4 + 1) + 1, j * tam * 4, (j + 1) * tam * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', deflateSync(filas, { level: 9 })), trozo('IEND', Buffer.alloc(0))]);
}

for (const tam of [192, 512]) {
  writeFileSync(new URL(`../web/icon-${tam}.png`, import.meta.url), png(tam));
  console.log(`web/icon-${tam}.png`);
}

#!/usr/bin/env node
// CLI del planner. En F0 solo existe el esqueleto: la CLI completa llega en F2.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

if (process.argv.includes('--version')) {
  console.log(pkg.version);
} else {
  console.log(`planner ${pkg.version} · en desarrollo (esqueleto)`);
}

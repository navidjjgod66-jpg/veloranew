/* Syntax-checks first-party browser modules and test/server scripts with Node's parser. */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assetDir = 'assets/js';
const assetFiles = readdirSync(assetDir)
  .filter(name => name.endsWith('.js'))
  .map(name => join(assetDir, name));
const scriptFiles = ['scripts/serve-preview.mjs', 'scripts/mobile-smoke.mjs'].filter(existsSync);
const files = [...assetFiles, ...scriptFiles];

if (!files.length) throw new Error('No JavaScript modules or scripts found.');

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log(`Successfully checked ${files.length} JavaScript modules and scripts.`);

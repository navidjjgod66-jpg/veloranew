/* Syntax-checks every first-party module with `node --check`, one file at a time.
   (`node --check --input-type=module assets/js/*.js` is rejected by Node, and
   package.json already declares "type": "module".) */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'assets/js';
const files = readdirSync(dir).filter(name => name.endsWith('.js'));
if (!files.length) throw new Error(`No modules found in ${dir}`);

for (const name of files) {
  execFileSync(process.execPath, ['--check', join(dir, name)], { stdio: 'inherit' });
}
console.log(`Successfully checked ${files.length} JavaScript modules.`);

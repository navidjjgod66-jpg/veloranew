import { readFileSync } from 'node:fs';
import { format } from 'prettier';

const source = readFileSync('index.html', 'utf8');
await format(source, { parser: 'html' });
console.log('Successfully parsed index.html.');

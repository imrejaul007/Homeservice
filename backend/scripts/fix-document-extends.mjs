#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') files.push(...walk(full));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

const pattern = /interface (\w+) extends Document, (\w+) \{\}/g;

for (const file of walk(path.join(srcDir, 'services'))) {
  let content = fs.readFileSync(file, 'utf8');
  const updated = content.replace(pattern, 'interface $1 extends Document, Omit<$2, \'_id\'> {}');
  if (updated !== content) {
    fs.writeFileSync(file, updated);
    console.log('Fixed Document extends:', path.relative(srcDir, file));
  }
}

console.log('Done.');

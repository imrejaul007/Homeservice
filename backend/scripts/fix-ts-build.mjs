#!/usr/bin/env node
/**
 * Batch-fix common TypeScript build errors
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function walk(dir, ext = '.ts') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...walk(full, ext));
    } else if (entry.name.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function fixFile(filePath, transforms) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of transforms) {
    const next = content.replace(pattern, replacement);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', path.relative(srcDir, filePath));
  }
}

// Fix reduce unknown in automation files
const automationDir = path.join(srcDir, 'automation');
for (const file of walk(automationDir)) {
  fixFile(file, [
    [/Object\.values\(([^)]+)\)\.reduce\(\(sum: number, count: number\) =>/g, '(Object.values($1) as number[]).reduce((sum, count) =>'],
    [/Object\.values\(([^)]+)\)\.reduce\(\(sum: number, c: number\) =>/g, '(Object.values($1) as number[]).reduce((sum, c) =>'],
    [/\.reduce\(\(sum, s\) =>/g, '.reduce((sum: number, s: { utilization: number }) =>'],
    [/\.reduce\(\(sum, d\) =>/g, '.reduce((sum: number, d: { utilization: number }) =>'],
    [/\.reduce\(\(sum, b\) =>/g, '.reduce((sum: number, b: { pricing?: { totalAmount?: number } }) =>'],
    [/\.reduce\(\(sum, p\) =>/g, '.reduce((sum: number, p: { avgProgress?: number }) =>'],
    [/\.reduce\(\(sum, t\) =>/g, '.reduce((sum: number, t: number) =>'],
  ]);
}

// Add Document import to services missing it
const servicesNeedingDocument = [
  'activityAuditLog.service.ts',
  'betaFeaturesAccess.service.ts',
  'enhancedAccountRecovery.service.ts',
  'monthlyScorecard.service.ts',
  'photoSharing.service.ts',
  'policyUpdateNotification.ts',
  'quoteRequest.service.ts',
  'servicePackages.service.ts',
  'tipping.service.ts',
  'trainingAcademy.service.ts',
];

for (const rel of servicesNeedingDocument) {
  const filePath = path.join(srcDir, 'services', rel);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes("Cannot find name 'Document'") || !content.match(/import.*Document.*from 'mongoose'/)) {
    if (!content.match(/import.*Document.*from 'mongoose'/)) {
      if (content.match(/^import mongoose/m)) {
        content = content.replace(
          /^import mongoose(?:, \{([^}]+)\})? from 'mongoose';/m,
          (match, imports) => {
            if (imports && imports.includes('Document')) return match;
            if (imports) return `import mongoose, { ${imports.trim()}, Document } from 'mongoose';`;
            return "import mongoose, { Document } from 'mongoose';";
          }
        );
      } else {
        content = "import { Document } from 'mongoose';\n" + content;
      }
      fs.writeFileSync(filePath, content);
      console.log('Added Document import:', rel);
    }
  }
}

// Fix analytics routes logger import
const customerRoutes = path.join(srcDir, 'routes', 'analytics', 'customer.routes.ts');
if (fs.existsSync(customerRoutes)) {
  let content = fs.readFileSync(customerRoutes, 'utf8');
  if (!content.includes("import logger from")) {
    content = "import logger from '../../utils/logger';\n" + content;
    fs.writeFileSync(customerRoutes, content);
    console.log('Added logger import: customer.routes.ts');
  }
}

console.log('Done.');

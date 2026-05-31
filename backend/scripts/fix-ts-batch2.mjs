#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, '..', 'src');

function fix(relPath, transforms) {
  const filePath = path.join(srcDir, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of transforms) {
    const next = typeof pattern === 'string'
      ? content.replaceAll(pattern, replacement)
      : content.replace(pattern, replacement);
    if (next !== content) {
      content = next;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', relPath);
  }
}

// Email: add sendEmail to default export
const emailPath = path.join(srcDir, 'services', 'email.service.ts');
let emailContent = fs.readFileSync(emailPath, 'utf8');
if (!emailContent.includes('  sendEmail,')) {
  emailContent = emailContent.replace(
    'export default {\n  // Auth emails',
    'export default {\n  sendEmail,\n  // Auth emails'
  );
  fs.writeFileSync(emailPath, emailContent);
  console.log('Fixed: services/email.service.ts (default export sendEmail)');
}

// Invoice/receipt - use sendEmail from import
fix('services/invoice.service.ts', [
  [/import emailService from '\.\/email\.service';/, "import emailService, { sendEmail } from './email.service';"],
  [/if \(emailService && typeof emailService\.sendEmail === 'function'\) \{\s*await emailService\.sendEmail\(\{[\s\S]*?\}\);\s*\}/g,
    (m) => {
      // handled separately below
      return m;
    }
  ],
]);

// Training academy - add types to callbacks
fix('services/trainingAcademy.service.ts', [
  [/\.filter\(c =>/g, '.filter((c: { isRequired?: boolean; id: string }) =>'],
  [/\.filter\(c =>/g, '.filter((c: { id: string }) =>'],
  [/\.findIndex\(c =>/g, '.findIndex((c: { id: string }) =>'],
  [/\.every\(c =>/g, '.every((c: { id: string }) =>'],
  [/\.map\(\(qs\)/g, '.map((qs: { score?: number })'],
  [/\.map\(\(_, idx\)/g, '.map((_: unknown, idx: number)'],
  [/\.filter\(\(q\)/g, '.filter((q: { correct?: boolean })'],
  [/\.reduce\(\(sum, qs\)/g, '.reduce((sum: number, qs: { score?: number })'],
]);

// Escalation
fix('services/escalation.service.ts', [
  ['stats.in_progress', 'stats.inProgress'],
]);

// Rush booking
fix('services/rushBookingFee.service.ts', [
  ['RUSH_TIERS.same_day', 'RUSH_TIERS.sameDay'],
  ['.same_day', '.sameDay'],
]);

// Bulk discount null -> undefined
fix('services/bulkDiscount.service.ts', [
  [/(\w+Tier)\s*\|\|\s*null/g, '$1 ?? undefined'],
]);

console.log('Batch 2 complete');

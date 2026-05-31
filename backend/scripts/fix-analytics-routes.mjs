#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'routes/analytics/provider.routes.ts',
  'routes/analytics/customer.routes.ts',
];

for (const rel of files) {
  const filePath = path.join(__dirname, '..', 'src', rel);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('queryString(')) {
    content = content.replace(
      "import { asyncHandler } from '../../utils/asyncHandler';",
      "import { asyncHandler } from '../../utils/asyncHandler';\n\nconst queryString = (value: unknown, fallback = ''): string =>\n  typeof value === 'string' ? value : fallback;"
    );
  }
  content = content.replace(
    /const providerId = user\.role === 'admin' \? req\.query\.providerId : user\._id\.toString\(\);/g,
    "const providerId = user.role === 'admin' ? queryString(req.query.providerId) : user._id.toString();"
  );
  content = content.replace(
    /const \{ period = '([^']+)' \} = req\.query;/g,
    "const period = queryString(req.query.period, '$1');"
  );
  content = content.replace(
    /const periodValue = validPeriods\.includes\(period as string\) \? period : '([^']+)';/g,
    "const periodValue = validPeriods.includes(period) ? period : '$1';"
  );
  fs.writeFileSync(filePath, content);
  console.log('Fixed:', rel);
}

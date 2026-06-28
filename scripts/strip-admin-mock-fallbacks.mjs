import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'frontend', 'src');

const dirs = [
  path.join(root, 'components', 'admin'),
  path.join(root, 'pages', 'admin'),
  path.join(root, 'components', 'dashboard'),
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

const replacement = `} else {
        setError('No data available from the server');
      }`;

let changed = 0;
for (const file of dirs.flatMap((d) => walk(d))) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('// Mock data') && !content.includes('// Mock data for')) continue;

  const original = content;
  content = content.replace(
    /\} else \{\s*\/\/ Mock data[\s\S]*?(?=\n\s*\}\s*catch)/g,
    replacement
  );
  content = content.replace(
    /\} else \{\s*\/\/ Mock data for[\s\S]*?(?=\n\s*\}\s*catch)/g,
    replacement
  );
  content = content.replace(
    /catch \(err[^)]*\) \{\s*console\.error\([^)]+\);\s*setError\('Failed to load[^']+'\);/g,
    (m) => m.replace(/setError\('Failed to load[^']+'\)/, "setError(getAdminFetchErrorMessage(err))")
  );

  if (!content.includes('getAdminFetchErrorMessage') && content.includes('getAdminFetchErrorMessage(err)')) {
    const importLine = "import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';\n";
    const importLinePages = "import { getAdminFetchErrorMessage } from '../../../utils/adminDataHelpers';\n";
    const importLineDashboard = "import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';\n";
    if (file.includes(`${path.sep}pages${path.sep}admin${path.sep}`)) {
      if (!content.includes(importLinePages.trim())) content = importLinePages + content;
    } else if (file.includes(`${path.sep}components${path.sep}dashboard${path.sep}`)) {
      if (!content.includes(importLineDashboard.trim())) content = importLineDashboard + content;
    } else if (!content.includes(importLine.trim())) {
      content = importLine + content;
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    changed += 1;
    console.log('Updated', path.relative(root, file));
  }
}

console.log(`Done. Updated ${changed} files.`);

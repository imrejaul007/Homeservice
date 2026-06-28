import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src', 'components', 'admin');
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.tsx')) continue;
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('getAdminFetchErrorMessage')) continue;
  if (c.includes("import { getAdminFetchErrorMessage }")) continue;
  c = "import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';\n" + c;
  fs.writeFileSync(p, c);
  console.log('import added', f);
}

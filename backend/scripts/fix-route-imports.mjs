import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.join(__dirname, '../src/routes');

const files = fs.readdirSync(routesDir).filter((f) => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = content.replace(
    /import \{ asyncHandler \} from '\.\.\/middleware\/error\.middleware';/g,
    "import { asyncHandler } from '../utils/asyncHandler';"
  );

  if (content.includes("from '../middleware/rbac.middleware'")) {
    content = content.replace(
      /import \{ requireRole \} from '\.\.\/middleware\/rbac\.middleware';\n/g,
      ''
    );
    if (content.includes("from '../middleware/auth.middleware'")) {
      content = content.replace(
        /import \{ authenticate \} from '\.\.\/middleware\/auth\.middleware';/g,
        "import { authenticate, requireRole } from '../middleware/auth.middleware';"
      );
      content = content.replace(
        /import \{ authenticate, optionalAuth \} from '\.\.\/middleware\/auth\.middleware';/g,
        "import { authenticate, optionalAuth, requireRole } from '../middleware/auth.middleware';"
      );
    } else {
      content = `import { requireRole } from '../middleware/auth.middleware';\n${content}`;
    }
  }

  content = content.replace(
    /import \{ UserRole \} from '\.\.\/models\/User';\n/g,
    ''
  );
  content = content.replace(
    /import \{ UserRole \} from '\.\.\/models\/user\.model';\n/g,
    ''
  );
  content = content.replace(
    /import type \{ UserRole \} from '\.\.\/models\/user\.model';\n/g,
    ''
  );

  content = content.replace(
    /requireRole\(\[UserRole\.ADMIN, UserRole\.SUPER_ADMIN, UserRole\.SUPPORT\] as UserRole\[\]\)/g,
    "requireRole(['admin'])"
  );
  content = content.replace(
    /requireRole\(\[UserRole\.ADMIN, UserRole\.SUPER_ADMIN, UserRole\.PROVIDER\] as UserRole\[\]\)/g,
    "requireRole(['admin', 'provider'])"
  );
  content = content.replace(
    /requireRole\(\[UserRole\.ADMIN, UserRole\.SUPER_ADMIN\] as UserRole\[\]\)/g,
    "requireRole(['admin'])"
  );
  content = content.replace(
    /requireRole\(\[UserRole\.ADMIN\] as UserRole\[\]\)/g,
    "requireRole(['admin'])"
  );
  content = content.replace(
    /\[UserRole\.ADMIN, UserRole\.SUPER_ADMIN\]\.includes\(req\.user\.role as UserRole\)/g,
    "['admin'].includes(req.user.role)"
  );
  content = content.replace(
    /req\.user\?\.role === UserRole\.PROVIDER/g,
    "req.user?.role === 'provider'"
  );
  content = content.replace(
    /req\.user\?\.role === UserRole\.CUSTOMER/g,
    "req.user?.role === 'customer'"
  );
  content = content.replace(
    /req\.user\?\.role === UserRole\.ADMIN/g,
    "req.user?.role === 'admin'"
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', file);
  }
}

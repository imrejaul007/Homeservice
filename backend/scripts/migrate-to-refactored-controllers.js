#!/usr/bin/env node

/**
 * Migration Script: Swap to Refactored Controllers
 *
 * This script migrates from the oversized controllers to the new service-layer architecture.
 *
 * Usage:
 *   node scripts/migrate-to-refactored-controllers.js [--dry-run|--execute|--rollback]
 *
 * Options:
 *   --dry-run   Preview changes without applying them
 *   --execute   Apply the migration
 *   --rollback  Revert to original controllers
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ROUTES_DIR = path.join(ROOT_DIR, 'src/routes');
const CONTROLLERS_DIR = path.join(ROOT_DIR, 'src/controllers');

// ============================================
// File Changes
// ============================================

const migrations = [
  {
    file: 'auth.routes.ts',
    changes: [
      {
        find: "import authController from '../controllers/auth.controller';",
        replace: "import authController from '../controllers/auth.controller.refactored';",
        description: 'Use refactored auth controller with service layer'
      }
    ]
  },
  {
    file: 'booking.routes.ts',
    changes: [
      {
        find: "} from '../controllers/booking.controller';",
        replace: "} from '../controllers/booking.controller.refactored';",
        description: 'Use refactored booking controller with service layer'
      }
    ]
  }
];

// ============================================
// Backup originals before migration
// ============================================

function backupFile(filePath) {
  const backupPath = filePath + '.backup-pre-service-refactor';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`  ✓ Created backup: ${path.basename(filePath)}.backup-pre-service-refactor`);
  } else {
    console.log(`  - Backup already exists: ${path.basename(filePath)}.backup-pre-service-refactor`);
  }
}

// ============================================
// Apply migration
// ============================================

function applyMigration(dryRun = false) {
  console.log('\n' + '='.repeat(60));
  console.log('Migration: Service Layer Refactor');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes applied)' : 'EXECUTE'}`);
  console.log('');

  for (const migration of migrations) {
    const filePath = path.join(ROUTES_DIR, migration.file);

    if (!fs.existsSync(filePath)) {
      console.log(`✗ File not found: ${migration.file}`);
      continue;
    }

    console.log(`\n📄 Processing: ${migration.file}`);

    // Create backup first (only during actual execution)
    if (!dryRun) {
      backupFile(filePath);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    for (const change of migration.changes) {
      if (content.includes(change.find)) {
        if (dryRun) {
          console.log(`  🔍 Would change:`);
          console.log(`     FROM: ${change.find}`);
          console.log(`     TO:   ${change.replace}`);
        } else {
          content = content.replace(change.find, change.replace);
          console.log(`  ✓ Applied: ${change.description}`);
        }
        hasChanges = true;
      } else if (content.includes(change.replace)) {
        console.log(`  - Already migrated: ${change.description}`);
      } else {
        console.log(`  ⚠ Could not find: ${change.find}`);
      }
    }

    if (!dryRun && hasChanges) {
      fs.writeFileSync(filePath, content);
      console.log(`  ✓ Saved: ${migration.file}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (dryRun) {
    console.log('DRY RUN COMPLETE - No changes applied');
    console.log('Run with --execute to apply changes');
  } else {
    console.log('MIGRATION COMPLETE');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run tests: npm run test -- --testPathPattern="services/__tests__"');
    console.log('  2. Start dev server: npm run dev');
    console.log('  3. Test auth flow: POST /api/auth/register/customer');
    console.log('  4. Test booking flow: POST /api/bookings');
  }

  console.log('='.repeat(60) + '\n');
}

// ============================================
// Rollback migration
// ============================================

function rollbackMigration() {
  console.log('\n' + '='.repeat(60));
  console.log('Rollback: Reverting to Original Controllers');
  console.log('='.repeat(60) + '\n');

  for (const migration of migrations) {
    const filePath = path.join(ROUTES_DIR, migration.file);
    const backupPath = filePath + '.backup-pre-service-refactor';

    if (!fs.existsSync(backupPath)) {
      console.log(`✗ No backup found for: ${migration.file}`);
      continue;
    }

    console.log(`Restoring: ${migration.file}`);

    // Restore from backup
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);

    console.log(`  ✓ Restored from backup`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('ROLLBACK COMPLETE');
  console.log('='.repeat(60) + '\n');
}

// ============================================
// Verify service layer files exist
// ============================================

function verifyServiceLayer() {
  console.log('\n' + '='.repeat(60));
  console.log('Verifying Service Layer Files');
  console.log('='.repeat(60) + '\n');

  const requiredFiles = [
    'src/services/auth.service.ts',
    'src/services/booking.service.ts',
    'src/services/index.ts',
    'src/dto/auth.dto.ts',
    'src/dto/booking.dto.ts',
    'src/controllers/auth.controller.refactored.ts',
    'src/controllers/booking.controller.refactored.ts',
  ];

  let allExist = true;

  for (const file of requiredFiles) {
    const filePath = path.join(ROOT_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`  ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  ✗ ${file} - MISSING`);
      allExist = false;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allExist) {
    console.log('All service layer files verified!');
  } else {
    console.log('Some files are missing. Run the migration after creating them.');
  }

  console.log('='.repeat(60) + '\n');

  return allExist;
}

// ============================================
// Main
// ============================================

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--dry-run';

  switch (command) {
    case '--dry-run':
      verifyServiceLayer();
      applyMigration(true);
      break;

    case '--execute':
      if (verifyServiceLayer()) {
        applyMigration(false);
      }
      break;

    case '--rollback':
      rollbackMigration();
      break;

    case '--verify':
      verifyServiceLayer();
      break;

    default:
      console.log(`
Service Layer Migration Script

Usage:
  node migrate-to-refactored-controllers.js [command]

Commands:
  --dry-run   Preview changes without applying them (default)
  --execute   Apply the migration
  --rollback  Revert to original controllers
  --verify    Verify service layer files exist

Examples:
  # Preview changes
  node migrate-to-refactored-controllers.js

  # Apply migration
  node migrate-to-refactored-controllers.js --execute

  # Rollback if needed
  node migrate-to-refactored-controllers.js --rollback
`);
  }
}

main();

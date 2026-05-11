#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Recursively remove directory
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

// Remove file
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

// Clean function
function clean() {
  log('🧹 Cleaning Home Service Platform...', 'blue');
  
  const itemsToClean = [
    // Node modules
    { path: 'node_modules', type: 'dir', description: 'Root node_modules' },
    { path: 'backend/node_modules', type: 'dir', description: 'Backend node_modules' },
    { path: 'frontend/node_modules', type: 'dir', description: 'Frontend node_modules' },
    
    // Build outputs
    { path: 'backend/dist', type: 'dir', description: 'Backend build output' },
    { path: 'frontend/dist', type: 'dir', description: 'Frontend build output' },
    
    // Lock files
    { path: 'package-lock.json', type: 'file', description: 'Root package-lock.json' },
    { path: 'backend/package-lock.json', type: 'file', description: 'Backend package-lock.json' },
    { path: 'frontend/package-lock.json', type: 'file', description: 'Frontend package-lock.json' },
    
    // Logs
    { path: 'backend/logs', type: 'dir', description: 'Backend logs' },
    { path: 'logs', type: 'dir', description: 'Root logs' },
    
    // Temporary files
    { path: '.tmp', type: 'dir', description: 'Temporary files' },
    { path: 'tmp', type: 'dir', description: 'Temporary directory' },
    
    // Coverage reports
    { path: 'coverage', type: 'dir', description: 'Test coverage reports' },
    { path: 'backend/coverage', type: 'dir', description: 'Backend coverage' },
    { path: 'frontend/coverage', type: 'dir', description: 'Frontend coverage' },
    
    // OS specific
    { path: '.DS_Store', type: 'file', description: 'macOS .DS_Store' },
    { path: 'Thumbs.db', type: 'file', description: 'Windows Thumbs.db' },
  ];
  
  let cleaned = 0;
  let skipped = 0;
  
  for (const item of itemsToClean) {
    if (item.type === 'dir' ? removeDir(item.path) : removeFile(item.path)) {
      log(`✅ Removed: ${item.description}`, 'green');
      cleaned++;
    } else {
      log(`⏭️  Skipped: ${item.description} (not found)`, 'cyan');
      skipped++;
    }
  }
  
  log(`\n📊 Cleanup Summary:`, 'blue');
  log(`• Cleaned: ${cleaned} items`, 'green');
  log(`• Skipped: ${skipped} items (not found)`, 'cyan');
  
  if (cleaned > 0) {
    log('\n♻️  To restore your development environment:', 'yellow');
    log('1. npm run setup', 'cyan');
    log('2. npm run dev', 'cyan');
  }
  
  log('\n✨ Cleanup complete!', 'green');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  log('🧹 Home Service Platform - Clean Script', 'blue');
  log('\nThis script removes generated files and dependencies:', 'cyan');
  log('• node_modules directories', 'yellow');
  log('• Build outputs (dist folders)', 'yellow');
  log('• Lock files', 'yellow');
  log('• Log files', 'yellow');
  log('• Temporary files', 'yellow');
  log('• Test coverage reports', 'yellow');
  log('\nUsage:', 'blue');
  log('npm run clean', 'cyan');
  log('node scripts/clean.js', 'cyan');
  log('\nOptions:', 'blue');
  log('--help, -h    Show this help message', 'cyan');
  process.exit(0);
}

// Run cleanup
clean();
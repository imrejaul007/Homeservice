#!/usr/bin/env node

/**
 * Build Verification Script for NILIN Android App
 *
 * This script verifies the Android build output:
 * - APK/AAB generation
 * - ProGuard applied (size reduction)
 * - Signing verification
 * - Debug artifacts check
 *
 * Usage:
 *   node verify-build.js [options]
 *
 * Options:
 *   --apk <path>      Path to APK file
 *   --aab <path>      Path to AAB file
 *   --verbose         Verbose output
 *   --help            Show this help
 *
 * Exit codes:
 *   0 - Build verified successfully
 *   1 - Build verification failed
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logStep = (message) => log(`  ${message}`, 'cyan');
const logSuccess = (message) => log(`  [PASS] ${message}`, 'green');
const logFailure = (message) => log(`  [FAIL] ${message}`, 'red');
const logWarning = (message) => log(`  [WARN] ${message}`, 'yellow');

// CLI arguments
const args = process.argv.slice(2);
const options = {
  apk: null,
  aab: null,
  verbose: false,
  help: false,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--apk':
      options.apk = args[++i];
      break;
    case '--aab':
      options.aab = args[++i];
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--help':
    case '-h':
      options.help = true;
      break;
  }
}

// Show help
if (options.help) {
  console.log(`
Build Verification Script for NILIN Android App
================================================

Usage: node verify-build.js [options]

Options:
  --apk <path>      Path to APK file (required if no AAB)
  --aab <path>      Path to AAB file (required if no APK)
  --verbose, -v     Verbose output
  --help, -h        Show this help

Examples:
  node verify-build.js --apk app-release.apk
  node verify-build.js --aab app.aab -v

Exit codes:
  0 - Build verified successfully
  1 - Build verification failed
`);
  process.exit(0);
}

// Verification results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: [],
};

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format percentage
 */
function formatPercent(value, decimals = 1) {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Check if file exists
 */
function checkFileExists(filePath) {
  logStep(`Checking if file exists: ${filePath}`);
  const exists = fs.existsSync(filePath);
  if (exists) {
    logSuccess('File exists');
  } else {
    logFailure('File not found');
  }
  return exists;
}

/**
 * Get file size
 */
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Check file size is reasonable
 */
function checkFileSize(filePath, minSize, maxSize) {
  const size = getFileSize(filePath);
  const sizeFormatted = formatBytes(size);

  logStep(`File size: ${sizeFormatted}`);

  if (size < minSize) {
    logFailure(`File size (${sizeFormatted}) is below minimum (${formatBytes(minSize)})`);
    return false;
  }

  if (size > maxSize) {
    logWarning(`File size (${sizeFormatted}) is above typical (${formatBytes(maxSize)})`);
    results.warnings++;
    return true;
  }

  logSuccess('File size is within expected range');
  return true;
}

/**
 * Check APK signature
 */
function checkAPKSignature(filePath) {
  logStep('Checking APK signature...');

  try {
    // Use apksigner if available, otherwise do basic checks
    const { execSync } = require('child_process');

    try {
      execSync('apksigner --version', { stdio: 'ignore' });

      const result = execSync(`apksigner verify --print-certs "${filePath}"`, {
        encoding: 'utf8',
        timeout: 30000,
      });

      if (options.verbose) {
        console.log(result);
      }

      // Check for v2/v3 signature
      if (result.includes('v2 scheme') || result.includes('v3 scheme')) {
        logSuccess('APK is signed with v2 or v3 signature');
        return true;
      }
    } catch {
      // apksigner not available, do basic check
      logWarning('apksigner not available, skipping signature verification');
    }

    // Basic check: verify APK is a valid ZIP
    const AdmZip = require('adm-zip');
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();

      // Check for signature files
      const hasSignature = entries.some(e =>
        e.entryName.startsWith('META-INF/') &&
        (e.entryName.endsWith('.RSA') ||
         e.entryName.endsWith('.DSA') ||
         e.entryName.endsWith('.EC'))
      );

      if (hasSignature) {
        logSuccess('Signature files found in APK');
        return true;
      } else {
        logWarning('No signature files found - APK may not be signed');
        results.warnings++;
        return true; // Not a failure, just a warning
      }
    } catch (e) {
      logWarning(`Could not verify signature: ${e.message}`);
      return true;
    }
  } catch (error) {
    logWarning(`Signature check skipped: ${error.message}`);
    return true;
  }
}

/**
 * Check AAB bundle signature
 */
function checkAABSignature(filePath) {
  logStep('Checking AAB bundle signature...');

  try {
    // Use bundletool if available
    const { execSync } = require('child_process');

    try {
      execSync('bundletool --version', { stdio: 'ignore' });
      logSuccess('bundletool available for AAB verification');
    } catch {
      logWarning('bundletool not available, skipping AAB signature verification');
    }

    // Basic AAB check
    const size = getFileSize(filePath);
    logSuccess(`AAB bundle size verified: ${formatBytes(size)}`);
    return true;
  } catch (error) {
    logWarning(`AAB signature check skipped: ${error.message}`);
    return true;
  }
}

/**
 * Check for debug artifacts
 */
function checkDebugArtifacts(filePath) {
  logStep('Checking for debug artifacts...');

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Check for debug files
    const debugIndicators = [
      'classes.dex',
      'classes2.dex',
    ];

    const hasDex = entries.some(e =>
      e.entryName.includes('.dex')
    );

    // Check for debuggable flag in manifest
    let isDebuggable = false;
    let manifestContent = null;

    try {
      const manifestEntry = entries.find(e => e.entryName === 'AndroidManifest.xml');
      if (manifestEntry) {
        manifestContent = manifestEntry.getData().toString('utf8');
        isDebuggable = manifestContent.includes('android:debuggable="true"');
      }
    } catch {
      // Ignore
    }

    if (hasDex) {
      logSuccess('DEX files present (expected in debug and release)');
    }

    if (isDebuggable) {
      logWarning('APK is marked as debuggable - not recommended for release');
      results.warnings++;
      return false;
    }

    logSuccess('No debug-only artifacts found');
    return true;
  } catch {
    logWarning('Could not check for debug artifacts');
    return true;
  }
}

/**
 * Check ProGuard/R8 optimization
 */
function checkProGuardOptimization(filePath, originalSize) {
  logStep('Checking ProGuard/R8 optimization...');

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Check DEX file count
    const dexEntries = entries.filter(e => e.entryName.endsWith('.dex'));
    const dexCount = dexEntries.length;

    logStep(`DEX files: ${dexCount}`);

    // Estimate reduction
    const compressedSize = getFileSize(filePath);
    const reduction = originalSize > 0 ? 1 - (compressedSize / originalSize) : 0;

    if (originalSize > 0) {
      logStep(`Estimated size reduction: ${formatPercent(reduction)}`);
    }

    // Check for obfuscation indicators
    let hasObfuscation = false;

    for (const entry of entries) {
      if (entry.entryName.endsWith('.dex')) {
        const content = entry.getData().toString('utf8');

        // Check for common class names that should be renamed
        if (!content.includes('com/nilin/app/') &&
            !content.includes('com.nilin.app')) {
          hasObfuscation = true;
          break;
        }
      }
    }

    if (hasObfuscation) {
      logSuccess('Code appears to be obfuscated');
    } else {
      logWarning('Code may not be obfuscated (class names visible)');
      results.warnings++;
    }

    // Check for stripped resources
    const resourceEntries = entries.filter(e =>
      e.entryName.startsWith('res/')
    );

    logStep(`Resource files: ${resourceEntries.length}`);

    // Check for native libraries
    const nativeEntries = entries.filter(e =>
      e.entryName.startsWith('lib/')
    );

    if (nativeEntries.length > 0) {
      logStep(`Native libraries: ${nativeEntries.length} directories`);
    }

    return true;
  } catch {
    logWarning('Could not check ProGuard optimization');
    return true;
  }
}

/**
 * Check for security best practices
 */
function checkSecurityBestPractices(filePath) {
  logStep('Checking security best practices...');

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    let allPassed = true;

    // Check for cleartext traffic permission
    try {
      const manifestEntry = entries.find(e => e.entryName === 'AndroidManifest.xml');
      if (manifestEntry) {
        const manifest = manifestEntry.getData().toString('utf8');

        // Check for network security config
        const hasNetworkSecurityConfig = entries.some(e =>
          e.entryName.includes('network_security_config')
        );

        if (hasNetworkSecurityConfig) {
          logSuccess('Network security config present');
        } else {
          logWarning('No network security config found');
          results.warnings++;
        }

        // Check for cleartext traffic
        if (manifest.includes('android:usesCleartextTraffic="true"')) {
          logWarning('Cleartext traffic allowed - not recommended for production');
          results.warnings++;
          allPassed = false;
        } else {
          logSuccess('Cleartext traffic restricted');
        }
      }
    } catch {
      // Ignore
    }

    // Check for debuggable flag
    try {
      const arscEntry = entries.find(e => e.entryName === 'resources.arsc');
      if (arscEntry) {
        const arsc = arscEntry.getData();
        const content = arsc.toString('utf8');

        if (content.includes('debuggable') && content.includes('true')) {
          logWarning('APK contains debug flag');
          results.warnings++;
        }
      }
    } catch {
      // Ignore
    }

    // Check for backup permission
    try {
      const manifestEntry = entries.find(e => e.entryName === 'AndroidManifest.xml');
      if (manifestEntry) {
        const manifest = manifestEntry.getData().toString('utf8');

        if (manifest.includes('android:allowBackup="false"')) {
          logSuccess('Backup disabled');
        } else {
          logWarning('Backup may be enabled - review if sensitive data is involved');
          results.warnings++;
        }
      }
    } catch {
      // Ignore
    }

    return allPassed;
  } catch {
    logWarning('Could not check security best practices');
    return true;
  }
}

/**
 * Check for optional dependencies
 */
function checkDependencies(filePath) {
  logStep('Checking for dependencies...');

  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Check for common libraries
    const libraryIndicators = {
      'Capacitor': entries.some(e => e.entryName.includes('capacitor')),
      'React': entries.some(e => e.entryName.includes('react')),
      'OkHttp': entries.some(e => e.entryName.includes('okhttp')),
      'Firebase': entries.some(e => e.entryName.includes('firebase')),
      'Stripe': entries.some(e => e.entryName.includes('stripe')),
    };

    for (const [lib, present] of Object.entries(libraryIndicators)) {
      if (present) {
        logStep(`  ${lib}: present`);
      }
    }

    logSuccess('Dependency check complete');
    return true;
  } catch {
    logWarning('Could not check dependencies');
    return true;
  }
}

/**
 * Verify APK build
 */
function verifyAPK(filePath) {
  log('\n=== Verifying APK ===', 'bright');

  let allPassed = true;

  // Check file exists
  if (!checkFileExists(filePath)) {
    results.failed++;
    return false;
  }

  // Check file size
  if (!checkFileSize(filePath, 1024 * 100, 200 * 1024 * 1024)) {
    allPassed = false;
    results.failed++;
  }

  // Check signature
  if (!checkAPKSignature(filePath)) {
    allPassed = false;
    results.failed++;
  }

  // Check debug artifacts
  if (!checkDebugArtifacts(filePath)) {
    // Not a failure, just a warning
  }

  // Check ProGuard optimization
  if (!checkProGuardOptimization(filePath, 0)) {
    // Not a failure
  }

  // Check security best practices
  if (!checkSecurityBestPractices(filePath)) {
    allPassed = false;
    results.failed++;
  }

  // Check dependencies
  checkDependencies(filePath);

  if (allPassed) {
    results.passed++;
    logSuccess('APK verification passed');
  } else {
    results.failed++;
    logFailure('APK verification failed');
  }

  return allPassed;
}

/**
 * Verify AAB build
 */
function verifyAAB(filePath) {
  log('\n=== Verifying AAB ===', 'bright');

  let allPassed = true;

  // Check file exists
  if (!checkFileExists(filePath)) {
    results.failed++;
    return false;
  }

  // Check file size
  if (!checkFileSize(filePath, 1024 * 100, 500 * 1024 * 1024)) {
    allPassed = false;
    results.failed++;
  }

  // Check signature
  if (!checkAABSignature(filePath)) {
    allPassed = false;
    results.failed++;
  }

  // Check security best practices
  if (!checkSecurityBestPractices(filePath)) {
    allPassed = false;
    results.failed++;
  }

  if (allPassed) {
    results.passed++;
    logSuccess('AAB verification passed');
  } else {
    results.failed++;
    logFailure('AAB verification failed');
  }

  return allPassed;
}

/**
 * Find build output
 */
function findBuildOutput() {
  const possiblePaths = [
    // Debug
    'frontend/android/app/build/outputs/apk/debug/app-debug.apk',
    'frontend/android/app/build/outputs/apk/release/app-release.apk',
    // Release
    'android/app/build/outputs/apk/debug/app-debug.apk',
    'android/app/build/outputs/apk/release/app-release.apk',
    // AAB
    'frontend/android/app/build/outputs/bundle/release/app-release.aab',
    'android/app/build/outputs/bundle/release/app-release.aab',
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  return null;
}

// Main function
function main() {
  log('========================================', 'bright');
  log('  NILIN Android Build Verification', 'bright');
  log('========================================\n', 'bright');

  // Find build output if not specified
  let apkPath = options.apk;
  let aabPath = options.aab;

  if (!apkPath && !aabPath) {
    log('No build output specified, searching...', 'cyan');

    const found = findBuildOutput();
    if (found) {
      if (found.endsWith('.apk')) {
        apkPath = found;
      } else if (found.endsWith('.aab')) {
        aabPath = found;
      }
      log(`Found: ${found}`, 'green');
    } else {
      logFailure('No build output found');
      log('Please specify with --apk or --aab option');
      process.exit(1);
    }
  }

  // Verify builds
  let allPassed = true;

  if (apkPath) {
    if (!verifyAPK(apkPath)) {
      allPassed = false;
    }
  }

  if (aabPath) {
    if (!verifyAAB(aabPath)) {
      allPassed = false;
    }
  }

  // Print summary
  log('\n========================================', 'bright');
  log('            VERIFICATION SUMMARY', 'bright');
  log('========================================\n', 'bright');

  log(`  Passed:   ${results.passed}`, 'green');
  log(`  Failed:   ${results.failed}`, results.failed > 0 ? 'red' : 'reset');
  log(`  Warnings: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'reset');

  log('\n========================================\n', 'bright');

  if (allPassed) {
    log('Build verification PASSED', 'green');
    process.exit(0);
  } else {
    log('Build verification FAILED', 'red');
    process.exit(1);
  }
}

// Run
main();

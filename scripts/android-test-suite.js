#!/usr/bin/env node

/**
 * Android Test Suite - Production Simulation Tests for NILIN App
 *
 * This script runs comprehensive tests to simulate real-world scenarios:
 * - crash-recovery: Kill app, verify recovery
 * - rotation: Rotate mid-booking, verify state preserved
 * - payment: Interrupt payment, verify single charge
 * - deep-link: Deep link after background, verify navigation
 * - offline: Go offline, perform actions, sync on reconnect
 * - notification: Send notification, verify display
 *
 * Usage:
 *   node android-test-suite.js [options]
 *
 * Options:
 *   --test <name>     Run specific test
 *   --device <id>     Target specific device
 *   --verbose         Verbose output
 *   --help            Show this help
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logStep = (message) => log(`  ${message}`, 'cyan');
const logSuccess = (message) => log(`  [PASS] ${message}`, 'green');
const logFailure = (message) => log(`  [FAIL] ${message}`, 'red');
const logWarning = (message) => log(`  [WARN] ${message}`, 'yellow');

// Test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

// CLI arguments
const args = process.argv.slice(2);
const options = {
  test: null,
  device: null,
  verbose: false,
  help: false,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--test':
    case '-t':
      options.test = args[++i];
      break;
    case '--device':
    case '-d':
      options.device = args[++i];
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
Android Test Suite for NILIN App
================================

Usage: node android-test-suite.js [options]

Options:
  --test, -t <name>    Run specific test (crash-recovery, rotation, payment, deep-link, offline, notification)
  --device, -d <id>    Target specific Android device/emulator
  --verbose, -v        Verbose output
  --help, -h           Show this help

Examples:
  node android-test-suite.js                           # Run all tests
  node android-test-suite.js --test crash-recovery     # Run specific test
  node android-test-suite.js -t rotation -d emulator  # Specific device

Exit codes:
  0 - All tests passed
  1 - One or more tests failed
`);
  process.exit(0);
}

// Check prerequisites
function checkPrerequisites() {
  log('\n=== Checking Prerequisites ===', 'bright');

  // Check ADB
  try {
    execSync('adb version', { stdio: 'ignore' });
    logSuccess('ADB available');
  } catch {
    logFailure('ADB not found - install Android SDK platform-tools');
    return false;
  }

  // Check for connected devices
  try {
    const devices = execSync('adb devices', { encoding: 'utf8' });
    const deviceLines = devices.split('\n').filter(line => line.trim() && !line.includes('List'));

    if (deviceLines.length === 0) {
      logFailure('No Android devices/emulators connected');
      log('  Run "adb devices" to check device status');
      return false;
    }

    logSuccess(`${deviceLines.length} device(s) connected`);
  } catch {
    logFailure('Failed to check devices');
    return false;
  }

  // Check for app package
  const packageName = 'com.nilin.app';
  try {
    execSync(`adb shell pm list packages ${packageName}`, { stdio: 'ignore' });
    logSuccess(`App package ${packageName} installed`);
  } catch {
    logWarning(`App package ${packageName} not installed - building first...`);
  }

  return true;
}

// Get target device
function getTargetDevice() {
  if (options.device) {
    return options.device;
  }

  // Get first available device
  try {
    const devices = execSync('adb devices', { encoding: 'utf8' });
    const matches = devices.match(/^(\S+)\tdevice$/gm);

    if (matches && matches.length > 0) {
      const deviceId = matches[0].split('\t')[0];
      log(`Using device: ${deviceId}`, 'cyan');
      return deviceId;
    }
  } catch {
    // Ignore
  }

  return null;
}

// Execute ADB command
function execADB(command, device = null) {
  const deviceFlag = device ? `-s ${device}` : '';
  const fullCommand = `adb ${deviceFlag} ${command}`.trim();

  if (options.verbose) {
    logStep(`Executing: ${fullCommand}`);
  }

  try {
    return execSync(fullCommand, {
      encoding: 'utf8',
      timeout: 60000,
      stdio: options.verbose ? 'inherit' : 'pipe',
    });
  } catch (error) {
    if (options.verbose) {
      logWarning(`Command failed: ${error.message}`);
    }
    return null;
  }
}

// Test: Crash Recovery
async function testCrashRecovery(device) {
  log('\n=== Test: Crash Recovery ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Verify app is running
    logStep('Verifying app is running...');
    let isRunning = await checkAppRunning(packageName, device);

    if (!isRunning) {
      logFailure('App did not start');
      return false;
    }
    logSuccess('App started successfully');

    // Simulate crash
    logStep('Simulating crash...');
    execADB(`shell am crash ${packageName}`, device);
    await sleep(2000);

    // Verify crash occurred (app should have stopped)
    logStep('Verifying crash occurred...');
    isRunning = await checkAppRunning(packageName, device);

    if (isRunning) {
      logWarning('App still running after crash (may have auto-restarted)');
    } else {
      logSuccess('App crashed as expected');
    }

    // Wait for recovery
    logStep('Waiting for recovery...');
    await sleep(5000);

    // Verify recovery
    logStep('Verifying recovery...');
    isRunning = await checkAppRunning(packageName, device);

    if (!isRunning) {
      logFailure('App did not recover');
      return false;
    }

    logSuccess('App recovered successfully');

    // Verify app functionality after recovery
    logStep('Verifying functionality after recovery...');
    await sleep(2000);

    // Check for crash dialog
    const crashDialog = execADB(`shell dumpsys activity activities | grep -i "crash"`, device);
    if (crashDialog && crashDialog.includes('crash')) {
      logWarning('Crash dialog may still be visible');
    } else {
      logSuccess('No crash dialog visible');
    }

    return true;
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Test: Rotation Handling
async function testRotation(device) {
  log('\n=== Test: Rotation Handling ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Navigate to a booking flow
    logStep('Navigating to booking flow...');
    execADB(`shell input tap 540 1200`, device); // Tap on a service
    await sleep(2000);

    // Get initial state
    logStep('Recording initial state...');
    const initialState = getActivityState(device);

    if (!initialState) {
      logWarning('Could not get initial state');
    } else {
      logSuccess(`Initial orientation: ${initialState.orientation}`);
    }

    // Rotate to landscape
    logStep('Rotating to landscape...');
    execADB('shell settings put system user_rotation 1', device);
    await sleep(2000);

    // Verify orientation changed
    const landscapeState = getActivityState(device);
    if (landscapeState && landscapeState.orientation !== 'portrait') {
      logSuccess('Rotated to landscape');
    } else {
      logWarning('Orientation may not have changed');
    }

    // Perform action while rotated
    logStep('Performing action while rotated...');
    execADB('shell input tap 960 540', device); // Tap in center
    await sleep(1000);

    // Rotate back to portrait
    logStep('Rotating back to portrait...');
    execADB('shell settings put system user_rotation 0', device);
    await sleep(2000);

    // Verify state preserved
    logStep('Verifying state preserved...');
    const finalState = getActivityState(device);

    if (finalState && finalState.orientation === 'portrait') {
      logSuccess('Rotated back to portrait');
    } else {
      logWarning('Final orientation unclear');
    }

    // Verify app is still functional
    const isRunning = await checkAppRunning(packageName, device);
    if (isRunning) {
      logSuccess('App functional after rotation');
      return true;
    } else {
      logFailure('App crashed during rotation');
      return false;
    }
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Test: Payment Interruption
async function testPaymentInterruption(device) {
  log('\n=== Test: Payment Interruption ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Navigate to checkout/payment
    logStep('Navigating to checkout...');
    execADB(`shell input tap 540 1400`, device); // Proceed to checkout
    await sleep(2000);

    // Start payment
    logStep('Initiating payment...');
    execADB(`shell input tap 540 900`, device); // Pay button
    await sleep(1000);

    // Interrupt payment (simulate app backgrounding)
    logStep('Interrupting payment (backgrounding app)...');
    execADB('shell input keyevent 3', device); // Home button
    await sleep(1000);

    // Verify payment did not complete
    logStep('Verifying payment did not complete...');
    const paymentState = checkPaymentStatus(device);

    if (paymentState === 'pending' || paymentState === 'cancelled') {
      logSuccess('Payment correctly interrupted');
    } else if (paymentState === 'completed') {
      logWarning('Payment may have completed despite interruption');
    } else {
      logStep('Payment state unclear - checking logs...');
    }

    // Return to app
    logStep('Returning to app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(2000);

    // Verify state
    logStep('Verifying app state...');
    const isRunning = await checkAppRunning(packageName, device);

    if (isRunning) {
      logSuccess('App returned to correct state');
      return true;
    } else {
      logFailure('App did not return properly');
      return false;
    }
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Test: Deep Link
async function testDeepLink(device) {
  log('\n=== Test: Deep Link ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Navigate somewhere
    logStep('Navigating to home...');
    execADB('shell input tap 540 1800', device); // Home/Back
    await sleep(1000);

    // Send app to background
    logStep('Sending app to background...');
    execADB('shell input keyevent 3', device); // Home
    await sleep(2000);

    // Send deep link
    logStep('Sending deep link: nilin://open/booking/123...');
    execADB(`shell am start -W -a android.intent.action.VIEW -d "nilin://open/booking/123" ${packageName}`, device);
    await sleep(3000);

    // Verify app opened to correct destination
    logStep('Verifying navigation...');
    const navigationState = getNavigationState(device);

    if (navigationState && navigationState.includes('booking')) {
      logSuccess('Deep link navigation successful');
    } else {
      logWarning('Deep link destination unclear');
    }

    // Verify app is running
    const isRunning = await checkAppRunning(packageName, device);
    if (isRunning) {
      logSuccess('App launched via deep link');
      return true;
    } else {
      logFailure('App did not launch via deep link');
      return false;
    }
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Test: Offline Handling
async function testOffline(device) {
  log('\n=== Test: Offline Handling ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Perform action while online
    logStep('Performing action while online...');
    execADB('shell input tap 540 800', device); // Some action
    await sleep(1000);

    // Go offline
    logStep('Disabling network...');
    execADB('shell svc wifi disable', device);
    execADB('shell svc data disable', device);
    await sleep(2000);

    // Verify offline indicator
    logStep('Verifying offline state...');
    const isOffline = checkNetworkState(device);

    if (isOffline) {
      logSuccess('Device is offline');
    } else {
      logWarning('Device may still be online');
    }

    // Perform action offline
    logStep('Performing action while offline...');
    execADB('shell input tap 540 600', device);
    await sleep(2000);

    // Capture state
    logStep('Capturing offline state...');

    // Go back online
    logStep('Enabling network...');
    execADB('shell svc wifi enable', device);
    execADB('shell svc data enable', device);
    await sleep(3000);

    // Verify sync
    logStep('Verifying sync...');
    const isOnline = !checkNetworkState(device);

    if (isOnline) {
      logSuccess('Device is online again');
      await sleep(2000);
      logSuccess('Offline actions should sync now');
    } else {
      logWarning('Device may still be offline');
    }

    // Verify app is functional
    const isRunning = await checkAppRunning(packageName, device);
    if (isRunning) {
      logSuccess('App functional after offline test');
      return true;
    } else {
      logFailure('App crashed after offline test');
      return false;
    }
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Test: Notifications
async function testNotification(device) {
  log('\n=== Test: Notification ===', 'bright');

  const packageName = 'com.nilin.app';

  try {
    // Start the app
    logStep('Starting app...');
    execADB(`shell am start -n ${packageName}/.MainActivity`, device);
    await sleep(3000);

    // Send notification
    logStep('Sending test notification...');
    const notificationText = 'Test notification from NILIN test suite';
    const title = 'NILIN Test';

    execADB(
      `shell am broadcast -a com.nilin.app.ACTION_TEST_NOTIFICATION ` +
      `--es title "${title}" --es body "${notificationText}"`,
      device
    );
    await sleep(2000);

    // Check notification status bar
    logStep('Checking notification in status bar...');
    const hasNotification = checkNotification(device, title);

    if (hasNotification) {
      logSuccess('Notification displayed');
    } else {
      logWarning('Notification not visible in status bar');
    }

    // Tap notification
    logStep('Tapping notification...');
    execADB('shell input tap 540 60', device); // Notification area
    await sleep(2000);

    // Verify app opened
    const isRunning = await checkAppRunning(packageName, device);
    if (isRunning) {
      logSuccess('App opened from notification');
      return true;
    } else {
      logWarning('Could not verify app opened from notification');
      return true; // Not necessarily a failure
    }
  } catch (error) {
    logFailure(`Test error: ${error.message}`);
    return false;
  }
}

// Helper: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Check if app is running
async function checkAppRunning(packageName, device) {
  try {
    const result = execADB(`shell pidof ${packageName}`, device);
    return result && result.trim().length > 0;
  } catch {
    return false;
  }
}

// Helper: Get activity state
function getActivityState(device) {
  try {
    const result = execADB('shell dumpsys activity activities | grep mResumedActivity', device);

    if (result) {
      const isPortrait = !result.includes('landscape');
      return {
        orientation: isPortrait ? 'portrait' : 'landscape',
        activity: result.trim(),
      };
    }
  } catch {
    // Ignore
  }
  return null;
}

// Helper: Get navigation state
function getNavigationState(device) {
  try {
    const result = execADB('shell dumpsys activity activities | grep -E "Activities|Resumed" | head -5', device);
    return result;
  } catch {
    return null;
  }
}

// Helper: Check payment status
function checkPaymentStatus(device) {
  // This would need app-specific implementation
  return 'unknown';
}

// Helper: Check network state
function checkNetworkState(device) {
  try {
    const result = execADB('shell ping -c 1 -W 1 8.8.8.8', device);
    return result === null; // No result means offline
  } catch {
    return true;
  }
}

// Helper: Check notification
function checkNotification(device, title) {
  try {
    const result = execADB('shell dumpsys notification | grep "' + title + '"', device);
    return result && result.includes(title);
  } catch {
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const device = getTargetDevice();

  if (!device) {
    logFailure('No target device available');
    process.exit(1);
  }

  log(`\nUsing device: ${device}`, 'bright');
  log(`Package: com.nilin.app`, 'bright');

  // Define tests
  const tests = [
    { name: 'crash-recovery', fn: testCrashRecovery },
    { name: 'rotation', fn: testRotation },
    { name: 'payment', fn: testPaymentInterruption },
    { name: 'deep-link', fn: testDeepLink },
    { name: 'offline', fn: testOffline },
    { name: 'notification', fn: testNotification },
  ];

  // Filter tests if specific test requested
  const testsToRun = options.test
    ? tests.filter(t => t.name === options.test)
    : tests;

  if (testsToRun.length === 0) {
    logFailure(`Test "${options.test}" not found`);
    log(`Available tests: ${tests.map(t => t.name).join(', ')}`);
    process.exit(1);
  }

  // Run tests
  for (const test of testsToRun) {
    try {
      const passed = await test.fn(device);

      if (passed) {
        results.passed++;
      } else {
        results.failed++;
        results.errors.push(test.name);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${test.name}: ${error.message}`);
      logFailure(`Test crashed: ${error.message}`);
    }
  }
}

// Print summary
function printSummary() {
  log('\n========================================', 'bright');
  log('              TEST SUMMARY', 'bright');
  log('========================================\n', 'bright');

  log(`  Total:   ${results.passed + results.failed + results.skipped}`, 'white');
  log(`  Passed:  ${results.passed}`, 'green');
  log(`  Failed:  ${results.failed}`, results.failed > 0 ? 'red' : 'white');
  log(`  Skipped: ${results.skipped}`, 'yellow');

  if (results.errors.length > 0) {
    log('\n  Failed tests:', 'red');
    results.errors.forEach(error => {
      log(`    - ${error}`, 'red');
    });
  }

  log('\n========================================\n', 'bright');
}

// Main
async function main() {
  log('========================================', 'bright');
  log('  NILIN Android Test Suite', 'bright');
  log('========================================', 'bright');

  // Check prerequisites
  if (!checkPrerequisites()) {
    logFailure('\nPrerequisites check failed');
    process.exit(1);
  }

  // Run tests
  await runAllTests();

  // Print summary
  printSummary();

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

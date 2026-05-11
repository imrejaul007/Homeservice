#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

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

// Verification checks
const verificationChecks = [
  {
    name: 'Project Structure',
    check: () => {
      const requiredPaths = [
        'package.json',
        'backend/package.json',
        'frontend/package.json',
        'backend/src/server.ts',
        'frontend/src/App.tsx',
        'docs'
      ];
      
      const missing = requiredPaths.filter(p => !fs.existsSync(p));
      return {
        success: missing.length === 0,
        details: missing.length === 0 ? 'All required files present' : `Missing: ${missing.join(', ')}`
      };
    }
  },
  {
    name: 'Environment Files',
    check: () => {
      const envFiles = ['backend/.env', 'frontend/.env'];
      const missing = envFiles.filter(f => !fs.existsSync(f));
      return {
        success: missing.length === 0,
        details: missing.length === 0 ? 'Environment files configured' : `Missing: ${missing.join(', ')}`
      };
    }
  },
  {
    name: 'Dependencies Installed',
    check: () => {
      const nodeModules = [
        'node_modules',
        'backend/node_modules',
        'frontend/node_modules'
      ];
      const missing = nodeModules.filter(nm => !fs.existsSync(nm));
      return {
        success: missing.length === 0,
        details: missing.length === 0 ? 'All dependencies installed' : `Missing node_modules: ${missing.join(', ')}`
      };
    }
  },
  {
    name: 'TypeScript Compilation (Backend)',
    check: () => {
      try {
        execSync('cd backend && npx tsc --noEmit', { stdio: 'pipe' });
        return { success: true, details: 'Backend TypeScript compiles successfully' };
      } catch (error) {
        return { success: false, details: 'Backend TypeScript compilation failed' };
      }
    }
  },
  {
    name: 'TypeScript Compilation (Frontend)',
    check: () => {
      try {
        execSync('cd frontend && npx tsc --noEmit', { stdio: 'pipe' });
        return { success: true, details: 'Frontend TypeScript compiles successfully' };
      } catch (error) {
        return { success: false, details: 'Frontend TypeScript compilation failed' };
      }
    }
  }
];

// Runtime checks (requires servers to be running)
const runtimeChecks = [
  {
    name: 'Backend Server',
    check: async () => {
      try {
        const response = await axios.get('http://localhost:5000/health', { timeout: 5000 });
        return {
          success: response.status === 200,
          details: response.data ? `Server running: ${response.data.status}` : 'Server responding'
        };
      } catch (error) {
        return { success: false, details: 'Backend server not responding (is it running?)' };
      }
    }
  },
  {
    name: 'Frontend Server',
    check: async () => {
      try {
        const response = await axios.get('http://localhost:5173', { timeout: 5000 });
        return {
          success: response.status === 200,
          details: 'Frontend server responding'
        };
      } catch (error) {
        return { success: false, details: 'Frontend server not responding (is it running?)' };
      }
    }
  },
  {
    name: 'API Connectivity',
    check: async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/test', { timeout: 5000 });
        return {
          success: response.status === 200,
          details: response.data ? response.data.message : 'API responding'
        };
      } catch (error) {
        return { success: false, details: 'API not responding' };
      }
    }
  }
];

async function runVerification() {
  log('🔍 Home Service Platform - Setup Verification\n', 'blue');

  // Run static checks
  log('📋 Running static checks...', 'cyan');
  let staticPassed = 0;
  
  for (const check of verificationChecks) {
    const result = check.check();
    if (result.success) {
      log(`✅ ${check.name}: ${result.details}`, 'green');
      staticPassed++;
    } else {
      log(`❌ ${check.name}: ${result.details}`, 'red');
    }
  }

  log(`\nStatic checks: ${staticPassed}/${verificationChecks.length} passed\n`, staticPassed === verificationChecks.length ? 'green' : 'yellow');

  // Run runtime checks
  log('🔄 Running runtime checks (requires servers to be running)...', 'cyan');
  let runtimePassed = 0;
  
  for (const check of runtimeChecks) {
    try {
      const result = await check.check();
      if (result.success) {
        log(`✅ ${check.name}: ${result.details}`, 'green');
        runtimePassed++;
      } else {
        log(`❌ ${check.name}: ${result.details}`, 'red');
      }
    } catch (error) {
      log(`❌ ${check.name}: Check failed - ${error.message}`, 'red');
    }
  }

  log(`\nRuntime checks: ${runtimePassed}/${runtimeChecks.length} passed\n`, runtimePassed === runtimeChecks.length ? 'green' : 'yellow');

  // Summary
  const totalChecks = verificationChecks.length + runtimeChecks.length;
  const totalPassed = staticPassed + runtimePassed;
  
  if (totalPassed === totalChecks) {
    log('🎉 All verification checks passed!', 'green');
    log('\nYour Home Service Platform is ready for development!', 'green');
  } else {
    log('⚠️  Some verification checks failed', 'yellow');
    log('\n📝 To fix issues:', 'blue');
    
    if (staticPassed < verificationChecks.length) {
      log('• Run: npm run setup', 'yellow');
    }
    
    if (runtimePassed < runtimeChecks.length) {
      log('• Start servers: npm run dev', 'yellow');
      log('• Check MongoDB connection', 'yellow');
      log('• Verify environment configuration', 'yellow');
    }
  }

  log('\n🔗 Quick Links:', 'blue');
  log('• Frontend: http://localhost:5173', 'cyan');
  log('• Backend API: http://localhost:5000/api', 'cyan');
  log('• Health Check: http://localhost:5000/health', 'cyan');
  log('• API Verification: http://localhost:5000/api/verify', 'cyan');
}

// Handle axios not being available
if (typeof axios === 'undefined') {
  log('⚠️  axios not found, installing...', 'yellow');
  try {
    execSync('npm install axios', { stdio: 'inherit' });
    log('✅ axios installed', 'green');
    // Restart with axios available
    execSync('node scripts/verify-setup.js', { stdio: 'inherit' });
  } catch (error) {
    log('❌ Failed to install axios', 'red');
    process.exit(1);
  }
} else {
  runVerification().catch(error => {
    log(`❌ Verification failed: ${error.message}`, 'red');
    process.exit(1);
  });
}
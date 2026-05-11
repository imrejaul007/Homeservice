#!/usr/bin/env node

const { spawn } = require('child_process');
const axios = require('axios').default;
const fs = require('fs');

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

let backendProcess = null;
let frontendProcess = null;

// Cleanup function
function cleanup() {
  log('\n🧹 Cleaning up processes...', 'yellow');
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    log('✅ Backend process terminated', 'green');
  }
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
    log('✅ Frontend process terminated', 'green');
  }
}

// Handle process exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Wait for a service to be ready
async function waitForService(url, name, maxAttempts = 30, interval = 2000) {
  log(`⏳ Waiting for ${name} to start...`, 'cyan');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      if (response.status === 200) {
        log(`✅ ${name} is ready!`, 'green');
        return true;
      }
    } catch (error) {
      // Service not ready yet, wait and try again
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  log(`❌ ${name} failed to start within timeout`, 'red');
  return false;
}

// Start backend server
function startBackend() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting backend server...', 'blue');
    
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: './backend',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running')) {
        log('✅ Backend server started', 'green');
        resolve();
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('error')) {
        log(`❌ Backend error: ${error}`, 'red');
        reject(new Error(error));
      }
    });
    
    backendProcess.on('error', (error) => {
      log(`❌ Failed to start backend: ${error.message}`, 'red');
      reject(error);
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (backendProcess) {
        resolve(); // Assume it started even if we didn't see the message
      }
    }, 10000);
  });
}

// Start frontend server
function startFrontend() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting frontend server...', 'blue');
    
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: './frontend',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('localhost:5173')) {
        log('✅ Frontend server started', 'green');
        resolve();
      }
    });
    
    frontendProcess.stderr.on('data', (data) => {
      const error = data.toString();
      // Vite warnings are normal, only fail on actual errors
      if (error.includes('Error:') && !error.includes('warning')) {
        log(`❌ Frontend error: ${error}`, 'red');
        reject(new Error(error));
      }
    });
    
    frontendProcess.on('error', (error) => {
      log(`❌ Failed to start frontend: ${error.message}`, 'red');
      reject(error);
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (frontendProcess) {
        resolve(); // Assume it started
      }
    }, 15000);
  });
}

// Run integration tests
async function runIntegrationTests() {
  const tests = [
    {
      name: 'Backend Health Check',
      test: async () => {
        const response = await axios.get('http://localhost:5000/health');
        return response.data.status === 'healthy';
      }
    },
    {
      name: 'API Test Endpoint',
      test: async () => {
        const response = await axios.get('http://localhost:5000/api/test');
        return response.data.success === true;
      }
    },
    {
      name: 'Service Verification',
      test: async () => {
        const response = await axios.get('http://localhost:5000/api/verify');
        return response.data.success === true;
      }
    },
    {
      name: 'Database Connection',
      test: async () => {
        const response = await axios.get('http://localhost:5000/api/verify/database');
        return response.data.services?.database?.status === 'connected' || response.data.status === 'connected';
      }
    },
    {
      name: 'Frontend Status Page',
      test: async () => {
        const response = await axios.get('http://localhost:5173');
        return response.status === 200;
      }
    }
  ];
  
  log('\n🧪 Running integration tests...', 'blue');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      if (result) {
        log(`✅ ${test.name}`, 'green');
        passed++;
      } else {
        log(`❌ ${test.name} - Test returned false`, 'red');
        failed++;
      }
    } catch (error) {
      log(`❌ ${test.name} - ${error.message}`, 'red');
      failed++;
    }
  }
  
  log(`\n📊 Test Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'yellow');
  
  return { passed, failed, total: tests.length };
}

// Main integration test function
async function main() {
  log('🔧 Home Service Platform - Integration Test', 'blue');
  log('This will start both servers and run connectivity tests\n', 'cyan');
  
  try {
    // Check if dependencies are installed
    if (!fs.existsSync('./backend/node_modules') || !fs.existsSync('./frontend/node_modules')) {
      log('❌ Dependencies not installed. Run: npm run install:all', 'red');
      process.exit(1);
    }
    
    // Start servers
    await startBackend();
    await startFrontend();
    
    // Wait for services to be ready
    const backendReady = await waitForService('http://localhost:5000/health', 'Backend API');
    const frontendReady = await waitForService('http://localhost:5173', 'Frontend');
    
    if (!backendReady || !frontendReady) {
      log('❌ Failed to start all services', 'red');
      cleanup();
      process.exit(1);
    }
    
    // Run integration tests
    const results = await runIntegrationTests();
    
    if (results.failed === 0) {
      log('\n🎉 All integration tests passed!', 'green');
      log('Your Home Service Platform is working correctly!', 'green');
    } else {
      log(`\n⚠️  ${results.failed} tests failed`, 'yellow');
    }
    
    log('\n🌐 Services are running at:', 'blue');
    log('• Frontend: http://localhost:5173', 'cyan');
    log('• Backend: http://localhost:5000', 'cyan');
    log('• API Docs: http://localhost:5000/api', 'cyan');
    
    log('\n⚡ Press Ctrl+C to stop servers and exit', 'yellow');
    
    // Keep the process running
    await new Promise(() => {}); // Wait indefinitely
    
  } catch (error) {
    log(`❌ Integration test failed: ${error.message}`, 'red');
    cleanup();
    process.exit(1);
  }
}

// Handle axios not being available
if (typeof axios === 'undefined') {
  log('Installing required dependencies...', 'yellow');
  const { execSync } = require('child_process');
  execSync('npm install axios', { stdio: 'inherit' });
}

main();
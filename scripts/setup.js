#!/usr/bin/env node

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Home Service Marketplace Platform...\n');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Check Node version
function checkNodeVersion() {
  const nodeVersion = process.version.match(/^v(\d+)/)[1];
  if (parseInt(nodeVersion) < 18) {
    log('❌ Node.js 18 or higher is required', 'red');
    log(`Current version: ${process.version}`, 'yellow');
    process.exit(1);
  }
  log(`✅ Node.js version check passed: ${process.version}`, 'green');
}

// Check if MongoDB is available
function checkMongoDB() {
  try {
    execSync('mongod --version', { stdio: 'ignore' });
    log('✅ MongoDB detected locally', 'green');
    return true;
  } catch {
    log('⚠️  MongoDB not detected locally', 'yellow');
    log('   Make sure to use MongoDB Atlas or install MongoDB locally', 'yellow');
    return false;
  }
}

// Install dependencies
async function installDependencies() {
  log('\n📦 Installing dependencies...', 'blue');
  
  try {
    log('  📦 Installing root dependencies...', 'cyan');
    execSync('npm install', { stdio: 'inherit' });
    
    log('  📦 Installing backend dependencies...', 'cyan');
    execSync('cd backend && npm install', { stdio: 'inherit', shell: true });
    
    log('  📦 Installing frontend dependencies...', 'cyan');
    execSync('cd frontend && npm install', { stdio: 'inherit', shell: true });
    
    log('✅ All dependencies installed successfully!', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Setup environment files
function setupEnvironmentFiles() {
  log('\n🔧 Setting up environment files...', 'blue');
  
  const backendEnv = path.join(__dirname, '../backend/.env');
  const frontendEnv = path.join(__dirname, '../frontend/.env');
  
  // Backend .env
  if (!fs.existsSync(backendEnv)) {
    fs.copyFileSync(
      path.join(__dirname, '../backend/.env.example'),
      backendEnv
    );
    log('✅ Backend .env created from template', 'green');
  } else {
    log('✅ Backend .env already exists', 'green');
  }
  
  // Frontend .env
  if (!fs.existsSync(frontendEnv)) {
    fs.copyFileSync(
      path.join(__dirname, '../frontend/.env.example'),
      frontendEnv
    );
    log('✅ Frontend .env created from template', 'green');
  } else {
    log('✅ Frontend .env already exists', 'green');
  }
}

// Verify setup
async function verifySetup() {
  log('\n🔍 Verifying setup...', 'blue');
  
  const checks = [
    { name: 'Root package.json', path: 'package.json' },
    { name: 'Backend package.json', path: 'backend/package.json' },
    { name: 'Frontend package.json', path: 'frontend/package.json' },
    { name: 'Backend .env', path: 'backend/.env' },
    { name: 'Frontend .env', path: 'frontend/.env' },
    { name: 'Backend TypeScript config', path: 'backend/tsconfig.json' },
    { name: 'Frontend Vite config', path: 'frontend/vite.config.ts' },
    { name: 'Tailwind config', path: 'frontend/tailwind.config.js' },
  ];
  
  let allGood = true;
  
  checks.forEach(check => {
    if (fs.existsSync(check.path)) {
      log(`  ✅ ${check.name}`, 'green');
    } else {
      log(`  ❌ ${check.name} - Missing`, 'red');
      allGood = false;
    }
  });
  
  return allGood;
}

// Main setup function
async function main() {
  try {
    checkNodeVersion();
    checkMongoDB();
    await installDependencies();
    setupEnvironmentFiles();
    
    const setupValid = await verifySetup();
    
    if (setupValid) {
      log('\n✨ Setup completed successfully!', 'green');
      log('\n📋 Next steps:', 'blue');
      log('1. Configure your environment variables:', 'cyan');
      log('   • Update backend/.env with your MongoDB URI', 'yellow');
      log('   • Add API keys for Stripe, Cloudinary, Resend if needed', 'yellow');
      log('2. Start the development servers:', 'cyan');
      log('   npm run dev', 'yellow');
      log('3. Open your browser:', 'cyan');
      log('   Frontend: http://localhost:5173', 'yellow');
      log('   Backend API: http://localhost:5000', 'yellow');
      log('   Health Check: http://localhost:5000/health', 'yellow');
      log('\n🎉 Happy coding!', 'magenta');
    } else {
      log('\n❌ Setup completed with errors', 'red');
      log('Please check the missing files and try again', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup
main();
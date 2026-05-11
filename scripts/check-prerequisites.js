#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Checking Prerequisites...\n');

const checks = [
  {
    name: 'Node.js Version',
    command: 'node --version',
    expected: 'v18+',
    check: (output) => {
      const version = parseInt(output.replace('v', '').split('.')[0]);
      return version >= 18;
    }
  },
  {
    name: 'npm Version', 
    command: 'npm --version',
    expected: '9+',
    check: (output) => {
      const version = parseInt(output.split('.')[0]);
      return version >= 9;
    }
  },
  {
    name: 'MongoDB Connection',
    command: 'mongosh --eval "db.adminCommand(\'ping\')" --quiet',
    expected: 'Connected',
    check: (output) => output.includes('ok') || output.includes('1')
  },
  {
    name: 'Backend .env File',
    command: 'ls backend/.env',
    expected: 'Exists',
    check: (output) => !output.includes('cannot access') && !output.includes('No such file')
  },
  {
    name: 'Frontend .env File',
    command: 'ls frontend/.env',
    expected: 'Exists', 
    check: (output) => !output.includes('cannot access') && !output.includes('No such file')
  }
];

let allPassed = true;

checks.forEach(check => {
  try {
    const output = execSync(check.command, { encoding: 'utf8', stdio: 'pipe' });
    const passed = check.check(output);
    
    console.log(`${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) {
      console.log(`   Expected: ${check.expected}`);
      console.log(`   Got: ${output.trim()}`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: FAIL`);
    console.log(`   Error: ${error.message}`);
    allPassed = false;
  }
});

console.log(`\n${allPassed ? '🎉' : '⚠️'} Prerequisites ${allPassed ? 'PASSED' : 'FAILED'}`);

if (!allPassed) {
  console.log('\n📋 Setup Instructions:');
  console.log('1. Install Node.js 18+: https://nodejs.org/');
  console.log('2. Start MongoDB: mongod or docker-compose up mongodb');
  console.log('3. Copy .env.example to .env in both backend and frontend');
  console.log('4. Configure environment variables');
}
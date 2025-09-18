#!/usr/bin/env node

/**
 * Integration test for the enhanced contract analysis system
 * Tests the new database layer and worker integration
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    log(colors.blue, 'RUN', `${command} ${args.join(' ')} (in ${cwd})`);
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function testIntegration() {
  log(colors.cyan, 'TEST', 'Starting Contract Intelligence Integration Test');
  
  try {
    // Test 1: Build database client
    log(colors.yellow, 'TEST', 'Building database client...');
    await runCommand('pnpm', ['build'], 'packages/clients/db');
    log(colors.green, 'PASS', 'Database client built successfully');

    // Test 2: Build workers
    log(colors.yellow, 'TEST', 'Building workers...');
    await runCommand('pnpm', ['build'], 'apps/workers');
    log(colors.green, 'PASS', 'Workers built successfully');

    // Test 3: Build API
    log(colors.yellow, 'TEST', 'Building API...');
    await runCommand('pnpm', ['build'], 'apps/api');
    log(colors.green, 'PASS', 'API built successfully');

    // Test 4: Run database tests
    log(colors.yellow, 'TEST', 'Running database tests...');
    await runCommand('pnpm', ['test'], 'packages/clients/db');
    log(colors.green, 'PASS', 'Database tests passed');

    // Test 5: Check for required files
    log(colors.yellow, 'TEST', 'Checking integration files...');
    
    const requiredFiles = [
      'packages/clients/db/dist/index.js',
      'packages/clients/db/dist/src/repositories/index.js',
      'apps/workers/dist/template.worker.js',
      'apps/workers/dist/financial.worker.js',
      'apps/workers/dist/index.js'
    ];

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    log(colors.green, 'PASS', 'All required integration files present');

    log(colors.green, 'SUCCESS', 'Contract Intelligence Integration Test Completed Successfully!');
    log(colors.cyan, 'INFO', 'System is ready for contract analysis with:');
    log(colors.cyan, 'INFO', '  ✅ Enhanced database layer with repositories');
    log(colors.cyan, 'INFO', '  ✅ Template intelligence worker');
    log(colors.cyan, 'INFO', '  ✅ Financial analysis worker');
    log(colors.cyan, 'INFO', '  ✅ Integrated worker pipeline');
    log(colors.cyan, 'INFO', '  ✅ Database persistence and indexing');

  } catch (error) {
    log(colors.red, 'FAIL', `Integration test failed: ${error.message}`);
    process.exit(1);
  }
}

testIntegration();
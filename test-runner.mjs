#!/usr/bin/env node

/**
 * Comprehensive test runner for all packages in the monorepo
 * Handles proper environment setup and orchestration
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function runCommand(command, args, cwd) {
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

async function checkDependencies(packagePath) {
  const packageJsonPath = join(packagePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    log(colors.yellow, 'SKIP', `No package.json found in ${packagePath}`);
    return false;
  }
  
  const nodeModulesPath = join(packagePath, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    log(colors.yellow, 'DEPS', `Installing dependencies in ${packagePath}`);
    await runCommand('pnpm', ['install'], packagePath);
  }
  
  return true;
}

async function runTests() {
  const testConfigs = [
    {
      name: 'Root Tests',
      path: __dirname,
      testCommand: ['pnpm', 'test'],
      skipIfNoScript: true,
    },
    {
      name: 'API Tests',
      path: join(__dirname, 'apps/api'),
      testCommand: ['pnpm', 'test'],
    },
    {
      name: 'Web E2E Tests',
      path: join(__dirname, 'apps/web'),
      testCommand: ['pnpm', 'test:unit'],
      skipIfNoScript: true,
    },
    {
      name: 'Workers Tests',
      path: join(__dirname, 'apps/workers'),
      testCommand: ['pnpm', 'test'],
    },
    {
      name: 'Agents Tests',
      path: join(__dirname, 'packages/agents'),
      testCommand: ['pnpm', 'test'],
    },
    {
      name: 'Schemas Tests',
      path: join(__dirname, 'packages/schemas'),
      testCommand: ['pnpm', 'test'],
    },
    {
      name: 'Utils Tests',
      path: join(__dirname, 'packages/utils'),
      testCommand: ['pnpm', 'test'],
    },
  ];

  const results = [];

  for (const config of testConfigs) {
    log(colors.cyan, 'TEST', `Running ${config.name}...`);
    
    try {
      const hasPackage = await checkDependencies(config.path);
      if (!hasPackage) {
        if (config.skipIfNoScript) {
          log(colors.yellow, 'SKIP', `Skipping ${config.name} - no package.json`);
          results.push({ name: config.name, status: 'skipped' });
          continue;
        }
      }

      await runCommand(config.testCommand[0], config.testCommand.slice(1), config.path);
      log(colors.green, 'PASS', `${config.name} completed successfully`);
      results.push({ name: config.name, status: 'passed' });
    } catch (error) {
      log(colors.red, 'FAIL', `${config.name} failed: ${error.message}`);
      results.push({ name: config.name, status: 'failed', error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  log(colors.cyan, 'SUMMARY', 'Test Results');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  results.forEach(result => {
    const color = result.status === 'passed' ? colors.green : 
                  result.status === 'failed' ? colors.red : colors.yellow;
    const status = result.status.toUpperCase();
    log(color, status, result.name);
    if (result.error) {
      console.log(`    ${colors.red}Error: ${result.error}${colors.reset}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  log(colors.green, 'PASSED', passed);
  log(colors.red, 'FAILED', failed);
  log(colors.yellow, 'SKIPPED', skipped);
  console.log('='.repeat(60));

  if (failed > 0) {
    log(colors.red, 'RESULT', 'Some tests failed!');
    process.exit(1);
  } else {
    log(colors.green, 'RESULT', 'All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runTests().catch(error => {
  log(colors.red, 'ERROR', `Test runner failed: ${error.message}`);
  process.exit(1);
});

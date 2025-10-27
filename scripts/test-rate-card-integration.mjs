#!/usr/bin/env node

/**
 * Rate Card Integration Test Runner
 * Runs comprehensive integration tests and reports results
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting Rate Card Integration Tests...\n');

// Test configurations
const tests = [
  {
    name: 'Integration Tests',
    command: 'pnpm',
    args: ['--filter', 'data-orchestration', 'test', 'test/integration/rate-card-workflows.test.ts', '--run'],
    timeout: 60000,
  },
];

let totalPassed = 0;
let totalFailed = 0;

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n📋 Running: ${test.name}`);
    console.log(`   Command: ${test.command} ${test.args.join(' ')}\n`);

    const proc = spawn(test.command, test.args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });

    const timeout = setTimeout(() => {
      proc.kill();
      console.error(`\n❌ Test timed out after ${test.timeout}ms\n`);
      resolve({ success: false, timedOut: true });
    }, test.timeout);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const success = code === 0;
      
      if (success) {
        console.log(`\n✅ ${test.name} passed\n`);
        totalPassed++;
      } else {
        console.error(`\n❌ ${test.name} failed with code ${code}\n`);
        totalFailed++;
      }

      resolve({ success, code });
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`\n❌ ${test.name} error:`, error, '\n');
      totalFailed++;
      resolve({ success: false, error });
    });
  });
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Rate Card Benchmarking Module - Integration Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  for (const test of tests) {
    await runTest(test);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total Duration: ${duration}s`);
  console.log(`  Tests Passed: ${totalPassed}`);
  console.log(`  Tests Failed: ${totalFailed}`);
  console.log(`  Success Rate: ${totalPassed + totalFailed > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0}%`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (totalFailed > 0) {
    console.error('❌ Some tests failed. Please review the output above.\n');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

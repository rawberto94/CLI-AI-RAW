#!/usr/bin/env node

/**
 * Load Test Runner
 * Executes performance load tests for rate card module
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🚀 Starting Rate Card Load Tests...\n');
console.log('⚠️  Warning: This will create test data in your database.');
console.log('   Make sure you are running against a test environment.\n');

// Get test tenant ID from environment or use default
const testTenantId = process.env.TEST_TENANT_ID || 'load-test-tenant';

console.log(`📊 Test Configuration:`);
console.log(`   Tenant ID: ${testTenantId}`);
console.log(`   Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}\n`);

// Confirm before proceeding
if (process.env.CI !== 'true') {
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

const proc = spawn('node', [
  '--loader',
  'ts-node/esm',
  join(rootDir, 'packages/data-orchestration/test/load/rate-card-load-test.ts')
], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    TEST_TENANT_ID: testTenantId,
  },
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Load tests completed successfully!\n');
  } else {
    console.error(`\n❌ Load tests failed with code ${code}\n`);
  }
  process.exit(code);
});

proc.on('error', (error) => {
  console.error('\n❌ Load test error:', error, '\n');
  process.exit(1);
});

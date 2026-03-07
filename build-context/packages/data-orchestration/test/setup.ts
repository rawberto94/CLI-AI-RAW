/**
 * Test setup file for vitest
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from root .env file
try {
  const envPath = resolve(__dirname, '../../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
} catch (error) {
  console.warn('Could not load .env file:', error);
}

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Ensure DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not found in environment. Integration tests may fail.');
  }
});

afterAll(async () => {
  // Cleanup after all tests
});

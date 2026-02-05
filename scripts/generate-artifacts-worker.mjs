#!/usr/bin/env node
/**
 * Worker script to generate artifacts for a contract
 * Run as a separate process to avoid blocking the main server
 * 
 * This worker is spawned by the legacy fallback in artifact-trigger.ts
 * when the Redis queue system is not available.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the web app's .env file
const envPath = join(__dirname, '..', 'apps', 'web', '.env');
dotenv.config({ path: envPath });

// Also try loading .env.local for local overrides
const envLocalPath = join(__dirname, '..', 'apps', 'web', '.env.local');
dotenv.config({ path: envLocalPath });

// Import PrismaClient after environment is loaded
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

async function generateArtifacts() {
  const [contractId, tenantId, filePath, mimeType] = process.argv.slice(2);
  
  if (!contractId || !tenantId || !filePath || !mimeType) {
    console.error('Usage: node generate-artifacts-worker.mjs <contractId> <tenantId> <filePath> <mimeType>');
    process.exit(1);
  }
  
  console.log(`🤖 Worker starting artifact generation for contract: ${contractId}`);
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   File: ${filePath}`);
  console.log(`   MIME: ${mimeType}`);
  
  try {
    // Import from the web app's lib directory
    // The path is relative to this script's location in /scripts
    const generatorPath = join(__dirname, '..', 'apps', 'web', 'lib', 'real-artifact-generator.ts');
    const { generateRealArtifacts } = await import(generatorPath);
    
    const result = await generateRealArtifacts(contractId, tenantId, filePath, mimeType, prisma);
    
    if (result.success) {
      console.log(`✅ Worker completed artifact generation for: ${contractId}`);
      console.log(`   Artifacts created: ${result.artifactsCreated}`);
    } else {
      console.log(`⚠️  Worker completed with errors for: ${contractId}`);
      console.log(`   Artifacts created: ${result.artifactsCreated}`);
      if (result.errors) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    }
    
    await prisma.$disconnect();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`❌ Worker failed to generate artifacts for ${contractId}:`, error);
    
    // Try to mark the contract as failed
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'FAILED' },
      });
    } catch {
      // Ignore update errors
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

generateArtifacts();

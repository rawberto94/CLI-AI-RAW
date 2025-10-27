#!/usr/bin/env node
/**
 * Worker script to generate artifacts for a contract
 * Run as a separate process to avoid blocking the main server
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateArtifacts() {
  const [contractId, tenantId, filePath, mimeType] = process.argv.slice(2);
  
  if (!contractId || !tenantId || !filePath || !mimeType) {
    console.error('Usage: node generate-artifacts-worker.mjs <contractId> <tenantId> <filePath> <mimeType>');
    process.exit(1);
  }
  
  console.log(`🤖 Worker starting artifact generation for contract: ${contractId}`);
  
  try {
    const { generateRealArtifacts } = await import('../apps/web/lib/real-artifact-generator.ts');
    
    await generateRealArtifacts(contractId, tenantId, filePath, mimeType, prisma);
    
    console.log(`✅ Worker completed artifact generation for: ${contractId}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Worker failed to generate artifacts for ${contractId}:`, error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

generateArtifacts();

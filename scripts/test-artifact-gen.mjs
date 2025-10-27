#!/usr/bin/env node
/**
 * Test script to manually trigger artifact generation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testArtifactGeneration() {
  const contractId = 'cmh6amx2t0001hoepbsmio4fk';
  
  console.log('🔍 Looking for contract:', contractId);
  
  const contract = await prisma.contract.findUnique({
    where: { id: contractId }
  });
  
  if (!contract) {
    console.error('❌ Contract not found');
    process.exit(1);
  }
  
  console.log('✅ Contract found:', {
    id: contract.id,
    filename: contract.fileName,
    path: contract.storagePath,
    status: contract.status
  });
  
  // Import and run artifact generation
  console.log('🚀 Importing artifact generator...');
  const { generateRealArtifacts } = await import('../apps/web/lib/real-artifact-generator.ts');
  
  console.log('🤖 Starting artifact generation...');
  try {
    await generateRealArtifacts(
      contract.id,
      contract.tenantId,
      contract.storagePath,
      contract.mimeType,
      prisma
    );
    console.log('✅ Artifact generation completed successfully!');
  } catch (error) {
    console.error('❌ Artifact generation failed:', error);
    throw error;
  }
  
  // Check results
  const artifacts = await prisma.artifact.findMany({
    where: { contractId: contract.id }
  });
  
  console.log(`\n📦 Generated ${artifacts.length} artifacts:`);
  artifacts.forEach(a => {
    console.log(`  - ${a.type}`);
  });
  
  await prisma.$disconnect();
}

testArtifactGeneration().catch(console.error);

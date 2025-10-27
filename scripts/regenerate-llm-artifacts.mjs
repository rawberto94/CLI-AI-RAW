#!/usr/bin/env node
/**
 * Regenerate artifacts using LLM for all contracts
 * This replaces basic artifacts with comprehensive AI-generated ones
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment from web app
config({ path: resolve(process.cwd(), 'apps/web/.env') });

const prisma = new PrismaClient();

async function regenerateContractArtifacts(contractId) {
  console.log(`\n🔄 Regenerating artifacts for contract: ${contractId}`);
  
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { artifacts: true }
  });
  
  if (!contract) {
    console.log('❌ Contract not found');
    return false;
  }
  
  console.log(`   Contract: ${contract.fileName || contract.originalName}`);
  console.log(`   Current artifacts: ${contract.artifacts.length}`);
  
  if (!contract.storagePath) {
    console.log('⚠️  No file path - skipping');
    return false;
  }
  
  // Delete existing basic artifacts
  if (contract.artifacts.length > 0) {
    await prisma.artifact.deleteMany({
      where: { contractId: contract.id }
    });
    console.log('   🗑️  Deleted existing basic artifacts');
  }
  
  // Import and call the real artifact generator
  try {
    const { generateRealArtifacts } = await import('../apps/web/lib/real-artifact-generator.js');
    
    await generateRealArtifacts(
      contract.id,
      contract.tenantId,
      contract.storagePath,
      contract.mimeType || 'application/pdf',
      prisma
    );
    
    console.log('✅ LLM artifacts generated successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to generate LLM artifacts:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 LLM Artifact Regeneration Script');
  console.log('====================================\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('   Please set it in apps/web/.env');
    process.exit(1);
  }
  
  const contractId = process.argv[2];
  
  if (contractId) {
    // Regenerate for specific contract
    await regenerateContractArtifacts(contractId);
  } else {
    // Find all contracts with basic artifacts or no artifacts
    const contracts = await prisma.contract.findMany({
      where: {
        status: { not: 'PROCESSING' },
        storagePath: { not: null }
      },
      include: { artifacts: true },
      take: 10 // Limit to 10 at a time to avoid hitting rate limits
    });
    
    console.log(`Found ${contracts.length} contracts to process\n`);
    
    let success = 0;
    let failed = 0;
    
    for (const contract of contracts) {
      const result = await regenerateContractArtifacts(contract.id);
      if (result) {
        success++;
      } else {
        failed++;
      }
      
      // Add delay to avoid rate limiting
      if (contracts.indexOf(contract) < contracts.length - 1) {
        console.log('   ⏳ Waiting 2s to avoid rate limits...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
  }
  
  console.log('\n✅ Done!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('❌ Error:', error);
    prisma.$disconnect();
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Generate missing artifacts for contracts
 * This script finds contracts without artifacts and generates them
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment from web app
config({ path: resolve(process.cwd(), 'apps/web/.env') });

const prisma = new PrismaClient();

async function generateArtifactsForContract(contractId) {
  console.log(`\n📝 Processing contract: ${contractId}`);
  
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { artifacts: true }
  });
  
  if (!contract) {
    console.log('❌ Contract not found');
    return;
  }
  
  console.log(`   Contract: ${contract.fileName || contract.originalName}`);
  console.log(`   Existing artifacts: ${contract.artifacts.length}`);
  
  if (contract.artifacts.length > 0) {
    console.log('✅ Artifacts already exist');
    return;
  }
  
  // Create basic artifacts
  console.log('📦 Creating basic artifacts...');
  
  const artifacts = [
    {
      type: 'OVERVIEW',
      data: {
        name: 'Contract Overview',
        description: 'Basic contract information and summary',
        fileName: contract.fileName || contract.originalName,
        supplier: contract.supplierName || 'Unknown',
        totalValue: contract.totalValue?.toString() || '0',
        currency: contract.currency || 'USD',
        startDate: contract.startDate,
        endDate: contract.endDate,
        summary: `Contract with ${contract.supplierName || 'Unknown Supplier'} for services.`,
        status: 'active'
      }
    },
    {
      type: 'RISK',
      data: {
        name: 'Risk Assessment',
        description: 'Contract risk analysis',
        riskLevel: 'MEDIUM',
        overallScore: 5,
        risks: [
          { 
            category: 'FINANCIAL', 
            description: 'Standard financial risk',
            severity: 'MEDIUM',
            score: 5
          }
        ],
        mitigations: []
      }
    },
    {
      type: 'FINANCIAL',
      data: {
        name: 'Financial Summary',
        description: 'Financial details and terms',
        totalValue: contract.totalValue?.toString() || '0',
        currency: contract.currency || 'USD',
        paymentTerms: 'Standard payment terms',
        breakdown: []
      }
    }
  ];
  
  for (const artifactData of artifacts) {
    await prisma.artifact.create({
      data: {
        type: artifactData.type,
        data: artifactData.data,
        contractId: contract.id,
        tenantId: contract.tenantId
      }
    });
    console.log(`   ✓ Created ${artifactData.type} artifact`);
  }
  
  console.log('✅ Artifacts generated successfully');
}

async function main() {
  console.log('🚀 Artifact Generation Script');
  console.log('==============================\n');
  
  const contractId = process.argv[2];
  
  if (contractId) {
    // Generate for specific contract
    await generateArtifactsForContract(contractId);
  } else {
    // Find all contracts without artifacts
    const contracts = await prisma.contract.findMany({
      include: { artifacts: true },
      where: {
        artifacts: {
          none: {}
        }
      }
    });
    
    console.log(`Found ${contracts.length} contracts without artifacts\n`);
    
    for (const contract of contracts) {
      await generateArtifactsForContract(contract.id);
    }
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

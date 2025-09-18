#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { ContractIndexationService } from '../packages/clients/db/src/services/contract-indexation.service.js';
import { ArtifactPopulationService } from '../packages/clients/db/src/services/artifact-population.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting artifact population process...');

  try {
    // Initialize services
    const indexationService = new ContractIndexationService(prisma);
    const populationService = new ArtifactPopulationService(prisma, indexationService);

    // Get all contracts that need artifact population
    const contracts = await prisma.contract.findMany({
      include: {
        artifacts: true,
        tenant: true,
      },
    });

    console.log(`📋 Found ${contracts.length} contracts to process`);

    if (contracts.length === 0) {
      console.log('ℹ️  No contracts found. Creating sample contracts first...');
      await createSampleContracts();
      
      // Fetch contracts again
      const newContracts = await prisma.contract.findMany({
        include: {
          artifacts: true,
          tenant: true,
        },
      });
      
      contracts.push(...newContracts);
    }

    // Process each contract
    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      console.log(`\n📄 Processing contract ${i + 1}/${contracts.length}: ${contract.filename}`);

      try {
        await populationService.populateContractArtifacts(
          contract.id,
          contract.tenantId,
          {
            includeMetadata: true,
            includeClauses: true,
            includeTags: true,
            includeMilestones: true,
            includeAnalysis: true,
            overwriteExisting: true,
          }
        );

        console.log(`✅ Successfully populated artifacts for ${contract.filename}`);
      } catch (error) {
        console.error(`❌ Failed to populate artifacts for ${contract.filename}:`, error.message);
      }

      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Display summary
    const artifactCounts = await prisma.artifact.groupBy({
      by: ['type'],
      _count: { type: true },
    });

    console.log('\n📊 Artifact Population Summary:');
    console.log('================================');
    artifactCounts.forEach(({ type, _count }) => {
      console.log(`${type}: ${_count.type} artifacts`);
    });

    const totalArtifacts = artifactCounts.reduce((sum, { _count }) => sum + _count.type, 0);
    console.log(`\nTotal artifacts created: ${totalArtifacts}`);

    console.log('\n🎉 Artifact population completed successfully!');

  } catch (error) {
    console.error('❌ Artifact population failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function createSampleContracts() {
  console.log('📝 Creating sample contracts...');

  // Get demo tenant
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });

  if (!demoTenant) {
    throw new Error('Demo tenant not found. Please run database seeding first.');
  }

  // Get demo user
  const demoUser = await prisma.user.findUnique({
    where: { email: 'admin@demo.com' },
  });

  if (!demoUser) {
    throw new Error('Demo user not found. Please run database seeding first.');
  }

  const sampleContracts = [
    {
      filename: 'Master_Service_Agreement_TechCorp.pdf',
      originalName: 'Master Service Agreement - TechCorp.pdf',
      mimeType: 'application/pdf',
      size: 2048576,
      status: 'PROCESSED',
    },
    {
      filename: 'Software_License_Agreement_Enterprise.pdf',
      originalName: 'Software License Agreement - Enterprise.pdf',
      mimeType: 'application/pdf',
      size: 1536000,
      status: 'PROCESSED',
    },
    {
      filename: 'Data_Processing_Agreement_Analytics.pdf',
      originalName: 'Data Processing Agreement - Analytics.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      status: 'PROCESSED',
    },
    {
      filename: 'NDA_Confidential_Information.pdf',
      originalName: 'NDA - Confidential Information.pdf',
      mimeType: 'application/pdf',
      size: 512000,
      status: 'PROCESSED',
    },
    {
      filename: 'SOW_Mobile_App_Development.pdf',
      originalName: 'SOW - Mobile App Development.pdf',
      mimeType: 'application/pdf',
      size: 768000,
      status: 'PROCESSED',
    },
  ];

  for (const contractData of sampleContracts) {
    await prisma.contract.create({
      data: {
        ...contractData,
        tenantId: demoTenant.id,
        uploadedBy: demoUser.id,
        s3Key: `contracts/${demoTenant.id}/${contractData.filename}`,
        s3Bucket: 'contracts',
      },
    });
  }

  console.log(`✅ Created ${sampleContracts.length} sample contracts`);
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as populateArtifacts };
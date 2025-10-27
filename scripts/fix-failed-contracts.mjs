#!/usr/bin/env node
/**
 * Regenerate artifacts for failed/incomplete contracts via API
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function regenerateViaAPI() {
  try {
    console.log('\n🔄 Finding contracts that need regeneration...\n');

    // Find contracts that are FAILED or stuck in PROCESSING
    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { status: 'FAILED' },
          {
            AND: [
              { status: 'PROCESSING' },
              { 
                processedAt: null,
                createdAt: {
                  lt: new Date(Date.now() - 10 * 60 * 1000) // Older than 10 minutes
                }
              },
            ],
          },
        ],
        NOT: {
          storagePath: null,
        },
      },
      include: {
        artifacts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    console.log(`Found ${contracts.length} contracts to regenerate\n`);

    if (contracts.length === 0) {
      console.log('✅ No contracts need regeneration');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const contract of contracts) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 Processing: ${contract.fileName}`);
      console.log(`   ID: ${contract.id}`);
      console.log(`   Current Status: ${contract.status}`);
      console.log(`   Current Artifacts: ${contract.artifacts.length}`);
      console.log(`${'='.repeat(80)}\n`);

      try {
        // Update status to PROCESSING
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'PROCESSING' },
        });

        // Delete existing artifacts
        if (contract.artifacts.length > 0) {
          await prisma.artifact.deleteMany({
            where: { contractId: contract.id },
          });
          console.log(`🗑️  Deleted ${contract.artifacts.length} old artifacts`);
        }

        // Trigger regeneration via internal function call
        console.log(`🚀 Triggering artifact generation...`);
        
        // Import the trigger function
        const { triggerArtifactGeneration } = await import('../apps/web/lib/artifact-trigger.js');
        
        await triggerArtifactGeneration({
          contractId: contract.id,
          tenantId: contract.tenantId,
          filePath: contract.storagePath,
          mimeType: contract.mimeType,
          useQueue: false,
        });

        successCount++;
        console.log(`✅ Successfully regenerated artifacts for ${contract.fileName}\n`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        failCount++;
        console.error(`❌ Failed to regenerate ${contract.fileName}:`, error.message);

        // Mark as failed
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'FAILED' },
        }).catch(() => {});
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📊 Regeneration Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📋 Total: ${contracts.length}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
console.log('🚀 Starting artifact regeneration via API...');
regenerateViaAPI();

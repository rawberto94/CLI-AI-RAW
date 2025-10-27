import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArtifacts() {
  try {
    // Get recent contracts with their artifacts
    const contracts = await prisma.contract.findMany({
      where: {
        status: {
          in: ['PROCESSING', 'FAILED', 'COMPLETED']
        }
      },
      include: {
        artifacts: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log('\n📊 Recent Contracts with Artifacts:\n');
    console.log('ID'.padEnd(30), 'File'.padEnd(30), 'Status'.padEnd(12), 'Artifacts');
    console.log('─'.repeat(95));

    for (const contract of contracts) {
      const artifactTypes = contract.artifacts.map(a => a.type).join(', ') || 'NONE';
      console.log(
        contract.id.padEnd(30),
        (contract.fileName || 'N/A').substring(0, 28).padEnd(30),
        contract.status.padEnd(12),
        `${contract.artifacts.length} (${artifactTypes})`
      );
    }

    console.log('\n');
    
    // Get the most recent contract for detailed inspection
    if (contracts.length > 0 && contracts[0].artifacts.length > 0) {
      const latest = contracts[0];
      console.log(`\n🔍 Latest Contract Details: ${latest.id}`);
      console.log(`   File: ${latest.fileName}`);
      console.log(`   Status: ${latest.status}`);
      console.log(`   Artifacts (${latest.artifacts.length}):`);
      
      for (const artifact of latest.artifacts) {
        console.log(`     - ${artifact.type}: ${Object.keys(artifact.data).length} fields, confidence: ${artifact.confidence}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArtifacts();

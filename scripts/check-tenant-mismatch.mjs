import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTenants() {
  try {
    const contractId = 'cmh641ydq0001ep2ycwu7sr6f'; // Latest contract
    
    // Get contract with artifacts
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { artifacts: true }
    });

    if (!contract) {
      console.log('Contract not found!');
      return;
    }

    console.log(`\n📋 Contract: ${contract.id}`);
    console.log(`   TenantId: ${contract.tenantId}`);
    console.log(`   Status: ${contract.status}`);
    console.log(`   Artifacts: ${contract.artifacts.length}`);
    
    if (contract.artifacts.length > 0) {
      console.log(`\n   Artifact TenantIds:`);
      contract.artifacts.forEach(a => {
        console.log(`     - ${a.type}: ${a.tenantId} ${a.tenantId === contract.tenantId ? '✅' : '❌ MISMATCH'}`);
      });
    }

    // Test the API query
    console.log(`\n🔍 Testing API Query:`);
    const apiResult = await prisma.artifact.findMany({
      where: {
        contractId: contractId,
        tenantId: 'demo', // What the API uses
      },
    });
    
    console.log(`   Result with tenantId='demo': ${apiResult.length} artifacts`);
    
    // Test without tenant filter
    const noTenantResult = await prisma.artifact.findMany({
      where: {
        contractId: contractId,
      },
    });
    
    console.log(`   Result without tenantId filter: ${noTenantResult.length} artifacts`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenants();

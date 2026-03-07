/**
 * Test script to verify contract update persistence
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'demo';

async function testContractUpdate() {
  console.log('============================================================');
  console.log('CONTRACT UPDATE PERSISTENCE TEST');
  console.log('============================================================\n');

  // Find a contract to test with
  const existingContract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true, description: true, contractTitle: true, tags: true }
  });

  if (!existingContract) {
    console.log('❌ No contract found for testing');
    return;
  }

  console.log(`[TEST] Found contract: ${existingContract.id}`);
  console.log(`[TEST] Original description: ${existingContract.description || '(empty)'}`);
  console.log(`[TEST] Original title: ${existingContract.contractTitle || '(empty)'}`);

  // Generate unique test values
  const testDescription = `Test description updated at ${new Date().toISOString()}`;
  const testTitle = `Test title ${Date.now()}`;

  console.log(`\n[TEST] Updating to: ${testDescription}`);

  // Update via Prisma directly (simulating what the fixed API does)
  const updated = await prisma.contract.update({
    where: { id: existingContract.id },
    data: {
      description: testDescription,
      updatedAt: new Date(),
    }
  });

  console.log(`✅ Update executed`);

  // Verify the update persisted
  const verified = await prisma.contract.findUnique({
    where: { id: existingContract.id },
    select: { description: true }
  });

  if (verified?.description === testDescription) {
    console.log(`✅ Update PERSISTED correctly!`);
    console.log(`   New description: ${verified.description}`);
  } else {
    console.log(`❌ Update did NOT persist!`);
    console.log(`   Expected: ${testDescription}`);
    console.log(`   Got: ${verified?.description}`);
  }

  // Restore original value
  await prisma.contract.update({
    where: { id: existingContract.id },
    data: {
      description: existingContract.description,
    }
  });
  console.log(`\n✅ Restored original description`);

  await prisma.$disconnect();
  console.log('\n============================================================');
  console.log('TEST COMPLETE');
  console.log('============================================================');
}

testContractUpdate().catch(console.error);

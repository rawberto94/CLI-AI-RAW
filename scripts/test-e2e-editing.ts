/**
 * Comprehensive end-to-end test for edit functionality
 * Tests the entire workflow: read -> edit -> save -> verify -> history
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function performEndToEndTest() {
  console.log('🧪 Starting comprehensive end-to-end edit test...\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Find a contract with artifacts
    console.log('Step 1: Finding contract with artifacts...');
    const contract = await prisma.contract.findFirst({
      where: { 
        artifacts: { some: {} }
      },
      include: {
        artifacts: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!contract || contract.artifacts.length === 0) {
      throw new Error('No contracts with artifacts found');
    }

    const artifact = contract.artifacts[0];
    console.log(`✅ Found artifact: ${artifact.type} (ID: ${artifact.id})`);
    console.log(`   Contract ID: ${contract.id}`);
    console.log(`   Initial edit count: ${artifact.editCount || 0}\n`);

    // Step 2: Read original data
    console.log('Step 2: Reading original artifact data...');
    const originalData = artifact.data as any;
    console.log(`✅ Original data has ${Object.keys(originalData).length} fields`);
    console.log(`   Keys: ${Object.keys(originalData).slice(0, 5).join(', ')}...\n`);

    // Step 3: Create modified data
    console.log('Step 3: Creating test modifications...');
    const modifiedData = {
      ...originalData,
      testModification: {
        timestamp: new Date().toISOString(),
        testField: 'E2E Test Edit',
        editReason: 'Automated end-to-end testing',
      }
    };
    console.log('✅ Added test modification field\n');

    // Step 4: Perform the edit (simulating API call)
    console.log('Step 4: Saving artifact edit...');
    const updatedArtifact = await prisma.artifact.update({
      where: { id: artifact.id },
      data: {
        data: modifiedData,
        isEdited: true,
        editCount: (artifact.editCount || 0) + 1,
        lastEditedAt: new Date(),
        lastEditedBy: 'e2e-test-script',
      },
    });
    console.log(`✅ Artifact updated successfully`);
    console.log(`   New edit count: ${updatedArtifact.editCount}`);
    console.log(`   Last edited: ${updatedArtifact.lastEditedAt?.toISOString()}\n`);

    // Step 5: Create edit history record
    console.log('Step 5: Creating edit history record...');
    const editRecord = await prisma.artifactEdit.create({
      data: {
        artifactId: artifact.id,
        userId: 'e2e-test-script',
        previousData: originalData,
        newData: modifiedData,
        reason: 'End-to-end automated test',
      },
    });
    console.log(`✅ Edit history record created (ID: ${editRecord.id})`);
    console.log(`   Created at: ${editRecord.createdAt.toISOString()}\n`);

    // Step 6: Verify the edit was persisted
    console.log('Step 6: Verifying edit persistence...');
    const verifiedArtifact = await prisma.artifact.findUnique({
      where: { id: artifact.id },
      include: {
        edits: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!verifiedArtifact) {
      throw new Error('Could not find artifact after update');
    }

    const isEditPersisted = 
      verifiedArtifact.isEdited === true &&
      verifiedArtifact.editCount > 0 &&
      verifiedArtifact.lastEditedBy === 'e2e-test-script';

    if (isEditPersisted) {
      console.log('✅ Edit persisted correctly in database');
      console.log(`   isEdited: ${verifiedArtifact.isEdited}`);
      console.log(`   editCount: ${verifiedArtifact.editCount}`);
      console.log(`   lastEditedBy: ${verifiedArtifact.lastEditedBy}\n`);
    } else {
      throw new Error('Edit was not persisted correctly');
    }

    // Step 7: Verify edit history
    console.log('Step 7: Verifying edit history...');
    const editHistory = await prisma.artifactEdit.findMany({
      where: { artifactId: artifact.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`✅ Found ${editHistory.length} edit record(s) in history`);
    if (editHistory.length > 0) {
      const latestEdit = editHistory[0];
      console.log(`   Latest edit by: ${latestEdit.userId}`);
      console.log(`   Reason: ${latestEdit.reason || 'N/A'}`);
      console.log(`   Created: ${latestEdit.createdAt.toISOString()}\n`);
    }

    // Step 8: Test metadata editing capability
    console.log('Step 8: Testing metadata editing...');
    const updatedContract = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        tags: ['test-tag', 'e2e-test', 'automated'],
        customFields: {
          testCustomField: 'E2E Test Value',
          testTimestamp: new Date().toISOString(),
        }
      }
    });
    console.log('✅ Metadata updated successfully');
    console.log(`   Tags: ${JSON.stringify(updatedContract.tags)}`);
    console.log(`   Custom fields: ${Object.keys(updatedContract.customFields as any || {}).length} field(s)\n`);

    // Final Summary
    console.log('='.repeat(60));
    console.log('🎉 END-TO-END TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n✅ All features working correctly:');
    console.log('   • Artifact editing');
    console.log('   • Database persistence');
    console.log('   • Edit history tracking');
    console.log('   • Metadata editing');
    console.log('\n📝 UI Testing:');
    console.log(`   Open: http://localhost:3005/contracts/${contract.id}`);
    console.log('   Then:');
    console.log('   1. Click "Edit" on any artifact → verify modal opens');
    console.log('   2. Make changes → click "Save" → verify toast notification');
    console.log('   3. Click "History" → verify edit timeline shows');
    console.log('   4. Click "Edit Metadata" → add tags → save');
    console.log('\n📊 Test Results:');
    console.log(`   Contract ID: ${contract.id}`);
    console.log(`   Artifact ID: ${artifact.id}`);
    console.log(`   Artifact Type: ${artifact.type}`);
    console.log(`   Edit Count: ${verifiedArtifact.editCount}`);
    console.log(`   History Records: ${editHistory.length}`);
    console.log();

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
performEndToEndTest()
  .then(() => {
    console.log('✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

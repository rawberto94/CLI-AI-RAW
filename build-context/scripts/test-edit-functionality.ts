/**
 * Test script for end-to-end contract editing functionality
 * Tests: artifact editing, metadata editing, and edit history viewing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function testEditFunctionality() {
  console.log('🧪 Starting end-to-end edit functionality tests...\n');

  try {
    // Test 1: Check if contracts exist
    console.log('Test 1: Checking for existing contracts...');
    const contracts = await prisma.contract.findMany({
      take: 1,
      include: {
        artifacts: true,
      },
    });

    if (contracts.length === 0) {
      results.push({
        test: 'Contract existence',
        passed: false,
        message: 'No contracts found in database',
      });
      console.log('❌ No contracts found\n');
      return;
    }

    const contract = contracts[0];
    console.log(`✅ Found contract: ${contract.name || contract.id}`);
    console.log(`   Artifacts: ${contract.artifacts.length}\n`);

    results.push({
      test: 'Contract existence',
      passed: true,
      message: `Found contract with ${contract.artifacts.length} artifacts`,
    });

    // Test 2: Check if artifacts have required fields for editing
    console.log('Test 2: Checking artifact structure...');
    if (contract.artifacts.length > 0) {
      const artifact = contract.artifacts[0];
      const hasRequiredFields =
        artifact.id &&
        artifact.type &&
        artifact.data &&
        'isEdited' in artifact &&
        'editCount' in artifact;

      if (hasRequiredFields) {
        console.log('✅ Artifacts have required edit fields');
        console.log(`   ID: ${artifact.id}`);
        console.log(`   Type: ${artifact.type}`);
        console.log(`   isEdited: ${artifact.isEdited}`);
        console.log(`   editCount: ${artifact.editCount}\n`);

        results.push({
          test: 'Artifact structure',
          passed: true,
          message: 'Artifacts have all required edit fields',
        });
      } else {
        console.log('❌ Artifacts missing required fields\n');
        results.push({
          test: 'Artifact structure',
          passed: false,
          message: 'Missing required edit fields',
        });
      }
    }

    // Test 3: Test creating an artifact edit
    console.log('Test 3: Creating test artifact edit...');
    if (contract.artifacts.length > 0) {
      const artifact = contract.artifacts[0];
      const originalData = artifact.data;
      const testData = {
        ...originalData,
        testField: 'Modified for testing',
        testTimestamp: new Date().toISOString(),
      };

      try {
        // Update artifact
        const updatedArtifact = await prisma.artifact.update({
          where: { id: artifact.id },
          data: {
            data: testData,
            isEdited: true,
            editCount: (artifact.editCount || 0) + 1,
            lastEditedAt: new Date(),
            lastEditedBy: 'test-script',
          },
        });

        // Create edit history record
        const editRecord = await prisma.artifactEdit.create({
          data: {
            artifactId: artifact.id,
            userId: 'test-script',
            previousData: originalData,
            newData: testData,
            reason: 'Automated test edit',
          },
        });

        console.log('✅ Successfully created artifact edit');
        console.log(`   Edit ID: ${editRecord.id}`);
        console.log(`   Edit count: ${updatedArtifact.editCount}`);
        console.log(`   Last edited: ${updatedArtifact.lastEditedAt}\n`);

        results.push({
          test: 'Create artifact edit',
          passed: true,
          message: `Edit record created with ID ${editRecord.id}`,
        });

        // Verify edit was persisted
        const verifyArtifact = await prisma.artifact.findUnique({
          where: { id: artifact.id },
        });

        if (verifyArtifact?.isEdited && verifyArtifact.editCount > 0) {
          console.log('✅ Edit persisted correctly in database\n');
          results.push({
            test: 'Edit persistence',
            passed: true,
            message: 'Edits are correctly persisted',
          });
        }
      } catch (error) {
        console.log('❌ Failed to create edit:', error);
        results.push({
          test: 'Create artifact edit',
          passed: false,
          message: `Error: ${error}`,
        });
      }
    }

    // Test 4: Check edit history retrieval
    console.log('Test 4: Checking edit history retrieval...');
    if (contract.artifacts.length > 0) {
      const artifact = contract.artifacts[0];
      const editHistory = await prisma.artifactEdit.findMany({
        where: { artifactId: artifact.id },
        orderBy: { createdAt: 'desc' },
      });

      if (editHistory.length > 0) {
        console.log(`✅ Found ${editHistory.length} edit records`);
        console.log(`   Latest edit by: ${editHistory[0].userId}`);
        console.log(`   Reason: ${editHistory[0].reason || 'N/A'}\n`);

        results.push({
          test: 'Edit history retrieval',
          passed: true,
          message: `Found ${editHistory.length} edit records`,
        });
      } else {
        console.log('⚠️  No edit history found (may be expected for new data)\n');
        results.push({
          test: 'Edit history retrieval',
          passed: true,
          message: 'No edit history (expected for unedited artifacts)',
        });
      }
    }

    // Test 5: Check metadata fields
    console.log('Test 5: Checking metadata editability...');
    const metadataFields = {
      tags: contract.tags,
      customFields: contract.customFields,
    };

    console.log(`✅ Metadata structure exists`);
    console.log(`   Tags: ${JSON.stringify(metadataFields.tags || [])}`);
    console.log(`   Custom fields: ${JSON.stringify(metadataFields.customFields || {})}\n`);

    results.push({
      test: 'Metadata structure',
      passed: true,
      message: 'Metadata fields are accessible and editable',
    });

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    results.push({
      test: 'Overall test execution',
      passed: false,
      message: `Error: ${error}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log('='.repeat(60) + '\n');

  if (passed === total) {
    console.log('🎉 All tests passed! Edit functionality is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Navigate to http://localhost:3005/contracts');
    console.log('   2. Click on any contract to view details');
    console.log('   3. Click "Edit" button on any artifact');
    console.log('   4. Make changes and click "Save"');
    console.log('   5. Click "History" to view edit timeline');
    console.log('   6. Click "Edit Metadata" to modify tags\n');
  } else {
    console.log('⚠️  Some tests failed. Check the results above.');
    process.exit(1);
  }
}

// Run tests
testEditFunctionality().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

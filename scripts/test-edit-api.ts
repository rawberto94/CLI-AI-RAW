/**
 * Test script to verify editability APIs work and persist to database
 */

async function testArtifactEdit() {
  const contractId = 'cmhibonw70001n6rkweznvr2q';
  const artifactId = 'cmhic58mq0001p2nle5zs89jf';
  
  console.log('🧪 Testing Artifact Edit API...');
  console.log(`Contract ID: ${contractId}`);
  console.log(`Artifact ID: ${artifactId}`);
  
  const testUpdate = {
    updates: {
      testField: 'Edited via API test',
      editedAt: new Date().toISOString(),
    },
    reason: 'Testing editability API',
    userId: 'test-user-123',
  };
  
  try {
    const response = await fetch(
      `http://localhost:3005/api/contracts/${contractId}/artifacts/${artifactId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify(testUpdate),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', response.status, error);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ Artifact updated successfully!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Request failed:', error);
    return false;
  }
}

async function testMetadataEdit() {
  const contractId = 'cmhibonw70001n6rkweznvr2q';
  
  console.log('\n🧪 Testing Contract Metadata Edit API...');
  console.log(`Contract ID: ${contractId}`);
  
  const testUpdate = {
    contractTitle: 'Updated Title via API Test',
    description: 'This is a test edit to verify database persistence',
    updatedBy: 'test-user-123',
  };
  
  try {
    const response = await fetch(
      `http://localhost:3005/api/contracts/${contractId}/metadata`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify(testUpdate),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', response.status, error);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ Metadata updated successfully!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Request failed:', error);
    return false;
  }
}

async function verifyDatabasePersistence() {
  console.log('\n🔍 Verifying database persistence...');
  console.log('Please check the database manually with SQL queries');
  console.log('See console output above for test results');
}

// Run tests
(async () => {
  console.log('🚀 Starting Editability API Tests\n');
  console.log('===============================================\n');
  
  const artifactSuccess = await testArtifactEdit();
  const metadataSuccess = await testMetadataEdit();
  
  await verifyDatabasePersistence();
  
  console.log('\n===============================================');
  console.log(`\n📊 Test Results:`);
  console.log(`   Artifact Edit: ${artifactSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Metadata Edit: ${metadataSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('\n===============================================\n');
  
  process.exit(artifactSuccess && metadataSuccess ? 0 : 1);
})();

/**
 * Comprehensive persistence test for contract operations
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'demo';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function logResult(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${name}${details && !passed ? `: ${details.slice(0, 100)}` : ''}`);
}

async function testMetadataUpdate() {
  console.log('\n[1] Testing Metadata Update...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true, description: true, aiMetadata: true }
  });
  
  if (!contract) {
    logResult('Metadata Update', false, 'No contract found');
    return;
  }
  
  const testValue = `Metadata test ${Date.now()}`;
  const originalDesc = contract.description;
  
  // Update via aiMetadata (enterprise metadata)
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      aiMetadata: {
        ...((contract.aiMetadata as object) || {}),
        contract_short_description: testValue,
      }
    }
  });
  
  // Verify
  const updated = await prisma.contract.findUnique({
    where: { id: contract.id },
    select: { aiMetadata: true }
  });
  
  const persisted = (updated?.aiMetadata as any)?.contract_short_description === testValue;
  logResult('Metadata Update', persisted);
  
  // Restore
  await prisma.contract.update({
    where: { id: contract.id },
    data: { aiMetadata: contract.aiMetadata || {} }
  });
}

async function testContractUpdate() {
  console.log('\n[2] Testing Contract Field Updates...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true, contractTitle: true, description: true, tags: true }
  });
  
  if (!contract) {
    logResult('Contract Field Update', false, 'No contract found');
    return;
  }
  
  const testTitle = `Test Title ${Date.now()}`;
  const originalTitle = contract.contractTitle;
  
  await prisma.contract.update({
    where: { id: contract.id },
    data: { contractTitle: testTitle }
  });
  
  const updated = await prisma.contract.findUnique({
    where: { id: contract.id },
    select: { contractTitle: true }
  });
  
  logResult('Contract Field Update', updated?.contractTitle === testTitle);
  
  // Restore
  await prisma.contract.update({
    where: { id: contract.id },
    data: { contractTitle: originalTitle }
  });
}

async function testCommentCreation() {
  console.log('\n[3] Testing Comment Creation...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true }
  });
  
  if (!contract) {
    logResult('Comment Creation', false, 'No contract found');
    return;
  }
  
  const comment = await prisma.contractComment.create({
    data: {
      contractId: contract.id,
      tenantId: TEST_TENANT_ID,
      userId: 'test-user',
      content: `Test comment ${Date.now()}`,
    }
  });
  
  const verified = await prisma.contractComment.findUnique({
    where: { id: comment.id }
  });
  
  logResult('Comment Creation', !!verified);
  
  // Cleanup
  await prisma.contractComment.delete({ where: { id: comment.id } });
}

async function testActivityLogging() {
  console.log('\n[4] Testing Activity Logging...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true }
  });
  
  if (!contract) {
    logResult('Activity Logging', false, 'No contract found');
    return;
  }
  
  const activity = await prisma.contractActivity.create({
    data: {
      contractId: contract.id,
      tenantId: TEST_TENANT_ID,
      userId: 'test-user',
      type: 'test',
      action: `Test activity ${Date.now()}`,
    }
  });
  
  const verified = await prisma.contractActivity.findUnique({
    where: { id: activity.id }
  });
  
  logResult('Activity Logging', !!verified);
  
  // Cleanup
  await prisma.contractActivity.delete({ where: { id: activity.id } });
}

async function testHealthScoreUpdate() {
  console.log('\n[5] Testing Health Score Update...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true }
  });
  
  if (!contract) {
    logResult('Health Score Update', false, 'No contract found');
    return;
  }
  
  // Check if score exists
  let score = await prisma.contractHealthScore.findFirst({
    where: { contractId: contract.id }
  });
  
  const testScore = Math.floor(Math.random() * 100);
  
  if (score) {
    await prisma.contractHealthScore.update({
      where: { id: score.id },
      data: { overallScore: testScore }
    });
    
    const updated = await prisma.contractHealthScore.findUnique({
      where: { id: score.id }
    });
    
    logResult('Health Score Update', updated?.overallScore === testScore);
  } else {
    // Create one
    score = await prisma.contractHealthScore.create({
      data: {
        contractId: contract.id,
        tenantId: TEST_TENANT_ID,
        overallScore: testScore,
        complianceScore: 80,
        financialScore: 85,
        operationalScore: 75,
      }
    });
    
    logResult('Health Score Update', !!score);
    
    // Cleanup
    await prisma.contractHealthScore.delete({ where: { id: score.id } });
  }
}

async function testCategoryAssignment() {
  console.log('\n[6] Testing Category Assignment...');
  
  const contract = await prisma.contract.findFirst({
    where: { tenantId: TEST_TENANT_ID },
    select: { id: true, categoryL1: true, categoryL2: true }
  });
  
  if (!contract) {
    logResult('Category Assignment', false, 'No contract found');
    return;
  }
  
  const testCategory = `test-category-${Date.now()}`;
  const original = contract.categoryL1;
  
  await prisma.contract.update({
    where: { id: contract.id },
    data: { categoryL1: testCategory }
  });
  
  const updated = await prisma.contract.findUnique({
    where: { id: contract.id },
    select: { categoryL1: true }
  });
  
  logResult('Category Assignment', updated?.categoryL1 === testCategory);
  
  // Restore
  await prisma.contract.update({
    where: { id: contract.id },
    data: { categoryL1: original }
  });
}

async function main() {
  console.log('============================================================');
  console.log('COMPREHENSIVE PERSISTENCE TEST');
  console.log('============================================================');
  
  try {
    await testMetadataUpdate();
    await testContractUpdate();
    await testCommentCreation();
    await testActivityLogging();
    await testHealthScoreUpdate();
    await testCategoryAssignment();
  } catch (err) {
    console.error('Test error:', err);
  }
  
  await prisma.$disconnect();
  
  console.log('\n============================================================');
  console.log('TEST SUMMARY');
  console.log('============================================================\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}${r.details ? `: ${r.details}` : ''}`);
    });
    process.exit(1);
  }
}

main();

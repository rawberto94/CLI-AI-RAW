#!/usr/bin/env npx tsx
/**
 * Test Script: Contract Deletion
 * 
 * This script tests that contract deletion properly removes all related records
 * and persists the deletion in the database.
 * 
 * Usage: npx tsx scripts/test-contract-deletion.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_TENANT_ID = 'demo'; // Use existing tenant
const TEST_CONTRACT_ID = 'test-contract-deletion-' + Date.now();

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[TEST] ${message}`);
}

function logResult(step: string, passed: boolean, details?: string) {
  results.push({ step, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${step}${details ? `: ${details}` : ''}`);
}

async function createTestContract() {
  log('Creating test contract with related records...');
  
  // Create the contract
  const contract = await prisma.contract.create({
    data: {
      id: TEST_CONTRACT_ID,
      tenantId: TEST_TENANT_ID,
      fileName: 'test-deletion-contract.pdf',
      originalName: 'Test Deletion Contract.pdf',
      contractTitle: 'Test Contract for Deletion',
      status: 'COMPLETED',
      mimeType: 'application/pdf',
      fileSize: 1024,
      clientId: null, // Make optional
      category: 'test',
    },
  });
  
  logResult('Contract created', !!contract, `ID: ${contract.id}`);
  return contract;
}

async function createRelatedRecords() {
  log('Creating related records...');
  
  // Create a comment (notes use this model)
  try {
    await prisma.contractComment.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        userId: 'test-user',
        content: 'Test comment for deletion test',
      },
    });
    logResult('ContractComment created', true);
  } catch (e) {
    logResult('ContractComment created', false, String(e));
  }
  
  // Create activity
  try {
    await prisma.contractActivity.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        userId: 'test-user',
        type: 'contract_viewed',
        action: 'viewed',
      },
    });
    logResult('ContractActivity created', true);
  } catch (e) {
    logResult('ContractActivity created', false, String(e));
  }
  
  // Create health score
  try {
    await prisma.contractHealthScore.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        overallScore: 85,
        riskScore: 20,
        complianceScore: 90,
      },
    });
    logResult('ContractHealthScore created', true);
  } catch (e) {
    logResult('ContractHealthScore created', false, String(e));
  }
  
  // Create expiration alert
  try {
    await prisma.expirationAlert.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        title: 'Test Expiration Alert',
        message: 'Contract expiring in 30 days',
        alertType: 'expiring_soon',
        daysBeforeExpiry: 30,
        status: 'pending',
        scheduledFor: new Date(),
      },
    });
    logResult('ExpirationAlert created', true);
  } catch (e) {
    logResult('ExpirationAlert created', false, String(e));
  }
  
  // Create artifact - use proper enum value
  try {
    await prisma.artifact.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        type: 'OVERVIEW', // ArtifactType enum value
        data: { test: true },
      },
    });
    logResult('Artifact created', true);
  } catch (e) {
    logResult('Artifact created', false, String(e));
  }
  
  // Create processing job
  try {
    await prisma.processingJob.create({
      data: {
        contractId: TEST_CONTRACT_ID,
        tenantId: TEST_TENANT_ID,
        status: 'COMPLETED',
      },
    });
    logResult('ProcessingJob created', true);
  } catch (e) {
    logResult('ProcessingJob created', false, String(e));
  }
}

async function verifyRelatedRecordsExist() {
  log('Verifying related records exist before deletion...');
  
  const comment = await prisma.contractComment.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractComment exists', !!comment);
  
  const activity = await prisma.contractActivity.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractActivity exists', !!activity);
  
  const healthScore = await prisma.contractHealthScore.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractHealthScore exists', !!healthScore);
  
  const alert = await prisma.expirationAlert.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ExpirationAlert exists', !!alert);
  
  const artifact = await prisma.artifact.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('Artifact exists', !!artifact);
  
  const job = await prisma.processingJob.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ProcessingJob exists', !!job);
}

async function deleteContract() {
  log('Deleting contract using safeDeleteContract logic...');
  
  const contractId = TEST_CONTRACT_ID;
  const tenantId = TEST_TENANT_ID;
  
  try {
    await prisma.$transaction(async (tx) => {
      // Delete in the same order as the service
      await tx.embedding.deleteMany({ where: { contractId } });
      await tx.contractEmbedding.deleteMany({ where: { contractId } });
      await tx.rateCardEntry.deleteMany({ where: { contractId } });
      await tx.artifact.deleteMany({ where: { contractId } });
      await tx.processingJob.deleteMany({ where: { contractId } });
      await tx.clause.deleteMany({ where: { contractId } });
      await tx.contractVersion.deleteMany({ where: { contractId } });
      await tx.financialAnalysis.deleteMany({ where: { contractId } });
      await tx.overviewAnalysis.deleteMany({ where: { contractId } });
      await tx.templateAnalysis.deleteMany({ where: { contractId } });
      await tx.workflowExecution.deleteMany({ where: { contractId } });
      
      // Unlink children
      await tx.contract.updateMany({
        where: { parentContractId: contractId },
        data: { parentContractId: null, relationshipType: null },
      });
      
      await tx.contractMetadata.deleteMany({ where: { contractId } });
      await tx.run.deleteMany({ where: { contractId } });
      await tx.costSavingsOpportunity.deleteMany({ where: { contractId } });
      await tx.contractArtifact.deleteMany({ where: { contractId } });
      
      // New additions - models that were missing
      await tx.contractComment.deleteMany({ where: { contractId } });
      await tx.contractActivity.deleteMany({ where: { contractId } });
      await tx.contractHealthScore.deleteMany({ where: { contractId } });
      await tx.expirationAlert.deleteMany({ where: { contractId } });
      await tx.signatureRequest.deleteMany({ where: { contractId } });
      await tx.legalReview.deleteMany({ where: { contractId } });
      await tx.extractionCorrection.deleteMany({ where: { contractId } });
      await tx.renewalHistory.deleteMany({ where: { contractId } });
      await tx.contractExpiration.deleteMany({ where: { contractId } });
      await tx.opportunityDiscovery.deleteMany({ where: { contractId } });
      await tx.syncedFile.updateMany({
        where: { contractId },
        data: { contractId: null },
      });
      await tx.agentEvent.deleteMany({ where: { contractId } });
      await tx.agentGoal.deleteMany({ where: { contractId } });
      await tx.agentRecommendation.deleteMany({ where: { contractId } });
      
      // Finally delete the contract
      await tx.contract.delete({ where: { id: contractId, tenantId } });
    });
    
    logResult('Contract deletion transaction', true, 'Completed successfully');
    return true;
  } catch (error) {
    logResult('Contract deletion transaction', false, String(error));
    return false;
  }
}

async function verifyDeletion() {
  log('Verifying all records were deleted...');
  
  const contract = await prisma.contract.findUnique({ where: { id: TEST_CONTRACT_ID } });
  logResult('Contract deleted', !contract, contract ? 'Still exists!' : 'Successfully removed');
  
  const comment = await prisma.contractComment.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractComment deleted', !comment, comment ? 'Still exists!' : 'Successfully removed');
  
  const activity = await prisma.contractActivity.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractActivity deleted', !activity, activity ? 'Still exists!' : 'Successfully removed');
  
  const healthScore = await prisma.contractHealthScore.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ContractHealthScore deleted', !healthScore, healthScore ? 'Still exists!' : 'Successfully removed');
  
  const alert = await prisma.expirationAlert.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ExpirationAlert deleted', !alert, alert ? 'Still exists!' : 'Successfully removed');
  
  const artifact = await prisma.artifact.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('Artifact deleted', !artifact, artifact ? 'Still exists!' : 'Successfully removed');
  
  const job = await prisma.processingJob.findFirst({ where: { contractId: TEST_CONTRACT_ID } });
  logResult('ProcessingJob deleted', !job, job ? 'Still exists!' : 'Successfully removed');
}

async function cleanup() {
  log('Cleaning up any remaining test data...');
  
  try {
    // Clean up in case of partial failure
    await prisma.contractComment.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.contractActivity.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.contractHealthScore.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.expirationAlert.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.artifact.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.processingJob.deleteMany({ where: { contractId: TEST_CONTRACT_ID } });
    await prisma.contract.deleteMany({ where: { id: TEST_CONTRACT_ID } });
    log('Cleanup completed');
  } catch {
    log('Cleanup: No leftover data to clean');
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('CONTRACT DELETION TEST');
  console.log('='.repeat(60) + '\n');
  
  try {
    // Step 1: Create test contract
    await createTestContract();
    
    // Step 2: Create related records
    await createRelatedRecords();
    
    // Step 3: Verify records exist
    await verifyRelatedRecordsExist();
    
    // Step 4: Delete contract
    console.log('\n' + '-'.repeat(40) + '\n');
    const deleted = await deleteContract();
    
    if (deleted) {
      // Step 5: Verify deletion
      console.log('\n' + '-'.repeat(40) + '\n');
      await verifyDeletion();
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await cleanup();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${results.length}\n`);
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.step}: ${r.details || 'No details'}`);
    });
  }
  
  await prisma.$disconnect();
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

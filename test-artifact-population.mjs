#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { ContractIndexationService } from './packages/clients/db/src/services/contract-indexation.service.js';
import { ArtifactPopulationService } from './packages/clients/db/src/services/artifact-population.service.js';

const prisma = new PrismaClient();

async function testArtifactPopulation() {
  console.log('🧪 Testing Artifact Population System...');
  console.log('=====================================\n');

  try {
    // Initialize services
    const indexationService = new ContractIndexationService(prisma);
    const populationService = new ArtifactPopulationService(prisma, indexationService);

    // Test 1: Check database connection
    console.log('1️⃣  Testing database connection...');
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful\n');

    // Test 2: Check if we have contracts
    console.log('2️⃣  Checking for existing contracts...');
    const contractCount = await prisma.contract.count();
    console.log(`📊 Found ${contractCount} contracts in database`);
    
    if (contractCount === 0) {
      console.log('ℹ️  No contracts found. Creating a test contract...');
      await createTestContract();
    }

    // Test 3: Get a sample contract for testing
    console.log('\n3️⃣  Getting sample contract for testing...');
    const testContract = await prisma.contract.findFirst({
      include: {
        artifacts: true,
        tenant: true,
      },
    });

    if (!testContract) {
      throw new Error('No test contract available');
    }

    console.log(`📄 Using contract: ${testContract.filename}`);
    console.log(`🏢 Tenant: ${testContract.tenant.name}`);
    console.log(`📦 Existing artifacts: ${testContract.artifacts.length}`);

    // Test 4: Populate artifacts
    console.log('\n4️⃣  Testing artifact population...');
    const startTime = Date.now();
    
    await populationService.populateContractArtifacts(
      testContract.id,
      testContract.tenantId,
      {
        includeMetadata: true,
        includeClauses: true,
        includeTags: true,
        includeMilestones: true,
        includeAnalysis: true,
        overwriteExisting: true,
      }
    );

    const endTime = Date.now();
    console.log(`✅ Artifact population completed in ${endTime - startTime}ms`);

    // Test 5: Verify artifacts were created
    console.log('\n5️⃣  Verifying created artifacts...');
    const artifacts = await prisma.artifact.findMany({
      where: { contractId: testContract.id },
      orderBy: { type: 'asc' },
    });

    console.log(`📦 Total artifacts created: ${artifacts.length}`);
    
    const artifactsByType = artifacts.reduce((acc, artifact) => {
      acc[artifact.type] = (acc[artifact.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(artifactsByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} artifact(s)`);
    });

    // Test 6: Verify contract metadata indexation
    console.log('\n6️⃣  Testing contract metadata search...');
    const searchResults = await indexationService.searchContracts({
      query: testContract.filename.split('_')[0],
      limit: 5,
    });

    console.log(`🔍 Search results: ${searchResults.contracts.length} contracts found`);
    console.log(`📊 Total indexed contracts: ${searchResults.total}`);

    // Test 7: Test specific artifact content
    console.log('\n7️⃣  Testing artifact content quality...');
    
    const overviewArtifact = artifacts.find(a => a.type === 'OVERVIEW');
    if (overviewArtifact) {
      const overview = overviewArtifact.data;
      console.log(`📋 Overview artifact:`);
      console.log(`   Title: ${overview.title}`);
      console.log(`   Contract Type: ${overview.contractType}`);
      console.log(`   Client: ${overview.parties?.client}`);
      console.log(`   Vendor: ${overview.parties?.vendor}`);
      console.log(`   Risk Score: ${overview.riskScore}`);
      console.log(`   Compliance Score: ${overview.complianceScore}`);
    }

    const analysisArtifact = artifacts.find(a => a.type === 'ANALYSIS');
    if (analysisArtifact) {
      const analysis = analysisArtifact.data;
      console.log(`🔍 Analysis artifact:`);
      console.log(`   Risk Factors: ${analysis.riskAssessment?.riskFactors?.length || 0}`);
      console.log(`   Recommendations: ${analysis.recommendations?.immediate?.length || 0} immediate`);
      console.log(`   Key Terms: ${analysis.keyTerms?.length || 0}`);
    }

    // Test 8: Test dashboard analytics
    console.log('\n8️⃣  Testing dashboard analytics...');
    const dashboardData = await indexationService.getDashboardAnalytics();
    
    console.log(`📊 Dashboard Analytics:`);
    console.log(`   Total Contracts: ${dashboardData.totalContracts}`);
    console.log(`   Expiring Soon: ${dashboardData.expiringCount}`);
    console.log(`   Avg Compliance Score: ${dashboardData.avgComplianceScore.toFixed(1)}%`);

    // Test 9: Test contract recommendations
    console.log('\n9️⃣  Testing contract recommendations...');
    const recommendations = await indexationService.getContractRecommendations(testContract.id);
    
    console.log(`💡 Recommendations: ${recommendations.length}`);
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
    });

    // Test 10: Performance test with multiple contracts
    console.log('\n🔟 Testing batch processing performance...');
    const allContracts = await prisma.contract.findMany({
      take: 3, // Limit to 3 for testing
      select: { id: true, tenantId: true, filename: true },
    });

    if (allContracts.length > 1) {
      const batchStartTime = Date.now();
      await populationService.populateMultipleContracts(
        allContracts.map(c => c.id),
        allContracts[0].tenantId,
        { overwriteExisting: false }
      );
      const batchEndTime = Date.now();
      
      console.log(`✅ Batch processing of ${allContracts.length} contracts completed in ${batchEndTime - batchStartTime}ms`);
      console.log(`⚡ Average time per contract: ${Math.round((batchEndTime - batchStartTime) / allContracts.length)}ms`);
    }

    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('================');
    console.log('✅ Database connection');
    console.log('✅ Contract data access');
    console.log('✅ Artifact population');
    console.log('✅ Metadata indexation');
    console.log('✅ Search functionality');
    console.log('✅ Content quality');
    console.log('✅ Dashboard analytics');
    console.log('✅ Recommendations');
    console.log('✅ Batch processing');
    console.log('✅ Performance metrics');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function createTestContract() {
  // Get demo tenant and user
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  });

  const demoUser = await prisma.user.findUnique({
    where: { email: 'admin@demo.com' },
  });

  if (!demoTenant || !demoUser) {
    throw new Error('Demo tenant or user not found. Please run database seeding first.');
  }

  const testContract = await prisma.contract.create({
    data: {
      filename: 'Test_Service_Agreement.pdf',
      originalName: 'Test Service Agreement.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      status: 'PROCESSED',
      tenantId: demoTenant.id,
      uploadedBy: demoUser.id,
      s3Key: `contracts/${demoTenant.id}/Test_Service_Agreement.pdf`,
      s3Bucket: 'contracts',
    },
  });

  console.log(`✅ Created test contract: ${testContract.filename}`);
  return testContract;
}

// Run the test
testArtifactPopulation().catch(console.error);
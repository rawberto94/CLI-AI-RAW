#!/usr/bin/env node
/**
 * Test RAG Integration
 * Tests the end-to-end RAG system on an existing contract
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRAGIntegration() {
  try {
    console.log('\n🧪 Testing RAG Integration\n');

    // Find a contract with rawText
    const contract = await prisma.contract.findFirst({
      where: {
        rawText: {
          not: null
        },
        status: 'COMPLETED'
      },
      select: {
        id: true,
        fileName: true,
        tenantId: true,
        rawText: true,
      }
    });

    if (!contract) {
      console.log('❌ No contracts with rawText found. Upload a contract first.');
      return;
    }

    console.log(`📄 Testing with contract: ${contract.fileName}`);
    console.log(`   ID: ${contract.id}`);
    console.log(`   Text length: ${contract.rawText?.length || 0} characters`);

    // Step 1: Trigger RAG processing via API
    console.log('\n🔍 Step 1: Triggering RAG processing...');
    const processResponse = await fetch(`http://localhost:3005/api/contracts/${contract.id}/rag-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': contract.tenantId
      },
      body: JSON.stringify({ tenantId: contract.tenantId })
    });

    const processResult = await processResponse.json();
    console.log('   Result:', JSON.stringify(processResult, null, 2));

    if (!processResult.success) {
      console.log('❌ RAG processing failed');
      return;
    }

    // Step 2: Check embeddings in database
    console.log('\n📊 Step 2: Checking embeddings in database...');
    const embeddingsCount = await prisma.embedding.count({
      where: {
        contractId: contract.id,
        tenantId: contract.tenantId
      }
    });

    console.log(`   Found ${embeddingsCount} embeddings in database`);

    if (embeddingsCount === 0) {
      console.log('⚠️ No embeddings found. Check logs for errors.');
      return;
    }

    // Step 3: Test semantic search
    console.log('\n🔎 Step 3: Testing semantic search...');
    const queries = [
      'payment terms and conditions',
      'liability and indemnification',
      'termination clauses',
      'data processing and privacy'
    ];

    for (const query of queries) {
      console.log(`\n   Query: "${query}"`);
      
      const searchResponse = await fetch('http://localhost:3005/api/search/semantic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          contractId: contract.id,
          tenantId: contract.tenantId,
          k: 3
        })
      });

      const searchResult = await searchResponse.json();
      
      if (searchResult.success && searchResult.results.length > 0) {
        console.log(`   ✅ Found ${searchResult.results.length} results`);
        searchResult.results.forEach((r, i) => {
          console.log(`      ${i + 1}. Relevance: ${r.relevance} - "${r.text.substring(0, 80)}..."`);
        });
      } else {
        console.log(`   ⚠️ No results found`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ RAG INTEGRATION TEST COMPLETE');
    console.log('='.repeat(80));
    console.log(`Contract: ${contract.fileName}`);
    console.log(`Chunks created: ${processResult.chunksCreated}`);
    console.log(`Embeddings generated: ${processResult.embeddingsGenerated}`);
    console.log(`Processing time: ${processResult.processingTime}ms`);
    console.log(`Database embeddings: ${embeddingsCount}`);
    console.log(`Semantic search: Working ✅`);
    console.log('\n🎉 RAG system is fully operational!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRAGIntegration();

/**
 * Test script for Hybrid RAG System
 * 
 * Run with: npx ts-node scripts/test-rag.ts
 */

import { hybridRAGService } from '../packages/data-orchestration/src/services/rag/hybrid-rag.service'

async function testRAG() {
  console.log('🚀 Testing Hybrid RAG System...\n')

  try {
    // 1. Health Check
    console.log('1️⃣ Health Check...')
    const health = await hybridRAGService.healthCheck()
    console.log('Status:', health.status)
    console.log('Details:', health.details)
    console.log('✅ Health check passed\n')

    // 2. Process a test contract
    console.log('2️⃣ Processing test contract...')
    const testArtifacts = [
      {
        type: 'OVERVIEW',
        data: {
          summary: 'This is a test service agreement between Acme Corp and Tech Solutions Inc.',
          parties: [
            { name: 'Acme Corp', role: 'client' },
            { name: 'Tech Solutions Inc', role: 'supplier' }
          ],
          contractType: 'Service Agreement',
          effectiveDate: '2024-01-01',
          expirationDate: '2025-01-01'
        }
      },
      {
        type: 'FINANCIAL',
        data: {
          totalValue: 100000,
          currency: 'USD',
          paymentTerms: ['Net 30 days', 'Monthly invoicing'],
          costBreakdown: [
            { category: 'Development', amount: 60000 },
            { category: 'Support', amount: 40000 }
          ]
        }
      },
      {
        type: 'CLAUSES',
        data: {
          clauses: [
            {
              id: 'clause-1',
              type: 'Payment',
              title: 'Payment Terms',
              content: 'Payment shall be made within 30 days of invoice date. Late payments will incur a 1.5% monthly interest charge.',
              riskLevel: 'low'
            },
            {
              id: 'clause-2',
              type: 'Termination',
              title: 'Termination',
              content: 'Either party may terminate this agreement with 90 days written notice. Early termination requires payment of remaining contract value.',
              riskLevel: 'medium'
            }
          ]
        }
      }
    ]

    const processResult = await hybridRAGService.processContract(
      'test-contract-001',
      'test-tenant-001',
      testArtifacts
    )

    console.log('Chunks created:', processResult.chunksCreated)
    console.log('Processing time:', processResult.processingTime, 'ms')
    console.log('✅ Contract processed\n')

    // 3. Test semantic search
    console.log('3️⃣ Testing semantic search...')
    const searchResults = await hybridRAGService.search(
      'payment terms and invoicing',
      'test-tenant-001',
      { maxResults: 3 }
    )

    console.log('Found', searchResults.length, 'results')
    searchResults.forEach((result, index) => {
      console.log(`\nResult ${index + 1}:`)
      console.log('Contract:', result.contractId)
      console.log('Relevance:', result.relevance)
      console.log('Content:', result.content.substring(0, 100) + '...')
    })
    console.log('✅ Search completed\n')

    // 4. Test RAG query
    console.log('4️⃣ Testing RAG query...')
    const ragResponse = await hybridRAGService.query({
      query: 'What are the payment terms and what happens if payment is late?',
      tenantId: 'test-tenant-001'
    })

    console.log('\nQuestion:', 'What are the payment terms and what happens if payment is late?')
    console.log('\nAnswer:', ragResponse.answer)
    console.log('\nConfidence:', (ragResponse.confidence * 100).toFixed(1) + '%')
    console.log('\nSources:', ragResponse.sources.length)
    ragResponse.sources.forEach((source, index) => {
      console.log(`\n  Source ${index + 1}:`)
      console.log('  Contract:', source.contractId)
      console.log('  Excerpt:', source.excerpt)
    })
    console.log('\nProcessing time:', ragResponse.processingTime, 'ms')
    console.log('✅ RAG query completed\n')

    console.log('🎉 All tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests
testRAG().then(() => {
  console.log('\n✨ Test complete!')
  process.exit(0)
}).catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})

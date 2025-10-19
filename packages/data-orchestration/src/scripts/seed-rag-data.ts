/**
 * Seed RAG System with Example Data
 * 
 * Creates sample contracts, feedback, and interactions for testing
 */

import { unifiedRAGOrchestrator } from '../services/rag/unified-rag-orchestrator.service'
import { ragSecurityService } from '../services/rag/rag-security.service'
import { ragLearningService } from '../services/rag/rag-learning.service'
import pino from 'pino'

const logger = pino({ name: 'seed-rag-data' })

const TENANT_ID = 'demo-tenant'
const USER_ID = 'demo-user'

async function seedRAGData() {
  try {
    logger.info('Starting RAG data seeding...')

    // Step 1: Set up security policies
    logger.info('Setting up security policies...')
    ragSecurityService.setAccessPolicy({
      userId: USER_ID,
      tenantId: TENANT_ID,
      permissions: ['read', 'write', 'admin'],
      contractAccess: 'all',
      dataFilters: {}
    })

    ragSecurityService.setRateLimits({
      userId: USER_ID,
      tenantId: TENANT_ID,
      limits: {
        queriesPerMinute: 100,
        queriesPerHour: 1000,
        queriesPerDay: 10000
      },
      currentUsage: {
        minute: 0,
        hour: 0,
        day: 0,
        lastReset: new Date()
      }
    })

    // Step 2: Create sample contracts
    logger.info('Creating sample contracts...')
    
    const sampleContracts = [
      {
        id: 'contract-001',
        artifacts: [
          { id: '1', type: 'title', content: 'Software License Agreement' },
          { id: '2', type: 'parties', content: 'TechCorp Inc' },
          { id: '3', type: 'parties', content: 'ClientCo LLC' },
          { id: '4', type: 'clause', content: 'Payment terms: Net 30 days from invoice date', metadata: { clauseType: 'payment' } },
          { id: '5', type: 'clause', content: 'Termination: Either party may terminate with 90 days notice', metadata: { clauseType: 'termination' } },
          { id: '6', type: 'amount', content: '50000', metadata: { currency: 'USD' } },
          { id: '7', type: 'date', content: '2024-01-15', metadata: { dateType: 'start_date' } }
        ]
      },
      {
        id: 'contract-002',
        artifacts: [
          { id: '1', type: 'title', content: 'Service Agreement' },
          { id: '2', type: 'parties', content: 'ServicePro Ltd' },
          { id: '3', type: 'parties', content: 'ClientCo LLC' },
          { id: '4', type: 'clause', content: 'Payment terms: Net 45 days from invoice date', metadata: { clauseType: 'payment' } },
          { id: '5', type: 'clause', content: 'Liability cap: $100,000 per incident', metadata: { clauseType: 'liability' } },
          { id: '6', type: 'amount', content: '75000', metadata: { currency: 'USD' } },
          { id: '7', type: 'date', content: '2024-02-01', metadata: { dateType: 'start_date' } }
        ]
      },
      {
        id: 'contract-003',
        artifacts: [
          { id: '1', type: 'title', content: 'Consulting Agreement' },
          { id: '2', type: 'parties', content: 'ConsultCo Partners' },
          { id: '3', type: 'parties', content: 'TechCorp Inc' },
          { id: '4', type: 'clause', content: 'Payment terms: Net 30 days from invoice date', metadata: { clauseType: 'payment' } },
          { id: '5', type: 'clause', content: 'Confidentiality: 5 year term post-termination', metadata: { clauseType: 'confidentiality' } },
          { id: '6', type: 'amount', content: '120000', metadata: { currency: 'USD' } },
          { id: '7', type: 'date', content: '2024-03-10', metadata: { dateType: 'start_date' } }
        ]
      }
    ]

    for (const contract of sampleContracts) {
      logger.info({ contractId: contract.id }, 'Processing contract...')
      await unifiedRAGOrchestrator.processContract(
        contract.id,
        TENANT_ID,
        USER_ID,
        contract.artifacts
      )
    }

    // Step 3: Create sample queries and feedback
    logger.info('Creating sample queries and feedback...')
    
    const sampleQueries = [
      { query: 'What are the payment terms?', rating: 'positive' as const },
      { query: 'Show me all contracts with TechCorp', rating: 'positive' as const },
      { query: 'Find contracts with unusual payment terms', rating: 'positive' as const },
      { query: 'What is the liability cap?', rating: 'positive' as const },
      { query: 'List all confidentiality clauses', rating: 'negative' as const }
    ]

    for (const { query, rating } of sampleQueries) {
      logger.info({ query }, 'Executing query...')
      
      try {
        const response = await unifiedRAGOrchestrator.intelligentQuery(
          query,
          USER_ID,
          TENANT_ID,
          { includeAnalytics: false, maxResults: 5 }
        )

        // Submit feedback
        await unifiedRAGOrchestrator.submitFeedback(
          `conv-${Date.now()}`,
          query,
          response.answer,
          rating,
          USER_ID,
          TENANT_ID
        )

        // Track interaction
        await ragLearningService.trackInteraction({
          queryId: `query-${Date.now()}`,
          query,
          responseTime: response.processingTime,
          relevanceScore: response.confidence,
          userEngagement: {
            clicked: rating === 'positive',
            timeSpent: Math.floor(Math.random() * 60) + 10,
            followUpQuestions: rating === 'positive' ? 1 : 0
          },
          sources: response.sources.length,
          confidence: response.confidence
        })
      } catch (error) {
        logger.warn({ error, query }, 'Query failed (expected for demo)')
      }
    }

    logger.info('✅ RAG data seeding complete!')
    logger.info('')
    logger.info('Sample data created:')
    logger.info('  • 3 contracts processed')
    logger.info('  • 5 queries executed')
    logger.info('  • Feedback collected')
    logger.info('  • Interactions tracked')
    logger.info('')
    logger.info('You can now:')
    logger.info('  1. Visit http://localhost:3000/rag/chat')
    logger.info('  2. Try queries like "What are the payment terms?"')
    logger.info('  3. View patterns at http://localhost:3000/rag/intelligence')
    logger.info('  4. Check insights at http://localhost:3000/rag/insights')
    logger.info('  5. Monitor system at http://localhost:3000/rag/observability')

  } catch (error) {
    logger.error({ error }, 'Failed to seed RAG data')
    throw error
  }
}

// Run if executed directly
if (require.main === module) {
  seedRAGData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seeding failed:', error)
      process.exit(1)
    })
}

export { seedRAGData }

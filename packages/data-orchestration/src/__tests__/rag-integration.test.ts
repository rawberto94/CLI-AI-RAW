/**
 * RAG System Integration Tests
 * 
 * Tests all RAG services working together
 */

import { unifiedRAGOrchestrator } from '../services/rag/unified-rag-orchestrator.service'
import { knowledgeGraphService } from '../services/rag/knowledge-graph.service'
import { crossContractIntelligenceService } from '../services/rag/cross-contract-intelligence.service'
import { ragLearningService } from '../services/rag/rag-learning.service'
import { ragObservabilityService } from '../services/rag/rag-observability.service'
import { ragSecurityService } from '../services/rag/rag-security.service'

describe('RAG System Integration Tests', () => {
  const testTenantId = 'test-tenant-123'
  const testUserId = 'test-user-456'
  const testContractId = 'test-contract-789'

  const mockArtifacts = [
    { id: '1', type: 'title', content: 'Service Agreement' },
    { id: '2', type: 'parties', content: 'Acme Corp' },
    { id: '3', type: 'parties', content: 'Beta Inc' },
    { id: '4', type: 'clause', content: 'Payment terms: Net 30 days', metadata: { clauseType: 'payment' } },
    { id: '5', type: 'amount', content: '100000', metadata: { currency: 'USD' } }
  ]

  beforeAll(() => {
    // Set up security policy
    ragSecurityService.setAccessPolicy({
      userId: testUserId,
      tenantId: testTenantId,
      permissions: ['read', 'write'],
      contractAccess: 'all',
      dataFilters: {}
    })

    ragSecurityService.setRateLimits({
      userId: testUserId,
      tenantId: testTenantId,
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
  })

  describe('Contract Processing', () => {
    it('should process contract through all systems', async () => {
      const result = await unifiedRAGOrchestrator.processContract(
        testContractId,
        testTenantId,
        testUserId,
        mockArtifacts
      )

      expect(result.success).toBe(true)
      expect(result.vector).toBeDefined()
      expect(result.graph).toBeDefined()
      expect(result.multiModal).toBeDefined()
      expect(result.processingTime).toBeGreaterThan(0)
    }, 30000)

    it('should build knowledge graph from contract', async () => {
      const result = await knowledgeGraphService.buildGraphFromContract(
        testContractId,
        testTenantId,
        mockArtifacts
      )

      expect(result.nodesCreated).toBeGreaterThan(0)
      expect(result.relationshipsCreated).toBeGreaterThan(0)
    })
  })

  describe('Intelligent Querying', () => {
    it('should execute intelligent query with all features', async () => {
      const response = await unifiedRAGOrchestrator.intelligentQuery(
        'What are the payment terms?',
        testUserId,
        testTenantId,
        { includeAnalytics: false, maxResults: 5 }
      )

      expect(response.answer).toBeDefined()
      expect(response.confidence).toBeGreaterThan(0)
      expect(response.processingTime).toBeGreaterThan(0)
    }, 30000)

    it('should respect security policies', async () => {
      // Create user without access
      const unauthorizedUserId = 'unauthorized-user'

      await expect(
        unifiedRAGOrchestrator.intelligentQuery(
          'Test query',
          unauthorizedUserId,
          testTenantId
        )
      ).rejects.toThrow('Access denied')
    })

    it('should enforce rate limits', async () => {
      // Set very low rate limit
      ragSecurityService.setRateLimits({
        userId: 'limited-user',
        tenantId: testTenantId,
        limits: {
          queriesPerMinute: 1,
          queriesPerHour: 1,
          queriesPerDay: 1
        },
        currentUsage: {
          minute: 1,
          hour: 1,
          day: 1,
          lastReset: new Date()
        }
      })

      ragSecurityService.setAccessPolicy({
        userId: 'limited-user',
        tenantId: testTenantId,
        permissions: ['read'],
        contractAccess: 'all',
        dataFilters: {}
      })

      await expect(
        unifiedRAGOrchestrator.intelligentQuery(
          'Test query',
          'limited-user',
          testTenantId
        )
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Cross-Contract Intelligence', () => {
    it('should detect patterns across contracts', async () => {
      const patterns = await crossContractIntelligenceService.detectPatterns(
        testTenantId,
        'clause'
      )

      expect(Array.isArray(patterns)).toBe(true)
    })

    it('should analyze contract relationships', async () => {
      const relationships = await crossContractIntelligenceService.analyzeRelationships(
        testContractId,
        testTenantId
      )

      expect(relationships.directRelationships).toBeDefined()
      expect(relationships.indirectRelationships).toBeDefined()
      expect(relationships.networkMetrics).toBeDefined()
    })

    it('should correlate risks', async () => {
      const risks = await crossContractIntelligenceService.correlateRisks(testTenantId)

      expect(Array.isArray(risks)).toBe(true)
    })
  })

  describe('Learning System', () => {
    it('should collect feedback', async () => {
      await unifiedRAGOrchestrator.submitFeedback(
        'conv-123',
        'Test query',
        'Test response',
        'positive',
        testUserId,
        testTenantId
      )

      const stats = await ragLearningService.getStats(testTenantId)
      expect(stats.totalFeedback).toBeGreaterThan(0)
    })

    it('should track interactions', async () => {
      await ragLearningService.trackInteraction({
        queryId: 'query-123',
        query: 'Test query',
        responseTime: 1000,
        relevanceScore: 0.8,
        userEngagement: {
          clicked: true,
          timeSpent: 30,
          followUpQuestions: 1
        },
        sources: 3,
        confidence: 0.85
      })

      const analysis = await ragLearningService.analyzeInteractions(testTenantId)
      expect(analysis.totalQueries).toBeGreaterThan(0)
    })

    it('should generate insights', async () => {
      const insights = await ragLearningService.generateInsights(testTenantId)
      expect(Array.isArray(insights)).toBe(true)
    })
  })

  describe('Observability', () => {
    it('should create and track traces', async () => {
      const traceId = ragObservabilityService.startTrace(
        'test_operation',
        testTenantId,
        { testData: 'value' }
      )

      expect(traceId).toBeDefined()

      ragObservabilityService.addTraceStep(traceId, 'step1', 'success')
      ragObservabilityService.endTrace(traceId, 'success')

      const trace = ragObservabilityService.getTrace(traceId)
      expect(trace).toBeDefined()
      expect(trace?.status).toBe('success')
    })

    it('should record metrics', async () => {
      ragObservabilityService.recordMetrics(testTenantId, {
        latency: { p50: 100, p95: 200, p99: 300, avg: 150 },
        accuracy: { relevanceScore: 0.8, confidenceScore: 0.85, userSatisfaction: 0.9 }
      })

      const metrics = ragObservabilityService.getMetrics(testTenantId)
      expect(metrics.length).toBeGreaterThan(0)
    })

    it('should create alerts on threshold violations', async () => {
      ragObservabilityService.recordMetrics(testTenantId, {
        latency: { p50: 5000, p95: 10000, p99: 15000, avg: 7000 }
      })

      const alerts = ragObservabilityService.getAlerts(testTenantId)
      expect(alerts.length).toBeGreaterThan(0)
    })
  })

  describe('System Status', () => {
    it('should get comprehensive system status', async () => {
      const status = await unifiedRAGOrchestrator.getSystemStatus(testTenantId)

      expect(status.overall).toBeDefined()
      expect(status.components).toBeDefined()
      expect(status.metrics).toBeDefined()
      expect(status.alerts).toBeDefined()
    })
  })

  describe('Security', () => {
    it('should mask PII in responses', () => {
      const text = 'Contact John at john@example.com or 555-123-4567. SSN: 123-45-6789'
      const masked = ragSecurityService.maskPII(text)

      expect(masked).not.toContain('john@example.com')
      expect(masked).not.toContain('555-123-4567')
      expect(masked).not.toContain('123-45-6789')
      expect(masked).toContain('[EMAIL]')
      expect(masked).toContain('XXX-XX-XXXX')
    })

    it('should detect abuse', async () => {
      const abuse = await ragSecurityService.detectAbuse(testUserId, testTenantId)
      expect(abuse.isAbusive).toBeDefined()
      expect(Array.isArray(abuse.reasons)).toBe(true)
    })
  })

  describe('Knowledge Graph Queries', () => {
    it('should find related contracts', async () => {
      const related = await knowledgeGraphService.findRelatedContracts(
        testContractId,
        testTenantId,
        2
      )

      expect(Array.isArray(related)).toBe(true)
    })

    it('should get party network', async () => {
      const network = await knowledgeGraphService.getPartyNetwork(
        'Acme Corp',
        testTenantId
      )

      expect(network.party).toBe('Acme Corp')
      expect(Array.isArray(network.contracts)).toBe(true)
      expect(Array.isArray(network.relationships)).toBe(true)
    })

    it('should find similar clauses', async () => {
      const similar = await knowledgeGraphService.findSimilarClauses(
        'Payment terms: Net 30 days',
        testTenantId,
        0.5
      )

      expect(Array.isArray(similar)).toBe(true)
    })
  })
})

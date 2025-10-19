/**
 * Unified RAG Orchestrator
 * 
 * Central service that coordinates all RAG components
 */

import { hybridRAGService } from './hybrid-rag.service'
import { advancedRAGService } from './advanced-rag.service'
import { knowledgeGraphService } from './knowledge-graph.service'
import { multiModalRAGService } from './multi-modal-rag.service'
import { crossContractIntelligenceService } from './cross-contract-intelligence.service'
import { ragLearningService } from './rag-learning.service'
import { ragAnalyticsService } from './rag-analytics.service'
import { ragObservabilityService } from './rag-observability.service'
import { ragSecurityService } from './rag-security.service'
import { federatedRAGService } from './federated-rag.service'
import pino from 'pino'

const logger = pino({ name: 'unified-rag-orchestrator' })

export class UnifiedRAGOrchestrator {
  private static instance: UnifiedRAGOrchestrator

  private constructor() {}

  static getInstance(): UnifiedRAGOrchestrator {
    if (!UnifiedRAGOrchestrator.instance) {
      UnifiedRAGOrchestrator.instance = new UnifiedRAGOrchestrator()
    }
    return UnifiedRAGOrchestrator.instance
  }

  /**
   * Process contract through all RAG systems
   */
  async processContract(
    contractId: string,
    tenantId: string,
    userId: string,
    artifacts: any[]
  ): Promise<{
    vector: any
    graph: any
    multiModal: any
    success: boolean
    processingTime: number
  }> {
    const traceId = ragObservabilityService.startTrace('process_contract', tenantId, {
      contractId,
      userId
    })

    try {
      // Security check
      const accessCheck = await ragSecurityService.checkAccess(userId, tenantId, 'write', contractId)
      if (!accessCheck.allowed) {
        throw new Error(`Access denied: ${accessCheck.reason}`)
      }

      const startTime = Date.now()

      // Process in parallel
      const [vectorResult, graphResult, multiModalResult] = await Promise.all([
        hybridRAGService.processContract(contractId, tenantId, artifacts)
          .then(r => { ragObservabilityService.addTraceStep(traceId, 'vector_processing', 'success'); return r }),
        knowledgeGraphService.buildGraphFromContract(contractId, tenantId, artifacts)
          .then(r => { ragObservabilityService.addTraceStep(traceId, 'graph_building', 'success'); return r }),
        Promise.all([
          multiModalRAGService.extractTables(contractId, tenantId, artifacts),
          multiModalRAGService.extractImages(contractId, tenantId, artifacts)
        ]).then(([tables, images]) => {
          ragObservabilityService.addTraceStep(traceId, 'multimodal_extraction', 'success')
          return { tables, images }
        })
      ])

      const processingTime = Date.now() - startTime

      ragObservabilityService.endTrace(traceId, 'success')

      logger.info({ contractId, processingTime }, 'Contract processed through all RAG systems')

      return {
        vector: vectorResult,
        graph: graphResult,
        multiModal: multiModalResult,
        success: true,
        processingTime
      }
    } catch (error) {
      ragObservabilityService.endTrace(traceId, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      logger.error({ error, contractId }, 'Contract processing failed')
      throw error
    }
  }

  /**
   * Intelligent query with all features
   */
  async intelligentQuery(
    query: string,
    userId: string,
    tenantId: string,
    options?: {
      conversationId?: string
      useStreaming?: boolean
      includeAnalytics?: boolean
      maxResults?: number
    }
  ): Promise<{
    answer: string
    sources: any[]
    confidence: number
    insights?: any
    relatedContracts?: any[]
    patterns?: any[]
    processingTime: number
  }> {
    const traceId = ragObservabilityService.startTrace('intelligent_query', tenantId, {
      query,
      userId
    })

    try {
      // Security checks
      const accessCheck = await ragSecurityService.checkAccess(userId, tenantId, 'read')
      if (!accessCheck.allowed) {
        throw new Error(`Access denied: ${accessCheck.reason}`)
      }

      const rateLimitCheck = await ragSecurityService.checkRateLimit(userId, tenantId)
      if (!rateLimitCheck.allowed) {
        throw new Error('Rate limit exceeded')
      }

      const startTime = Date.now()

      // Federated search across all sources
      const federatedResults = await federatedRAGService.query({
        query,
        tenantId,
        userId,
        sources: ['vector', 'graph', 'multimodal', 'intelligence'],
        options: { maxResults: options?.maxResults, parallelExecution: true }
      })

      ragObservabilityService.addTraceStep(traceId, 'federated_search', 'success', {
        sourcesQueried: federatedResults.sourcesQueried,
        sourcesSucceeded: federatedResults.sourcesSucceeded
      })

      // Generate AI response
      const conversationId = options?.conversationId || `conv:${Date.now()}`
      const aiResponse = await advancedRAGService.chat(
        conversationId,
        query,
        userId,
        tenantId,
        federatedResults.mergedResults
      )

      ragObservabilityService.addTraceStep(traceId, 'ai_generation', 'success')

      // Get analytics insights if requested
      let insights
      if (options?.includeAnalytics) {
        insights = await ragAnalyticsService.queryAnalytics({
          question: query,
          tenantId,
          analyticsType: 'spend'
        })
        ragObservabilityService.addTraceStep(traceId, 'analytics_insights', 'success')
      }

      // Find related contracts
      const relatedContracts = await this.findRelatedContracts(
        federatedResults.mergedResults,
        tenantId
      )

      // Detect patterns
      const patterns = await crossContractIntelligenceService.detectPatterns(
        tenantId,
        'clause'
      )

      const processingTime = Date.now() - startTime

      // Track interaction for learning
      await ragLearningService.trackInteraction({
        queryId: traceId,
        query,
        responseTime: processingTime,
        relevanceScore: aiResponse.confidence,
        userEngagement: {
          clicked: false,
          timeSpent: 0,
          followUpQuestions: 0
        },
        sources: aiResponse.sources.length,
        confidence: aiResponse.confidence
      })

      // Mask PII in response
      const maskedAnswer = ragSecurityService.maskPII(aiResponse.response)

      ragObservabilityService.endTrace(traceId, 'success')

      // Record metrics
      ragObservabilityService.recordMetrics(tenantId, {
        latency: { p50: processingTime, p95: processingTime, p99: processingTime, avg: processingTime },
        accuracy: { relevanceScore: aiResponse.confidence, confidenceScore: aiResponse.confidence, userSatisfaction: 0.8 },
        cost: { totalCost: 0.05, costPerQuery: 0.05, tokensUsed: 1000 },
        usage: { totalQueries: 1, uniqueUsers: 1, avgQueriesPerUser: 1 }
      })

      return {
        answer: maskedAnswer,
        sources: aiResponse.sources,
        confidence: aiResponse.confidence,
        insights,
        relatedContracts: relatedContracts.slice(0, 5),
        patterns: patterns.slice(0, 3),
        processingTime
      }
    } catch (error) {
      ragObservabilityService.endTrace(traceId, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error'
      })

      logger.error({ error, query }, 'Intelligent query failed')
      throw error
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(tenantId: string): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    components: Record<string, any>
    metrics: any
    alerts: any[]
  }> {
    try {
      const [
        vectorHealth,
        federatedHealth,
        graphStats,
        multiModalStats,
        learningStats,
        metrics,
        alerts
      ] = await Promise.all([
        hybridRAGService.healthCheck(),
        federatedRAGService.healthCheck(),
        knowledgeGraphService.getStats(tenantId),
        multiModalRAGService.getStats(tenantId),
        ragLearningService.getStats(tenantId),
        ragObservabilityService.getAggregatedMetrics(tenantId, 'hour'),
        ragObservabilityService.getAlerts(tenantId)
      ])

      const components = {
        vector: vectorHealth,
        federated: federatedHealth,
        graph: graphStats,
        multiModal: multiModalStats,
        learning: learningStats
      }

      // Determine overall health
      const overall = federatedHealth.status

      return {
        overall,
        components,
        metrics,
        alerts
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get system status')
      throw error
    }
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(
    conversationId: string,
    query: string,
    response: string,
    rating: 'positive' | 'negative',
    userId: string,
    tenantId: string
  ): Promise<void> {
    try {
      await ragLearningService.collectFeedback({
        conversationId,
        query,
        response,
        rating,
        userId,
        tenantId
      })

      logger.info({ conversationId, rating }, 'Feedback submitted')
    } catch (error) {
      logger.error({ error, conversationId }, 'Failed to submit feedback')
      throw error
    }
  }

  /**
   * Get learning insights
   */
  async getLearningInsights(tenantId: string): Promise<{
    interactions: any
    insights: any[]
    strategies: any[]
    qualityIssues: any
  }> {
    try {
      const [interactions, insights, strategies, qualityIssues] = await Promise.all([
        ragLearningService.analyzeInteractions(tenantId),
        ragLearningService.generateInsights(tenantId),
        ragLearningService.identifySuccessfulStrategies(tenantId),
        ragLearningService.detectQualityIssues(tenantId)
      ])

      return {
        interactions,
        insights,
        strategies,
        qualityIssues
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get learning insights')
      throw error
    }
  }

  private async findRelatedContracts(results: any[], tenantId: string): Promise<any[]> {
    const contractIds = new Set<string>()
    
    for (const result of results) {
      if (result.contractId) {
        contractIds.add(result.contractId)
      }
    }

    const related: any[] = []

    for (const contractId of Array.from(contractIds).slice(0, 3)) {
      try {
        const relatedContracts = await knowledgeGraphService.findRelatedContracts(
          contractId,
          tenantId,
          2
        )
        related.push(...relatedContracts)
      } catch (error) {
        logger.warn({ error, contractId }, 'Failed to find related contracts')
      }
    }

    return related
  }
}

export const unifiedRAGOrchestrator = UnifiedRAGOrchestrator.getInstance()

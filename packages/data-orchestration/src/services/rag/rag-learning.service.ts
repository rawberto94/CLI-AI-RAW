/**
 * RAG Continuous Learning Service (Phase 9)
 * 
 * Collects feedback, learns from interactions, and improves over time
 */

import pino from 'pino'

const logger = pino({ name: 'rag-learning' })

export interface UserFeedback {
  id: string
  conversationId: string
  query: string
  response: string
  rating: 'positive' | 'negative'
  userId: string
  tenantId: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface InteractionMetrics {
  queryId: string
  query: string
  responseTime: number
  relevanceScore: number
  userEngagement: {
    clicked: boolean
    timeSpent: number
    followUpQuestions: number
  }
  sources: number
  confidence: number
}

export interface LearningInsight {
  pattern: string
  frequency: number
  successRate: number
  avgRelevance: number
  recommendations: string[]
}

export class RAGLearningService {
  private static instance: RAGLearningService
  private feedback: Map<string, UserFeedback> = new Map()
  private interactions: Map<string, InteractionMetrics> = new Map()
  private queryPatterns: Map<string, number> = new Map()

  private constructor() {}

  static getInstance(): RAGLearningService {
    if (!RAGLearningService.instance) {
      RAGLearningService.instance = new RAGLearningService()
    }
    return RAGLearningService.instance
  }

  /**
   * Collect user feedback
   */
  async collectFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<void> {
    try {
      const feedbackRecord: UserFeedback = {
        ...feedback,
        id: `feedback:${Date.now()}`,
        timestamp: new Date()
      }

      this.feedback.set(feedbackRecord.id, feedbackRecord)

      logger.info({
        conversationId: feedback.conversationId,
        rating: feedback.rating
      }, 'Feedback collected')

      // Update query patterns
      this.updateQueryPatterns(feedback.query, feedback.rating === 'positive')
    } catch (error) {
      logger.error({ error }, 'Failed to collect feedback')
      throw error
    }
  }

  /**
   * Track interaction metrics
   */
  async trackInteraction(metrics: InteractionMetrics): Promise<void> {
    try {
      this.interactions.set(metrics.queryId, metrics)

      logger.info({
        queryId: metrics.queryId,
        responseTime: metrics.responseTime,
        relevance: metrics.relevanceScore
      }, 'Interaction tracked')
    } catch (error) {
      logger.error({ error }, 'Failed to track interaction')
      throw error
    }
  }

  /**
   * Analyze user interactions to identify patterns
   */
  async analyzeInteractions(tenantId: string): Promise<{
    totalQueries: number
    avgResponseTime: number
    avgRelevance: number
    successRate: number
    topQueries: Array<{ query: string; count: number }>
    failedQueries: Array<{ query: string; reason: string }>
  }> {
    try {
      const tenantInteractions = Array.from(this.interactions.values())
      const tenantFeedback = Array.from(this.feedback.values()).filter(
        f => f.tenantId === tenantId
      )

      const totalQueries = tenantInteractions.length
      const avgResponseTime = tenantInteractions.reduce((sum, i) => sum + i.responseTime, 0) / totalQueries
      const avgRelevance = tenantInteractions.reduce((sum, i) => sum + i.relevanceScore, 0) / totalQueries

      const positiveCount = tenantFeedback.filter(f => f.rating === 'positive').length
      const successRate = positiveCount / tenantFeedback.length

      // Top queries
      const queryCounts = new Map<string, number>()
      for (const interaction of tenantInteractions) {
        queryCounts.set(interaction.query, (queryCounts.get(interaction.query) || 0) + 1)
      }

      const topQueries = Array.from(queryCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Failed queries (low relevance or negative feedback)
      const failedQueries = tenantInteractions
        .filter(i => i.relevanceScore < 0.5)
        .map(i => ({
          query: i.query,
          reason: i.relevanceScore < 0.3 ? 'Very low relevance' : 'Low relevance'
        }))
        .slice(0, 10)

      return {
        totalQueries,
        avgResponseTime,
        avgRelevance,
        successRate,
        topQueries,
        failedQueries
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to analyze interactions')
      throw error
    }
  }

  /**
   * Generate learning insights
   */
  async generateInsights(tenantId: string): Promise<LearningInsight[]> {
    try {
      const insights: LearningInsight[] = []

      // Analyze query patterns
      const patterns = this.identifyQueryPatterns(tenantId)

      for (const [pattern, data] of patterns.entries()) {
        insights.push({
          pattern,
          frequency: data.count,
          successRate: data.successCount / data.count,
          avgRelevance: data.totalRelevance / data.count,
          recommendations: this.generateRecommendations(pattern, data)
        })
      }

      return insights.sort((a, b) => b.frequency - a.frequency).slice(0, 10)
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to generate insights')
      throw error
    }
  }

  /**
   * Identify successful query strategies
   */
  async identifySuccessfulStrategies(tenantId: string): Promise<Array<{
    strategy: string
    examples: string[]
    successRate: number
  }>> {
    try {
      const strategies: Array<{
        strategy: string
        examples: string[]
        successRate: number
      }> = []

      // Analyze successful queries
      const successfulFeedback = Array.from(this.feedback.values()).filter(
        f => f.tenantId === tenantId && f.rating === 'positive'
      )

      // Group by query characteristics
      const specificQueries = successfulFeedback.filter(f => f.query.split(' ').length > 5)
      if (specificQueries.length > 0) {
        strategies.push({
          strategy: 'Specific, detailed questions',
          examples: specificQueries.slice(0, 3).map(f => f.query),
          successRate: specificQueries.length / successfulFeedback.length
        })
      }

      const contextualQueries = successfulFeedback.filter(f => 
        f.query.match(/contract|clause|party|term/i)
      )
      if (contextualQueries.length > 0) {
        strategies.push({
          strategy: 'Questions with contract context',
          examples: contextualQueries.slice(0, 3).map(f => f.query),
          successRate: contextualQueries.length / successfulFeedback.length
        })
      }

      return strategies
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to identify strategies')
      throw error
    }
  }

  /**
   * Detect quality degradation
   */
  async detectQualityIssues(tenantId: string): Promise<{
    hasIssues: boolean
    issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }>
    recommendations: string[]
  }> {
    try {
      const issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }> = []
      const analysis = await this.analyzeInteractions(tenantId)

      // Check response time
      if (analysis.avgResponseTime > 5000) {
        issues.push({
          type: 'performance',
          severity: 'high',
          description: `Average response time is ${(analysis.avgResponseTime / 1000).toFixed(1)}s (target: <2s)`
        })
      }

      // Check relevance
      if (analysis.avgRelevance < 0.6) {
        issues.push({
          type: 'relevance',
          severity: 'high',
          description: `Average relevance score is ${(analysis.avgRelevance * 100).toFixed(1)}% (target: >80%)`
        })
      }

      // Check success rate
      if (analysis.successRate < 0.7) {
        issues.push({
          type: 'satisfaction',
          severity: 'medium',
          description: `User satisfaction is ${(analysis.successRate * 100).toFixed(1)}% (target: >85%)`
        })
      }

      const recommendations = this.generateQualityRecommendations(issues)

      return {
        hasIssues: issues.length > 0,
        issues,
        recommendations
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to detect quality issues')
      throw error
    }
  }

  /**
   * Generate training data for model improvement
   */
  async generateTrainingData(tenantId: string): Promise<Array<{
    query: string
    expectedResponse: string
    sources: any[]
    quality: 'high' | 'medium' | 'low'
  }>> {
    try {
      const trainingData: Array<{
        query: string
        expectedResponse: string
        sources: any[]
        quality: 'high' | 'medium' | 'low'
      }> = []

      // Get high-quality interactions
      const highQualityFeedback = Array.from(this.feedback.values()).filter(
        f => f.tenantId === tenantId && f.rating === 'positive'
      )

      for (const feedback of highQualityFeedback) {
        const interaction = Array.from(this.interactions.values()).find(
          i => i.query === feedback.query
        )

        if (interaction && interaction.relevanceScore > 0.8) {
          trainingData.push({
            query: feedback.query,
            expectedResponse: feedback.response,
            sources: [],
            quality: 'high'
          })
        }
      }

      return trainingData
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to generate training data')
      throw error
    }
  }

  private updateQueryPatterns(query: string, success: boolean): void {
    const pattern = this.extractQueryPattern(query)
    const current = this.queryPatterns.get(pattern) || 0
    this.queryPatterns.set(pattern, current + (success ? 1 : -1))
  }

  private extractQueryPattern(query: string): string {
    // Simple pattern extraction based on query structure
    const words = query.toLowerCase().split(' ')
    if (words.includes('what')) return 'what-question'
    if (words.includes('how')) return 'how-question'
    if (words.includes('when')) return 'when-question'
    if (words.includes('who')) return 'who-question'
    if (words.includes('show') || words.includes('list')) return 'list-request'
    if (words.includes('compare')) return 'comparison'
    return 'general-query'
  }

  private identifyQueryPatterns(tenantId: string): Map<string, any> {
    const patterns = new Map<string, any>()

    const tenantFeedback = Array.from(this.feedback.values()).filter(
      f => f.tenantId === tenantId
    )

    for (const feedback of tenantFeedback) {
      const pattern = this.extractQueryPattern(feedback.query)
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, {
          count: 0,
          successCount: 0,
          totalRelevance: 0
        })
      }

      const data = patterns.get(pattern)
      data.count++
      if (feedback.rating === 'positive') data.successCount++

      const interaction = Array.from(this.interactions.values()).find(
        i => i.query === feedback.query
      )
      if (interaction) {
        data.totalRelevance += interaction.relevanceScore
      }
    }

    return patterns
  }

  private generateRecommendations(pattern: string, data: any): string[] {
    const recommendations: string[] = []

    if (data.successCount / data.count < 0.5) {
      recommendations.push(`Improve handling of ${pattern} queries`)
    }

    if (data.totalRelevance / data.count < 0.6) {
      recommendations.push(`Enhance relevance for ${pattern} queries`)
    }

    return recommendations
  }

  private generateQualityRecommendations(issues: any[]): string[] {
    const recommendations: string[] = []

    for (const issue of issues) {
      switch (issue.type) {
        case 'performance':
          recommendations.push('Optimize vector search queries')
          recommendations.push('Implement caching for frequent queries')
          break
        case 'relevance':
          recommendations.push('Review and improve chunking strategy')
          recommendations.push('Fine-tune embedding model')
          break
        case 'satisfaction':
          recommendations.push('Analyze failed queries and improve prompts')
          recommendations.push('Enhance source citation quality')
          break
      }
    }

    return [...new Set(recommendations)]
  }

  async getStats(tenantId: string): Promise<{
    totalFeedback: number
    positiveRate: number
    totalInteractions: number
    avgRelevance: number
  }> {
    const tenantFeedback = Array.from(this.feedback.values()).filter(
      f => f.tenantId === tenantId
    )

    const positiveCount = tenantFeedback.filter(f => f.rating === 'positive').length
    const positiveRate = tenantFeedback.length > 0 ? positiveCount / tenantFeedback.length : 0

    const tenantInteractions = Array.from(this.interactions.values())
    const avgRelevance = tenantInteractions.length > 0
      ? tenantInteractions.reduce((sum, i) => sum + i.relevanceScore, 0) / tenantInteractions.length
      : 0

    return {
      totalFeedback: tenantFeedback.length,
      positiveRate,
      totalInteractions: tenantInteractions.length,
      avgRelevance
    }
  }
}

export const ragLearningService = RAGLearningService.getInstance()

/**
 * RAG Analytics Integration Service (Phase 7)
 * 
 * Integrates RAG with existing analytics engines
 */

import { hybridRAGService } from './hybrid-rag.service'
import { advancedRAGService } from './advanced-rag.service'
import pino from 'pino'

const logger = pino({ name: 'rag-analytics' })

export interface AnalyticsQuery {
  question: string
  tenantId: string
  analyticsType: 'spend' | 'supplier' | 'compliance' | 'renewal' | 'rate'
  timeRange?: { start: Date; end: Date }
  filters?: Record<string, any>
}

export interface AnalyticsInsight {
  summary: string
  trends: Array<{ metric: string; direction: 'up' | 'down' | 'stable'; change: number }>
  anomalies: Array<{ description: string; severity: 'low' | 'medium' | 'high' }>
  recommendations: string[]
  confidence: number
}

export class RAGAnalyticsService {
  private static instance: RAGAnalyticsService

  private constructor() {}

  static getInstance(): RAGAnalyticsService {
    if (!RAGAnalyticsService.instance) {
      RAGAnalyticsService.instance = new RAGAnalyticsService()
    }
    return RAGAnalyticsService.instance
  }

  /**
   * Query analytics data using natural language
   */
  async queryAnalytics(query: AnalyticsQuery): Promise<AnalyticsInsight> {
    try {
      logger.info({ query: query.question, type: query.analyticsType }, 'Processing analytics query')

      // Fetch relevant analytics data
      const analyticsData = await this.fetchAnalyticsData(query)

      // Use RAG to generate insights
      const conversationId = `analytics:${query.tenantId}:${Date.now()}`
      const response = await advancedRAGService.chat(
        conversationId,
        this.buildAnalyticsPrompt(query.question, analyticsData),
        'system',
        query.tenantId,
        analyticsData
      )

      // Parse response into structured insights
      const insights = this.parseAnalyticsResponse(response.response, analyticsData)

      return insights
    } catch (error) {
      logger.error({ error, query }, 'Analytics query failed')
      throw error
    }
  }

  /**
   * Generate natural language summary of analytics
   */
  async summarizeAnalytics(
    tenantId: string,
    analyticsType: string,
    data: any[]
  ): Promise<string> {
    try {
      const conversationId = `summary:${tenantId}:${Date.now()}`
      
      const prompt = `Summarize the following ${analyticsType} analytics data in 2-3 sentences:\n\n${JSON.stringify(data, null, 2)}`

      const response = await advancedRAGService.chat(
        conversationId,
        prompt,
        'system',
        tenantId
      )

      return response.response
    } catch (error) {
      logger.error({ error, analyticsType }, 'Analytics summary failed')
      throw error
    }
  }

  /**
   * Explain trends and anomalies
   */
  async explainTrend(
    tenantId: string,
    metric: string,
    trendData: Array<{ date: Date; value: number }>
  ): Promise<{ explanation: string; factors: string[]; prediction: string }> {
    try {
      const conversationId = `trend:${tenantId}:${Date.now()}`

      const prompt = `Analyze this trend for ${metric}:\n${JSON.stringify(trendData)}\n\nExplain what's happening and why.`

      const response = await advancedRAGService.chat(
        conversationId,
        prompt,
        'system',
        tenantId
      )

      return {
        explanation: response.response,
        factors: this.extractFactors(response.response),
        prediction: this.extractPrediction(response.response)
      }
    } catch (error) {
      logger.error({ error, metric }, 'Trend explanation failed')
      throw error
    }
  }

  /**
   * Provide comparative analysis
   */
  async compareMetrics(
    tenantId: string,
    metric1: { name: string; value: number },
    metric2: { name: string; value: number }
  ): Promise<{ comparison: string; insights: string[]; recommendation: string }> {
    try {
      const conversationId = `compare:${tenantId}:${Date.now()}`

      const prompt = `Compare these metrics:\n1. ${metric1.name}: ${metric1.value}\n2. ${metric2.name}: ${metric2.value}\n\nProvide insights and recommendations.`

      const response = await advancedRAGService.chat(
        conversationId,
        prompt,
        'system',
        tenantId
      )

      return {
        comparison: response.response,
        insights: this.extractInsights(response.response),
        recommendation: this.extractRecommendation(response.response)
      }
    } catch (error) {
      logger.error({ error }, 'Metric comparison failed')
      throw error
    }
  }

  /**
   * Generate predictive insights
   */
  async predictFuture(
    tenantId: string,
    metric: string,
    historicalData: Array<{ date: Date; value: number }>
  ): Promise<{
    prediction: number
    confidence: number
    factors: string[]
    risks: string[]
  }> {
    try {
      const conversationId = `predict:${tenantId}:${Date.now()}`

      const prompt = `Based on this historical data for ${metric}:\n${JSON.stringify(historicalData)}\n\nPredict the next value and explain your reasoning.`

      const response = await advancedRAGService.chat(
        conversationId,
        prompt,
        'system',
        tenantId
      )

      return {
        prediction: this.extractPredictionValue(response.response),
        confidence: response.confidence,
        factors: this.extractFactors(response.response),
        risks: this.extractRisks(response.response)
      }
    } catch (error) {
      logger.error({ error, metric }, 'Prediction failed')
      throw error
    }
  }

  /**
   * Suggest actions based on analytics
   */
  async suggestActions(
    tenantId: string,
    analyticsType: string,
    currentState: any
  ): Promise<Array<{ action: string; priority: 'low' | 'medium' | 'high'; impact: string }>> {
    try {
      const conversationId = `actions:${tenantId}:${Date.now()}`

      const prompt = `Given this ${analyticsType} state:\n${JSON.stringify(currentState)}\n\nSuggest 3-5 actionable recommendations with priorities.`

      const response = await advancedRAGService.chat(
        conversationId,
        prompt,
        'system',
        tenantId
      )

      return this.parseActions(response.response)
    } catch (error) {
      logger.error({ error, analyticsType }, 'Action suggestion failed')
      throw error
    }
  }

  private async fetchAnalyticsData(query: AnalyticsQuery): Promise<any[]> {
    // Mock implementation - integrate with actual analytics engines
    return [
      {
        type: query.analyticsType,
        data: { metric: 'sample', value: 100 },
        timestamp: new Date()
      }
    ]
  }

  private buildAnalyticsPrompt(question: string, data: any[]): string {
    return `Analytics Data:\n${JSON.stringify(data, null, 2)}\n\nQuestion: ${question}\n\nProvide a detailed analysis with trends, anomalies, and recommendations.`
  }

  private parseAnalyticsResponse(response: string, data: any[]): AnalyticsInsight {
    return {
      summary: response.substring(0, 200),
      trends: this.extractTrends(response),
      anomalies: this.extractAnomalies(response),
      recommendations: this.extractRecommendations(response),
      confidence: 0.8
    }
  }

  private extractTrends(text: string): Array<{ metric: string; direction: 'up' | 'down' | 'stable'; change: number }> {
    const trends: Array<{ metric: string; direction: 'up' | 'down' | 'stable'; change: number }> = []
    
    const upMatches = text.match(/(\w+)\s+(increased|rising|up)/gi)
    if (upMatches) {
      upMatches.forEach(match => {
        trends.push({ metric: match.split(' ')[0], direction: 'up', change: 10 })
      })
    }

    const downMatches = text.match(/(\w+)\s+(decreased|falling|down)/gi)
    if (downMatches) {
      downMatches.forEach(match => {
        trends.push({ metric: match.split(' ')[0], direction: 'down', change: -10 })
      })
    }

    return trends
  }

  private extractAnomalies(text: string): Array<{ description: string; severity: 'low' | 'medium' | 'high' }> {
    const anomalies: Array<{ description: string; severity: 'low' | 'medium' | 'high' }> = []
    
    const anomalyMatches = text.match(/anomaly|unusual|outlier|spike|drop/gi)
    if (anomalyMatches) {
      anomalies.push({
        description: 'Unusual pattern detected in data',
        severity: 'medium'
      })
    }

    return anomalies
  }

  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = []
    
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.match(/recommend|suggest|should|consider/i)) {
        recommendations.push(line.trim())
      }
    }

    return recommendations.slice(0, 5)
  }

  private extractFactors(text: string): string[] {
    const factors: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (line.match(/because|due to|caused by|factor/i)) {
        factors.push(line.trim())
      }
    }

    return factors.slice(0, 3)
  }

  private extractPrediction(text: string): string {
    const predictionMatch = text.match(/predict|forecast|expect|likely/i)
    if (predictionMatch) {
      const index = text.indexOf(predictionMatch[0])
      return text.substring(index, index + 200).trim()
    }
    return 'No clear prediction available'
  }

  private extractInsights(text: string): string[] {
    return text.split('\n').filter(line => line.length > 20).slice(0, 3)
  }

  private extractRecommendation(text: string): string {
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.match(/recommend/i)) {
        return line.trim()
      }
    }
    return 'Continue monitoring metrics'
  }

  private extractPredictionValue(text: string): number {
    const numberMatch = text.match(/\d+\.?\d*/g)
    return numberMatch ? parseFloat(numberMatch[0]) : 0
  }

  private extractRisks(text: string): string[] {
    const risks: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (line.match(/risk|concern|warning|issue/i)) {
        risks.push(line.trim())
      }
    }

    return risks.slice(0, 3)
  }

  private parseActions(text: string): Array<{ action: string; priority: 'low' | 'medium' | 'high'; impact: string }> {
    const actions: Array<{ action: string; priority: 'low' | 'medium' | 'high'; impact: string }> = []
    const lines = text.split('\n')

    for (const line of lines) {
      if (line.match(/^\d+\.|^-|^•/)) {
        const priority = line.match(/high|critical/i) ? 'high' : 
                        line.match(/medium|moderate/i) ? 'medium' : 'low'
        
        actions.push({
          action: line.replace(/^\d+\.|^-|^•/, '').trim(),
          priority,
          impact: 'Positive'
        })
      }
    }

    return actions.slice(0, 5)
  }
}

export const ragAnalyticsService = RAGAnalyticsService.getInstance()

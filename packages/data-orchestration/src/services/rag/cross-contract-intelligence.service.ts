/**
 * Cross-Contract Intelligence Service (Phase 5)
 * 
 * Pattern detection, relationship analysis, comparative analysis, and risk correlation
 */

import { knowledgeGraphService } from './knowledge-graph.service'
import { hybridRAGService } from './hybrid-rag.service'
import pino from 'pino'

const logger = pino({ name: 'cross-contract-intelligence' })

export interface PatternDetectionResult {
  pattern: string
  frequency: number
  contracts: string[]
  isStandard: boolean
  variance: number
}

export interface ComparativeAnalysis {
  metric: string
  contracts: Array<{
    contractId: string
    value: number
    isOutlier: boolean
    percentile: number
  }>
  average: number
  median: number
  stdDev: number
}

export interface RiskCorrelation {
  riskType: string
  affectedContracts: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  correlationScore: number
  recommendations: string[]
}

export class CrossContractIntelligenceService {
  private static instance: CrossContractIntelligenceService

  private constructor() {}

  static getInstance(): CrossContractIntelligenceService {
    if (!CrossContractIntelligenceService.instance) {
      CrossContractIntelligenceService.instance = new CrossContractIntelligenceService()
    }
    return CrossContractIntelligenceService.instance
  }

  /**
   * Detect common patterns across contracts
   */
  async detectPatterns(
    tenantId: string,
    patternType: 'clause' | 'term' | 'pricing' | 'risk'
  ): Promise<PatternDetectionResult[]> {
    try {
      logger.info({ tenantId, patternType }, 'Detecting patterns')

      const nodes = await knowledgeGraphService.query(tenantId, {
        nodeType: patternType === 'clause' ? 'clause' : 'term'
      })

      // Group similar items
      const patterns = new Map<string, string[]>()

      for (const node of nodes) {
        const content = node.properties.content || node.properties.name
        let foundPattern = false

        // Check if similar to existing pattern
        for (const [pattern, contracts] of patterns.entries()) {
          const similarity = this.calculateSimilarity(content, pattern)
          if (similarity > 0.7) {
            contracts.push(node.properties.contractId || node.id)
            foundPattern = true
            break
          }
        }

        if (!foundPattern) {
          patterns.set(content, [node.properties.contractId || node.id])
        }
      }

      // Convert to results
      const results: PatternDetectionResult[] = []
      const totalContracts = new Set(nodes.map(n => n.properties.contractId)).size

      for (const [pattern, contracts] of patterns.entries()) {
        const frequency = contracts.length / totalContracts
        const isStandard = frequency > 0.5 // Present in >50% of contracts

        results.push({
          pattern: pattern.substring(0, 200),
          frequency,
          contracts: [...new Set(contracts)],
          isStandard,
          variance: this.calculateVariance(contracts.length, totalContracts)
        })
      }

      return results.sort((a, b) => b.frequency - a.frequency).slice(0, 20)
    } catch (error) {
      logger.error({ error, tenantId }, 'Pattern detection failed')
      throw error
    }
  }

  /**
   * Analyze relationships between contracts
   */
  async analyzeRelationships(
    contractId: string,
    tenantId: string
  ): Promise<{
    directRelationships: Array<{ contractId: string; type: string; strength: number }>
    indirectRelationships: Array<{ contractId: string; path: string[]; strength: number }>
    networkMetrics: {
      centrality: number
      clustering: number
      degree: number
    }
  }> {
    try {
      const related = await knowledgeGraphService.findRelatedContracts(
        contractId,
        tenantId,
        3
      )

      const directRelationships = related
        .filter(r => r.relationshipPath.length === 1)
        .map(r => ({
          contractId: r.contractId,
          type: r.relationshipPath[0],
          strength: r.strength
        }))

      const indirectRelationships = related
        .filter(r => r.relationshipPath.length > 1)
        .map(r => ({
          contractId: r.contractId,
          path: r.relationshipPath,
          strength: r.strength
        }))

      // Calculate network metrics
      const degree = directRelationships.length
      const centrality = this.calculateCentrality(degree, related.length)
      const clustering = this.calculateClustering(directRelationships.length, related.length)

      return {
        directRelationships,
        indirectRelationships,
        networkMetrics: { centrality, clustering, degree }
      }
    } catch (error) {
      logger.error({ error, contractId }, 'Relationship analysis failed')
      throw error
    }
  }

  /**
   * Compare contracts across a metric
   */
  async compareContracts(
    tenantId: string,
    metric: 'value' | 'duration' | 'risk' | 'complexity',
    contractIds?: string[]
  ): Promise<ComparativeAnalysis> {
    try {
      // Get contracts
      const contracts = await knowledgeGraphService.query(tenantId, {
        nodeType: 'contract',
        ...(contractIds && { properties: { contractId: contractIds } })
      })

      // Extract metric values
      const values = await Promise.all(
        contracts.map(async c => {
          const value = await this.extractMetricValue(c, metric)
          return { contractId: c.properties.contractId, value }
        })
      )

      // Calculate statistics
      const sortedValues = values.map(v => v.value).sort((a, b) => a - b)
      const average = sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length
      const median = sortedValues[Math.floor(sortedValues.length / 2)]
      const stdDev = Math.sqrt(
        sortedValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / sortedValues.length
      )

      // Identify outliers
      const results = values.map(v => {
        const zScore = Math.abs((v.value - average) / stdDev)
        const percentile = sortedValues.filter(sv => sv <= v.value).length / sortedValues.length

        return {
          contractId: v.contractId,
          value: v.value,
          isOutlier: zScore > 2,
          percentile
        }
      })

      return {
        metric,
        contracts: results,
        average,
        median,
        stdDev
      }
    } catch (error) {
      logger.error({ error, tenantId }, 'Comparative analysis failed')
      throw error
    }
  }

  /**
   * Correlate risks across portfolio
   */
  async correlateRisks(
    tenantId: string
  ): Promise<RiskCorrelation[]> {
    try {
      // Get all contracts
      const contracts = await knowledgeGraphService.query(tenantId, {
        nodeType: 'contract'
      })

      // Group by risk types
      const riskGroups = new Map<string, string[]>()

      for (const contract of contracts) {
        const riskLevel = contract.properties.riskLevel || 'low'
        const riskType = contract.properties.riskType || 'general'

        if (!riskGroups.has(riskType)) {
          riskGroups.set(riskType, [])
        }
        riskGroups.get(riskType)!.push(contract.properties.contractId)
      }

      // Calculate correlations
      const correlations: RiskCorrelation[] = []

      for (const [riskType, affectedContracts] of riskGroups.entries()) {
        const correlationScore = affectedContracts.length / contracts.length
        const severity = this.calculateRiskSeverity(correlationScore, affectedContracts.length)

        correlations.push({
          riskType,
          affectedContracts,
          severity,
          correlationScore,
          recommendations: this.generateRiskRecommendations(riskType, severity, affectedContracts.length)
        })
      }

      return correlations.sort((a, b) => b.correlationScore - a.correlationScore)
    } catch (error) {
      logger.error({ error, tenantId }, 'Risk correlation failed')
      throw error
    }
  }

  /**
   * Find pricing patterns and benchmarks
   */
  async analyzePricingPatterns(
    tenantId: string
  ): Promise<{
    patterns: Array<{ description: string; frequency: number; avgValue: number }>
    outliers: Array<{ contractId: string; value: number; deviation: number }>
    recommendations: string[]
  }> {
    try {
      const amounts = await knowledgeGraphService.query(tenantId, {
        nodeType: 'amount'
      })

      // Group by currency and range
      const patterns = new Map<string, number[]>()

      for (const amount of amounts) {
        const value = parseFloat(amount.properties.value) || 0
        const currency = amount.properties.currency || 'USD'
        const range = this.getPriceRange(value)
        const key = `${currency}-${range}`

        if (!patterns.has(key)) {
          patterns.set(key, [])
        }
        patterns.get(key)!.push(value)
      }

      // Calculate pattern statistics
      const patternResults = Array.from(patterns.entries()).map(([key, values]) => {
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length
        const frequency = values.length / amounts.length

        return {
          description: key,
          frequency,
          avgValue
        }
      })

      // Find outliers
      const allValues = amounts.map(a => parseFloat(a.properties.value) || 0)
      const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length
      const stdDev = Math.sqrt(
        allValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / allValues.length
      )

      const outliers = amounts
        .map(a => {
          const value = parseFloat(a.properties.value) || 0
          const deviation = Math.abs((value - avg) / stdDev)
          return {
            contractId: a.properties.contractId || a.id,
            value,
            deviation
          }
        })
        .filter(o => o.deviation > 2)
        .sort((a, b) => b.deviation - a.deviation)

      const recommendations = this.generatePricingRecommendations(patternResults, outliers)

      return { patterns: patternResults, outliers, recommendations }
    } catch (error) {
      logger.error({ error, tenantId }, 'Pricing analysis failed')
      throw error
    }
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    return intersection.size / Math.max(words1.size, words2.size)
  }

  private calculateVariance(count: number, total: number): number {
    const p = count / total
    return p * (1 - p)
  }

  private calculateCentrality(degree: number, totalConnections: number): number {
    return totalConnections > 0 ? degree / totalConnections : 0
  }

  private calculateClustering(direct: number, total: number): number {
    return total > 0 ? direct / total : 0
  }

  private async extractMetricValue(contract: any, metric: string): Promise<number> {
    switch (metric) {
      case 'value':
        return parseFloat(contract.properties.totalValue) || 0
      case 'duration':
        return parseFloat(contract.properties.duration) || 12
      case 'risk':
        const riskMap = { low: 1, medium: 2, high: 3, critical: 4 }
        return riskMap[contract.properties.riskLevel as keyof typeof riskMap] || 1
      case 'complexity':
        return parseFloat(contract.properties.complexity) || 5
      default:
        return 0
    }
  }

  private calculateRiskSeverity(
    correlationScore: number,
    affectedCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (correlationScore > 0.7 || affectedCount > 50) return 'critical'
    if (correlationScore > 0.5 || affectedCount > 20) return 'high'
    if (correlationScore > 0.3 || affectedCount > 10) return 'medium'
    return 'low'
  }

  private generateRiskRecommendations(
    riskType: string,
    severity: string,
    count: number
  ): string[] {
    const recommendations: string[] = []

    if (severity === 'critical' || severity === 'high') {
      recommendations.push(`Immediate review required for ${count} contracts with ${riskType} risk`)
      recommendations.push('Consider implementing risk mitigation strategies')
      recommendations.push('Schedule stakeholder meeting to address systemic issues')
    }

    if (count > 10) {
      recommendations.push('Standardize contract templates to reduce risk exposure')
    }

    return recommendations
  }

  private getPriceRange(value: number): string {
    if (value < 10000) return '0-10K'
    if (value < 50000) return '10K-50K'
    if (value < 100000) return '50K-100K'
    if (value < 500000) return '100K-500K'
    return '500K+'
  }

  private generatePricingRecommendations(
    patterns: any[],
    outliers: any[]
  ): string[] {
    const recommendations: string[] = []

    if (outliers.length > 0) {
      recommendations.push(`Review ${outliers.length} contracts with unusual pricing`)
    }

    const dominantPattern = patterns.sort((a, b) => b.frequency - a.frequency)[0]
    if (dominantPattern) {
      recommendations.push(
        `Most common pricing pattern: ${dominantPattern.description} (${(dominantPattern.frequency * 100).toFixed(1)}%)`
      )
    }

    return recommendations
  }
}

export const crossContractIntelligenceService = CrossContractIntelligenceService.getInstance()

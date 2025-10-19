/**
 * Federated RAG Service (Phase 8)
 * 
 * Unified query interface across multiple data sources with caching and optimization
 */

import { hybridRAGService } from './hybrid-rag.service'
import { knowledgeGraphService } from './knowledge-graph.service'
import { multiModalRAGService } from './multi-modal-rag.service'
import { crossContractIntelligenceService } from './cross-contract-intelligence.service'
import pino from 'pino'

const logger = pino({ name: 'federated-rag' })

export interface FederatedQuery {
  query: string
  tenantId: string
  userId: string
  sources: Array<'vector' | 'graph' | 'multimodal' | 'analytics' | 'intelligence'>
  options?: {
    maxResults?: number
    timeout?: number
    cacheEnabled?: boolean
    parallelExecution?: boolean
  }
}

export interface FederatedResult {
  query: string
  results: Array<{
    source: string
    data: any
    relevance: number
    responseTime: number
    cached: boolean
  }>
  mergedResults: any[]
  totalResponseTime: number
  sourcesQueried: number
  sourcesSucceeded: number
  sourcesFailed: number
}

export class FederatedRAGService {
  private static instance: FederatedRAGService
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private readonly DEFAULT_CACHE_TTL = 300000 // 5 minutes

  private constructor() {
    // Start cache cleanup
    this.startCacheCleanup()
  }

  static getInstance(): FederatedRAGService {
    if (!FederatedRAGService.instance) {
      FederatedRAGService.instance = new FederatedRAGService()
    }
    return FederatedRAGService.instance
  }

  /**
   * Execute federated query across multiple sources
   */
  async query(federatedQuery: FederatedQuery): Promise<FederatedResult> {
    const startTime = Date.now()

    try {
      logger.info({
        query: federatedQuery.query,
        sources: federatedQuery.sources,
        tenantId: federatedQuery.tenantId
      }, 'Executing federated query')

      const results: FederatedResult['results'] = []
      let sourcesSucceeded = 0
      let sourcesFailed = 0

      // Execute queries in parallel or sequential based on options
      if (federatedQuery.options?.parallelExecution !== false) {
        const promises = federatedQuery.sources.map(source =>
          this.querySource(source, federatedQuery)
            .then(result => {
              results.push(result)
              sourcesSucceeded++
            })
            .catch(error => {
              logger.error({ error, source }, 'Source query failed')
              sourcesFailed++
            })
        )

        await Promise.allSettled(promises)
      } else {
        for (const source of federatedQuery.sources) {
          try {
            const result = await this.querySource(source, federatedQuery)
            results.push(result)
            sourcesSucceeded++
          } catch (error) {
            logger.error({ error, source }, 'Source query failed')
            sourcesFailed++
          }
        }
      }

      // Merge and rank results
      const mergedResults = this.mergeResults(results, federatedQuery.options?.maxResults)

      const totalResponseTime = Date.now() - startTime

      logger.info({
        query: federatedQuery.query,
        sourcesQueried: federatedQuery.sources.length,
        sourcesSucceeded,
        sourcesFailed,
        totalResponseTime
      }, 'Federated query completed')

      return {
        query: federatedQuery.query,
        results,
        mergedResults,
        totalResponseTime,
        sourcesQueried: federatedQuery.sources.length,
        sourcesSucceeded,
        sourcesFailed
      }
    } catch (error) {
      logger.error({ error, query: federatedQuery.query }, 'Federated query failed')
      throw error
    }
  }

  /**
   * Query a specific source
   */
  private async querySource(
    source: string,
    federatedQuery: FederatedQuery
  ): Promise<FederatedResult['results'][0]> {
    const startTime = Date.now()

    // Check cache
    if (federatedQuery.options?.cacheEnabled !== false) {
      const cached = this.getFromCache(source, federatedQuery.query, federatedQuery.tenantId)
      if (cached) {
        return {
          source,
          data: cached,
          relevance: 1.0,
          responseTime: Date.now() - startTime,
          cached: true
        }
      }
    }

    let data: any

    try {
      switch (source) {
        case 'vector':
          data = await hybridRAGService.search(
            federatedQuery.query,
            federatedQuery.tenantId,
            { maxResults: federatedQuery.options?.maxResults }
          )
          break

        case 'graph':
          data = await knowledgeGraphService.query(federatedQuery.tenantId, {
            limit: federatedQuery.options?.maxResults
          })
          break

        case 'multimodal':
          data = await multiModalRAGService.multiModalSearch(
            federatedQuery.query,
            federatedQuery.tenantId,
            { maxResults: federatedQuery.options?.maxResults }
          )
          break

        case 'intelligence':
          data = await crossContractIntelligenceService.detectPatterns(
            federatedQuery.tenantId,
            'clause'
          )
          break

        default:
          throw new Error(`Unknown source: ${source}`)
      }

      // Cache result
      if (federatedQuery.options?.cacheEnabled !== false) {
        this.addToCache(source, federatedQuery.query, federatedQuery.tenantId, data)
      }

      return {
        source,
        data,
        relevance: this.calculateSourceRelevance(source, data),
        responseTime: Date.now() - startTime,
        cached: false
      }
    } catch (error) {
      logger.error({ error, source }, 'Source query failed')
      throw error
    }
  }

  /**
   * Merge results from multiple sources
   */
  private mergeResults(
    results: FederatedResult['results'],
    maxResults: number = 20
  ): any[] {
    const merged: any[] = []
    const seen = new Set<string>()

    // Sort results by relevance
    const sortedResults = results
      .flatMap(r => {
        if (Array.isArray(r.data)) {
          return r.data.map(item => ({
            ...item,
            source: r.source,
            relevance: r.relevance * (item.relevance || 1)
          }))
        }
        return [{ data: r.data, source: r.source, relevance: r.relevance }]
      })
      .sort((a, b) => b.relevance - a.relevance)

    // Deduplicate and merge
    for (const result of sortedResults) {
      const key = this.getResultKey(result)
      
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(result)

        if (merged.length >= maxResults) break
      }
    }

    return merged
  }

  /**
   * Get result key for deduplication
   */
  private getResultKey(result: any): string {
    if (result.contractId) return `contract:${result.contractId}`
    if (result.id) return `id:${result.id}`
    return JSON.stringify(result).substring(0, 100)
  }

  /**
   * Calculate relevance score for a source
   */
  private calculateSourceRelevance(source: string, data: any): number {
    if (!data) return 0

    if (Array.isArray(data)) {
      if (data.length === 0) return 0
      
      // Average relevance of results
      const avgRelevance = data.reduce((sum, item) => {
        return sum + (item.relevance || item.similarity || 0.5)
      }, 0) / data.length

      return avgRelevance
    }

    return 0.8 // Default relevance for non-array results
  }

  /**
   * Cache management
   */
  private getFromCache(source: string, query: string, tenantId: string): any | null {
    const key = this.getCacheKey(source, query, tenantId)
    const cached = this.cache.get(key)

    if (!cached) return null

    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    logger.debug({ source, query }, 'Cache hit')
    return cached.data
  }

  private addToCache(source: string, query: string, tenantId: string, data: any): void {
    const key = this.getCacheKey(source, query, tenantId)
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.DEFAULT_CACHE_TTL
    })

    logger.debug({ source, query }, 'Added to cache')
  }

  private getCacheKey(source: string, query: string, tenantId: string): string {
    return `${source}:${tenantId}:${query.substring(0, 100)}`
  }

  private startCacheCleanup(): void {
    // Clean expired cache entries every minute
    setInterval(() => {
      const now = Date.now()
      let cleaned = 0

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key)
          cleaned++
        }
      }

      if (cleaned > 0) {
        logger.debug({ cleaned }, 'Cache cleanup completed')
      }
    }, 60000)
  }

  /**
   * Clear cache
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear cache for specific tenant
      for (const [key] of this.cache.entries()) {
        if (key.includes(`:${tenantId}:`)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }

    logger.info({ tenantId }, 'Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats(tenantId?: string): {
    totalEntries: number
    hitRate: number
    avgAge: number
    size: string
  } {
    let entries = Array.from(this.cache.entries())

    if (tenantId) {
      entries = entries.filter(([key]) => key.includes(`:${tenantId}:`))
    }

    const now = Date.now()
    const avgAge = entries.length > 0
      ? entries.reduce((sum, [, value]) => sum + (now - value.timestamp), 0) / entries.length
      : 0

    return {
      totalEntries: entries.length,
      hitRate: 0, // TODO: Track hits/misses
      avgAge,
      size: `${(JSON.stringify(entries).length / 1024).toFixed(2)} KB`
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    sources: Record<string, { status: string; responseTime: number }>
  }> {
    const sources: Record<string, { status: string; responseTime: number }> = {}

    // Check vector store
    try {
      const start = Date.now()
      await hybridRAGService.healthCheck()
      sources.vector = { status: 'healthy', responseTime: Date.now() - start }
    } catch (error) {
      sources.vector = { status: 'unhealthy', responseTime: 0 }
    }

    // Check knowledge graph
    try {
      const start = Date.now()
      await knowledgeGraphService.getStats('health-check')
      sources.graph = { status: 'healthy', responseTime: Date.now() - start }
    } catch (error) {
      sources.graph = { status: 'unhealthy', responseTime: 0 }
    }

    // Determine overall status
    const unhealthyCount = Object.values(sources).filter(s => s.status === 'unhealthy').length
    const status = unhealthyCount === 0 ? 'healthy' : 
                   unhealthyCount < Object.keys(sources).length ? 'degraded' : 'unhealthy'

    return { status, sources }
  }
}

export const federatedRAGService = FederatedRAGService.getInstance()

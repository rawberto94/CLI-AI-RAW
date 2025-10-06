/**
 * Enhanced Data Service for Negotiation Prep
 * Provides real-time data fetching with freshness indicators
 */

import { RateCardRole } from '../use-cases/multi-client-rate-data'
import { getRateHistory, RateHistoryPoint } from '../use-cases/rate-history-data'

export interface DataFreshnessInfo {
  lastUpdated: Date
  isStale: boolean
  staleDuration?: number // minutes
  nextRefresh?: Date
}

export interface EnhancedRateData {
  rates: RateCardRole[]
  history: RateHistoryPoint[]
  freshness: DataFreshnessInfo
  metadata: {
    totalRecords: number
    uniqueSuppliers: number
    dateRange: {
      from: Date
      to: Date
    }
  }
}

export class EnhancedDataService {
  private static STALE_THRESHOLD_MINUTES = 30
  private static dataCache = new Map<string, { data: any; timestamp: Date }>()

  /**
   * Fetch rate card data with freshness indicators
   */
  static async fetchRateCardData(
    role: string,
    level: string,
    location: string
  ): Promise<EnhancedRateData> {
    const cacheKey = `rates-${role}-${level}-${location}`
    const cached = this.dataCache.get(cacheKey)
    
    // Check if we have fresh cached data
    if (cached && !this.isStale(cached.timestamp)) {
      return {
        ...cached.data,
        freshness: this.calculateFreshness(cached.timestamp)
      }
    }

    // Fetch fresh data (in real implementation, this would be an API call)
    const rates = await this.fetchRatesFromRepository(role, level, location)
    const history = getRateHistory(role, level, location)
    
    const data: EnhancedRateData = {
      rates,
      history,
      freshness: this.calculateFreshness(new Date()),
      metadata: {
        totalRecords: rates.length,
        uniqueSuppliers: new Set(rates.map(r => r.supplierName)).size,
        dateRange: {
          from: history.length > 0 ? history[0].timestamp : new Date(),
          to: history.length > 0 ? history[history.length - 1].timestamp : new Date()
        }
      }
    }

    // Cache the data
    this.dataCache.set(cacheKey, { data, timestamp: new Date() })

    return data
  }

  /**
   * Fetch market intelligence data
   */
  static async fetchMarketIntelligence(
    role: string,
    level: string,
    location: string,
    currentRate: number
  ) {
    const data = await this.fetchRateCardData(role, level, location)
    const rates = data.rates.map(r => r.dailyRateCHF).sort((a, b) => a - b)
    
    return {
      averageRate: rates.reduce((sum, r) => sum + r, 0) / rates.length,
      medianRate: rates[Math.floor(rates.length / 2)],
      minRate: rates[0],
      maxRate: rates[rates.length - 1],
      competitivePosition: {
        marketRank: rates.filter(r => r < currentRate).length + 1,
        competitorsBelow: rates.filter(r => r < currentRate).length,
        competitorsAbove: rates.filter(r => r > currentRate).length,
        percentile: Math.round((rates.filter(r => r < currentRate).length / rates.length) * 100)
      },
      freshness: data.freshness
    }
  }

  /**
   * Refresh data for a specific cache key
   */
  static async refreshData(role: string, level: string, location: string): Promise<void> {
    const cacheKey = `rates-${role}-${level}-${location}`
    this.dataCache.delete(cacheKey)
    await this.fetchRateCardData(role, level, location)
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    this.dataCache.clear()
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    const entries = Array.from(this.dataCache.entries())
    return {
      totalEntries: entries.length,
      staleEntries: entries.filter(([_, v]) => this.isStale(v.timestamp)).length,
      freshEntries: entries.filter(([_, v]) => !this.isStale(v.timestamp)).length,
      oldestEntry: entries.length > 0 
        ? Math.min(...entries.map(([_, v]) => v.timestamp.getTime()))
        : null,
      newestEntry: entries.length > 0
        ? Math.max(...entries.map(([_, v]) => v.timestamp.getTime()))
        : null
    }
  }

  /**
   * Check if data is stale
   */
  private static isStale(timestamp: Date): boolean {
    const now = new Date()
    const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)
    return diffMinutes > this.STALE_THRESHOLD_MINUTES
  }

  /**
   * Calculate freshness information
   */
  private static calculateFreshness(timestamp: Date): DataFreshnessInfo {
    const now = new Date()
    const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)
    const isStale = diffMinutes > this.STALE_THRESHOLD_MINUTES

    const nextRefresh = new Date(timestamp)
    nextRefresh.setMinutes(nextRefresh.getMinutes() + this.STALE_THRESHOLD_MINUTES)

    return {
      lastUpdated: timestamp,
      isStale,
      staleDuration: isStale ? Math.floor(diffMinutes - this.STALE_THRESHOLD_MINUTES) : undefined,
      nextRefresh: !isStale ? nextRefresh : undefined
    }
  }

  /**
   * Fetch rates from repository (mock implementation)
   * In production, this would call the actual rate card repository
   */
  private static async fetchRatesFromRepository(
    role: string,
    level: string,
    location: string
  ): Promise<RateCardRole[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // In production, this would be:
    // return await rateCardRepository.findByRoleLevelLocation(role, level, location)
    
    // For now, return mock data
    const { allRateCardRoles } = await import('../use-cases/multi-client-rate-data')
    return allRateCardRoles.filter(r => 
      r.role === role && r.level === level && r.location === location
    )
  }

  /**
   * Subscribe to data updates (for real-time features)
   */
  static subscribeToUpdates(
    role: string,
    level: string,
    location: string,
    callback: (data: EnhancedRateData) => void
  ): () => void {
    // In production, this would set up WebSocket or polling
    const intervalId = setInterval(async () => {
      const data = await this.fetchRateCardData(role, level, location)
      if (data.freshness.isStale) {
        await this.refreshData(role, level, location)
        const freshData = await this.fetchRateCardData(role, level, location)
        callback(freshData)
      }
    }, 60000) // Check every minute

    // Return unsubscribe function
    return () => clearInterval(intervalId)
  }

  /**
   * Prefetch data for better performance
   */
  static async prefetchData(combinations: Array<{ role: string; level: string; location: string }>) {
    const promises = combinations.map(({ role, level, location }) =>
      this.fetchRateCardData(role, level, location)
    )
    await Promise.all(promises)
  }

  /**
   * Get data freshness status for UI indicators
   */
  static getDataStatus(freshness: DataFreshnessInfo): {
    status: 'fresh' | 'stale' | 'expired'
    color: string
    message: string
  } {
    if (!freshness.isStale) {
      return {
        status: 'fresh',
        color: 'green',
        message: 'Data is up to date'
      }
    }

    if (freshness.staleDuration && freshness.staleDuration < 60) {
      return {
        status: 'stale',
        color: 'yellow',
        message: `Data is ${freshness.staleDuration} minutes old`
      }
    }

    return {
      status: 'expired',
      color: 'red',
      message: 'Data needs refresh'
    }
  }
}

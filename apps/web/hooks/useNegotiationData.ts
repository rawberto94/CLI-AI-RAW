/**
 * Data hooks for Negotiation Prep
 * Provides caching, automatic refetching, and offline support
 * 
 * NOTE: This is a simplified version. For production, install @tanstack/react-query
 * and uncomment the React Query implementation below.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { EnhancedDataService, type EnhancedRateData } from '@/lib/negotiation-prep/enhanced-data-service'

// Uncomment this for React Query support:
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface UseNegotiationDataOptions {
  role: string
  level: string
  location: string
  currentRate: number
  enabled?: boolean
}

/**
 * Hook to fetch and cache negotiation data
 * Simplified version without React Query
 */
export function useNegotiationData({
  role,
  level,
  location,
  currentRate,
  enabled = true
}: UseNegotiationDataOptions) {
  const [rateData, setRateData] = useState<EnhancedRateData | null>(null)
  const [marketIntelligence, setMarketIntelligence] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setIsFetching(true)
    setError(null)

    try {
      const data = await EnhancedDataService.fetchRateCardData(role, level, location)
      setRateData(data)

      const intelligence = await EnhancedDataService.fetchMarketIntelligence(role, level, location, currentRate)
      setMarketIntelligence(intelligence)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [role, level, location, currentRate, enabled])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await EnhancedDataService.refreshData(role, level, location)
      await fetchData()
    } finally {
      setIsRefreshing(false)
    }
  }, [role, level, location, fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    // Data
    rateData,
    marketIntelligence,
    
    // Loading states
    isLoading,
    isFetching,
    isRefreshing,
    
    // Error states
    error,
    
    // Actions
    refresh,
    refetchRateData: fetchData,
    refetchMarketIntelligence: fetchData,
    
    // Freshness info
    freshness: rateData?.freshness,
    isStale: rateData?.freshness.isStale || false,
  }
}

/**
 * Hook for cache management
 */
export function useNegotiationCache() {
  const clearCache = () => {
    EnhancedDataService.clearCache()
  }

  const getCacheStats = () => {
    return EnhancedDataService.getCacheStats()
  }

  const prefetchData = async (combinations: Array<{ role: string; level: string; location: string }>) => {
    await EnhancedDataService.prefetchData(combinations)
  }

  return {
    clearCache,
    getCacheStats,
    prefetchData,
  }
}

/**
 * Hook for offline support
 */
export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' && navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
  }
}

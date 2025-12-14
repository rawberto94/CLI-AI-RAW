/**
 * Search utilities for contract components
 * Handles search logic, debouncing, and filtering
 */

import { useCallback, useState, useEffect } from 'react'
import { useDebounce } from 'react-use'

// Types
export interface SearchFilters {
  query?: string
  status?: string[]
  contractType?: string[]
  dateRange?: {
    from?: Date
    to?: Date
  }
  valueRange?: {
    min?: number
    max?: number
  }
  parties?: string[]
  tags?: string[]
  riskLevel?: string[]
}

export interface SavedSearch {
  id: string
  name: string
  filters: SearchFilters
  createdAt: Date
}

export interface SearchResult {
  id: string
  title: string
  snippet: string
  highlights: string[]
  score: number
  matchType: 'keyword' | 'semantic' | 'both'
}

export interface SearchState {
  query: string
  filters: SearchFilters
  results: SearchResult[]
  isLoading: boolean
  error: string | null
  suggestions: string[]
  recentSearches: string[]
}

// Custom hook for search functionality
export const useContractSearch = () => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {},
    results: [],
    isLoading: false,
    error: null,
    suggestions: [],
    recentSearches: [],
  })

  const [debouncedQuery, setDebouncedQuery] = useState('')
  
  // Debounce search query
  useDebounce(
    () => {
      setDebouncedQuery(searchState.query)
    },
    300,
    [searchState.query]
  )

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('contract-recent-searches')
    if (saved) {
      try {
        const recentSearches = JSON.parse(saved)
        setSearchState(prev => ({ ...prev, recentSearches }))
      } catch (error) {
        console.warn('Failed to load recent searches:', error)
      }
    }
  }, [])

  // Save recent search
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return
    
    setSearchState(prev => {
      const newRecentSearches = [
        query,
        ...prev.recentSearches.filter(s => s !== query)
      ].slice(0, 10) // Keep only last 10 searches
      
      // Save to localStorage
      localStorage.setItem('contract-recent-searches', JSON.stringify(newRecentSearches))
      
      return {
        ...prev,
        recentSearches: newRecentSearches
      }
    })
  }, [])

  // Update search query
  const setQuery = useCallback((query: string) => {
    setSearchState(prev => ({ ...prev, query }))
  }, [])

  // Update filters
  const setFilters = useCallback((filters: Partial<SearchFilters>) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }))
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }))
  }, [])

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      filters: {},
      results: [],
      error: null
    }))
  }, [])

  // Perform search
  const performSearch = useCallback(async (customQuery?: string, customFilters?: SearchFilters) => {
    const queryToUse = customQuery ?? debouncedQuery
    const filtersToUse = customFilters ?? searchState.filters
    
    if (!queryToUse.trim() && Object.keys(filtersToUse).length === 0) {
      setSearchState(prev => ({ ...prev, results: [], isLoading: false }))
      return
    }

    setSearchState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryToUse,
          filters: filtersToUse,
          mode: 'balanced', // Default to balanced search
        }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      
      setSearchState(prev => ({
        ...prev,
        results: data.results || [],
        isLoading: false
      }))

      // Save recent search if it was a query search
      if (queryToUse.trim()) {
        saveRecentSearch(queryToUse)
      }
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false
      }))
    }
  }, [debouncedQuery, searchState.filters, saveRecentSearch])

  // Auto-search when debounced query or filters change
  useEffect(() => {
    performSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, searchState.filters])

  // Get search suggestions
  const getSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchState(prev => ({ ...prev, suggestions: [] }))
      return
    }

    try {
      const response = await fetch(`/api/contracts/suggestions?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const suggestions = await response.json()
        setSearchState(prev => ({ ...prev, suggestions }))
      }
    } catch (error) {
      console.warn('Failed to get suggestions:', error)
    }
  }, [])

  return {
    ...searchState,
    debouncedQuery,
    setQuery,
    setFilters,
    clearFilters,
    clearSearch,
    performSearch,
    getSuggestions,
  }
}

// Utility functions for search
export const highlightSearchTerms = (text: string, terms: string[]): string => {
  if (!terms.length) return text
  
  let highlightedText = text
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi')
    highlightedText = highlightedText.replace(regex, '<mark>$1</mark>')
  })
  
  return highlightedText
}

export const extractSnippet = (text: string, searchTerm: string, maxLength = 200): string => {
  if (!searchTerm) return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  
  const index = text.toLowerCase().indexOf(searchTerm.toLowerCase())
  if (index === -1) return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '')
  
  const start = Math.max(0, index - 50)
  const end = Math.min(text.length, start + maxLength)
  
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet
}

// Filter utilities
export const createFilterChip = (key: string, value: string | string[], onRemove: () => void) => {
  const displayValue = Array.isArray(value) ? value.join(', ') : value
  return {
    id: `${key}-${displayValue}`,
    label: `${key}: ${displayValue}`,
    onRemove,
  }
}

export const getActiveFilterCount = (filters: SearchFilters): number => {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'query') return count
    if (Array.isArray(value)) return count + value.length
    if (value && typeof value === 'object') {
      // Handle date/value ranges
      return count + Object.values(value).filter(Boolean).length
    }
    return value ? count + 1 : count
  }, 0)
}

// Saved search utilities
export const useSavedSearches = () => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])

  // Load saved searches
  useEffect(() => {
    const saved = localStorage.getItem('contract-saved-searches')
    if (saved) {
      try {
        const searches = JSON.parse(saved).map((search: any) => ({
          ...search,
          createdAt: new Date(search.createdAt)
        }))
        setSavedSearches(searches)
      } catch (error) {
        console.warn('Failed to load saved searches:', error)
      }
    }
  }, [])

  const saveSearch = useCallback((name: string, filters: SearchFilters) => {
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      filters,
      createdAt: new Date(),
    }

    setSavedSearches(prev => {
      const updated = [...prev, newSearch]
      localStorage.setItem('contract-saved-searches', JSON.stringify(updated))
      return updated
    })
  }, [])

  const deleteSearch = useCallback((id: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(search => search.id !== id)
      localStorage.setItem('contract-saved-searches', JSON.stringify(updated))
      return updated
    })
  }, [])

  return {
    savedSearches,
    saveSearch,
    deleteSearch,
  }
}

// Search analytics
export const trackSearchEvent = (event: string, data?: any) => {
  // In production, integrate with your analytics service
  console.log('Search event:', event, data)
}

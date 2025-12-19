'use client'

import React, { useState, useEffect } from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  Building,
  FileText,
  Sparkles,
  Clock,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface SearchResult {
  id: string
  title: string
  type: 'contract' | 'artifact' | 'supplier'
  snippet: string
  metadata: {
    supplier?: string
    value?: number
    date?: string
    status?: string
  }
  relevance: number
}

interface SearchFilters {
  dateRange?: string
  minValue?: number
  maxValue?: number
  supplier?: string
  status?: string
}

export function SmartSearch() {
  const { dataMode, isRealData } = useDataMode()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const hasActiveFilters = Object.values(filters).some((v) => {
    if (v === undefined || v === null || v === '') return false
    if (typeof v === 'number' && Number.isNaN(v)) return false
    return true
  })

  useEffect(() => {
    // Load recent searches from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('recentSearches')
        if (saved) {
          setRecentSearches(JSON.parse(saved))
        }
      } catch (error) {
        console.error('Error loading recent searches:', error)
      }
    }
  }, [])

  const performSearch = async (options?: { filters?: SearchFilters }) => {
    const q = query.trim()
    if (!q) return
    const effectiveFilters = options?.filters ?? filters

    setIsSearching(true)

    // Save to recent searches
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5)
    setRecentSearches(updated)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('recentSearches', JSON.stringify(updated))
      } catch (error) {
        console.error('Error saving recent searches:', error)
      }
    }

    try {
      if (isRealData) {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-data-mode': dataMode
          },
          body: JSON.stringify({ query: q, filters: effectiveFilters })
        })
        const data = await response.json()
        setResults(data.results)
      } else {
        // Mock results
        await new Promise(resolve => setTimeout(resolve, 800))
        
        const mockResults: SearchResult[] = [
          {
            id: '1',
            title: 'Software Development Services Agreement',
            type: 'contract',
            snippet: `...found matching terms for "${q}" in the contract scope and deliverables section...`,
            metadata: {
              supplier: 'TechCorp Inc',
              value: 1250000,
              date: '2024-01-15',
              status: 'Active'
            },
            relevance: 0.95
          },
          {
            id: '2',
            title: 'Rate Card - Senior Developers',
            type: 'artifact',
            snippet: `...rate information matching "${q}" with competitive pricing and terms...`,
            metadata: {
              supplier: 'DevStaff Solutions',
              value: 850000,
              date: '2024-03-20',
              status: 'Active'
            },
            relevance: 0.87
          },
          {
            id: '3',
            title: 'Acme Corporation',
            type: 'supplier',
            snippet: `...supplier profile matching "${q}" with 15 active contracts and excellent ratings...`,
            metadata: {
              value: 3200000,
              status: 'Preferred'
            },
            relevance: 0.82
          }
        ]

        setResults(mockResults)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setFilters({})
  }

  const resetFilters = async () => {
    const nextFilters: SearchFilters = {}
    setFilters(nextFilters)
    if (query.trim()) {
      await performSearch({ filters: nextFilters })
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'contract': return <FileText className="h-4 w-4" />
      case 'artifact': return <FileText className="h-4 w-4" />
      case 'supplier': return <Building className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'contract': return 'bg-blue-100 text-blue-700'
      case 'artifact': return 'bg-purple-100 text-purple-700'
      case 'supplier': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                  placeholder="Search contracts, artifacts, suppliers..."
                  className="pl-10 pr-10"
                />
                {query && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              <Button onClick={() => performSearch()} disabled={isSearching || !query.trim()}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Data Mode Indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="h-4 w-4" />
              <span>
                Using <strong>{dataMode}</strong> search
                {!isRealData && ' - Semantic search with AI-powered relevance'}
              </span>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={filters.dateRange || ''}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                  >
                    <option value="">All time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Value</label>
                  <Input
                    type="number"
                    placeholder="$0"
                    value={filters.minValue || ''}
                    onChange={(e) => setFilters({ ...filters, minValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={filters.status || ''}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {!query && recentSearches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(search)}
                      className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found <strong>{results.length}</strong> results for &ldquo;{query}&rdquo;
            </p>
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Sort by relevance
            </Button>
          </div>

          {results.map((result) => (
            <Card key={result.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getTypeColor(result.type)}>
                          {getTypeIcon(result.type)}
                          <span className="ml-1 capitalize">{result.type}</span>
                        </Badge>
                        {result.metadata.status && (
                          <Badge variant="secondary">{result.metadata.status}</Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {Math.round(result.relevance * 100)}% match
                        </span>
                      </div>
                      <Link href={`/contracts/${result.id}`}>
                        <h3 className="font-semibold text-lg hover:text-blue-600 transition-colors">
                          {result.title}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{result.snippet}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {result.metadata.supplier && (
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {result.metadata.supplier}
                      </div>
                    )}
                    {result.metadata.value && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${result.metadata.value.toLocaleString()}
                      </div>
                    )}
                    {result.metadata.date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {result.metadata.date}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {query && !isSearching && results.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No results found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm text-gray-500">
              Try different keywords{hasActiveFilters ? ', reset filters,' : ''} or switch to advanced search.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={clearSearch}>
                Clear search
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href="/search/advanced">Advanced search</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Auto-generated default export
export default SmartSearch;

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Clock, TrendingUp, FileText, Building2, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface SearchResult {
  id: string
  type: 'contract' | 'supplier' | 'clause' | 'risk' | 'opportunity'
  title: string
  description: string
  url: string
  score: number
  metadata?: {
    riskLevel?: 'low' | 'medium' | 'high' | 'critical'
    value?: number
    date?: string
    status?: string
  }
}

interface SearchSuggestion {
  id: string
  text: string
  type: 'recent' | 'trending' | 'ai-suggested'
  count?: number
}

export default function IntelligentSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize suggestions and recent searches
  useEffect(() => {
    const initialSuggestions: SearchSuggestion[] = [
      { id: '1', text: 'high risk contracts', type: 'trending', count: 23 },
      { id: '2', text: 'supplier agreements 2024', type: 'trending', count: 45 },
      { id: '3', text: 'payment terms optimization', type: 'ai-suggested' },
      { id: '4', text: 'compliance violations', type: 'trending', count: 12 },
      { id: '5', text: 'contract renewal opportunities', type: 'ai-suggested' },
      { id: '6', text: 'liability clauses analysis', type: 'ai-suggested' },
    ]
    
    const recent = [
      'Microsoft Enterprise Agreement',
      'AWS Service Contract',
      'Vendor Risk Assessment'
    ]
    
    setSuggestions(initialSuggestions)
    setRecentSearches(recent)
  }, [])

  // Simulate search with AI-powered results
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    
    const searchTimeout = setTimeout(() => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'contract',
          title: 'Microsoft Enterprise Agreement 2024',
          description: 'Software licensing agreement with Microsoft Corporation',
          url: '/contracts/microsoft-ea-2024',
          score: 95,
          metadata: {
            riskLevel: 'medium',
            value: 2500000,
            date: '2024-03-15',
            status: 'Active'
          }
        },
        {
          id: '2',
          type: 'risk',
          title: 'High-Risk Payment Terms Detected',
          description: 'AI identified potentially problematic payment clauses in 3 contracts',
          url: '/risk/payment-terms-analysis',
          score: 88,
          metadata: {
            riskLevel: 'high',
            count: 3
          }
        },
        {
          id: '3',
          type: 'opportunity',
          title: 'Cost Optimization Opportunity',
          description: 'Potential savings identified in vendor contracts',
          url: '/opportunities/cost-optimization',
          score: 82,
          metadata: {
            value: 125000,
            riskLevel: 'low'
          }
        },
        {
          id: '4',
          type: 'supplier',
          title: 'Acme Corp Supplier Profile',
          description: 'Complete supplier analysis with risk assessment',
          url: '/suppliers/acme-corp',
          score: 78,
          metadata: {
            riskLevel: 'low',
            status: 'Verified'
          }
        },
        {
          id: '5',
          type: 'clause',
          title: 'Liability Limitation Clauses',
          description: 'Standard liability clauses found in 15 contracts',
          url: '/clauses/liability-limitation',
          score: 75,
          metadata: {
            count: 15
          }
        }
      ].filter(result => 
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.description.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes('risk') && result.type === 'risk' ||
        query.toLowerCase().includes('opportunity') && result.type === 'opportunity'
      )

      setResults(mockResults)
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(searchTimeout)
  }, [query])

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery.trim() && !recentSearches.includes(searchQuery)) {
      setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)])
    }
  }

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'contract': return <FileText className="h-4 w-4 text-blue-500" />
      case 'supplier': return <Building2 className="h-4 w-4 text-green-500" />
      case 'risk': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'opportunity': return <TrendingUp className="h-4 w-4 text-purple-500" />
      case 'clause': return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  const getRiskBadgeColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'recent': return <Clock className="h-3 w-3 text-gray-400" />
      case 'trending': return <TrendingUp className="h-3 w-3 text-blue-500" />
      case 'ai-suggested': return <Sparkles className="h-3 w-3 text-purple-500" />
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search contracts, risks, opportunities..."
            className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search contracts, risks, opportunities..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-96">
            {!query && (
              <>
                {recentSearches.length > 0 && (
                  <CommandGroup heading="Recent Searches">
                    {recentSearches.map((search, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleSearch(search)}
                        className="flex items-center gap-2"
                      >
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span>{search}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                
                <CommandSeparator />
                
                <CommandGroup heading="Trending & AI Suggestions">
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      onSelect={() => handleSearch(suggestion.text)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {getSuggestionIcon(suggestion.type)}
                        <span>{suggestion.text}</span>
                        {suggestion.type === 'ai-suggested' && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                            AI
                          </Badge>
                        )}
                      </div>
                      {suggestion.count && (
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.count}
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {query && (
              <>
                {isLoading ? (
                  <CommandEmpty>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Searching with AI intelligence...
                    </div>
                  </CommandEmpty>
                ) : results.length === 0 ? (
                  <CommandEmpty>
                    <div className="text-center py-6">
                      <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-muted-foreground">No results found for "{query}"</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try searching for contracts, suppliers, or risk terms
                      </p>
                    </div>
                  </CommandEmpty>
                ) : (
                  <CommandGroup heading={`Results for "${query}"`}>
                    {results.map((result) => (
                      <CommandItem
                        key={result.id}
                        onSelect={() => {
                          window.location.href = result.url
                          setIsOpen(false)
                        }}
                        className="p-0"
                      >
                        <Card className="w-full border-0 shadow-none hover:bg-muted/50 transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {getResultIcon(result.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm truncate">
                                    {result.title}
                                  </h4>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {result.type}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {result.score}% match
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {result.description}
                                </p>
                                {result.metadata && (
                                  <div className="flex items-center gap-2">
                                    {result.metadata.riskLevel && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${getRiskBadgeColor(result.metadata.riskLevel)}`}
                                      >
                                        {result.metadata.riskLevel} risk
                                      </Badge>
                                    )}
                                    {result.metadata.value && (
                                      <Badge variant="outline" className="text-xs">
                                        ${result.metadata.value.toLocaleString()}
                                      </Badge>
                                    )}
                                    {result.metadata.status && (
                                      <Badge variant="outline" className="text-xs">
                                        {result.metadata.status}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
        
        {query && results.length > 0 && (
          <div className="border-t p-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => {
                window.location.href = `/search?q=${encodeURIComponent(query)}`
                setIsOpen(false)
              }}
            >
              View all {results.length} results for "{query}"
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
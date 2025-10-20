'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import {
  Home,
  Upload,
  Search,
  FileText,
  BarChart3,
  Settings,
  DollarSign,
  Calendar,
  Shield,
  Network,
  TrendingUp,
  Database,
  Users,
  Tag,
  FileSpreadsheet,
  Sparkles,
  Clock
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type SearchResultType = 
  | 'page'
  | 'action'
  | 'contract'
  | 'use-case'
  | 'rate-card'
  | 'recent'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  keywords?: string[]
  badge?: string
}

interface CommandPaletteProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// ============================================================================
// SEARCH RESULTS DATA
// ============================================================================

const useSearchResults = (query: string) => {
  const router = useRouter()
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recent-searches')
    if (recent) {
      try {
        setRecentSearches(JSON.parse(recent))
      } catch (e) {
        console.error('Failed to parse recent searches', e)
      }
    }
  }, [])

  const saveRecentSearch = useCallback((result: SearchResult) => {
    const updated = [
      result,
      ...recentSearches.filter(r => r.id !== result.id)
    ].slice(0, 5)
    
    setRecentSearches(updated)
    localStorage.setItem('recent-searches', JSON.stringify(updated))
  }, [recentSearches])

  // Quick Actions
  const quickActions: SearchResult[] = [
    {
      id: 'upload-contract',
      type: 'action',
      title: 'Upload Contract',
      description: 'Upload a new contract for analysis',
      icon: Upload,
      action: () => {
        router.push('/contracts?action=upload')
      },
      keywords: ['upload', 'add', 'new', 'contract', 'file']
    },
    {
      id: 'import-rate-card',
      type: 'action',
      title: 'Import Rate Card',
      description: 'Import supplier rate card (CSV/Excel)',
      icon: FileSpreadsheet,
      action: () => {
        router.push('/import/rate-cards')
      },
      keywords: ['import', 'rate', 'card', 'csv', 'excel', 'upload']
    },
    {
      id: 'run-compliance',
      type: 'action',
      title: 'Run Compliance Check',
      description: 'Scan contracts for compliance issues',
      icon: Shield,
      action: () => {
        router.push('/use-cases/compliance-check')
      },
      keywords: ['compliance', 'check', 'scan', 'gdpr', 'ccpa']
    },
    {
      id: 'benchmark-rates',
      type: 'action',
      title: 'Benchmark Rates',
      description: 'Compare rates against market data',
      icon: DollarSign,
      action: () => {
        router.push('/use-cases/rate-benchmarking')
      },
      keywords: ['benchmark', 'rates', 'compare', 'market', 'savings']
    }
  ]

  // Navigation Pages
  const pages: SearchResult[] = [
    {
      id: 'dashboard',
      type: 'page',
      title: 'Dashboard',
      description: 'Overview and key metrics',
      icon: Home,
      action: () => router.push('/dashboard'),
      keywords: ['dashboard', 'home', 'overview']
    },
    {
      id: 'contracts',
      type: 'page',
      title: 'Contracts',
      description: 'Manage all contracts',
      icon: FileText,
      action: () => router.push('/contracts'),
      keywords: ['contracts', 'documents', 'agreements']
    },
    {
      id: 'analytics',
      type: 'page',
      title: 'Analytics',
      description: 'Insights and reports',
      icon: BarChart3,
      action: () => router.push('/analytics'),
      keywords: ['analytics', 'insights', 'reports', 'data']
    },
    {
      id: 'use-cases',
      type: 'page',
      title: 'Use Cases',
      description: 'Explore workflows',
      icon: Sparkles,
      action: () => router.push('/use-cases'),
      keywords: ['use', 'cases', 'workflows', 'features']
    },
    {
      id: 'rate-cards',
      type: 'page',
      title: 'Rate Cards',
      description: 'Manage rate cards',
      icon: FileSpreadsheet,
      action: () => router.push('/rate-cards'),
      keywords: ['rate', 'cards', 'pricing', 'suppliers']
    },
    {
      id: 'taxonomy',
      type: 'page',
      title: 'Taxonomy',
      description: 'Categories and tags',
      icon: Tag,
      action: () => router.push('/taxonomy'),
      keywords: ['taxonomy', 'categories', 'tags', 'metadata']
    },
    {
      id: 'settings',
      type: 'page',
      title: 'Settings',
      description: 'Configure your account',
      icon: Settings,
      action: () => router.push('/settings'),
      keywords: ['settings', 'preferences', 'config']
    }
  ]

  // Use Cases
  const useCases: SearchResult[] = [
    {
      id: 'rate-benchmarking',
      type: 'use-case',
      title: 'Rate Card Benchmarking',
      description: '$186K cost savings/contract',
      icon: DollarSign,
      action: () => router.push('/use-cases/rate-benchmarking'),
      keywords: ['rate', 'benchmark', 'savings', 'pricing'],
      badge: 'Quick Win'
    },
    {
      id: 'renewal-radar',
      type: 'use-case',
      title: 'Contract Renewal Radar',
      description: '$890K/year cost savings',
      icon: Calendar,
      action: () => router.push('/use-cases/renewal-radar'),
      keywords: ['renewal', 'expiry', 'deadline', 'alert'],
      badge: 'Quick Win'
    },
    {
      id: 'compliance-check',
      type: 'use-case',
      title: 'Compliance Health Check',
      description: '$890K risk mitigation',
      icon: Shield,
      action: () => router.push('/use-cases/compliance-check'),
      keywords: ['compliance', 'gdpr', 'ccpa', 'sox', 'risk'],
      badge: 'Scalable'
    },
    {
      id: 'cross-contract',
      type: 'use-case',
      title: 'Cross-Contract Intelligence',
      description: '$2.1M bundling savings',
      icon: Network,
      action: () => router.push('/use-cases/cross-contract-intelligence'),
      keywords: ['cross', 'contract', 'intelligence', 'bundling'],
      badge: 'Differentiating'
    },
    {
      id: 'savings-pipeline',
      type: 'use-case',
      title: 'Savings Pipeline Tracker',
      description: '$2.56M cost savings pipeline',
      icon: TrendingUp,
      action: () => router.push('/use-cases/savings-pipeline'),
      keywords: ['savings', 'pipeline', 'tracking', 'roi'],
      badge: 'Client-Facing'
    },
    {
      id: 'sievo-integration',
      type: 'use-case',
      title: 'Sievo Integration',
      description: '$1.03M/year cost savings',
      icon: Database,
      action: () => router.push('/use-cases/sievo-integration'),
      keywords: ['sievo', 'integration', 'spend', 'data'],
      badge: 'Scalable'
    },
    {
      id: 'supplier-snapshots',
      type: 'use-case',
      title: 'Supplier Snapshot Packs',
      description: '$186K cost savings/supplier',
      icon: Users,
      action: () => router.push('/use-cases/supplier-snapshots'),
      keywords: ['supplier', 'snapshot', 'intelligence', 'analysis'],
      badge: 'Client-Facing'
    }
  ]

  // Filter results based on query
  const filterResults = (results: SearchResult[]) => {
    if (!query) return results

    const lowerQuery = query.toLowerCase()
    
    return results.filter(result => {
      const titleMatch = result.title.toLowerCase().includes(lowerQuery)
      const descMatch = result.description?.toLowerCase().includes(lowerQuery)
      const keywordMatch = result.keywords?.some(k => k.includes(lowerQuery))
      
      return titleMatch || descMatch || keywordMatch
    })
  }

  return {
    quickActions: filterResults(quickActions),
    pages: filterResults(pages),
    useCases: filterResults(useCases),
    recentSearches: query ? [] : recentSearches,
    saveRecentSearch
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const GlobalCommandPalette: React.FC<CommandPaletteProps> = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [query, setQuery] = useState('')

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  const {
    quickActions,
    pages,
    useCases,
    recentSearches,
    saveRecentSearch
  } = useSearchResults(query)

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [setOpen])

  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(result)
    result.action()
    setOpen(false)
    setQuery('')
  }

  const hasResults = 
    quickActions.length > 0 ||
    pages.length > 0 ||
    useCases.length > 0 ||
    recentSearches.length > 0

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search for actions, pages, contracts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {!hasResults && (
          <CommandEmpty>
            No results found for "{query}"
          </CommandEmpty>
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentSearches.map((result) => {
                const Icon = result.icon
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <Icon className="w-4 h-4 text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{result.title}</p>
                      {result.description && (
                        <p className="text-sm text-gray-600 truncate">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <>
            <CommandGroup heading="Quick Actions">
              {quickActions.map((result) => {
                const Icon = result.icon
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Icon className="w-4 h-4 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{result.title}</p>
                      {result.description && (
                        <p className="text-sm text-gray-600 truncate">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Pages */}
        {pages.length > 0 && (
          <>
            <CommandGroup heading="Pages">
              {pages.map((result) => {
                const Icon = result.icon
                return (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Icon className="w-4 h-4 text-gray-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{result.title}</p>
                      {result.description && (
                        <p className="text-sm text-gray-600 truncate">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Use Cases */}
        {useCases.length > 0 && (
          <CommandGroup heading="Use Cases">
            {useCases.map((result) => {
              const Icon = result.icon
              return (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Icon className="w-4 h-4 text-purple-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{result.title}</p>
                      {result.badge && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          {result.badge}
                        </span>
                      )}
                    </div>
                    {result.description && (
                      <p className="text-sm text-gray-600 truncate">
                        {result.description}
                      </p>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-600 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Esc</kbd>
            Close
          </span>
        </div>
        <span className="text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">⌘K</kbd> to open
        </span>
      </div>
    </CommandDialog>
  )
}

export default GlobalCommandPalette

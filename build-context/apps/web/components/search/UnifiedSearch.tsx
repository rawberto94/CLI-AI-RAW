/**
 * Unified Search Component
 * Combines contract search, RAG semantic search, and rate card search
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, X, FileText, DollarSign, Sparkles, Loader2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  type: 'contract' | 'rate-card' | 'semantic';
  snippet: string;
  score?: number;
  metadata?: Record<string, any>;
  url: string;
}

interface UnifiedSearchProps {
  onResultClick?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function UnifiedSearch({
  onResultClick,
  placeholder = 'Search contracts, rate cards, or ask a question...',
  className,
  autoFocus = false,
}: UnifiedSearchProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{
    contracts: SearchResult[];
    rateCards: SearchResult[];
    semantic: SearchResult[];
  }>({
    contracts: [],
    rateCards: [],
    semantic: [],
  });
  const [activeTab, setActiveTab] = useState<'all' | 'contracts' | 'rate-cards' | 'semantic'>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch {
        // Failed to load search history
      }
    }
  }, []);

  const addToHistory = useCallback((searchQuery: string) => {
    setSearchHistory((prev) => {
      const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ contracts: [], rateCards: [], semantic: [] });
      return;
    }

    setIsSearching(true);
    addToHistory(searchQuery);

    try {
      // Parallel search across all endpoints
      const [contractsRes, rateCardsRes, semanticRes] = await Promise.allSettled([
        fetch(`/api/contracts/search?q=${encodeURIComponent(searchQuery)}&limit=10`),
        fetch(`/api/rate-cards?search=${encodeURIComponent(searchQuery)}&limit=10`),
        fetch('/api/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 10 }),
        }),
      ]);

      const contracts: SearchResult[] = [];
      const rateCards: SearchResult[] = [];
      const semantic: SearchResult[] = [];

      // Process contract results
      if (contractsRes.status === 'fulfilled' && contractsRes.value.ok) {
        const data = await contractsRes.value.json();
        const contractsList = data.data?.contracts || data.contracts || [];
        contracts.push(
          ...contractsList.map((c: any) => ({
            id: c.id,
            title: c.contractTitle || 'Untitled Contract',
            type: 'contract' as const,
            snippet: `${c.supplierName || 'Unknown'} | ${c.status || ''} | ${c.totalValue ? `$${Number(c.totalValue).toLocaleString()}` : ''}`,
            metadata: {
              supplierName: c.supplierName,
              status: c.status,
              totalValue: c.totalValue,
            },
            url: `/contracts/${c.id}`,
          }))
        );
      }

      // Process rate card results
      if (rateCardsRes.status === 'fulfilled' && rateCardsRes.value.ok) {
        const data = await rateCardsRes.value.json();
        const rateCardsList = data.data || data.rateCards || [];
        rateCards.push(
          ...rateCardsList.map((rc: any) => ({
            id: rc.id,
            title: rc.roleName || rc.name || 'Rate Card',
            type: 'rate-card' as const,
            snippet: `${rc.supplierName || ''} | ${rc.rateValue ? `$${rc.rateValue}` : ''} | ${rc.location || ''}`,
            metadata: {
              supplierName: rc.supplierName,
              rateValue: rc.rateValue,
              location: rc.location,
            },
            url: `/rate-cards?id=${rc.id}`,
          }))
        );
      }

      // Process semantic/RAG results
      if (semanticRes.status === 'fulfilled' && semanticRes.value.ok) {
        const data = await semanticRes.value.json();
        const semanticList = data.results || data.data?.results || [];
        semantic.push(
          ...semanticList.map((s: any) => ({
            id: s.id || s.contractId,
            title: s.title || s.content?.substring(0, 50) || 'Semantic Result',
            type: 'semantic' as const,
            snippet: s.content || s.text || '',
            score: s.score || s.similarity,
            metadata: s.metadata || {},
            url: s.contractId ? `/contracts/${s.contractId}` : '#',
          }))
        );
      }

      setResults({ contracts, rateCards, semantic });
    } catch {
      // Search failed
    } finally {
      setIsSearching(false);
    }
  }, [addToHistory]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  }, [query, performSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults({ contracts: [], rateCards: [], semantic: [] });
  }, []);

  const allResults = [
    ...results.contracts,
    ...results.rateCards,
    ...results.semantic,
  ];

  const totalResults = allResults.length;

  return (
    <div className={cn('relative w-full', className)}>
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="pl-10 pr-10"
            autoFocus={autoFocus}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {isSearching && (
        <Card className="absolute top-full mt-2 w-full z-50 p-4">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Searching...</span>
          </div>
        </Card>
      )}

      {!isSearching && totalResults > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 max-h-[500px] overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <div className="border-b px-3 py-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
                <TabsTrigger value="contracts">Contracts ({results.contracts.length})</TabsTrigger>
                <TabsTrigger value="rate-cards">Rate Cards ({results.rateCards.length})</TabsTrigger>
                <TabsTrigger value="semantic">
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI ({results.semantic.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              <TabsContent value="all" className="m-0 p-2">
                <SearchResultsList results={allResults} onResultClick={onResultClick} />
              </TabsContent>
              <TabsContent value="contracts" className="m-0 p-2">
                <SearchResultsList results={results.contracts} onResultClick={onResultClick} />
              </TabsContent>
              <TabsContent value="rate-cards" className="m-0 p-2">
                <SearchResultsList results={results.rateCards} onResultClick={onResultClick} />
              </TabsContent>
              <TabsContent value="semantic" className="m-0 p-2">
                <SearchResultsList results={results.semantic} onResultClick={onResultClick} />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      )}

      {!isSearching && query && totalResults === 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 p-4">
          <p className="text-sm text-muted-foreground text-center">
            No results found for &quot;{query}&quot;
          </p>
        </Card>
      )}

      {!query && searchHistory.length > 0 && (
        <Card className="absolute top-full mt-2 w-full z-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Recent Searches</span>
          </div>
          <div className="space-y-1">
            {searchHistory.slice(0, 5).map((hist, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(hist);
                  performSearch(hist);
                }}
                className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded"
              >
                {hist}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SearchResultsList({
  results,
  onResultClick,
}: {
  results: SearchResult[];
  onResultClick?: (result: SearchResult) => void;
}) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No results in this category
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <Link
          key={result.id}
          href={result.url}
          onClick={() => onResultClick?.(result)}
          className="block p-3 rounded-md hover:bg-accent transition-colors"
        >
          <div className="flex items-start gap-3">
            {result.type === 'contract' && <FileText className="h-5 w-5 text-violet-500 mt-0.5" />}
            {result.type === 'rate-card' && <DollarSign className="h-5 w-5 text-green-500 mt-0.5" />}
            {result.type === 'semantic' && <Sparkles className="h-5 w-5 text-violet-500 mt-0.5" />}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{result.title}</h4>
                <Badge variant="outline" className="shrink-0">
                  {result.type}
                </Badge>
                {result.score && (
                  <Badge variant="secondary" className="shrink-0">
                    {Math.round(result.score * 100)}%
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {result.snippet}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

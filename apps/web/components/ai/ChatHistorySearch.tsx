"use client";

/**
 * AI Chat History Search Component
 * 
 * Provides full-text search across past AI conversations.
 * Includes filters, highlighting, and quick navigation.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Calendar,
  Filter,
  ChevronRight,
  Clock,
  FileText,
  Bot,
  User,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

// Types
interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    contractId?: string;
    contractName?: string;
  };
}

interface SearchResult {
  message: ChatMessage;
  conversationTitle: string;
  conversationDate: string;
  matchedText: string;
  score: number;
}

interface SearchFilters {
  dateRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  role: 'all' | 'user' | 'assistant';
  hasContract: 'all' | 'yes' | 'no';
  customStartDate?: string;
  customEndDate?: string;
}

interface ChatHistorySearchProps {
  onResultClick?: (result: SearchResult) => void;
  onOpenConversation?: (conversationId: string) => void;
  className?: string;
  maxResults?: number;
}

export function ChatHistorySearch({
  onResultClick,
  onOpenConversation,
  className = '',
  maxResults = 50,
}: ChatHistorySearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: 'all',
    role: 'all',
    hasContract: 'all',
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Build query params
      const params = new URLSearchParams({
        q: searchQuery,
        limit: maxResults.toString(),
        dateRange: searchFilters.dateRange,
        role: searchFilters.role,
        hasContract: searchFilters.hasContract,
      });

      if (searchFilters.customStartDate) {
        params.set('startDate', searchFilters.customStartDate);
      }
      if (searchFilters.customEndDate) {
        params.set('endDate', searchFilters.customEndDate);
      }

      const response = await fetch(`/api/ai/chat/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      } else {
        // Show empty results when API returns no data
        setResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Show empty results on error
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [maxResults]);

  // Handle search input change with debounce
  const handleQueryChange = (value: string) => {
    setQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value, filters);
      }, 300);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    if (query.trim()) {
      performSearch(query, newFilters);
    }
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  // Highlight matched text
  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.dateRange !== 'all') count++;
    if (filters.role !== 'all') count++;
    if (filters.hasContract !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Search Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search chat history..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 text-white text-[10px] rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Filters</h4>
                
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Date Range</label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(v) => handleFilterChange('dateRange', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Message From</label>
                  <Select
                    value={filters.role}
                    onValueChange={(v) => handleFilterChange('role', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="user">My Messages</SelectItem>
                      <SelectItem value="assistant">AI Responses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Has Contract</label>
                  <Select
                    value={filters.hasContract}
                    onValueChange={(v) => handleFilterChange('hasContract', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any</SelectItem>
                      <SelectItem value="yes">With Contract</SelectItem>
                      <SelectItem value="no">Without Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setFilters({
                      dateRange: 'all',
                      role: 'all',
                      hasContract: 'all',
                    })}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filter badges */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            {filters.dateRange !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filters.dateRange === 'today' ? 'Today' : 
                 filters.dateRange === 'week' ? 'Last 7 days' : 
                 filters.dateRange === 'month' ? 'Last 30 days' : filters.dateRange}
              </Badge>
            )}
            {filters.role !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filters.role === 'user' ? 'My messages' : 'AI responses'}
              </Badge>
            )}
            {filters.hasContract !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filters.hasContract === 'yes' ? 'With contract' : 'Without contract'}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="h-96">
        <div className="p-2">
          {isSearching ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="text-center py-8 text-slate-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords or filters</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Search your chat history</p>
              <p className="text-sm mt-1">Find past conversations and AI responses</p>
            </div>
          ) : (
            <AnimatePresence>
              {results.map((result, index) => (
                <motion.div
                  key={result.message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <SearchResultCard
                    result={result}
                    query={query}
                    highlightMatch={highlightMatch}
                    onClick={() => onResultClick?.(result)}
                    onOpenConversation={() => onOpenConversation?.(result.message.conversationId)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Results count */}
      {results.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-lg">
          <p className="text-xs text-slate-500 text-center">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
        </div>
      )}
    </div>
  );
}

// Search Result Card
function SearchResultCard({
  result,
  query,
  highlightMatch,
  onClick,
  onOpenConversation,
}: {
  result: SearchResult;
  query: string;
  highlightMatch: (text: string, query: string) => React.ReactNode;
  onClick?: () => void;
  onOpenConversation?: () => void;
}) {
  const isUser = result.message.role === 'user';
  const Icon = isUser ? User : Bot;
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div
      className="p-3 mb-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-md ${isUser ? 'bg-violet-100' : 'bg-purple-100'}`}>
          <Icon className={`w-4 h-4 ${isUser ? 'text-violet-600' : 'text-purple-600'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">
                {result.conversationTitle}
              </span>
              {result.message.metadata?.contractName && (
                <Badge variant="outline" className="text-[10px]">
                  <FileText className="w-3 h-3 mr-1" />
                  {result.message.metadata.contractName}
                </Badge>
              )}
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(result.message.timestamp)}
            </span>
          </div>

          {/* Message preview */}
          <p className="text-sm text-slate-600 line-clamp-2">
            {highlightMatch(result.matchedText, query)}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${isUser ? 'text-violet-600' : 'text-purple-600'}`}>
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenConversation?.();
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600"
            >
              Open conversation
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility functions
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateMockResults(query: string, filters: SearchFilters): SearchResult[] {
  const mockConversations = [
    {
      id: 'conv1',
      title: 'Contract Analysis',
      date: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'conv2',
      title: 'NDA Review',
      date: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'conv3',
      title: 'Risk Assessment',
      date: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  const mockMessages: ChatMessage[] = [
    {
      id: 'm1',
      conversationId: 'conv1',
      role: 'user',
      content: `What are the key ${query} terms in this contract?`,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      metadata: { contractId: 'c1', contractName: 'Service Agreement' },
    },
    {
      id: 'm2',
      conversationId: 'conv1',
      role: 'assistant',
      content: `Based on my analysis, the ${query} related terms include termination clauses and liability limits.`,
      timestamp: new Date(Date.now() - 3590000).toISOString(),
      metadata: { model: 'gpt-4o', tokens: 150 },
    },
    {
      id: 'm3',
      conversationId: 'conv2',
      role: 'user',
      content: `Can you explain the ${query} implications for this NDA?`,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      metadata: { contractId: 'c2', contractName: 'NDA Partner Corp' },
    },
    {
      id: 'm4',
      conversationId: 'conv3',
      role: 'assistant',
      content: `The ${query} assessment shows moderate risk in the indemnification section.`,
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      metadata: { model: 'gpt-4o-mini', tokens: 200 },
    },
  ];

  // Filter messages
  let filtered = mockMessages.filter((m) => 
    m.content.toLowerCase().includes(query.toLowerCase())
  );

  if (filters.role !== 'all') {
    filtered = filtered.filter((m) => m.role === filters.role);
  }

  if (filters.hasContract === 'yes') {
    filtered = filtered.filter((m) => m.metadata?.contractId);
  } else if (filters.hasContract === 'no') {
    filtered = filtered.filter((m) => !m.metadata?.contractId);
  }

  return filtered.map((message) => {
    const conv = mockConversations.find((c) => c.id === message.conversationId)!;
    return {
      message,
      conversationTitle: conv.title,
      conversationDate: conv.date,
      matchedText: message.content,
      score: 1,
    };
  });
}

export default ChatHistorySearch;

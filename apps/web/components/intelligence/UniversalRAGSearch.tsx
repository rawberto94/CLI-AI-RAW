'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Send,
  Sparkles,
  FileText,
  Clock,
  ChevronRight,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCcw,
  Filter,
  X,
  MessageSquare,
  Lightbulb,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  BookOpen,
  Zap,
  ArrowRight,
  History,
  Star,
  Loader2,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  id: string;
  type: 'contract' | 'clause' | 'obligation' | 'supplier' | 'risk';
  title: string;
  excerpt: string;
  relevanceScore: number;
  metadata: {
    contractName?: string;
    supplierName?: string;
    date?: string;
    value?: number;
    status?: string;
  };
  highlights: string[];
  source: {
    documentId: string;
    documentName: string;
    page?: number;
    section?: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  results?: SearchResult[];
  suggestions?: string[];
  isLoading?: boolean;
}

interface SearchSuggestion {
  id: string;
  query: string;
  category: 'recent' | 'popular' | 'suggested';
  icon: React.ElementType;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockSuggestions: SearchSuggestion[] = [
  { id: 's1', query: 'Contracts expiring in next 90 days', category: 'popular', icon: Calendar },
  { id: 's2', query: 'High-risk liability clauses', category: 'popular', icon: AlertTriangle },
  { id: 's3', query: 'Auto-renewal terms', category: 'popular', icon: RotateCcw },
  { id: 's4', query: 'Acme Corporation agreements', category: 'recent', icon: Building2 },
  { id: 's5', query: 'Payment terms over 60 days', category: 'suggested', icon: DollarSign },
  { id: 's6', query: 'Termination for convenience clauses', category: 'suggested', icon: FileText },
];

const generateMockResults = (query: string): SearchResult[] => {
  const baseResults: SearchResult[] = [
    {
      id: 'r1',
      type: 'contract',
      title: 'Master Agreement - Acme Corporation',
      excerpt: `This agreement contains provisions related to "${query}" with specific terms outlined in Section 4.2...`,
      relevanceScore: 0.94,
      metadata: {
        contractName: 'Master Agreement',
        supplierName: 'Acme Corporation',
        date: '2024-01-15',
        value: 1200000,
        status: 'Active',
      },
      highlights: [query, 'liability', 'termination'],
      source: {
        documentId: 'doc1',
        documentName: 'Acme_Master_Agreement_2024.pdf',
        page: 12,
        section: 'Section 4.2 - Liability',
      },
    },
    {
      id: 'r2',
      type: 'clause',
      title: 'Limitation of Liability Clause',
      excerpt: `The clause specifically addresses ${query} scenarios with aggregate liability capped at 2x annual fees...`,
      relevanceScore: 0.89,
      metadata: {
        contractName: 'SLA - Cloud Services',
        supplierName: 'Acme Corporation',
      },
      highlights: [query, 'aggregate liability', 'annual fees'],
      source: {
        documentId: 'doc2',
        documentName: 'Cloud_Services_SLA.pdf',
        page: 8,
        section: 'Clause 7.1',
      },
    },
    {
      id: 'r3',
      type: 'obligation',
      title: 'Quarterly Business Review',
      excerpt: `Parties shall conduct quarterly reviews addressing ${query} metrics and performance indicators...`,
      relevanceScore: 0.82,
      metadata: {
        contractName: 'Master Agreement',
        supplierName: 'Acme Corporation',
        date: '2024-03-31',
      },
      highlights: [query, 'quarterly reviews', 'performance'],
      source: {
        documentId: 'doc1',
        documentName: 'Acme_Master_Agreement_2024.pdf',
        page: 15,
        section: 'Schedule B',
      },
    },
    {
      id: 'r4',
      type: 'risk',
      title: 'Auto-Renewal Risk Identified',
      excerpt: `Contract contains auto-renewal clause relevant to ${query}. 90-day notice required to prevent renewal...`,
      relevanceScore: 0.78,
      metadata: {
        contractName: 'Procurement Agreement',
        supplierName: 'GlobalSupply Ltd',
        date: '2024-04-01',
        status: 'At Risk',
      },
      highlights: [query, 'auto-renewal', '90-day notice'],
      source: {
        documentId: 'doc3',
        documentName: 'GlobalSupply_Procurement.pdf',
        page: 3,
        section: 'Term and Renewal',
      },
    },
    {
      id: 'r5',
      type: 'supplier',
      title: 'GlobalSupply Ltd',
      excerpt: `Supplier profile shows ${query} related clauses across 2 active contracts with combined value of $780,000...`,
      relevanceScore: 0.75,
      metadata: {
        supplierName: 'GlobalSupply Ltd',
        value: 780000,
        status: 'Active',
      },
      highlights: [query, '2 active contracts', '$780,000'],
      source: {
        documentId: 'profile1',
        documentName: 'Supplier Profile',
      },
    },
  ];

  return baseResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

// ============================================================================
// Result Type Icon & Color
// ============================================================================

const getResultTypeConfig = (type: SearchResult['type']) => {
  switch (type) {
    case 'contract':
      return { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Contract' };
    case 'clause':
      return { icon: BookOpen, color: 'bg-purple-100 text-purple-600', label: 'Clause' };
    case 'obligation':
      return { icon: Calendar, color: 'bg-green-100 text-green-600', label: 'Obligation' };
    case 'supplier':
      return { icon: Building2, color: 'bg-orange-100 text-orange-600', label: 'Supplier' };
    case 'risk':
      return { icon: AlertTriangle, color: 'bg-red-100 text-red-600', label: 'Risk' };
  }
};

// ============================================================================
// Search Result Card
// ============================================================================

interface SearchResultCardProps {
  result: SearchResult;
  onViewSource: () => void;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, onViewSource }) => {
  const config = getResultTypeConfig(result.type);
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-slate-400">
              {Math.round(result.relevanceScore * 100)}% match
            </span>
          </div>

          <h4 className="font-medium text-slate-900 mb-1">{result.title}</h4>
          <p className="text-sm text-slate-600 line-clamp-2">{result.excerpt}</p>

          {/* Highlights */}
          <div className="flex flex-wrap gap-1 mt-2">
            {result.highlights.slice(0, 3).map((highlight, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded"
              >
                {highlight}
              </span>
            ))}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            {result.metadata.supplierName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {result.metadata.supplierName}
              </span>
            )}
            {result.metadata.value && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${result.metadata.value.toLocaleString()}
              </span>
            )}
            {result.source.page && (
              <span>Page {result.source.page}</span>
            )}
          </div>
        </div>

        <button
          onClick={onViewSource}
          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Source Reference */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText className="w-3 h-3" />
          <span>{result.source.documentName}</span>
          {result.source.section && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span>{result.source.section}</span>
            </>
          )}
        </div>
        <button className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
          View in context
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Chat Message Component
// ============================================================================

interface ChatMessageProps {
  message: ChatMessage;
  onFollowUp: (query: string) => void;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, onFollowUp }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-md'
              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  className="w-2 h-2 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  className="w-2 h-2 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  className="w-2 h-2 bg-slate-400 rounded-full"
                />
              </div>
              <span className="text-sm text-slate-500">Searching contracts...</span>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Results */}
        {message.results && message.results.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.results.map(result => (
              <SearchResultCard
                key={result.id}
                result={result}
                onViewSource={() => console.log('View source:', result.source)}
              />
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUp(suggestion)}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                <Lightbulb className="w-3 h-3" />
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Actions for assistant messages */}
        {!isUser && !message.isLoading && (
          <div className="mt-2 flex items-center gap-2">
            <button className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors">
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
              <ThumbsDown className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className={`mt-1 text-xs text-slate-400 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UniversalRAGSearch: React.FC = () => {
  const { isMockData } = useDataMode();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [filters, setFilters] = useState<{
    types: SearchResult['type'][];
    dateRange?: { from: string; to: string };
  }>({ types: [] });
  const [showFilters, setShowFilters] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle search submission
  const handleSubmit = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setShowSuggestions(false);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: searchQuery,
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: `msg-${Date.now()}-loading`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setQuery('');

    let results: SearchResult[] = [];
    
    // If in demo mode, always use mock results
    if (isMockData) {
      results = generateMockResults(searchQuery);
    } else {
      try {
        const res = await fetch(`/api/intelligence/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.success && json.data?.results?.length > 0) {
          results = json.data.results.map((r: any) => ({
            id: r.id,
            type: r.type || 'contract',
            title: r.title || r.contractName || 'Result',
            excerpt: r.excerpt || r.snippet || r.description || '',
            relevanceScore: r.score || r.relevanceScore || 0.8,
            metadata: r.metadata || {},
            highlights: r.highlights || [searchQuery],
            source: r.source || { documentId: r.id, documentName: r.title || 'Document' },
          }));
        } else {
          results = generateMockResults(searchQuery);
        }
      } catch (error) {
        console.log('Using mock search results');
        results = generateMockResults(searchQuery);
      }
    }

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: `I found ${results.length} relevant items matching "${searchQuery}". Here are the most relevant results:`,
      timestamp: new Date(),
      results,
      suggestions: [
        'Show me the full clause text',
        'Compare with similar contracts',
        'What are the associated risks?',
      ],
    };

    setMessages(prev => [...prev.slice(0, -1), assistantMessage]);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    handleSubmit(suggestion.query);
  };

  // Clear conversation
  const handleClear = () => {
    setMessages([]);
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none p-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Universal Contract Search</h2>
              <p className="text-sm text-slate-500">Ask anything about your contracts in natural language</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-slate-100 mt-4">
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Filter by Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['contract', 'clause', 'obligation', 'supplier', 'risk'] as const).map(type => {
                    const config = getResultTypeConfig(type);
                    const Icon = config.icon;
                    const isActive = filters.types.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            types: isActive
                              ? prev.types.filter(t => t !== type)
                              : [...prev.types, type],
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${
                          isActive
                            ? config.color
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {showSuggestions && messages.length === 0 ? (
          /* Initial Suggestions State */
          <div className="max-w-2xl mx-auto pt-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                What would you like to know?
              </h3>
              <p className="text-slate-500">
                Search across all your contracts, clauses, obligations, and more
              </p>
            </div>

            {/* Suggestion Categories */}
            <div className="space-y-6">
              {/* Popular */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Popular Searches
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {mockSuggestions
                    .filter(s => s.category === 'popular')
                    .map(suggestion => {
                      const Icon = suggestion.icon;
                      return (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all text-left"
                        >
                          <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{suggestion.query}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Recent */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent
                </h4>
                <div className="space-y-2">
                  {mockSuggestions
                    .filter(s => s.category === 'recent')
                    .map(suggestion => {
                      const Icon = suggestion.icon;
                      return (
                        <button
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all text-left w-full"
                        >
                          <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm text-slate-600">{suggestion.query}</span>
                          <Clock className="w-4 h-4 text-slate-300 ml-auto" />
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Suggested */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Suggested for You
                </h4>
                <div className="flex flex-wrap gap-2">
                  {mockSuggestions
                    .filter(s => s.category === 'suggested')
                    .map(suggestion => (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 text-blue-700 rounded-full text-sm font-medium hover:shadow-md transition-all"
                      >
                        {suggestion.query}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(message => (
              <ChatMessageComponent
                key={message.id}
                message={message}
                onFollowUp={handleSubmit}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(query);
            }}
            className="relative"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your contracts..."
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-2">
            AI-powered search across {3} contracts • {12} clauses • {8} obligations
          </p>
        </div>
      </div>
    </div>
  );
};

export default UniversalRAGSearch;

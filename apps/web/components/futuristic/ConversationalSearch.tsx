"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Mic, 
  MicOff, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  Filter,
  X,
  ArrowRight,
  Zap,
  Brain,
  MessageCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SearchSuggestion {
  id: string;
  text: string;
  category: 'recent' | 'popular' | 'ai-suggested' | 'contextual';
  icon: React.ReactNode;
  description?: string;
  resultCount?: number;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'contract' | 'insight' | 'action';
  relevance: number;
  snippet: string;
  metadata: {
    date?: string;
    value?: string;
    risk?: string;
    parties?: string[];
  };
}

export function ConversationalSearch() {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const suggestions: SearchSuggestion[] = [
    {
      id: '1',
      text: 'Show me contracts expiring this quarter',
      category: 'ai-suggested',
      icon: <Clock className="w-4 h-4" />,
      description: 'Find contracts that need renewal attention',
      resultCount: 12
    },
    {
      id: '2',
      text: 'High-risk supplier agreements',
      category: 'contextual',
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Contracts flagged for risk review',
      resultCount: 7
    },
    {
      id: '3',
      text: 'Contracts with payment terms over 45 days',
      category: 'popular',
      icon: <Filter className="w-4 h-4" />,
      description: 'Extended payment terms analysis',
      resultCount: 23
    },
    {
      id: '4',
      text: 'Microsoft agreements',
      category: 'recent',
      icon: <Search className="w-4 h-4" />,
      description: 'All contracts with Microsoft',
      resultCount: 5
    },
    {
      id: '5',
      text: 'What are our most expensive contracts?',
      category: 'ai-suggested',
      icon: <Brain className="w-4 h-4" />,
      description: 'AI analysis of contract values',
      resultCount: 15
    },
    {
      id: '6',
      text: 'Contracts missing liability caps',
      category: 'contextual',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Risk mitigation opportunities',
      resultCount: 18
    }
  ];

  useEffect(() => {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        handleSearch(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const searchTerm = searchQuery || query;
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setShowSuggestions(false);

    // Add to recent searches
    setRecentSearches(prev => {
      const updated = [searchTerm, ...prev.filter(s => s !== searchTerm)].slice(0, 5);
      return updated;
    });

    // Simulate search with realistic delay
    setTimeout(() => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Master Service Agreement - TechCorp',
          type: 'contract',
          relevance: 0.95,
          snippet: 'High-value technology services contract with comprehensive SLA requirements...',
          metadata: {
            date: '2024-03-15',
            value: '$2.4M',
            risk: 'Medium',
            parties: ['TechCorp Inc.', 'Your Company']
          }
        },
        {
          id: '2',
          title: 'Payment Terms Analysis',
          type: 'insight',
          relevance: 0.87,
          snippet: 'AI detected extended payment terms that may impact cash flow...',
          metadata: {
            date: '2024-03-10',
            risk: 'High'
          }
        },
        {
          id: '3',
          title: 'Software License Agreement - Microsoft',
          type: 'contract',
          relevance: 0.82,
          snippet: 'Enterprise software licensing with auto-renewal clauses...',
          metadata: {
            date: '2024-02-28',
            value: '$850K',
            risk: 'Low',
            parties: ['Microsoft Corp.', 'Your Company']
          }
        }
      ];

      setResults(mockResults);
      setIsSearching(false);
    }, 1200);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    handleSearch(suggestion.text);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ai-suggested': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'contextual': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'popular': return 'bg-green-100 text-green-700 border-green-200';
      case 'recent': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getResultTypeIcon = (type: string) => {
    switch (type) {
      case 'contract': return <Search className="w-4 h-4" />;
      case 'insight': return <Brain className="w-4 h-4" />;
      case 'action': return <Zap className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-50"></div>
        <CardContent className="relative p-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-500" />
                {isSearching && (
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
              </div>
              
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => !query && setShowSuggestions(true)}
                placeholder="Ask me anything about your contracts... (e.g., 'Show me high-risk agreements')"
                className="w-full pl-16 pr-12 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 bg-white/80 backdrop-blur-sm transition-all duration-200"
              />
              
              {query && (
                <button
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            
            <Button
              onClick={handleVoiceSearch}
              variant={isListening ? "default" : "outline"}
              size="lg"
              className={`px-4 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : ''}`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            
            <Button
              onClick={() => handleSearch()}
              disabled={!query.trim() || isSearching}
              size="lg"
              className="px-6"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Suggestions */}
      {showSuggestions && !results.length && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Try asking me...</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="p-4 text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(suggestion.category)}`}>
                      {suggestion.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 group-hover:text-blue-900 mb-1">
                        {suggestion.text}
                      </p>
                      {suggestion.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {suggestion.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.category.replace('-', ' ')}
                        </Badge>
                        {suggestion.resultCount && (
                          <span className="text-xs text-gray-500">
                            {suggestion.resultCount} results
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && showSuggestions && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Searches</h4>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSearch(search)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Found {results.length} results for "{query}"
            </h3>
            <Button variant="outline" size="sm" onClick={clearSearch}>
              New Search
            </Button>
          </div>
          
          {results.map((result) => (
            <Card key={result.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    {getResultTypeIcon(result.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{result.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(result.relevance * 100)}% match
                      </Badge>
                    </div>
                    
                    <p className="text-gray-600 mb-3">{result.snippet}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {result.metadata.date && (
                        <span>📅 {result.metadata.date}</span>
                      )}
                      {result.metadata.value && (
                        <span>💰 {result.metadata.value}</span>
                      )}
                      {result.metadata.risk && (
                        <Badge className={`text-xs ${
                          result.metadata.risk === 'High' ? 'bg-red-100 text-red-700' :
                          result.metadata.risk === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {result.metadata.risk} Risk
                        </Badge>
                      )}
                    </div>
                    
                    {result.metadata.parties && (
                      <div className="mt-2 text-sm text-gray-600">
                        Parties: {result.metadata.parties.join(', ')}
                      </div>
                    )}
                  </div>
                  
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Voice Search Indicator */}
      {isListening && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-medium">Listening... Speak your question</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
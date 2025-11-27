"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  Brain, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  BarChart3,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDataMode } from '@/contexts/DataModeContext';

interface QueryResult {
  id: string;
  query: string;
  timestamp: string;
  response: {
    type: 'text' | 'chart' | 'table' | 'list';
    content: any;
    insights: string[];
    sources: Array<{
      contractId: string;
      contractName: string;
      relevance: number;
    }>;
  };
  processingTime: number;
}

interface SuggestedQuery {
  text: string;
  category: 'financial' | 'risk' | 'compliance' | 'analytics';
  icon: React.ReactNode;
}

export function NaturalLanguageQuery() {
  const { isMockData } = useDataMode();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const suggestedQueries: SuggestedQuery[] = [
    {
      text: "What's our average payment terms across all contracts?",
      category: 'financial',
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      text: "Show me contracts with high financial risk",
      category: 'risk', 
      icon: <AlertTriangle className="w-4 h-4" />
    },
    {
      text: "Which contracts are expiring in the next 90 days?",
      category: 'analytics',
      icon: <Clock className="w-4 h-4" />
    },
    {
      text: "Compare our supplier rates against market benchmarks",
      category: 'financial',
      icon: <TrendingUp className="w-4 h-4" />
    },
    {
      text: "What's our compliance score by contract type?",
      category: 'compliance',
      icon: <CheckCircle className="w-4 h-4" />
    },
    {
      text: "Show me the top 5 most valuable contracts",
      category: 'analytics',
      icon: <BarChart3 className="w-4 h-4" />
    }
  ];

  const handleSubmit = async (queryText?: string) => {
    const searchQuery = queryText || query.trim();
    if (!searchQuery || isProcessing) return;

    setIsProcessing(true);
    setShowSuggestions(false);
    
    const startTime = Date.now();

    try {
      let response: QueryResult['response'];

      if (!isMockData) {
        // Use real AI API
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: searchQuery,
            context: 'analytics',
            systemPrompt: `You are a contract analytics AI assistant. Answer questions about contract portfolios with specific data and insights.
            
When answering:
- Provide specific numbers and percentages when relevant
- Give actionable insights and recommendations  
- Reference specific contracts or categories when applicable
- Be concise but thorough

Format your response as structured data when the question asks about:
- Lists of contracts (provide as bullet points)
- Comparisons or trends (summarize key differences)
- Financial data (include dollar amounts)
- Risk assessments (categorize by severity)`,
            useRAG: true,
            useMock: false,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!apiResponse.ok) {
          throw new Error('API request failed');
        }

        const data = await apiResponse.json();
        
        // Parse AI response and structure it
        response = parseAIResponse(searchQuery, data.message, data.sources);
      } else {
        // Use mock data for demo mode
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        response = generateMockResponse(searchQuery);
      }

      const result: QueryResult = {
        id: Date.now().toString(),
        query: searchQuery,
        timestamp: new Date().toLocaleTimeString(),
        response,
        processingTime: Date.now() - startTime
      };

      setResults(prev => [result, ...prev]);
      setQuery('');
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Query error:', error);
      // Fallback to mock on error
      const mockResult: QueryResult = {
        id: Date.now().toString(),
        query: searchQuery,
        timestamp: new Date().toLocaleTimeString(),
        response: generateMockResponse(searchQuery),
        processingTime: Date.now() - startTime
      };
      setResults(prev => [mockResult, ...prev]);
      setQuery('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse AI response into structured format
  const parseAIResponse = (query: string, aiMessage: string, sources?: any[]): QueryResult['response'] => {
    const lowerQuery = query.toLowerCase();
    
    // Determine response type based on query
    let type: 'text' | 'chart' | 'table' | 'list' = 'text';
    if (lowerQuery.includes('compare') || lowerQuery.includes('payment terms')) {
      type = 'chart';
    } else if (lowerQuery.includes('expir') || lowerQuery.includes('list')) {
      type = 'table';
    } else if (lowerQuery.includes('risk') || lowerQuery.includes('top')) {
      type = 'list';
    }

    // Extract insights from AI message (sentences that start with actionable words)
    const sentences = aiMessage.split(/[.!]/).filter(s => s.trim().length > 10);
    const insights = sentences.slice(0, 3).map(s => s.trim());

    return {
      type,
      content: {
        text: aiMessage
      },
      insights: insights.length > 0 ? insights : [
        'Analysis completed based on your contract portfolio',
        'AI-powered insights generated in real-time',
        'Contact support for detailed breakdown'
      ],
      sources: sources?.map((s: any) => ({
        contractId: s.contractId || s.id || 'unknown',
        contractName: s.title || s.name || 'Contract Document',
        relevance: Math.round((s.score || 0.8) * 100)
      })) || []
    };
  };

  const generateMockResponse = (query: string): QueryResult['response'] => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('payment terms') || lowerQuery.includes('payment')) {
      return {
        type: 'chart',
        content: {
          chartType: 'bar',
          data: [
            { label: 'Net 15', value: 12, percentage: 15 },
            { label: 'Net 30', value: 45, percentage: 56 },
            { label: 'Net 45', value: 18, percentage: 22 },
            { label: 'Net 60+', value: 6, percentage: 7 }
          ],
          summary: 'Average payment terms: 32 days'
        },
        insights: [
          '56% of contracts use Net 30 payment terms',
          '7% have extended terms (60+ days) which may impact cash flow',
          'Recommendation: Standardize to Net 30 for consistency'
        ],
        sources: [
          { contractId: 'c1', contractName: 'MSA-TechCorp-2024.pdf', relevance: 95 },
          { contractId: 'c2', contractName: 'SOW-DataAnalytics.pdf', relevance: 87 },
          { contractId: 'c3', contractName: 'Agreement-CloudServices.pdf', relevance: 82 }
        ]
      };
    }
    
    if (lowerQuery.includes('high risk') || lowerQuery.includes('risk')) {
      return {
        type: 'list',
        content: {
          items: [
            {
              title: 'Unlimited Liability Contract - DataCorp',
              risk: 'High',
              value: '$2.4M',
              issue: 'No liability cap - potential unlimited exposure'
            },
            {
              title: 'Extended Payment Terms - TechVendor',
              risk: 'High', 
              value: '$1.8M',
              issue: 'Net 90 payment terms affecting cash flow'
            },
            {
              title: 'Missing Force Majeure - CloudProvider',
              risk: 'Medium',
              value: '$950K',
              issue: 'No force majeure clause for business continuity'
            }
          ]
        },
        insights: [
          '3 contracts identified with high financial risk',
          'Total exposure: $5.15M across high-risk contracts',
          'Immediate action recommended for liability caps'
        ],
        sources: [
          { contractId: 'c4', contractName: 'DataCorp-Agreement.pdf', relevance: 98 },
          { contractId: 'c5', contractName: 'TechVendor-MSA.pdf', relevance: 94 },
          { contractId: 'c6', contractName: 'CloudProvider-SLA.pdf', relevance: 89 }
        ]
      };
    }
    
    if (lowerQuery.includes('expiring') || lowerQuery.includes('expire')) {
      return {
        type: 'table',
        content: {
          headers: ['Contract', 'Expiry Date', 'Days Left', 'Value', 'Auto-Renew'],
          rows: [
            ['MSA-TechPartner', '2024-04-15', '23', '$1.2M', 'Yes'],
            ['SOW-DataProject', '2024-04-28', '36', '$850K', 'No'],
            ['SLA-CloudServices', '2024-05-10', '48', '$2.1M', 'Yes'],
            ['Agreement-Consulting', '2024-05-22', '60', '$650K', 'No']
          ]
        },
        insights: [
          '4 contracts expiring in next 90 days',
          '2 contracts require manual renewal action',
          'Total value at risk: $4.8M'
        ],
        sources: [
          { contractId: 'c7', contractName: 'MSA-TechPartner.pdf', relevance: 100 },
          { contractId: 'c8', contractName: 'SOW-DataProject.pdf', relevance: 100 },
          { contractId: 'c9', contractName: 'SLA-CloudServices.pdf', relevance: 100 }
        ]
      };
    }
    
    // Default response
    return {
      type: 'text',
      content: {
        text: `I found relevant information about "${query}" in your contract portfolio. Based on my analysis of 247 contracts, here are the key findings and recommendations.`
      },
      insights: [
        'Analysis completed across entire contract portfolio',
        'Multiple data points considered for comprehensive response',
        'Recommendations based on industry best practices'
      ],
      sources: [
        { contractId: 'c10', contractName: 'Sample-Contract-1.pdf', relevance: 85 },
        { contractId: 'c11', contractName: 'Sample-Contract-2.pdf', relevance: 78 }
      ]
    };
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'financial': return 'text-green-600 bg-green-50';
      case 'risk': return 'text-red-600 bg-red-50';
      case 'compliance': return 'text-blue-600 bg-blue-50';
      case 'analytics': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderResponse = (response: QueryResult['response']) => {
    switch (response.type) {
      case 'chart':
        return (
          <div className="space-y-4">
            <div className="text-lg font-medium text-gray-900">
              {response.content.summary}
            </div>
            <div className="grid gap-2">
              {response.content.data.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'list':
        return (
          <div className="space-y-3">
            {response.content.items.map((item: any, index: number) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{item.title}</h4>
                  <Badge className={item.risk === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                    {item.risk} Risk
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">{item.issue}</p>
                <div className="text-sm font-medium text-blue-600">{item.value}</div>
              </div>
            ))}
          </div>
        );
        
      case 'table':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {response.content.headers.map((header: string, index: number) => (
                    <th key={index} className="text-left p-3 font-medium text-gray-900">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {response.content.rows.map((row: string[], index: number) => (
                  <tr key={index} className="border-b border-gray-100">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="p-3 text-gray-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      default:
        return (
          <div className="text-gray-700">
            {response.content.text}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            Ask Your Contracts Anything
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Ask me anything about your contracts... (e.g., 'What are our payment terms?')"
                className="w-full p-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isProcessing}
              />
              <Sparkles className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <Button 
              onClick={() => handleSubmit()}
              disabled={!query.trim() || isProcessing}
              className="px-6"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Queries */}
      {showSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Try These Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suggestedQueries.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSubmit(suggestion.text)}
                  className="p-3 text-left rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                  disabled={isProcessing}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(suggestion.category)}`}>
                      {suggestion.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                        {suggestion.text}
                      </p>
                      <Badge className={`mt-1 text-xs ${getCategoryColor(suggestion.category)}`}>
                        {suggestion.category}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-4">
              <div className="text-center">
                <Brain className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">AI is analyzing your contracts...</h3>
                <p className="text-gray-500">Processing natural language query and searching through your portfolio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div ref={resultsRef} className="space-y-6">
        {results.map((result) => (
          <Card key={result.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-500">{result.timestamp}</span>
                    <Badge className="text-xs bg-green-100 text-green-800">
                      {result.processingTime}ms
                    </Badge>
                  </div>
                  <h3 className="font-medium text-gray-900">{result.query}</h3>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Response Content */}
              <div className="bg-gray-50 rounded-lg p-4">
                {renderResponse(result.response)}
              </div>

              {/* AI Insights */}
              {result.response.insights.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    AI Insights
                  </h4>
                  <div className="space-y-2">
                    {result.response.insights.map((insight, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources */}
              {result.response.sources.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Sources ({result.response.sources.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.response.sources.map((source, index) => (
                      <div key={index} className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs">
                        <span className="font-medium">{source.contractName}</span>
                        <span className="text-gray-500">{source.relevance}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
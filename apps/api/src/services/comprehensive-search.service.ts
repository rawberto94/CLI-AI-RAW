/**
 * Comprehensive Search Service
 * Advanced search capabilities with full-text, semantic, and vector search
 */

import pino from 'pino';

const logger = pino({ name: 'comprehensive-search' });

export interface SearchQuery {
  query: string;
  tenantId: string;
  searchType?: 'fulltext' | 'semantic' | 'hybrid';
  filters?: {
    contractType?: string[];
    parties?: string[];
    riskLevel?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    financialRange?: {
      min: number;
      max: number;
    };
    confidenceThreshold?: number;
    tags?: string[];
  };
  sorting?: {
    field: 'relevance' | 'date' | 'confidence' | 'value';
    direction: 'asc' | 'desc';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
  includeHighlights?: boolean;
  includeSuggestions?: boolean;
}

export interface SearchResult {
  contractId: string;
  title: string;
  relevanceScore: number;
  confidenceScore: number;
  highlights: string[];
  snippet: string;
  metadata: {
    contractType: string;
    parties: string[];
    lastUpdated: Date;
    totalValue?: string;
    riskLevel: string;
    tags: string[];
  };
  semanticSimilarity?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
  facets?: {
    contractTypes: Array<{ value: string; count: number }>;
    parties: Array<{ value: string; count: number }>;
    riskLevels: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  };
  queryAnalysis?: {
    originalQuery: string;
    expandedQuery: string;
    queryType: string;
    confidence: number;
  };
}

export interface VectorEmbedding {
  contractId: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface SearchAnalytics {
  queryId: string;
  query: string;
  tenantId: string;
  userId?: string;
  resultsCount: number;
  responseTime: number;
  clickedResults: string[];
  searchType: string;
  timestamp: Date;
}

export class ComprehensiveSearchService {
  private queryCache = new Map<string, { result: SearchResponse; timestamp: Date; ttl: number }>();
  private searchAnalytics: SearchAnalytics[] = [];

  constructor() {
    // Start periodic cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Perform comprehensive search with multiple search strategies
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);
    
    try {
      // Check cache first
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        logger.debug({ query: query.query, cached: true }, 'Returning cached search results');
        return cached;
      }

      logger.info({ 
        query: query.query, 
        tenantId: query.tenantId, 
        searchType: query.searchType 
      }, 'Performing comprehensive search');

      // Analyze and expand query
      const queryAnalysis = await this.analyzeQuery(query.query);
      
      // Perform search based on type
      let searchResults: SearchResult[];
      
      switch (query.searchType) {
        case 'semantic':
          searchResults = await this.performSemanticSearch(query, queryAnalysis);
          break;
        case 'hybrid':
          searchResults = await this.performHybridSearch(query, queryAnalysis);
          break;
        case 'fulltext':
        default:
          searchResults = await this.performFullTextSearch(query, queryAnalysis);
          break;
      }

      // Apply post-processing
      searchResults = await this.postProcessResults(searchResults, query);

      // Generate facets and suggestions
      const facets = await this.generateFacets(query, searchResults);
      const suggestions = query.includeSuggestions ? await this.generateSuggestions(query) : undefined;

      const searchTime = Date.now() - startTime;
      
      const response: SearchResponse = {
        results: searchResults,
        totalCount: searchResults.length,
        searchTime,
        suggestions,
        facets,
        queryAnalysis: {
          originalQuery: query.query,
          expandedQuery: queryAnalysis.expandedQuery,
          queryType: queryAnalysis.queryType,
          confidence: queryAnalysis.confidence
        }
      };

      // Cache the result
      this.setCachedResult(cacheKey, response, 300000); // 5 minutes TTL

      // Log analytics
      await this.logSearchAnalytics(query, response, searchTime);

      logger.info({ 
        query: query.query, 
        resultsCount: searchResults.length, 
        searchTime 
      }, 'Search completed successfully');

      return response;

    } catch (error) {
      const searchTime = Date.now() - startTime;
      logger.error({ 
        error, 
        query: query.query, 
        searchTime 
      }, 'Search failed');
      
      // Return empty results on error
      return {
        results: [],
        totalCount: 0,
        searchTime,
        queryAnalysis: {
          originalQuery: query.query,
          expandedQuery: query.query,
          queryType: 'unknown',
          confidence: 0
        }
      };
    }
  }

  /**
   * Analyze and expand search query
   */
  private async analyzeQuery(query: string): Promise<{
    expandedQuery: string;
    queryType: string;
    confidence: number;
    keywords: string[];
    entities: string[];
  }> {
    // Simple query analysis - in production would use NLP services
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const entities = this.extractEntities(query);
    
    // Expand query with synonyms and related terms
    const expandedTerms = await this.expandQueryTerms(keywords);
    const expandedQuery = [...keywords, ...expandedTerms].join(' ');
    
    // Determine query type
    const queryType = this.determineQueryType(query, keywords);
    
    return {
      expandedQuery,
      queryType,
      confidence: 0.8,
      keywords,
      entities
    };
  }

  /**
   * Extract entities from query (parties, contract types, etc.)
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    
    // Common contract entities
    const contractTypes = ['service agreement', 'nda', 'employment', 'lease', 'purchase', 'license'];
    const riskTerms = ['liability', 'indemnification', 'termination', 'breach', 'penalty'];
    const financialTerms = ['payment', 'cost', 'fee', 'price', 'budget', 'invoice'];
    
    const lowerQuery = query.toLowerCase();
    
    contractTypes.forEach(type => {
      if (lowerQuery.includes(type)) {
        entities.push(type);
      }
    });
    
    riskTerms.forEach(term => {
      if (lowerQuery.includes(term)) {
        entities.push(term);
      }
    });
    
    financialTerms.forEach(term => {
      if (lowerQuery.includes(term)) {
        entities.push(term);
      }
    });
    
    return entities;
  }

  /**
   * Expand query terms with synonyms and related terms
   */
  private async expandQueryTerms(keywords: string[]): Promise<string[]> {
    const expansions: string[] = [];
    
    // Simple synonym mapping - in production would use thesaurus API
    const synonyms: Record<string, string[]> = {
      'contract': ['agreement', 'deal', 'arrangement'],
      'payment': ['fee', 'cost', 'charge', 'invoice'],
      'liability': ['responsibility', 'obligation', 'accountability'],
      'termination': ['cancellation', 'end', 'expiry'],
      'vendor': ['supplier', 'provider', 'contractor'],
      'client': ['customer', 'buyer', 'purchaser']
    };
    
    keywords.forEach(keyword => {
      if (synonyms[keyword]) {
        expansions.push(...synonyms[keyword]);
      }
    });
    
    return expansions;
  }

  /**
   * Determine query type based on content
   */
  private determineQueryType(query: string, keywords: string[]): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('similar') || lowerQuery.includes('like')) {
      return 'similarity';
    }
    
    if (keywords.some(k => ['payment', 'cost', 'fee', 'price'].includes(k))) {
      return 'financial';
    }
    
    if (keywords.some(k => ['risk', 'liability', 'compliance'].includes(k))) {
      return 'risk';
    }
    
    if (keywords.some(k => ['party', 'vendor', 'client', 'supplier'].includes(k))) {
      return 'parties';
    }
    
    return 'general';
  }

  /**
   * Perform full-text search
   */
  private async performFullTextSearch(
    query: SearchQuery, 
    queryAnalysis: any
  ): Promise<SearchResult[]> {
    // Mock implementation - in production would query actual database
    const mockResults: SearchResult[] = [
      {
        contractId: 'contract-1',
        title: 'Master Service Agreement - TechCorp',
        relevanceScore: 0.95,
        confidenceScore: 0.88,
        highlights: ['Master <mark>Service Agreement</mark> with TechCorp for software development'],
        snippet: 'This Master Service Agreement establishes the terms and conditions...',
        metadata: {
          contractType: 'Service Agreement',
          parties: ['TechCorp', 'ClientCorp'],
          lastUpdated: new Date('2024-01-15'),
          totalValue: '$250,000',
          riskLevel: 'medium',
          tags: ['software', 'development', 'recurring']
        }
      },
      {
        contractId: 'contract-2',
        title: 'Software License Agreement - DataSoft',
        relevanceScore: 0.87,
        confidenceScore: 0.92,
        highlights: ['<mark>Software License</mark> Agreement for enterprise data analytics'],
        snippet: 'This Software License Agreement grants the right to use DataSoft...',
        metadata: {
          contractType: 'License Agreement',
          parties: ['DataSoft', 'Enterprise Inc'],
          lastUpdated: new Date('2024-02-01'),
          totalValue: '$150,000',
          riskLevel: 'low',
          tags: ['software', 'license', 'analytics']
        }
      }
    ];

    // Filter results based on query filters
    return this.applyFilters(mockResults, query.filters);
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch(
    query: SearchQuery, 
    queryAnalysis: any
  ): Promise<SearchResult[]> {
    // Mock semantic search - in production would use vector database
    const mockResults: SearchResult[] = [
      {
        contractId: 'contract-3',
        title: 'Consulting Agreement - Strategic Partners',
        relevanceScore: 0.91,
        confidenceScore: 0.85,
        highlights: ['Strategic consulting services for business transformation'],
        snippet: 'This consulting agreement outlines the professional services...',
        metadata: {
          contractType: 'Consulting Agreement',
          parties: ['Strategic Partners', 'BusinessCorp'],
          lastUpdated: new Date('2024-01-20'),
          totalValue: '$75,000',
          riskLevel: 'low',
          tags: ['consulting', 'strategy', 'transformation']
        },
        semanticSimilarity: 0.91
      }
    ];

    return this.applyFilters(mockResults, query.filters);
  }

  /**
   * Perform hybrid search combining full-text and semantic
   */
  private async performHybridSearch(
    query: SearchQuery, 
    queryAnalysis: any
  ): Promise<SearchResult[]> {
    // Combine full-text and semantic results
    const fullTextResults = await this.performFullTextSearch(query, queryAnalysis);
    const semanticResults = await this.performSemanticSearch(query, queryAnalysis);
    
    // Merge and deduplicate results
    const combinedResults = new Map<string, SearchResult>();
    
    // Add full-text results with weight
    fullTextResults.forEach(result => {
      combinedResults.set(result.contractId, {
        ...result,
        relevanceScore: result.relevanceScore * 0.7 // Weight full-text at 70%
      });
    });
    
    // Add semantic results with weight, combining scores if already exists
    semanticResults.forEach(result => {
      const existing = combinedResults.get(result.contractId);
      if (existing) {
        // Combine scores
        combinedResults.set(result.contractId, {
          ...existing,
          relevanceScore: existing.relevanceScore + (result.relevanceScore * 0.3), // Weight semantic at 30%
          semanticSimilarity: result.semanticSimilarity
        });
      } else {
        combinedResults.set(result.contractId, {
          ...result,
          relevanceScore: result.relevanceScore * 0.3
        });
      }
    });
    
    // Sort by combined relevance score
    return Array.from(combinedResults.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(results: SearchResult[], filters?: SearchQuery['filters']): SearchResult[] {
    if (!filters) return results;
    
    return results.filter(result => {
      // Contract type filter
      if (filters.contractType && filters.contractType.length > 0) {
        if (!filters.contractType.includes(result.metadata.contractType)) {
          return false;
        }
      }
      
      // Parties filter
      if (filters.parties && filters.parties.length > 0) {
        const hasParty = filters.parties.some(party => 
          result.metadata.parties.some(p => 
            p.toLowerCase().includes(party.toLowerCase())
          )
        );
        if (!hasParty) return false;
      }
      
      // Risk level filter
      if (filters.riskLevel && filters.riskLevel.length > 0) {
        if (!filters.riskLevel.includes(result.metadata.riskLevel)) {
          return false;
        }
      }
      
      // Confidence threshold filter
      if (filters.confidenceThreshold) {
        if (result.confidenceScore < filters.confidenceThreshold) {
          return false;
        }
      }
      
      // Date range filter
      if (filters.dateRange) {
        const resultDate = result.metadata.lastUpdated;
        if (resultDate < filters.dateRange.start || resultDate > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Post-process search results
   */
  private async postProcessResults(results: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    // Apply sorting
    if (query.sorting) {
      results.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (query.sorting!.field) {
          case 'date':
            aValue = a.metadata.lastUpdated.getTime();
            bValue = b.metadata.lastUpdated.getTime();
            break;
          case 'confidence':
            aValue = a.confidenceScore;
            bValue = b.confidenceScore;
            break;
          case 'value':
            aValue = this.parseValue(a.metadata.totalValue);
            bValue = this.parseValue(b.metadata.totalValue);
            break;
          case 'relevance':
          default:
            aValue = a.relevanceScore;
            bValue = b.relevanceScore;
            break;
        }
        
        const direction = query.sorting!.direction === 'asc' ? 1 : -1;
        return (aValue - bValue) * direction;
      });
    }
    
    // Apply pagination
    if (query.pagination) {
      const start = query.pagination.offset || 0;
      const end = start + (query.pagination.limit || 20);
      results = results.slice(start, end);
    }
    
    return results;
  }

  /**
   * Parse monetary value from string
   */
  private parseValue(value?: string): number {
    if (!value) return 0;
    const numericValue = value.replace(/[^0-9.]/g, '');
    return parseFloat(numericValue) || 0;
  }

  /**
   * Generate search facets for filtering
   */
  private async generateFacets(query: SearchQuery, results: SearchResult[]): Promise<SearchResponse['facets']> {
    const contractTypes = new Map<string, number>();
    const parties = new Map<string, number>();
    const riskLevels = new Map<string, number>();
    const tags = new Map<string, number>();
    
    results.forEach(result => {
      // Contract types
      const type = result.metadata.contractType;
      contractTypes.set(type, (contractTypes.get(type) || 0) + 1);
      
      // Parties
      result.metadata.parties.forEach(party => {
        parties.set(party, (parties.get(party) || 0) + 1);
      });
      
      // Risk levels
      const risk = result.metadata.riskLevel;
      riskLevels.set(risk, (riskLevels.get(risk) || 0) + 1);
      
      // Tags
      result.metadata.tags.forEach(tag => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });
    
    return {
      contractTypes: Array.from(contractTypes.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      parties: Array.from(parties.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // Top 10 parties
      riskLevels: Array.from(riskLevels.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(tags.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) // Top 20 tags
    };
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(query: SearchQuery): Promise<string[]> {
    // Mock suggestions - in production would use search history and ML
    const suggestions = [
      'service agreement payment terms',
      'liability clauses in contracts',
      'termination conditions',
      'intellectual property rights',
      'confidentiality agreements'
    ];
    
    // Filter suggestions based on query
    const queryLower = query.query.toLowerCase();
    return suggestions.filter(suggestion => 
      !suggestion.toLowerCase().includes(queryLower) &&
      suggestion.toLowerCase().includes(queryLower.split(' ')[0])
    );
  }

  /**
   * Log search analytics
   */
  private async logSearchAnalytics(
    query: SearchQuery, 
    response: SearchResponse, 
    responseTime: number
  ): Promise<void> {
    const analytics: SearchAnalytics = {
      queryId: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.query,
      tenantId: query.tenantId,
      resultsCount: response.results.length,
      responseTime,
      clickedResults: [], // Would be updated when users click results
      searchType: query.searchType || 'fulltext',
      timestamp: new Date()
    };
    
    this.searchAnalytics.push(analytics);
    
    // Keep only recent analytics (last 1000 searches)
    if (this.searchAnalytics.length > 1000) {
      this.searchAnalytics = this.searchAnalytics.slice(-1000);
    }
    
    logger.debug({ 
      queryId: analytics.queryId, 
      resultsCount: analytics.resultsCount, 
      responseTime 
    }, 'Search analytics logged');
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(tenantId: string): Promise<{
    totalSearches: number;
    averageResponseTime: number;
    averageResultsCount: number;
    topQueries: Array<{ query: string; count: number }>;
    searchTypes: Array<{ type: string; count: number }>;
    performanceMetrics: {
      fastSearches: number; // < 100ms
      slowSearches: number; // > 1000ms
      emptyResults: number;
    };
  }> {
    const tenantAnalytics = this.searchAnalytics.filter(a => a.tenantId === tenantId);
    
    if (tenantAnalytics.length === 0) {
      return {
        totalSearches: 0,
        averageResponseTime: 0,
        averageResultsCount: 0,
        topQueries: [],
        searchTypes: [],
        performanceMetrics: {
          fastSearches: 0,
          slowSearches: 0,
          emptyResults: 0
        }
      };
    }
    
    // Calculate metrics
    const totalSearches = tenantAnalytics.length;
    const averageResponseTime = tenantAnalytics.reduce((sum, a) => sum + a.responseTime, 0) / totalSearches;
    const averageResultsCount = tenantAnalytics.reduce((sum, a) => sum + a.resultsCount, 0) / totalSearches;
    
    // Top queries
    const queryCount = new Map<string, number>();
    tenantAnalytics.forEach(a => {
      queryCount.set(a.query, (queryCount.get(a.query) || 0) + 1);
    });
    
    const topQueries = Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Search types
    const typeCount = new Map<string, number>();
    tenantAnalytics.forEach(a => {
      typeCount.set(a.searchType, (typeCount.get(a.searchType) || 0) + 1);
    });
    
    const searchTypes = Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }));
    
    // Performance metrics
    const fastSearches = tenantAnalytics.filter(a => a.responseTime < 100).length;
    const slowSearches = tenantAnalytics.filter(a => a.responseTime > 1000).length;
    const emptyResults = tenantAnalytics.filter(a => a.resultsCount === 0).length;
    
    return {
      totalSearches,
      averageResponseTime: Math.round(averageResponseTime),
      averageResultsCount: Math.round(averageResultsCount * 100) / 100,
      topQueries,
      searchTypes,
      performanceMetrics: {
        fastSearches,
        slowSearches,
        emptyResults
      }
    };
  }

  /**
   * Cache management
   */
  private generateCacheKey(query: SearchQuery): string {
    return `search:${query.tenantId}:${JSON.stringify(query)}`;
  }

  private getCachedResult(key: string): SearchResponse | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(key: string, result: SearchResponse, ttl: number): void {
    if (this.queryCache.size >= 1000) {
      // Simple LRU eviction
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      result,
      timestamp: new Date(),
      ttl
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.queryCache.entries()) {
        if (now - cached.timestamp.getTime() > cached.ttl) {
          this.queryCache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Health check for search service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    stats: {
      cacheSize: number;
      analyticsCount: number;
      averageResponseTime: number;
    };
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check cache size
    if (this.queryCache.size > 800) {
      issues.push('Search cache is near capacity');
    }
    
    // Check recent performance
    const recentAnalytics = this.searchAnalytics.filter(
      a => Date.now() - a.timestamp.getTime() < 3600000 // Last hour
    );
    
    const averageResponseTime = recentAnalytics.length > 0
      ? recentAnalytics.reduce((sum, a) => sum + a.responseTime, 0) / recentAnalytics.length
      : 0;
    
    if (averageResponseTime > 2000) {
      issues.push('Search response time is slow');
    }
    
    const emptyResultRate = recentAnalytics.length > 0
      ? recentAnalytics.filter(a => a.resultsCount === 0).length / recentAnalytics.length
      : 0;
    
    if (emptyResultRate > 0.3) {
      issues.push('High rate of searches with no results');
    }
    
    return {
      healthy: issues.length === 0,
      stats: {
        cacheSize: this.queryCache.size,
        analyticsCount: this.searchAnalytics.length,
        averageResponseTime: Math.round(averageResponseTime)
      },
      issues
    };
  }
}

export const comprehensiveSearchService = new ComprehensiveSearchService();
/**
 * Hybrid Search Service
 * Combines full-text and vector search with intelligent result merging and ranking
 */

import { fullTextSearchService, SearchResult as FTSResult } from './full-text-search.service';
import { vectorSearchService, VectorSearchResult } from './vector-search.service';

export interface HybridSearchQuery {
  query: string;
  mode?: 'balanced' | 'semantic' | 'keyword';
  filters?: {
    contractType?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    clientId?: string;
    supplierId?: string;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  options?: {
    vectorThreshold?: number;
    ftsMinScore?: number;
    boostRecent?: boolean;
  };
}

export interface HybridSearchResult {
  id: string;
  contractId: string;
  fileName: string;
  contractType: string | null;
  snippet: string;
  score: number;
  relevanceBreakdown: {
    keywordScore: number;
    semanticScore: number;
    finalScore: number;
  };
  matchType: 'keyword' | 'semantic' | 'both';
  highlights: string[];
  metadata: {
    uploadedAt: Date;
    status: string;
  };
}

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  total: number;
  query: string;
  executionTime: number;
  searchStrategy: {
    mode: string;
    keywordResults: number;
    semanticResults: number;
    mergedResults: number;
  };
}

export class HybridSearchService {
  /**
   * Perform hybrid search combining full-text and vector search
   */
  async search(searchQuery: HybridSearchQuery): Promise<HybridSearchResponse> {
    const startTime = Date.now();
    const { query, mode = 'balanced', filters, pagination, options } = searchQuery;

    // Determine search weights based on mode
    const weights = this.getSearchWeights(mode);

    // Execute both searches in parallel
    const [ftsResults, vectorResults] = await Promise.all([
      this.executeFullTextSearch(query, filters, pagination, options),
      this.executeVectorSearch(query, filters, pagination, options),
    ]);

    // Merge and rank results
    const mergedResults = this.mergeResults(
      ftsResults,
      vectorResults,
      weights
    );

    // Apply pagination to merged results
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;
    const paginatedResults = mergedResults.slice(offset, offset + limit);

    const executionTime = Date.now() - startTime;

    return {
      results: paginatedResults,
      total: mergedResults.length,
      query,
      executionTime,
      searchStrategy: {
        mode,
        keywordResults: ftsResults.length,
        semanticResults: vectorResults.length,
        mergedResults: mergedResults.length,
      },
    };
  }

  /**
   * Execute full-text search
   */
  private async executeFullTextSearch(
    query: string,
    filters?: HybridSearchQuery['filters'],
    pagination?: HybridSearchQuery['pagination'],
    options?: HybridSearchQuery['options']
  ): Promise<FTSResult[]> {
    try {
      const response = await fullTextSearchService.search({
        query,
        filters,
        pagination: { limit: 50, offset: 0 }, // Get more results for merging
        ranking: {
          minScore: options?.ftsMinScore || 0.01,
          boostRecent: options?.boostRecent,
        },
      });

      return response.results;
    } catch (error) {
      console.error('Full-text search error:', error);
      return [];
    }
  }

  /**
   * Execute vector search
   */
  private async executeVectorSearch(
    query: string,
    filters?: HybridSearchQuery['filters'],
    pagination?: HybridSearchQuery['pagination'],
    options?: HybridSearchQuery['options']
  ): Promise<VectorSearchResult[]> {
    try {
      const response = await vectorSearchService.search({
        query,
        limit: 50, // Get more results for merging
        threshold: options?.vectorThreshold || 0.7,
        filters: {
          contractType: filters?.contractType,
          status: filters?.status,
        },
      });

      return response.results;
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  /**
   * Merge results from both search methods
   */
  private mergeResults(
    ftsResults: FTSResult[],
    vectorResults: VectorSearchResult[],
    weights: { keyword: number; semantic: number }
  ): HybridSearchResult[] {
    const resultMap = new Map<string, HybridSearchResult>();

    // Process full-text search results
    ftsResults.forEach((result) => {
      const keywordScore = result.rank;
      const normalizedScore = this.normalizeScore(keywordScore, 0, 1);

      resultMap.set(result.id, {
        id: result.id,
        contractId: result.id,
        fileName: result.fileName,
        contractType: result.contractType,
        snippet: result.snippet,
        score: normalizedScore * weights.keyword,
        relevanceBreakdown: {
          keywordScore: normalizedScore,
          semanticScore: 0,
          finalScore: normalizedScore * weights.keyword,
        },
        matchType: 'keyword',
        highlights: result.highlights,
        metadata: result.metadata,
      });
    });

    // Process vector search results
    vectorResults.forEach((result) => {
      const semanticScore = result.similarity;
      const normalizedScore = this.normalizeScore(semanticScore, 0, 1);

      const existing = resultMap.get(result.contractId);

      if (existing) {
        // Contract found in both searches - boost score
        existing.relevanceBreakdown.semanticScore = normalizedScore;
        existing.relevanceBreakdown.finalScore =
          existing.relevanceBreakdown.keywordScore * weights.keyword +
          normalizedScore * weights.semantic;
        existing.score = existing.relevanceBreakdown.finalScore;
        existing.matchType = 'both';
        
        // Merge snippets if vector result has better context
        if (result.chunkText.length > existing.snippet.length) {
          existing.snippet = result.chunkText.substring(0, 300) + '...';
        }
      } else {
        // Only in vector search
        resultMap.set(result.contractId, {
          id: result.id,
          contractId: result.contractId,
          fileName: result.contract?.fileName || '',
          contractType: result.contract?.contractType || null,
          snippet: result.chunkText.substring(0, 300) + '...',
          score: normalizedScore * weights.semantic,
          relevanceBreakdown: {
            keywordScore: 0,
            semanticScore: normalizedScore,
            finalScore: normalizedScore * weights.semantic,
          },
          matchType: 'semantic',
          highlights: [],
          metadata: {
            uploadedAt: result.contract?.uploadedAt || new Date(),
            status: 'COMPLETED',
          },
        });
      }
    });

    // Convert to array and sort by final score
    return Array.from(resultMap.values()).sort(
      (a, b) => b.score - a.score
    );
  }

  /**
   * Get search weights based on mode
   */
  private getSearchWeights(mode: string): { keyword: number; semantic: number } {
    switch (mode) {
      case 'keyword':
        return { keyword: 0.8, semantic: 0.2 };
      case 'semantic':
        return { keyword: 0.2, semantic: 0.8 };
      case 'balanced':
      default:
        return { keyword: 0.5, semantic: 0.5 };
    }
  }

  /**
   * Normalize score to 0-1 range
   */
  private normalizeScore(score: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (score - min) / (max - min)));
  }

  /**
   * Get search recommendations based on query
   */
  async getSearchRecommendations(query: string): Promise<{
    suggestedMode: string;
    reason: string;
    alternativeQueries: string[];
  }> {
    // Analyze query characteristics
    const wordCount = query.split(/\s+/).length;
    const hasQuotes = query.includes('"');
    const hasOperators = /\b(AND|OR|NOT)\b/i.test(query);

    let suggestedMode = 'balanced';
    let reason = 'Balanced search for general queries';

    if (wordCount <= 2 && !hasQuotes) {
      suggestedMode = 'keyword';
      reason = 'Short queries work better with keyword search';
    } else if (wordCount > 5 && !hasOperators) {
      suggestedMode = 'semantic';
      reason = 'Long natural language queries benefit from semantic search';
    } else if (hasQuotes || hasOperators) {
      suggestedMode = 'keyword';
      reason = 'Exact phrase or boolean operators require keyword search';
    }

    // Generate alternative queries
    const alternativeQueries = await this.generateAlternativeQueries(query);

    return {
      suggestedMode,
      reason,
      alternativeQueries,
    };
  }

  /**
   * Generate alternative query suggestions
   */
  private async generateAlternativeQueries(query: string): Promise<string[]> {
    // Get suggestions from full-text search
    try {
      const suggestions = await fullTextSearchService.getSuggestions(query, 3);
      return suggestions.map((s) => query.replace(/\w+$/, s));
    } catch (error) {
      return [];
    }
  }

  /**
   * Explain search results
   */
  explainResult(result: HybridSearchResult): string {
    const { relevanceBreakdown, matchType } = result;
    const parts: string[] = [];

    if (matchType === 'both') {
      parts.push(
        `Found in both keyword (${(relevanceBreakdown.keywordScore * 100).toFixed(1)}%) and semantic (${(relevanceBreakdown.semanticScore * 100).toFixed(1)}%) search`
      );
    } else if (matchType === 'keyword') {
      parts.push(
        `Matched by keyword search (${(relevanceBreakdown.keywordScore * 100).toFixed(1)}% relevance)`
      );
    } else {
      parts.push(
        `Matched by semantic similarity (${(relevanceBreakdown.semanticScore * 100).toFixed(1)}% similar)`
      );
    }

    if (result.highlights.length > 0) {
      parts.push(`Highlights: ${result.highlights.join(', ')}`);
    }

    return parts.join('. ');
  }
}

// Export singleton instance
export const hybridSearchService = new HybridSearchService();

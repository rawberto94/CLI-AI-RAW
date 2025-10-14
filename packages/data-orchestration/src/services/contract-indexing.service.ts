/**
 * Enhanced Contract Indexing Service
 * 
 * Provides advanced indexing, search, and retrieval capabilities for contracts
 * with full-text search, semantic search, and intelligent filtering.
 */

import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus, Events } from "../events/event-bus";
import pino from "pino";
import type { Contract, Artifact, ServiceResponse } from "../types";

const logger = pino({ name: "contract-indexing-service" });

export interface SearchIndex {
  contractId: string;
  tenantId: string;
  content: string;
  metadata: {
    title: string;
    parties: string[];
    contractType: string;
    category?: string;
    tags: string[];
    financialTerms: string[];
    riskFactors: string[];
    keyPhrases: string[];
  };
  vectors?: {
    content: number[];
    metadata: number[];
  };
  lastIndexed: Date;
  version: string;
}

export interface SearchQuery {
  tenantId: string;
  query?: string;
  filters?: {
    contractType?: string[];
    category?: string[];
    parties?: string[];
    dateRange?: {
      from: Date;
      to: Date;
    };
    valueRange?: {
      min: number;
      max: number;
    };
    riskLevel?: ('low' | 'medium' | 'high' | 'critical')[];
    tags?: string[];
  };
  sortBy?: 'relevance' | 'date' | 'value' | 'risk' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeArtifacts?: boolean;
}

export interface SearchResult {
  contract: Contract;
  artifacts?: Artifact[];
  score: number;
  highlights: {
    field: string;
    text: string;
    matches: Array<{ start: number; end: number; }>;
  }[];
  explanation?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    contractTypes: Array<{ value: string; count: number; }>;
    categories: Array<{ value: string; count: number; }>;
    parties: Array<{ value: string; count: number; }>;
    riskLevels: Array<{ value: string; count: number; }>;
    tags: Array<{ value: string; count: number; }>;
  };
  suggestions: string[];
  queryTime: number;
}

export class ContractIndexingService {
  private static instance: ContractIndexingService;
  private searchIndex = new Map<string, SearchIndex>();
  private indexingQueue: string[] = [];
  private isIndexing = false;

  private constructor() {
    this.initializeIndexing();
    this.setupEventListeners();
  }

  static getInstance(): ContractIndexingService {
    if (!ContractIndexingService.instance) {
      ContractIndexingService.instance = new ContractIndexingService();
    }
    return ContractIndexingService.instance;
  }

  /**
   * Initialize indexing system
   */
  private async initializeIndexing(): Promise<void> {
    try {
      logger.info("Initializing contract indexing service");
      
      // Load existing index from cache
      await this.loadIndexFromCache();
      
      // Start background indexing
      this.startBackgroundIndexing();
      
      logger.info("Contract indexing service initialized");
    } catch (error) {
      logger.error({ error }, "Failed to initialize indexing service");
    }
  }

  /**
   * Set up event listeners for real-time indexing
   */
  private setupEventListeners(): void {
    eventBus.on(Events.CONTRACT_CREATED, async (data) => {
      await this.queueForIndexing(data.contractId);
    });

    eventBus.on(Events.CONTRACT_UPDATED, async (data) => {
      await this.queueForIndexing(data.contractId);
    });

    eventBus.on(Events.ARTIFACT_CREATED, async (data) => {
      await this.queueForIndexing(data.contractId);
    });

    eventBus.on(Events.CONTRACT_DELETED, async (data) => {
      await this.removeFromIndex(data.contractId);
    });
  }

  /**
   * Index a contract with all its artifacts
   */
  async indexContract(contractId: string): Promise<ServiceResponse<SearchIndex>> {
    try {
      logger.info({ contractId }, "Indexing contract");

      // Get contract and artifacts
      const contract = await dbAdaptor.getContract(contractId, 'demo'); // TODO: Get tenantId properly
      if (!contract) {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Contract not found' }
        };
      }

      const artifacts = await dbAdaptor.getArtifacts(contractId);

      // Build search index
      const searchIndex = await this.buildSearchIndex(contract, artifacts);
      
      // Store in memory and cache
      this.searchIndex.set(contractId, searchIndex);
      await this.saveIndexToCache(contractId, searchIndex);

      // Emit indexing event
      eventBus.emit(Events.CONTRACT_INDEXED, { contractId, tenantId: contract.tenantId });

      logger.info({ contractId }, "Contract indexed successfully");

      return {
        success: true,
        data: searchIndex
      };
    } catch (error) {
      logger.error({ error, contractId }, "Failed to index contract");
      return {
        success: false,
        error: { code: 'INDEXING_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Build search index from contract and artifacts
   */
  private async buildSearchIndex(contract: Contract, artifacts: Artifact[]): Promise<SearchIndex> {
    // Extract content from artifacts
    const content = this.extractSearchableContent(contract, artifacts);
    
    // Extract metadata
    const metadata = this.extractMetadata(contract, artifacts);
    
    // Generate search vectors (placeholder for future semantic search)
    const vectors = await this.generateVectors(content, metadata);

    return {
      contractId: contract.id,
      tenantId: contract.tenantId,
      content,
      metadata,
      vectors,
      lastIndexed: new Date(),
      version: '1.0'
    };
  }

  /**
   * Extract searchable content from contract and artifacts
   */
  private extractSearchableContent(contract: Contract, artifacts: Artifact[]): string {
    const contentParts: string[] = [];

    // Contract basic info
    contentParts.push(contract.contractTitle || '');
    contentParts.push(contract.description || '');
    contentParts.push(contract.clientName || '');
    contentParts.push(contract.supplierName || '');
    contentParts.push(contract.category || '');

    // Extract from artifacts
    artifacts.forEach(artifact => {
      const data = artifact.data as any;
      
      switch (artifact.type) {
        case 'METADATA':
          if (data.title) contentParts.push(data.title);
          if (data.parties) {
            data.parties.forEach((party: any) => {
              contentParts.push(party.name || '');
              contentParts.push(party.role || '');
            });
          }
          if (data.jurisdiction) contentParts.push(data.jurisdiction);
          break;

        case 'FINANCIAL':
          if (data.paymentTerms) {
            data.paymentTerms.forEach((term: string) => contentParts.push(term));
          }
          if (data.penalties) {
            data.penalties.forEach((penalty: any) => {
              contentParts.push(penalty.description || '');
            });
          }
          break;

        case 'RISK':
          if (data.riskFactors) {
            data.riskFactors.forEach((factor: any) => {
              contentParts.push(factor.description || '');
              contentParts.push(factor.mitigation || '');
            });
          }
          if (data.complianceIssues) {
            data.complianceIssues.forEach((issue: any) => {
              contentParts.push(issue.issue || '');
              contentParts.push(issue.recommendation || '');
            });
          }
          break;

        case 'CLAUSES':
          if (data.clauses) {
            data.clauses.forEach((clause: any) => {
              contentParts.push(clause.title || '');
              contentParts.push(clause.content || '');
            });
          }
          break;

        case 'SUMMARY':
          if (data.executiveSummary) contentParts.push(data.executiveSummary);
          if (data.keyTerms) {
            data.keyTerms.forEach((term: string) => contentParts.push(term));
          }
          if (data.recommendations) {
            data.recommendations.forEach((rec: string) => contentParts.push(rec));
          }
          break;
      }
    });

    return contentParts.filter(Boolean).join(' ').toLowerCase();
  }

  /**
   * Extract structured metadata for filtering and faceting
   */
  private extractMetadata(contract: Contract, artifacts: Artifact[]): SearchIndex['metadata'] {
    const metadata: SearchIndex['metadata'] = {
      title: contract.contractTitle || contract.fileName || '',
      parties: [],
      contractType: contract.contractType || 'UNKNOWN',
      category: contract.category,
      tags: [],
      financialTerms: [],
      riskFactors: [],
      keyPhrases: []
    };

    // Extract from contract
    if (contract.clientName) metadata.parties.push(contract.clientName);
    if (contract.supplierName) metadata.parties.push(contract.supplierName);

    // Extract from artifacts
    artifacts.forEach(artifact => {
      const data = artifact.data as any;

      switch (artifact.type) {
        case 'METADATA':
          if (data.contractType) metadata.contractType = data.contractType;
          if (data.title) metadata.title = data.title;
          if (data.parties) {
            data.parties.forEach((party: any) => {
              if (party.name) metadata.parties.push(party.name);
            });
          }
          break;

        case 'FINANCIAL':
          if (data.paymentTerms) {
            metadata.financialTerms.push(...data.paymentTerms);
          }
          if (data.currency) metadata.tags.push(`currency:${data.currency}`);
          if (data.totalValue) {
            const valueRange = this.getValueRange(data.totalValue);
            metadata.tags.push(`value:${valueRange}`);
          }
          break;

        case 'RISK':
          if (data.riskFactors) {
            data.riskFactors.forEach((factor: any) => {
              metadata.riskFactors.push(factor.category || '');
              metadata.tags.push(`risk:${factor.severity || 'unknown'}`);
            });
          }
          if (data.overallScore !== undefined) {
            const riskLevel = this.getRiskLevel(data.overallScore);
            metadata.tags.push(`risk-level:${riskLevel}`);
          }
          break;

        case 'SUMMARY':
          if (data.keyTerms) {
            metadata.keyPhrases.push(...data.keyTerms);
          }
          break;
      }
    });

    // Remove duplicates
    metadata.parties = [...new Set(metadata.parties)];
    metadata.tags = [...new Set(metadata.tags)];
    metadata.financialTerms = [...new Set(metadata.financialTerms)];
    metadata.riskFactors = [...new Set(metadata.riskFactors)];
    metadata.keyPhrases = [...new Set(metadata.keyPhrases)];

    return metadata;
  }

  /**
   * Generate search vectors for semantic search (placeholder)
   */
  private async generateVectors(content: string, metadata: SearchIndex['metadata']): Promise<SearchIndex['vectors']> {
    // Placeholder for future semantic search implementation
    // In production, this would use embeddings from OpenAI or similar
    return {
      content: [], // Would be embedding vector
      metadata: [] // Would be metadata embedding vector
    };
  }

  /**
   * Perform intelligent search across contracts
   */
  async search(query: SearchQuery): Promise<ServiceResponse<SearchResponse>> {
    const startTime = Date.now();

    try {
      logger.info({ query: query.query, tenantId: query.tenantId }, "Performing contract search");

      // Get all indexed contracts for tenant
      const tenantContracts = Array.from(this.searchIndex.values())
        .filter(index => index.tenantId === query.tenantId);

      // Apply filters and search
      let results = await this.performSearch(tenantContracts, query);

      // Sort results
      results = this.sortResults(results, query.sortBy || 'relevance', query.sortOrder || 'desc');

      // Apply pagination
      const total = results.length;
      const offset = query.offset || 0;
      const limit = query.limit || 20;
      const paginatedResults = results.slice(offset, offset + limit);

      // Generate facets
      const facets = this.generateFacets(tenantContracts);

      // Generate suggestions
      const suggestions = this.generateSuggestions(query.query || '', tenantContracts);

      const queryTime = Date.now() - startTime;

      logger.info({ 
        total, 
        returned: paginatedResults.length, 
        queryTime 
      }, "Search completed");

      return {
        success: true,
        data: {
          results: paginatedResults,
          total,
          facets,
          suggestions,
          queryTime
        }
      };
    } catch (error) {
      logger.error({ error }, "Search failed");
      return {
        success: false,
        error: { code: 'SEARCH_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Perform the actual search logic
   */
  private async performSearch(indexes: SearchIndex[], query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const index of indexes) {
      // Calculate relevance score
      const score = this.calculateRelevanceScore(index, query);
      
      if (score > 0) {
        // Get contract details
        const contract = await dbAdaptor.getContract(index.contractId, index.tenantId);
        if (!contract) continue;

        // Get artifacts if requested
        let artifacts: Artifact[] | undefined;
        if (query.includeArtifacts) {
          artifacts = await dbAdaptor.getArtifacts(index.contractId);
        }

        // Generate highlights
        const highlights = this.generateHighlights(index, query.query || '');

        results.push({
          contract,
          artifacts,
          score,
          highlights,
          explanation: `Matched on: ${this.getMatchExplanation(index, query)}`
        });
      }
    }

    return results;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(index: SearchIndex, query: SearchQuery): number {
    let score = 0;

    // Text search scoring
    if (query.query) {
      const queryTerms = query.query.toLowerCase().split(/\s+/);
      const content = index.content.toLowerCase();
      
      queryTerms.forEach(term => {
        // Exact matches get higher score
        const exactMatches = (content.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
        score += exactMatches * 10;
        
        // Partial matches get lower score
        const partialMatches = (content.match(new RegExp(term, 'g')) || []).length - exactMatches;
        score += partialMatches * 2;
        
        // Title matches get bonus
        if (index.metadata.title.toLowerCase().includes(term)) {
          score += 20;
        }
        
        // Party matches get bonus
        if (index.metadata.parties.some(party => party.toLowerCase().includes(term))) {
          score += 15;
        }
      });
    }

    // Apply filters (if they match, maintain score; if they don't, score = 0)
    if (query.filters) {
      const filters = query.filters;
      
      if (filters.contractType && filters.contractType.length > 0) {
        if (!filters.contractType.includes(index.metadata.contractType)) {
          return 0;
        }
      }
      
      if (filters.category && filters.category.length > 0) {
        if (!index.metadata.category || !filters.category.includes(index.metadata.category)) {
          return 0;
        }
      }
      
      if (filters.parties && filters.parties.length > 0) {
        const hasMatchingParty = filters.parties.some(party => 
          index.metadata.parties.some(indexParty => 
            indexParty.toLowerCase().includes(party.toLowerCase())
          )
        );
        if (!hasMatchingParty) {
          return 0;
        }
      }
      
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          index.metadata.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return 0;
        }
      }
    }

    return score;
  }

  /**
   * Generate search result highlights
   */
  private generateHighlights(index: SearchIndex, query: string): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = [];
    
    if (!query) return highlights;

    const queryTerms = query.toLowerCase().split(/\s+/);
    
    queryTerms.forEach(term => {
      // Check title
      const titleIndex = index.metadata.title.toLowerCase().indexOf(term);
      if (titleIndex !== -1) {
        highlights.push({
          field: 'title',
          text: index.metadata.title,
          matches: [{ start: titleIndex, end: titleIndex + term.length }]
        });
      }
      
      // Check content (first occurrence)
      const contentIndex = index.content.indexOf(term);
      if (contentIndex !== -1) {
        const start = Math.max(0, contentIndex - 50);
        const end = Math.min(index.content.length, contentIndex + term.length + 50);
        const snippet = index.content.substring(start, end);
        
        highlights.push({
          field: 'content',
          text: snippet,
          matches: [{ start: contentIndex - start, end: contentIndex - start + term.length }]
        });
      }
    });

    return highlights;
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], sortBy: string, sortOrder: string): SearchResult[] {
    return results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score;
          break;
        case 'date':
          comparison = new Date(b.contract.createdAt).getTime() - new Date(a.contract.createdAt).getTime();
          break;
        case 'value':
          const aValue = a.contract.totalValue ? Number(a.contract.totalValue) : 0;
          const bValue = b.contract.totalValue ? Number(b.contract.totalValue) : 0;
          comparison = bValue - aValue;
          break;
        case 'title':
          comparison = (a.contract.contractTitle || '').localeCompare(b.contract.contractTitle || '');
          break;
        default:
          comparison = b.score - a.score;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Generate search facets for filtering
   */
  private generateFacets(indexes: SearchIndex[]): SearchResponse['facets'] {
    const facets = {
      contractTypes: new Map<string, number>(),
      categories: new Map<string, number>(),
      parties: new Map<string, number>(),
      riskLevels: new Map<string, number>(),
      tags: new Map<string, number>()
    };

    indexes.forEach(index => {
      // Contract types
      facets.contractTypes.set(
        index.metadata.contractType,
        (facets.contractTypes.get(index.metadata.contractType) || 0) + 1
      );
      
      // Categories
      if (index.metadata.category) {
        facets.categories.set(
          index.metadata.category,
          (facets.categories.get(index.metadata.category) || 0) + 1
        );
      }
      
      // Parties
      index.metadata.parties.forEach(party => {
        facets.parties.set(party, (facets.parties.get(party) || 0) + 1);
      });
      
      // Tags (extract risk levels)
      index.metadata.tags.forEach(tag => {
        if (tag.startsWith('risk-level:')) {
          const riskLevel = tag.replace('risk-level:', '');
          facets.riskLevels.set(riskLevel, (facets.riskLevels.get(riskLevel) || 0) + 1);
        }
        facets.tags.set(tag, (facets.tags.get(tag) || 0) + 1);
      });
    });

    return {
      contractTypes: Array.from(facets.contractTypes.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      categories: Array.from(facets.categories.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      parties: Array.from(facets.parties.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Limit to top 20
      riskLevels: Array.from(facets.riskLevels.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(facets.tags.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50) // Limit to top 50
    };
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: string, indexes: SearchIndex[]): string[] {
    if (!query) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    indexes.forEach(index => {
      // Suggest contract titles
      if (index.metadata.title.toLowerCase().includes(queryLower)) {
        suggestions.add(index.metadata.title);
      }
      
      // Suggest parties
      index.metadata.parties.forEach(party => {
        if (party.toLowerCase().includes(queryLower)) {
          suggestions.add(party);
        }
      });
      
      // Suggest key phrases
      index.metadata.keyPhrases.forEach(phrase => {
        if (phrase.toLowerCase().includes(queryLower)) {
          suggestions.add(phrase);
        }
      });
    });

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Queue contract for indexing
   */
  private async queueForIndexing(contractId: string): Promise<void> {
    if (!this.indexingQueue.includes(contractId)) {
      this.indexingQueue.push(contractId);
      logger.info({ contractId }, "Contract queued for indexing");
    }
  }

  /**
   * Remove contract from index
   */
  private async removeFromIndex(contractId: string): Promise<void> {
    this.searchIndex.delete(contractId);
    await cacheAdaptor.delete(`contract-index:${contractId}`);
    logger.info({ contractId }, "Contract removed from index");
  }

  /**
   * Start background indexing process
   */
  private startBackgroundIndexing(): void {
    setInterval(async () => {
      if (this.isIndexing || this.indexingQueue.length === 0) return;

      this.isIndexing = true;
      const contractId = this.indexingQueue.shift();
      
      if (contractId) {
        try {
          await this.indexContract(contractId);
        } catch (error) {
          logger.error({ error, contractId }, "Background indexing failed");
        }
      }
      
      this.isIndexing = false;
    }, 1000); // Process queue every second
  }

  /**
   * Load index from cache
   */
  private async loadIndexFromCache(): Promise<void> {
    try {
      // In a real implementation, this would load from Redis or similar
      logger.info("Index loaded from cache");
    } catch (error) {
      logger.error({ error }, "Failed to load index from cache");
    }
  }

  /**
   * Save index to cache
   */
  private async saveIndexToCache(contractId: string, index: SearchIndex): Promise<void> {
    try {
      await cacheAdaptor.set(`contract-index:${contractId}`, index, 3600); // 1 hour TTL
    } catch (error) {
      logger.error({ error, contractId }, "Failed to save index to cache");
    }
  }

  /**
   * Utility methods
   */
  private getValueRange(value: number): string {
    if (value < 10000) return 'small';
    if (value < 100000) return 'medium';
    if (value < 1000000) return 'large';
    return 'enterprise';
  }

  private getRiskLevel(score: number): string {
    if (score < 25) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'critical';
  }

  private getMatchExplanation(index: SearchIndex, query: SearchQuery): string {
    const matches: string[] = [];
    
    if (query.query) {
      matches.push('text content');
    }
    
    if (query.filters?.contractType) {
      matches.push('contract type');
    }
    
    if (query.filters?.parties) {
      matches.push('parties');
    }
    
    return matches.join(', ') || 'general criteria';
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<{
    totalIndexed: number;
    queueLength: number;
    lastIndexed?: Date;
    indexSize: number;
  }> {
    return {
      totalIndexed: this.searchIndex.size,
      queueLength: this.indexingQueue.length,
      lastIndexed: Array.from(this.searchIndex.values())
        .sort((a, b) => b.lastIndexed.getTime() - a.lastIndexed.getTime())[0]?.lastIndexed,
      indexSize: JSON.stringify(Array.from(this.searchIndex.values())).length
    };
  }

  /**
   * Reindex all contracts for a tenant
   */
  async reindexTenant(tenantId: string): Promise<ServiceResponse<{ indexed: number; failed: number; }>> {
    try {
      logger.info({ tenantId }, "Starting tenant reindexing");

      // Get all contracts for tenant
      const contractsResult = await dbAdaptor.queryContracts({
        tenantId,
        page: 1,
        limit: 1000, // Process in batches in production
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (!contractsResult) {
        return {
          success: false,
          error: { code: 'QUERY_ERROR', message: 'Failed to query contracts' }
        };
      }

      let indexed = 0;
      let failed = 0;

      // Index each contract
      for (const contract of contractsResult.contracts) {
        try {
          await this.indexContract(contract.id);
          indexed++;
        } catch (error) {
          logger.error({ error, contractId: contract.id }, "Failed to index contract during reindexing");
          failed++;
        }
      }

      logger.info({ tenantId, indexed, failed }, "Tenant reindexing completed");

      return {
        success: true,
        data: { indexed, failed }
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Tenant reindexing failed");
      return {
        success: false,
        error: { code: 'REINDEX_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

export const contractIndexingService = ContractIndexingService.getInstance();
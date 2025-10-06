/**
 * Shared RAG (Retrieval-Augmented Generation) Utilities
 * Consolidates search indexation, content processing, and RAG operations
 */

// RAG Configuration
export interface RAGConfig {
  enableVectorEmbeddings?: boolean;
  embeddingModel?: string;
  chunkSize?: number;
  overlapSize?: number;
  maxSearchResults?: number;
}

// Searchable content structure
export interface SearchableContent {
  contractId: string;
  title: string;
  content: string;
  metadata: {
    parties: string[];
    contractType: string;
    keyTerms: string[];
    financialTerms: string[];
    riskFactors: string[];
    complianceStatus: string[];
    insights: string[];
    clauseTypes: string[];
    lastUpdated: Date;
    tenantId: string;
    confidenceScore?: number;
    totalValue?: string;
    riskLevel?: string;
  };
}

// Search query structure
export interface SearchQuery {
  query: string;
  tenantId: string;
  filters?: {
    contractType?: string;
    parties?: string[];
    riskLevel?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
    financialRange?: {
      min: number;
      max: number;
    };
  };
  limit?: number;
  offset?: number;
}

// Search result structure
export interface SearchResult {
  contractId: string;
  title: string;
  relevanceScore: number;
  highlights: string[];
  metadata: {
    contractType: string;
    parties: string[];
    lastUpdated: Date;
    confidenceScore?: number;
    totalValue?: string;
    riskLevel?: string;
  };
}

// Indexation result
export interface IndexationResult {
  contractId: string;
  indexed: boolean;
  searchableFields: number;
  processingTime: number;
  confidence: number;
  errors?: string[];
}

/**
 * Content Processing Utilities
 */
export class ContentProcessor {
  
  /**
   * Extract searchable content from artifact data
   */
  static extractSearchableContent(
    contractId: string,
    tenantId: string,
    artifacts: any[]
  ): SearchableContent {
    const searchableContent: SearchableContent = {
      contractId,
      title: 'Untitled Contract',
      content: '',
      metadata: {
        parties: [],
        contractType: 'Unknown',
        keyTerms: [],
        financialTerms: [],
        riskFactors: [],
        complianceStatus: [],
        insights: [],
        clauseTypes: [],
        lastUpdated: new Date(),
        tenantId,
        confidenceScore: 0,
        totalValue: undefined,
        riskLevel: 'low'
      }
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    // Process each artifact type
    for (const artifact of artifacts) {
      try {
        this.processArtifactForSearch(artifact, searchableContent);
        
        // Track confidence scores
        const artifactConfidence = this.extractConfidenceFromArtifact(artifact);
        if (artifactConfidence > 0) {
          totalConfidence += artifactConfidence;
          confidenceCount++;
        }
      } catch (error) {
        console.warn(`Failed to process artifact ${artifact.type} for search:`, error);
      }
    }

    // Calculate overall confidence
    searchableContent.metadata.confidenceScore = confidenceCount > 0 ? 
      totalConfidence / confidenceCount : 0.5;
    
    // Deduplicate arrays
    this.deduplicateSearchableContent(searchableContent);

    return searchableContent;
  }

  /**
   * Process individual artifact for search indexation
   */
  private static processArtifactForSearch(
    artifact: any, 
    searchableContent: SearchableContent
  ): void {
    const data = artifact.data;

    switch (artifact.type) {
      case 'INGESTION':
        this.processIngestionArtifact(data, searchableContent);
        break;
      case 'CLAUSES':
        this.processClausesArtifact(data, searchableContent);
        break;
      case 'RISK':
        this.processRiskArtifact(data, searchableContent);
        break;
      case 'COMPLIANCE':
        this.processComplianceArtifact(data, searchableContent);
        break;
      case 'FINANCIAL':
        this.processFinancialArtifact(data, searchableContent);
        break;
      case 'OVERVIEW':
        this.processOverviewArtifact(data, searchableContent);
        break;
      case 'RATES':
        this.processRatesArtifact(data, searchableContent);
        break;
      case 'BENCHMARK':
        this.processBenchmarkArtifact(data, searchableContent);
        break;
      case 'TEMPLATE':
        this.processTemplateArtifact(data, searchableContent);
        break;
      default:
        console.log(`Unknown artifact type: ${artifact.type}`);
    }
  }

  /**
   * Process ingestion artifact
   */
  private static processIngestionArtifact(data: any, searchableContent: SearchableContent): void {
    if (typeof data.content === 'string') {
      searchableContent.content = data.content;
    }
    
    if (typeof data.title === 'string') {
      searchableContent.title = data.title;
    }
  }

  /**
   * Process clauses artifact
   */
  private static processClausesArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.clauses)) {
      data.clauses.forEach((clause: any) => {
        if (clause.clauseId) {
          searchableContent.metadata.clauseTypes.push(clause.clauseId);
        }
        if (clause.text) {
          searchableContent.content += ` ${clause.text}`;
        }
        if (clause.keyTerms && Array.isArray(clause.keyTerms)) {
          searchableContent.metadata.keyTerms.push(...clause.keyTerms);
        }
      });
    }
  }

  /**
   * Process risk artifact
   */
  private static processRiskArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.risks)) {
      data.risks.forEach((risk: any) => {
        if (risk.description) {
          searchableContent.metadata.riskFactors.push(risk.description);
        }
        if (risk.severity) {
          searchableContent.metadata.riskLevel = this.determineHighestRiskLevel(
            searchableContent.metadata.riskLevel || 'low', 
            risk.severity
          );
        }
      });
    }

    if (typeof data.overallRiskLevel === 'string') {
      searchableContent.metadata.riskLevel = data.overallRiskLevel;
    }
  }

  /**
   * Process compliance artifact
   */
  private static processComplianceArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.complianceChecks)) {
      data.complianceChecks.forEach((check: any) => {
        if (check.requirement) {
          searchableContent.metadata.complianceStatus.push(check.requirement);
        }
        if (check.status) {
          searchableContent.metadata.complianceStatus.push(check.status);
        }
      });
    }

    if (Array.isArray(data.recommendations)) {
      data.recommendations.forEach((rec: any) => {
        if (rec.description) {
          searchableContent.metadata.insights.push(rec.description);
        }
      });
    }
  }

  /**
   * Process financial artifact
   */
  private static processFinancialArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.financialTerms)) {
      data.financialTerms.forEach((term: any) => {
        if (term.description) {
          searchableContent.metadata.financialTerms.push(term.description);
        }
        if (term.amount) {
          searchableContent.metadata.financialTerms.push(term.amount);
        }
      });
    }

    if (data.financialSummary && typeof data.financialSummary === 'object') {
      const summary = data.financialSummary;
      if (typeof summary.totalValue === 'string') {
        searchableContent.metadata.totalValue = summary.totalValue;
      }
    }
  }

  /**
   * Process overview artifact
   */
  private static processOverviewArtifact(data: any, searchableContent: SearchableContent): void {
    if (typeof data.contractType === 'string') {
      searchableContent.metadata.contractType = data.contractType;
    }

    if (Array.isArray(data.parties)) {
      data.parties.forEach((party: any) => {
        if (typeof party === 'string') {
          searchableContent.metadata.parties.push(party);
        } else if (party.name) {
          searchableContent.metadata.parties.push(party.name);
        }
      });
    }

    if (Array.isArray(data.keyInsights)) {
      data.keyInsights.forEach((insight: any) => {
        if (typeof insight === 'string') {
          searchableContent.metadata.insights.push(insight);
        } else if (insight.description) {
          searchableContent.metadata.insights.push(insight.description);
        }
      });
    }
  }

  /**
   * Process rates artifact
   */
  private static processRatesArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.rates)) {
      data.rates.forEach((rate: any) => {
        if (rate.role) {
          searchableContent.metadata.keyTerms.push(rate.role);
        }
        if (rate.amount && rate.currency) {
          searchableContent.metadata.financialTerms.push(`${rate.amount} ${rate.currency}`);
        }
      });
    }
  }

  /**
   * Process benchmark artifact
   */
  private static processBenchmarkArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.benchmarks)) {
      data.benchmarks.forEach((benchmark: any) => {
        if (benchmark.role) {
          searchableContent.metadata.keyTerms.push(benchmark.role);
        }
        if (benchmark.percentile) {
          searchableContent.metadata.insights.push(`${benchmark.role} at ${benchmark.percentile}th percentile`);
        }
      });
    }
  }

  /**
   * Process template artifact
   */
  private static processTemplateArtifact(data: any, searchableContent: SearchableContent): void {
    if (Array.isArray(data.templateSections)) {
      data.templateSections.forEach((section: any) => {
        if (section.sectionName) {
          searchableContent.metadata.clauseTypes.push(section.sectionName);
        }
      });
    }

    if (Array.isArray(data.deviations)) {
      data.deviations.forEach((deviation: any) => {
        if (deviation.description) {
          searchableContent.metadata.insights.push(deviation.description);
        }
      });
    }
  }

  /**
   * Extract confidence score from artifact
   */
  private static extractConfidenceFromArtifact(artifact: any): number {
    const data = artifact.data;
    
    if (typeof data.confidenceScore === 'number') {
      return data.confidenceScore;
    }
    
    if (data.metadata && typeof data.metadata === 'object') {
      const metadata = data.metadata;
      if (Array.isArray(metadata.provenance) && metadata.provenance.length > 0) {
        const latestProvenance = metadata.provenance[metadata.provenance.length - 1];
        if (typeof latestProvenance.confidenceScore === 'number') {
          return latestProvenance.confidenceScore;
        }
      }
    }
    
    return 0;
  }

  /**
   * Determine the highest risk level between two levels
   */
  private static determineHighestRiskLevel(current: string, newLevel: string): string {
    const riskLevels: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentLevel = riskLevels[current] ?? 1;
    const newLevelValue = riskLevels[newLevel] ?? 1;
    
    if (newLevelValue > currentLevel) {
      return newLevel;
    }
    return current;
  }

  /**
   * Deduplicate arrays in searchable content
   */
  private static deduplicateSearchableContent(searchableContent: SearchableContent): void {
    const metadata = searchableContent.metadata;
    
    metadata.keyTerms = [...new Set(metadata.keyTerms)];
    metadata.financialTerms = [...new Set(metadata.financialTerms)];
    metadata.riskFactors = [...new Set(metadata.riskFactors)];
    metadata.complianceStatus = [...new Set(metadata.complianceStatus)];
    metadata.insights = [...new Set(metadata.insights)];
    metadata.clauseTypes = [...new Set(metadata.clauseTypes)];
    metadata.parties = [...new Set(metadata.parties)];
  }
}

/**
 * Search Index Manager
 */
export class SearchIndexManager {
  
  /**
   * Create search vector from searchable content
   */
  static createSearchVector(searchableContent: SearchableContent): string {
    const searchText = [
      searchableContent.title,
      searchableContent.content,
      ...searchableContent.metadata.keyTerms,
      ...searchableContent.metadata.financialTerms,
      ...searchableContent.metadata.riskFactors,
      ...searchableContent.metadata.complianceStatus,
      ...searchableContent.metadata.insights,
      ...searchableContent.metadata.parties
    ].filter(Boolean).join(' ');

    return searchText;
  }

  /**
   * Create metadata for search index
   */
  static createSearchMetadata(searchableContent: SearchableContent): Record<string, any> {
    return {
      contractType: searchableContent.metadata.contractType,
      parties: searchableContent.metadata.parties,
      riskLevel: searchableContent.metadata.riskLevel,
      totalValue: searchableContent.metadata.totalValue,
      confidenceScore: searchableContent.metadata.confidenceScore,
      clauseTypes: searchableContent.metadata.clauseTypes,
      lastUpdated: searchableContent.metadata.lastUpdated.toISOString()
    };
  }

  /**
   * Build WHERE clause for search filters
   */
  static buildSearchWhereClause(query: SearchQuery): string {
    const conditions: string[] = [];

    if (query.filters?.contractType) {
      conditions.push(`metadata->>'contractType' = '${query.filters.contractType}'`);
    }

    if (query.filters?.riskLevel) {
      conditions.push(`metadata->>'riskLevel' = '${query.filters.riskLevel}'`);
    }

    if (query.filters?.parties && query.filters.parties.length > 0) {
      const partiesCondition = query.filters.parties
        .map(party => `metadata->'parties' ? '${party}'`)
        .join(' OR ');
      conditions.push(`(${partiesCondition})`);
    }

    if (query.filters?.dateRange) {
      conditions.push(
        `created_at BETWEEN '${query.filters.dateRange.start.toISOString()}' AND '${query.filters.dateRange.end.toISOString()}'`
      );
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  /**
   * Count searchable fields in content
   */
  static countSearchableFields(searchableContent: SearchableContent): number {
    let count = 0;
    
    if (searchableContent.title) count++;
    if (searchableContent.content) count++;
    if (searchableContent.metadata.contractType !== 'Unknown') count++;
    count += searchableContent.metadata.parties.length;
    count += searchableContent.metadata.keyTerms.length;
    count += searchableContent.metadata.financialTerms.length;
    count += searchableContent.metadata.riskFactors.length;
    count += searchableContent.metadata.complianceStatus.length;
    count += searchableContent.metadata.insights.length;
    count += searchableContent.metadata.clauseTypes.length;
    
    return count;
  }
}

/**
 * Vector Embedding Utilities (for future semantic search)
 */
export class VectorEmbeddingUtils {
  
  /**
   * Chunk text for embedding processing
   */
  static chunkText(text: string, chunkSize: number = 1000, overlapSize: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      
      if (end === text.length) break;
      start = end - overlapSize;
    }
    
    return chunks;
  }

  /**
   * Prepare content for embedding
   */
  static prepareForEmbedding(searchableContent: SearchableContent): string[] {
    const content = SearchIndexManager.createSearchVector(searchableContent);
    return this.chunkText(content);
  }

  /**
   * Calculate cosine similarity (placeholder for future implementation)
   */
  static cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

/**
 * RAG Integration Utilities
 */
export class RAGIntegration {
  
  /**
   * Trigger automatic indexation for contract
   */
  static async triggerAutoIndexation(
    contractId: string,
    tenantId: string,
    triggerType: string = 'artifact_updated'
  ): Promise<void> {
    try {
      // This would typically queue a job for the auto-indexation worker
      console.log(`🔄 Triggering auto-indexation for contract ${contractId} (${triggerType})`);
      
      // In a real implementation, this would:
      // 1. Queue an auto-indexation job
      // 2. Update indexation queue with priority
      // 3. Trigger search index updates
      
    } catch (error) {
      console.warn('Failed to trigger auto-indexation:', error);
    }
  }

  /**
   * Update search suggestions based on content
   */
  static async updateSearchSuggestions(
    tenantId: string,
    searchableContent: SearchableContent
  ): Promise<void> {
    try {
      // Extract suggestions from content
      const suggestions = [
        ...searchableContent.metadata.keyTerms,
        ...searchableContent.metadata.parties,
        searchableContent.metadata.contractType
      ].filter(Boolean);

      console.log(`📝 Updating search suggestions for tenant ${tenantId}: ${suggestions.length} suggestions`);
      
      // In a real implementation, this would update the search_suggestions table
      
    } catch (error) {
      console.warn('Failed to update search suggestions:', error);
    }
  }

  /**
   * Log search analytics
   */
  static async logSearchAnalytics(
    tenantId: string,
    query: string,
    resultsCount: number,
    responseTime: number
  ): Promise<void> {
    try {
      console.log(`📊 Logging search analytics: ${query} (${resultsCount} results, ${responseTime}ms)`);
      
      // In a real implementation, this would log to search_analytics table
      
    } catch (error) {
      console.warn('Failed to log search analytics:', error);
    }
  }
}


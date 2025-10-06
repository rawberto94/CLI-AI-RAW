import type { PrismaClient } from '@prisma/client';

// Fallback DatabaseManager class
class DatabaseManager {
  prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
}

export interface SearchableContent {
  contractId: string;
  title: string;
  content: string;
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
}

export interface SearchIndex {
  id: string;
  contractId: string;
  searchVector: string; // Full-text search vector
  semanticEmbedding?: number[]; // Optional semantic embeddings
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexationResult {
  contractId: string;
  indexed: boolean;
  searchableFields: number;
  processingTime: number;
  confidence: number;
  errors?: string[];
}

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

export interface ArtifactData {
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
}

export class EnhancedSearchIndexationService {
  constructor(private databaseManager: DatabaseManager) {}

  /**
   * Index a contract and all its artifacts for comprehensive search
   */
  async indexContract(contractId: string): Promise<IndexationResult> {
    console.log(`🔍 Starting comprehensive indexation for contract ${contractId}`);
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Get contract and all artifacts
      const contract = await this.databaseManager.prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          artifacts: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!contract) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Extract comprehensive searchable content from all artifacts
      const searchableContent = await this.extractSearchableContent(contract);
      
      // Create or update search index with full-text and semantic search
      await this.updateSearchIndex(searchableContent);
      
      // Update contract search metadata
      await this.updateContractSearchMetadata(contractId, searchableContent);
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Successfully indexed contract ${contractId} in ${processingTime}ms`);
      
      return {
        contractId,
        indexed: true,
        searchableFields: this.countSearchableFields(searchableContent),
        processingTime,
        confidence: searchableContent.confidenceScore ?? 0.8,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error(`❌ Failed to index contract ${contractId}:`, error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        contractId,
        indexed: false,
        searchableFields: 0,
        processingTime: Date.now() - startTime,
        confidence: 0,
        errors
      };
    }
  }

  /**
   * Extract searchable content from contract and all its artifacts
   */
  private async extractSearchableContent(contract: any): Promise<SearchableContent> {
    const artifacts = contract.artifacts as ArtifactData[];
    
    // Initialize searchable content structure
    const searchableContent: SearchableContent = {
      contractId: contract.id,
      title: contract.name || 'Untitled Contract',
      content: '',
      parties: [],
      contractType: 'Unknown',
      keyTerms: [],
      financialTerms: [],
      riskFactors: [],
      complianceStatus: [],
      insights: [],
      clauseTypes: [],
      lastUpdated: new Date(),
      tenantId: contract.tenantId,
      confidenceScore: 0,
      totalValue: undefined,
      riskLevel: 'low'
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    // Process each artifact type
    for (const artifact of artifacts) {
      try {
        await this.processArtifactForSearch(artifact, searchableContent);
        
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
    searchableContent.confidenceScore = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.5;
    
    // Deduplicate arrays
    searchableContent.keyTerms = [...new Set(searchableContent.keyTerms)];
    searchableContent.financialTerms = [...new Set(searchableContent.financialTerms)];
    searchableContent.riskFactors = [...new Set(searchableContent.riskFactors)];
    searchableContent.complianceStatus = [...new Set(searchableContent.complianceStatus)];
    searchableContent.insights = [...new Set(searchableContent.insights)];
    searchableContent.clauseTypes = [...new Set(searchableContent.clauseTypes)];
    searchableContent.parties = [...new Set(searchableContent.parties)];

    return searchableContent;
  }

  /**
   * Process individual artifact for search indexation
   */
  private async processArtifactForSearch(
    artifact: ArtifactData, 
    searchableContent: SearchableContent
  ): Promise<void> {
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
      default:
        console.log(`Unknown artifact type: ${artifact.type}`);
    }
  }

  /**
   * Process ingestion artifact for search content
   */
  private processIngestionArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (typeof data.content === 'string') {
      searchableContent.content = data.content;
    }
    
    if (typeof data.title === 'string') {
      searchableContent.title = data.title;
    }
  }

  /**
   * Process clauses artifact for search content
   */
  private processClausesArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (Array.isArray(data.clauses)) {
      data.clauses.forEach((clause: any) => {
        if (clause.clauseId) {
          searchableContent.clauseTypes.push(clause.clauseId);
        }
        if (clause.text) {
          searchableContent.content += ` ${clause.text}`;
        }
        if (clause.keyTerms && Array.isArray(clause.keyTerms)) {
          searchableContent.keyTerms.push(...clause.keyTerms);
        }
      });
    }
  }

  /**
   * Process risk artifact for search content
   */
  private processRiskArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (Array.isArray(data.risks)) {
      data.risks.forEach((risk: any) => {
        if (risk.description) {
          searchableContent.riskFactors.push(risk.description);
        }
        if (risk.severity) {
          searchableContent.riskLevel = this.determineHighestRiskLevel(searchableContent.riskLevel || 'low', risk.severity);
        }
      });
    }

    if (typeof data.overallRiskLevel === 'string') {
      searchableContent.riskLevel = data.overallRiskLevel;
    }
  }

  /**
   * Process compliance artifact for search content
   */
  private processComplianceArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (Array.isArray(data.complianceChecks)) {
      data.complianceChecks.forEach((check: any) => {
        if (check.requirement) {
          searchableContent.complianceStatus.push(check.requirement);
        }
        if (check.status) {
          searchableContent.complianceStatus.push(check.status);
        }
      });
    }

    if (Array.isArray(data.recommendations)) {
      data.recommendations.forEach((rec: any) => {
        if (rec.description) {
          searchableContent.insights.push(rec.description);
        }
      });
    }
  }

  /**
   * Process financial artifact for search content
   */
  private processFinancialArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (Array.isArray(data.financialTerms)) {
      data.financialTerms.forEach((term: any) => {
        if (term.description) {
          searchableContent.financialTerms.push(term.description);
        }
        if (term.amount) {
          searchableContent.financialTerms.push(term.amount);
        }
      });
    }

    if (data.financialSummary && typeof data.financialSummary === 'object') {
      const summary = data.financialSummary as Record<string, unknown>;
      if (typeof summary.totalValue === 'string') {
        searchableContent.totalValue = summary.totalValue;
      }
    }
  }

  /**
   * Process overview artifact for search content
   */
  private processOverviewArtifact(data: Record<string, unknown>, searchableContent: SearchableContent): void {
    if (typeof data.contractType === 'string') {
      searchableContent.contractType = data.contractType;
    }

    if (Array.isArray(data.parties)) {
      data.parties.forEach((party: any) => {
        if (typeof party === 'string') {
          searchableContent.parties.push(party);
        } else if (party.name) {
          searchableContent.parties.push(party.name);
        }
      });
    }

    if (Array.isArray(data.keyInsights)) {
      data.keyInsights.forEach((insight: any) => {
        if (typeof insight === 'string') {
          searchableContent.insights.push(insight);
        } else if (insight.description) {
          searchableContent.insights.push(insight.description);
        }
      });
    }
  }

  /**
   * Extract confidence score from artifact
   */
  private extractConfidenceFromArtifact(artifact: ArtifactData): number {
    const data = artifact.data;
    
    if (typeof data.confidenceScore === 'number') {
      return data.confidenceScore;
    }
    
    if (data.metadata && typeof data.metadata === 'object') {
      const metadata = data.metadata as Record<string, unknown>;
      if (Array.isArray(metadata.provenance) && metadata.provenance.length > 0) {
        const latestProvenance = metadata.provenance[metadata.provenance.length - 1] as any;
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
  private determineHighestRiskLevel(current: string, newLevel: string): string {
    const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentLevel = riskLevels[current as keyof typeof riskLevels] ?? 1;
    const newLevelValue = riskLevels[newLevel as keyof typeof riskLevels] ?? 1;
    
    if (newLevelValue > currentLevel) {
      return newLevel;
    }
    return current;
  }

  /**
   * Update search index with searchable content
   */
  private async updateSearchIndex(searchableContent: SearchableContent): Promise<void> {
    try {
      // Create full-text search vector
      const searchText = [
        searchableContent.title,
        searchableContent.content,
        ...searchableContent.keyTerms,
        ...searchableContent.financialTerms,
        ...searchableContent.riskFactors,
        ...searchableContent.complianceStatus,
        ...searchableContent.insights,
        ...searchableContent.parties
      ].filter(Boolean).join(' ');

      // Prepare metadata for search
      const metadata = {
        contractType: searchableContent.contractType,
        parties: searchableContent.parties,
        riskLevel: searchableContent.riskLevel,
        totalValue: searchableContent.totalValue,
        confidenceScore: searchableContent.confidenceScore,
        clauseTypes: searchableContent.clauseTypes,
        lastUpdated: searchableContent.lastUpdated.toISOString()
      };

      // Update or create search index record
      await this.databaseManager.prisma.$executeRaw`
        INSERT INTO contract_search_index (
          contract_id, 
          search_vector, 
          metadata, 
          tenant_id,
          created_at,
          updated_at
        ) VALUES (
          ${searchableContent.contractId},
          to_tsvector('english', ${searchText}),
          ${JSON.stringify(metadata)}::jsonb,
          ${searchableContent.tenantId},
          NOW(),
          NOW()
        )
        ON CONFLICT (contract_id) DO UPDATE SET
          search_vector = to_tsvector('english', ${searchText}),
          metadata = ${JSON.stringify(metadata)}::jsonb,
          updated_at = NOW()
      `;

      console.log(`📝 Updated search index for contract ${searchableContent.contractId}`);
    } catch (error) {
      console.error('Failed to update search index:', error);
      throw error;
    }
  }

  /**
   * Update contract search metadata
   */
  private async updateContractSearchMetadata(
    contractId: string, 
    searchableContent: SearchableContent
  ): Promise<void> {
    try {
      await this.databaseManager.prisma.contract.update({
        where: { id: contractId },
        data: {
          searchMetadata: {
            indexed: true,
            lastIndexed: new Date(),
            searchableFields: this.countSearchableFields(searchableContent),
            confidenceScore: searchableContent.confidenceScore,
            riskLevel: searchableContent.riskLevel,
            totalValue: searchableContent.totalValue
          }
        }
      });
    } catch (error) {
      console.warn('Failed to update contract search metadata:', error);
      // Don't throw - this is not critical for indexation
    }
  }

  /**
   * Count searchable fields in content
   */
  private countSearchableFields(searchableContent: SearchableContent): number {
    let count = 0;
    
    if (searchableContent.title) count++;
    if (searchableContent.content) count++;
    if (searchableContent.contractType !== 'Unknown') count++;
    count += searchableContent.parties.length;
    count += searchableContent.keyTerms.length;
    count += searchableContent.financialTerms.length;
    count += searchableContent.riskFactors.length;
    count += searchableContent.complianceStatus.length;
    count += searchableContent.insights.length;
    count += searchableContent.clauseTypes.length;
    
    return count;
  }

  /**
   * Search contracts using the enhanced search index
   */
  async searchContracts(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const whereClause = this.buildSearchWhereClause(query);
      const searchResults = await this.databaseManager.prisma.$queryRaw`
        SELECT 
          csi.contract_id,
          c.name as title,
          ts_rank(csi.search_vector, plainto_tsquery('english', ${query.query})) as relevance_score,
          ts_headline('english', 
            COALESCE(csi.metadata->>'content', c.name), 
            plainto_tsquery('english', ${query.query}),
            'MaxWords=50, MinWords=10'
          ) as highlight,
          csi.metadata
        FROM contract_search_index csi
        JOIN contracts c ON csi.contract_id = c.id
        WHERE csi.tenant_id = ${query.tenantId}
          AND csi.search_vector @@ plainto_tsquery('english', ${query.query})
          ${whereClause}
        ORDER BY relevance_score DESC
        LIMIT ${query.limit ?? 20}
        OFFSET ${query.offset ?? 0}
      ` as any[];

      return searchResults.map(result => ({
        contractId: result.contract_id,
        title: result.title,
        relevanceScore: parseFloat(result.relevance_score),
        highlights: [result.highlight],
        metadata: {
          contractType: result.metadata.contractType,
          parties: result.metadata.parties,
          lastUpdated: new Date(result.metadata.lastUpdated),
          confidenceScore: result.metadata.confidenceScore,
          totalValue: result.metadata.totalValue,
          riskLevel: result.metadata.riskLevel
        }
      }));
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Build WHERE clause for search filters
   */
  private buildSearchWhereClause(query: SearchQuery): string {
    const conditions: string[] = [];

    if (query.filters?.contractType) {
      conditions.push(`csi.metadata->>'contractType' = '${query.filters.contractType}'`);
    }

    if (query.filters?.riskLevel) {
      conditions.push(`csi.metadata->>'riskLevel' = '${query.filters.riskLevel}'`);
    }

    if (query.filters?.parties && query.filters.parties.length > 0) {
      const partiesCondition = query.filters.parties
        .map(party => `csi.metadata->'parties' ? '${party}'`)
        .join(' OR ');
      conditions.push(`(${partiesCondition})`);
    }

    if (query.filters?.dateRange) {
      conditions.push(
        `c.created_at BETWEEN '${query.filters.dateRange.start.toISOString()}' AND '${query.filters.dateRange.end.toISOString()}'`
      );
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  /**
   * Batch index multiple contracts
   */
  async batchIndexContracts(contractIds: string[]): Promise<IndexationResult[]> {
    console.log(`🔄 Starting batch indexation for ${contractIds.length} contracts`);
    const results: IndexationResult[] = [];

    for (const contractId of contractIds) {
      try {
        const result = await this.indexContract(contractId);
        results.push(result);
      } catch (error) {
        console.error(`Failed to index contract ${contractId}:`, error);
        results.push({
          contractId,
          indexed: false,
          searchableFields: 0,
          processingTime: 0,
          confidence: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    const successCount = results.filter(r => r.indexed).length;
    console.log(`✅ Batch indexation complete: ${successCount}/${contractIds.length} contracts indexed`);

    return results;
  }

  /**
   * Get indexation statistics
   */
  async getIndexationStats(tenantId: string): Promise<{
    totalIndexed: number;
    averageConfidence: number;
    lastIndexed: Date | null;
    indexedByType: Record<string, number>;
  }> {
    try {
      const stats = await this.databaseManager.prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_indexed,
          AVG((metadata->>'confidenceScore')::float) as avg_confidence,
          MAX(updated_at) as last_indexed,
          jsonb_object_agg(
            metadata->>'contractType', 
            type_count
          ) as indexed_by_type
        FROM (
          SELECT 
            metadata,
            updated_at,
            COUNT(*) as type_count
          FROM contract_search_index 
          WHERE tenant_id = ${tenantId}
          GROUP BY metadata->>'contractType', metadata, updated_at
        ) grouped
      ` as any[];

      const result = stats[0];
      return {
        totalIndexed: parseInt(result.total_indexed) || 0,
        averageConfidence: parseFloat(result.avg_confidence) || 0,
        lastIndexed: result.last_indexed ? new Date(result.last_indexed) : null,
        indexedByType: result.indexed_by_type || {}
      };
    } catch (error) {
      console.error('Failed to get indexation stats:', error);
      return {
        totalIndexed: 0,
        averageConfidence: 0,
        lastIndexed: null,
        indexedByType: {}
      };
    }
  }

  /**
   * Remove contract from search index
   */
  async removeFromIndex(contractId: string): Promise<void> {
    try {
      await this.databaseManager.prisma.$executeRaw`
        DELETE FROM contract_search_index WHERE contract_id = ${contractId}
      `;
      console.log(`🗑️ Removed contract ${contractId} from search index`);
    } catch (error) {
      console.error(`Failed to remove contract ${contractId} from index:`, error);
      throw error;
    }
  }
}
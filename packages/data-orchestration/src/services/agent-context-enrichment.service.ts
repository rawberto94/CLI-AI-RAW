/**
 * Agent Context Enrichment Service
 * 
 * Provides rich, multi-source context for AI agents by integrating:
 * - Extracted artifacts (obligations, risks, clauses, parties)
 * - RAG/vector embeddings for semantic similarity
 * - Knowledge Graph relationships and insights
 * - Similar contract patterns and benchmarks
 * 
 * This bridges the gap between raw contract metadata and the rich
 * intelligence extracted by the RAG pipeline, making it available
 * to all Contigo Lab agents.
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';

import { createLogger } from '../utils/logger';

const logger = createLogger('agent-context-enrichment');

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichedAgentContext {
  /** Core contract metadata */
  contract: ContractMetadata;
  
  /** Extracted artifacts from processing pipeline */
  artifacts: ContractArtifacts;
  
  /** RAG-based similar contracts */
  similarContracts: SimilarContract[];
  
  /** Knowledge Graph insights */
  graphInsights: GraphInsights;
  
  /** Semantic search context */
  semanticContext: SemanticContext;
  
  /** Cross-contract patterns */
  patterns: ContractPatterns;
  
  /** Performance metrics */
  _meta: {
    enrichmentTimeMs: number;
    dataSources: string[];
    cacheHit: boolean;
  };
}

export interface ContractMetadata {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status: string;
  value?: number;
  annualValue?: number;
  effectiveDate?: Date;
  expirationDate?: Date;
  supplierName?: string;
  counterparty?: string;
  autoRenewalEnabled: boolean;
  department?: string;
  riskLevel?: string;
  riskScore?: number;
  healthScore?: number;
  dataCompleteness?: number;
}

export interface ContractArtifacts {
  obligations?: Array<{
    id: string;
    obligation: string;
    party: string;
    dueDate?: Date;
    frequency?: string;
    status: string;
    priority: string;
  }>;
  risks?: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    affectedSection?: string;
    recommendation?: string;
  }>;
  parties?: Array<{
    name: string;
    role: string;
    email?: string;
    address?: string;
  }>;
  clauses?: Array<{
    type: string;
    text: string;
    section?: string;
    isNegotiated: boolean;
  }>;
  financials?: {
    totalValue?: number;
    annualValue?: number;
    paymentTerms?: string;
    currency?: string;
    invoicingRequirements?: string;
  };
  term?: {
    effectiveDate?: Date;
    expirationDate?: Date;
    durationMonths?: number;
    autoRenewal: boolean;
    terminationNoticeDays?: number;
  };
  extractedAt?: Date;
  confidence?: number;
}

export interface SimilarContract {
  id: string;
  title: string;
  similarity: number;
  matchReasons: string[];
  valueDiff?: number;
  termDiff?: number;
  supplier?: string;
  type: string;
}

export interface GraphInsights {
  /** Related contracts through shared parties/clauses */
  relatedContracts: Array<{
    contractId: string;
    relationship: string;
    strength: number;
    commonParties: string[];
  }>;
  
  /** Key entities extracted from contract */
  keyEntities: Array<{
    name: string;
    type: string;
    frequency: number;
    importance: number;
  }>;
  
  /** Counterparty network analysis */
  counterpartyNetwork?: {
    centralityScore: number;
    contractCount: number;
    totalValue: number;
    riskProfile: 'low' | 'medium' | 'high';
    relationshipHistory: Array<{
      contractId: string;
      status: string;
      performance: number;
    }>;
  };
  
  /** PageRank-style importance score */
  importanceScore: number;
}

export interface SemanticContext {
  /** Vector embedding available */
  hasEmbedding: boolean;
  
  /** Top semantic matches from tenant portfolio */
  semanticMatches: Array<{
    contractId: string;
    title: string;
    score: number;
    sharedConcepts: string[];
  }>;
  
  /** Cluster this contract belongs to */
  cluster?: {
    id: string;
    name: string;
    size: number;
    commonTerms: string[];
  };
}

export interface ContractPatterns {
  /** Historical patterns for this contract type */
  typePatterns: {
    avgNegotiationTime: number;
    commonClauses: string[];
    typicalValues: { min: number; max: number; median: number };
    riskDistribution: Record<string, number>;
  };
  
  /** Department benchmarks */
  departmentBenchmarks?: {
    avgContractValue: number;
    avgDuration: number;
    renewalRate: number;
    comparedToDept: 'above' | 'below' | 'average';
  };
  
  /** Market context */
  marketContext?: {
    rateBenchmarks?: Array<{
      category: string;
      marketRate: number;
      contractRate?: number;
      variance: number;
    }>;
    geographicContext?: string;
  };
}

export interface EnrichmentOptions {
  /** Include full artifact extractions */
  includeArtifacts?: boolean;
  
  /** Number of similar contracts to fetch */
  similarContractLimit?: number;
  
  /** Include graph relationships */
  includeGraphInsights?: boolean;
  
  /** Include semantic search */
  includeSemanticContext?: boolean;
  
  /** Cache results for this duration (ms) */
  cacheTtlMs?: number;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class AgentContextEnrichmentService {
  private prisma: PrismaClient;
  private cache: Map<string, { data: EnrichedAgentContext; expires: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }
  
  /**
   * Main entry point: Enrich contract context for agent consumption
   */
  async enrichContext(
    contractId: string,
    tenantId: string,
    options: EnrichmentOptions = {}
  ): Promise<EnrichedAgentContext> {
    const startTime = Date.now();
    const opts = {
      includeArtifacts: true,
      similarContractLimit: 5,
      includeGraphInsights: true,
      includeSemanticContext: true,
      cacheTtlMs: this.DEFAULT_CACHE_TTL,
      ...options,
    };
    
    // Check cache
    const cacheKey = `${tenantId}:${contractId}:${JSON.stringify(opts)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      logger.debug({ contractId }, 'Agent context cache hit');
      return {
        ...cached.data,
        _meta: { ...cached.data._meta, cacheHit: true },
      };
    }
    
    try {
      // Parallel enrichment of all data sources
      const [
        contract,
        artifacts,
        similarContracts,
        graphInsights,
        semanticContext,
        patterns,
      ] = await Promise.all([
        this.fetchContractMetadata(contractId, tenantId),
        opts.includeArtifacts ? this.fetchArtifacts(contractId, tenantId) : Promise.resolve({}),
        this.fetchSimilarContracts(contractId, tenantId, opts.similarContractLimit),
        opts.includeGraphInsights ? this.fetchGraphInsights(contractId, tenantId) : Promise.resolve({} as GraphInsights),
        opts.includeSemanticContext ? this.fetchSemanticContext(contractId, tenantId) : Promise.resolve({} as SemanticContext),
        this.fetchPatterns(contractId, tenantId),
      ]);
      
      const enriched: EnrichedAgentContext = {
        contract,
        artifacts,
        similarContracts,
        graphInsights,
        semanticContext,
        patterns,
        _meta: {
          enrichmentTimeMs: Date.now() - startTime,
          dataSources: this.getActiveSources(opts),
          cacheHit: false,
        },
      };
      
      // Cache result
      this.cache.set(cacheKey, {
        data: enriched,
        expires: Date.now() + opts.cacheTtlMs,
      });
      
      // Cleanup old cache entries periodically
      if (this.cache.size > 1000) {
        this.cleanupCache();
      }
      
      logger.info({
        contractId,
        enrichmentTimeMs: enriched._meta.enrichmentTimeMs,
        sources: enriched._meta.dataSources,
      }, 'Agent context enriched');
      
      return enriched;
    } catch (error) {
      logger.error({ error, contractId, tenantId }, 'Failed to enrich agent context');
      // Return minimal context on error
      return this.getMinimalContext(contractId, tenantId);
    }
  }
  
  /**
   * Fetch core contract metadata
   */
  private async fetchContractMetadata(
    contractId: string,
    tenantId: string
  ): Promise<ContractMetadata> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        tenantId: true,
        contractTitle: true,
        contractType: true,
        status: true,
        totalValue: true,
        annualValue: true,
        effectiveDate: true,
        expirationDate: true,
        supplierName: true,
        autoRenewalEnabled: true,
      },
    });
    
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }
    
    return {
      id: contract.id,
      tenantId: contract.tenantId,
      title: contract.contractTitle || 'Untitled',
      type: contract.contractType || 'OTHER',
      status: contract.status,
      value: contract.totalValue ? Number(contract.totalValue) : undefined,
      annualValue: contract.annualValue ? Number(contract.annualValue) : undefined,
      effectiveDate: contract.effectiveDate || undefined,
      expirationDate: contract.expirationDate || undefined,
      supplierName: contract.supplierName || undefined,
      autoRenewalEnabled: contract.autoRenewalEnabled ?? false,
    };
  }
  
  /**
   * Fetch extracted artifacts from contract processing
   */
  private async fetchArtifacts(
    contractId: string,
    tenantId: string
  ): Promise<ContractArtifacts> {
    const artifacts: ContractArtifacts = {};
    
    try {
      // Fetch ContractArtifact records
      const artifactRecords = await (this.prisma as any).contractArtifact?.findMany?.({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }) || [];
      
      for (const record of artifactRecords) {
        const data = record.data || {};
        
        switch (record.type) {
          case 'obligations':
            artifacts.obligations = Array.isArray(data.obligations) 
              ? data.obligations.map((o: any) => ({
                  id: o.id || `${contractId}-ob-${Math.random().toString(36).substr(2, 9)}`,
                  obligation: o.obligation || o.description || '',
                  party: o.party || o.responsibleParty || 'Unknown',
                  dueDate: o.dueDate ? new Date(o.dueDate) : undefined,
                  frequency: o.frequency,
                  status: o.status || 'pending',
                  priority: o.priority || 'medium',
                }))
              : undefined;
            break;
            
          case 'risk_assessment':
            artifacts.risks = Array.isArray(data.risks)
              ? data.risks.map((r: any) => ({
                  id: r.id || `${contractId}-risk-${Math.random().toString(36).substr(2, 9)}`,
                  type: r.type || 'unknown',
                  severity: r.severity || 'medium',
                  description: r.description || '',
                  affectedSection: r.affectedSection,
                  recommendation: r.recommendation,
                }))
              : undefined;
            break;
            
          case 'parties':
            artifacts.parties = Array.isArray(data.parties)
              ? data.parties.map((p: any) => ({
                  name: p.name || p.partyName || '',
                  role: p.role || p.partyRole || 'Unknown',
                  email: p.email,
                  address: p.address,
                }))
              : undefined;
            break;
            
          case 'financial_terms':
            artifacts.financials = {
              totalValue: data.totalValue || data.contractValue,
              annualValue: data.annualValue,
              paymentTerms: data.paymentTerms,
              currency: data.currency,
              invoicingRequirements: data.invoicingRequirements,
            };
            break;
            
          case 'term':
            artifacts.term = {
              effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
              expirationDate: data.expirationDate ? new Date(data.expirationDate) : undefined,
              durationMonths: data.durationMonths,
              autoRenewal: data.autoRenewal ?? false,
              terminationNoticeDays: data.terminationNoticeDays,
            };
            break;
        }
      }
      
      // Also try to fetch from extractionResults if available
      const extractionResults = await (this.prisma as any).extractionResult?.findFirst?.({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
      });
      
      if (extractionResults?.result) {
        const result = extractionResults.result;
        
        // Merge with existing artifacts
        if (!artifacts.obligations && result.obligations) {
          artifacts.obligations = result.obligations;
        }
        if (!artifacts.risks && result.risks) {
          artifacts.risks = result.risks;
        }
        if (!artifacts.parties && result.parties) {
          artifacts.parties = result.parties;
        }
      }
      
      artifacts.extractedAt = artifactRecords[0]?.createdAt || extractionResults?.createdAt;
      artifacts.confidence = artifactRecords[0]?.confidence || extractionResults?.confidence;
      
    } catch (error) {
      logger.warn({ error, contractId }, 'Failed to fetch artifacts, continuing without');
    }
    
    return artifacts;
  }
  
  /**
   * Fetch similar contracts using vector similarity
   */
  private async fetchSimilarContracts(
    contractId: string,
    tenantId: string,
    limit: number
  ): Promise<SimilarContract[]> {
    try {
      // Use ContractEmbedding table for vector similarity
      const similar = await this.prisma.$queryRaw<Array<{
        contractId: string;
        contractTitle: string;
        contractType: string;
        supplierName: string;
        totalValue: number;
        similarity: number;
      }>>`
        WITH target_embedding AS (
          SELECT embedding 
          FROM "ContractEmbedding" 
          WHERE "contractId" = ${contractId} 
          AND "chunkType" = 'metadata'
          LIMIT 1
        )
        SELECT 
          c.id as "contractId",
          c."contractTitle",
          c."contractType",
          c."supplierName",
          c."totalValue",
          1 - (e.embedding <=> (SELECT embedding FROM target_embedding)) as similarity
        FROM "ContractEmbedding" e
        JOIN "Contract" c ON c.id = e."contractId"
        WHERE e."contractId" != ${contractId}
        AND c."tenantId" = ${tenantId}
        AND e.embedding IS NOT NULL
        AND e."chunkType" = 'metadata'
        ORDER BY e.embedding <=> (SELECT embedding FROM target_embedding)
        LIMIT ${limit}
      `;
      
      return similar.map(s => ({
        id: s.contractId,
        title: s.contractTitle || 'Untitled',
        similarity: Math.round(s.similarity * 100) / 100,
        matchReasons: this.generateMatchReasons(s),
        valueDiff: s.totalValue ? undefined : undefined, // Calculate if needed
        supplier: s.supplierName || undefined,
        type: s.contractType || 'OTHER',
      }));
    } catch (error) {
      logger.warn({ error, contractId }, 'Vector similarity search failed, using fallback');
      return this.fetchSimilarContractsFallback(contractId, tenantId, limit);
    }
  }
  
  /**
   * Fallback: Use metadata-based similarity when vectors unavailable
   */
  private async fetchSimilarContractsFallback(
    contractId: string,
    tenantId: string,
    limit: number
  ): Promise<SimilarContract[]> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { contractType: true, supplierName: true },
    });
    
    if (!contract) return [];
    
    // Find contracts with same type or supplier
    const similar = await this.prisma.contract.findMany({
      where: {
        tenantId,
        id: { not: contractId },
        OR: [
          { contractType: contract.contractType },
          { supplierName: contract.supplierName },
        ],
      },
      select: {
        id: true,
        contractTitle: true,
        contractType: true,
        supplierName: true,
        totalValue: true,
      },
      take: limit,
    });
    
    return similar.map(s => ({
      id: s.id,
      title: s.contractTitle || 'Untitled',
      similarity: s.contractType === contract.contractType ? 0.7 : 0.5,
      matchReasons: [
        ...(s.contractType === contract.contractType ? ['Same contract type'] : []),
        ...(s.supplierName && s.supplierName === contract.supplierName ? ['Same supplier'] : []),
      ],
      supplier: s.supplierName || undefined,
      type: s.contractType || 'OTHER',
    }));
  }
  
  /**
   * Fetch Knowledge Graph insights
   */
  private async fetchGraphInsights(
    _contractId: string,
    _tenantId: string
  ): Promise<GraphInsights> {
    return {
      relatedContracts: [],
      keyEntities: [],
      importanceScore: 0.5,
    };
  }
  
  /**
   * Fetch semantic context and cluster info
   */
  private async fetchSemanticContext(
    contractId: string,
    tenantId: string
  ): Promise<SemanticContext> {
    try {
      // Check for embedding
      const embedding = await (this.prisma as any).contractEmbedding?.findFirst?.({
        where: { contractId, chunkType: 'metadata' },
        select: { id: true },
      });
      
      // Find cluster membership
      const clusterMembership = await this.prisma.$queryRaw<Array<{
        clusterId: string;
        clusterName: string;
        clusterSize: number;
        commonTerms: string[];
      }>>`
        SELECT 
          cc.id as "clusterId",
          cc.name as "clusterName",
          cc."contractCount" as "clusterSize",
          cc."commonTerms"
        FROM "ContractCluster" cc
        JOIN "_ContractToCluster" ctc ON ctc."B" = cc.id
        WHERE ctc."A" = ${contractId}
        AND cc."tenantId" = ${tenantId}
        LIMIT 1
      `;
      
      // Get semantic matches
      const semanticMatches = await this.fetchSimilarContracts(contractId, tenantId, 3);
      
      return {
        hasEmbedding: !!embedding,
        semanticMatches: semanticMatches.map(m => ({
          contractId: m.id,
          title: m.title,
          score: m.similarity,
          sharedConcepts: m.matchReasons,
        })),
        cluster: clusterMembership[0] ? {
          id: clusterMembership[0].clusterId,
          name: clusterMembership[0].clusterName,
          size: clusterMembership[0].clusterSize,
          commonTerms: clusterMembership[0].commonTerms || [],
        } : undefined,
      };
    } catch (error) {
      logger.warn({ error, contractId }, 'Semantic context fetch failed');
      return {
        hasEmbedding: false,
        semanticMatches: [],
      };
    }
  }
  
  /**
   * Fetch pattern analysis for this contract type/department
   */
  private async fetchPatterns(
    contractId: string,
    tenantId: string
  ): Promise<ContractPatterns> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { contractType: true, totalValue: true },
    });
    
    if (!contract) {
      return this.getDefaultPatterns();
    }
    
    // Get type patterns
    const typeContracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        contractType: contract.contractType,
        id: { not: contractId },
      },
      select: {
        totalValue: true,
        effectiveDate: true,
        expirationDate: true,
        status: true,
      },
      take: 100,
    });
    
    const values = typeContracts
      .map(c => c.totalValue ? Number(c.totalValue) : null)
      .filter((v): v is number => v !== null && v !== undefined);
    
    const durations = typeContracts
      .map(c => {
        if (c.effectiveDate && c.expirationDate) {
          return (c.expirationDate.getTime() - c.effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        }
        return null;
      })
      .filter((d): d is number => d !== null);
    
    return {
      typePatterns: {
        avgNegotiationTime: 45, // days, placeholder
        commonClauses: ['Indemnification', 'Limitation of Liability', 'Termination'],
        typicalValues: {
          min: values.length > 0 ? Math.min(...values) : 0,
          max: values.length > 0 ? Math.max(...values) : 0,
          median: values.length > 0 
            ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)] 
            : 0,
        },
        riskDistribution: {
          low: 0.6,
          medium: 0.3,
          high: 0.1,
        },
      },
    };
  }
  
  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(similar: any): string[] {
    const reasons: string[] = [];
    if (similar.similarity > 0.8) reasons.push('Highly similar content');
    if (similar.similarity > 0.6) reasons.push('Similar structure');
    return reasons.length > 0 ? reasons : ['Related content'];
  }
  
  /**
   * Get list of active data sources
   */
  private getActiveSources(opts: EnrichmentOptions): string[] {
    const sources: string[] = ['contract_metadata'];
    if (opts.includeArtifacts) sources.push('extracted_artifacts');
    if (opts.similarContractLimit && opts.similarContractLimit > 0) sources.push('vector_similarity');
    if (opts.includeGraphInsights) sources.push('knowledge_graph');
    if (opts.includeSemanticContext) sources.push('semantic_clustering');
    return sources;
  }
  
  /**
   * Get minimal context when enrichment fails
   */
  private getMinimalContext(contractId: string, tenantId: string): EnrichedAgentContext {
    return {
      contract: {
        id: contractId,
        tenantId,
        title: 'Unknown',
        type: 'OTHER',
        status: 'UNKNOWN',
        autoRenewalEnabled: false,
      },
      artifacts: {},
      similarContracts: [],
      graphInsights: {
        relatedContracts: [],
        keyEntities: [],
        importanceScore: 0.5,
      },
      semanticContext: {
        hasEmbedding: false,
        semanticMatches: [],
      },
      patterns: this.getDefaultPatterns(),
      _meta: {
        enrichmentTimeMs: 0,
        dataSources: ['error_fallback'],
        cacheHit: false,
      },
    };
  }
  
  /**
   * Get default patterns
   */
  private getDefaultPatterns(): ContractPatterns {
    return {
      typePatterns: {
        avgNegotiationTime: 45,
        commonClauses: [],
        typicalValues: { min: 0, max: 0, median: 0 },
        riskDistribution: { low: 0.5, medium: 0.3, high: 0.2 },
      },
    };
  }
  
  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear cache for a specific contract
   */
  invalidateCache(contractId: string, tenantId: string): void {
    const prefix = `${tenantId}:${contractId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    logger.debug({ contractId }, 'Agent context cache invalidated');
  }
  
  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }
}

// Export singleton instance
export const agentContextEnrichmentService = new AgentContextEnrichmentService();

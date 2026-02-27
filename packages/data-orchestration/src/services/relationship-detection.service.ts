/**
 * AI-Powered Relationship Detection Service
 * 
 * Automatically identifies and creates intelligent links between contracts:
 * - SOW → MSA relationships
 * - Annex/Exhibit → Main Contract links
 * - Amendment → Original Contract links
 * - Renewal → Previous Term links
 * - Related agreements (same parties, overlapping terms)
 * 
 * Uses multiple detection strategies:
 * 1. Text-based pattern matching (explicit references)
 * 2. AI-powered semantic analysis (implicit relationships)
 * 3. Entity matching (same parties, dates, values)
 * 4. Historical pattern learning
 * 
 * @version 2.0.0
 */

import { prisma } from '../lib/prisma';
import { createLogger } from '../utils/logger';
import { knowledgeGraphService } from './knowledge-graph.service';

const logger = createLogger('relationship-detection');

// ============================================================================
// TYPES
// ============================================================================

export type RelationshipType = 
  | 'SOW_UNDER_MSA'
  | 'ANNEX_TO_MAIN'
  | 'EXHIBIT_TO_MAIN'
  | 'AMENDMENT_TO_ORIGINAL'
  | 'ADDENDUM_TO_ORIGINAL'
  | 'RENEWAL_OF'
  | 'MASTER_TO_SUB'
  | 'RELATED_AGREEMENT'
  | 'SUPERSEDES'
  | 'CONFLICTS_WITH'
  | 'SAME_PARTY_BUNDLE'
  | 'TEMPORAL_SEQUENCE';

export type RelationshipDirection = 'parent' | 'child' | 'sibling' | 'bidirectional';

export interface DetectedRelationship {
  id?: string;
  sourceContractId: string;
  targetContractId: string;
  relationshipType: RelationshipType;
  direction: RelationshipDirection;
  confidence: number; // 0-1
  evidence: RelationshipEvidence[];
  detectedAt: Date;
  detectedBy: 'ai' | 'pattern' | 'entity_match' | 'manual' | 'hybrid';
  status: 'pending' | 'confirmed' | 'rejected' | 'auto_confirmed';
  metadata?: {
    similarityScore?: number;
    sharedEntities?: string[];
    temporalOverlap?: boolean;
    valueCorrelation?: number;
  };
}

export interface RelationshipEvidence {
  type: 'text_reference' | 'entity_match' | 'date_correlation' | 'party_match' | 'value_match' | 'semantic_similarity';
  description: string;
  confidence: number;
  sourceText?: string;
  extractedValue?: string;
}

export interface RelationshipQuery {
  contractId: string;
  includeIndirect?: boolean;
  maxDepth?: number;
  relationshipTypes?: RelationshipType[];
  minConfidence?: number;
}

export interface RelationshipGraph {
  nodes: ContractNode[];
  edges: RelationshipEdge[];
  clusters: ContractCluster[];
}

export interface ContractNode {
  id: string;
  title: string;
  type: string;
  party?: string;
  startDate?: Date;
  endDate?: Date;
  value?: number;
  riskScore?: number;
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  confidence: number;
  direction: RelationshipDirection;
  label?: string;
}

export interface ContractCluster {
  id: string;
  name: string;
  contractIds: string[];
  dominantType: RelationshipType;
  sharedParty?: string;
}

export interface NavigationSuggestion {
  fromContractId: string;
  suggestedContractId: string;
  reason: string;
  relationshipType: RelationshipType;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

interface ReferencePattern {
  relationshipType: RelationshipType;
  patterns: RegExp[];
  confidence: number;
  extractTarget?: (match: RegExpMatchArray) => string | null;
}

const REFERENCE_PATTERNS: ReferencePattern[] = [
  // SOW → MSA references
  {
    relationshipType: 'SOW_UNDER_MSA',
    patterns: [
      /(?:pursuant\s+to|under|as\s+defined\s+in|subject\s+to)\s+(?:the\s+)?["']?(Master\s+(?:Service\s+)?Agreement|MSA)["']?/i,
      /(?:this\s+)?Statement\s+of\s+Work\s+\(?["']?SOW["']?\)?\s+(?:is\s+)?(?:entered\s+into|executed)\s+(?:under|pursuant\s+to)/i,
      /(?:attached\s+to|exhibited\s+to|annexed\s+to)\s+(?:the\s+)?["']?(Master\s+(?:Service\s+)?Agreement|MSA)["']?/i,
    ],
    confidence: 0.9,
  },
  // Annex/Exhibit → Main
  {
    relationshipType: 'ANNEX_TO_MAIN',
    patterns: [
      /(?:Annex|Appendix|Schedule)\s+[A-Z0-9]+\s+(?:to|of)\s+(?:the\s+)?(?:Agreement|Contract)/i,
      /(?:attached\s+to|appended\s+to)\s+(?:the\s+)?(?:main\s+)?(?:agreement|contract)/i,
    ],
    confidence: 0.85,
  },
  // Amendment → Original
  {
    relationshipType: 'AMENDMENT_TO_ORIGINAL',
    patterns: [
      /Amendment\s+(?:No\.?\s*)?\d+\s+(?:to|of)\s+(?:the\s+)?["']?([^"']+Agreement)["']?/i,
      /(?:this\s+)?amendment\s+(?:modifies|supplements|changes)\s+(?:the\s+)?(?:original\s+)?agreement/i,
      /referenced\s+in\s+(?:the\s+)?original\s+agreement/i,
    ],
    confidence: 0.9,
  },
  // Renewal
  {
    relationshipType: 'RENEWAL_OF',
    patterns: [
      /(?:Renewal|Extension)\s+(?:Agreement|of\s+Agreement)/i,
      /(?:this\s+)?agreement\s+(?:renews|extends)\s+(?:the\s+)?(?:previous\s+)?agreement/i,
      /successor\s+to\s+(?:the\s+)?(?:original\s+)?agreement/i,
    ],
    confidence: 0.85,
  },
  // Supersedes
  {
    relationshipType: 'SUPERSEDES',
    patterns: [
      /(?:This\s+agreement\s+)?supersedes\s+(?:and\s+replaces\s+)?(?:the\s+)?(?:previous\s+)?agreement/i,
      /(?:This\s+agreement\s+)?replaces\s+(?:the\s+)?(?:prior\s+)?agreement/i,
    ],
    confidence: 0.95,
  },
];

// ============================================================================
// MAIN SERVICE
// ============================================================================

class RelationshipDetectionService {
  private static instance: RelationshipDetectionService;

  private constructor() {
    logger.info('Relationship Detection Service initialized');
  }

  static getInstance(): RelationshipDetectionService {
    if (!RelationshipDetectionService.instance) {
      RelationshipDetectionService.instance = new RelationshipDetectionService();
    }
    return RelationshipDetectionService.instance;
  }

  // ==========================================================================
  // CORE DETECTION METHODS
  // ==========================================================================

  /**
   * Detect all relationships for a contract using multiple strategies
   */
  async detectRelationships(
    contractId: string,
    tenantId: string,
    options: {
      useAI?: boolean;
      usePatterns?: boolean;
      useEntityMatching?: boolean;
      candidateContracts?: string[]; // Limit search to these
    } = {}
  ): Promise<DetectedRelationship[]> {
    const {
      useAI = true,
      usePatterns = true,
      useEntityMatching = true,
      candidateContracts,
    } = options;

    const relationships: DetectedRelationship[] = [];

    // Fetch contract with artifacts
    const contract = await this.fetchContractWithArtifacts(contractId, tenantId);
    if (!contract) {
      logger.warn({ contractId }, 'Contract not found for relationship detection');
      return [];
    }

    // Strategy 1: Pattern-based detection (explicit references in text)
    if (usePatterns && contract.rawText) {
      const patternRelationships = await this.detectWithPatterns(
        contract,
        candidateContracts,
        tenantId
      );
      relationships.push(...patternRelationships);
    }

    // Strategy 2: AI-powered semantic analysis
    if (useAI && contract.rawText) {
      const aiRelationships = await this.detectWithAI(
        contract,
        candidateContracts,
        tenantId
      );
      relationships.push(...aiRelationships);
    }

    // Strategy 3: Entity matching (same parties, overlapping dates, etc.)
    if (useEntityMatching) {
      const entityRelationships = await this.detectWithEntityMatching(
        contract,
        candidateContracts,
        tenantId
      );
      relationships.push(...entityRelationships);
    }

    // Deduplicate and rank
    const deduplicated = this.deduplicateRelationships(relationships);
    
    // Auto-confirm high-confidence relationships
    const processed = this.processDetectedRelationships(deduplicated);

    logger.info({
      contractId,
      totalDetected: relationships.length,
      afterDeduplication: processed.length,
    }, 'Relationship detection completed');

    return processed;
  }

  /**
   * Detect relationships using explicit text patterns
   */
  private async detectWithPatterns(
    contract: any,
    candidateContractIds: string[] | undefined,
    tenantId: string
  ): Promise<DetectedRelationship[]> {
    const relationships: DetectedRelationship[] = [];
    const text = contract.rawText || '';

    // Get candidate contracts to check against
    const candidates = candidateContractIds 
      ? await this.fetchContractsByIds(candidateContractIds, tenantId)
      : await this.fetchPotentialRelatedContracts(contract, tenantId);

    for (const pattern of REFERENCE_PATTERNS) {
      for (const regex of pattern.patterns) {
        const matches = text.matchAll(regex);
        for (const match of matches) {
          // Try to find referenced contract in candidates
          for (const candidate of candidates) {
            const confidence = this.calculatePatternConfidence(
              match[0],
              contract,
              candidate,
              pattern.confidence
            );

            if (confidence > 0.6) {
              relationships.push({
                sourceContractId: contract.id,
                targetContractId: candidate.id,
                relationshipType: pattern.relationshipType,
                direction: this.inferDirection(pattern.relationshipType),
                confidence,
                evidence: [{
                  type: 'text_reference',
                  description: `Pattern match: ${pattern.relationshipType}`,
                  confidence,
                  sourceText: match[0],
                }],
                detectedAt: new Date(),
                detectedBy: 'pattern',
                status: confidence > 0.9 ? 'auto_confirmed' : 'pending',
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Detect relationships using AI semantic analysis
   */
  private async detectWithAI(
    contract: any,
    candidateContractIds: string[] | undefined,
    tenantId: string
  ): Promise<DetectedRelationship[]> {
    const relationships: DetectedRelationship[] = [];

    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Get candidate contracts
      const candidates = candidateContractIds 
        ? await this.fetchContractsByIds(candidateContractIds, tenantId)
        : await this.fetchPotentialRelatedContracts(contract, tenantId, 20);

      if (candidates.length === 0) {
        return [];
      }

      // Prepare context for AI
      const contractSummary = this.summarizeContract(contract);
      const candidateSummaries = candidates.map(c => ({
        id: c.id,
        summary: this.summarizeContract(c),
      }));

      const prompt = `Analyze this contract and identify relationships with other contracts.

CURRENT CONTRACT:
${contractSummary}

CANDIDATE CONTRACTS:
${candidateSummaries.map(c => `ID: ${c.id}\n${c.summary}`).join('\n---\n')}

Identify any relationships where the current contract is:
1. A Statement of Work (SOW) under a Master Service Agreement (MSA)
2. An Annex/Exhibit/Schedule to a main agreement
3. An Amendment to an original contract
4. A Renewal/Extension of a previous agreement
5. Related to another agreement (same parties, similar terms)

Return JSON array:
[{
  "targetContractId": "id of related contract",
  "relationshipType": "SOW_UNDER_MSA|ANNEX_TO_MAIN|AMENDMENT_TO_ORIGINAL|RENEWAL_OF|RELATED_AGREEMENT",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of the relationship",
  "direction": "parent|child|sibling"
}]`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a contract relationship analyst. Identify connections between contracts accurately.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const result = JSON.parse(content);
      const aiResults = Array.isArray(result) ? result : result.relationships || [];

      for (const r of aiResults) {
        if (r.confidence >= 0.6) {
          relationships.push({
            sourceContractId: contract.id,
            targetContractId: r.targetContractId,
            relationshipType: r.relationshipType,
            direction: r.direction || this.inferDirection(r.relationshipType),
            confidence: r.confidence,
            evidence: [{
              type: 'semantic_similarity',
              description: r.reasoning,
              confidence: r.confidence,
            }],
            detectedAt: new Date(),
            detectedBy: 'ai',
            status: r.confidence > 0.9 ? 'auto_confirmed' : 'pending',
          });
        }
      }
    } catch (error) {
      logger.error({ error, contractId: contract.id }, 'AI relationship detection failed');
    }

    return relationships;
  }

  /**
   * Detect relationships based on entity matching
   */
  private async detectWithEntityMatching(
    contract: any,
    candidateContractIds: string[] | undefined,
    tenantId: string
  ): Promise<DetectedRelationship[]> {
    const relationships: DetectedRelationship[] = [];

    const candidates = candidateContractIds 
      ? await this.fetchContractsByIds(candidateContractIds, tenantId)
      : await this.fetchPotentialRelatedContracts(contract, tenantId, 50);

    for (const candidate of candidates) {
      const evidence: RelationshipEvidence[] = [];
      let confidence = 0;

      // Check party match
      const partyMatch = this.calculatePartyMatch(contract, candidate);
      if (partyMatch.score > 0.8) {
        evidence.push({
          type: 'party_match',
          description: `Shared parties: ${partyMatch.sharedParties.join(', ')}`,
          confidence: partyMatch.score,
        });
        confidence += partyMatch.score * 0.4;
      }

      // Check date correlation
      const dateCorrelation = this.calculateDateCorrelation(contract, candidate);
      if (dateCorrelation.score > 0.7) {
        evidence.push({
          type: 'date_correlation',
          description: dateCorrelation.description,
          confidence: dateCorrelation.score,
        });
        confidence += dateCorrelation.score * 0.3;
      }

      // Check value correlation
      const valueCorrelation = this.calculateValueCorrelation(contract, candidate);
      if (valueCorrelation > 0.8) {
        evidence.push({
          type: 'value_match',
          description: 'Similar contract values',
          confidence: valueCorrelation,
        });
        confidence += valueCorrelation * 0.2;
      }

      if (confidence >= 0.6) {
        const relationshipType = this.inferRelationshipTypeFromEvidence(evidence);
        
        relationships.push({
          sourceContractId: contract.id,
          targetContractId: candidate.id,
          relationshipType,
          direction: 'sibling',
          confidence: Math.min(confidence, 1),
          evidence,
          detectedAt: new Date(),
          detectedBy: 'entity_match',
          status: 'pending',
          metadata: {
            similarityScore: confidence,
            sharedEntities: partyMatch.sharedParties,
            temporalOverlap: dateCorrelation.hasOverlap,
            valueCorrelation,
          },
        });
      }
    }

    return relationships;
  }

  // ==========================================================================
  // RELATIONSHIP GRAPH & NAVIGATION
  // ==========================================================================

  /**
   * Build a relationship graph for visualization
   */
  async buildRelationshipGraph(
    rootContractId: string,
    tenantId: string,
    options: {
      maxDepth?: number;
      includeSiblings?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<RelationshipGraph> {
    const { maxDepth = 2, includeSiblings = true, minConfidence = 0.7 } = options;

    const nodes = new Map<string, ContractNode>();
    const edges: RelationshipEdge[] = [];
    const visited = new Set<string>();
    const queue: { contractId: string; depth: number }[] = [
      { contractId: rootContractId, depth: 0 },
    ];

    // Fetch stored relationships
    const storedRelationships = await prisma.contractRelationship.findMany({
      where: {
        OR: [
          { sourceContractId: rootContractId },
          { targetContractId: rootContractId },
        ],
        tenantId,
        confidence: { gte: minConfidence },
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
      include: {
        sourceContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            startDate: true,
            endDate: true,
            totalValue: true,
          },
        },
        targetContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            startDate: true,
            endDate: true,
            totalValue: true,
          },
        },
      },
    });

    // Build graph from stored relationships
    for (const rel of storedRelationships) {
      // Add nodes
      if (!nodes.has(rel.sourceContractId)) {
        nodes.set(rel.sourceContractId, this.toContractNode(rel.sourceContract));
      }
      if (!nodes.has(rel.targetContractId)) {
        nodes.set(rel.targetContractId, this.toContractNode(rel.targetContract));
      }

      // Add edge
      edges.push({
        id: rel.id,
        source: rel.sourceContractId,
        target: rel.targetContractId,
        type: rel.relationshipType as RelationshipType,
        confidence: rel.confidence,
        direction: rel.direction as RelationshipDirection,
        label: this.getRelationshipLabel(rel.relationshipType as RelationshipType),
      });
    }

    // Identify clusters
    const clusters = this.identifyClusters(Array.from(nodes.values()), edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
      clusters,
    };
  }

  /**
   * Get navigation suggestions for seamless contract navigation
   */
  async getNavigationSuggestions(
    contractId: string,
    tenantId: string
  ): Promise<NavigationSuggestion[]> {
    const suggestions: NavigationSuggestion[] = [];

    // Get confirmed relationships
    const relationships = await prisma.contractRelationship.findMany({
      where: {
        OR: [
          { sourceContractId: contractId },
          { targetContractId: contractId },
        ],
        tenantId,
        status: { in: ['confirmed', 'auto_confirmed'] },
        confidence: { gte: 0.8 },
      },
      include: {
        sourceContract: { select: { id: true, contractTitle: true } },
        targetContract: { select: { id: true, contractTitle: true } },
      },
      orderBy: { confidence: 'desc' },
      take: 5,
    });

    for (const rel of relationships) {
      const isSource = rel.sourceContractId === contractId;
      const relatedContract = isSource ? rel.targetContract : rel.sourceContract;
      
      let reason = '';
      let priority: 'high' | 'medium' | 'low' = 'medium';

      switch (rel.relationshipType) {
        case 'SOW_UNDER_MSA':
          reason = isSource 
            ? 'This SOW is governed by the Master Agreement'
            : 'View SOWs under this Master Agreement';
          priority = 'high';
          break;
        case 'AMENDMENT_TO_ORIGINAL':
          reason = isSource
            ? 'View the original agreement this amends'
            : 'View amendments to this agreement';
          priority = 'high';
          break;
        case 'RENEWAL_OF':
          reason = isSource
            ? 'View the previous term of this renewal'
            : 'View the renewal of this agreement';
          priority = 'high';
          break;
        case 'ANNEX_TO_MAIN':
          reason = 'View the main agreement this is attached to';
          priority = 'medium';
          break;
        default:
          reason = 'Related agreement';
          priority = 'low';
      }

      suggestions.push({
        fromContractId: contractId,
        suggestedContractId: relatedContract.id,
        reason,
        relationshipType: rel.relationshipType as RelationshipType,
        priority,
      });
    }

    return suggestions.sort((a, b) => 
      a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0
    );
  }

  /**
   * Find contract families (MSA + all related SOWs/Annexes)
   */
  async findContractFamily(
    contractId: string,
    tenantId: string
  ): Promise<{
    rootContract: ContractNode;
    children: ContractNode[];
    siblings: ContractNode[];
    totalValue: number;
    coveragePeriod: { start: Date; end: Date };
  }> {
    // First, determine if this is a parent or child
    const relationships = await prisma.contractRelationship.findMany({
      where: {
        OR: [
          { sourceContractId: contractId },
          { targetContractId: contractId },
        ],
        tenantId,
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
      include: {
        sourceContract: true,
        targetContract: true,
      },
    });

    let rootContractId = contractId;
    const children: ContractNode[] = [];
    const siblings: ContractNode[] = [];

    // Find the root (if this is a child, find the parent)
    for (const rel of relationships) {
      if (rel.direction === 'parent') {
        if (rel.targetContractId === contractId) {
          // This contract is a child, the source is the parent
          rootContractId = rel.sourceContractId;
        }
      }
    }

    // Now fetch the full family
    const root = await prisma.contract.findUnique({
      where: { id: rootContractId },
      select: {
        id: true,
        contractTitle: true,
        contractType: true,
        supplierName: true,
        startDate: true,
        endDate: true,
        totalValue: true,
      },
    });

    if (!root) {
      throw new Error('Root contract not found');
    }

    // Get all family relationships
    const familyRelationships = await prisma.contractRelationship.findMany({
      where: {
        OR: [
          { sourceContractId: rootContractId },
          { targetContractId: rootContractId },
        ],
        tenantId,
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
      include: {
        sourceContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            startDate: true,
            endDate: true,
            totalValue: true,
          },
        },
        targetContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            supplierName: true,
            startDate: true,
            endDate: true,
            totalValue: true,
          },
        },
      },
    });

    let totalValue = Number(root.totalValue || 0);
    let earliestStart = root.startDate;
    let latestEnd = root.endDate;

    for (const rel of familyRelationships) {
      const isSource = rel.sourceContractId === rootContractId;
      const related = isSource ? rel.targetContract : rel.sourceContract;
      
      if (rel.direction === 'child' || 
          rel.relationshipType === 'SOW_UNDER_MSA' ||
          rel.relationshipType === 'ANNEX_TO_MAIN') {
        children.push(this.toContractNode(related));
        totalValue += Number(related.totalValue || 0);
      } else {
        siblings.push(this.toContractNode(related));
      }

      // Update date ranges
      if (related.startDate && (!earliestStart || related.startDate < earliestStart)) {
        earliestStart = related.startDate;
      }
      if (related.endDate && (!latestEnd || related.endDate > latestEnd)) {
        latestEnd = related.endDate;
      }
    }

    return {
      rootContract: this.toContractNode(root),
      children,
      siblings,
      totalValue,
      coveragePeriod: {
        start: earliestStart || new Date(),
        end: latestEnd || new Date(),
      },
    };
  }

  // ==========================================================================
  // STORAGE & PERSISTENCE
  // ==========================================================================

  /**
   * Store detected relationships in the database
   */
  async storeRelationships(
    relationships: DetectedRelationship[],
    tenantId: string
  ): Promise<void> {
    for (const rel of relationships) {
      try {
        await prisma.contractRelationship.upsert({
          where: {
            sourceContractId_targetContractId_relationshipType: {
              sourceContractId: rel.sourceContractId,
              targetContractId: rel.targetContractId,
              relationshipType: rel.relationshipType,
            },
          },
          update: {
            confidence: rel.confidence,
            evidence: rel.evidence as any,
            status: rel.status,
            detectedBy: rel.detectedBy,
            metadata: rel.metadata as any,
            updatedAt: new Date(),
          },
          create: {
            tenantId,
            sourceContractId: rel.sourceContractId,
            targetContractId: rel.targetContractId,
            relationshipType: rel.relationshipType,
            direction: rel.direction,
            confidence: rel.confidence,
            evidence: rel.evidence as any,
            detectedBy: rel.detectedBy,
            status: rel.status,
            metadata: rel.metadata as any,
          },
        });
      } catch (error) {
        logger.error({ error, rel }, 'Failed to store relationship');
      }
    }
  }

  /**
   * Confirm or reject a pending relationship
   */
  async updateRelationshipStatus(
    relationshipId: string,
    status: 'confirmed' | 'rejected',
    userId?: string
  ): Promise<void> {
    await prisma.contractRelationship.update({
      where: { id: relationshipId },
      data: {
        status,
        confirmedBy: status === 'confirmed' ? userId : undefined,
        confirmedAt: status === 'confirmed' ? new Date() : undefined,
      },
    });
  }

  // ==========================================================================
  // BATCH OPERATIONS
  // ==========================================================================

  /**
   * Run relationship detection across all contracts in a tenant
   */
  async runBatchDetection(
    tenantId: string,
    options: {
      contractIds?: string[];
      maxContracts?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<{
    totalProcessed: number;
    relationshipsDetected: number;
    autoConfirmed: number;
    pendingReview: number;
  }> {
    const { contractIds, maxContracts = 100, onProgress } = options;

    const contracts = contractIds
      ? await this.fetchContractsByIds(contractIds, tenantId)
      : await prisma.contract.findMany({
          where: { tenantId, isDeleted: false },
          take: maxContracts,
          select: { id: true },
        });

    let totalDetected = 0;
    let autoConfirmed = 0;
    let pendingReview = 0;

    for (let i = 0; i < contracts.length; i++) {
      const contract = contracts[i];
      
      try {
        const relationships = await this.detectRelationships(contract.id, tenantId, {
          useAI: true,
          usePatterns: true,
          useEntityMatching: true,
        });

        await this.storeRelationships(relationships, tenantId);

        totalDetected += relationships.length;
        autoConfirmed += relationships.filter(r => r.status === 'auto_confirmed').length;
        pendingReview += relationships.filter(r => r.status === 'pending').length;

        onProgress?.(i + 1, contracts.length);
      } catch (error) {
        logger.error({ error, contractId: contract.id }, 'Batch detection failed for contract');
      }
    }

    return {
      totalProcessed: contracts.length,
      relationshipsDetected: totalDetected,
      autoConfirmed,
      pendingReview,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async fetchContractWithArtifacts(contractId: string, tenantId: string) {
    return prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        contractArtifacts: true,
      },
    });
  }

  private async fetchContractsByIds(ids: string[], tenantId: string) {
    return prisma.contract.findMany({
      where: { id: { in: ids }, tenantId, isDeleted: false },
    });
  }

  private async fetchPotentialRelatedContracts(
    contract: any,
    tenantId: string,
    limit: number = 50
  ) {
    // Fetch contracts with same party or overlapping dates
    return prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        id: { not: contract.id },
        OR: [
          { supplierId: contract.supplierId },
          { clientId: contract.clientId },
          { supplierName: contract.supplierName },
        ],
      },
      take: limit,
    });
  }

  private calculatePatternConfidence(
    matchText: string,
    sourceContract: any,
    targetContract: any,
    baseConfidence: number
  ): number {
    let confidence = baseConfidence;

    // Boost confidence if parties match
    if (sourceContract.supplierId && sourceContract.supplierId === targetContract.supplierId) {
      confidence += 0.05;
    }
    if (sourceContract.clientId && sourceContract.clientId === targetContract.clientId) {
      confidence += 0.05;
    }

    // Boost if target is an MSA and source is an SOW
    if (targetContract.contractType?.toLowerCase().includes('master') &&
        sourceContract.contractType?.toLowerCase().includes('work')) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1);
  }

  private calculatePartyMatch(contractA: any, contractB: any): {
    score: number;
    sharedParties: string[];
  } {
    const partiesA = new Set([
      contractA.supplierId,
      contractA.clientId,
      contractA.supplierName?.toLowerCase(),
      contractA.clientName?.toLowerCase(),
    ].filter(Boolean));

    const partiesB = [
      contractB.supplierId,
      contractB.clientId,
      contractB.supplierName?.toLowerCase(),
      contractB.clientName?.toLowerCase(),
    ].filter(Boolean);

    const shared = partiesB.filter(p => partiesA.has(p));
    const total = new Set([...partiesA, ...partiesB]).size;

    return {
      score: total > 0 ? shared.length / total : 0,
      sharedParties: shared as string[],
    };
  }

  private calculateDateCorrelation(contractA: any, contractB: any): {
    score: number;
    description: string;
    hasOverlap: boolean;
  } {
    const startA = contractA.startDate;
    const endA = contractA.endDate;
    const startB = contractB.startDate;
    const endB = contractB.endDate;

    if (!startA || !startB) {
      return { score: 0, description: 'Missing dates', hasOverlap: false };
    }

    // Check for temporal sequence (one starts when other ends)
    if (endA && startB) {
      const gap = startB.getTime() - endA.getTime();
      const daysGap = gap / (1000 * 60 * 60 * 24);
      
      if (daysGap >= -30 && daysGap <= 30) {
        return {
          score: 0.9,
          description: `Sequential: ${daysGap > 0 ? daysGap + ' days gap' : 'overlapping'}`,
          hasOverlap: daysGap < 0,
        };
      }
    }

    // Check for overlap
    if (endA && endB && startA <= endB && startB <= endA) {
      return {
        score: 0.7,
        description: 'Concurrent contracts',
        hasOverlap: true,
      };
    }

    return { score: 0, description: 'No date correlation', hasOverlap: false };
  }

  private calculateValueCorrelation(contractA: any, contractB: any): number {
    const valueA = Number(contractA.totalValue || 0);
    const valueB = Number(contractB.totalValue || 0);

    if (valueA === 0 || valueB === 0) return 0;

    const ratio = Math.min(valueA, valueB) / Math.max(valueA, valueB);
    return ratio;
  }

  private inferDirection(relationshipType: RelationshipType): RelationshipDirection {
    switch (relationshipType) {
      case 'SOW_UNDER_MSA':
      case 'ANNEX_TO_MAIN':
      case 'EXHIBIT_TO_MAIN':
      case 'AMENDMENT_TO_ORIGINAL':
      case 'ADDENDUM_TO_ORIGINAL':
        return 'parent'; // Source is child, target is parent
      case 'RENEWAL_OF':
        return 'parent'; // Source is renewal, target is original
      case 'MASTER_TO_SUB':
        return 'parent'; // Source is master, target is sub
      case 'SUPERSEDES':
        return 'parent'; // Source supersedes target
      case 'RELATED_AGREEMENT':
      case 'SAME_PARTY_BUNDLE':
      case 'TEMPORAL_SEQUENCE':
        return 'sibling';
      default:
        return 'bidirectional';
    }
  }

  private inferRelationshipTypeFromEvidence(evidence: RelationshipEvidence[]): RelationshipType {
    const types = evidence.map(e => e.type);
    
    if (types.includes('date_correlation')) {
      return 'TEMPORAL_SEQUENCE';
    }
    
    return 'RELATED_AGREEMENT';
  }

  private deduplicateRelationships(relationships: DetectedRelationship[]): DetectedRelationship[] {
    const seen = new Map<string, DetectedRelationship>();

    for (const rel of relationships) {
      const key = `${rel.sourceContractId}-${rel.targetContractId}-${rel.relationshipType}`;
      const existing = seen.get(key);

      if (!existing || rel.confidence > existing.confidence) {
        seen.set(key, rel);
      }
    }

    return Array.from(seen.values());
  }

  private processDetectedRelationships(relationships: DetectedRelationship[]): DetectedRelationship[] {
    return relationships.map(rel => {
      // Auto-confirm very high confidence relationships
      if (rel.confidence >= 0.95 && rel.detectedBy === 'pattern') {
        rel.status = 'auto_confirmed';
      }
      return rel;
    });
  }

  private summarizeContract(contract: any): string {
    return `
Title: ${contract.contractTitle || contract.fileName}
Type: ${contract.contractType || 'Unknown'}
Parties: ${contract.clientName || 'N/A'} ↔ ${contract.supplierName || 'N/A'}
Period: ${contract.startDate?.toISOString().split('T')[0] || 'N/A'} to ${contract.endDate?.toISOString().split('T')[0] || 'N/A'}
Value: ${contract.totalValue ? '$' + contract.totalValue : 'N/A'}
`.trim();
  }

  private toContractNode(contract: any): ContractNode {
    return {
      id: contract.id,
      title: contract.contractTitle || contract.fileName || 'Untitled',
      type: contract.contractType || 'Unknown',
      party: contract.supplierName,
      startDate: contract.startDate,
      endDate: contract.endDate,
      value: contract.totalValue ? Number(contract.totalValue) : undefined,
    };
  }

  private identifyClusters(nodes: ContractNode[], edges: RelationshipEdge[]): ContractCluster[] {
    const clusters: ContractCluster[] = [];
    const visited = new Set<string>();

    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      // Find all connected nodes
      const clusterNodes = new Set<string>([node.id]);
      const queue = [node.id];

      while (queue.length > 0) {
        const current = queue.shift()!;
        
        for (const edge of edges) {
          if (edge.source === current && !clusterNodes.has(edge.target)) {
            clusterNodes.add(edge.target);
            queue.push(edge.target);
          }
          if (edge.target === current && !clusterNodes.has(edge.source)) {
            clusterNodes.add(edge.source);
            queue.push(edge.source);
          }
        }
      }

      if (clusterNodes.size > 1) {
        const contractIds = Array.from(clusterNodes);
        const typeCounts = new Map<RelationshipType, number>();
        
        for (const edge of edges) {
          if (clusterNodes.has(edge.source) && clusterNodes.has(edge.target)) {
            typeCounts.set(edge.type, (typeCounts.get(edge.type) || 0) + 1);
          }
        }

        const dominantType = Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'RELATED_AGREEMENT';

        clusters.push({
          id: `cluster-${clusters.length}`,
          name: `Contract Family ${clusters.length + 1}`,
          contractIds,
          dominantType,
        });

        contractIds.forEach(id => visited.add(id));
      }
    }

    return clusters;
  }

  private getRelationshipLabel(type: RelationshipType): string {
    const labels: Record<RelationshipType, string> = {
      SOW_UNDER_MSA: 'SOW under MSA',
      ANNEX_TO_MAIN: 'Annex',
      EXHIBIT_TO_MAIN: 'Exhibit',
      AMENDMENT_TO_ORIGINAL: 'Amendment',
      ADDENDUM_TO_ORIGINAL: 'Addendum',
      RENEWAL_OF: 'Renewal',
      MASTER_TO_SUB: 'Master → Sub',
      RELATED_AGREEMENT: 'Related',
      SUPERSEDES: 'Supersedes',
      CONFLICTS_WITH: 'Conflicts',
      SAME_PARTY_BUNDLE: 'Same Party',
      TEMPORAL_SEQUENCE: 'Sequence',
    };
    return labels[type] || type;
  }
}

// Export singleton
export const relationshipDetectionService = RelationshipDetectionService.getInstance();
export { RelationshipDetectionService };

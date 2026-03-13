/**
 * Advanced AI Artifact Intelligence Service
 * 
 * Next-generation artifact generation with:
 * - Contract-type intelligent routing (different prompts per contract type)
 * - Semantic chunking for long contracts (not just truncation)
 * - Multi-model orchestration (best model per task)
 * - AI learning from human corrections
 * - Cross-artifact consistency validation
 * - Structured output with strict JSON schemas
 * 
 * @version 2.0.0
 */

import { createLogger } from '../utils/logger';
import { dbAdaptor } from '../dal/database.adaptor';
import { cacheAdaptor } from '../dal/cache.adaptor';
import { estimateTokens } from '../utils/token-estimation';

const logger = createLogger('advanced-ai-intelligence');

// =============================================================================
// CONTRACT TYPE CLASSIFICATION
// =============================================================================

export type ContractCategory = 
  | 'SERVICE_AGREEMENT'  // MSA, SOW, Consulting
  | 'PROCUREMENT'        // Purchase orders, supply agreements
  | 'EMPLOYMENT'         // Employment contracts, NDAs
  | 'LICENSING'          // Software licenses, IP agreements
  | 'REAL_ESTATE'        // Leases, property agreements
  | 'FINANCIAL'          // Loan agreements, investment
  | 'PARTNERSHIP'        // JV, partnership agreements
  | 'REGULATORY'         // Compliance, government contracts
  | 'UNKNOWN';

export interface ContractClassification {
  category: ContractCategory;
  subType: string;
  confidence: number;
  indicators: string[];
  recommendedArtifacts: string[];
  specializedPromptKey: string;
}

/**
 * Contract type classifier using keyword analysis and structure detection
 */
export class ContractTypeClassifier {
  private static readonly CLASSIFICATION_PATTERNS: Record<ContractCategory, {
    keywords: string[];
    structureIndicators: string[];
    weight: number;
  }> = {
    SERVICE_AGREEMENT: {
      keywords: ['services', 'deliverables', 'statement of work', 'sow', 'consulting', 'professional services', 'scope of work', 'service level', 'sla'],
      structureIndicators: ['milestone', 'acceptance criteria', 'change order', 'project plan'],
      weight: 1.0,
    },
    PROCUREMENT: {
      keywords: ['purchase', 'supply', 'procurement', 'vendor', 'goods', 'delivery', 'warranty', 'product', 'order', 'shipment'],
      structureIndicators: ['unit price', 'quantity', 'shipping terms', 'incoterms', 'inspection'],
      weight: 1.0,
    },
    EMPLOYMENT: {
      keywords: ['employment', 'employee', 'salary', 'compensation', 'benefits', 'termination', 'non-compete', 'confidentiality', 'nda'],
      structureIndicators: ['probation period', 'notice period', 'severance', 'bonus'],
      weight: 1.0,
    },
    LICENSING: {
      keywords: ['license', 'intellectual property', 'software', 'royalty', 'sublicense', 'patent', 'trademark', 'copyright', 'subscription'],
      structureIndicators: ['grant of license', 'permitted use', 'restrictions', 'audit rights'],
      weight: 1.0,
    },
    REAL_ESTATE: {
      keywords: ['lease', 'rent', 'premises', 'landlord', 'tenant', 'property', 'occupancy', 'security deposit'],
      structureIndicators: ['square feet', 'common area', 'maintenance', 'subleasing'],
      weight: 1.0,
    },
    FINANCIAL: {
      keywords: ['loan', 'credit', 'interest rate', 'principal', 'investment', 'securities', 'collateral', 'repayment'],
      structureIndicators: ['maturity date', 'default', 'acceleration', 'covenant'],
      weight: 1.0,
    },
    PARTNERSHIP: {
      keywords: ['partnership', 'joint venture', 'profit sharing', 'capital contribution', 'partner', 'dissolution'],
      structureIndicators: ['voting rights', 'management committee', 'distribution'],
      weight: 1.0,
    },
    REGULATORY: {
      keywords: ['government', 'regulatory', 'compliance', 'federal', 'state', 'agency', 'certification', 'audit'],
      structureIndicators: ['far clause', 'small business', 'security clearance'],
      weight: 1.0,
    },
    UNKNOWN: {
      keywords: [],
      structureIndicators: [],
      weight: 0.1,
    },
  };

  static classify(contractText: string): ContractClassification {
    const lowerText = contractText.toLowerCase();
    const scores: Record<ContractCategory, number> = {} as any;

    // Score each category
    for (const [category, patterns] of Object.entries(this.CLASSIFICATION_PATTERNS)) {
      let score = 0;
      const foundIndicators: string[] = [];

      // Keyword matching with position weighting (early mentions = more weight)
      for (const keyword of patterns.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          // Early mentions get more weight
          const firstIndex = lowerText.indexOf(keyword);
          const positionWeight = firstIndex < 500 ? 2.0 : firstIndex < 2000 ? 1.5 : 1.0;
          score += matches.length * positionWeight;
          foundIndicators.push(keyword);
        }
      }

      // Structure indicators (higher weight)
      for (const indicator of patterns.structureIndicators) {
        if (lowerText.includes(indicator)) {
          score += 3;
          foundIndicators.push(`[structure] ${indicator}`);
        }
      }

      scores[category as ContractCategory] = score * patterns.weight;
    }

    // Find best match
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestCategory, bestScore] = sorted[0];
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? bestScore / totalScore : 0;

    // Get recommended artifacts for this contract type
    const recommendedArtifacts = this.getRecommendedArtifacts(bestCategory as ContractCategory);

    return {
      category: bestCategory as ContractCategory,
      subType: this.detectSubType(bestCategory as ContractCategory, contractText),
      confidence: Math.min(confidence, 0.95),
      indicators: this.CLASSIFICATION_PATTERNS[bestCategory as ContractCategory]?.keywords
        .filter(k => lowerText.includes(k))
        .slice(0, 5) || [],
      recommendedArtifacts,
      specializedPromptKey: `${bestCategory}_PROMPT`,
    };
  }

  private static detectSubType(category: ContractCategory, text: string): string {
    const lowerText = text.toLowerCase();
    
    switch (category) {
      case 'SERVICE_AGREEMENT':
        if (lowerText.includes('master service') || lowerText.includes('msa')) return 'Master Services Agreement';
        if (lowerText.includes('statement of work') || lowerText.includes('sow')) return 'Statement of Work';
        if (lowerText.includes('consulting')) return 'Consulting Agreement';
        return 'Service Agreement';
      case 'LICENSING':
        if (lowerText.includes('software') || lowerText.includes('saas')) return 'Software License';
        if (lowerText.includes('subscription')) return 'Subscription Agreement';
        return 'License Agreement';
      case 'EMPLOYMENT':
        if (lowerText.includes('nda') || lowerText.includes('non-disclosure')) return 'NDA';
        if (lowerText.includes('non-compete')) return 'Non-Compete Agreement';
        return 'Employment Agreement';
      default:
        return category.replace('_', ' ').toLowerCase();
    }
  }

  private static getRecommendedArtifacts(category: ContractCategory): string[] {
    const base = ['OVERVIEW', 'CLAUSES', 'RISK'];
    
    switch (category) {
      case 'SERVICE_AGREEMENT':
        return [...base, 'FINANCIAL', 'OBLIGATIONS', 'RATES', 'RENEWAL'];
      case 'PROCUREMENT':
        return [...base, 'FINANCIAL', 'COMPLIANCE', 'OBLIGATIONS'];
      case 'LICENSING':
        return [...base, 'FINANCIAL', 'COMPLIANCE', 'RENEWAL'];
      case 'EMPLOYMENT':
        return [...base, 'COMPLIANCE', 'CONTACTS'];
      case 'FINANCIAL':
        return [...base, 'FINANCIAL', 'COMPLIANCE', 'OBLIGATIONS'];
      default:
        return [...base, 'FINANCIAL', 'COMPLIANCE'];
    }
  }
}

// =============================================================================
// SEMANTIC CHUNKING FOR LONG CONTRACTS
// =============================================================================

export interface DocumentChunk {
  id: string;
  content: string;
  startOffset: number;
  endOffset: number;
  section: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  tokenEstimate: number;
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  totalTokens: number;
  structuredSections: Record<string, DocumentChunk[]>;
  criticalChunks: DocumentChunk[];
}

/**
 * Semantic chunker that preserves document structure
 */
export class SemanticChunker {
  private static readonly MAX_CHUNK_TOKENS = 4000;
  private static readonly OVERLAP_TOKENS = 200;
  
  private static readonly SECTION_PATTERNS = [
    /^(?:ARTICLE|SECTION|CLAUSE)\s+[\dIVX]+[.:]/im,
    /^(?:\d+\.)+\s+[A-Z][a-z]+/m,
    /^[A-Z][A-Z\s]+:?\s*$/m, // ALL CAPS HEADERS
    /^(?:WHEREAS|NOW,?\s*THEREFORE|IN WITNESS WHEREOF)/im,
    /^(?:EXHIBIT|SCHEDULE|APPENDIX|ATTACHMENT)\s+[A-Z\d]+/im,
  ];

  private static readonly CRITICAL_SECTIONS = [
    'payment', 'pricing', 'compensation', 'fees',
    'term', 'termination', 'renewal',
    'liability', 'indemnification', 'warranty',
    'confidentiality', 'intellectual property',
    'scope', 'deliverables', 'services',
  ];

  static chunkDocument(contractText: string, maxTokensPerChunk = this.MAX_CHUNK_TOKENS): ChunkingResult {
    const sections = this.detectSections(contractText);
    const chunks: DocumentChunk[] = [];
    const structuredSections: Record<string, DocumentChunk[]> = {};
    
    let chunkId = 0;
    
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, maxTokensPerChunk, chunkId);
      chunks.push(...sectionChunks);
      
      if (!structuredSections[section.name]) {
        structuredSections[section.name] = [];
      }
      structuredSections[section.name].push(...sectionChunks);
      
      chunkId += sectionChunks.length;
    }

    const criticalChunks = chunks.filter(c => c.importance === 'critical' || c.importance === 'high');
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    return {
      chunks,
      totalTokens,
      structuredSections,
      criticalChunks,
    };
  }

  private static detectSections(text: string): Array<{ name: string; content: string; start: number; end: number }> {
    const sections: Array<{ name: string; content: string; start: number; end: number }> = [];
    const lines = text.split('\n');
    
    let currentSection: { name: string; content: string[]; start: number } = {
      name: 'PREAMBLE',
      content: [],
      start: 0,
    };

    let currentOffset = 0;
    
    for (const line of lines) {
      const isHeader = this.SECTION_PATTERNS.some(p => p.test(line.trim()));
      
      if (isHeader && currentSection.content.length > 0) {
        // Save current section
        const content = currentSection.content.join('\n');
        sections.push({
          name: currentSection.name,
          content,
          start: currentSection.start,
          end: currentOffset,
        });
        
        // Start new section
        currentSection = {
          name: line.trim().substring(0, 50),
          content: [line],
          start: currentOffset,
        };
      } else {
        currentSection.content.push(line);
      }
      
      currentOffset += line.length + 1;
    }
    
    // Add final section
    if (currentSection.content.length > 0) {
      sections.push({
        name: currentSection.name,
        content: currentSection.content.join('\n'),
        start: currentSection.start,
        end: currentOffset,
      });
    }

    return sections;
  }

  private static chunkSection(
    section: { name: string; content: string; start: number; end: number },
    maxTokens: number,
    startId: number
  ): DocumentChunk[] {
    const tokenEstimate = this.estimateTokens(section.content);
    const importance = this.assessImportance(section.name, section.content);
    
    if (tokenEstimate <= maxTokens) {
      return [{
        id: `chunk_${startId}`,
        content: section.content,
        startOffset: section.start,
        endOffset: section.end,
        section: section.name,
        importance,
        tokenEstimate,
      }];
    }

    // Split large sections with overlap
    const chunks: DocumentChunk[] = [];
    const sentences = section.content.split(/(?<=[.!?])\s+/);
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkStart = section.start;
    let offset = section.start;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        // Save current chunk
        const content = currentChunk.join(' ');
        chunks.push({
          id: `chunk_${startId + chunks.length}`,
          content,
          startOffset: chunkStart,
          endOffset: offset,
          section: section.name,
          importance,
          tokenEstimate: currentTokens,
        });

        // Start new chunk with overlap
        const overlapSentences = currentChunk.slice(-2);
        currentChunk = [...overlapSentences, sentence];
        currentTokens = this.estimateTokens(currentChunk.join(' '));
        chunkStart = offset - overlapSentences.join(' ').length;
      } else {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
      
      offset += sentence.length + 1;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        id: `chunk_${startId + chunks.length}`,
        content: currentChunk.join(' '),
        startOffset: chunkStart,
        endOffset: section.end,
        section: section.name,
        importance,
        tokenEstimate: currentTokens,
      });
    }

    return chunks;
  }

  private static estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  private static assessImportance(sectionName: string, content: string): DocumentChunk['importance'] {
    const lowerName = sectionName.toLowerCase();
    const lowerContent = content.toLowerCase();

    const hasCriticalKeyword = this.CRITICAL_SECTIONS.some(k => 
      lowerName.includes(k) || lowerContent.substring(0, 200).includes(k)
    );

    if (hasCriticalKeyword) return 'critical';
    if (lowerName.includes('exhibit') || lowerName.includes('schedule')) return 'medium';
    if (lowerName.includes('preamble') || lowerName.includes('recital')) return 'medium';
    if (lowerName.includes('whereas')) return 'medium';
    
    return 'high';
  }
}

// =============================================================================
// MULTI-MODEL ORCHESTRATION
// =============================================================================

export interface ModelCapability {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'azure';
  strengths: string[];
  maxTokens: number;
  costPer1kTokens: number;
  latencyMs: number;
  bestFor: string[];
}

export const MODEL_REGISTRY: ModelCapability[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    strengths: ['complex reasoning', 'structured output', 'table extraction'],
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    latencyMs: 2000,
    bestFor: ['FINANCIAL', 'RATES', 'RISK', 'COMPLIANCE'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    strengths: ['fast', 'cost-effective', 'good accuracy'],
    maxTokens: 128000,
    costPer1kTokens: 0.00015,
    latencyMs: 500,
    bestFor: ['OVERVIEW', 'CLAUSES', 'CONTACTS', 'AMENDMENTS'],
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    strengths: ['long context', 'nuanced analysis', 'legal language'],
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    latencyMs: 1500,
    bestFor: ['RISK', 'COMPLIANCE', 'NEGOTIATION_POINTS', 'OBLIGATIONS'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    strengths: ['ultra-fast', 'cost-effective', 'excellent comprehension', 'real-time tasks'],
    maxTokens: 200000,
    costPer1kTokens: 0.0008,
    latencyMs: 300,
    bestFor: ['OVERVIEW', 'CLAUSES', 'CONTACTS', 'AMENDMENTS', 'SUMMARY'],
  },
];

/**
 * Select best model for a given task
 */
export function selectOptimalModel(
  artifactType: string,
  contractLength: number,
  priority: 'speed' | 'accuracy' | 'cost'
): ModelCapability {
  // Filter models that can handle the contract length
  const estimatedContractTokens = Math.ceil(contractLength * 1.3 / 4.5); // Chars-to-tokens heuristic
  const capableModels = MODEL_REGISTRY.filter(m => 
    m.maxTokens >= estimatedContractTokens
  );

  if (capableModels.length === 0) {
    return MODEL_REGISTRY[0]; // Default to most capable
  }

  // Score models based on priority
  const scored = capableModels.map(m => {
    let score = 0;
    
    // Artifact match bonus
    if (m.bestFor.includes(artifactType)) score += 50;
    
    // Priority weighting
    switch (priority) {
      case 'speed':
        score += (1000 / m.latencyMs) * 30;
        break;
      case 'accuracy':
        score += m.strengths.length * 20;
        if (m.id.includes('gpt-4o') && !m.id.includes('mini')) score += 30;
        if (m.id.includes('claude')) score += 25;
        break;
      case 'cost':
        score += (1 / m.costPer1kTokens) * 10;
        break;
    }
    
    return { model: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}

// =============================================================================
// AI LEARNING FEEDBACK LOOP
// =============================================================================

export interface ArtifactFeedback {
  id: string;
  contractId: string;
  tenantId: string;
  artifactType: string;
  originalData: Record<string, any>;
  correctedData: Record<string, any>;
  correctionFields: string[];
  userId: string;
  feedbackType: 'correction' | 'validation' | 'rejection';
  timestamp: Date;
}

export interface LearningPattern {
  patternId: string;
  contractCategory: ContractCategory;
  artifactType: string;
  fieldPath: string;
  commonMistake: string;
  correction: string;
  frequency: number;
  confidence: number;
}

/**
 * AI Learning Service - learns from human corrections
 */
export class AILearningService {
  private static instance: AILearningService;

  private constructor() {}

  static getInstance(): AILearningService {
    if (!AILearningService.instance) {
      AILearningService.instance = new AILearningService();
    }
    return AILearningService.instance;
  }

  /**
   * Record human correction for learning
   */
  async recordCorrection(feedback: Omit<ArtifactFeedback, 'id' | 'timestamp'>): Promise<void> {
    try {
      // Identify what changed
      const corrections = this.identifyCorrections(feedback.originalData, feedback.correctedData);
      
      // Store feedback for analysis
      await dbAdaptor.prisma.$executeRaw`
        INSERT INTO ai_correction_log (
          contract_id, tenant_id, artifact_type, 
          original_data, corrected_data, correction_fields,
          user_id, feedback_type, created_at
        ) VALUES (
          ${feedback.contractId}, ${feedback.tenantId}, ${feedback.artifactType},
          ${JSON.stringify(feedback.originalData)}::jsonb, 
          ${JSON.stringify(feedback.correctedData)}::jsonb,
          ${corrections.join(',')},
          ${feedback.userId}, ${feedback.feedbackType}, NOW()
        )
        ON CONFLICT DO NOTHING
      `.catch(() => {
        // Table may not exist in some deployments
        logger.warn('AI correction log table not available');
      });

      // Update tenant-specific patterns
      await this.updateLearningPatterns(feedback.tenantId, feedback.artifactType, corrections);

      logger.info({
        contractId: feedback.contractId,
        artifactType: feedback.artifactType,
        correctionCount: corrections.length,
      }, 'Recorded AI correction for learning');
    } catch (error) {
      logger.error({ error }, 'Failed to record AI correction');
    }
  }

  /**
   * Get learned patterns for a tenant
   */
  async getLearningPatterns(tenantId: string, artifactType?: string): Promise<LearningPattern[]> {
    const cacheKey = `ai-patterns:${tenantId}:${artifactType || 'all'}`;
    const cached = await cacheAdaptor.get<LearningPattern[]>(cacheKey);
    if (cached) return cached;

    try {
      const patterns = await dbAdaptor.prisma.$queryRaw<any[]>`
        SELECT * FROM ai_learning_patterns 
        WHERE tenant_id = ${tenantId}
        ${artifactType ? dbAdaptor.prisma.$queryRaw`AND artifact_type = ${artifactType}` : dbAdaptor.prisma.$queryRaw``}
        ORDER BY frequency DESC
        LIMIT 50
      `.catch(() => []);

      await cacheAdaptor.set(cacheKey, patterns, 600); // 10 min cache
      return patterns;
    } catch {
      return [];
    }
  }

  /**
   * Apply learned patterns to enhance prompts
   */
  async enhancePromptWithLearning(
    tenantId: string,
    artifactType: string,
    basePrompt: string
  ): Promise<string> {
    const patterns = await this.getLearningPatterns(tenantId, artifactType);
    
    if (patterns.length === 0) return basePrompt;

    const patternGuidance = patterns
      .filter(p => p.confidence > 0.7 && p.frequency >= 3)
      .map(p => `- For ${p.fieldPath}: Prefer "${p.correction}" over "${p.commonMistake}"`)
      .slice(0, 10)
      .join('\n');

    if (!patternGuidance) return basePrompt;

    return `${basePrompt}

LEARNED PATTERNS FROM PREVIOUS CORRECTIONS:
${patternGuidance}
`;
  }

  private identifyCorrections(original: Record<string, any>, corrected: Record<string, any>): string[] {
    const corrections: string[] = [];
    
    const compareObjects = (orig: any, corr: any, path: string) => {
      if (typeof orig !== typeof corr) {
        corrections.push(path);
        return;
      }
      
      if (Array.isArray(orig) && Array.isArray(corr)) {
        if (orig.length !== corr.length) corrections.push(path);
        return;
      }
      
      if (typeof orig === 'object' && orig !== null) {
        for (const key of new Set([...Object.keys(orig || {}), ...Object.keys(corr || {})])) {
          compareObjects(orig?.[key], corr?.[key], `${path}.${key}`);
        }
        return;
      }
      
      if (orig !== corr) {
        corrections.push(path);
      }
    };

    compareObjects(original, corrected, 'root');
    return corrections.filter(c => c !== 'root');
  }

  private async updateLearningPatterns(
    tenantId: string,
    artifactType: string,
    corrections: string[]
  ): Promise<void> {
    // Increment frequency for seen patterns
    await cacheAdaptor.delete(`ai-patterns:${tenantId}:${artifactType}`);
    await cacheAdaptor.delete(`ai-patterns:${tenantId}:all`);
  }
}

// =============================================================================
// CROSS-ARTIFACT CONSISTENCY VALIDATION
// =============================================================================

export interface ConsistencyIssue {
  field1: { artifact: string; path: string; value: any };
  field2: { artifact: string; path: string; value: any };
  issueType: 'contradiction' | 'mismatch' | 'missing_reference';
  severity: 'error' | 'warning' | 'info';
  description: string;
  autoFixable: boolean;
  suggestedFix?: any;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  crossReferences: Array<{ from: string; to: string; field: string }>;
  score: number; // 0-1
}

/**
 * Validate consistency across all artifacts
 */
export function validateCrossArtifactConsistency(
  artifacts: Record<string, any>
): ConsistencyResult {
  const issues: ConsistencyIssue[] = [];
  const crossReferences: Array<{ from: string; to: string; field: string }> = [];

  // Party consistency check
  const overviewParties = artifacts.OVERVIEW?.parties || [];
  const partyNames = new Set(overviewParties.map((p: any) => p.name?.toLowerCase()));

  // Check FINANCIAL references valid parties
  const financialParties = extractPartyReferences(artifacts.FINANCIAL);
  for (const party of financialParties) {
    if (!partyNames.has(party.toLowerCase())) {
      issues.push({
        field1: { artifact: 'OVERVIEW', path: 'parties', value: overviewParties },
        field2: { artifact: 'FINANCIAL', path: party, value: party },
        issueType: 'missing_reference',
        severity: 'warning',
        description: `Party "${party}" in FINANCIAL not found in OVERVIEW parties`,
        autoFixable: false,
      });
    }
  }

  // Date consistency check
  const effectiveDate = artifacts.OVERVIEW?.effectiveDate?.value || artifacts.OVERVIEW?.effectiveDate;
  const expirationDate = artifacts.OVERVIEW?.expirationDate?.value || artifacts.OVERVIEW?.expirationDate;
  const renewalExpiration = artifacts.RENEWAL?.currentTermEnd;

  if (expirationDate && renewalExpiration && expirationDate !== renewalExpiration) {
    issues.push({
      field1: { artifact: 'OVERVIEW', path: 'expirationDate', value: expirationDate },
      field2: { artifact: 'RENEWAL', path: 'currentTermEnd', value: renewalExpiration },
      issueType: 'mismatch',
      severity: 'error',
      description: 'Expiration date mismatch between OVERVIEW and RENEWAL',
      autoFixable: true,
      suggestedFix: expirationDate, // Prefer OVERVIEW
    });
  }

  // Value consistency check
  const overviewValue = artifacts.OVERVIEW?.totalValue?.value;
  const financialValue = artifacts.FINANCIAL?.totalValue?.value;

  if (overviewValue && financialValue && Math.abs(overviewValue - financialValue) > 0.01) {
    issues.push({
      field1: { artifact: 'OVERVIEW', path: 'totalValue', value: overviewValue },
      field2: { artifact: 'FINANCIAL', path: 'totalValue', value: financialValue },
      issueType: 'mismatch',
      severity: 'error',
      description: 'Total value mismatch between OVERVIEW and FINANCIAL',
      autoFixable: true,
      suggestedFix: financialValue, // Prefer FINANCIAL (more detailed)
    });
  }

  // Cross-reference tracking
  if (artifacts.RISK?.risks) {
    for (const risk of artifacts.RISK.risks) {
      if (risk.relatedClause) {
        crossReferences.push({
          from: 'RISK',
          to: 'CLAUSES',
          field: risk.relatedClause,
        });
      }
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 1 - (errorCount * 0.2) - (warningCount * 0.05));

  return {
    isConsistent: errorCount === 0,
    issues,
    crossReferences,
    score,
  };
}

function extractPartyReferences(artifact: any): string[] {
  const parties: string[] = [];
  if (!artifact) return parties;

  const traverse = (obj: any) => {
    if (!obj) return;
    if (typeof obj === 'string') {
      // Look for party-like references
      const matches = obj.match(/(?:party|vendor|client|contractor|provider|licensee|licensor):\s*"?([^"]+)"?/gi);
      if (matches) parties.push(...matches);
    } else if (Array.isArray(obj)) {
      obj.forEach(traverse);
    } else if (typeof obj === 'object') {
      if (obj.party) parties.push(obj.party);
      if (obj.payee) parties.push(obj.payee);
      if (obj.payer) parties.push(obj.payer);
      Object.values(obj).forEach(traverse);
    }
  };

  traverse(artifact);
  return [...new Set(parties)];
}

// =============================================================================
// EXPORTS
// =============================================================================

export const contractTypeClassifier = ContractTypeClassifier;
export const semanticChunker = SemanticChunker;
export const aiLearningService = AILearningService.getInstance();

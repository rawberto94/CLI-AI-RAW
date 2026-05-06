/**
 * Legal Review & Redlining Service
 * 
 * Advanced legal review capabilities:
 * - Auto-redline generation against playbook
 * - Clause-by-clause risk assessment
 * - Fallback position suggestions
 * - Counterparty pattern analysis
 * - Track changes / redline diff
 * 
 * @module legal-review
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { Prisma } from '@prisma/client';
import { prisma as prismaSingleton, PrismaClient } from '../lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export type RedlineChangeType = 'addition' | 'deletion' | 'modification' | 'unchanged';
export type ReviewDecision = 'accept' | 'reject' | 'negotiate' | 'escalate' | 'review';
export type RiskCategory = 
  | 'liability' 
  | 'indemnification' 
  | 'termination' 
  | 'ip_ownership' 
  | 'confidentiality' 
  | 'payment' 
  | 'warranties' 
  | 'compliance' 
  | 'dispute_resolution'
  | 'limitation_of_liability'
  | 'force_majeure'
  | 'data_protection'
  | 'non_compete'
  | 'assignment'
  | 'other';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Playbook {
  id: string;
  name: string;
  tenantId: string;
  description?: string;
  contractTypes: string[];
  clauses: PlaybookClause[];
  fallbackPositions: Record<string, FallbackPosition>;
  riskThresholds: RiskThresholds;
  preferredLanguage: Record<string, string>;
  redFlags: RedFlag[];
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybookClause {
  id: string;
  category: RiskCategory;
  name: string;
  preferredText: string;
  minimumAcceptable?: string;
  walkawayTriggers: string[];
  riskLevel: RiskLevel;
  notes?: string;
  negotiationGuidance?: string;
}

export interface FallbackPosition {
  initial: string;
  fallback1: string;
  fallback2?: string;
  walkaway: string;
}

export interface RiskThresholds {
  criticalCount: number;
  highRiskScore: number;
  overallAcceptable: number;
}

export interface RedFlag {
  id?: string;
  pattern: string;
  category: RiskCategory;
  severity: RiskLevel;
  explanation: string;
  suggestion: string;
  isRegex?: boolean;
}

export interface RedlineChange {
  id: string;
  type: RedlineChangeType;
  originalText: string;
  suggestedText: string;
  explanation: string;
  riskLevel: RiskLevel;
  category: RiskCategory;
  position: {
    startOffset: number;
    endOffset: number;
    paragraph?: number;
    section?: string;
  };
  decision?: ReviewDecision;
  decisionReason?: string;
  fallbackOptions?: FallbackPosition;
}

export interface ClauseRiskAssessment {
  clauseId: string;
  category: RiskCategory;
  originalText: string;
  riskLevel: RiskLevel;
  riskScore: number;
  issues: RiskIssue[];
  recommendations: string[];
  deviationFromStandard: number;
  requiresEscalation: boolean;
}

export interface RiskIssue {
  type: string;
  description: string;
  severity: RiskLevel;
  citation?: string;
  suggestedFix?: string;
}

export interface LegalReviewResult {
  id: string;
  contractId?: string;
  playbookId: string;
  playbookName: string;
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  recommendation: ReviewDecision;
  recommendationReason: string;
  clauseAssessments: ClauseRiskAssessment[];
  redlines: RedlineChange[];
  redFlagsFound: FoundRedFlag[];
  summary: ReviewSummary;
  generatedAt: Date;
}

export interface FoundRedFlag {
  flag: RedFlag;
  matchedText: string;
  position: { startOffset: number; endOffset: number };
}

export interface ReviewSummary {
  totalClauses: number;
  criticalIssues: number;
  highRiskClauses: number;
  mediumRiskClauses: number;
  lowRiskClauses: number;
  redlinesGenerated: number;
  estimatedNegotiationTime: string;
  keyRisks: string[];
  keyBenefits: string[];
}

// ============================================================================
// DEFAULT PLAYBOOK DATA
// ============================================================================

const DEFAULT_PLAYBOOK_CLAUSES: Omit<PlaybookClause, 'id'>[] = [
  {
    category: 'limitation_of_liability',
    name: 'Limitation of Liability',
    preferredText: 'The total aggregate liability of either party shall not exceed the greater of (a) the fees paid or payable under this Agreement during the twelve (12) months preceding the claim, or (b) [AMOUNT]. This limitation shall not apply to (i) breaches of confidentiality obligations, (ii) indemnification obligations, or (iii) gross negligence or willful misconduct.',
    minimumAcceptable: 'The total aggregate liability shall not exceed the fees paid under this Agreement during the twelve (12) months preceding the claim.',
    walkawayTriggers: ['unlimited liability', 'liability exceeds contract value', 'no liability cap'],
    riskLevel: 'critical',
    notes: 'Ensure mutual cap applies to both parties equally.',
    negotiationGuidance: 'Start with 12-month fee cap, fallback to contract value if pushed.',
  },
  {
    category: 'indemnification',
    name: 'Mutual Indemnification',
    preferredText: 'Each party shall indemnify, defend, and hold harmless the other party from and against any third-party claims arising from (a) the indemnifying party\'s breach of this Agreement, (b) the indemnifying party\'s negligence or willful misconduct, or (c) the indemnifying party\'s violation of applicable law.',
    minimumAcceptable: 'Provider shall indemnify Client against third-party IP claims. Client shall indemnify Provider against claims arising from Client\'s use of the services.',
    walkawayTriggers: ['unlimited indemnification', 'indemnify for all claims', 'no indemnification limit'],
    riskLevel: 'high',
    negotiationGuidance: 'Push for mutual indemnification with specific triggers.',
  },
  {
    category: 'termination',
    name: 'Termination for Convenience',
    preferredText: 'Either party may terminate this Agreement for convenience upon thirty (30) days prior written notice to the other party. Upon termination for convenience by Client, Client shall pay for all services rendered through the effective date of termination.',
    minimumAcceptable: 'Either party may terminate upon ninety (90) days prior written notice.',
    walkawayTriggers: ['no termination for convenience', 'only provider can terminate', 'penalties for termination'],
    riskLevel: 'high',
    negotiationGuidance: 'Mutual termination rights are essential. Minimum 30-day notice.',
  },
  {
    category: 'ip_ownership',
    name: 'Intellectual Property Ownership',
    preferredText: 'Client shall retain all right, title, and interest in and to Client Data and any pre-existing intellectual property. Provider shall retain all right, title, and interest in the Services, including any improvements or modifications made during the engagement. Work product created specifically for Client shall be owned by Client upon full payment.',
    minimumAcceptable: 'Client owns its data and custom deliverables. Provider retains pre-existing IP and general know-how.',
    walkawayTriggers: ['provider owns all work product', 'client data becomes provider property', 'no license to use deliverables'],
    riskLevel: 'critical',
    negotiationGuidance: 'Clear separation of pre-existing IP vs. work product is essential.',
  },
  {
    category: 'confidentiality',
    name: 'Confidentiality',
    preferredText: 'Each party agrees to hold in confidence all Confidential Information of the other party and not to disclose such information to any third party except as necessary to perform obligations under this Agreement. Confidential Information excludes information that: (a) becomes publicly known through no fault of the receiving party, (b) was rightfully known prior to disclosure, (c) is independently developed, or (d) is rightfully obtained from a third party.',
    walkawayTriggers: ['unlimited disclosure rights', 'no confidentiality obligations'],
    riskLevel: 'medium',
    negotiationGuidance: 'Standard mutual confidentiality with reasonable exclusions.',
  },
  {
    category: 'data_protection',
    name: 'Data Protection',
    preferredText: 'Provider shall implement and maintain appropriate technical and organizational measures to protect Client Data against unauthorized access, use, or disclosure. Provider shall comply with applicable data protection laws, including GDPR where applicable. Provider shall notify Client of any data breach within 72 hours of discovery.',
    walkawayTriggers: ['no data protection obligations', 'unlimited data sharing', 'no breach notification'],
    riskLevel: 'high',
    negotiationGuidance: 'Essential for GDPR compliance. Include specific security measures.',
  },
];

const DEFAULT_FALLBACK_POSITIONS: Record<string, FallbackPosition> = {
  limitation_of_liability: {
    initial: '12-month fee cap with carve-outs for IP, confidentiality, and gross negligence',
    fallback1: '24-month fee cap with carve-outs',
    fallback2: 'Total contract value cap',
    walkaway: 'Must have some reasonable liability cap',
  },
  indemnification: {
    initial: 'Mutual indemnification for breach and IP claims',
    fallback1: 'Mutual indemnification for negligence and willful misconduct',
    fallback2: 'Provider IP indemnification only',
    walkaway: 'Must have basic IP indemnification from provider',
  },
  termination: {
    initial: '30-day termination for convenience',
    fallback1: '60-day termination for convenience',
    fallback2: '90-day termination with cause only',
    walkaway: 'Must have some termination rights',
  },
};

const DEFAULT_RED_FLAGS: Omit<RedFlag, 'id'>[] = [
  {
    pattern: 'unlimited liability',
    category: 'limitation_of_liability',
    severity: 'critical',
    explanation: 'Unlimited liability exposure creates significant financial risk.',
    suggestion: 'Negotiate for a reasonable liability cap tied to contract value.',
    isRegex: false,
  },
  {
    pattern: 'perpetual|irrevocable|exclusive license',
    category: 'ip_ownership',
    severity: 'high',
    explanation: 'Perpetual or exclusive IP licenses may restrict future use of your own assets.',
    suggestion: 'Limit license grants to what is necessary for the engagement.',
    isRegex: true,
  },
  {
    pattern: 'sole discretion|absolute discretion',
    category: 'other',
    severity: 'medium',
    explanation: 'Sole discretion clauses can lead to arbitrary decisions without recourse.',
    suggestion: 'Request reasonableness standards or mutual consent requirements.',
    isRegex: false,
  },
  {
    pattern: 'automatic renewal|auto-renew',
    category: 'termination',
    severity: 'medium',
    explanation: 'Auto-renewal may lock you into extended commitments.',
    suggestion: 'Ensure adequate notice period and easy opt-out process.',
    isRegex: false,
  },
  {
    pattern: 'waive|waiver of (any|all) (rights|claims)',
    category: 'liability',
    severity: 'high',
    explanation: 'Broad waivers may eliminate important protections.',
    suggestion: 'Limit waivers to specific, negotiated circumstances.',
    isRegex: true,
  },
];

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class LegalReviewService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private playbookCache: Map<string, Playbook> = new Map();

  constructor(prisma?: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.prisma = prisma || prismaSingleton;
  }

  // ============================================================================
  // MAIN REVIEW METHODS
  // ============================================================================

  /**
   * Perform comprehensive legal review against playbook
   */
  async reviewContract(
    content: string,
    options: {
      tenantId: string;
      contractId?: string;
      playbookId?: string;
      contractType?: string;
      userId?: string;
    }
  ): Promise<LegalReviewResult> {
    // Get playbook
    const playbook = await this.getPlaybook(options.playbookId, options.tenantId);

    // Extract and classify clauses
    const extractedClauses = await this.extractClauses(content);

    // Assess each clause against playbook
    const clauseAssessments: ClauseRiskAssessment[] = [];
    for (const clause of extractedClauses) {
      const assessment = await this.assessClause(clause, playbook);
      clauseAssessments.push(assessment);
    }

    // Generate redlines
    const redlines = await this.generateRedlines(content, clauseAssessments, playbook);

    // Find red flags
    const redFlagsFound = this.findRedFlags(content, playbook.redFlags);

    // Calculate overall risk
    const { overallRiskScore, overallRiskLevel, recommendation, recommendationReason } = 
      this.calculateOverallRisk(clauseAssessments, redFlagsFound, playbook.riskThresholds);

    // Generate summary
    const summary = this.generateSummary(clauseAssessments, redlines, redFlagsFound);

    const result: LegalReviewResult = {
      id: `review_${Date.now()}`,
      contractId: options.contractId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      overallRiskScore,
      overallRiskLevel,
      recommendation,
      recommendationReason,
      clauseAssessments,
      redlines,
      redFlagsFound,
      summary,
      generatedAt: new Date(),
    };

    // Persist review to database
    try {
      await this.prisma.legalReview.create({
        data: {
          tenantId: options.tenantId,
          contractId: options.contractId,
          playbookId: playbook.id,
          overallRiskScore,
          overallRiskLevel,
          recommendation,
          recommendationReason,
          totalClauses: summary.totalClauses,
          criticalIssues: summary.criticalIssues,
          highRiskClauses: summary.highRiskClauses,
          redlinesGenerated: summary.redlinesGenerated,
          clauseAssessments: clauseAssessments as unknown as Prisma.JsonArray,
          redlines: redlines as unknown as Prisma.JsonArray,
          redFlagsFound: redFlagsFound as unknown as Prisma.JsonArray,
          summary: summary as unknown as Prisma.JsonObject,
        },
      });
    } catch (error) {
      console.error('Failed to persist legal review:', error);
    }

    return result;
  }

  /**
   * Generate redlines for a contract
   */
  async generateRedlines(
    originalContent: string,
    assessments: ClauseRiskAssessment[],
    playbook: Playbook
  ): Promise<RedlineChange[]> {
    const redlines: RedlineChange[] = [];

    for (const assessment of assessments) {
      if (assessment.riskLevel === 'critical' || assessment.riskLevel === 'high') {
        const playbookClause = playbook.clauses.find(c => c.category === assessment.category);

        if (playbookClause) {
          const aiSuggestion = await this.generateAIRedlineSuggestion(
            assessment.originalText,
            playbookClause,
            assessment.issues
          );

          const changeType = this.determineChangeType(assessment.originalText, aiSuggestion.suggestedText);

          redlines.push({
            id: `redline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: changeType,
            originalText: assessment.originalText,
            suggestedText: aiSuggestion.suggestedText,
            explanation: aiSuggestion.explanation,
            riskLevel: assessment.riskLevel,
            category: assessment.category,
            position: {
              startOffset: 0,
              endOffset: assessment.originalText.length,
            },
            fallbackOptions: playbook.fallbackPositions[assessment.category],
          });
        }
      }
    }

    return redlines;
  }

  // ============================================================================
  // PLAYBOOK MANAGEMENT (Prisma-backed)
  // ============================================================================

  /**
   * Create a new playbook
   */
  async createPlaybook(
    data: {
      name: string;
      tenantId: string;
      description?: string;
      contractTypes?: string[];
      clauses?: Omit<PlaybookClause, 'id'>[];
      fallbackPositions?: Record<string, FallbackPosition>;
      riskThresholds?: Partial<RiskThresholds>;
      redFlags?: Omit<RedFlag, 'id'>[];
      isDefault?: boolean;
      createdBy: string;
    }
  ): Promise<Playbook> {
    const dbPlaybook = await this.prisma.playbook.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        contractTypes: data.contractTypes || ['MSA', 'SOW', 'NDA'],
        isDefault: data.isDefault || false,
        criticalCountThreshold: data.riskThresholds?.criticalCount || 2,
        highRiskScoreThreshold: data.riskThresholds?.highRiskScore || 70,
        acceptableScoreThreshold: data.riskThresholds?.overallAcceptable || 40,
        preferredLanguage: {},
        createdBy: data.createdBy,
        clauses: {
          create: (data.clauses || DEFAULT_PLAYBOOK_CLAUSES).map((clause, index) => ({
            category: clause.category,
            name: clause.name,
            preferredText: clause.preferredText,
            minimumAcceptable: clause.minimumAcceptable,
            walkawayTriggers: clause.walkawayTriggers,
            riskLevel: clause.riskLevel,
            notes: clause.notes,
            negotiationGuidance: clause.negotiationGuidance,
            sortOrder: index,
          })),
        },
        redFlags: {
          create: (data.redFlags || DEFAULT_RED_FLAGS).map(flag => ({
            pattern: flag.pattern,
            category: flag.category,
            severity: flag.severity,
            explanation: flag.explanation,
            suggestion: flag.suggestion,
            isRegex: flag.isRegex || false,
          })),
        },
        fallbackPositions: {
          create: Object.entries(data.fallbackPositions || DEFAULT_FALLBACK_POSITIONS).map(([category, pos]) => ({
            category,
            initial: pos.initial,
            fallback1: pos.fallback1,
            fallback2: pos.fallback2,
            walkaway: pos.walkaway || pos.fallback2 || pos.fallback1 || pos.initial,
          })),
        },
      },
      include: {
        clauses: true,
        redFlags: true,
        fallbackPositions: true,
      },
    });

    const playbook = this.mapDbToPlaybook(dbPlaybook);
    this.playbookCache.set(playbook.id, playbook);
    return playbook;
  }

  /**
   * Get playbook by ID
   */
  async getPlaybook(playbookId: string | undefined, tenantId: string): Promise<Playbook> {
    // Return default if no ID specified
    if (!playbookId || playbookId === 'default') {
      return this.getOrCreateDefaultPlaybook(tenantId);
    }

    // Check cache
    if (this.playbookCache.has(playbookId)) {
      return this.playbookCache.get(playbookId)!;
    }

    // Load from database
    const dbPlaybook = await this.prisma.playbook.findFirst({
      where: { id: playbookId, tenantId },
      include: {
        clauses: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        redFlags: { where: { isActive: true } },
        fallbackPositions: true,
      },
    });

    if (dbPlaybook) {
      const playbook = this.mapDbToPlaybook(dbPlaybook);
      this.playbookCache.set(playbookId, playbook);
      return playbook;
    }

    // Fallback to default
    return this.getOrCreateDefaultPlaybook(tenantId);
  }

  /**
   * Update playbook
   */
  async updatePlaybook(
    playbookId: string,
    tenantId: string,
    updates: Partial<{
      name: string;
      description: string;
      contractTypes: string[];
      riskThresholds: Partial<RiskThresholds>;
      isDefault: boolean;
      updatedBy: string;
    }>
  ): Promise<Playbook> {
    // Scope update to tenant to prevent cross-tenant IDOR: PATCH /api/playbooks/[id]
    // forwards the id straight to this method, and Prisma's `update` with
    // `where: { id }` alone would let tenant-A silently mutate tenant-B's playbook.
    const owned = await this.prisma.playbook.findFirst({
      where: { id: playbookId, tenantId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error('Playbook not found');
    }
    const dbPlaybook = await this.prisma.playbook.update({
      where: { id: playbookId },
      data: {
        name: updates.name,
        description: updates.description,
        contractTypes: updates.contractTypes,
        criticalCountThreshold: updates.riskThresholds?.criticalCount,
        highRiskScoreThreshold: updates.riskThresholds?.highRiskScore,
        acceptableScoreThreshold: updates.riskThresholds?.overallAcceptable,
        isDefault: updates.isDefault,
        updatedBy: updates.updatedBy,
      },
      include: {
        clauses: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        redFlags: { where: { isActive: true } },
        fallbackPositions: true,
      },
    });

    const playbook = this.mapDbToPlaybook(dbPlaybook);
    this.playbookCache.set(playbookId, playbook);
    return playbook;
  }

  /**
   * Delete playbook
   */
  async deletePlaybook(playbookId: string, tenantId: string): Promise<void> {
    // Scope delete to tenant to prevent cross-tenant IDOR via any future caller.
    // (The HTTP DELETE handler already guards, but defense-in-depth at the service.)
    const result = await this.prisma.playbook.deleteMany({
      where: { id: playbookId, tenantId },
    });
    if (result.count === 0) {
      throw new Error('Playbook not found');
    }
    this.playbookCache.delete(playbookId);
  }

  /**
   * List playbooks for tenant
   */
  async listPlaybooks(tenantId: string): Promise<Playbook[]> {
    const dbPlaybooks = await this.prisma.playbook.findMany({
      where: { tenantId, isActive: true },
      include: {
        clauses: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        redFlags: { where: { isActive: true } },
        fallbackPositions: true,
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return dbPlaybooks.map(p => this.mapDbToPlaybook(p));
  }

  /**
   * Add clause to playbook
   */
  async addPlaybookClause(
    playbookId: string,
    clause: Omit<PlaybookClause, 'id'>
  ): Promise<PlaybookClause> {
    const dbClause = await this.prisma.playbookClause.create({
      data: {
        playbookId,
        category: clause.category,
        name: clause.name,
        preferredText: clause.preferredText,
        minimumAcceptable: clause.minimumAcceptable,
        walkawayTriggers: clause.walkawayTriggers,
        riskLevel: clause.riskLevel,
        notes: clause.notes,
        negotiationGuidance: clause.negotiationGuidance,
      },
    });

    this.playbookCache.delete(playbookId);

    return {
      id: dbClause.id,
      category: dbClause.category as RiskCategory,
      name: dbClause.name,
      preferredText: dbClause.preferredText,
      minimumAcceptable: dbClause.minimumAcceptable || undefined,
      walkawayTriggers: dbClause.walkawayTriggers as string[],
      riskLevel: dbClause.riskLevel as RiskLevel,
      notes: dbClause.notes || undefined,
      negotiationGuidance: dbClause.negotiationGuidance || undefined,
    };
  }

  /**
   * Add red flag to playbook
   */
  async addPlaybookRedFlag(
    playbookId: string,
    redFlag: Omit<RedFlag, 'id'>
  ): Promise<RedFlag> {
    const dbFlag = await this.prisma.playbookRedFlag.create({
      data: {
        playbookId,
        pattern: redFlag.pattern,
        category: redFlag.category,
        severity: redFlag.severity,
        explanation: redFlag.explanation,
        suggestion: redFlag.suggestion,
        isRegex: redFlag.isRegex || false,
      },
    });

    this.playbookCache.delete(playbookId);

    return {
      id: dbFlag.id,
      pattern: dbFlag.pattern,
      category: dbFlag.category as RiskCategory,
      severity: dbFlag.severity as RiskLevel,
      explanation: dbFlag.explanation,
      suggestion: dbFlag.suggestion,
      isRegex: dbFlag.isRegex,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async getOrCreateDefaultPlaybook(tenantId: string): Promise<Playbook> {
    // Check for existing default
    const existing = await this.prisma.playbook.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      include: {
        clauses: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        redFlags: { where: { isActive: true } },
        fallbackPositions: true,
      },
    });

    if (existing) {
      return this.mapDbToPlaybook(existing);
    }

    // Create default playbook
    return this.createPlaybook({
      name: 'Standard Playbook',
      tenantId,
      description: 'Default legal review playbook with standard clauses and thresholds',
      contractTypes: ['MSA', 'SOW', 'NDA', 'SAAS', 'VENDOR'],
      isDefault: true,
      createdBy: 'system',
    });
  }

  private mapDbToPlaybook(dbPlaybook: any): Playbook {
    const fallbackPositions: Record<string, FallbackPosition> = {};
    for (const fb of dbPlaybook.fallbackPositions || []) {
      fallbackPositions[fb.category] = {
        initial: fb.initial,
        fallback1: fb.fallback1,
        fallback2: fb.fallback2 || undefined,
        walkaway: fb.walkaway,
      };
    }

    return {
      id: dbPlaybook.id,
      name: dbPlaybook.name,
      tenantId: dbPlaybook.tenantId,
      description: dbPlaybook.description || undefined,
      contractTypes: dbPlaybook.contractTypes as string[],
      clauses: (dbPlaybook.clauses || []).map((c: any) => ({
        id: c.id,
        category: c.category as RiskCategory,
        name: c.name,
        preferredText: c.preferredText,
        minimumAcceptable: c.minimumAcceptable || undefined,
        walkawayTriggers: c.walkawayTriggers as string[],
        riskLevel: c.riskLevel as RiskLevel,
        notes: c.notes || undefined,
        negotiationGuidance: c.negotiationGuidance || undefined,
      })),
      fallbackPositions,
      riskThresholds: {
        criticalCount: dbPlaybook.criticalCountThreshold,
        highRiskScore: dbPlaybook.highRiskScoreThreshold,
        overallAcceptable: dbPlaybook.acceptableScoreThreshold,
      },
      preferredLanguage: dbPlaybook.preferredLanguage as Record<string, string>,
      redFlags: (dbPlaybook.redFlags || []).map((f: any) => ({
        id: f.id,
        pattern: f.pattern,
        category: f.category as RiskCategory,
        severity: f.severity as RiskLevel,
        explanation: f.explanation,
        suggestion: f.suggestion,
        isRegex: f.isRegex,
      })),
      isDefault: dbPlaybook.isDefault,
      isActive: dbPlaybook.isActive,
      version: dbPlaybook.version,
      createdAt: dbPlaybook.createdAt,
      updatedAt: dbPlaybook.updatedAt,
    };
  }

  private async extractClauses(content: string): Promise<ExtractedClause[]> {
    const prompt = `Analyze this contract and extract distinct clauses. For each clause identify:
1. The category (liability, indemnification, termination, ip_ownership, confidentiality, payment, warranties, compliance, dispute_resolution, limitation_of_liability, force_majeure, data_protection, non_compete, assignment, other)
2. The exact text of the clause
3. A brief summary

Contract text:
${content.slice(0, 12000)}

Return JSON: { "clauses": [{ "category": "category_name", "text": "exact clause text", "summary": "brief summary" }] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"clauses":[]}');
      return (result.clauses || []).map((c: any, index: number) => ({
        id: `clause_${index}`,
        category: c.category || 'other',
        text: c.text || '',
        summary: c.summary || '',
      }));
    } catch (error) {
      console.error('Failed to extract clauses:', error);
      return [];
    }
  }

  private async assessClause(
    clause: ExtractedClause,
    playbook: Playbook
  ): Promise<ClauseRiskAssessment> {
    const playbookClause = playbook.clauses.find(c => c.category === clause.category);

    let deviationFromStandard = 0;
    if (playbookClause) {
      deviationFromStandard = this.calculateDeviation(clause.text, playbookClause.preferredText);
    }

    const aiAssessment = await this.getAIRiskAssessment(clause, playbookClause);

    const walkawayTriggered = playbookClause?.walkawayTriggers.some(
      trigger => clause.text.toLowerCase().includes(trigger.toLowerCase())
    );

    let riskScore = aiAssessment.riskScore;
    let riskLevel = this.scoreToRiskLevel(riskScore);

    if (walkawayTriggered) {
      riskScore = Math.max(riskScore, 90);
      riskLevel = 'critical';
    }

    return {
      clauseId: clause.id,
      category: clause.category as RiskCategory,
      originalText: clause.text,
      riskLevel,
      riskScore,
      issues: aiAssessment.issues,
      recommendations: aiAssessment.recommendations,
      deviationFromStandard,
      requiresEscalation: riskLevel === 'critical' || !!walkawayTriggered,
    };
  }

  private async getAIRiskAssessment(
    clause: ExtractedClause,
    playbookClause?: PlaybookClause
  ): Promise<{ riskScore: number; issues: RiskIssue[]; recommendations: string[] }> {
    const prompt = `Assess the risk of this contract clause:

Clause Category: ${clause.category}
Clause Text: "${clause.text}"

${playbookClause ? `
Our preferred standard clause:
"${playbookClause.preferredText}"

Minimum acceptable:
"${playbookClause.minimumAcceptable || 'Not specified'}"
` : ''}

Provide:
1. Risk score (0-100, where 100 is highest risk)
2. Specific issues found
3. Recommendations for negotiation

Return JSON: {
  "riskScore": number,
  "issues": [{ "type": "issue type", "description": "description", "severity": "critical|high|medium|low", "suggestedFix": "suggestion" }],
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        riskScore: result.riskScore || 50,
        issues: result.issues || [],
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      console.error('AI risk assessment failed:', error);
      return { riskScore: 50, issues: [], recommendations: [] };
    }
  }

  private async generateAIRedlineSuggestion(
    originalText: string,
    playbookClause: PlaybookClause,
    issues: RiskIssue[]
  ): Promise<{ suggestedText: string; explanation: string }> {
    const prompt = `Generate a redline suggestion for this clause:

Original clause:
"${originalText}"

Our preferred language:
"${playbookClause.preferredText}"

Issues identified:
${issues.map(i => `- ${i.type}: ${i.description}`).join('\n')}

Generate a revised clause that:
1. Addresses the identified issues
2. Moves closer to our preferred language
3. Remains reasonable and negotiable

Return JSON: { "suggestedText": "revised clause text", "explanation": "why this change is recommended" }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        suggestedText: result.suggestedText || playbookClause.minimumAcceptable || playbookClause.preferredText,
        explanation: result.explanation || 'Suggested based on playbook standards',
      };
    } catch (error) {
      console.error('AI redline generation failed:', error);
      return {
        suggestedText: playbookClause.minimumAcceptable || playbookClause.preferredText,
        explanation: 'Fallback to playbook standard',
      };
    }
  }

  private determineChangeType(original: string, suggested: string): RedlineChangeType {
    if (original === suggested) return 'unchanged';
    if (!original.trim()) return 'addition';
    if (!suggested.trim()) return 'deletion';
    return 'modification';
  }

  private findRedFlags(content: string, redFlags: RedFlag[]): FoundRedFlag[] {
    const found: FoundRedFlag[] = [];
    const lowerContent = content.toLowerCase();
    // ReDoS guard: red-flag regex patterns come from user-supplied playbook imports.
    // A malicious (or accidental) catastrophic-backtracking pattern like `(a+)+b`
    // against long OCR content can hang the request thread for many seconds.
    // Bail out of any single pattern's scan once it has consumed > 100ms.
    const PATTERN_BUDGET_MS = 100;

    for (const flag of redFlags) {
      try {
        if (flag.isRegex) {
          const regex = new RegExp(flag.pattern, 'gi');
          let match;
          const scanStart = Date.now();
          while ((match = regex.exec(content)) !== null) {
            found.push({
              flag,
              matchedText: match[0],
              position: {
                startOffset: match.index,
                endOffset: match.index + match[0].length,
              },
            });
            if (Date.now() - scanStart > PATTERN_BUDGET_MS) {
              console.warn('[LegalReview] Red-flag regex time budget exceeded, aborting scan', {
                patternSample: flag.pattern.slice(0, 80),
              });
              break;
            }
          }
        } else {
          const index = lowerContent.indexOf(flag.pattern.toLowerCase());
          if (index >= 0) {
            found.push({
              flag,
              matchedText: content.slice(index, index + flag.pattern.length),
              position: {
                startOffset: index,
                endOffset: index + flag.pattern.length,
              },
            });
          }
        }
      } catch (e) {
        console.error('Red flag pattern error:', flag.pattern, e);
      }
    }

    return found;
  }

  private calculateOverallRisk(
    assessments: ClauseRiskAssessment[],
    redFlags: FoundRedFlag[],
    thresholds: RiskThresholds
  ): {
    overallRiskScore: number;
    overallRiskLevel: RiskLevel;
    recommendation: ReviewDecision;
    recommendationReason: string;
  } {
    const criticalCount = assessments.filter(a => a.riskLevel === 'critical').length +
      redFlags.filter(f => f.flag.severity === 'critical').length;
    const highCount = assessments.filter(a => a.riskLevel === 'high').length;

    const totalScore = assessments.reduce((sum, a) => sum + a.riskScore, 0);
    const avgScore = assessments.length > 0 ? totalScore / assessments.length : 0;

    const flagAdjustment = redFlags.reduce((sum, f) => {
      switch (f.flag.severity) {
        case 'critical': return sum + 20;
        case 'high': return sum + 10;
        case 'medium': return sum + 5;
        default: return sum + 2;
      }
    }, 0);

    const overallRiskScore = Math.min(100, avgScore + flagAdjustment);
    let overallRiskLevel: RiskLevel;
    let recommendation: ReviewDecision;
    let recommendationReason: string;

    if (criticalCount >= thresholds.criticalCount) {
      overallRiskLevel = 'critical';
      recommendation = 'reject';
      recommendationReason = `${criticalCount} critical issues found exceed threshold of ${thresholds.criticalCount}`;
    } else if (overallRiskScore >= thresholds.highRiskScore) {
      overallRiskLevel = 'high';
      recommendation = 'negotiate';
      recommendationReason = `Risk score ${overallRiskScore.toFixed(0)} exceeds high-risk threshold of ${thresholds.highRiskScore}`;
    } else if (overallRiskScore >= thresholds.overallAcceptable) {
      overallRiskLevel = 'medium';
      recommendation = 'review';
      recommendationReason = 'Contract needs review but has no critical issues';
    } else {
      overallRiskLevel = 'low';
      recommendation = 'accept';
      recommendationReason = 'Contract aligns with playbook standards';
    }

    return { overallRiskScore, overallRiskLevel, recommendation, recommendationReason };
  }

  private generateSummary(
    assessments: ClauseRiskAssessment[],
    redlines: RedlineChange[],
    redFlags: FoundRedFlag[]
  ): ReviewSummary {
    const keyRisks: string[] = [];
    const keyBenefits: string[] = [];

    for (const assessment of assessments.filter(a => a.riskLevel === 'critical' || a.riskLevel === 'high')) {
      for (const issue of assessment.issues.slice(0, 2)) {
        keyRisks.push(`${assessment.category}: ${issue.description}`);
      }
    }

    for (const assessment of assessments.filter(a => a.riskLevel === 'low')) {
      keyBenefits.push(`${assessment.category} clause is favorable`);
    }

    const estimatedHours = redlines.length * 0.5 + redFlags.length * 0.25;
    const estimatedNegotiationTime = estimatedHours < 1 
      ? 'Less than 1 hour'
      : estimatedHours < 4 
        ? `${Math.ceil(estimatedHours)} hours`
        : `${Math.ceil(estimatedHours / 8)} business days`;

    return {
      totalClauses: assessments.length,
      criticalIssues: assessments.filter(a => a.riskLevel === 'critical').length,
      highRiskClauses: assessments.filter(a => a.riskLevel === 'high').length,
      mediumRiskClauses: assessments.filter(a => a.riskLevel === 'medium').length,
      lowRiskClauses: assessments.filter(a => a.riskLevel === 'low').length,
      redlinesGenerated: redlines.length,
      estimatedNegotiationTime,
      keyRisks: keyRisks.slice(0, 5),
      keyBenefits: keyBenefits.slice(0, 3),
    };
  }

  private calculateDeviation(actual: string, preferred: string): number {
    const actualWords = new Set(actual.toLowerCase().split(/\s+/));
    const preferredWords = new Set(preferred.toLowerCase().split(/\s+/));
    
    const intersection = [...actualWords].filter(w => preferredWords.has(w)).length;
    const union = new Set([...actualWords, ...preferredWords]).size;
    
    const similarity = union > 0 ? intersection / union : 0;
    return Math.round((1 - similarity) * 100);
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

interface ExtractedClause {
  id: string;
  category: string;
  text: string;
  summary: string;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let reviewInstance: LegalReviewService | null = null;

export function getLegalReviewService(): LegalReviewService {
  if (!reviewInstance) {
    reviewInstance = new LegalReviewService();
  }
  return reviewInstance;
}

export const legalReviewService = getLegalReviewService();

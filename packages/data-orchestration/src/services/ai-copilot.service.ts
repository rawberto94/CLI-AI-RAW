/**
 * AI Contract Copilot Service
 * 
 * Real-time drafting assistance with:
 * - Live clause suggestions as users type
 * - Risk highlighting in real-time
 * - Auto-complete from approved clause library
 * - Negotiation position suggestions
 * - Contextual improvements
 * 
 * @module ai-copilot
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export type SuggestionType = 
  | 'clause_completion'      // Complete a partial clause
  | 'clause_improvement'     // Improve existing clause
  | 'risk_mitigation'        // Suggest risk reduction
  | 'compliance_addition'    // Add compliance language
  | 'clarity_enhancement'    // Improve readability
  | 'negotiation_position'   // Suggest negotiation angle
  | 'alternative_language'   // Provide alternatives
  | 'missing_clause';        // Suggest missing clause

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CopilotContext {
  tenantId: string;
  userId: string;
  contractType?: string;
  counterpartyName?: string;
  contractValue?: number;
  isNegotiating?: boolean;
  userRole?: 'drafter' | 'reviewer' | 'approver' | 'legal';
  previousInteractions?: CopilotInteraction[];
  activePlaybook?: PlaybookReference;
}

export interface PlaybookReference {
  id: string;
  name: string;
  fallbackPositions?: Record<string, FallbackPosition>;
  preferredLanguage?: Record<string, string>;
  riskThresholds?: Record<string, number>;
}

export interface FallbackPosition {
  initial: string;
  fallback1: string;
  fallback2: string;
  walkaway?: string;
  notes?: string;
}

export interface CopilotInteraction {
  id: string;
  type: 'suggestion_accepted' | 'suggestion_rejected' | 'manual_edit';
  clauseType?: string;
  timestamp: Date;
}

export interface RealtimeSuggestion {
  id: string;
  type: SuggestionType;
  triggerText: string;          // What triggered this suggestion
  suggestedText: string;        // The suggestion
  explanation: string;          // Why this is suggested
  confidence: number;           // 0-1
  position: TextPosition;
  source: SuggestionSource;
  metadata?: Record<string, unknown>;
}

export interface TextPosition {
  startOffset: number;
  endOffset: number;
  paragraph?: number;
  line?: number;
}

export interface SuggestionSource {
  type: 'clause_library' | 'playbook' | 'ai_generated' | 'historical' | 'regulatory';
  name: string;
  clauseId?: string;
  confidence: number;
}

export interface RiskHighlight {
  id: string;
  severity: RiskSeverity;
  type: string;
  text: string;
  position: TextPosition;
  explanation: string;
  suggestedFix?: string;
  playbookReference?: string;
}

export interface AutoCompleteResult {
  completions: ClauseCompletion[];
  clauseType?: string;
  confidence: number;
}

export interface ClauseCompletion {
  id: string;
  text: string;
  source: 'library' | 'historical' | 'ai';
  matchScore: number;
  clauseId?: string;
  riskLevel?: RiskSeverity;
}

export interface CopilotResponse {
  suggestions: RealtimeSuggestion[];
  risks: RiskHighlight[];
  completions?: AutoCompleteResult;
  contextualTips?: ContextualTip[];
  negotiationInsights?: NegotiationInsight[];
}

export interface ContextualTip {
  id: string;
  tip: string;
  relevance: number;
  source: string;
}

export interface NegotiationInsight {
  id: string;
  insight: string;
  counterpartyPattern?: string;
  suggestedPosition: string;
  strength: 'strong' | 'moderate' | 'weak';
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class AICopilotService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private clauseCache: Map<string, CachedClause[]> = new Map();
  private riskPatterns: RiskPattern[] = [];

  constructor(prisma?: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.prisma = prisma || new PrismaClient();
    this.initializeRiskPatterns();
  }

  // ============================================================================
  // MAIN COPILOT METHODS
  // ============================================================================

  /**
   * Get real-time suggestions as user types
   */
  async getSuggestions(
    text: string,
    cursorPosition: number,
    context: CopilotContext
  ): Promise<CopilotResponse> {
    const [
      clauseSuggestions,
      riskHighlights,
      completions,
      negotiationInsights,
    ] = await Promise.all([
      this.generateClauseSuggestions(text, cursorPosition, context),
      this.detectRisks(text, context),
      this.getAutoCompletions(text, cursorPosition, context),
      context.isNegotiating 
        ? this.getNegotiationInsights(text, context) 
        : Promise.resolve([]),
    ]);

    return {
      suggestions: clauseSuggestions,
      risks: riskHighlights,
      completions,
      contextualTips: this.generateContextualTips(text, context),
      negotiationInsights,
    };
  }

  /**
   * Generate clause suggestions based on current text
   */
  async generateClauseSuggestions(
    text: string,
    cursorPosition: number,
    context: CopilotContext
  ): Promise<RealtimeSuggestion[]> {
    const suggestions: RealtimeSuggestion[] = [];
    
    // Extract the current sentence/paragraph around cursor
    const { currentText, startOffset } = this.extractContext(text, cursorPosition);
    
    // 1. Check clause library for matches
    const librarySuggestions = await this.matchClauseLibrary(currentText, context);
    suggestions.push(...librarySuggestions);

    // 2. Check playbook if available
    if (context.activePlaybook) {
      const playbookSuggestions = await this.matchPlaybook(currentText, context);
      suggestions.push(...playbookSuggestions);
    }

    // 3. Generate AI suggestions if no good library matches
    if (suggestions.length < 2 && currentText.length > 20) {
      const aiSuggestions = await this.generateAISuggestions(currentText, context);
      suggestions.push(...aiSuggestions);
    }

    // 4. Check for missing standard clauses
    const missingSuggestions = await this.checkMissingClauses(text, context);
    suggestions.push(...missingSuggestions);

    // Dedupe and rank
    return this.rankSuggestions(suggestions).slice(0, 5);
  }

  /**
   * Detect risks in real-time
   */
  async detectRisks(
    text: string,
    context: CopilotContext
  ): Promise<RiskHighlight[]> {
    const risks: RiskHighlight[] = [];

    // 1. Pattern-based risk detection (fast)
    for (const pattern of this.riskPatterns) {
      const matches = text.matchAll(pattern.regex);
      for (const match of matches) {
        if (match.index !== undefined) {
          risks.push({
            id: `risk_${match.index}_${pattern.type}`,
            severity: pattern.severity,
            type: pattern.type,
            text: match[0],
            position: {
              startOffset: match.index,
              endOffset: match.index + match[0].length,
            },
            explanation: pattern.explanation,
            suggestedFix: pattern.suggestedFix,
          });
        }
      }
    }

    // 2. AI-powered risk analysis for complex patterns
    if (text.length > 100) {
      const aiRisks = await this.analyzeRisksWithAI(text, context);
      risks.push(...aiRisks);
    }

    // 3. Check against playbook risk thresholds
    if (context.activePlaybook?.riskThresholds) {
      const playbookRisks = this.checkPlaybookThresholds(text, context);
      risks.push(...playbookRisks);
    }

    return this.dedupeRisks(risks);
  }

  /**
   * Get auto-completions for partial clause text
   */
  async getAutoCompletions(
    text: string,
    cursorPosition: number,
    context: CopilotContext
  ): Promise<AutoCompleteResult> {
    const { currentText } = this.extractContext(text, cursorPosition);
    
    // Detect clause type from context
    const clauseType = this.detectClauseType(currentText);
    
    const completions: ClauseCompletion[] = [];

    // 1. Library completions
    const libraryCompletions = await this.getLibraryCompletions(
      currentText,
      clauseType,
      context.tenantId
    );
    completions.push(...libraryCompletions);

    // 2. Historical completions from tenant's contracts
    const historicalCompletions = await this.getHistoricalCompletions(
      currentText,
      clauseType,
      context.tenantId
    );
    completions.push(...historicalCompletions);

    // 3. AI completions
    if (completions.length < 3) {
      const aiCompletions = await this.generateAICompletions(
        currentText,
        clauseType,
        context
      );
      completions.push(...aiCompletions);
    }

    return {
      completions: completions.slice(0, 5),
      clauseType,
      confidence: completions.length > 0 ? completions[0].matchScore : 0,
    };
  }

  /**
   * Get negotiation insights for current text
   */
  async getNegotiationInsights(
    text: string,
    context: CopilotContext
  ): Promise<NegotiationInsight[]> {
    if (!context.isNegotiating) return [];

    const prompt = `Analyze this contract clause and provide negotiation insights:

Contract Type: ${context.contractType || 'Unknown'}
Counterparty: ${context.counterpartyName || 'Unknown'}
User Role: ${context.userRole || 'drafter'}

Current Clause Text:
${text.slice(0, 2000)}

Provide 2-3 negotiation insights:
1. What position does this clause represent?
2. What are common counterparty pushback points?
3. What alternative positions could strengthen our position?

Return JSON array: [{ insight, counterpartyPattern, suggestedPosition, strength }]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"insights":[]}';
      const parsed = JSON.parse(content);
      return (parsed.insights || []).map((i: any, idx: number) => ({
        id: `neg_${idx}`,
        ...i,
      }));
    } catch (error) {
      console.error('Failed to generate negotiation insights:', error);
      return [];
    }
  }

  /**
   * Apply a suggestion to text
   */
  applySuggestion(
    text: string,
    suggestion: RealtimeSuggestion
  ): string {
    const before = text.slice(0, suggestion.position.startOffset);
    const after = text.slice(suggestion.position.endOffset);
    return before + suggestion.suggestedText + after;
  }

  // ============================================================================
  // CLAUSE LIBRARY METHODS
  // ============================================================================

  private async matchClauseLibrary(
    text: string,
    context: CopilotContext
  ): Promise<RealtimeSuggestion[]> {
    const suggestions: RealtimeSuggestion[] = [];

    try {
      // Get clauses from library - use clauseLibrary model which has tenantId and content
      const clauses = await this.prisma.clauseLibrary.findMany({
        where: {
          tenantId: context.tenantId,
        },
        take: 100,
      });

      // Simple text matching (could be enhanced with embeddings)
      for (const clause of clauses) {
        const similarity = this.calculateSimilarity(text.toLowerCase(), clause.content.toLowerCase());
        if (similarity > 0.3) {
          suggestions.push({
            id: `lib_${clause.id}`,
            type: 'clause_improvement',
            triggerText: text.slice(0, 50),
            suggestedText: clause.content,
            explanation: `Standard ${clause.category} clause from your library`,
            confidence: similarity,
            position: { startOffset: 0, endOffset: text.length },
            source: {
              type: 'clause_library',
              name: clause.name,
              clauseId: clause.id,
              confidence: similarity,
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to match clause library:', error);
    }

    return suggestions;
  }

  private async getLibraryCompletions(
    text: string,
    clauseType: string | undefined,
    tenantId: string
  ): Promise<ClauseCompletion[]> {
    try {
      const clauses = await this.prisma.clauseLibrary.findMany({
        where: {
          tenantId,
          ...(clauseType && { category: clauseType }),
        },
        take: 10,
      });

      return clauses.map(clause => ({
        id: clause.id,
        text: clause.content,
        source: 'library' as const,
        matchScore: this.calculateSimilarity(text, clause.content),
        clauseId: clause.id,
        riskLevel: this.mapRiskLevel(clause.riskLevel),
      }));
    } catch (error) {
      console.error('Failed to get library completions:', error);
      return [];
    }
  }

  // ============================================================================
  // PLAYBOOK METHODS
  // ============================================================================

  private async matchPlaybook(
    text: string,
    context: CopilotContext
  ): Promise<RealtimeSuggestion[]> {
    if (!context.activePlaybook) return [];

    const suggestions: RealtimeSuggestion[] = [];
    const playbook = context.activePlaybook;

    // Check preferred language
    if (playbook.preferredLanguage) {
      for (const [clauseType, preferredText] of Object.entries(playbook.preferredLanguage)) {
        const similarity = this.calculateSimilarity(text.toLowerCase(), preferredText.toLowerCase());
        if (similarity > 0.2 && similarity < 0.9) {
          suggestions.push({
            id: `playbook_${clauseType}`,
            type: 'clause_improvement',
            triggerText: text.slice(0, 50),
            suggestedText: preferredText,
            explanation: `Your playbook recommends this ${clauseType} language`,
            confidence: 0.9,
            position: { startOffset: 0, endOffset: text.length },
            source: {
              type: 'playbook',
              name: playbook.name,
              confidence: 0.9,
            },
          });
        }
      }
    }

    // Check fallback positions
    if (playbook.fallbackPositions) {
      for (const [clauseType, positions] of Object.entries(playbook.fallbackPositions)) {
        if (this.textContainsClauseType(text, clauseType)) {
          suggestions.push({
            id: `fallback_${clauseType}`,
            type: 'negotiation_position',
            triggerText: text.slice(0, 50),
            suggestedText: positions.initial,
            explanation: `Playbook initial position for ${clauseType}. Fallbacks available.`,
            confidence: 0.85,
            position: { startOffset: 0, endOffset: text.length },
            source: {
              type: 'playbook',
              name: playbook.name,
              confidence: 0.85,
            },
            metadata: {
              fallback1: positions.fallback1,
              fallback2: positions.fallback2,
              walkaway: positions.walkaway,
            },
          });
        }
      }
    }

    return suggestions;
  }

  private checkPlaybookThresholds(
    text: string,
    context: CopilotContext
  ): RiskHighlight[] {
    const risks: RiskHighlight[] = [];
    const thresholds = context.activePlaybook?.riskThresholds;
    if (!thresholds) return risks;

    // Check liability cap
    const liabilityMatch = text.match(/liability.*(?:shall not exceed|limited to|cap(?:ped)? at)\s*\$?([\d,]+(?:\.\d+)?)/i);
    if (liabilityMatch && thresholds.minLiabilityCap) {
      const amount = parseFloat(liabilityMatch[1].replace(/,/g, ''));
      if (amount < thresholds.minLiabilityCap) {
        risks.push({
          id: 'playbook_liability',
          severity: 'high',
          type: 'playbook_violation',
          text: liabilityMatch[0],
          position: {
            startOffset: liabilityMatch.index || 0,
            endOffset: (liabilityMatch.index || 0) + liabilityMatch[0].length,
          },
          explanation: `Liability cap $${amount.toLocaleString()} is below playbook minimum of $${thresholds.minLiabilityCap.toLocaleString()}`,
          suggestedFix: `Negotiate for minimum $${thresholds.minLiabilityCap.toLocaleString()} cap`,
          playbookReference: context.activePlaybook?.name,
        });
      }
    }

    return risks;
  }

  // ============================================================================
  // AI GENERATION METHODS
  // ============================================================================

  private async generateAISuggestions(
    text: string,
    context: CopilotContext
  ): Promise<RealtimeSuggestion[]> {
    const prompt = `You are a contract drafting assistant. Analyze this partial clause and suggest improvements.

Contract Type: ${context.contractType || 'General'}
Current Text: "${text}"

Provide 2 suggestions to improve this clause. Focus on:
1. Legal precision and clarity
2. Risk mitigation for our client
3. Industry best practices

Return JSON: { "suggestions": [{ "type": "improvement|risk_mitigation|clarity", "text": "improved clause", "explanation": "why this is better" }] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"suggestions":[]}';
      const parsed = JSON.parse(content);
      
      return (parsed.suggestions || []).map((s: any, idx: number) => ({
        id: `ai_${Date.now()}_${idx}`,
        type: s.type === 'risk_mitigation' ? 'risk_mitigation' : 'clause_improvement',
        triggerText: text.slice(0, 50),
        suggestedText: s.text,
        explanation: s.explanation,
        confidence: 0.75,
        position: { startOffset: 0, endOffset: text.length },
        source: {
          type: 'ai_generated' as const,
          name: 'AI Assistant',
          confidence: 0.75,
        },
      }));
    } catch (error) {
      console.error('Failed to generate AI suggestions:', error);
      return [];
    }
  }

  private async generateAICompletions(
    text: string,
    clauseType: string | undefined,
    context: CopilotContext
  ): Promise<ClauseCompletion[]> {
    const prompt = `Complete this partial contract clause:

Clause Type: ${clauseType || 'Unknown'}
Contract Type: ${context.contractType || 'General'}
Partial Text: "${text}"

Provide 2 possible completions. Return JSON:
{ "completions": [{ "text": "complete clause text", "confidence": 0.8 }] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"completions":[]}';
      const parsed = JSON.parse(content);
      
      return (parsed.completions || []).map((c: any, idx: number) => ({
        id: `ai_comp_${Date.now()}_${idx}`,
        text: c.text,
        source: 'ai' as const,
        matchScore: c.confidence || 0.7,
      }));
    } catch (error) {
      console.error('Failed to generate AI completions:', error);
      return [];
    }
  }

  private async analyzeRisksWithAI(
    text: string,
    context: CopilotContext
  ): Promise<RiskHighlight[]> {
    const prompt = `Analyze this contract text for legal risks:

Contract Type: ${context.contractType || 'General'}
Text: "${text.slice(0, 3000)}"

Identify specific risks. Return JSON:
{ "risks": [{ "severity": "critical|high|medium|low", "type": "liability|indemnity|termination|ip|confidentiality|other", "excerpt": "the risky text", "explanation": "why it's risky", "suggestedFix": "how to fix" }] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"risks":[]}';
      const parsed = JSON.parse(content);
      
      return (parsed.risks || []).map((r: any, idx: number) => {
        const excerptIndex = text.indexOf(r.excerpt);
        return {
          id: `ai_risk_${Date.now()}_${idx}`,
          severity: r.severity as RiskSeverity,
          type: r.type,
          text: r.excerpt,
          position: {
            startOffset: excerptIndex >= 0 ? excerptIndex : 0,
            endOffset: excerptIndex >= 0 ? excerptIndex + r.excerpt.length : text.length,
          },
          explanation: r.explanation,
          suggestedFix: r.suggestedFix,
        };
      });
    } catch (error) {
      console.error('Failed to analyze risks with AI:', error);
      return [];
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private initializeRiskPatterns() {
    this.riskPatterns = [
      {
        regex: /unlimited\s+liability/gi,
        severity: 'critical',
        type: 'liability',
        explanation: 'Unlimited liability exposes your organization to unlimited financial risk',
        suggestedFix: 'Add a liability cap (e.g., limited to fees paid or a specific amount)',
      },
      {
        regex: /indemnif(?:y|ication)\s+(?:and\s+)?hold\s+harmless.*(?:all|any)\s+(?:claims|damages|losses)/gi,
        severity: 'high',
        type: 'indemnity',
        explanation: 'Broad indemnification clause may expose you to significant liability',
        suggestedFix: 'Narrow the scope to direct damages caused by breach',
      },
      {
        regex: /terminat(?:e|ion)\s+(?:at\s+)?(?:any\s+time\s+)?(?:for\s+)?(?:any\s+reason|convenience|no\s+reason)/gi,
        severity: 'medium',
        type: 'termination',
        explanation: 'Unilateral termination for convenience may leave you without recourse',
        suggestedFix: 'Require notice period and transition assistance',
      },
      {
        regex: /(?:all|any)\s+intellectual\s+property.*(?:belongs?|owned|assigned)\s+(?:to|by)\s+(?:the\s+)?(?:client|customer|buyer)/gi,
        severity: 'high',
        type: 'ip',
        explanation: 'Full IP assignment may give away your pre-existing IP',
        suggestedFix: 'Carve out pre-existing IP and limit assignment to deliverables',
      },
      {
        regex: /perpetual(?:ly)?\s+(?:and\s+)?irrevocable/gi,
        severity: 'medium',
        type: 'license',
        explanation: 'Perpetual irrevocable rights may limit future flexibility',
        suggestedFix: 'Consider term-limited or revocable alternatives',
      },
      {
        regex: /(?:waive|waiver\s+of)\s+(?:all\s+)?(?:rights?|claims?)/gi,
        severity: 'high',
        type: 'waiver',
        explanation: 'Broad waiver of rights may be unenforceable and risky',
        suggestedFix: 'Specify exactly which rights are being waived',
      },
      {
        regex: /(?:sole|exclusive)\s+(?:remedy|recourse)/gi,
        severity: 'medium',
        type: 'remedies',
        explanation: 'Limited remedies may not adequately protect your interests',
        suggestedFix: 'Ensure remedy is proportionate to potential harm',
      },
      {
        regex: /(?:reasonable\s+)?efforts?(?:\s+to)?/gi,
        severity: 'low',
        type: 'ambiguity',
        explanation: '"Reasonable efforts" is vague and may lead to disputes',
        suggestedFix: 'Define specific deliverables, timelines, or success criteria',
      },
    ];
  }

  private extractContext(text: string, cursorPosition: number): { currentText: string; startOffset: number } {
    // Find paragraph boundaries
    const beforeCursor = text.slice(0, cursorPosition);
    const afterCursor = text.slice(cursorPosition);
    
    const paragraphStart = Math.max(0, beforeCursor.lastIndexOf('\n\n') + 2, beforeCursor.lastIndexOf('\n') + 1);
    const paragraphEnd = cursorPosition + (afterCursor.indexOf('\n\n') >= 0 ? afterCursor.indexOf('\n\n') : afterCursor.length);
    
    return {
      currentText: text.slice(paragraphStart, paragraphEnd),
      startOffset: paragraphStart,
    };
  }

  private detectClauseType(text: string): string | undefined {
    const patterns: Record<string, RegExp> = {
      'indemnification': /indemni(?:fy|fication|ties)/i,
      'limitation_of_liability': /(?:limitation|limit)\s+(?:of\s+)?liability/i,
      'confidentiality': /confidential(?:ity)?|non-disclosure/i,
      'termination': /terminat(?:e|ion)/i,
      'intellectual_property': /intellectual\s+property|(?:patent|copyright|trademark)/i,
      'force_majeure': /force\s+majeure/i,
      'governing_law': /govern(?:ing|ed)\s+(?:by\s+)?(?:the\s+)?law/i,
      'dispute_resolution': /(?:dispute|arbitration|mediation)/i,
      'payment_terms': /payment\s+terms?|invoic/i,
      'warranties': /warrant(?:y|ies)|represent(?:ation)?/i,
    };

    for (const [type, regex] of Object.entries(patterns)) {
      if (regex.test(text)) {
        return type;
      }
    }
    return undefined;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private textContainsClauseType(text: string, clauseType: string): boolean {
    const normalizedType = clauseType.toLowerCase().replace(/_/g, ' ');
    return text.toLowerCase().includes(normalizedType) ||
           this.detectClauseType(text)?.toLowerCase() === clauseType.toLowerCase();
  }

  private async checkMissingClauses(
    text: string,
    context: CopilotContext
  ): Promise<RealtimeSuggestion[]> {
    // Standard clauses that should be in most contracts
    const standardClauses = [
      { type: 'governing_law', name: 'Governing Law', pattern: /govern(?:ing|ed)\s+(?:by\s+)?(?:the\s+)?law/i },
      { type: 'dispute_resolution', name: 'Dispute Resolution', pattern: /(?:dispute|arbitration|mediation)/i },
      { type: 'force_majeure', name: 'Force Majeure', pattern: /force\s+majeure/i },
      { type: 'confidentiality', name: 'Confidentiality', pattern: /confidential(?:ity)?/i },
    ];

    const suggestions: RealtimeSuggestion[] = [];

    for (const clause of standardClauses) {
      if (!clause.pattern.test(text)) {
        suggestions.push({
          id: `missing_${clause.type}`,
          type: 'missing_clause',
          triggerText: '',
          suggestedText: `Consider adding a ${clause.name} clause`,
          explanation: `Standard contracts typically include a ${clause.name} clause`,
          confidence: 0.6,
          position: { startOffset: text.length, endOffset: text.length },
          source: {
            type: 'regulatory',
            name: 'Best Practices',
            confidence: 0.6,
          },
        });
      }
    }

    return suggestions;
  }

  private rankSuggestions(suggestions: RealtimeSuggestion[]): RealtimeSuggestion[] {
    return suggestions.sort((a, b) => {
      // Prioritize by source type
      const sourcePriority: Record<string, number> = {
        playbook: 4,
        clause_library: 3,
        regulatory: 2,
        ai_generated: 1,
        historical: 1,
      };
      
      const aPriority = sourcePriority[a.source.type] || 0;
      const bPriority = sourcePriority[b.source.type] || 0;
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.confidence - a.confidence;
    });
  }

  private dedupeRisks(risks: RiskHighlight[]): RiskHighlight[] {
    const seen = new Set<string>();
    return risks.filter(risk => {
      const key = `${risk.type}_${risk.position.startOffset}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async getHistoricalCompletions(
    text: string,
    clauseType: string | undefined,
    tenantId: string
  ): Promise<ClauseCompletion[]> {
    // In a full implementation, this would search through historical contracts
    // For now, return empty as this requires significant data infrastructure
    return [];
  }

  private generateContextualTips(
    text: string,
    context: CopilotContext
  ): ContextualTip[] {
    const tips: ContextualTip[] = [];

    if (context.isNegotiating && !text.includes('shall')) {
      tips.push({
        id: 'tip_shall',
        tip: 'Consider using "shall" for obligatory terms - it\'s more legally precise than "will" or "must"',
        relevance: 0.7,
        source: 'Legal Best Practices',
      });
    }

    if (text.length > 500 && !text.includes(';')) {
      tips.push({
        id: 'tip_readability',
        tip: 'Long clauses may benefit from numbered subclauses for clarity',
        relevance: 0.6,
        source: 'Readability Guidelines',
      });
    }

    return tips;
  }

  private mapRiskLevel(level: string | null): RiskSeverity {
    if (!level) return 'info';
    const map: Record<string, RiskSeverity> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
    };
    return map[level.toUpperCase()] || 'info';
  }
}

// ============================================================================
// TYPES FOR INTERNAL USE
// ============================================================================

interface RiskPattern {
  regex: RegExp;
  severity: RiskSeverity;
  type: string;
  explanation: string;
  suggestedFix?: string;
}

interface CachedClause {
  id: string;
  content: string;
  category: string;
  embedding?: number[];
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let copilotInstance: AICopilotService | null = null;

export function getAICopilotService(): AICopilotService {
  if (!copilotInstance) {
    copilotInstance = new AICopilotService();
  }
  return copilotInstance;
}

export const aiCopilotService = getAICopilotService();

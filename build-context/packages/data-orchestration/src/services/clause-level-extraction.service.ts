/**
 * Clause-Level Extraction Service
 * 
 * Provides granular clause-level extraction and analysis:
 * 1. Intelligent clause boundary detection
 * 2. Hierarchical clause structure (sections, subsections)
 * 3. Clause classification by type
 * 4. Cross-reference detection
 * 5. Clause-specific field extraction
 * 6. Clause risk assessment
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('clause-level-extraction');

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedClause {
  id: string;
  number: string; // e.g., "5.2.1", "A", "III"
  title: string;
  fullText: string;
  summary: string;
  type: ClauseType;
  importance: 'critical' | 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  riskFactors: string[];
  parent?: string; // Parent clause ID
  children: string[]; // Child clause IDs
  crossReferences: CrossReference[];
  extractedFields: ClauseField[];
  definedTerms: string[];
  startPosition: number;
  endPosition: number;
  confidence: number;
}

export type ClauseType = 
  | 'definitions'
  | 'term_duration'
  | 'payment'
  | 'termination'
  | 'liability'
  | 'indemnification'
  | 'confidentiality'
  | 'intellectual_property'
  | 'warranties'
  | 'representations'
  | 'force_majeure'
  | 'dispute_resolution'
  | 'governing_law'
  | 'assignment'
  | 'notices'
  | 'insurance'
  | 'compliance'
  | 'audit_rights'
  | 'data_protection'
  | 'sla'
  | 'non_compete'
  | 'non_solicitation'
  | 'general_provisions'
  | 'amendments'
  | 'entire_agreement'
  | 'severability'
  | 'waiver'
  | 'other';

export interface CrossReference {
  targetClause: string; // Section number or name
  referenceType: 'subject_to' | 'notwithstanding' | 'pursuant_to' | 'as_defined_in' | 'see' | 'incorporated';
  context: string;
}

export interface ClauseField {
  name: string;
  displayName: string;
  value: any;
  valueType: string;
  confidence: number;
  extractedFrom: string; // The text snippet it came from
}

export interface ClauseExtractionResult {
  success: boolean;
  clauses: ExtractedClause[];
  hierarchy: ClauseHierarchy;
  summary: {
    totalClauses: number;
    byType: Record<ClauseType, number>;
    criticalClauses: number;
    highRiskClauses: number;
    missingStandardClauses: string[];
  };
  crossReferenceMap: Map<string, string[]>;
  definedTerms: Map<string, string>;
}

export interface ClauseHierarchy {
  rootClauses: string[]; // IDs of top-level clauses
  tree: Map<string, string[]>; // Parent ID -> Child IDs
  depth: number;
}

// ============================================================================
// CLAUSE PATTERNS
// ============================================================================

const CLAUSE_HEADER_PATTERNS = [
  // Numbered sections: 1, 1.1, 1.1.1, etc.
  /^(\d+(?:\.\d+)*)\s*[\.\:\-]?\s*([A-Z][A-Za-z\s,&]+?)(?:\.|$)/m,
  // Article headers: ARTICLE I, Article 1, etc.
  /^(?:ARTICLE|Article)\s+([IVXLCDM]+|\d+)[:\.\s]+(.+?)(?:\n|$)/m,
  // Section headers: SECTION 1, Section 1.1, etc.
  /^(?:SECTION|Section)\s+(\d+(?:\.\d+)?)[:\.\s]+(.+?)(?:\n|$)/m,
  // Lettered clauses: (a), (b), A., B., etc.
  /^\(([a-z]|[ivx]+)\)\s+(.+?)(?:\n|$)/m,
  // All-caps headers
  /^([A-Z][A-Z\s]{2,}):?\s*$/m,
];

const CLAUSE_TYPE_PATTERNS: Record<ClauseType, RegExp[]> = {
  definitions: [
    /definition|define|means|shall mean|refer to|interpreted/i,
    /"[^"]+"\s+means/i,
  ],
  term_duration: [
    /term|duration|period|commence|effective date|expir/i,
  ],
  payment: [
    /payment|pay|invoice|fee|price|compensation|remuneration|billing/i,
  ],
  termination: [
    /terminat|end|cancel|discontinu|cessation/i,
  ],
  liability: [
    /liabilit|liable|damage|loss|cap|limit/i,
  ],
  indemnification: [
    /indemnif|hold harmless|defend|third.party.claim/i,
  ],
  confidentiality: [
    /confidential|secret|non.disclosure|nda|proprietary/i,
  ],
  intellectual_property: [
    /intellectual property|patent|copyright|trademark|trade secret|ip|ownership/i,
  ],
  warranties: [
    /warrant|guarantee|represent and warrant/i,
  ],
  representations: [
    /represent|certif|acknowledge/i,
  ],
  force_majeure: [
    /force majeure|act of god|unforeseeable|beyond.*control/i,
  ],
  dispute_resolution: [
    /dispute|arbitrat|mediat|litigat|resolution/i,
  ],
  governing_law: [
    /governing law|jurisdiction|applicable law|choice of law|venue/i,
  ],
  assignment: [
    /assign|transfer|delegate|successor/i,
  ],
  notices: [
    /notice|notification|communication|written notice/i,
  ],
  insurance: [
    /insurance|coverage|policy|insured/i,
  ],
  compliance: [
    /complian|regulatory|law|statute|regulation/i,
  ],
  audit_rights: [
    /audit|inspect|examination|access to record/i,
  ],
  data_protection: [
    /data protection|privacy|gdpr|ccpa|personal data|data processing/i,
  ],
  sla: [
    /service level|sla|uptime|availability|performance/i,
  ],
  non_compete: [
    /non.compete|compete|competitive/i,
  ],
  non_solicitation: [
    /non.solicit|solicit|hire|recruit/i,
  ],
  general_provisions: [
    /general|miscellaneous|boilerplate/i,
  ],
  amendments: [
    /amend|modif|change|supplement/i,
  ],
  entire_agreement: [
    /entire agreement|whole agreement|supersede|integration/i,
  ],
  severability: [
    /severab|invalid|unenforceable|remain in effect/i,
  ],
  waiver: [
    /waive|waiver|forbearance/i,
  ],
  other: [],
};

const CROSS_REFERENCE_PATTERNS = [
  { pattern: /subject to (?:Section|Article|Clause)\s+(\d+(?:\.\d+)?)/gi, type: 'subject_to' as const },
  { pattern: /notwithstanding (?:Section|Article|Clause)\s+(\d+(?:\.\d+)?)/gi, type: 'notwithstanding' as const },
  { pattern: /pursuant to (?:Section|Article|Clause)\s+(\d+(?:\.\d+)?)/gi, type: 'pursuant_to' as const },
  { pattern: /as defined in (?:Section|Article|Clause)\s+(\d+(?:\.\d+)?)/gi, type: 'as_defined_in' as const },
  { pattern: /see (?:Section|Article|Clause)\s+(\d+(?:\.\d+)?)/gi, type: 'see' as const },
  { pattern: /incorporated (?:herein )?by reference/gi, type: 'incorporated' as const },
];

const RISK_INDICATORS = {
  high: [
    /unlimited liability/i,
    /sole discretion/i,
    /without cause/i,
    /immediately terminate/i,
    /waive.*right/i,
    /perpetual/i,
    /irrevocable/i,
    /exclusive.*right/i,
    /all intellectual property/i,
    /no limitation/i,
    /indemnify.*third.*part/i,
  ],
  medium: [
    /auto.?renew/i,
    /price increase/i,
    /without prior.*notice/i,
    /at any time/i,
    /upon.*day.*notice/i,
    /limitation of liability/i,
    /except.*gross negligence/i,
    /material breach/i,
  ],
  low: [
    /reasonable/i,
    /mutual.*agreement/i,
    /prior written consent/i,
    /good faith/i,
    /commercially reasonable/i,
  ],
};

// ============================================================================
// CLAUSE-LEVEL EXTRACTION SERVICE
// ============================================================================

export class ClauseLevelExtractionService {
  private static instance: ClauseLevelExtractionService;

  private constructor() {
    logger.info('Clause-Level Extraction Service initialized');
  }

  static getInstance(): ClauseLevelExtractionService {
    if (!ClauseLevelExtractionService.instance) {
      ClauseLevelExtractionService.instance = new ClauseLevelExtractionService();
    }
    return ClauseLevelExtractionService.instance;
  }

  // ==========================================================================
  // MAIN EXTRACTION METHOD
  // ==========================================================================

  async extractClauses(documentText: string): Promise<ClauseExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Detect clause boundaries
      const rawClauses = this.detectClauseBoundaries(documentText);
      
      // Step 2: Classify each clause
      const classifiedClauses = rawClauses.map(clause => this.classifyClause(clause, documentText));
      
      // Step 3: Build hierarchy
      const hierarchy = this.buildClauseHierarchy(classifiedClauses);
      
      // Step 4: Detect cross-references
      const crossReferenceMap = this.detectCrossReferences(classifiedClauses);
      
      // Step 5: Extract defined terms
      const definedTerms = this.extractDefinedTerms(documentText);
      
      // Step 6: Extract clause-specific fields
      const enrichedClauses = classifiedClauses.map(clause => 
        this.extractClauseFields(clause, documentText)
      );
      
      // Step 7: Identify missing standard clauses
      const missingClauses = this.identifyMissingClauses(enrichedClauses);
      
      // Build summary
      const summary = this.buildSummary(enrichedClauses, missingClauses);
      
      logger.info({ 
        clauseCount: enrichedClauses.length, 
        duration: Date.now() - startTime 
      }, 'Clause extraction complete');
      
      return {
        success: true,
        clauses: enrichedClauses,
        hierarchy,
        summary,
        crossReferenceMap,
        definedTerms,
      };
    } catch (error) {
      logger.error({ error }, 'Clause extraction failed');
      return {
        success: false,
        clauses: [],
        hierarchy: { rootClauses: [], tree: new Map(), depth: 0 },
        summary: {
          totalClauses: 0,
          byType: {} as Record<ClauseType, number>,
          criticalClauses: 0,
          highRiskClauses: 0,
          missingStandardClauses: [],
        },
        crossReferenceMap: new Map(),
        definedTerms: new Map(),
      };
    }
  }

  // ==========================================================================
  // CLAUSE BOUNDARY DETECTION
  // ==========================================================================

  private detectClauseBoundaries(text: string): Partial<ExtractedClause>[] {
    const clauses: Partial<ExtractedClause>[] = [];
    const lines = text.split('\n');
    
    let currentClause: Partial<ExtractedClause> | null = null;
    let charPosition = 0;
    let clauseId = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = charPosition;
      charPosition += line.length + 1;
      
      // Check if this line starts a new clause
      let isNewClause = false;
      let clauseNumber = '';
      let clauseTitle = '';
      
      for (const pattern of CLAUSE_HEADER_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          isNewClause = true;
          clauseNumber = match[1] || '';
          clauseTitle = (match[2] || line).trim();
          break;
        }
      }
      
      if (isNewClause) {
        // Save previous clause
        if (currentClause && currentClause.fullText) {
          currentClause.endPosition = lineStart - 1;
          clauses.push(currentClause);
        }
        
        // Start new clause
        currentClause = {
          id: `clause-${++clauseId}`,
          number: clauseNumber,
          title: clauseTitle,
          fullText: line + '\n',
          startPosition: lineStart,
          children: [],
          crossReferences: [],
          extractedFields: [],
          definedTerms: [],
          confidence: 0.8,
        };
      } else if (currentClause) {
        // Continue current clause
        currentClause.fullText += line + '\n';
      }
    }
    
    // Don't forget the last clause
    if (currentClause && currentClause.fullText) {
      currentClause.endPosition = charPosition;
      clauses.push(currentClause);
    }
    
    return clauses;
  }

  // ==========================================================================
  // CLAUSE CLASSIFICATION
  // ==========================================================================

  private classifyClause(clause: Partial<ExtractedClause>, documentText: string): ExtractedClause {
    const text = clause.fullText || '';
    const title = clause.title || '';
    
    // Determine clause type
    let detectedType: ClauseType = 'other';
    let maxScore = 0;
    
    for (const [type, patterns] of Object.entries(CLAUSE_TYPE_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(title)) score += 3;
        if (pattern.test(text)) score += 1;
      }
      if (score > maxScore) {
        maxScore = score;
        detectedType = type as ClauseType;
      }
    }
    
    // Assess risk level
    const { riskLevel, riskFactors } = this.assessClauseRisk(text);
    
    // Determine importance based on type and risk
    const importance = this.determineImportance(detectedType, riskLevel);
    
    // Generate summary
    const summary = this.generateClauseSummary(text, detectedType);
    
    return {
      ...clause,
      type: detectedType,
      summary,
      importance,
      riskLevel,
      riskFactors,
      children: clause.children || [],
      crossReferences: this.extractClauseCrossReferences(text),
      extractedFields: clause.extractedFields || [],
      definedTerms: this.extractClauseDefinedTerms(text),
      confidence: this.calculateClassificationConfidence(maxScore, detectedType),
    } as ExtractedClause;
  }

  private assessClauseRisk(text: string): { riskLevel: ExtractedClause['riskLevel']; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let highCount = 0;
    let mediumCount = 0;
    
    for (const pattern of RISK_INDICATORS.high) {
      if (pattern.test(text)) {
        highCount++;
        const match = text.match(pattern);
        if (match) riskFactors.push(match[0]);
      }
    }
    
    for (const pattern of RISK_INDICATORS.medium) {
      if (pattern.test(text)) {
        mediumCount++;
        const match = text.match(pattern);
        if (match && riskFactors.length < 5) riskFactors.push(match[0]);
      }
    }
    
    let riskLevel: ExtractedClause['riskLevel'] = 'none';
    if (highCount >= 2) riskLevel = 'high';
    else if (highCount >= 1 || mediumCount >= 3) riskLevel = 'medium';
    else if (mediumCount >= 1) riskLevel = 'low';
    
    return { riskLevel, riskFactors };
  }

  private determineImportance(type: ClauseType, riskLevel: string): ExtractedClause['importance'] {
    const criticalTypes: ClauseType[] = ['termination', 'liability', 'indemnification', 'payment', 'intellectual_property'];
    const highTypes: ClauseType[] = ['confidentiality', 'term_duration', 'warranties', 'data_protection', 'sla'];
    
    if (riskLevel === 'high') return 'critical';
    if (criticalTypes.includes(type)) return 'critical';
    if (highTypes.includes(type) || riskLevel === 'medium') return 'high';
    if (type === 'other') return 'low';
    return 'medium';
  }

  private generateClauseSummary(text: string, type: ClauseType): string {
    // Take first 200 chars and clean up
    let summary = text.substring(0, 300);
    summary = summary.replace(/\s+/g, ' ').trim();
    
    if (summary.length < text.length) {
      summary += '...';
    }
    
    return summary;
  }

  private calculateClassificationConfidence(score: number, type: ClauseType): number {
    if (type === 'other') return 0.5;
    if (score >= 5) return 0.95;
    if (score >= 3) return 0.85;
    if (score >= 2) return 0.75;
    return 0.65;
  }

  // ==========================================================================
  // HIERARCHY BUILDING
  // ==========================================================================

  private buildClauseHierarchy(clauses: ExtractedClause[]): ClauseHierarchy {
    const tree = new Map<string, string[]>();
    const rootClauses: string[] = [];
    
    // Sort clauses by their number for proper hierarchy detection
    const sortedClauses = [...clauses].sort((a, b) => 
      this.compareClauseNumbers(a.number, b.number)
    );
    
    // Build parent-child relationships based on numbering
    for (const clause of sortedClauses) {
      const parentNumber = this.getParentClauseNumber(clause.number);
      
      if (!parentNumber) {
        rootClauses.push(clause.id);
      } else {
        // Find parent
        const parent = sortedClauses.find(c => c.number === parentNumber);
        if (parent) {
          clause.parent = parent.id;
          const children = tree.get(parent.id) || [];
          children.push(clause.id);
          tree.set(parent.id, children);
          parent.children.push(clause.id);
        } else {
          // Parent not found, treat as root
          rootClauses.push(clause.id);
        }
      }
    }
    
    // Calculate depth
    let depth = 0;
    for (const clause of clauses) {
      const clauseDepth = (clause.number.match(/\./g) || []).length + 1;
      if (clauseDepth > depth) depth = clauseDepth;
    }
    
    return { rootClauses, tree, depth };
  }

  private compareClauseNumbers(a: string, b: string): number {
    const aParts = a.split('.').map(p => parseInt(p) || 0);
    const bParts = b.split('.').map(p => parseInt(p) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  }

  private getParentClauseNumber(number: string): string | null {
    const parts = number.split('.');
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('.');
  }

  // ==========================================================================
  // CROSS-REFERENCE DETECTION
  // ==========================================================================

  private detectCrossReferences(clauses: ExtractedClause[]): Map<string, string[]> {
    const crossRefMap = new Map<string, string[]>();
    
    for (const clause of clauses) {
      const refs: string[] = [];
      for (const xref of clause.crossReferences) {
        refs.push(xref.targetClause);
      }
      if (refs.length > 0) {
        crossRefMap.set(clause.id, refs);
      }
    }
    
    return crossRefMap;
  }

  private extractClauseCrossReferences(text: string): CrossReference[] {
    const refs: CrossReference[] = [];
    
    for (const { pattern, type } of CROSS_REFERENCE_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        refs.push({
          targetClause: match[1] || match[0],
          referenceType: type,
          context: text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50).trim(),
        });
      }
    }
    
    return refs;
  }

  // ==========================================================================
  // DEFINED TERMS EXTRACTION
  // ==========================================================================

  private extractDefinedTerms(text: string): Map<string, string> {
    const terms = new Map<string, string>();
    
    // Pattern: "Term" means/shall mean...
    const definitionPattern = /[""]([^""]+)[""]\s+(?:means|shall mean|refers to|is defined as)\s+([^.]+\.)/gi;
    
    let match;
    while ((match = definitionPattern.exec(text)) !== null) {
      const term = match[1].trim();
      const definition = match[2].trim();
      terms.set(term, definition);
    }
    
    return terms;
  }

  private extractClauseDefinedTerms(text: string): string[] {
    const terms: string[] = [];
    
    // Look for quoted terms that might be definitions
    const quotedPattern = /[""]([A-Z][^""]{2,30})[""]/g;
    
    let match;
    while ((match = quotedPattern.exec(text)) !== null) {
      if (!terms.includes(match[1])) {
        terms.push(match[1]);
      }
    }
    
    return terms;
  }

  // ==========================================================================
  // CLAUSE-SPECIFIC FIELD EXTRACTION
  // ==========================================================================

  private extractClauseFields(clause: ExtractedClause, documentText: string): ExtractedClause {
    const fields: ClauseField[] = [];
    const text = clause.fullText;
    
    // Extract based on clause type
    switch (clause.type) {
      case 'payment':
        fields.push(...this.extractPaymentFields(text));
        break;
      case 'term_duration':
        fields.push(...this.extractTermFields(text));
        break;
      case 'termination':
        fields.push(...this.extractTerminationFields(text));
        break;
      case 'liability':
        fields.push(...this.extractLiabilityFields(text));
        break;
      case 'sla':
        fields.push(...this.extractSLAFields(text));
        break;
      case 'confidentiality':
        fields.push(...this.extractConfidentialityFields(text));
        break;
      case 'insurance':
        fields.push(...this.extractInsuranceFields(text));
        break;
    }
    
    return { ...clause, extractedFields: fields };
  }

  private extractPaymentFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Payment amount
    const amountMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
    if (amountMatch) {
      fields.push({
        name: 'payment_amount',
        displayName: 'Payment Amount',
        value: { amount: parseFloat(amountMatch[1].replace(/,/g, '')), currency: 'USD' },
        valueType: 'currency',
        confidence: 0.85,
        extractedFrom: amountMatch[0],
      });
    }
    
    // Payment terms (net days)
    const termsMatch = text.match(/(?:net|within)\s*(\d+)\s*(?:calendar\s+)?days?/i);
    if (termsMatch) {
      fields.push({
        name: 'payment_terms_days',
        displayName: 'Payment Terms (Days)',
        value: parseInt(termsMatch[1]),
        valueType: 'number',
        confidence: 0.9,
        extractedFrom: termsMatch[0],
      });
    }
    
    return fields;
  }

  private extractTermFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Initial term
    const termMatch = text.match(/(?:initial\s+)?term\s+(?:of|is|shall be)\s+(\d+)\s*(year|month|day)s?/i);
    if (termMatch) {
      fields.push({
        name: 'initial_term',
        displayName: 'Initial Term',
        value: { value: parseInt(termMatch[1]), unit: termMatch[2] + 's' },
        valueType: 'duration',
        confidence: 0.9,
        extractedFrom: termMatch[0],
      });
    }
    
    // Renewal term
    const renewalMatch = text.match(/renew(?:al)?\s+(?:for\s+)?(?:successive|additional)\s+(\d+)\s*(year|month)s?\s*(?:term|period)?/i);
    if (renewalMatch) {
      fields.push({
        name: 'renewal_term',
        displayName: 'Renewal Term',
        value: { value: parseInt(renewalMatch[1]), unit: renewalMatch[2] + 's' },
        valueType: 'duration',
        confidence: 0.85,
        extractedFrom: renewalMatch[0],
      });
    }
    
    return fields;
  }

  private extractTerminationFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Notice period
    const noticeMatch = text.match(/(\d+)\s*(?:calendar\s+|business\s+)?(days?|months?)\s+(?:prior\s+)?(?:written\s+)?notice/i);
    if (noticeMatch) {
      fields.push({
        name: 'termination_notice',
        displayName: 'Termination Notice Period',
        value: { value: parseInt(noticeMatch[1]), unit: noticeMatch[2] },
        valueType: 'duration',
        confidence: 0.9,
        extractedFrom: noticeMatch[0],
      });
    }
    
    // Termination for convenience
    const convenienceMatch = text.match(/terminat\w*\s+(?:for\s+)?(?:any\s+reason|convenience|without\s+cause)/i);
    if (convenienceMatch) {
      fields.push({
        name: 'termination_for_convenience',
        displayName: 'Termination for Convenience',
        value: true,
        valueType: 'boolean',
        confidence: 0.85,
        extractedFrom: convenienceMatch[0],
      });
    }
    
    return fields;
  }

  private extractLiabilityFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Liability cap
    const capMatch = text.match(/(?:not\s+)?exceed\s+(?:the\s+)?(?:total\s+|aggregate\s+)?(?:of\s+)?\$?\s*([\d,]+(?:\.\d{2})?)/i);
    if (capMatch) {
      fields.push({
        name: 'liability_cap',
        displayName: 'Liability Cap',
        value: { amount: parseFloat(capMatch[1].replace(/,/g, '')), currency: 'USD' },
        valueType: 'currency',
        confidence: 0.85,
        extractedFrom: capMatch[0],
      });
    }
    
    // Unlimited liability
    const unlimitedMatch = text.match(/unlimited\s+liabilit|no\s+limitation.*liabilit/i);
    if (unlimitedMatch) {
      fields.push({
        name: 'unlimited_liability',
        displayName: 'Unlimited Liability',
        value: true,
        valueType: 'boolean',
        confidence: 0.9,
        extractedFrom: unlimitedMatch[0],
      });
    }
    
    return fields;
  }

  private extractSLAFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Uptime percentage
    const uptimeMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:uptime|availability)/i);
    if (uptimeMatch) {
      fields.push({
        name: 'sla_uptime',
        displayName: 'SLA Uptime',
        value: parseFloat(uptimeMatch[1]),
        valueType: 'percentage',
        confidence: 0.92,
        extractedFrom: uptimeMatch[0],
      });
    }
    
    // Response time
    const responseMatch = text.match(/(?:response|resolution)\s+time[:\s]+(\d+)\s*(hour|minute|day)s?/i);
    if (responseMatch) {
      fields.push({
        name: 'sla_response_time',
        displayName: 'SLA Response Time',
        value: { value: parseInt(responseMatch[1]), unit: responseMatch[2] + 's' },
        valueType: 'duration',
        confidence: 0.85,
        extractedFrom: responseMatch[0],
      });
    }
    
    return fields;
  }

  private extractConfidentialityFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Confidentiality period
    const periodMatch = text.match(/(\d+)\s*(year|month)s?\s+(?:after|following|from)/i);
    if (periodMatch) {
      fields.push({
        name: 'confidentiality_period',
        displayName: 'Confidentiality Period',
        value: { value: parseInt(periodMatch[1]), unit: periodMatch[2] + 's' },
        valueType: 'duration',
        confidence: 0.8,
        extractedFrom: periodMatch[0],
      });
    }
    
    return fields;
  }

  private extractInsuranceFields(text: string): ClauseField[] {
    const fields: ClauseField[] = [];
    
    // Insurance amount
    const amountMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per|each|aggregate)/i);
    if (amountMatch) {
      fields.push({
        name: 'insurance_minimum',
        displayName: 'Minimum Insurance',
        value: { amount: parseFloat(amountMatch[1].replace(/,/g, '')), currency: 'USD' },
        valueType: 'currency',
        confidence: 0.85,
        extractedFrom: amountMatch[0],
      });
    }
    
    return fields;
  }

  // ==========================================================================
  // MISSING CLAUSES DETECTION
  // ==========================================================================

  private identifyMissingClauses(clauses: ExtractedClause[]): string[] {
    const standardClauses: ClauseType[] = [
      'term_duration',
      'payment',
      'termination',
      'liability',
      'confidentiality',
      'governing_law',
    ];
    
    const presentTypes = new Set(clauses.map(c => c.type));
    const missing: string[] = [];
    
    for (const type of standardClauses) {
      if (!presentTypes.has(type)) {
        missing.push(type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      }
    }
    
    return missing;
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  private buildSummary(clauses: ExtractedClause[], missingClauses: string[]): ClauseExtractionResult['summary'] {
    const byType = {} as Record<ClauseType, number>;
    
    for (const clause of clauses) {
      byType[clause.type] = (byType[clause.type] || 0) + 1;
    }
    
    return {
      totalClauses: clauses.length,
      byType,
      criticalClauses: clauses.filter(c => c.importance === 'critical').length,
      highRiskClauses: clauses.filter(c => c.riskLevel === 'high').length,
      missingStandardClauses: missingClauses,
    };
  }

  // ==========================================================================
  // GET CLAUSE BY TYPE
  // ==========================================================================

  getClausesByType(result: ClauseExtractionResult, type: ClauseType): ExtractedClause[] {
    return result.clauses.filter(c => c.type === type);
  }

  getHighRiskClauses(result: ClauseExtractionResult): ExtractedClause[] {
    return result.clauses.filter(c => c.riskLevel === 'high');
  }

  getCriticalClauses(result: ClauseExtractionResult): ExtractedClause[] {
    return result.clauses.filter(c => c.importance === 'critical');
  }
}

// Export singleton
export const clauseLevelExtraction = ClauseLevelExtractionService.getInstance();

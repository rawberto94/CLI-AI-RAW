/**
 * Contract Template Learning Service
 * 
 * Learns company-specific contract templates:
 * - Detects recurring template patterns
 * - Learns field locations within templates
 * - Improves extraction accuracy for known templates
 * - Suggests template classifications
 * 
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';

const logger = createLogger('template-learning');

// =============================================================================
// TYPES
// =============================================================================

export interface LearnedTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sourceContractIds: string[];
  structure: TemplateStructure;
  fieldMappings: FieldMapping[];
  confidence: number;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'active' | 'archived';
}

export interface TemplateStructure {
  sectionOrder: string[];
  headerPatterns: string[];
  footerPatterns: string[];
  signatureBlockPattern?: string;
  pageCount?: { min: number; max: number };
  estimatedLength?: { min: number; max: number };
  identifyingPhrases: string[];
  documentType: string;
}

export interface FieldMapping {
  fieldName: string;
  artifactType: string;
  locationHints: FieldLocationHint[];
  extractionPatterns: string[];
  validationRules?: string[];
  defaultValue?: unknown;
  required: boolean;
  accuracy: number;
  sampleValues: string[];
}

export interface FieldLocationHint {
  section?: string;
  nearText?: string;
  afterLabel?: string;
  beforeText?: string;
  pageRange?: { start: number; end: number };
  relativePosition?: 'beginning' | 'middle' | 'end';
}

export interface TemplateMatchResult {
  templateId: string;
  templateName: string;
  confidence: number;
  matchedPatterns: string[];
  suggestedMappings: FieldMapping[];
}

export interface TemplateLearningSession {
  id: string;
  tenantId: string;
  contractIds: string[];
  status: 'analyzing' | 'learning' | 'reviewing' | 'completed' | 'failed';
  progress: number;
  discoveredPatterns: DiscoveredPattern[];
  suggestedTemplate?: LearnedTemplate;
  startedAt: Date;
  completedAt?: Date;
}

export interface DiscoveredPattern {
  type: 'header' | 'section' | 'field_label' | 'signature' | 'structure';
  pattern: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

// =============================================================================
// CONTRACT TEMPLATE LEARNING SERVICE
// =============================================================================

export class ContractTemplateLearningService {
  private static instance: ContractTemplateLearningService;
  private templates: Map<string, LearnedTemplate> = new Map();
  private learningSessions: Map<string, TemplateLearningSession> = new Map();
  private openai: OpenAI | null = null;

  private constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  static getInstance(): ContractTemplateLearningService {
    if (!ContractTemplateLearningService.instance) {
      ContractTemplateLearningService.instance = new ContractTemplateLearningService();
    }
    return ContractTemplateLearningService.instance;
  }

  // ===========================================================================
  // TEMPLATE MANAGEMENT
  // ===========================================================================

  getTemplate(templateId: string): LearnedTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(tenantId: string, status?: LearnedTemplate['status']): LearnedTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.tenantId === tenantId && (!status || t.status === status))
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  updateTemplate(
    templateId: string,
    updates: Partial<Pick<LearnedTemplate, 'name' | 'description' | 'status' | 'fieldMappings'>>
  ): LearnedTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    Object.assign(template, updates, { updatedAt: new Date() });
    this.templates.set(templateId, template);

    return template;
  }

  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  // ===========================================================================
  // TEMPLATE MATCHING
  // ===========================================================================

  async matchTemplate(
    tenantId: string,
    contractText: string,
    contractMetadata?: Record<string, unknown>
  ): Promise<TemplateMatchResult | null> {
    const templates = this.listTemplates(tenantId, 'active');
    if (templates.length === 0) return null;

    let bestMatch: TemplateMatchResult | null = null;
    let bestScore = 0;

    for (const template of templates) {
      const matchResult = this.scoreTemplateMatch(template, contractText, contractMetadata);
      if (matchResult.confidence > bestScore && matchResult.confidence >= 0.7) {
        bestScore = matchResult.confidence;
        bestMatch = matchResult;
      }
    }

    if (bestMatch) {
      // Update usage stats
      const template = this.templates.get(bestMatch.templateId);
      if (template) {
        template.usageCount++;
        template.lastUsedAt = new Date();
      }
    }

    return bestMatch;
  }

  private scoreTemplateMatch(
    template: LearnedTemplate,
    contractText: string,
    _metadata?: Record<string, unknown>
  ): TemplateMatchResult {
    const normalizedText = contractText.toLowerCase();
    const matchedPatterns: string[] = [];
    let totalScore = 0;
    let patternCount = 0;

    // Check identifying phrases
    for (const phrase of template.structure.identifyingPhrases) {
      patternCount++;
      if (normalizedText.includes(phrase.toLowerCase())) {
        matchedPatterns.push(phrase);
        totalScore += 1;
      }
    }

    // Check header patterns
    for (const pattern of template.structure.headerPatterns) {
      patternCount++;
      if (this.matchPattern(normalizedText, pattern)) {
        matchedPatterns.push(`header: ${pattern}`);
        totalScore += 0.5;
      }
    }

    // Check section order (simplified)
    let sectionMatchScore = 0;
    let lastIndex = -1;
    for (const section of template.structure.sectionOrder) {
      const index = normalizedText.indexOf(section.toLowerCase());
      if (index > lastIndex) {
        sectionMatchScore += 1;
        lastIndex = index;
      }
    }
    if (template.structure.sectionOrder.length > 0) {
      patternCount++;
      totalScore += sectionMatchScore / template.structure.sectionOrder.length;
    }

    const confidence = patternCount > 0 ? totalScore / patternCount : 0;

    return {
      templateId: template.id,
      templateName: template.name,
      confidence,
      matchedPatterns,
      suggestedMappings: template.fieldMappings,
    };
  }

  private matchPattern(text: string, pattern: string): boolean {
    // Support simple wildcards
    const regexPattern = pattern
      .toLowerCase()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    
    try {
      return new RegExp(regexPattern).test(text);
    } catch {
      return text.includes(pattern.toLowerCase());
    }
  }

  // ===========================================================================
  // TEMPLATE LEARNING
  // ===========================================================================

  async startLearningSession(
    tenantId: string,
    contractIds: string[],
    contractTexts: string[]
  ): Promise<TemplateLearningSession> {
    const sessionId = `learn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session: TemplateLearningSession = {
      id: sessionId,
      tenantId,
      contractIds,
      status: 'analyzing',
      progress: 0,
      discoveredPatterns: [],
      startedAt: new Date(),
    };

    this.learningSessions.set(sessionId, session);

    // Start async learning process
    this.runLearning(session, contractTexts).catch(error => {
      logger.error({ error, sessionId }, 'Learning session failed');
      session.status = 'failed';
    });

    return session;
  }

  private async runLearning(session: TemplateLearningSession, contractTexts: string[]): Promise<void> {
    try {
      // Phase 1: Discover patterns
      session.status = 'analyzing';
      session.progress = 10;

      const patterns = await this.discoverPatterns(contractTexts);
      session.discoveredPatterns = patterns;
      session.progress = 40;

      // Phase 2: Learn structure
      session.status = 'learning';
      const structure = await this.learnStructure(contractTexts, patterns);
      session.progress = 60;

      // Phase 3: Learn field mappings
      const fieldMappings = await this.learnFieldMappings(contractTexts, patterns);
      session.progress = 80;

      // Phase 4: Create template
      const template = await this.createTemplateFromLearning(
        session.tenantId,
        session.contractIds,
        structure,
        fieldMappings,
        patterns
      );

      session.suggestedTemplate = template;
      session.status = 'reviewing';
      session.progress = 100;
      session.completedAt = new Date();

      logger.info({ sessionId: session.id, templateId: template.id }, 'Learning session completed');
    } catch (error) {
      session.status = 'failed';
      throw error;
    }
  }

  private async discoverPatterns(contractTexts: string[]): Promise<DiscoveredPattern[]> {
    const patterns: DiscoveredPattern[] = [];
    
    // Find common headers
    const headerPatterns = this.findCommonPhrases(contractTexts, 50, 200);
    for (const [pattern, count] of headerPatterns) {
      if (count >= contractTexts.length * 0.7) {
        patterns.push({
          type: 'header',
          pattern,
          frequency: count / contractTexts.length,
          confidence: count / contractTexts.length,
          examples: [pattern],
        });
      }
    }

    // Find section patterns
    const sectionPatterns = this.findSectionPatterns(contractTexts);
    patterns.push(...sectionPatterns);

    // Find field label patterns
    const fieldPatterns = this.findFieldLabelPatterns(contractTexts);
    patterns.push(...fieldPatterns);

    return patterns;
  }

  private findCommonPhrases(
    texts: string[],
    minLength: number,
    maxLength: number
  ): Map<string, number> {
    const phraseCount = new Map<string, number>();

    for (const text of texts) {
      const lines = text.split('\n').filter(l => l.trim().length >= minLength && l.trim().length <= maxLength);
      
      for (const line of lines) {
        const normalized = line.trim().toLowerCase();
        phraseCount.set(normalized, (phraseCount.get(normalized) || 0) + 1);
      }
    }

    return phraseCount;
  }

  private findSectionPatterns(texts: string[]): DiscoveredPattern[] {
    const sectionRegex = /^(?:(?:\d+\.?\s*)|(?:[A-Z]+\.?\s*)|(?:ARTICLE\s+[IVX\d]+\.?\s*))(.+)$/gim;
    const sectionCount = new Map<string, number>();

    for (const text of texts) {
      const matches = text.matchAll(sectionRegex);
      for (const match of matches) {
        const section = match[0].trim().toLowerCase();
        sectionCount.set(section, (sectionCount.get(section) || 0) + 1);
      }
    }

    return Array.from(sectionCount.entries())
      .filter(([_, count]) => count >= texts.length * 0.5)
      .map(([pattern, count]) => ({
        type: 'section' as const,
        pattern,
        frequency: count / texts.length,
        confidence: count / texts.length,
        examples: [pattern],
      }));
  }

  private findFieldLabelPatterns(texts: string[]): DiscoveredPattern[] {
    const labelPatterns = [
      /effective date[:\s]+/gi,
      /expiration date[:\s]+/gi,
      /party[:\s]+/gi,
      /total (?:contract )?value[:\s]+/gi,
      /payment terms[:\s]+/gi,
      /notice period[:\s]+/gi,
      /governing law[:\s]+/gi,
    ];

    const patterns: DiscoveredPattern[] = [];

    for (const regex of labelPatterns) {
      let matchCount = 0;
      const examples: string[] = [];

      for (const text of texts) {
        const matches = text.match(regex);
        if (matches) {
          matchCount++;
          examples.push(matches[0]);
        }
      }

      if (matchCount >= texts.length * 0.5) {
        patterns.push({
          type: 'field_label',
          pattern: regex.source,
          frequency: matchCount / texts.length,
          confidence: matchCount / texts.length,
          examples: [...new Set(examples)].slice(0, 3),
        });
      }
    }

    return patterns;
  }

  private async learnStructure(
    contractTexts: string[],
    patterns: DiscoveredPattern[]
  ): Promise<TemplateStructure> {
    const sectionPatterns = patterns.filter(p => p.type === 'section');
    const headerPatterns = patterns.filter(p => p.type === 'header');

    // Determine section order from most common contract
    const sectionOrder = sectionPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)
      .map(p => p.pattern);

    // Identify document type
    const documentType = this.inferDocumentType(contractTexts[0] || '');

    return {
      sectionOrder,
      headerPatterns: headerPatterns.map(p => p.pattern),
      footerPatterns: [],
      identifyingPhrases: [
        ...headerPatterns.slice(0, 3).map(p => p.pattern),
        ...sectionPatterns.slice(0, 5).map(p => p.pattern),
      ],
      documentType,
      pageCount: {
        min: Math.min(...contractTexts.map(t => Math.ceil(t.length / 3000))),
        max: Math.max(...contractTexts.map(t => Math.ceil(t.length / 3000))),
      },
      estimatedLength: {
        min: Math.min(...contractTexts.map(t => t.length)),
        max: Math.max(...contractTexts.map(t => t.length)),
      },
    };
  }

  private inferDocumentType(text: string): string {
    const lowerText = text.toLowerCase();
    
    const types = [
      { type: 'service_agreement', keywords: ['services', 'service provider', 'deliverables'] },
      { type: 'master_services_agreement', keywords: ['master services', 'msa', 'statement of work'] },
      { type: 'nda', keywords: ['confidential', 'non-disclosure', 'proprietary information'] },
      { type: 'employment', keywords: ['employee', 'employer', 'salary', 'benefits'] },
      { type: 'lease', keywords: ['landlord', 'tenant', 'premises', 'rent'] },
      { type: 'license', keywords: ['license', 'licensor', 'licensee', 'intellectual property'] },
      { type: 'purchase_order', keywords: ['purchase order', 'po number', 'unit price'] },
    ];

    for (const { type, keywords } of types) {
      const matches = keywords.filter(kw => lowerText.includes(kw));
      if (matches.length >= 2) {
        return type;
      }
    }

    return 'general_contract';
  }

  private async learnFieldMappings(
    contractTexts: string[],
    patterns: DiscoveredPattern[]
  ): Promise<FieldMapping[]> {
    const fieldLabelPatterns = patterns.filter(p => p.type === 'field_label');
    const fieldMappings: FieldMapping[] = [];

    const commonFields = [
      { name: 'effectiveDate', artifact: 'KeyDatesArtifact', labels: ['effective date', 'start date', 'commencement date'] },
      { name: 'expirationDate', artifact: 'KeyDatesArtifact', labels: ['expiration date', 'end date', 'termination date'] },
      { name: 'totalValue', artifact: 'FinancialTermsArtifact', labels: ['total value', 'contract value', 'total amount'] },
      { name: 'paymentTerms', artifact: 'FinancialTermsArtifact', labels: ['payment terms', 'payment schedule'] },
      { name: 'noticePeriod', artifact: 'TerminationClausesArtifact', labels: ['notice period', 'notice requirement'] },
    ];

    for (const field of commonFields) {
      const matchingPatterns = fieldLabelPatterns.filter(p =>
        field.labels.some(label => p.pattern.toLowerCase().includes(label))
      );

      if (matchingPatterns.length > 0) {
        fieldMappings.push({
          fieldName: field.name,
          artifactType: field.artifact,
          locationHints: [{
            afterLabel: matchingPatterns[0].examples[0],
          }],
          extractionPatterns: matchingPatterns.map(p => p.pattern),
          required: true,
          accuracy: matchingPatterns[0].frequency,
          sampleValues: [],
        });
      }
    }

    return fieldMappings;
  }

  private async createTemplateFromLearning(
    tenantId: string,
    sourceContractIds: string[],
    structure: TemplateStructure,
    fieldMappings: FieldMapping[],
    patterns: DiscoveredPattern[]
  ): Promise<LearnedTemplate> {
    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const template: LearnedTemplate = {
      id: templateId,
      tenantId,
      name: `Learned Template - ${structure.documentType}`,
      description: `Auto-learned from ${sourceContractIds.length} contracts`,
      sourceContractIds,
      structure,
      fieldMappings,
      confidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
    };

    this.templates.set(templateId, template);

    return template;
  }

  // ===========================================================================
  // APPLY TEMPLATE
  // ===========================================================================

  generateExtractionHints(template: LearnedTemplate): string {
    const hints: string[] = [
      `## Template-Specific Extraction Hints`,
      `Document Type: ${template.structure.documentType}`,
      ``,
      `### Identifying Phrases`,
      ...template.structure.identifyingPhrases.map(p => `- "${p}"`),
      ``,
      `### Section Order`,
      ...template.structure.sectionOrder.slice(0, 10).map((s, i) => `${i + 1}. ${s}`),
      ``,
      `### Field Location Hints`,
    ];

    for (const mapping of template.fieldMappings) {
      hints.push(`**${mapping.fieldName}** (${mapping.artifactType}):`);
      for (const hint of mapping.locationHints) {
        if (hint.afterLabel) hints.push(`  - Look after: "${hint.afterLabel}"`);
        if (hint.nearText) hints.push(`  - Near: "${hint.nearText}"`);
        if (hint.section) hints.push(`  - In section: ${hint.section}`);
      }
    }

    return hints.join('\n');
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  getSession(sessionId: string): TemplateLearningSession | undefined {
    return this.learningSessions.get(sessionId);
  }

  approveSession(sessionId: string): LearnedTemplate | null {
    const session = this.learningSessions.get(sessionId);
    if (!session || !session.suggestedTemplate || session.status !== 'reviewing') {
      return null;
    }

    session.suggestedTemplate.status = 'active';
    session.status = 'completed';

    return session.suggestedTemplate;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const contractTemplateLearningService = ContractTemplateLearningService.getInstance();

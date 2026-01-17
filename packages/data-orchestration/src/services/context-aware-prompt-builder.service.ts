/**
 * Context-Aware Prompt Builder Service
 * 
 * Dynamically generates optimized prompts based on:
 * - Contract type and industry
 * - Historical extraction patterns
 * - Field-specific requirements
 * - Tenant customizations
 * - Error patterns and learnings
 * 
 * @version 1.0.0
 */

// Types
export type PromptStyle = 'concise' | 'detailed' | 'structured' | 'conversational';
export type ExtractionMode = 'precise' | 'comprehensive' | 'fast' | 'balanced';

export interface PromptContext {
  contractType?: string;
  industry?: string;
  language?: string;
  documentLength?: 'short' | 'medium' | 'long';
  complexity?: 'simple' | 'moderate' | 'complex';
  previousErrors?: string[];
  tenantId?: string;
  customInstructions?: string;
}

export interface FieldPromptConfig {
  fieldName: string;
  description: string;
  expectedFormat?: string;
  examples?: string[];
  validationRules?: string[];
  commonMistakes?: string[];
  synonyms?: string[];
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface PromptTemplate {
  id: string;
  name: string;
  contractTypes: string[];
  systemPrompt: string;
  userPromptTemplate: string;
  fieldInstructions: Map<string, string>;
  style: PromptStyle;
  mode: ExtractionMode;
  version: number;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
  fieldPrompts: Record<string, string>;
  metadata: {
    templateId?: string;
    contractType?: string;
    estimatedTokens: number;
    optimizationApplied: string[];
  };
}

export interface PromptPerformance {
  templateId: string;
  usageCount: number;
  avgConfidence: number;
  avgAccuracy: number;
  avgLatencyMs: number;
  errorRate: number;
  lastUsed: Date;
}

export interface LearningFeedback {
  promptId: string;
  fieldName: string;
  wasCorrect: boolean;
  originalValue: unknown;
  correctedValue?: unknown;
  errorType?: string;
  suggestion?: string;
}

// Default field configurations
const DEFAULT_FIELD_CONFIGS: FieldPromptConfig[] = [
  {
    fieldName: 'effectiveDate',
    description: 'The date when the contract becomes legally binding and enforceable',
    expectedFormat: 'YYYY-MM-DD',
    examples: ['2024-01-15', 'January 15, 2024'],
    validationRules: ['Must be a valid date', 'Usually on or after signature date'],
    commonMistakes: ['Confusing with signature date', 'Wrong year'],
    synonyms: ['start date', 'commencement date', 'effective as of'],
    importance: 'critical',
  },
  {
    fieldName: 'expirationDate',
    description: 'The date when the contract term ends',
    expectedFormat: 'YYYY-MM-DD',
    examples: ['2025-01-14', 'January 14, 2025'],
    validationRules: ['Must be after effective date', 'Must be a valid date'],
    commonMistakes: ['Confusing with renewal date', 'Missing "unless renewed" context'],
    synonyms: ['end date', 'termination date', 'expires on', 'term ends'],
    importance: 'critical',
  },
  {
    fieldName: 'totalValue',
    description: 'The total monetary value or price of the contract',
    expectedFormat: 'Number with currency (e.g., $100,000.00)',
    examples: ['$50,000', '€100,000', '1,500,000 USD'],
    validationRules: ['Must be positive', 'Include currency if available'],
    commonMistakes: ['Missing currency', 'Confusing with per-unit price', 'Annual vs total'],
    synonyms: ['contract value', 'total price', 'agreement value', 'contract amount'],
    importance: 'critical',
  },
  {
    fieldName: 'paymentTerms',
    description: 'The conditions and schedule for payments',
    expectedFormat: 'Text description of payment schedule and conditions',
    examples: ['Net 30', 'Due upon receipt', '50% upfront, 50% on completion'],
    validationRules: ['Should mention timing', 'Should be actionable'],
    commonMistakes: ['Only extracting partial terms', 'Missing late payment penalties'],
    synonyms: ['payment schedule', 'billing terms', 'payment conditions'],
    importance: 'high',
  },
  {
    fieldName: 'clientName',
    description: 'The name of the client/buyer party to the contract',
    expectedFormat: 'Full legal entity name',
    examples: ['Acme Corporation', 'ABC Company, Inc.', 'John Smith'],
    validationRules: ['Should be a complete name', 'Include Inc., LLC, etc. if present'],
    commonMistakes: ['Abbreviating company names', 'Missing legal entity suffix'],
    synonyms: ['buyer', 'customer', 'purchaser', 'client'],
    importance: 'critical',
  },
  {
    fieldName: 'vendorName',
    description: 'The name of the vendor/seller party to the contract',
    expectedFormat: 'Full legal entity name',
    examples: ['XYZ Services LLC', 'Tech Solutions Inc.'],
    validationRules: ['Should be a complete name', 'Include Inc., LLC, etc. if present'],
    commonMistakes: ['Confusing with client', 'Missing DBA names'],
    synonyms: ['seller', 'provider', 'supplier', 'contractor'],
    importance: 'critical',
  },
  {
    fieldName: 'autoRenewal',
    description: 'Whether the contract automatically renews at the end of the term',
    expectedFormat: 'Boolean (true/false)',
    examples: ['true', 'false'],
    validationRules: ['Must be explicitly stated or strongly implied'],
    commonMistakes: ['Assuming renewal when not stated', 'Missing opt-out conditions'],
    synonyms: ['automatic renewal', 'evergreen', 'auto-renew'],
    importance: 'high',
  },
  {
    fieldName: 'noticePeriod',
    description: 'The required notice period for termination or non-renewal',
    expectedFormat: 'Duration (e.g., 30 days, 60 days)',
    examples: ['30 days', '90 days written notice', '3 months'],
    validationRules: ['Should include time unit', 'May vary by termination type'],
    commonMistakes: ['Missing "written" requirement', 'Confusing different notice types'],
    synonyms: ['notice requirement', 'advance notice', 'termination notice'],
    importance: 'high',
  },
  {
    fieldName: 'governingLaw',
    description: 'The jurisdiction whose laws govern the contract',
    expectedFormat: 'State/Country name',
    examples: ['State of California', 'England and Wales', 'New York'],
    validationRules: ['Should be a valid jurisdiction'],
    commonMistakes: ['Incomplete jurisdiction name', 'Confusing with venue'],
    synonyms: ['applicable law', 'choice of law', 'jurisdiction'],
    importance: 'medium',
  },
  {
    fieldName: 'liabilityLimit',
    description: 'The maximum liability cap specified in the contract',
    expectedFormat: 'Currency amount or formula',
    examples: ['$1,000,000', 'Total fees paid', '2x annual contract value'],
    validationRules: ['May be absent', 'May have exceptions'],
    commonMistakes: ['Missing carve-outs', 'Confusing direct vs indirect liability'],
    synonyms: ['liability cap', 'limitation of liability', 'maximum liability'],
    importance: 'high',
  },
];

// Contract type specific instructions
const CONTRACT_TYPE_INSTRUCTIONS: Record<string, string> = {
  'MSA': `This is a Master Service Agreement. Focus on:
- General terms that apply to all future work
- Appendix/SOW references
- Change order processes
- Service level definitions`,

  'SOW': `This is a Statement of Work. Focus on:
- Specific deliverables and milestones
- Project timeline and phases
- Resources and responsibilities
- Acceptance criteria`,

  'NDA': `This is a Non-Disclosure Agreement. Focus on:
- Definition of confidential information
- Exclusions from confidentiality
- Duration of obligations
- Permitted disclosures`,

  'Employment': `This is an Employment Agreement. Focus on:
- Compensation and benefits
- Role and responsibilities
- Non-compete and non-solicitation
- Termination conditions`,

  'Lease': `This is a Lease Agreement. Focus on:
- Property description and address
- Rent amount and schedule
- Lease term and renewal options
- Maintenance responsibilities`,

  'SaaS': `This is a SaaS/Software Agreement. Focus on:
- License scope and restrictions
- User/seat counts
- Uptime guarantees (SLA)
- Data handling and privacy`,

  'Vendor': `This is a Vendor Agreement. Focus on:
- Goods/services description
- Pricing and payment terms
- Delivery obligations
- Quality requirements`,

  'Partnership': `This is a Partnership Agreement. Focus on:
- Partner contributions
- Profit/loss sharing
- Decision-making authority
- Exit and dissolution terms`,
};

class ContextAwarePromptBuilderService {
  private templates: Map<string, PromptTemplate> = new Map();
  private fieldConfigs: Map<string, FieldPromptConfig> = new Map();
  private performance: Map<string, PromptPerformance> = new Map();
  private learnings: Map<string, LearningFeedback[]> = new Map();
  private tenantCustomizations: Map<string, Record<string, string>> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Load default field configs
    DEFAULT_FIELD_CONFIGS.forEach(config => {
      this.fieldConfigs.set(config.fieldName, config);
    });

    // Create default templates
    this.createDefaultTemplates();
  }

  private createDefaultTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: 'general-precise',
        name: 'General Contract - Precise',
        contractTypes: ['*'],
        systemPrompt: `You are an expert contract analyst with legal expertise. Extract information with high precision.
- Only extract values explicitly stated in the contract
- If information is not found, return null
- Provide exact quotes when possible
- Note any ambiguities`,
        userPromptTemplate: `Extract the following fields from this {contractType} contract.
{fieldInstructions}

CONTRACT TEXT:
{contractText}

Return JSON with extracted values and confidence scores.`,
        fieldInstructions: new Map(),
        style: 'structured',
        mode: 'precise',
        version: 1,
      },
      {
        id: 'general-comprehensive',
        name: 'General Contract - Comprehensive',
        contractTypes: ['*'],
        systemPrompt: `You are an expert contract analyst. Extract all available information comprehensively.
- Extract explicit and implied information
- Note relationships between terms
- Include context for extracted values
- Identify potential issues or ambiguities`,
        userPromptTemplate: `Thoroughly analyze this {contractType} contract and extract all relevant information.
{fieldInstructions}

CONTRACT TEXT:
{contractText}

Return detailed JSON with values, evidence, and any concerns.`,
        fieldInstructions: new Map(),
        style: 'detailed',
        mode: 'comprehensive',
        version: 1,
      },
      {
        id: 'general-fast',
        name: 'General Contract - Fast',
        contractTypes: ['*'],
        systemPrompt: `Extract key contract fields quickly and efficiently.`,
        userPromptTemplate: `Extract: {fieldList}

{contractText}

Return JSON with values only.`,
        fieldInstructions: new Map(),
        style: 'concise',
        mode: 'fast',
        version: 1,
      },
    ];

    templates.forEach(t => this.templates.set(t.id, t));
  }

  /**
   * Build an optimized prompt for extraction
   */
  buildPrompt(
    fields: string[],
    contractText: string,
    context: PromptContext = {}
  ): GeneratedPrompt {
    const optimizations: string[] = [];

    // Select best template
    const template = this.selectTemplate(context);
    optimizations.push(`template:${template.id}`);

    // Build system prompt
    let systemPrompt = template.systemPrompt;

    // Add contract type specific instructions
    if (context.contractType && CONTRACT_TYPE_INSTRUCTIONS[context.contractType]) {
      systemPrompt += `\n\n${CONTRACT_TYPE_INSTRUCTIONS[context.contractType]}`;
      optimizations.push('contract-type-instructions');
    }

    // Add language instructions if non-English
    if (context.language && context.language !== 'en') {
      systemPrompt += `\n\nThe contract is in ${context.language}. Extract values in English where appropriate, but preserve original language for proper nouns and legal terms.`;
      optimizations.push('language-aware');
    }

    // Add tenant customizations
    const tenantCustoms = this.tenantCustomizations.get(context.tenantId || '');
    if (tenantCustoms) {
      for (const [key, value] of Object.entries(tenantCustoms)) {
        systemPrompt = systemPrompt.replace(`{${key}}`, value);
      }
      optimizations.push('tenant-customized');
    }

    // Add learning from previous errors
    if (context.previousErrors && context.previousErrors.length > 0) {
      systemPrompt += `\n\nPrevious extraction errors to avoid:\n${context.previousErrors.map(e => `- ${e}`).join('\n')}`;
      optimizations.push('error-aware');
    }

    // Build field-specific instructions
    const fieldInstructions = this.buildFieldInstructions(fields, context);
    const fieldPrompts: Record<string, string> = {};

    for (const field of fields) {
      fieldPrompts[field] = fieldInstructions[field] || '';
    }

    // Build user prompt
    let userPrompt = template.userPromptTemplate;
    userPrompt = userPrompt.replace('{contractType}', context.contractType || 'contract');
    userPrompt = userPrompt.replace('{fieldInstructions}', this.formatFieldInstructions(fieldInstructions));
    userPrompt = userPrompt.replace('{fieldList}', fields.join(', '));

    // Handle document length
    let textToInclude = contractText;
    if (context.documentLength === 'long' || contractText.length > 50000) {
      textToInclude = this.smartTruncate(contractText, 40000, fields);
      optimizations.push('smart-truncated');
    }
    userPrompt = userPrompt.replace('{contractText}', textToInclude);

    // Add custom instructions
    if (context.customInstructions) {
      userPrompt += `\n\nAdditional instructions: ${context.customInstructions}`;
      optimizations.push('custom-instructions');
    }

    // Estimate tokens
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    return {
      systemPrompt,
      userPrompt,
      fieldPrompts,
      metadata: {
        templateId: template.id,
        contractType: context.contractType,
        estimatedTokens,
        optimizationApplied: optimizations,
      },
    };
  }

  /**
   * Build field-specific instructions
   */
  private buildFieldInstructions(
    fields: string[],
    context: PromptContext
  ): Record<string, string> {
    const instructions: Record<string, string> = {};

    for (const fieldName of fields) {
      const config = this.fieldConfigs.get(fieldName);
      let instruction = '';

      if (config) {
        instruction = `**${fieldName}** (${config.importance}): ${config.description}`;

        if (config.expectedFormat) {
          instruction += `\n  Format: ${config.expectedFormat}`;
        }

        if (config.synonyms && config.synonyms.length > 0) {
          instruction += `\n  Also look for: ${config.synonyms.join(', ')}`;
        }

        if (config.examples && config.examples.length > 0) {
          instruction += `\n  Examples: ${config.examples.slice(0, 2).join(', ')}`;
        }

        // Add learnings from feedback
        const fieldLearnings = this.getLearningsForField(fieldName);
        if (fieldLearnings.length > 0) {
          const mistakes = fieldLearnings
            .filter(l => !l.wasCorrect)
            .slice(-3)
            .map(l => l.errorType || 'extraction error');
          if (mistakes.length > 0) {
            instruction += `\n  Common issues: ${[...new Set(mistakes)].join(', ')}`;
          }
        }
      } else {
        // Generate basic instruction for unknown fields
        instruction = `**${fieldName}**: Extract the ${this.humanizeFieldName(fieldName)} from the contract.`;
      }

      instructions[fieldName] = instruction;
    }

    return instructions;
  }

  /**
   * Format field instructions for prompt
   */
  private formatFieldInstructions(instructions: Record<string, string>): string {
    return Object.entries(instructions)
      .map(([_, instruction]) => instruction)
      .join('\n\n');
  }

  /**
   * Select best template based on context
   */
  private selectTemplate(context: PromptContext): PromptTemplate {
    // First, check for contract-type specific template
    for (const template of this.templates.values()) {
      if (
        context.contractType &&
        template.contractTypes.includes(context.contractType)
      ) {
        return template;
      }
    }

    // Select based on complexity
    if (context.complexity === 'complex') {
      return this.templates.get('general-comprehensive') || this.templates.values().next().value;
    }

    if (context.documentLength === 'short' || context.complexity === 'simple') {
      return this.templates.get('general-fast') || this.templates.values().next().value;
    }

    // Default to precise
    return this.templates.get('general-precise') || this.templates.values().next().value;
  }

  /**
   * Smart truncation that preserves relevant sections
   */
  private smartTruncate(
    text: string,
    maxLength: number,
    targetFields: string[]
  ): string {
    if (text.length <= maxLength) return text;

    // Identify sections likely to contain target fields
    const sections: { start: number; end: number; score: number }[] = [];
    const chunkSize = 2000;

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, i + chunkSize);
      let score = 0;

      for (const field of targetFields) {
        const config = this.fieldConfigs.get(field);
        if (config?.synonyms) {
          for (const synonym of config.synonyms) {
            if (chunk.toLowerCase().includes(synonym.toLowerCase())) {
              score += 2;
            }
          }
        }
        if (chunk.toLowerCase().includes(field.toLowerCase())) {
          score += 1;
        }
      }

      sections.push({ start: i, end: Math.min(i + chunkSize, text.length), score });
    }

    // Sort by score and take top sections
    sections.sort((a, b) => b.score - a.score);

    // Always include beginning and end
    const result: string[] = [];
    let remaining = maxLength;

    // Add first 4000 chars (usually contains parties, dates)
    const intro = text.substring(0, Math.min(4000, text.length));
    result.push(intro);
    remaining -= intro.length;

    // Add highest scoring sections
    for (const section of sections) {
      if (remaining <= 0) break;
      if (section.start < 4000) continue; // Skip if already included

      const chunk = text.substring(section.start, section.end);
      if (chunk.length <= remaining) {
        result.push(`\n...[Section]...\n${chunk}`);
        remaining -= chunk.length;
      }
    }

    // Add ending if room
    if (remaining > 2000) {
      result.push(`\n...[End of Contract]...\n${text.substring(text.length - 2000)}`);
    }

    return result.join('');
  }

  /**
   * Record feedback for learning
   */
  recordFeedback(feedback: LearningFeedback): void {
    const key = `${feedback.promptId}:${feedback.fieldName}`;
    const existing = this.learnings.get(key) || [];
    existing.push(feedback);
    
    // Keep last 100 per field
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.learnings.set(key, existing);

    // Update field config if suggestion provided
    if (feedback.suggestion && !feedback.wasCorrect) {
      const config = this.fieldConfigs.get(feedback.fieldName);
      if (config) {
        if (!config.commonMistakes) config.commonMistakes = [];
        if (!config.commonMistakes.includes(feedback.suggestion)) {
          config.commonMistakes.push(feedback.suggestion);
        }
      }
    }
  }

  /**
   * Get learnings for a field
   */
  private getLearningsForField(fieldName: string): LearningFeedback[] {
    const learnings: LearningFeedback[] = [];
    for (const [key, feedbacks] of this.learnings.entries()) {
      if (key.endsWith(`:${fieldName}`)) {
        learnings.push(...feedbacks);
      }
    }
    return learnings;
  }

  /**
   * Add custom field configuration
   */
  addFieldConfig(config: FieldPromptConfig): void {
    this.fieldConfigs.set(config.fieldName, config);
  }

  /**
   * Add custom template
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Set tenant customizations
   */
  setTenantCustomizations(tenantId: string, customizations: Record<string, string>): void {
    this.tenantCustomizations.set(tenantId, customizations);
  }

  /**
   * Get all templates
   */
  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get all field configs
   */
  getFieldConfigs(): FieldPromptConfig[] {
    return Array.from(this.fieldConfigs.values());
  }

  /**
   * Helper: humanize field name
   */
  private humanizeFieldName(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Record template performance
   */
  recordPerformance(
    templateId: string,
    confidence: number,
    accuracy: number,
    latencyMs: number,
    hadError: boolean
  ): void {
    const existing = this.performance.get(templateId);
    
    if (existing) {
      const newCount = existing.usageCount + 1;
      existing.avgConfidence = (existing.avgConfidence * existing.usageCount + confidence) / newCount;
      existing.avgAccuracy = (existing.avgAccuracy * existing.usageCount + accuracy) / newCount;
      existing.avgLatencyMs = (existing.avgLatencyMs * existing.usageCount + latencyMs) / newCount;
      existing.errorRate = (existing.errorRate * existing.usageCount + (hadError ? 1 : 0)) / newCount;
      existing.usageCount = newCount;
      existing.lastUsed = new Date();
    } else {
      this.performance.set(templateId, {
        templateId,
        usageCount: 1,
        avgConfidence: confidence,
        avgAccuracy: accuracy,
        avgLatencyMs: latencyMs,
        errorRate: hadError ? 1 : 0,
        lastUsed: new Date(),
      });
    }
  }

  /**
   * Get template performance stats
   */
  getPerformanceStats(): PromptPerformance[] {
    return Array.from(this.performance.values());
  }
}

// Export singleton
export const contextAwarePromptBuilderService = new ContextAwarePromptBuilderService();
export { ContextAwarePromptBuilderService };

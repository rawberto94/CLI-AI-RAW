/**
 * AI Contract Generation Service
 * 
 * Natural language to contract generation:
 * - NL prompt to full contract draft
 * - Smart template assembly
 * - Variable auto-population
 * - Multi-language generation
 * - Regulatory auto-compliance
 * 
 * @module contract-generator
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { prisma as prismaSingleton, PrismaClient } from '../lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export type ContractTemplateType = 
  | 'MSA'           // Master Service Agreement
  | 'SOW'           // Statement of Work
  | 'NDA'           // Non-Disclosure Agreement
  | 'SAAS'          // SaaS Agreement
  | 'EMPLOYMENT'    // Employment Contract
  | 'CONSULTING'    // Consulting Agreement
  | 'LICENSE'       // License Agreement
  | 'LEASE'         // Lease Agreement
  | 'VENDOR'        // Vendor Agreement
  | 'PARTNERSHIP'   // Partnership Agreement
  | 'AMENDMENT'     // Contract Amendment
  | 'ADDENDUM'      // Contract Addendum
  | 'LOI'           // Letter of Intent
  | 'MOU'           // Memorandum of Understanding
  | 'DPA'           // Data Processing Agreement
  | 'CUSTOM';       // Custom Template

export type GenerationLanguage = 
  | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' 
  | 'nl' | 'pl' | 'ja' | 'zh' | 'ko';

export interface GenerationRequest {
  prompt: string;                          // Natural language description
  templateType?: ContractTemplateType;     // Optional template type hint
  variables?: ContractVariables;           // Known variable values
  options?: GenerationOptions;
  tenantId: string;
  userId: string;
}

export interface ContractVariables {
  // Parties
  partyAName?: string;
  partyAAddress?: string;
  partyAContact?: string;
  partyAJurisdiction?: string;
  
  partyBName?: string;
  partyBAddress?: string;
  partyBContact?: string;
  partyBJurisdiction?: string;
  
  // Dates
  effectiveDate?: string;
  terminationDate?: string;
  renewalDate?: string;
  
  // Financial
  contractValue?: number;
  currency?: string;
  paymentTerms?: string;
  
  // Scope
  services?: string;
  deliverables?: string;
  
  // Custom
  custom?: Record<string, string | number | boolean>;
}

export interface GenerationOptions {
  language?: GenerationLanguage;
  tone?: 'formal' | 'balanced' | 'friendly';
  complexity?: 'simple' | 'standard' | 'complex';
  jurisdiction?: string;                    // Legal jurisdiction
  includeSchedules?: boolean;               // Include exhibits/schedules
  complianceRequirements?: string[];        // GDPR, CCPA, SOX, etc.
  playbookId?: string;                      // Use playbook for clause selection
  maxLength?: number;                       // Maximum word count
  styleGuide?: string;                      // Custom style instructions
}

export interface GeneratedContract {
  id: string;
  templateType: ContractTemplateType;
  title: string;
  content: string;
  clauses: GeneratedClause[];
  variables: ExtractedVariables;
  metadata: GenerationMetadata;
  compliance: ComplianceCheck[];
  alternatives?: AlternativeVersion[];
}

export interface GeneratedClause {
  id: string;
  order: number;
  title: string;
  content: string;
  category: string;
  isRequired: boolean;
  source: 'template' | 'library' | 'ai' | 'playbook';
  riskLevel: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ExtractedVariables {
  identified: { key: string; value: string; confidence: number }[];
  missing: { key: string; description: string; required: boolean }[];
}

export interface GenerationMetadata {
  promptTokens: number;
  completionTokens: number;
  model: string;
  generationTimeMs: number;
  templateUsed?: string;
  clausesFromLibrary: number;
  clausesGenerated: number;
}

export interface ComplianceCheck {
  requirement: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  details: string;
  clauseId?: string;
}

export interface AlternativeVersion {
  id: string;
  description: string;
  content: string;
  differences: string[];
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

const TEMPLATE_STRUCTURES: Record<ContractTemplateType, TemplateStructure> = {
  MSA: {
    name: 'Master Service Agreement',
    requiredClauses: [
      'definitions', 'scope_of_services', 'term_and_termination', 'payment_terms',
      'confidentiality', 'intellectual_property', 'limitation_of_liability',
      'indemnification', 'warranties', 'governing_law', 'dispute_resolution',
      'general_provisions'
    ],
    optionalClauses: ['insurance', 'data_protection', 'force_majeure', 'non_solicitation'],
  },
  SOW: {
    name: 'Statement of Work',
    requiredClauses: [
      'background', 'scope_of_work', 'deliverables', 'timeline', 'acceptance_criteria',
      'payment_schedule', 'resources', 'assumptions', 'change_management'
    ],
    optionalClauses: ['risks', 'dependencies', 'reporting'],
  },
  NDA: {
    name: 'Non-Disclosure Agreement',
    requiredClauses: [
      'definitions', 'confidential_information', 'obligations', 'exclusions',
      'term', 'return_of_information', 'remedies', 'governing_law'
    ],
    optionalClauses: ['permitted_disclosures', 'no_license', 'assignment'],
  },
  SAAS: {
    name: 'SaaS Agreement',
    requiredClauses: [
      'definitions', 'grant_of_license', 'restrictions', 'service_levels',
      'support_and_maintenance', 'fees_and_payment', 'data_protection',
      'security', 'intellectual_property', 'term_and_termination',
      'warranties_and_disclaimers', 'limitation_of_liability', 'indemnification',
      'governing_law'
    ],
    optionalClauses: ['free_trial', 'professional_services', 'acceptable_use'],
  },
  EMPLOYMENT: {
    name: 'Employment Agreement',
    requiredClauses: [
      'position_and_duties', 'compensation', 'benefits', 'work_location',
      'term_of_employment', 'termination', 'confidentiality', 'non_compete',
      'intellectual_property', 'governing_law'
    ],
    optionalClauses: ['equity', 'relocation', 'probation_period'],
  },
  CONSULTING: {
    name: 'Consulting Agreement',
    requiredClauses: [
      'services', 'compensation', 'term', 'independent_contractor',
      'confidentiality', 'intellectual_property', 'termination', 'indemnification'
    ],
    optionalClauses: ['expenses', 'insurance', 'non_solicitation'],
  },
  LICENSE: {
    name: 'License Agreement',
    requiredClauses: [
      'definitions', 'license_grant', 'restrictions', 'fees', 'term',
      'intellectual_property', 'warranties', 'limitation_of_liability', 'termination'
    ],
    optionalClauses: ['sublicensing', 'audit_rights', 'updates'],
  },
  LEASE: {
    name: 'Lease Agreement',
    requiredClauses: [
      'premises', 'term', 'rent', 'security_deposit', 'maintenance',
      'use_restrictions', 'insurance', 'termination', 'default'
    ],
    optionalClauses: ['renewal', 'alterations', 'assignment'],
  },
  VENDOR: {
    name: 'Vendor Agreement',
    requiredClauses: [
      'products_services', 'pricing', 'delivery', 'payment', 'warranties',
      'compliance', 'termination', 'liability', 'indemnification'
    ],
    optionalClauses: ['insurance', 'audit', 'subcontracting'],
  },
  PARTNERSHIP: {
    name: 'Partnership Agreement',
    requiredClauses: [
      'formation', 'purpose', 'contributions', 'profit_loss_sharing',
      'management', 'withdrawal', 'dissolution', 'dispute_resolution'
    ],
    optionalClauses: ['new_partners', 'non_compete', 'confidentiality'],
  },
  AMENDMENT: {
    name: 'Contract Amendment',
    requiredClauses: ['recitals', 'amendments', 'effect', 'counterparts'],
    optionalClauses: ['ratification'],
  },
  ADDENDUM: {
    name: 'Contract Addendum',
    requiredClauses: ['recitals', 'additional_terms', 'effect'],
    optionalClauses: [],
  },
  LOI: {
    name: 'Letter of Intent',
    requiredClauses: [
      'purpose', 'proposed_terms', 'conditions', 'timeline',
      'confidentiality', 'non_binding', 'exclusivity'
    ],
    optionalClauses: ['due_diligence', 'expenses'],
  },
  MOU: {
    name: 'Memorandum of Understanding',
    requiredClauses: [
      'purpose', 'scope', 'roles_responsibilities', 'term', 'confidentiality'
    ],
    optionalClauses: ['resources', 'dispute_resolution'],
  },
  DPA: {
    name: 'Data Processing Agreement',
    requiredClauses: [
      'definitions', 'scope', 'data_processing_terms', 'security_measures',
      'subprocessors', 'data_subject_rights', 'audit', 'breach_notification',
      'data_transfers', 'return_deletion', 'liability'
    ],
    optionalClauses: ['technical_measures'],
  },
  CUSTOM: {
    name: 'Custom Agreement',
    requiredClauses: ['parties', 'purpose', 'terms', 'signatures'],
    optionalClauses: [],
  },
};

interface TemplateStructure {
  name: string;
  requiredClauses: string[];
  optionalClauses: string[];
}

// ============================================================================
// COMPLIANCE REQUIREMENTS
// ============================================================================

const COMPLIANCE_CLAUSES: Record<string, string[]> = {
  GDPR: [
    'data_protection', 'data_subject_rights', 'data_transfers', 
    'breach_notification', 'data_retention', 'subprocessor_requirements'
  ],
  CCPA: [
    'california_privacy', 'do_not_sell', 'consumer_rights', 'data_collection_notice'
  ],
  SOX: [
    'financial_controls', 'audit_rights', 'record_retention', 'reporting_requirements'
  ],
  HIPAA: [
    'phi_protection', 'security_safeguards', 'breach_notification', 'baa_terms'
  ],
  PCI_DSS: [
    'cardholder_data_protection', 'security_requirements', 'compliance_validation'
  ],
};

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ContractGenerationService {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private clauseLibraryCache: Map<string, LibraryClause[]> = new Map();

  constructor(prisma?: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.prisma = prisma || prismaSingleton;
  }

  // ============================================================================
  // MAIN GENERATION METHODS
  // ============================================================================

  /**
   * Generate a contract from natural language description
   */
  async generateContract(request: GenerationRequest): Promise<GeneratedContract> {
    const startTime = Date.now();
    
    // 1. Analyze the prompt to determine contract type and extract variables
    const analysis = await this.analyzePrompt(request.prompt);
    
    // 2. Determine template type
    const templateType = request.templateType || analysis.suggestedType || 'CUSTOM';
    
    // 3. Merge extracted variables with provided variables
    const variables: ContractVariables = {
      ...analysis.extractedVariables,
      ...request.variables,
    };
    
    // 4. Get template structure
    const template = TEMPLATE_STRUCTURES[templateType];
    
    // 5. Load relevant clauses from library
    const libraryClauses = await this.loadLibraryClauses(
      templateType,
      request.tenantId,
      request.options?.playbookId
    );
    
    // 6. Generate the contract
    const generatedContent = await this.generateContractContent(
      request.prompt,
      templateType,
      template,
      variables,
      libraryClauses,
      request.options
    );
    
    // 7. Check compliance requirements
    const compliance = await this.checkCompliance(
      generatedContent.content,
      request.options?.complianceRequirements || []
    );
    
    // 8. Generate alternative versions if requested
    let alternatives: AlternativeVersion[] | undefined;
    if (request.options?.complexity === 'simple' || request.options?.complexity === 'complex') {
      // Already generated with specified complexity
    }
    
    // 9. Extract and validate variables in generated content
    const extractedVariables = this.extractVariablesFromContent(
      generatedContent.content,
      variables
    );

    const generationTime = Date.now() - startTime;

    return {
      id: `gen_${Date.now()}`,
      templateType,
      title: generatedContent.title,
      content: generatedContent.content,
      clauses: generatedContent.clauses,
      variables: extractedVariables,
      metadata: {
        promptTokens: generatedContent.promptTokens,
        completionTokens: generatedContent.completionTokens,
        model: 'gpt-4o',
        generationTimeMs: generationTime,
        templateUsed: template.name,
        clausesFromLibrary: libraryClauses.length,
        clausesGenerated: generatedContent.clauses.filter(c => c.source === 'ai').length,
      },
      compliance,
      alternatives,
    };
  }

  /**
   * Generate contract from structured inputs (form-based)
   */
  async generateFromTemplate(
    templateType: ContractTemplateType,
    variables: ContractVariables,
    options: GenerationOptions & { tenantId: string }
  ): Promise<GeneratedContract> {
    const prompt = this.buildPromptFromVariables(templateType, variables);
    
    return this.generateContract({
      prompt,
      templateType,
      variables,
      options,
      tenantId: options.tenantId,
      userId: 'system',
    });
  }

  /**
   * Generate a specific clause
   */
  async generateClause(
    clauseType: string,
    context: {
      contractType: ContractTemplateType;
      existingClauses?: string[];
      variables?: ContractVariables;
      tenantId: string;
    },
    options?: GenerationOptions
  ): Promise<GeneratedClause> {
    const prompt = `Generate a ${clauseType} clause for a ${context.contractType}.

${context.existingClauses ? `Existing clauses for context:\n${context.existingClauses.slice(0, 3).join('\n\n')}` : ''}

${context.variables ? `Key terms:\n${JSON.stringify(context.variables, null, 2)}` : ''}

Requirements:
- Professional legal language
- ${options?.tone || 'balanced'} tone
- ${options?.complexity || 'standard'} complexity
- ${options?.jurisdiction ? `Applicable in ${options.jurisdiction}` : 'General applicability'}

Return ONLY the clause text, no additional commentary.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content || '';

      return {
        id: `clause_${Date.now()}`,
        order: 0,
        title: this.formatClauseTitle(clauseType),
        content,
        category: clauseType,
        isRequired: TEMPLATE_STRUCTURES[context.contractType]?.requiredClauses.includes(clauseType) || false,
        source: 'ai',
        riskLevel: 'medium',
      };
    } catch (error) {
      console.error('Failed to generate clause:', error);
      throw new Error(`Failed to generate ${clauseType} clause`);
    }
  }

  /**
   * Translate a contract to another language
   */
  async translateContract(
    content: string,
    targetLanguage: GenerationLanguage,
    options?: { preserveFormatting?: boolean; legalTerminology?: boolean }
  ): Promise<{ content: string; notes: string[] }> {
    const languageNames: Record<GenerationLanguage, string> = {
      en: 'English', es: 'Spanish', fr: 'French', de: 'German',
      pt: 'Portuguese', it: 'Italian', nl: 'Dutch', pl: 'Polish',
      ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
    };

    const prompt = `Translate this contract to ${languageNames[targetLanguage]}.

Requirements:
- Maintain exact legal meaning
- ${options?.legalTerminology ? 'Use proper legal terminology in the target language' : 'Use clear, understandable language'}
- ${options?.preserveFormatting ? 'Preserve all formatting, numbering, and structure' : 'Adapt formatting as appropriate'}
- Note any terms that cannot be directly translated

Contract:
${content}

Return JSON: { "content": "translated contract", "notes": ["any translation notes"] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        content: result.content || content,
        notes: result.notes || [],
      };
    } catch (error) {
      console.error('Translation failed:', error);
      throw new Error('Failed to translate contract');
    }
  }

  // ============================================================================
  // ANALYSIS METHODS
  // ============================================================================

  private async analyzePrompt(prompt: string): Promise<{
    suggestedType: ContractTemplateType;
    extractedVariables: Partial<ContractVariables>;
    keyTerms: string[];
  }> {
    const analysisPrompt = `Analyze this contract request and extract information:

Request: "${prompt}"

Determine:
1. Most appropriate contract type from: MSA, SOW, NDA, SAAS, EMPLOYMENT, CONSULTING, LICENSE, LEASE, VENDOR, PARTNERSHIP, AMENDMENT, ADDENDUM, LOI, MOU, DPA, CUSTOM
2. Any party names, dates, amounts, or other variables mentioned
3. Key terms or requirements

Return JSON: {
  "suggestedType": "CONTRACT_TYPE",
  "extractedVariables": {
    "partyAName": "if mentioned",
    "partyBName": "if mentioned",
    "effectiveDate": "if mentioned",
    "contractValue": number if mentioned,
    "services": "if mentioned"
  },
  "keyTerms": ["important terms"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        suggestedType: result.suggestedType || 'CUSTOM',
        extractedVariables: result.extractedVariables || {},
        keyTerms: result.keyTerms || [],
      };
    } catch (error) {
      console.error('Prompt analysis failed:', error);
      return {
        suggestedType: 'CUSTOM',
        extractedVariables: {},
        keyTerms: [],
      };
    }
  }

  // ============================================================================
  // GENERATION METHODS
  // ============================================================================

  private async generateContractContent(
    userPrompt: string,
    templateType: ContractTemplateType,
    template: TemplateStructure,
    variables: ContractVariables,
    libraryClauses: LibraryClause[],
    options?: GenerationOptions
  ): Promise<{
    title: string;
    content: string;
    clauses: GeneratedClause[];
    promptTokens: number;
    completionTokens: number;
  }> {
    // Build clause guidance from library
    const clauseGuidance = libraryClauses.length > 0
      ? `\n\nUse these approved clause templates where applicable:\n${libraryClauses.map(c => `- ${c.category}: ${c.content.slice(0, 200)}...`).join('\n')}`
      : '';

    // Build compliance requirements
    const complianceGuidance = options?.complianceRequirements?.length
      ? `\n\nEnsure compliance with: ${options.complianceRequirements.join(', ')}`
      : '';

    const systemPrompt = `You are an expert contract attorney. Generate professional, legally-sound contracts.

Rules:
1. Use clear, precise legal language
2. Include all required clauses for the contract type
3. Use {{VARIABLE_NAME}} for any values that need to be filled in
4. Structure the contract with clear sections and numbering
5. Include signature blocks at the end
6. ${options?.tone === 'formal' ? 'Use formal legal language' : options?.tone === 'friendly' ? 'Use clear, approachable language while maintaining legal validity' : 'Balance formality with readability'}
7. ${options?.complexity === 'simple' ? 'Keep clauses concise and straightforward' : options?.complexity === 'complex' ? 'Include comprehensive provisions and edge cases' : 'Use standard comprehensive clauses'}
${options?.jurisdiction ? `8. Ensure validity under ${options.jurisdiction} law` : ''}
${clauseGuidance}
${complianceGuidance}`;

    const userMessage = `Generate a ${template.name} based on this request:

${userPrompt}

Known details:
${JSON.stringify(variables, null, 2)}

Required sections: ${template.requiredClauses.join(', ')}
Optional sections to consider: ${template.optionalClauses.join(', ')}

Generate the complete contract now.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 8000,
      });

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      // Parse the generated content into clauses
      const clauses = this.parseClausesFromContent(content, template, libraryClauses);

      // Generate title
      const title = this.generateTitle(templateType, variables);

      return {
        title,
        content,
        clauses,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
      };
    } catch (error) {
      console.error('Contract generation failed:', error);
      throw new Error('Failed to generate contract');
    }
  }

  private parseClausesFromContent(
    content: string,
    template: TemplateStructure,
    libraryClauses: LibraryClause[]
  ): GeneratedClause[] {
    const clauses: GeneratedClause[] = [];
    
    // Simple parsing by numbered sections
    const sectionRegex = /(?:^|\n)(\d+\.(?:\d+\.)?)\s*([A-Z][A-Z\s]+(?:\n|\.|\:))/gm;
    let lastIndex = 0;
    let match;
    let order = 1;

    while ((match = sectionRegex.exec(content)) !== null) {
      if (lastIndex > 0) {
        // Extract the previous section content
        const sectionContent = content.slice(lastIndex, match.index).trim();
        if (clauses.length > 0) {
          clauses[clauses.length - 1].content = sectionContent;
        }
      }

      const title = match[2].trim().replace(/[\n\.:]$/, '');
      const category = this.categorizeSectionTitle(title);
      const libraryMatch = libraryClauses.find(c => c.category === category);

      clauses.push({
        id: `clause_${order}`,
        order,
        title,
        content: '', // Will be filled in next iteration
        category,
        isRequired: template.requiredClauses.includes(category),
        source: libraryMatch ? 'library' : 'ai',
        riskLevel: this.assessClauseRisk(category),
      });

      lastIndex = match.index + match[0].length;
      order++;
    }

    // Get the last section content
    if (clauses.length > 0 && lastIndex < content.length) {
      clauses[clauses.length - 1].content = content.slice(lastIndex).trim();
    }

    return clauses;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async loadLibraryClauses(
    templateType: ContractTemplateType,
    tenantId: string,
    playbookId?: string
  ): Promise<LibraryClause[]> {
    try {
      const template = TEMPLATE_STRUCTURES[templateType];
      const allClauses = [...template.requiredClauses, ...template.optionalClauses];

      // Use clauseLibrary model which has tenantId and content fields
      const clauses = await this.prisma.clauseLibrary.findMany({
        where: {
          tenantId,
          category: { in: allClauses },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return clauses.map(c => ({
        id: c.id,
        category: c.category,
        content: c.content,
        riskLevel: c.riskLevel || 'MEDIUM',
      }));
    } catch (error) {
      console.error('Failed to load library clauses:', error);
      return [];
    }
  }

  private async checkCompliance(
    content: string,
    requirements: string[]
  ): Promise<ComplianceCheck[]> {
    const checks: ComplianceCheck[] = [];

    for (const requirement of requirements) {
      const requiredClauses = COMPLIANCE_CLAUSES[requirement.toUpperCase()] || [];
      
      for (const clauseType of requiredClauses) {
        const hasClause = this.contentIncludesClause(content, clauseType);
        checks.push({
          requirement: `${requirement}: ${clauseType}`,
          status: hasClause ? 'compliant' : 'non_compliant',
          details: hasClause 
            ? `Required ${clauseType} clause found` 
            : `Missing required ${clauseType} clause for ${requirement} compliance`,
        });
      }
    }

    return checks;
  }

  private contentIncludesClause(content: string, clauseType: string): boolean {
    const patterns: Record<string, RegExp> = {
      data_protection: /data\s+protection|personal\s+data|privacy/i,
      data_subject_rights: /data\s+subject\s+rights|right\s+to\s+access|erasure|rectification/i,
      data_transfers: /data\s+transfer|cross-border|international\s+transfer/i,
      breach_notification: /breach\s+notification|security\s+incident|notify.*breach/i,
      california_privacy: /california|CCPA|consumer\s+privacy/i,
      financial_controls: /financial\s+controls|internal\s+controls|accounting/i,
      audit_rights: /audit\s+rights?|inspection|examine.*records/i,
    };

    const pattern = patterns[clauseType];
    return pattern ? pattern.test(content) : content.toLowerCase().includes(clauseType.replace(/_/g, ' '));
  }

  private extractVariablesFromContent(
    content: string,
    providedVariables: ContractVariables
  ): ExtractedVariables {
    const identified: { key: string; value: string; confidence: number }[] = [];
    const missing: { key: string; description: string; required: boolean }[] = [];

    // Find all {{VARIABLE}} patterns
    const variablePattern = /\{\{([A-Z_]+)\}\}/g;
    const foundVariables = new Set<string>();
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      foundVariables.add(match[1]);
    }

    // Check which variables are provided
    const providedKeys = new Set(Object.keys(providedVariables));

    for (const varName of foundVariables) {
      const camelCase = varName.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      if (providedKeys.has(camelCase)) {
        const value = (providedVariables as any)[camelCase];
        identified.push({
          key: varName,
          value: String(value),
          confidence: 1.0,
        });
      } else {
        missing.push({
          key: varName,
          description: this.describeVariable(varName),
          required: this.isVariableRequired(varName),
        });
      }
    }

    return { identified, missing };
  }

  private describeVariable(varName: string): string {
    const descriptions: Record<string, string> = {
      PARTY_A_NAME: 'Name of the first party',
      PARTY_B_NAME: 'Name of the second party',
      EFFECTIVE_DATE: 'Date the agreement becomes effective',
      TERMINATION_DATE: 'Date the agreement ends',
      CONTRACT_VALUE: 'Total value of the contract',
      SERVICES: 'Description of services to be provided',
    };
    return descriptions[varName] || `Value for ${varName.toLowerCase().replace(/_/g, ' ')}`;
  }

  private isVariableRequired(varName: string): boolean {
    const required = ['PARTY_A_NAME', 'PARTY_B_NAME', 'EFFECTIVE_DATE'];
    return required.includes(varName);
  }

  private buildPromptFromVariables(
    templateType: ContractTemplateType,
    variables: ContractVariables
  ): string {
    const parts: string[] = [];
    
    parts.push(`Create a ${TEMPLATE_STRUCTURES[templateType].name}`);
    
    if (variables.partyAName && variables.partyBName) {
      parts.push(`between ${variables.partyAName} and ${variables.partyBName}`);
    }
    
    if (variables.services) {
      parts.push(`for ${variables.services}`);
    }
    
    if (variables.contractValue) {
      parts.push(`valued at ${variables.currency || '$'}${variables.contractValue.toLocaleString()}`);
    }
    
    if (variables.effectiveDate) {
      parts.push(`effective ${variables.effectiveDate}`);
    }

    return parts.join(' ') + '.';
  }

  private generateTitle(
    templateType: ContractTemplateType,
    variables: ContractVariables
  ): string {
    const template = TEMPLATE_STRUCTURES[templateType];
    const parties = [variables.partyAName, variables.partyBName].filter(Boolean);
    
    if (parties.length === 2) {
      return `${template.name} - ${parties[0]} and ${parties[1]}`;
    } else if (parties.length === 1) {
      return `${template.name} - ${parties[0]}`;
    }
    return template.name;
  }

  private formatClauseTitle(clauseType: string): string {
    return clauseType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private categorizeSectionTitle(title: string): string {
    const normalizedTitle = title.toLowerCase();
    
    const mappings: Record<string, string[]> = {
      definitions: ['definition', 'interpretation'],
      scope_of_services: ['scope', 'services', 'engagement'],
      term_and_termination: ['term', 'termination', 'duration'],
      payment_terms: ['payment', 'fees', 'compensation', 'pricing'],
      confidentiality: ['confidential', 'non-disclosure', 'proprietary'],
      intellectual_property: ['intellectual property', 'ip', 'ownership', 'work product'],
      limitation_of_liability: ['limitation', 'liability', 'damages'],
      indemnification: ['indemnif', 'hold harmless'],
      warranties: ['warrant', 'representation'],
      governing_law: ['governing law', 'jurisdiction', 'applicable law'],
      dispute_resolution: ['dispute', 'arbitration', 'mediation'],
      force_majeure: ['force majeure', 'act of god'],
      insurance: ['insurance'],
      data_protection: ['data protection', 'privacy', 'gdpr'],
    };

    for (const [category, keywords] of Object.entries(mappings)) {
      if (keywords.some(keyword => normalizedTitle.includes(keyword))) {
        return category;
      }
    }

    return 'general_provisions';
  }

  private assessClauseRisk(category: string): 'low' | 'medium' | 'high' {
    const highRisk = ['limitation_of_liability', 'indemnification', 'intellectual_property', 'termination'];
    const mediumRisk = ['confidentiality', 'warranties', 'payment_terms', 'dispute_resolution'];
    
    if (highRisk.includes(category)) return 'high';
    if (mediumRisk.includes(category)) return 'medium';
    return 'low';
  }
}

// ============================================================================
// HELPER INTERFACES
// ============================================================================

interface LibraryClause {
  id: string;
  category: string;
  content: string;
  riskLevel: string;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let generationInstance: ContractGenerationService | null = null;

export function getContractGenerationService(): ContractGenerationService {
  if (!generationInstance) {
    generationInstance = new ContractGenerationService();
  }
  return generationInstance;
}

export const contractGenerationService = getContractGenerationService();

/**
 * Intelligent Prompt Router Service
 * 
 * Dynamically selects and customizes prompts based on:
 * - Contract type classification
 * - Document structure and complexity
 * - Tenant-specific patterns learned from corrections
 * - Artifact type requirements
 * 
 * @version 1.0.0
 */

import { 
  ContractTypeClassifier, 
  ContractCategory, 
  ContractClassification,
  SemanticChunker,
  ChunkingResult,
  aiLearningService,
} from './advanced-ai-intelligence.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('intelligent-prompt-router');

// =============================================================================
// PROMPT TEMPLATES BY CONTRACT TYPE
// =============================================================================

interface PromptTemplate {
  systemPrompt: string;
  userPromptPrefix: string;
  extractionFocus: string[];
  antiHallucinationRules: string[];
  outputGuidelines: string[];
}

const CONTRACT_TYPE_PROMPTS: Record<ContractCategory, Partial<PromptTemplate>> = {
  SERVICE_AGREEMENT: {
    extractionFocus: [
      'Scope of work and deliverables',
      'Service levels and SLAs',
      'Milestones and acceptance criteria',
      'Change order procedures',
      'Professional liability and E&O coverage',
    ],
    antiHallucinationRules: [
      'If no specific service levels are defined, state "No formal SLA defined"',
      'Only include deliverables explicitly listed in the contract',
      'Do not infer project timelines from contract dates alone',
    ],
  },
  PROCUREMENT: {
    extractionFocus: [
      'Product specifications and quantities',
      'Delivery terms and shipping (INCOTERMS)',
      'Warranty coverage and returns',
      'Quality standards and inspection rights',
      'Supply chain and sourcing requirements',
    ],
    antiHallucinationRules: [
      'Extract exact product names and SKUs as stated',
      'Do not estimate quantities if not explicitly stated',
      'Include INCOTERMS only if specifically referenced',
    ],
  },
  EMPLOYMENT: {
    extractionFocus: [
      'Compensation structure (salary, bonuses, equity)',
      'Benefits and perquisites',
      'Non-compete and non-solicitation terms',
      'Termination conditions and severance',
      'Confidentiality and IP assignment',
    ],
    antiHallucinationRules: [
      'Salary and compensation must be exact figures from contract',
      'Benefits must be explicitly stated, not assumed from industry norms',
      'Non-compete geographic and time limits must be verbatim',
    ],
  },
  LICENSING: {
    extractionFocus: [
      'Scope of license grant',
      'Usage restrictions and permitted users',
      'Royalty rates and payment terms',
      'IP ownership and assignment',
      'Audit rights and compliance verification',
    ],
    antiHallucinationRules: [
      'License scope must be exactly as stated (exclusive vs non-exclusive)',
      'User counts and seat limits must be exact numbers',
      'Territory restrictions must be verbatim',
    ],
  },
  REAL_ESTATE: {
    extractionFocus: [
      'Premises description and square footage',
      'Rent amounts and escalation',
      'Security deposit and guarantees',
      'Maintenance responsibilities',
      'Subleasing and assignment rights',
    ],
    antiHallucinationRules: [
      'Square footage and rent must be exact as stated',
      'Common area maintenance (CAM) details must be explicit',
      'Do not calculate total rent unless formula is provided',
    ],
  },
  FINANCIAL: {
    extractionFocus: [
      'Principal amounts and interest rates',
      'Repayment schedule and terms',
      'Collateral and security interests',
      'Covenants and default triggers',
      'Prepayment rights and penalties',
    ],
    antiHallucinationRules: [
      'Interest rates must be exact (including if fixed or variable)',
      'Covenant thresholds must be precise numerical values',
      'Default triggers must be verbatim from contract',
    ],
  },
  PARTNERSHIP: {
    extractionFocus: [
      'Capital contributions and ownership percentages',
      'Profit/loss allocation',
      'Management and voting rights',
      'Distributions and draws',
      'Exit and dissolution procedures',
    ],
    antiHallucinationRules: [
      'Ownership percentages must be exact',
      'Voting thresholds must be precise',
      'Do not infer capital contributions from ownership %',
    ],
  },
  REGULATORY: {
    extractionFocus: [
      'Regulatory references (FAR, DFAR, etc.)',
      'Compliance certifications required',
      'Reporting and audit requirements',
      'Security and clearance requirements',
      'Flow-down provisions',
    ],
    antiHallucinationRules: [
      'FAR clause numbers must be exact',
      'Certification requirements must be explicitly stated',
      'Do not assume standard government terms apply unless stated',
    ],
  },
  UNKNOWN: {
    extractionFocus: [
      'Primary purpose and subject matter',
      'Key obligations of each party',
      'Payment and financial terms',
      'Term and termination',
      'Risk allocation',
    ],
    antiHallucinationRules: [
      'State when information is unclear or ambiguous',
      'Flag sections that need human review',
      'Do not assume standard industry terms',
    ],
  },
};

// =============================================================================
// ARTIFACT-SPECIFIC PROMPTS
// =============================================================================

const ARTIFACT_PROMPTS: Record<string, PromptTemplate> = {
  OVERVIEW: {
    systemPrompt: `You are an expert contract analyst specializing in extracting high-level contract summaries. 
Your goal is to provide a comprehensive overview that enables quick understanding of the contract's purpose, parties, and key terms.`,
    userPromptPrefix: 'Analyze this contract and extract a comprehensive overview:',
    extractionFocus: [
      'Full legal names of all parties (exactly as written)',
      'Contract type and subtype',
      'Effective and expiration dates',
      'Total contract value (if stated)',
      'Governing law jurisdiction',
      'Executive summary of purpose',
    ],
    antiHallucinationRules: [
      'Party names must be EXACT legal names from the contract signature blocks or preamble',
      'Dates must be in ISO format (YYYY-MM-DD) and extracted verbatim',
      'If total value is not explicitly stated, mark as "Not explicitly stated" with confidence < 0.5',
      'Do not use placeholder names like "ABC Corp" or "Vendor Inc"',
    ],
    outputGuidelines: [
      'Provide confidence scores for each extracted field',
      'Include source reference (section/page) for key fields',
      'List any gaps or unclear areas in extractionMetadata.warningsOrGaps',
    ],
  },
  FINANCIAL: {
    systemPrompt: `You are a financial analyst expert in contract terms extraction.
Focus on extracting all monetary values, payment terms, and financial obligations with extreme precision.`,
    userPromptPrefix: 'Extract all financial terms and obligations from this contract:',
    extractionFocus: [
      'Total contract value and breakdown',
      'Payment terms (Net days, invoicing)',
      'Payment schedule with dates and amounts',
      'Fees (one-time, recurring, variable)',
      'Penalties and late payment terms',
      'Revenue recognition considerations',
    ],
    antiHallucinationRules: [
      'All monetary values must be exact numbers from the contract',
      'Currency must be explicitly stated or default to USD with low confidence',
      'Payment schedules must match actual contract milestones',
      'Do not calculate or estimate values not explicitly stated',
    ],
    outputGuidelines: [
      'Use consistent currency codes (USD, EUR, GBP)',
      'Flag estimated vs. stated values',
      'Include formula for any calculated values',
    ],
  },
  RISK: {
    systemPrompt: `You are a legal risk analyst specializing in contract risk assessment.
Identify potential risks, missing protections, and negotiation opportunities objectively.`,
    userPromptPrefix: 'Perform a comprehensive risk analysis of this contract:',
    extractionFocus: [
      'Liability caps and limitations',
      'Indemnification obligations',
      'Insurance requirements',
      'Termination risks',
      'IP and data security risks',
      'Compliance and regulatory risks',
    ],
    antiHallucinationRules: [
      'Risk assessments must be based on actual contract language',
      'Quote relevant contract text to support risk findings',
      'Severity ratings must be justified by contract terms',
      'Do not assume standard industry protections exist unless stated',
    ],
    outputGuidelines: [
      'Assign severity (LOW/MEDIUM/HIGH/CRITICAL) with justification',
      'Provide specific clause references for each risk',
      'Suggest concrete mitigation or negotiation points',
    ],
  },
  CLAUSES: {
    systemPrompt: `You are a contract clause extraction specialist.
Identify and categorize all significant contract clauses with their key terms and implications.`,
    userPromptPrefix: 'Extract and categorize all significant clauses from this contract:',
    extractionFocus: [
      'Termination clauses and conditions',
      'Liability and indemnification',
      'Confidentiality provisions',
      'IP ownership and assignment',
      'Dispute resolution mechanisms',
      'Force majeure provisions',
    ],
    antiHallucinationRules: [
      'Clause titles must match contract headings exactly',
      'Section references must be accurate',
      'Clause summaries must reflect actual contract language',
      'Mark standard vs. non-standard clauses accurately',
    ],
    outputGuidelines: [
      'Include full clause text for critical provisions',
      'Note any unusual or non-standard terms',
      'Cross-reference clauses that interact',
    ],
  },
  OBLIGATIONS: {
    systemPrompt: `You are an obligations tracking specialist.
Extract all commitments, deadlines, and required actions by each party.`,
    userPromptPrefix: 'Extract all party obligations and commitments from this contract:',
    extractionFocus: [
      'Delivery obligations and timelines',
      'Payment obligations and schedules',
      'Reporting and notice requirements',
      'Compliance obligations',
      'Ongoing performance requirements',
    ],
    antiHallucinationRules: [
      'Due dates must be explicit contract dates or derived from stated formulas',
      'Responsible party must be clearly identified by name',
      'Do not create obligations not stated in contract',
    ],
    outputGuidelines: [
      'Categorize as one-time vs. recurring',
      'Include trigger conditions for conditional obligations',
      'Order by criticality and due date',
    ],
  },
  RATES: {
    systemPrompt: `You are a pricing and rates analyst.
Extract all pricing structures, rate schedules, and cost terms.`,
    userPromptPrefix: 'Extract all pricing and rate information from this contract:',
    extractionFocus: [
      'Hourly/daily/monthly rates by role',
      'Fixed fees and their scope',
      'Volume discounts and tiers',
      'Price escalation terms',
      'Expense reimbursement terms',
    ],
    antiHallucinationRules: [
      'Rates must be exact numbers from contract',
      'Role titles must match contract exactly',
      'Discount thresholds must be precise',
      'Do not estimate rates not explicitly stated',
    ],
    outputGuidelines: [
      'Include effective dates for each rate',
      'Note any rate cap provisions',
      'Clarify unit of measurement (hour, day, project)',
    ],
  },
  RENEWAL: {
    systemPrompt: `You are a contract lifecycle specialist.
Extract all renewal, termination, and expiration terms.`,
    userPromptPrefix: 'Extract renewal and termination terms from this contract:',
    extractionFocus: [
      'Auto-renewal provisions',
      'Notice periods and deadlines',
      'Termination for cause conditions',
      'Termination for convenience rights',
      'Post-termination obligations',
    ],
    antiHallucinationRules: [
      'Notice periods must be exact days stated',
      'Auto-renewal terms must be explicitly stated',
      'Do not assume standard renewal terms',
    ],
    outputGuidelines: [
      'Calculate key dates based on contract terms',
      'Flag upcoming deadlines',
      'Include both parties termination rights',
    ],
  },
  COMPLIANCE: {
    systemPrompt: `You are a compliance and regulatory specialist.
Extract all compliance requirements, certifications, and regulatory obligations.`,
    userPromptPrefix: 'Extract all compliance and regulatory requirements from this contract:',
    extractionFocus: [
      'Data privacy requirements (GDPR, CCPA, etc.)',
      'Security standards (SOC2, ISO27001, etc.)',
      'Industry-specific regulations',
      'Audit rights and procedures',
      'Certification requirements',
    ],
    antiHallucinationRules: [
      'Regulatory references must be exact (e.g., GDPR Article 28)',
      'Certification requirements must be explicitly stated',
      'Do not assume compliance requirements from industry norms',
    ],
    outputGuidelines: [
      'List specific regulatory citations',
      'Note verification and audit mechanisms',
      'Identify gaps in standard compliance coverage',
    ],
  },
};

// =============================================================================
// INTELLIGENT PROMPT ROUTER
// =============================================================================

export interface RoutedPrompt {
  systemPrompt: string;
  userPrompt: string;
  extractionGuidelines: string[];
  antiHallucinationRules: string[];
  responseFormat: 'json' | 'structured_output';
  estimatedComplexity: 'low' | 'medium' | 'high';
  recommendedModel: string;
  chunks?: ChunkingResult;
  contractClassification: ContractClassification;
}

export class IntelligentPromptRouter {
  /**
   * Route and customize prompt based on contract and artifact type
   */
  static async routePrompt(
    contractText: string,
    artifactType: string,
    tenantId: string,
    options: {
      priority?: 'speed' | 'accuracy' | 'cost';
      includeChunking?: boolean;
      maxTokens?: number;
    } = {}
  ): Promise<RoutedPrompt> {
    const { priority = 'accuracy', includeChunking = true, maxTokens = 8000 } = options;

    // 1. Classify contract type
    const classification = ContractTypeClassifier.classify(contractText);
    logger.info({
      category: classification.category,
      confidence: classification.confidence,
      subType: classification.subType,
    }, 'Contract classified');

    // 2. Get base artifact prompt
    const artifactPrompt = ARTIFACT_PROMPTS[artifactType] || ARTIFACT_PROMPTS.OVERVIEW;
    
    // 3. Get contract-type-specific enhancements
    const contractTypePrompt = CONTRACT_TYPE_PROMPTS[classification.category] || CONTRACT_TYPE_PROMPTS.UNKNOWN;

    // 4. Apply learned patterns from tenant corrections
    const enhancedSystemPrompt = await aiLearningService.enhancePromptWithLearning(
      tenantId,
      artifactType,
      artifactPrompt.systemPrompt
    );

    // 5. Chunk document if needed
    let chunks: ChunkingResult | undefined;
    const estimatedTokens = contractText.length / 4;
    
    if (includeChunking && estimatedTokens > maxTokens) {
      chunks = SemanticChunker.chunkDocument(contractText, maxTokens);
      logger.info({
        totalChunks: chunks.chunks.length,
        criticalChunks: chunks.criticalChunks.length,
        estimatedTokens,
      }, 'Document chunked for processing');
    }

    // 6. Determine complexity
    const complexity = this.assessComplexity(contractText, classification);

    // 7. Select recommended model
    const recommendedModel = this.selectModel(artifactType, complexity, priority);

    // 8. Build combined prompt
    const combinedSystemPrompt = this.buildSystemPrompt(
      enhancedSystemPrompt,
      contractTypePrompt,
      classification
    );

    const userPrompt = this.buildUserPrompt(
      artifactPrompt.userPromptPrefix,
      contractText,
      chunks
    );

    const extractionGuidelines = [
      ...artifactPrompt.extractionFocus,
      ...(contractTypePrompt.extractionFocus || []),
    ];

    const antiHallucinationRules = [
      ...artifactPrompt.antiHallucinationRules,
      ...(contractTypePrompt.antiHallucinationRules || []),
    ];

    return {
      systemPrompt: combinedSystemPrompt,
      userPrompt,
      extractionGuidelines,
      antiHallucinationRules,
      responseFormat: 'structured_output',
      estimatedComplexity: complexity,
      recommendedModel,
      chunks,
      contractClassification: classification,
    };
  }

  /**
   * Get prompt for multi-chunk processing
   */
  static getChunkPrompt(
    chunk: { content: string; section: string; importance: string },
    artifactType: string,
    chunkIndex: number,
    totalChunks: number,
    previousContext?: Record<string, any>
  ): { systemPrompt: string; userPrompt: string } {
    const artifactPrompt = ARTIFACT_PROMPTS[artifactType] || ARTIFACT_PROMPTS.OVERVIEW;

    const systemPrompt = `${artifactPrompt.systemPrompt}

This is chunk ${chunkIndex + 1} of ${totalChunks} from the document.
Section: ${chunk.section}
Importance: ${chunk.importance}

Extract relevant information for the ${artifactType} artifact from this section.
Only include information that is explicitly stated in this chunk.
Mark uncertain extractions with low confidence scores.`;

    const contextNote = previousContext 
      ? `\nPreviously extracted context:\n${JSON.stringify(previousContext, null, 2)}\n\nContinue extraction, avoiding duplicates.`
      : '';

    const userPrompt = `${artifactPrompt.userPromptPrefix}${contextNote}

Document Section (${chunk.section}):
---
${chunk.content}
---`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Merge results from multiple chunk extractions
   */
  static mergeChunkResults(
    artifactType: string,
    chunkResults: Array<{ chunkId: string; result: Record<string, any> }>
  ): Record<string, any> {
    if (chunkResults.length === 0) return {};
    if (chunkResults.length === 1) return chunkResults[0].result;

    // Type-specific merge strategies
    const merged: Record<string, any> = {};

    for (const { result } of chunkResults) {
      for (const [key, value] of Object.entries(result)) {
        if (key === 'extractionMetadata') continue;

        if (!merged[key]) {
          merged[key] = value;
        } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays, deduplicate by key fields
          merged[key] = this.mergeArrays(merged[key], value, key);
        } else if (typeof merged[key] === 'object' && typeof value === 'object') {
          // Merge objects, prefer higher confidence values
          merged[key] = this.mergeObjects(merged[key], value);
        }
        // For primitives, keep first value (earlier in document)
      }
    }

    merged.extractionMetadata = {
      model: chunkResults[0].result.extractionMetadata?.model,
      extractionTime: new Date().toISOString(),
      chunksProcessed: chunkResults.length,
      mergeStrategy: 'sequential_with_dedup',
    };

    return merged;
  }

  private static buildSystemPrompt(
    basePrompt: string,
    contractTypePrompt: Partial<PromptTemplate>,
    classification: ContractClassification
  ): string {
    const contractTypeGuidance = `
CONTRACT TYPE DETECTED: ${classification.category} (${classification.subType})
Confidence: ${(classification.confidence * 100).toFixed(1)}%
Key indicators: ${classification.indicators.join(', ')}

For this contract type, pay special attention to:
${(contractTypePrompt.extractionFocus || []).map(f => `- ${f}`).join('\n')}

CRITICAL ANTI-HALLUCINATION RULES:
${(contractTypePrompt.antiHallucinationRules || []).map(r => `⚠️ ${r}`).join('\n')}
`;

    return `${basePrompt}

${contractTypeGuidance}

UNIVERSAL EXTRACTION RULES:
1. Extract ONLY information explicitly stated in the contract
2. Use exact names, dates, and values as written
3. Include source references (section/paragraph) for key extractions
4. Assign confidence scores (0-1) based on clarity of source text
5. Mark ambiguous or uncertain extractions with confidence < 0.7
6. Never use placeholder names or invented data
7. If information is not found, omit the field rather than guessing`;
  }

  private static buildUserPrompt(
    prefix: string,
    contractText: string,
    chunks?: ChunkingResult
  ): string {
    if (chunks && chunks.criticalChunks.length > 0) {
      // For chunked documents, prioritize critical sections
      const criticalContent = chunks.criticalChunks
        .map(c => `[${c.section}]\n${c.content}`)
        .join('\n\n---\n\n');

      return `${prefix}

The following are the most relevant sections from a larger contract document:

${criticalContent}

Extract all relevant information from these sections. Note that this is a subset of the full document.`;
    }

    return `${prefix}

${contractText}`;
  }

  private static assessComplexity(
    text: string,
    classification: ContractClassification
  ): 'low' | 'medium' | 'high' {
    const factors = {
      length: text.length > 50000 ? 2 : text.length > 20000 ? 1 : 0,
      classificationConfidence: classification.confidence < 0.5 ? 1 : 0,
      unknownType: classification.category === 'UNKNOWN' ? 1 : 0,
      hasExhibits: /exhibit|schedule|appendix/i.test(text) ? 1 : 0,
      hasAmendments: /amendment|addendum|modification/i.test(text) ? 1 : 0,
    };

    const score = Object.values(factors).reduce((a, b) => a + b, 0);

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private static selectModel(
    artifactType: string,
    complexity: 'low' | 'medium' | 'high',
    priority: 'speed' | 'accuracy' | 'cost'
  ): string {
    const complexArtifacts = ['RISK', 'COMPLIANCE', 'FINANCIAL'];
    const isComplex = complexArtifacts.includes(artifactType) || complexity === 'high';

    if (priority === 'speed') {
      return isComplex ? 'gpt-4o-mini' : 'gpt-4o-mini';
    }

    if (priority === 'cost') {
      return 'gpt-4o-mini';
    }

    // Accuracy priority
    return isComplex ? 'gpt-4o' : 'gpt-4o-mini';
  }

  private static mergeArrays(arr1: any[], arr2: any[], key: string): any[] {
    const idFields = ['id', 'name', 'title', 'clause', 'regulation'];
    const idField = idFields.find(f => arr1[0]?.[f] !== undefined);

    if (!idField) {
      return [...arr1, ...arr2];
    }

    const seen = new Set(arr1.map(item => item[idField]?.toLowerCase?.() || item[idField]));
    const newItems = arr2.filter(item => {
      const id = item[idField]?.toLowerCase?.() || item[idField];
      return !seen.has(id);
    });

    return [...arr1, ...newItems];
  }

  private static mergeObjects(obj1: any, obj2: any): any {
    // Prefer higher confidence value
    const conf1 = obj1.confidence || 0;
    const conf2 = obj2.confidence || 0;

    if (conf2 > conf1) {
      return { ...obj1, ...obj2 };
    }
    return { ...obj2, ...obj1 };
  }
}

export const intelligentPromptRouter = IntelligentPromptRouter;

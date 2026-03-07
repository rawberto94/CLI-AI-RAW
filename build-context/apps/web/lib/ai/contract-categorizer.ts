/**
 * AI Contract Categorizer
 * 
 * Comprehensive AI-powered contract categorization across multiple dimensions:
 * - Contract Type (MSA, SOW, NDA, etc.)
 * - Industry Sector (Technology, Healthcare, Finance, etc.)
 * - Risk Level (Low, Medium, High, Critical)
 * - Complexity Score (1-10)
 * - Subject Matter Tags
 * - Regulatory Domains
 * 
 * Uses a multi-model approach with confidence scoring and calibration.
 */

import { openai } from "@/lib/openai-client";

// ============================================================================
// TYPES
// ============================================================================

export type ContractTypeCategory = 
  | 'MSA'
  | 'SOW'
  | 'NDA'
  | 'SLA'
  | 'DPA'
  | 'LICENSE'
  | 'EMPLOYMENT'
  | 'CONSULTING'
  | 'VENDOR'
  | 'PURCHASE'
  | 'LEASE'
  | 'PARTNERSHIP'
  | 'AMENDMENT'
  | 'RENEWAL'
  | 'SUBCONTRACT'
  | 'SUBSCRIPTION'
  | 'OTHER';

export type IndustrySector =
  | 'TECHNOLOGY'
  | 'HEALTHCARE'
  | 'FINANCE'
  | 'MANUFACTURING'
  | 'RETAIL'
  | 'ENERGY'
  | 'GOVERNMENT'
  | 'EDUCATION'
  | 'REAL_ESTATE'
  | 'LEGAL'
  | 'MEDIA'
  | 'TRANSPORTATION'
  | 'HOSPITALITY'
  | 'AGRICULTURE'
  | 'CONSTRUCTION'
  | 'OTHER';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RegulatoryDomain =
  | 'GDPR'
  | 'HIPAA'
  | 'SOX'
  | 'PCI_DSS'
  | 'CCPA'
  | 'SOC2'
  | 'ISO27001'
  | 'FEDRAMP'
  | 'FERPA'
  | 'GLBA'
  | 'NONE';

export interface CategorizationDimension<T = string> {
  value: T;
  confidence: number;
  reasoning?: string;
  alternatives?: Array<{ value: T; confidence: number }>;
}

export interface ContractCategorizationResult {
  /** Primary contract type classification */
  contractType: CategorizationDimension<ContractTypeCategory>;
  
  /** Industry sector the contract relates to */
  industry: CategorizationDimension<IndustrySector>;
  
  /** Risk assessment level */
  riskLevel: CategorizationDimension<RiskLevel>;
  
  /** Contract complexity (1-10) */
  complexity: CategorizationDimension<number>;
  
  /** Subject matter keywords/tags */
  subjectTags: string[];
  
  /** Applicable regulatory frameworks */
  regulatoryDomains: RegulatoryDomain[];
  
  /** Identified parties */
  parties: {
    clientType?: string;
    vendorType?: string;
    relationship?: string;
  };
  
  /** Contract scope indicators */
  scope: {
    geographic?: string[];
    duration?: string;
    valueRange?: string;
  };
  
  /** Special flags */
  flags: {
    hasAutoRenewal?: boolean;
    hasTerminationForConvenience?: boolean;
    hasLimitedLiability?: boolean;
    hasIndemnification?: boolean;
    hasNonCompete?: boolean;
    hasConfidentiality?: boolean;
    hasDataProcessing?: boolean;
    hasIPAssignment?: boolean;
  };
  
  /** Overall categorization confidence */
  overallConfidence: number;
  
  /** Processing metadata */
  metadata: {
    model: string;
    processingTimeMs: number;
    textLengthAnalyzed: number;
    timestamp: string;
  };
}

export interface CategorizationOptions {
  /** Contract ID for tracking */
  contractId?: string;
  /** Model to use */
  model?: 'gpt-4o-mini' | 'gpt-4o';
  /** Temperature for AI */
  temperature?: number;
  /** Whether to include detailed reasoning */
  includeReasoning?: boolean;
  /** Whether to detect regulatory domains */
  detectRegulatory?: boolean;
  /** Whether to extract parties */
  extractParties?: boolean;
  /** Custom contract types to recognize */
  customContractTypes?: string[];
  /** Custom industries to recognize */
  customIndustries?: string[];
}

// ============================================================================
// CONTRACT TYPE DEFINITIONS
// ============================================================================

const CONTRACT_TYPE_DEFINITIONS: Record<ContractTypeCategory, {
  name: string;
  description: string;
  keywords: string[];
  indicators: string[];
}> = {
  MSA: {
    name: 'Master Service Agreement',
    description: 'Umbrella agreement governing overall service relationship',
    keywords: ['master', 'service agreement', 'msa', 'umbrella', 'framework'],
    indicators: ['governs all subsequent', 'master terms', 'supersedes prior'],
  },
  SOW: {
    name: 'Statement of Work',
    description: 'Specific project scope and deliverables document',
    keywords: ['statement of work', 'sow', 'scope', 'deliverables', 'project'],
    indicators: ['milestones', 'deliverables schedule', 'acceptance criteria'],
  },
  NDA: {
    name: 'Non-Disclosure Agreement',
    description: 'Confidentiality and non-disclosure terms',
    keywords: ['non-disclosure', 'nda', 'confidential', 'confidentiality'],
    indicators: ['disclosing party', 'receiving party', 'confidential information'],
  },
  SLA: {
    name: 'Service Level Agreement',
    description: 'Performance standards and metrics commitment',
    keywords: ['service level', 'sla', 'uptime', 'availability', 'performance'],
    indicators: ['response time', 'resolution time', 'service credits'],
  },
  DPA: {
    name: 'Data Processing Agreement',
    description: 'Data protection and processing terms',
    keywords: ['data processing', 'dpa', 'gdpr', 'personal data', 'controller'],
    indicators: ['data subject', 'processor', 'sub-processor', 'data breach'],
  },
  LICENSE: {
    name: 'License Agreement',
    description: 'Software or IP licensing terms',
    keywords: ['license', 'licensing', 'software', 'intellectual property', 'grant'],
    indicators: ['license grant', 'permitted use', 'restrictions', 'royalty'],
  },
  EMPLOYMENT: {
    name: 'Employment Contract',
    description: 'Employee-employer relationship terms',
    keywords: ['employment', 'employee', 'employer', 'salary', 'benefits'],
    indicators: ['compensation', 'job duties', 'work hours', 'termination'],
  },
  CONSULTING: {
    name: 'Consulting Agreement',
    description: 'Independent contractor consulting services',
    keywords: ['consulting', 'consultant', 'advisory', 'professional services'],
    indicators: ['independent contractor', 'hourly rate', 'consulting services'],
  },
  VENDOR: {
    name: 'Vendor Agreement',
    description: 'Supplier/vendor relationship terms',
    keywords: ['vendor', 'supplier', 'procurement', 'supply'],
    indicators: ['vendor obligations', 'supply terms', 'procurement'],
  },
  PURCHASE: {
    name: 'Purchase Agreement',
    description: 'Goods or asset purchase terms',
    keywords: ['purchase', 'sale', 'buyer', 'seller', 'goods'],
    indicators: ['purchase price', 'delivery terms', 'title transfer'],
  },
  LEASE: {
    name: 'Lease Agreement',
    description: 'Property or equipment lease terms',
    keywords: ['lease', 'rent', 'tenant', 'landlord', 'premises'],
    indicators: ['monthly rent', 'lease term', 'security deposit'],
  },
  PARTNERSHIP: {
    name: 'Partnership Agreement',
    description: 'Business partnership or joint venture terms',
    keywords: ['partnership', 'partner', 'joint venture', 'collaboration'],
    indicators: ['profit sharing', 'partner contributions', 'joint ownership'],
  },
  AMENDMENT: {
    name: 'Amendment',
    description: 'Modification to existing agreement',
    keywords: ['amendment', 'modification', 'addendum', 'change order'],
    indicators: ['hereby amended', 'original agreement', 'all other terms remain'],
  },
  RENEWAL: {
    name: 'Renewal Agreement',
    description: 'Extension of existing agreement',
    keywords: ['renewal', 'extension', 'extended term'],
    indicators: ['renewal period', 'extended for', 'renewal terms'],
  },
  SUBCONTRACT: {
    name: 'Subcontract',
    description: 'Subcontracting arrangement',
    keywords: ['subcontract', 'subcontractor', 'prime contract'],
    indicators: ['prime contractor', 'subcontractor services', 'flow-down'],
  },
  SUBSCRIPTION: {
    name: 'Subscription Agreement',
    description: 'Recurring service subscription terms',
    keywords: ['subscription', 'saas', 'recurring', 'annual', 'monthly'],
    indicators: ['subscription fee', 'auto-renewal', 'subscription term'],
  },
  OTHER: {
    name: 'Other',
    description: 'Contract type not matching standard categories',
    keywords: [],
    indicators: [],
  },
};

const INDUSTRY_DEFINITIONS: Record<IndustrySector, {
  name: string;
  keywords: string[];
}> = {
  TECHNOLOGY: {
    name: 'Technology',
    keywords: ['software', 'saas', 'cloud', 'it', 'technology', 'digital', 'computing', 'api', 'platform'],
  },
  HEALTHCARE: {
    name: 'Healthcare',
    keywords: ['healthcare', 'medical', 'hospital', 'patient', 'clinical', 'pharmaceutical', 'health'],
  },
  FINANCE: {
    name: 'Finance',
    keywords: ['bank', 'financial', 'investment', 'securities', 'insurance', 'lending', 'credit'],
  },
  MANUFACTURING: {
    name: 'Manufacturing',
    keywords: ['manufacturing', 'production', 'factory', 'assembly', 'industrial', 'machinery'],
  },
  RETAIL: {
    name: 'Retail',
    keywords: ['retail', 'store', 'merchandise', 'e-commerce', 'consumer', 'shopping'],
  },
  ENERGY: {
    name: 'Energy',
    keywords: ['energy', 'power', 'utility', 'oil', 'gas', 'renewable', 'electricity'],
  },
  GOVERNMENT: {
    name: 'Government',
    keywords: ['government', 'federal', 'state', 'municipal', 'public sector', 'agency'],
  },
  EDUCATION: {
    name: 'Education',
    keywords: ['education', 'university', 'school', 'academic', 'training', 'learning'],
  },
  REAL_ESTATE: {
    name: 'Real Estate',
    keywords: ['real estate', 'property', 'commercial', 'residential', 'construction'],
  },
  LEGAL: {
    name: 'Legal',
    keywords: ['law firm', 'legal services', 'attorney', 'litigation'],
  },
  MEDIA: {
    name: 'Media',
    keywords: ['media', 'entertainment', 'publishing', 'broadcast', 'advertising'],
  },
  TRANSPORTATION: {
    name: 'Transportation',
    keywords: ['transportation', 'logistics', 'shipping', 'freight', 'delivery'],
  },
  HOSPITALITY: {
    name: 'Hospitality',
    keywords: ['hotel', 'restaurant', 'hospitality', 'tourism', 'travel'],
  },
  AGRICULTURE: {
    name: 'Agriculture',
    keywords: ['agriculture', 'farming', 'food', 'livestock', 'crop'],
  },
  CONSTRUCTION: {
    name: 'Construction',
    keywords: ['construction', 'building', 'contractor', 'engineering', 'infrastructure'],
  },
  OTHER: {
    name: 'Other',
    keywords: [],
  },
};

const REGULATORY_INDICATORS: Record<RegulatoryDomain, string[]> = {
  GDPR: ['gdpr', 'general data protection', 'eu data', 'european union', 'data subject rights'],
  HIPAA: ['hipaa', 'protected health information', 'phi', 'covered entity', 'business associate'],
  SOX: ['sox', 'sarbanes-oxley', 'internal controls', 'financial reporting'],
  PCI_DSS: ['pci', 'payment card', 'cardholder data', 'credit card', 'pci dss'],
  CCPA: ['ccpa', 'california consumer privacy', 'california privacy'],
  SOC2: ['soc 2', 'soc2', 'service organization', 'trust principles'],
  ISO27001: ['iso 27001', 'iso27001', 'information security management'],
  FEDRAMP: ['fedramp', 'federal risk', 'government cloud'],
  FERPA: ['ferpa', 'educational records', 'student privacy'],
  GLBA: ['glba', 'gramm-leach-bliley', 'financial privacy'],
  NONE: [],
};

// ============================================================================
// MAIN CATEGORIZER CLASS
// ============================================================================

export class AIContractCategorizer {
  private defaultModel: string;
  private defaultTemperature: number;

  constructor(options: {
    model?: string;
    temperature?: number;
  } = {}) {
    this.defaultModel = options.model || 'gpt-4o-mini';
    this.defaultTemperature = options.temperature || 0.1;
  }

  /**
   * Categorize a contract across all dimensions
   */
  async categorize(
    contractText: string,
    options: CategorizationOptions = {}
  ): Promise<ContractCategorizationResult> {
    const startTime = Date.now();
    const {
      model = this.defaultModel,
      temperature = this.defaultTemperature,
      includeReasoning = true,
      detectRegulatory = true,
      extractParties = true,
      customContractTypes = [],
      customIndustries = [],
    } = options;

    // Truncate text if too long
    const maxLength = 12000;
    const truncatedText = contractText.length > maxLength
      ? contractText.substring(0, maxLength) + '\n...[truncated]'
      : contractText;

    try {
      // Build comprehensive prompt
      const prompt = this.buildCategorizationPrompt(
        truncatedText,
        { includeReasoning, detectRegulatory, extractParties, customContractTypes, customIndustries }
      );

      // Ensure OpenAI client is available
      if (!openai) {
        throw new Error('OpenAI client not initialized. Please set OPENAI_API_KEY.');
      }

      // Call AI
      const response = await openai.chat({
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst specializing in contract classification and risk assessment. 
Analyze contracts with precision and provide structured categorization across multiple dimensions.
Always respond with valid JSON matching the requested schema exactly.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model,
        temperature,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const parsed = JSON.parse(content);
      
      // Post-process and validate
      const result = this.processAIResponse(parsed, truncatedText);
      
      // Add metadata
      result.metadata = {
        model,
        processingTimeMs: Date.now() - startTime,
        textLengthAnalyzed: truncatedText.length,
        timestamp: new Date().toISOString(),
      };

      // Calculate overall confidence
      result.overallConfidence = this.calculateOverallConfidence(result);

      return result;
    } catch {
      // Return fallback result with rule-based categorization
      return this.fallbackCategorization(truncatedText, startTime, model);
    }
  }

  /**
   * Quick categorization - just contract type and risk
   */
  async quickCategorize(
    contractText: string,
    options: { model?: string } = {}
  ): Promise<{
    contractType: ContractTypeCategory;
    riskLevel: RiskLevel;
    confidence: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    const model = options.model || 'gpt-4o-mini';

    const truncatedText = contractText.substring(0, 4000);

    try {
      // Ensure OpenAI client is available
      if (!openai) {
        throw new Error('OpenAI client not initialized. Please set OPENAI_API_KEY.');
      }

      const response = await openai.chat({
        messages: [
          {
            role: 'system',
            content: 'Classify the contract type and risk level. Respond with JSON: {"type": "MSA|SOW|NDA|SLA|DPA|LICENSE|EMPLOYMENT|CONSULTING|VENDOR|PURCHASE|LEASE|PARTNERSHIP|AMENDMENT|RENEWAL|SUBCONTRACT|SUBSCRIPTION|OTHER", "risk": "LOW|MEDIUM|HIGH|CRITICAL", "confidence": 0-100}',
          },
          {
            role: 'user',
            content: truncatedText,
          },
        ],
        model,
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response');

      const parsed = JSON.parse(content);

      return {
        contractType: parsed.type || 'OTHER',
        riskLevel: parsed.risk || 'MEDIUM',
        confidence: parsed.confidence || 70,
        processingTimeMs: Date.now() - startTime,
      };
    } catch {
      // Fallback to rule-based
      const type = this.detectContractTypeRuleBased(truncatedText);
      return {
        contractType: type,
        riskLevel: 'MEDIUM',
        confidence: 50,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch categorize multiple contracts
   */
  async batchCategorize(
    contracts: Array<{ id: string; text: string }>,
    options: CategorizationOptions = {}
  ): Promise<Array<{ id: string; result: ContractCategorizationResult }>> {
    const results: Array<{ id: string; result: ContractCategorizationResult }> = [];

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < contracts.length; i += batchSize) {
      const batch = contracts.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (contract) => {
          const result = await this.categorize(contract.text, {
            ...options,
            contractId: contract.id,
          });
          return { id: contract.id, result };
        })
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < contracts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private buildCategorizationPrompt(
    text: string,
    options: {
      includeReasoning: boolean;
      detectRegulatory: boolean;
      extractParties: boolean;
      customContractTypes: string[];
      customIndustries: string[];
    }
  ): string {
    // Build contract types list
    const contractTypes = Object.entries(CONTRACT_TYPE_DEFINITIONS)
      .map(([key, def]) => `  - ${key}: ${def.name} (${def.description})`)
      .join('\n');

    // Build industries list
    const industries = Object.entries(INDUSTRY_DEFINITIONS)
      .map(([key, def]) => `  - ${key}: ${def.name}`)
      .join('\n');

    // Add custom types if any
    const customTypesSection = options.customContractTypes.length > 0
      ? `\nCustom Types to Consider: ${options.customContractTypes.join(', ')}`
      : '';

    const customIndustriesSection = options.customIndustries.length > 0
      ? `\nCustom Industries to Consider: ${options.customIndustries.join(', ')}`
      : '';

    return `Analyze this contract and provide comprehensive categorization.

## Contract Text:
${text}

## Classification Dimensions:

### 1. Contract Type (choose one):
${contractTypes}${customTypesSection}

### 2. Industry Sector (choose one):
${industries}${customIndustriesSection}

### 3. Risk Level:
  - LOW: Standard terms, minimal liability exposure
  - MEDIUM: Some non-standard terms or moderate liability
  - HIGH: Significant deviations, major liability or compliance risks
  - CRITICAL: Urgent legal review needed, major red flags

### 4. Complexity (1-10):
  - 1-3: Simple, standard agreement
  - 4-6: Moderate complexity, some custom terms
  - 7-8: Complex with multiple provisions
  - 9-10: Highly complex, multi-party or specialized

## Response Format (JSON):
{
  "contractType": {
    "value": "TYPE_CODE",
    "confidence": 0-100,
    ${options.includeReasoning ? '"reasoning": "explanation",' : ''}
    "alternatives": [{"value": "TYPE", "confidence": 0-100}]
  },
  "industry": {
    "value": "INDUSTRY_CODE",
    "confidence": 0-100
  },
  "riskLevel": {
    "value": "LOW|MEDIUM|HIGH|CRITICAL",
    "confidence": 0-100,
    "reasoning": "key risk factors"
  },
  "complexity": {
    "value": 1-10,
    "confidence": 0-100
  },
  "subjectTags": ["tag1", "tag2", ...],
  ${options.detectRegulatory ? '"regulatoryDomains": ["GDPR", "HIPAA", ...],' : ''}
  ${options.extractParties ? `"parties": {
    "clientType": "description",
    "vendorType": "description", 
    "relationship": "description"
  },` : ''}
  "scope": {
    "geographic": ["regions"],
    "duration": "term description",
    "valueRange": "value tier"
  },
  "flags": {
    "hasAutoRenewal": boolean,
    "hasTerminationForConvenience": boolean,
    "hasLimitedLiability": boolean,
    "hasIndemnification": boolean,
    "hasNonCompete": boolean,
    "hasConfidentiality": boolean,
    "hasDataProcessing": boolean,
    "hasIPAssignment": boolean
  }
}`;
  }

  private processAIResponse(
    parsed: any,
    text: string
  ): ContractCategorizationResult {
    // Validate and normalize contract type
    const contractType = this.normalizeContractType(parsed.contractType);
    
    // Validate and normalize industry
    const industry = this.normalizeIndustry(parsed.industry);
    
    // Validate risk level
    const riskLevel = this.normalizeRiskLevel(parsed.riskLevel);
    
    // Validate complexity
    const complexity = this.normalizeComplexity(parsed.complexity);
    
    // Detect regulatory domains if not provided
    let regulatoryDomains = parsed.regulatoryDomains || [];
    if (regulatoryDomains.length === 0) {
      regulatoryDomains = this.detectRegulatoryDomains(text);
    }

    return {
      contractType,
      industry,
      riskLevel,
      complexity,
      subjectTags: Array.isArray(parsed.subjectTags) 
        ? parsed.subjectTags.slice(0, 10) 
        : [],
      regulatoryDomains: regulatoryDomains.filter((d: string) => 
        Object.keys(REGULATORY_INDICATORS).includes(d)
      ),
      parties: parsed.parties || {},
      scope: parsed.scope || {},
      flags: {
        hasAutoRenewal: !!parsed.flags?.hasAutoRenewal,
        hasTerminationForConvenience: !!parsed.flags?.hasTerminationForConvenience,
        hasLimitedLiability: !!parsed.flags?.hasLimitedLiability,
        hasIndemnification: !!parsed.flags?.hasIndemnification,
        hasNonCompete: !!parsed.flags?.hasNonCompete,
        hasConfidentiality: !!parsed.flags?.hasConfidentiality,
        hasDataProcessing: !!parsed.flags?.hasDataProcessing,
        hasIPAssignment: !!parsed.flags?.hasIPAssignment,
      },
      overallConfidence: 0, // Will be calculated
      metadata: {
        model: '',
        processingTimeMs: 0,
        textLengthAnalyzed: 0,
        timestamp: '',
      },
    };
  }

  private normalizeContractType(
    input: any
  ): CategorizationDimension<ContractTypeCategory> {
    const defaultResult: CategorizationDimension<ContractTypeCategory> = {
      value: 'OTHER',
      confidence: 50,
    };

    if (!input) return defaultResult;

    const value = (typeof input === 'object' ? input.value : input) as string;
    const normalizedValue = value?.toUpperCase().replace(/[^A-Z_]/g, '');

    if (Object.keys(CONTRACT_TYPE_DEFINITIONS).includes(normalizedValue)) {
      return {
        value: normalizedValue as ContractTypeCategory,
        confidence: input.confidence || 70,
        reasoning: input.reasoning,
        alternatives: input.alternatives?.slice(0, 3),
      };
    }

    return defaultResult;
  }

  private normalizeIndustry(
    input: any
  ): CategorizationDimension<IndustrySector> {
    const defaultResult: CategorizationDimension<IndustrySector> = {
      value: 'OTHER',
      confidence: 50,
    };

    if (!input) return defaultResult;

    const value = (typeof input === 'object' ? input.value : input) as string;
    const normalizedValue = value?.toUpperCase().replace(/[^A-Z_]/g, '');

    if (Object.keys(INDUSTRY_DEFINITIONS).includes(normalizedValue)) {
      return {
        value: normalizedValue as IndustrySector,
        confidence: input.confidence || 70,
        reasoning: input.reasoning,
      };
    }

    return defaultResult;
  }

  private normalizeRiskLevel(
    input: any
  ): CategorizationDimension<RiskLevel> {
    const defaultResult: CategorizationDimension<RiskLevel> = {
      value: 'MEDIUM',
      confidence: 50,
    };

    if (!input) return defaultResult;

    const value = (typeof input === 'object' ? input.value : input) as string;
    const normalizedValue = value?.toUpperCase();

    const validLevels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (validLevels.includes(normalizedValue as RiskLevel)) {
      return {
        value: normalizedValue as RiskLevel,
        confidence: input.confidence || 70,
        reasoning: input.reasoning,
      };
    }

    return defaultResult;
  }

  private normalizeComplexity(
    input: any
  ): CategorizationDimension<number> {
    const defaultResult: CategorizationDimension<number> = {
      value: 5,
      confidence: 50,
    };

    if (!input) return defaultResult;

    const value = typeof input === 'object' ? input.value : input;
    const numValue = Number(value);

    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      return {
        value: Math.round(numValue),
        confidence: input.confidence || 70,
      };
    }

    return defaultResult;
  }

  private detectRegulatoryDomains(text: string): RegulatoryDomain[] {
    const domains: RegulatoryDomain[] = [];
    const lowerText = text.toLowerCase();

    for (const [domain, keywords] of Object.entries(REGULATORY_INDICATORS)) {
      if (domain === 'NONE') continue;
      
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          domains.push(domain as RegulatoryDomain);
          break;
        }
      }
    }

    return domains;
  }

  private detectContractTypeRuleBased(text: string): ContractTypeCategory {
    const lowerText = text.toLowerCase();
    
    // Check each type's keywords
    const scores: Array<{ type: ContractTypeCategory; score: number }> = [];
    
    for (const [type, def] of Object.entries(CONTRACT_TYPE_DEFINITIONS)) {
      if (type === 'OTHER') continue;
      
      let score = 0;
      for (const keyword of def.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }
      for (const indicator of def.indicators) {
        if (lowerText.includes(indicator.toLowerCase())) {
          score += 1;
        }
      }
      
      if (score > 0) {
        scores.push({ type: type as ContractTypeCategory, score });
      }
    }

    // Sort by score and return best match
    scores.sort((a, b) => b.score - a.score);
    
    return scores.length > 0 && scores[0] ? scores[0].type : 'OTHER';
  }

  private calculateOverallConfidence(result: ContractCategorizationResult): number {
    const weights = {
      contractType: 0.35,
      industry: 0.20,
      riskLevel: 0.25,
      complexity: 0.20,
    };

    const weightedSum = 
      (result.contractType.confidence * weights.contractType) +
      (result.industry.confidence * weights.industry) +
      (result.riskLevel.confidence * weights.riskLevel) +
      (result.complexity.confidence * weights.complexity);

    return Math.round(weightedSum);
  }

  private fallbackCategorization(
    text: string,
    startTime: number,
    model: string
  ): ContractCategorizationResult {
    const contractType = this.detectContractTypeRuleBased(text);
    const regulatoryDomains = this.detectRegulatoryDomains(text);

    return {
      contractType: {
        value: contractType,
        confidence: 50,
        reasoning: 'Fallback rule-based detection',
      },
      industry: {
        value: 'OTHER',
        confidence: 30,
      },
      riskLevel: {
        value: 'MEDIUM',
        confidence: 40,
        reasoning: 'Default risk level - manual review recommended',
      },
      complexity: {
        value: 5,
        confidence: 30,
      },
      subjectTags: [],
      regulatoryDomains,
      parties: {},
      scope: {},
      flags: {
        hasAutoRenewal: text.toLowerCase().includes('auto-renew') || text.toLowerCase().includes('automatically renew'),
        hasTerminationForConvenience: text.toLowerCase().includes('termination for convenience'),
        hasLimitedLiability: text.toLowerCase().includes('limitation of liability'),
        hasIndemnification: text.toLowerCase().includes('indemnif'),
        hasNonCompete: text.toLowerCase().includes('non-compete') || text.toLowerCase().includes('non compete'),
        hasConfidentiality: text.toLowerCase().includes('confidential'),
        hasDataProcessing: text.toLowerCase().includes('data process'),
        hasIPAssignment: text.toLowerCase().includes('intellectual property') && text.toLowerCase().includes('assign'),
      },
      overallConfidence: 40,
      metadata: {
        model: `${model}-fallback`,
        processingTimeMs: Date.now() - startTime,
        textLengthAnalyzed: text.length,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let categorizerInstance: AIContractCategorizer | null = null;

export function getAIContractCategorizer(): AIContractCategorizer {
  if (!categorizerInstance) {
    categorizerInstance = new AIContractCategorizer();
  }
  return categorizerInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick categorize a contract
 */
export async function categorizeContract(
  contractText: string,
  options?: CategorizationOptions
): Promise<ContractCategorizationResult> {
  const categorizer = getAIContractCategorizer();
  return categorizer.categorize(contractText, options);
}

/**
 * Quick type and risk classification
 */
export async function quickClassifyContract(
  contractText: string
): Promise<{
  contractType: ContractTypeCategory;
  riskLevel: RiskLevel;
  confidence: number;
}> {
  const categorizer = getAIContractCategorizer();
  return categorizer.quickCategorize(contractText);
}

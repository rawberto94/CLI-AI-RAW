/**
 * Enhanced Rate Card Extraction Service
 * Extracts rate cards from contracts with improved accuracy and confidence scoring
 */

import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export interface ExtractedRate {
  roleOriginal: string;
  roleStandardized?: string;
  seniority: 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER';
  dailyRate: number;
  currency: string;
  location?: string;
  lineOfService?: string;
  skills?: string[];
  certifications?: string[];
  minimumCommitment?: {
    value: number;
    unit: 'hours' | 'days' | 'months';
  };
  volumeDiscount?: string;
  additionalInfo?: any;
  confidence: number;
  extractionMethod: 'TABLE' | 'INLINE' | 'APPENDIX' | 'INFERRED';
}

export interface SupplierInfo {
  name: string;
  legalName?: string;
  country?: string;
  tier?: 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE';
  confidence: number;
}

export interface ContractContext {
  effectiveDate?: string;
  expiryDate?: string;
  contractType?: string;
  paymentTerms?: string;
  currency?: string;
}

export interface ExtractionResult {
  rates: ExtractedRate[];
  supplierInfo: SupplierInfo;
  contractContext: ContractContext;
  confidence: number;
  warnings: string[];
  metadata: {
    extractedAt: Date;
    modelUsed: string;
    processingTimeMs: number;
  };
}

export interface RoleContext {
  industry?: string;
  lineOfService?: string;
  existingRoles?: string[];
}

export interface StandardizedRole {
  standardized: string;
  confidence: number;
  alternatives: string[];
  category: string;
}

export interface ExtractionValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
}

export class RateCardExtractionService {
  private readonly model: string;
  private readonly llm: ChatOpenAI;

  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.llm = new ChatOpenAI({
      modelName: this.model,
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Extract rate cards from contract text using enhanced AI prompts
   */
  async extractFromContract(
    contractId: string,
    contractText: string
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.buildEnhancedExtractionPrompt(contractText);

      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const content = response.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No content returned from AI');
      }

      const rawResult = JSON.parse(content);
      const processingTimeMs = Date.now() - startTime;

      // Post-process and validate
      const result = this.postProcessExtraction(rawResult, processingTimeMs);

      return result;
    } catch (error: unknown) {
      throw new Error(`Rate extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build enhanced extraction prompt with multiple format support
   */
  private buildEnhancedExtractionPrompt(contractText: string): string {
    return `You are an expert at extracting rate card information from contracts, statements of work, and rate schedules.

TASK: Analyze the contract text and extract ALL rate information with maximum precision and accuracy.

CONTRACT TEXT:
${contractText.substring(0, 15000)} ${contractText.length > 15000 ? '...[truncated]' : ''}

EXTRACTION STRATEGY:
1. SCAN FOR RATE TABLES: Look for structured tables with columns like Role, Rate, Level, etc.
2. CHECK APPENDICES: Rate schedules are often in appendices or exhibits
3. FIND INLINE RATES: Rates mentioned in contract clauses
4. IDENTIFY RATE RANGES: Min-max rates or tiered pricing
5. DETECT VOLUME DISCOUNTS: Bulk pricing or commitment-based rates

EXTRACT FOR EACH RATE:
- Role/Position Name (exact as written)
- Seniority Level (Junior, Mid, Senior, Principal, Partner)
- Rate Amount (numeric value)
- Rate Period (hourly, daily, weekly, monthly, annual)
- Currency (USD, EUR, GBP, CHF, etc.)
- Location/Geography (country, region, city if specified)
- Line of Service (Technology, Consulting, Finance, Legal, etc.)
- Skills/Technologies (programming languages, tools, certifications)
- Certifications Required (PMP, AWS, CPA, etc.)
- Minimum Commitment (hours, days, months)
- Volume Discounts (if applicable)
- Extraction Method (TABLE, INLINE, APPENDIX, INFERRED)

RATE CONVERSION TO DAILY RATE:
- Hourly → Daily: multiply by 8
- Weekly → Daily: divide by 5
- Monthly → Daily: divide by 22
- Annual → Daily: divide by 260
- ALWAYS preserve original rate and period in additionalInfo

SENIORITY LEVEL MAPPING:
- Junior/Jr/Entry/Associate/Level 1/L1/Graduate → JUNIOR
- Mid/Intermediate/Consultant/Level 2/L2 → MID
- Senior/Sr/Lead/Level 3/L3 → SENIOR
- Principal/Staff/Expert/Level 4/L4/Architect → PRINCIPAL
- Partner/Director/VP/C-Level/Managing/Level 5/L5 → PARTNER

CONFIDENCE SCORING (0.0 to 1.0):
- 0.95-1.0: Explicit rate in structured table with clear headers
- 0.85-0.95: Rate in well-formatted list or schedule
- 0.70-0.85: Rate mentioned clearly in contract text
- 0.50-0.70: Rate inferred from context or ranges
- 0.30-0.50: Rate estimated from partial information
- <0.30: Highly uncertain extraction

SUPPLIER INFORMATION:
- Extract supplier/vendor name from contract header, parties section, or signature block
- Identify supplier country and tier if mentioned
- Determine confidence based on clarity of information

CONTRACT CONTEXT:
- Effective Date (start date)
- Expiry Date (end date, termination date)
- Contract Type (SOW, MSA, Rate Card, etc.)
- Payment Terms (Net 30, Net 60, etc.)
- Default Currency

RETURN JSON FORMAT:
{
  "rates": [
    {
      "roleOriginal": "Senior Full Stack Developer",
      "seniority": "SENIOR",
      "dailyRate": 1200,
      "currency": "USD",
      "location": "United States",
      "lineOfService": "Technology Consulting",
      "skills": ["React", "Node.js", "AWS", "TypeScript"],
      "certifications": ["AWS Solutions Architect"],
      "minimumCommitment": {
        "value": 40,
        "unit": "hours"
      },
      "volumeDiscount": "10% discount for >500 hours",
      "additionalInfo": {
        "originalRate": 150,
        "originalPeriod": "hourly",
        "rateRange": "140-160",
        "notes": "Includes on-call support"
      },
      "confidence": 0.95,
      "extractionMethod": "TABLE"
    }
  ],
  "supplierInfo": {
    "name": "Acme Technology Consulting LLC",
    "legalName": "Acme Technology Consulting Limited Liability Company",
    "country": "United States",
    "tier": "TIER_2",
    "confidence": 0.90
  },
  "contractContext": {
    "effectiveDate": "2025-01-01",
    "expiryDate": "2025-12-31",
    "contractType": "Statement of Work",
    "paymentTerms": "Net 30",
    "currency": "USD"
  },
  "confidence": 0.92,
  "warnings": [
    "Some rates provided as ranges - using midpoint",
    "Seniority levels inferred from role titles"
  ]
}

IMPORTANT RULES:
- Extract EVERY rate mentioned, even if format varies
- If no rates found, return empty rates array
- If supplier name unclear, use "Unknown Supplier" with low confidence
- If dates not found, leave as null
- Include warnings for any assumptions or inferences
- Be conservative with confidence scores
- Preserve all original information in additionalInfo`;
  }

  /**
   * Get system prompt for rate extraction
   */
  private getSystemPrompt(): string {
    return `You are an expert procurement analyst specializing in rate card extraction from contracts.

Your expertise includes:
- Identifying rate information in various formats (tables, lists, inline text)
- Understanding consulting and professional services pricing structures
- Recognizing role titles and seniority levels across industries
- Converting between different rate periods (hourly, daily, monthly, annual)
- Assessing confidence levels for extracted data

You always:
- Return valid, well-structured JSON
- Provide accurate confidence scores
- Include warnings for assumptions
- Preserve original information
- Extract comprehensively without missing rates`;
  }

  /**
   * Post-process extraction results
   */
  private postProcessExtraction(
    rawResult: any,
    processingTimeMs: number
  ): ExtractionResult {
    const rates: ExtractedRate[] = (rawResult.rates || []).map((rate: any) => ({
      roleOriginal: rate.roleOriginal || rate.role || 'Unknown Role',
      roleStandardized: rate.roleStandardized,
      seniority: this.normalizeSeniority(rate.seniority),
      dailyRate: Number(rate.dailyRate) || 0,
      currency: (rate.currency || 'USD').toUpperCase(),
      location: rate.location,
      lineOfService: rate.lineOfService,
      skills: Array.isArray(rate.skills) ? rate.skills : [],
      certifications: Array.isArray(rate.certifications) ? rate.certifications : [],
      minimumCommitment: rate.minimumCommitment,
      volumeDiscount: rate.volumeDiscount,
      additionalInfo: rate.additionalInfo || {},
      confidence: this.normalizeConfidence(rate.confidence),
      extractionMethod: rate.extractionMethod || 'INFERRED',
    }));

    const supplierInfo: SupplierInfo = {
      name: rawResult.supplierInfo?.name || 'Unknown Supplier',
      legalName: rawResult.supplierInfo?.legalName,
      country: rawResult.supplierInfo?.country,
      tier: rawResult.supplierInfo?.tier,
      confidence: this.normalizeConfidence(rawResult.supplierInfo?.confidence || 0.5),
    };

    const contractContext: ContractContext = {
      effectiveDate: rawResult.contractContext?.effectiveDate,
      expiryDate: rawResult.contractContext?.expiryDate,
      contractType: rawResult.contractContext?.contractType,
      paymentTerms: rawResult.contractContext?.paymentTerms,
      currency: rawResult.contractContext?.currency,
    };

    const warnings: string[] = Array.isArray(rawResult.warnings) ? rawResult.warnings : [];

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(rates, supplierInfo);

    return {
      rates,
      supplierInfo,
      contractContext,
      confidence,
      warnings,
      metadata: {
        extractedAt: new Date(),
        modelUsed: this.model,
        processingTimeMs,
      },
    };
  }

  /**
   * Normalize seniority level
   */
  private normalizeSeniority(
    seniority: string
  ): 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER' {
    const normalized = (seniority || '').toUpperCase();
    const validLevels = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
    
    if (validLevels.includes(normalized)) {
      return normalized as any;
    }

    // Default to MID if unclear
    return 'MID';
  }

  /**
   * Normalize confidence score to 0-1 range
   */
  private normalizeConfidence(confidence: any): number {
    const score = Number(confidence) || 0;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate overall confidence from individual rates
   */
  private calculateOverallConfidence(
    rates: ExtractedRate[],
    supplierInfo: SupplierInfo
  ): number {
    if (rates.length === 0) {
      return 0;
    }

    const avgRateConfidence =
      rates.reduce((sum, rate) => sum + rate.confidence, 0) / rates.length;

    // Weight: 70% rate confidence, 30% supplier confidence
    return avgRateConfidence * 0.7 + supplierInfo.confidence * 0.3;
  }

  /**
   * Standardize role name using AI with context
   */
  async standardizeRole(
    roleOriginal: string,
    context?: RoleContext
  ): Promise<StandardizedRole> {
    try {
      const contextInfo = context
        ? `
Industry: ${context.industry || 'General'}
Line of Service: ${context.lineOfService || 'General'}
Existing Roles in System: ${context.existingRoles?.slice(0, 10).join(', ') || 'None'}
`
        : '';

      const response = await this.llm.invoke([
        new SystemMessage(`You are a role standardization expert. Convert job titles to standardized formats while preserving meaning.

Return JSON with:
- standardized: The standardized role name
- confidence: Confidence score (0-1)
- alternatives: Array of alternative standardized names
- category: Role category (Engineering, Consulting, Finance, Legal, etc.)`),
        new HumanMessage(`Standardize this role: "${roleOriginal}"

${contextInfo}

Examples:
- "Sr. Java Dev" → "Software Engineer" (category: Engineering)
- "Lead Data Scientist" → "Data Scientist" (category: Data & Analytics)
- "Junior Full Stack Developer" → "Software Engineer" (category: Engineering)
- "Principal Solution Architect" → "Solution Architect" (category: Architecture)
- "SAP Consultant" → "SAP Consultant" (category: ERP Consulting)

Return JSON format:
{
  "standardized": "Software Engineer",
  "confidence": 0.95,
  "alternatives": ["Developer", "Software Developer"],
  "category": "Engineering"
}`),
      ]);

      const content = response.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No content returned');
      }

      const result = JSON.parse(content);

      return {
        standardized: result.standardized || roleOriginal,
        confidence: this.normalizeConfidence(result.confidence || 0.7),
        alternatives: Array.isArray(result.alternatives) ? result.alternatives : [],
        category: result.category || 'General',
      };
    } catch {
      // Fallback
      return {
        standardized: roleOriginal,
        confidence: 0.5,
        alternatives: [],
        category: 'General',
      };
    }
  }

  /**
   * Validate and enrich extracted data
   */
  async validateExtraction(extraction: ExtractionResult): Promise<ExtractionValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Validate rates
    for (const rate of extraction.rates) {
      // Check for missing required fields
      if (!rate.roleOriginal || rate.roleOriginal === 'Unknown Role') {
        errors.push({
          field: 'roleOriginal',
          message: 'Role name is required',
          severity: 'ERROR',
        });
      }

      if (!rate.dailyRate || rate.dailyRate <= 0) {
        errors.push({
          field: 'dailyRate',
          message: 'Valid daily rate is required',
          severity: 'ERROR',
        });
      }

      // Check for unrealistic rates
      if (rate.dailyRate > 10000) {
        warnings.push({
          field: 'dailyRate',
          message: `Daily rate ${rate.dailyRate} ${rate.currency} seems unusually high`,
          suggestion: 'Verify this is a daily rate, not monthly or annual',
        });
      }

      if (rate.dailyRate < 50) {
        warnings.push({
          field: 'dailyRate',
          message: `Daily rate ${rate.dailyRate} ${rate.currency} seems unusually low`,
          suggestion: 'Verify currency and rate period',
        });
      }

      // Check confidence
      if (rate.confidence < 0.5) {
        warnings.push({
          field: 'confidence',
          message: `Low confidence (${rate.confidence.toFixed(2)}) for ${rate.roleOriginal}`,
          suggestion: 'Consider manual review',
        });
      }

      // Suggest standardization if not done
      if (!rate.roleStandardized) {
        suggestions.push({
          field: 'roleStandardized',
          currentValue: null,
          suggestedValue: 'Run role standardization',
          reason: 'Standardized role name improves benchmarking accuracy',
        });
      }
    }

    // Validate supplier info
    if (extraction.supplierInfo.confidence < 0.7) {
      warnings.push({
        field: 'supplierInfo',
        message: 'Supplier information has low confidence',
        suggestion: 'Verify supplier name and details',
      });
    }

    // Check overall confidence
    if (extraction.confidence < 0.6) {
      warnings.push({
        field: 'overall',
        message: 'Overall extraction confidence is low',
        suggestion: 'Consider manual review of all extracted rates',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}

// Export singleton instance
export const rateCardExtractionService = new RateCardExtractionService();

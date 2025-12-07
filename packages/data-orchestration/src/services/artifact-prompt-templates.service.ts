/**
 * Artifact Prompt Templates Service
 * 
 * Provides structured, few-shot prompts for AI artifact generation
 * with examples and detailed instructions for better quality.
 * 
 * PRODUCTION-READY FEATURES:
 * - Anti-hallucination guidelines embedded in all prompts
 * - Source grounding with citation requirements
 * - Explicit null handling for missing data
 * - Confidence calibration for extracted fields
 * - Mandatory "NOT_FOUND" markers for unfound data
 */

import { ArtifactType } from './ai-artifact-generator.service';

// =============================================================================
// ANTI-HALLUCINATION BASE PROMPT (Applied to ALL artifact types)
// =============================================================================
const ANTI_HALLUCINATION_BASE = `
CRITICAL EXTRACTION GUIDELINES - FOLLOW EXACTLY:

1. ONLY EXTRACT INFORMATION EXPLICITLY STATED IN THE CONTRACT TEXT
   - DO NOT invent, infer, assume, or fabricate any information
   - DO NOT use external knowledge or typical contract patterns
   - If information is NOT explicitly in the text, use null or "NOT_FOUND"

2. QUOTE SOURCES FOR KEY EXTRACTIONS
   - For each critical field, include a "source" field with a brief quote or section reference
   - Example: { "value": "$150,000", "source": "Total project cost: $150,000 as stated in Section 3.1" }

3. UNCERTAINTY HANDLING
   - If text is ambiguous, set certainty score lower (0.3-0.5)
   - If text is clear and explicit, set certainty score higher (0.8-0.95)
   - NEVER set certainty above 0.95 even for clear text

4. MISSING DATA PROTOCOL
   - For required fields with no data: return null with { "notFound": true, "searchedFor": "description of what was looked for" }
   - For optional fields with no data: return null
   - DO NOT substitute placeholder values or generic text

5. VALIDATION MARKERS
   - Add "extractedFromText": true for all values found in document
   - Add "extractedFromText": false if value was inferred (flag for review)
   - Any inferred values MUST be flagged with "requiresHumanReview": true
`;

// =============================================================================
// SOURCE CITATION TEMPLATE
// =============================================================================
const SOURCE_CITATION_PROMPT = `
FOR EVERY KEY FINDING, PROVIDE SOURCE EVIDENCE:
{
  "fieldName": {
    "value": "extracted value",
    "source": "direct quote or section reference from contract",
    "certainty": 0.85,
    "extractedFromText": true
  }
}

If you cannot find a source quote, the value MUST be null.
`;

// =============================================================================
// INTERFACES
// =============================================================================
export interface PromptTemplate {
  systemPrompt: string;
  userPrompt: string;
  examples: PromptExample[];
  outputSchema: any;
  validationRules: string[];
  antiHallucinationRules?: string[];
  requiredFields?: string[];
  nullableFields?: string[];
}

export interface PromptExample {
  input: string;
  output: any;
  explanation?: string;
  sourceReferences?: string[];
}

export class ArtifactPromptTemplatesService {
  private static instance: ArtifactPromptTemplatesService;

  private constructor() {}

  static getInstance(): ArtifactPromptTemplatesService {
    if (!ArtifactPromptTemplatesService.instance) {
      ArtifactPromptTemplatesService.instance = new ArtifactPromptTemplatesService();
    }
    return ArtifactPromptTemplatesService.instance;
  }

  /**
   * Get enhanced prompt template for artifact type
   */
  getPromptTemplate(artifactType: ArtifactType, context?: any): PromptTemplate {
    switch (artifactType) {
      case 'OVERVIEW':
        return this.getOverviewTemplate(context);
      case 'FINANCIAL':
        return this.getFinancialTemplate(context);
      case 'CLAUSES':
        return this.getClausesTemplate(context);
      case 'RATES':
        return this.getRatesTemplate(context);
      case 'COMPLIANCE':
        return this.getComplianceTemplate(context);
      case 'RISK':
        return this.getRiskTemplate(context);
      default:
        throw new Error(`Unknown artifact type: ${artifactType}`);
    }
  }

  /**
   * Build complete prompt with examples and anti-hallucination safeguards
   */
  buildPrompt(template: PromptTemplate, contractText: string): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const examplesText = template.examples
      .map((ex, idx) => {
        return `
Example ${idx + 1}:
Input: ${ex.input}
Output: ${JSON.stringify(ex.output, null, 2)}
${ex.explanation ? `Explanation: ${ex.explanation}` : ''}
${ex.sourceReferences ? `Source References: ${ex.sourceReferences.join(', ')}` : ''}
`;
      })
      .join('\n');

    // Include anti-hallucination rules if defined
    const antiHallucinationSection = template.antiHallucinationRules 
      ? `\n\nADDITIONAL EXTRACTION RULES:\n${template.antiHallucinationRules.map(r => `- ${r}`).join('\n')}`
      : '';

    // Define required vs nullable fields
    const fieldGuidance = template.requiredFields || template.nullableFields
      ? `\n\nFIELD REQUIREMENTS:
${template.requiredFields ? `Required (must find or mark NOT_FOUND): ${template.requiredFields.join(', ')}` : ''}
${template.nullableFields ? `Optional (return null if not found): ${template.nullableFields.join(', ')}` : ''}`
      : '';

    const userPrompt = `${template.userPrompt}

${examplesText}
${antiHallucinationSection}
${fieldGuidance}

CONTRACT TEXT TO ANALYZE:
---BEGIN CONTRACT---
${contractText.substring(0, 15000)}
---END CONTRACT---

RESPONSE REQUIREMENTS:
1. Return ONLY valid JSON matching the schema
2. Include "certainty" field (0-1) indicating extraction confidence
3. For each key value, add "source" field with quote or section reference from contract
4. Use null for any data NOT explicitly found in the contract text
5. Set "extractedFromText": false for any inferred values (these require human review)

If you cannot find specific information, DO NOT make it up. Use null or "NOT_FOUND".`;

    // Enhanced system prompt with anti-hallucination base
    const enhancedSystemPrompt = `${template.systemPrompt}

${ANTI_HALLUCINATION_BASE}

${SOURCE_CITATION_PROMPT}`;

    return {
      systemPrompt: enhancedSystemPrompt,
      userPrompt,
    };
  }

  // =========================================================================
  // TEMPLATE DEFINITIONS - PRODUCTION-READY WITH ANTI-HALLUCINATION
  // =========================================================================

  private getOverviewTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are an expert contract analyst specializing in extracting key overview information from legal documents. 
You provide accurate, structured data with high attention to detail. Always include a certainty score.

CRITICAL: You must ONLY extract information that is EXPLICITLY stated in the contract text.
- Party names must be exact matches from the document
- Dates must be explicitly mentioned (do not calculate or infer)
- Contract type must be stated or clearly implied by document title/structure
- If jurisdiction is not mentioned, return null (do not guess based on party names)`,
      
      userPrompt: `Extract comprehensive overview information from the contract. Only include information explicitly stated in the document.`,
      
      examples: [
        {
          input: 'CONSULTING AGREEMENT between Acme Corp (Client) and Tech Solutions LLC (Consultant). Effective Date: January 1, 2024. Term: 12 months.',
          output: {
            summary: {
              value: 'Consulting agreement for technology services between Acme Corp and Tech Solutions LLC',
              source: 'Document title: CONSULTING AGREEMENT between Acme Corp (Client) and Tech Solutions LLC',
              extractedFromText: true
            },
            parties: [
              { name: 'Acme Corp', role: 'client', type: 'corporation', source: 'Acme Corp (Client)' },
              { name: 'Tech Solutions LLC', role: 'consultant', type: 'llc', source: 'Tech Solutions LLC (Consultant)' }
            ],
            contractType: { value: 'Consulting Agreement', source: 'Document title', extractedFromText: true },
            effectiveDate: { value: '2024-01-01', source: 'Effective Date: January 1, 2024', extractedFromText: true },
            expirationDate: { value: '2025-01-01', source: 'Calculated from Term: 12 months', extractedFromText: false, requiresHumanReview: true },
            term: { value: '12 months', source: 'Term: 12 months', extractedFromText: true },
            jurisdiction: null,
            keyTerms: ['Technology consulting services', '12-month engagement'],
            certainty: 0.92
          },
          explanation: 'Clear parties, dates, and contract type identified. Note: expirationDate calculated from term requires human review.',
          sourceReferences: ['Document title', 'Effective Date clause', 'Term clause']
        },
        {
          input: 'SERVICE AGREEMENT. This agreement is made on March 15, 2024 between XYZ Inc. and ABC Services.',
          output: {
            summary: {
              value: 'Service agreement between XYZ Inc. and ABC Services',
              source: 'Document title and parties clause',
              extractedFromText: true
            },
            parties: [
              { name: 'XYZ Inc.', role: 'party', type: 'corporation', source: 'between XYZ Inc. and' },
              { name: 'ABC Services', role: 'party', type: 'unknown', source: 'and ABC Services' }
            ],
            contractType: { value: 'Service Agreement', source: 'SERVICE AGREEMENT', extractedFromText: true },
            effectiveDate: { value: '2024-03-15', source: 'made on March 15, 2024', extractedFromText: true },
            expirationDate: null,
            term: null,
            jurisdiction: null,
            keyTerms: [],
            certainty: 0.70
          },
          explanation: 'Basic information present. Party roles not explicitly defined - marked as generic "party". Missing term, jurisdiction, and expiration date left as null.',
          sourceReferences: ['Document title', 'Agreement date clause']
        }
      ],
      
      outputSchema: {
        summary: '{ value: string, source: string, extractedFromText: boolean }',
        parties: 'array of { name: string, role: string, type: string, source: string }',
        contractType: '{ value: string, source: string, extractedFromText: boolean }',
        effectiveDate: '{ value: string (YYYY-MM-DD), source: string, extractedFromText: boolean } or null',
        expirationDate: '{ value: string (YYYY-MM-DD), source: string, extractedFromText: boolean, requiresHumanReview?: boolean } or null',
        term: '{ value: string, source: string, extractedFromText: boolean } or null',
        jurisdiction: '{ value: string, source: string, extractedFromText: boolean } or null',
        keyTerms: 'array of strings',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Must include at least 1 party (2 is typical but not required)',
        'Dates must be in YYYY-MM-DD format or null if not found',
        'Summary must be 10-200 characters',
        'Certainty must be between 0 and 1',
        'Every extracted value must have a source reference',
        'Calculated/inferred values must have extractedFromText: false and requiresHumanReview: true'
      ],

      antiHallucinationRules: [
        'DO NOT assume party roles if not explicitly stated (use "party" as default)',
        'DO NOT calculate dates unless explicitly asked - mark calculated dates with requiresHumanReview: true',
        'DO NOT infer jurisdiction from party names or addresses',
        'If document title is ambiguous, lower certainty to below 0.7',
        'Party types (corporation, llc, individual) must be based on explicit text indicators'
      ],

      requiredFields: ['parties', 'contractType'],
      nullableFields: ['effectiveDate', 'expirationDate', 'term', 'jurisdiction']
    };
  }

  private getFinancialTemplate(context?: any): PromptTemplate {
    const overviewContext = context?.overview ? `
Context from Overview:
- Contract Type: ${context.overview.contractType}
- Parties: ${context.overview.parties?.map((p: any) => p.name).join(', ')}
- Term: ${context.overview.term}
` : '';

    return {
      systemPrompt: `You are a financial analyst expert at extracting monetary information from contracts.
You identify all costs, payment terms, pricing structures, and financial obligations with precision.

CRITICAL FINANCIAL EXTRACTION RULES:
- ONLY extract amounts explicitly stated in the document
- DO NOT calculate totals unless explicitly stated (mark calculated values with requiresHumanReview)
- Currency must be explicitly mentioned or clearly indicated by symbol ($, €, £)
- DO NOT assume payment terms based on industry standards
- If multiple currencies are present, list each separately
- For percentage-based values, quote the exact percentage from the document
${overviewContext}`,
      
      userPrompt: `Extract all financial information from the contract. Only include amounts explicitly stated in the document.`,
      
      examples: [
        {
          input: 'Total project cost: $150,000. Payment terms: Net 30. Monthly retainer: $12,500. 10% discount for early payment.',
          output: {
            totalValue: {
              value: 150000,
              source: 'Total project cost: $150,000',
              extractedFromText: true
            },
            currency: { value: 'USD', source: '$ symbol used', extractedFromText: true },
            paymentTerms: [
              { value: 'Net 30', source: 'Payment terms: Net 30', extractedFromText: true }
            ],
            paymentSchedule: [
              { 
                description: 'Monthly retainer', 
                amount: 12500, 
                frequency: 'monthly',
                source: 'Monthly retainer: $12,500',
                extractedFromText: true
              }
            ],
            costBreakdown: [
              { 
                category: 'Total Project Cost', 
                amount: 150000, 
                description: 'Full project value',
                source: 'Total project cost: $150,000'
              },
              { 
                category: 'Monthly Retainer', 
                amount: 12500, 
                description: 'Recurring monthly fee',
                source: 'Monthly retainer: $12,500'
              }
            ],
            discounts: [
              { 
                type: 'early_payment', 
                value: 10, 
                unit: 'percentage', 
                description: '10% discount for early payment',
                source: '10% discount for early payment'
              }
            ],
            penalties: [],
            certainty: 0.92
          },
          explanation: 'All values directly quoted from contract text with source references'
        }
      ],
      
      outputSchema: {
        totalValue: '{ value: number, source: string, extractedFromText: boolean } or null',
        currency: '{ value: string (ISO code), source: string, extractedFromText: boolean }',
        paymentTerms: 'array of { value: string, source: string, extractedFromText: boolean }',
        paymentSchedule: 'array of { description, amount, frequency, dueDate?, source, extractedFromText }',
        costBreakdown: 'array of { category, amount, description, source }',
        discounts: 'array of { type, value, unit, description, source }',
        penalties: 'array of { type, amount, description, trigger, source }',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'All amounts must be positive numbers',
        'Currency must be valid ISO code',
        'Payment terms must be specific',
        'Cost breakdown should sum to totalValue if possible',
        'Every financial value MUST have a source reference',
        'Calculated totals must be flagged with requiresHumanReview: true'
      ],

      antiHallucinationRules: [
        'DO NOT calculate totals - only extract explicitly stated amounts',
        'DO NOT assume currency - must be explicitly stated or indicated by symbol',
        'DO NOT infer payment terms based on industry standards',
        'If conflicting amounts are found, include ALL with separate source references',
        'Mark any derived values (e.g., annual from monthly) with extractedFromText: false'
      ],

      requiredFields: ['currency'],
      nullableFields: ['totalValue', 'paymentTerms', 'paymentSchedule', 'costBreakdown', 'discounts', 'penalties']
    };
  }

  private getClausesTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are a legal expert specializing in contract clause analysis.
You identify, categorize, and assess the risk level of contract clauses with high accuracy.

CRITICAL CLAUSE EXTRACTION RULES:
- Extract ONLY clauses that actually exist in the document
- Quote or closely paraphrase the actual clause text
- DO NOT invent standard clauses that are "typically" in contracts
- Risk assessment must be based on the actual clause language, not general knowledge
- If a common clause type is MISSING, note it in a separate "missingClauses" array`,
      
      userPrompt: `Extract and analyze all significant clauses from the contract. Only include clauses actually present in the document.`,
      
      examples: [
        {
          input: 'TERMINATION: Either party may terminate this agreement with 30 days written notice. CONFIDENTIALITY: All proprietary information must remain confidential for 2 years post-termination.',
          output: {
            clauses: [
              {
                id: 'clause-1',
                type: 'Termination',
                title: 'Termination Rights',
                content: 'Either party may terminate this agreement with 30 days written notice.',
                source: 'Section: TERMINATION',
                riskLevel: 'low',
                importance: 'high',
                obligations: ['Provide 30 days written notice'],
                beneficiary: 'both',
                concerns: [],
                extractedFromText: true
              },
              {
                id: 'clause-2',
                type: 'Confidentiality',
                title: 'Confidentiality Obligations',
                content: 'All proprietary information must remain confidential for 2 years post-termination.',
                source: 'Section: CONFIDENTIALITY',
                riskLevel: 'medium',
                importance: 'high',
                obligations: ['Maintain confidentiality for 2 years after termination'],
                beneficiary: 'both',
                concerns: ['Extended post-termination obligations'],
                extractedFromText: true
              }
            ],
            missingClauses: [],
            certainty: 0.88
          },
          explanation: 'Clauses extracted with direct quotes from document sections'
        }
      ],
      
      outputSchema: {
        clauses: 'array of {id, type, title, content, source, riskLevel, importance, obligations, beneficiary, concerns, extractedFromText}',
        missingClauses: 'array of strings (common clause types NOT found in document)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Each clause must have unique id',
        'Risk level must be: low, medium, or high',
        'Importance must be: low, medium, or high',
        'Content must be non-empty and must be from the document',
        'Every clause MUST have a source reference',
        'Risk assessment must be based on clause language, not assumptions'
      ],

      antiHallucinationRules: [
        'DO NOT invent clauses that are "typically" in contracts',
        'DO NOT generate standard boilerplate if not in document',
        'Risk level must be justified by the actual clause text',
        'If a clause type is expected but missing, add to missingClauses array',
        'Content field must quote or closely paraphrase actual text',
        'DO NOT assume obligations - they must be explicitly stated'
      ],

      requiredFields: ['clauses'],
      nullableFields: ['missingClauses']
    };
  }

  private getRatesTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are an expert at extracting rate card information from professional services contracts.
You identify hourly rates, daily rates, role-based pricing, and location-based variations.

CRITICAL RATE EXTRACTION RULES:
- Extract ONLY rates explicitly stated in the document
- DO NOT calculate derived rates (e.g., don't calculate daily from hourly)
- Each rate must have a source quote from the document
- If a rate appears in a table, reference the table
- Location-based or time-based variations must be explicitly stated`,
      
      userPrompt: `Extract all rate card and pricing information from the contract. Only include rates explicitly stated.`,
      
      examples: [
        {
          input: 'Senior Developer: $175/hour. Junior Developer: $125/hour. Rates apply to US locations. Offshore rates: 30% discount.',
          output: {
            rateCards: [
              {
                role: 'Senior Developer',
                level: 'Senior',
                rate: 175,
                unit: 'hour',
                currency: 'USD',
                location: 'US',
                source: 'Senior Developer: $175/hour',
                extractedFromText: true,
                effectiveDate: null,
                notes: null
              },
              {
                role: 'Junior Developer',
                level: 'Junior',
                rate: 125,
                unit: 'hour',
                currency: 'USD',
                location: 'US',
                source: 'Junior Developer: $125/hour',
                extractedFromText: true,
                effectiveDate: null,
                notes: null
              }
            ],
            calculatedRates: [
              {
                role: 'Senior Developer',
                level: 'Senior',
                rate: 122.50,
                unit: 'hour',
                currency: 'USD',
                location: 'Offshore',
                source: 'Offshore rates: 30% discount',
                extractedFromText: false,
                requiresHumanReview: true,
                calculationMethod: 'Applied 30% discount to US rate',
                notes: '30% discount applied'
              },
              {
                role: 'Junior Developer',
                level: 'Junior',
                rate: 87.50,
                unit: 'hour',
                currency: 'USD',
                location: 'Offshore',
                effectiveDate: null,
                notes: '30% discount applied'
              }
            ],
            roles: ['Senior Developer', 'Junior Developer'],
            locations: ['US', 'Offshore'],
            rateModifiers: [
              { 
                type: 'location', 
                condition: 'Offshore', 
                adjustment: -30, 
                unit: 'percentage',
                source: 'Offshore rates: 30% discount'
              }
            ],
            certainty: 0.85
          },
          explanation: 'Explicit rates in rateCards, calculated rates in separate array with requiresHumanReview flag'
        }
      ],
      
      outputSchema: {
        rateCards: 'array of {role, level, rate, unit, currency, location, source, extractedFromText, effectiveDate, notes}',
        calculatedRates: 'array of rates that were derived/calculated (must have requiresHumanReview: true)',
        roles: 'array of strings',
        locations: 'array of strings',
        rateModifiers: 'array of {type, condition, adjustment, unit, source}',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Rates must be positive numbers',
        'Unit must be: hour, day, week, month, or year',
        'Currency must be valid ISO code',
        'Each rate card must have role and rate',
        'Every rate MUST have a source reference',
        'Calculated rates must be in separate calculatedRates array with requiresHumanReview: true'
      ],

      antiHallucinationRules: [
        'DO NOT calculate rates not explicitly stated',
        'DO NOT assume role levels if not specified',
        'DO NOT infer location-based pricing without explicit text',
        'Separate explicitly stated rates from calculated/derived rates',
        'If rate unit is ambiguous, use lower certainty and add note'
      ],

      requiredFields: ['rateCards'],
      nullableFields: ['calculatedRates', 'roles', 'locations', 'rateModifiers']
    };
  }

  private getComplianceTemplate(context?: any): PromptTemplate {
    return {
      systemPrompt: `You are a compliance expert specializing in identifying regulatory requirements and certifications in contracts.
You recognize GDPR, HIPAA, SOC 2, ISO standards, and other compliance frameworks.

CRITICAL COMPLIANCE EXTRACTION RULES:
- Only extract regulations/certifications EXPLICITLY mentioned in the document
- DO NOT assume compliance requirements based on industry or contract type
- Each requirement must have a source quote from the document
- DO NOT infer GDPR/HIPAA applicability - it must be stated
- If no compliance requirements are found, return empty arrays (not typical requirements)`,
      
      userPrompt: `Extract all compliance and regulatory information explicitly mentioned in the contract.`,
      
      examples: [
        {
          input: 'Vendor must maintain SOC 2 Type II certification. All data processing must comply with GDPR. Annual security audits required.',
          output: {
            regulations: [
              { name: 'GDPR', source: 'All data processing must comply with GDPR', extractedFromText: true }
            ],
            certifications: [
              { name: 'SOC 2 Type II', source: 'Vendor must maintain SOC 2 Type II certification', extractedFromText: true }
            ],
            complianceRequirements: [
              {
                requirement: 'Maintain SOC 2 Type II certification',
                category: 'Security',
                mandatory: true,
                frequency: 'ongoing',
                responsibility: 'vendor',
                source: 'Vendor must maintain SOC 2 Type II certification',
                extractedFromText: true
              },
              {
                requirement: 'GDPR compliance for all data processing',
                category: 'Data Privacy',
                mandatory: true,
                frequency: 'ongoing',
                responsibility: 'vendor',
                source: 'All data processing must comply with GDPR',
                extractedFromText: true
              },
              {
                requirement: 'Annual security audits',
                category: 'Security',
                mandatory: true,
                frequency: 'annual',
                responsibility: 'vendor',
                source: 'Annual security audits required',
                extractedFromText: true
              }
            ],
            auditRights: [
              { right: 'Annual security audits', source: 'Annual security audits required', extractedFromText: true }
            ],
            dataProtection: [
              { requirement: 'GDPR compliance', source: 'All data processing must comply with GDPR', extractedFromText: true }
            ],
            notFoundCompliance: [],
            certainty: 0.91
          },
          explanation: 'All compliance requirements extracted with source references. No inferred requirements.'
        }
      ],
      
      outputSchema: {
        regulations: 'array of { name: string, source: string, extractedFromText: boolean }',
        certifications: 'array of { name: string, source: string, extractedFromText: boolean }',
        complianceRequirements: 'array of {requirement, category, mandatory, frequency, responsibility, source, extractedFromText}',
        auditRights: 'array of { right: string, source: string, extractedFromText: boolean }',
        dataProtection: 'array of { requirement: string, source: string, extractedFromText: boolean }',
        notFoundCompliance: 'array of strings (common compliance items NOT found in document)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Regulations must be recognized standards',
        'Certifications must be industry-standard',
        'Requirements must specify responsibility',
        'Frequency must be: ongoing, annual, quarterly, monthly, or one-time',
        'Every compliance item MUST have a source reference',
        'DO NOT infer compliance requirements - only extract explicit mentions'
      ],

      antiHallucinationRules: [
        'DO NOT assume GDPR/HIPAA/SOC2 requirements based on industry',
        'DO NOT add "typical" compliance requirements not in document',
        'If no compliance requirements found, return empty arrays',
        'Only include regulations EXPLICITLY mentioned by name',
        'Add missing common requirements to notFoundCompliance for awareness',
        'Responsibility must be explicitly stated, not inferred from context'
      ],

      requiredFields: [],
      nullableFields: ['regulations', 'certifications', 'complianceRequirements', 'auditRights', 'dataProtection', 'notFoundCompliance']
    };
  }

  private getRiskTemplate(context?: any): PromptTemplate {
    const financialContext = context?.financial ? `
Financial Context:
- Total Value: ${context.financial.currency} ${context.financial.totalValue}
- Payment Terms: ${context.financial.paymentTerms?.join(', ')}
` : '';

    const clausesContext = context?.clauses ? `
Key Clauses Identified: ${context.clauses.clauses?.length || 0} clauses analyzed
` : '';

    return {
      systemPrompt: `You are a risk assessment expert specializing in indirect procurement contract analysis.
You identify financial, legal, operational, and reputational risks with detailed recommendations.
Focus on cost savings opportunities and optimization potential in indirect procurement.

CRITICAL RISK ASSESSMENT RULES:
- Base ALL risk assessments on ACTUAL contract language, not assumptions
- Every risk must reference the specific clause or term that creates the risk
- DO NOT invent risks based on "typical" contract issues
- If contract terms are actually favorable, reflect that in a lower risk score
- Missing protections should be noted, but don't fabricate the negative terms
${financialContext}${clausesContext}`,
      
      userPrompt: `Analyze risks in the contract based ONLY on actual contract language. Every risk must reference its source in the document.`,
      
      examples: [
        {
          input: 'Unlimited liability for data breaches. Termination without cause with 7 days notice. No cap on penalties.',
          output: {
            overallScore: 85,
            riskLevel: 'high',
            riskFactors: [
              {
                category: 'Legal',
                severity: 'high',
                description: 'Unlimited liability for data breaches',
                source: 'Unlimited liability for data breaches',
                extractedFromText: true,
                impact: 'Could result in catastrophic financial loss',
                likelihood: 'medium',
                mitigation: 'Negotiate liability cap'
              },
              {
                category: 'Operational',
                severity: 'high',
                description: 'Termination without cause with only 7 days notice',
                source: 'Termination without cause with 7 days notice',
                extractedFromText: true,
                impact: 'Insufficient time to transition or find alternatives',
                likelihood: 'low',
                mitigation: 'Request 30-60 days notice period'
              },
              {
                category: 'Financial',
                severity: 'high',
                description: 'No cap on penalties',
                source: 'No cap on penalties',
                extractedFromText: true,
                impact: 'Unlimited financial exposure',
                likelihood: 'medium',
                mitigation: 'Negotiate penalty caps'
              }
            ],
            recommendations: [
              'Negotiate liability limitations before signing',
              'Request extended termination notice period',
              'Establish penalty caps',
              'Consider insurance coverage',
              'Require legal review'
            ],
            costSavingsOpportunities: [
              'Negotiate liability cap to reduce insurance costs',
              'Extended notice period allows better supplier transition planning',
              'Penalty caps reduce financial exposure'
            ],
            redFlags: [
              { flag: 'Unlimited liability exposure', source: 'Unlimited liability for data breaches', extractedFromText: true },
              { flag: 'Extremely short termination notice', source: 'Termination without cause with 7 days notice', extractedFromText: true },
              { flag: 'Uncapped penalties', source: 'No cap on penalties', extractedFromText: true }
            ],
            missingProtections: [],
            certainty: 0.89
          },
          explanation: 'All risks based on actual contract language with source references'
        }
      ],
      
      outputSchema: {
        overallScore: 'number (0-100, higher = more risk)',
        riskLevel: 'string (low, medium, high, critical)',
        riskFactors: 'array of {category, severity, description, source, extractedFromText, impact, likelihood, mitigation}',
        recommendations: 'array of strings',
        redFlags: 'array of { flag: string, source: string, extractedFromText: boolean }',
        costSavingsOpportunities: 'array of strings (indirect procurement cost optimization)',
        missingProtections: 'array of strings (common protections NOT found in contract)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Overall score must be 0-100',
        'Risk level must match score (0-30: low, 31-60: medium, 61-85: high, 86-100: critical)',
        'Each risk factor must have mitigation',
        'Recommendations must be actionable',
        'Every risk MUST have a source reference to contract language',
        'DO NOT invent risks - only assess risks from actual contract terms'
      ],

      antiHallucinationRules: [
        'DO NOT invent risks that are not in the contract',
        'Every risk factor MUST cite specific contract language',
        'If contract has favorable terms, reflect in LOWER risk score',
        'Missing protections go in missingProtections array, not as invented risks',
        'Impact and likelihood assessments must be reasonable given the actual terms',
        'DO NOT assume worst-case scenarios not supported by contract language'
      ],

      requiredFields: ['overallScore', 'riskLevel'],
      nullableFields: ['riskFactors', 'recommendations', 'redFlags', 'costSavingsOpportunities', 'missingProtections']
    };
  }
}

export const artifactPromptTemplatesService = ArtifactPromptTemplatesService.getInstance();

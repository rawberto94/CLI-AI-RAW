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
- If jurisdiction is not mentioned, return null (do not guess based on party names)

CONTEXTUAL AI EXTRACTION - CAPTURE ALL RELEVANT INFORMATION:
Every contract is unique. Beyond the standard fields, you MUST:
1. IDENTIFY any additional relevant overview information unique to this contract
2. PRESERVE document structure - if the contract has special sections, headers, or organization, capture them
3. EXTRACT any definitions, recitals, background sections, or preambles verbatim
4. CAPTURE referenced documents, attachments, schedules, exhibits mentioned
5. NOTE any unique terminology or abbreviations defined in the contract

Use the "additionalData" field for ANY contract-specific information not fitting standard fields.
Use the "rawSections" field to preserve exact text of important sections.`,
      
      userPrompt: `Extract comprehensive overview information from the contract. Only include information explicitly stated in the document.

IMPORTANT: This is CONTEXTUAL AI extraction - go beyond the standard fields:
- Extract ALL relevant overview information, even if not in the predefined schema
- Preserve exact wording of definitions and recitals
- Capture referenced documents and schedules
- Note any unique contract features or structure`,
      
      examples: [
        {
          input: 'CONSULTING AGREEMENT between Acme Corp (Client) and Tech Solutions LLC (Consultant). Effective Date: January 1, 2024. Term: 12 months. WHEREAS, Client desires consulting services for Project Phoenix...',
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
            certainty: 0.92,
            additionalData: {
              projectName: { value: 'Project Phoenix', source: 'WHEREAS, Client desires consulting services for Project Phoenix', extractedFromText: true },
              recitals: [
                { text: 'WHEREAS, Client desires consulting services for Project Phoenix...', source: 'Recitals section', extractedFromText: true }
              ]
            },
            rawSections: {
              recitals: 'WHEREAS, Client desires consulting services for Project Phoenix...'
            },
            referencedDocuments: [],
            definitions: []
          },
          explanation: 'Clear parties, dates, and contract type identified. Also captured project name and recitals in additionalData.',
          sourceReferences: ['Document title', 'Effective Date clause', 'Term clause', 'Recitals']
        },
        {
          input: 'MASTER SERVICES AGREEMENT\n\nDEFINITIONS:\n"Services" means IT consulting.\n"Deliverables" means all work products.\n\nSchedule A: Statement of Work\nSchedule B: Rate Card\n\nThis agreement is made on March 15, 2024 between XYZ Inc. ("Company") and ABC Services ("Vendor").',
          output: {
            summary: {
              value: 'Master services agreement for IT consulting between XYZ Inc. and ABC Services',
              source: 'Document title and Definitions section',
              extractedFromText: true
            },
            parties: [
              { name: 'XYZ Inc.', role: 'company', type: 'corporation', source: 'XYZ Inc. ("Company")' },
              { name: 'ABC Services', role: 'vendor', type: 'unknown', source: 'ABC Services ("Vendor")' }
            ],
            contractType: { value: 'Master Services Agreement', source: 'MASTER SERVICES AGREEMENT', extractedFromText: true },
            effectiveDate: { value: '2024-03-15', source: 'made on March 15, 2024', extractedFromText: true },
            expirationDate: null,
            term: null,
            jurisdiction: null,
            keyTerms: ['IT consulting', 'Master services', 'Work products'],
            certainty: 0.85,
            additionalData: {
              partyAliases: {
                'XYZ Inc.': 'Company',
                'ABC Services': 'Vendor'
              }
            },
            rawSections: {
              definitions: 'DEFINITIONS:\n"Services" means IT consulting.\n"Deliverables" means all work products.'
            },
            referencedDocuments: [
              { name: 'Schedule A', description: 'Statement of Work', source: 'Schedule A: Statement of Work' },
              { name: 'Schedule B', description: 'Rate Card', source: 'Schedule B: Rate Card' }
            ],
            definitions: [
              { term: 'Services', meaning: 'IT consulting', source: '"Services" means IT consulting.', extractedFromText: true },
              { term: 'Deliverables', meaning: 'all work products', source: '"Deliverables" means all work products.', extractedFromText: true }
            ]
          },
          explanation: 'Captured definitions, referenced schedules, and party aliases. These are critical for understanding the full contract context.',
          sourceReferences: ['Document title', 'Definitions section', 'Agreement date clause', 'Schedules list']
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
        certainty: 'number (0-1)',
        additionalData: 'object - ANY additional overview info specific to this contract (project names, references, special terms)',
        rawSections: 'object - key/value pairs preserving exact text of important sections (recitals, definitions, preambles)',
        referencedDocuments: 'array of { name: string, description: string, source: string } - schedules, exhibits, attachments',
        definitions: 'array of { term: string, meaning: string, source: string, extractedFromText: boolean } - defined terms'
      },
      
      validationRules: [
        'Must include at least 1 party (2 is typical but not required)',
        'Dates must be in YYYY-MM-DD format or null if not found',
        'Summary must be 10-200 characters',
        'Certainty must be between 0 and 1',
        'Every extracted value must have a source reference',
        'Calculated/inferred values must have extractedFromText: false and requiresHumanReview: true',
        'additionalData should capture ANY contract-specific info not in standard fields',
        'rawSections should preserve exact text of key sections'
      ],

      antiHallucinationRules: [
        'DO NOT assume party roles if not explicitly stated (use "party" as default)',
        'DO NOT calculate dates unless explicitly asked - mark calculated dates with requiresHumanReview: true',
        'DO NOT infer jurisdiction from party names or addresses',
        'If document title is ambiguous, lower certainty to below 0.7',
        'Party types (corporation, llc, individual) must be based on explicit text indicators',
        'additionalData values must come from the contract - do not invent',
        'rawSections must be EXACT quotes from the document'
      ],

      requiredFields: ['parties', 'contractType'],
      nullableFields: ['effectiveDate', 'expirationDate', 'term', 'jurisdiction', 'additionalData', 'rawSections', 'referencedDocuments', 'definitions']
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
You identify all costs, payment terms, pricing structures, financial tables, offers, and financial obligations with precision.

CRITICAL FINANCIAL EXTRACTION RULES:
- ONLY extract amounts explicitly stated in the document
- DO NOT calculate totals unless explicitly stated (mark calculated values with requiresHumanReview)
- Currency must be explicitly mentioned or clearly indicated by symbol ($, €, £)
- DO NOT assume payment terms based on industry standards
- If multiple currencies are present, list each separately
- For percentage-based values, quote the exact percentage from the document

FINANCIAL TABLES EXTRACTION - PRESERVE EXACT STRUCTURE:
- Tables in contracts vary widely - some have 3 columns, others have 10+
- PRESERVE the EXACT column headers as they appear (e.g., "Daily Rate", "Monthly Estimate", "Resource Type")
- DO NOT normalize or rename columns - keep them exactly as written
- Extract both:
  1. "rows" - array of objects with keys matching the exact header names
  2. "rawRows" - array of string arrays for 1:1 fidelity with the original table
- Include table footnotes or annotations in the "notes" field
- Common table types: rate cards, fee schedules, milestone payments, resource pricing, deliverable costs, expense tables
- Calculate subtotals and totals ONLY if explicitly stated in document

OFFERS/QUOTES EXTRACTION:
- For offers/quotes: extract validity period, terms, and conditions if present
- Look for: milestone payments, phase costs, deliverable pricing, service fees
${overviewContext}`,
      
      userPrompt: `Extract all financial information from the contract including:
1. Overall contract value and payment terms
2. Financial tables - PRESERVE EXACT column structure as they appear
   - Use the EXACT header names from the table
   - Include rawRows for 1:1 table reproduction
3. Offers/quotes with line items
4. Subtotals, totals, and grand totals (only if explicitly stated)
5. Cost breakdowns by category, phase, or deliverable
6. Any discounts, penalties, or adjustments

Only include amounts explicitly stated in the document.`,
      
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
            financialTables: [],
            offers: [],
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
        },
        {
          input: `PRICING SCHEDULE
| Service | Quantity | Unit Price | Total |
| Development | 500 hrs | $150/hr | $75,000 |
| Testing | 100 hrs | $125/hr | $12,500 |
| Project Management | 80 hrs | $175/hr | $14,000 |
Subtotal: $101,500
Travel & Expenses: $8,500
Grand Total: $110,000

Quote valid for 30 days. 50% due upon signing, 50% upon completion.`,
          output: {
            totalValue: {
              value: 110000,
              source: 'Grand Total: $110,000',
              extractedFromText: true
            },
            currency: { value: 'USD', source: '$ symbol used throughout', extractedFromText: true },
            paymentTerms: [
              { value: '50% due upon signing', source: '50% due upon signing, 50% upon completion', extractedFromText: true },
              { value: '50% due upon completion', source: '50% due upon signing, 50% upon completion', extractedFromText: true }
            ],
            paymentSchedule: [
              { description: 'Upon signing', amount: 55000, frequency: 'one-time', source: '50% due upon signing', extractedFromText: false, requiresHumanReview: true, calculationMethod: '50% of $110,000' },
              { description: 'Upon completion', amount: 55000, frequency: 'one-time', source: '50% upon completion', extractedFromText: false, requiresHumanReview: true, calculationMethod: '50% of $110,000' }
            ],
            costBreakdown: [
              { category: 'Development', amount: 75000, description: '500 hrs at $150/hr', source: 'Development | 500 hrs | $150/hr | $75,000' },
              { category: 'Testing', amount: 12500, description: '100 hrs at $125/hr', source: 'Testing | 100 hrs | $125/hr | $12,500' },
              { category: 'Project Management', amount: 14000, description: '80 hrs at $175/hr', source: 'Project Management | 80 hrs | $175/hr | $14,000' },
              { category: 'Travel & Expenses', amount: 8500, description: 'Travel and expense allowance', source: 'Travel & Expenses: $8,500' }
            ],
            financialTables: [
              {
                tableName: 'Pricing Schedule',
                source: 'PRICING SCHEDULE table',
                headers: ['Service', 'Quantity', 'Unit Price', 'Total'],
                rows: [
                  { 'Service': 'Development', 'Quantity': '500 hrs', 'Unit Price': '$150/hr', 'Total': '$75,000' },
                  { 'Service': 'Testing', 'Quantity': '100 hrs', 'Unit Price': '$125/hr', 'Total': '$12,500' },
                  { 'Service': 'Project Management', 'Quantity': '80 hrs', 'Unit Price': '$175/hr', 'Total': '$14,000' }
                ],
                rawRows: [
                  ['Development', '500 hrs', '$150/hr', '$75,000'],
                  ['Testing', '100 hrs', '$125/hr', '$12,500'],
                  ['Project Management', '80 hrs', '$175/hr', '$14,000']
                ],
                subtotals: [
                  { label: 'Subtotal', amount: 101500, source: 'Subtotal: $101,500', extractedFromText: true }
                ],
                grandTotal: { amount: 110000, source: 'Grand Total: $110,000', extractedFromText: true },
                extractedFromText: true
              }
            ],
            offers: [
              {
                offerName: 'Project Quote',
                validityPeriod: '30 days',
                validitySource: 'Quote valid for 30 days',
                totalAmount: 110000,
                lineItems: [
                  { description: 'Development', quantity: 500, unit: 'hours', unitPrice: 150, total: 75000 },
                  { description: 'Testing', quantity: 100, unit: 'hours', unitPrice: 125, total: 12500 },
                  { description: 'Project Management', quantity: 80, unit: 'hours', unitPrice: 175, total: 14000 },
                  { description: 'Travel & Expenses', quantity: 1, unit: 'lump sum', unitPrice: 8500, total: 8500 }
                ],
                terms: ['50% due upon signing', '50% upon completion'],
                extractedFromText: true
              }
            ],
            discounts: [],
            penalties: [],
            certainty: 0.95
          },
          explanation: 'Extracted pricing table with line items, subtotals, and grand total. Payment schedule marked as calculated (requiresHumanReview) since percentages were applied.'
        },
        {
          input: `FEE SCHEDULE - CONSULTING SERVICES

Resource Type | Location | Daily Rate | Monthly Estimate
Senior Consultant | Onsite | €1,200 | €24,000
Junior Consultant | Remote | €650 | €13,000
Technical Lead | Hybrid | €1,500 | €30,000

Additional Fees:
- Travel per diem: €150/day
- Equipment rental: €500/month

Total Monthly Budget: €67,650`,
          output: {
            totalValue: {
              value: 67650,
              source: 'Total Monthly Budget: €67,650',
              extractedFromText: true
            },
            currency: { value: 'EUR', source: '€ symbol used', extractedFromText: true },
            paymentTerms: [],
            paymentSchedule: [],
            costBreakdown: [
              { category: 'Senior Consultant', amount: 24000, description: 'Monthly estimate', source: 'Senior Consultant | Onsite | €1,200 | €24,000' },
              { category: 'Junior Consultant', amount: 13000, description: 'Monthly estimate', source: 'Junior Consultant | Remote | €650 | €13,000' },
              { category: 'Technical Lead', amount: 30000, description: 'Monthly estimate', source: 'Technical Lead | Hybrid | €1,500 | €30,000' },
              { category: 'Travel per diem', amount: 150, description: 'Per day rate', source: 'Travel per diem: €150/day' },
              { category: 'Equipment rental', amount: 500, description: 'Monthly rate', source: 'Equipment rental: €500/month' }
            ],
            financialTables: [
              {
                tableName: 'Fee Schedule - Consulting Services',
                source: 'FEE SCHEDULE - CONSULTING SERVICES table',
                headers: ['Resource Type', 'Location', 'Daily Rate', 'Monthly Estimate'],
                rows: [
                  { 'Resource Type': 'Senior Consultant', 'Location': 'Onsite', 'Daily Rate': '€1,200', 'Monthly Estimate': '€24,000' },
                  { 'Resource Type': 'Junior Consultant', 'Location': 'Remote', 'Daily Rate': '€650', 'Monthly Estimate': '€13,000' },
                  { 'Resource Type': 'Technical Lead', 'Location': 'Hybrid', 'Daily Rate': '€1,500', 'Monthly Estimate': '€30,000' }
                ],
                rawRows: [
                  ['Senior Consultant', 'Onsite', '€1,200', '€24,000'],
                  ['Junior Consultant', 'Remote', '€650', '€13,000'],
                  ['Technical Lead', 'Hybrid', '€1,500', '€30,000']
                ],
                grandTotal: { amount: 67650, source: 'Total Monthly Budget: €67,650', extractedFromText: true },
                extractedFromText: true
              }
            ],
            offers: [],
            discounts: [],
            penalties: [],
            certainty: 0.93
          },
          explanation: 'Table with different columns (Location, Daily Rate, Monthly Estimate). Preserved exact column headers and values as they appear in the contract.'
        }
      ],
      
      outputSchema: {
        totalValue: '{ value: number, source: string, extractedFromText: boolean } or null',
        currency: '{ value: string (ISO code), source: string, extractedFromText: boolean }',
        paymentTerms: 'array of { value: string, source: string, extractedFromText: boolean }',
        paymentSchedule: 'array of { description, amount, frequency, dueDate?, source, extractedFromText, requiresHumanReview?, calculationMethod? }',
        costBreakdown: 'array of { category, amount, description, source }',
        financialTables: `array of {
          tableName: string (title of the table as it appears),
          source: string (reference to table location),
          headers: string[] (EXACT column headers as they appear in the document),
          rows: array of objects where keys match the headers exactly (e.g., { "Resource Type": "Senior Dev", "Rate": "$150" }),
          rawRows: array of string[] (each row as array of cell values in order, for 1:1 fidelity),
          subtotals?: array of { label, amount, source, extractedFromText },
          grandTotal?: { amount, source, extractedFromText },
          notes?: string (any footnotes or annotations on the table),
          extractedFromText: boolean
        }`,
        offers: 'array of { offerName, validityPeriod?, validitySource?, totalAmount, lineItems: array of { description, quantity, unit, unitPrice, total }, terms: string[], extractedFromText }',
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
        'Calculated totals must be flagged with requiresHumanReview: true',
        'Financial tables must preserve row/column relationships',
        'Line item totals should match quantity * unitPrice where applicable',
        'Subtotals and grand totals must be explicitly stated (not calculated)'
      ],

      antiHallucinationRules: [
        'DO NOT calculate totals - only extract explicitly stated amounts',
        'DO NOT assume currency - must be explicitly stated or indicated by symbol',
        'DO NOT infer payment terms based on industry standards',
        'If conflicting amounts are found, include ALL with separate source references',
        'Mark any derived values (e.g., annual from monthly) with extractedFromText: false',
        'DO NOT invent line items - only extract what is explicitly in the table',
        'If a table has no explicit total, do NOT calculate one',
        'Preserve EXACT table structure - do not merge, split, or rename columns',
        'Use the EXACT column headers as they appear in the document (do not normalize to Service/Quantity/Price)',
        'Include rawRows array with cell values exactly as they appear for 1:1 reproduction',
        'Tables may have any number of columns - extract all of them as they are'
      ],

      requiredFields: ['currency'],
      nullableFields: ['totalValue', 'paymentTerms', 'paymentSchedule', 'costBreakdown', 'financialTables', 'offers', 'discounts', 'penalties']
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
- If a common clause type is MISSING, note it in a separate "missingClauses" array

CONTEXTUAL AI EXTRACTION - PRESERVE EXACT CLAUSE STRUCTURE:
Every contract structures clauses differently. You MUST:
1. PRESERVE the exact section numbering/lettering (1.1, 1.2, A, B, i, ii, etc.)
2. CAPTURE nested subclauses and their hierarchy
3. EXTRACT the FULL clause text verbatim in "rawText" for important clauses
4. IDENTIFY any cross-references to other clauses or documents
5. NOTE any defined terms used within clauses
6. CAPTURE clause headers/titles exactly as they appear
7. EXTRACT any schedules, exhibits, or appendices referenced by clauses

Use "rawClauseText" to preserve the EXACT formatting of complex clauses.
Use "subclauses" for nested clause structures.
Use "customClauseTypes" for any clause categories unique to this contract.`,
      
      userPrompt: `Extract and analyze all significant clauses from the contract. Only include clauses actually present in the document.

IMPORTANT: This is CONTEXTUAL AI extraction:
- Preserve exact clause numbering and hierarchy
- Capture the full verbatim text of important clauses
- Note cross-references between clauses
- Identify any unique clause structures in this contract`,
      
      examples: [
        {
          input: 'TERMINATION: Either party may terminate this agreement with 30 days written notice. CONFIDENTIALITY: All proprietary information must remain confidential for 2 years post-termination.',
          output: {
            clauses: [
              {
                id: 'clause-1',
                type: 'Termination',
                title: 'Termination Rights',
                sectionNumber: null,
                content: 'Either party may terminate this agreement with 30 days written notice.',
                rawClauseText: 'TERMINATION: Either party may terminate this agreement with 30 days written notice.',
                source: 'Section: TERMINATION',
                riskLevel: 'low',
                importance: 'high',
                obligations: ['Provide 30 days written notice'],
                beneficiary: 'both',
                concerns: [],
                extractedFromText: true,
                crossReferences: [],
                definedTermsUsed: [],
                subclauses: []
              },
              {
                id: 'clause-2',
                type: 'Confidentiality',
                title: 'Confidentiality Obligations',
                sectionNumber: null,
                content: 'All proprietary information must remain confidential for 2 years post-termination.',
                rawClauseText: 'CONFIDENTIALITY: All proprietary information must remain confidential for 2 years post-termination.',
                source: 'Section: CONFIDENTIALITY',
                riskLevel: 'medium',
                importance: 'high',
                obligations: ['Maintain confidentiality for 2 years after termination'],
                beneficiary: 'both',
                concerns: ['Extended post-termination obligations'],
                extractedFromText: true,
                crossReferences: [],
                definedTermsUsed: ['proprietary information'],
                subclauses: []
              }
            ],
            missingClauses: [],
            certainty: 0.88
          },
          explanation: 'Clauses extracted with direct quotes from document sections'
        },
        {
          input: '5. LIABILITY\n5.1 Limitation of Liability. Subject to Section 5.2, neither party shall be liable for any indirect damages.\n5.2 Exceptions. The limitation in Section 5.1 does not apply to: (a) breaches of confidentiality; (b) gross negligence.',
          output: {
            clauses: [
              {
                id: 'clause-5',
                type: 'Liability',
                title: 'LIABILITY',
                sectionNumber: '5',
                content: 'Limitation of Liability provisions with exceptions for confidentiality breaches and gross negligence.',
                rawClauseText: '5. LIABILITY\n5.1 Limitation of Liability. Subject to Section 5.2, neither party shall be liable for any indirect damages.\n5.2 Exceptions. The limitation in Section 5.1 does not apply to: (a) breaches of confidentiality; (b) gross negligence.',
                source: 'Section 5',
                riskLevel: 'medium',
                importance: 'high',
                obligations: ['Limited liability for indirect damages', 'Full liability for confidentiality breaches and gross negligence'],
                beneficiary: 'both',
                concerns: ['Exceptions may expose to significant liability'],
                extractedFromText: true,
                crossReferences: [
                  { from: '5.1', to: '5.2', context: 'Subject to Section 5.2' }
                ],
                definedTermsUsed: [],
                subclauses: [
                  {
                    id: 'clause-5.1',
                    sectionNumber: '5.1',
                    title: 'Limitation of Liability',
                    content: 'Neither party shall be liable for any indirect damages.',
                    rawText: '5.1 Limitation of Liability. Subject to Section 5.2, neither party shall be liable for any indirect damages.',
                    extractedFromText: true
                  },
                  {
                    id: 'clause-5.2',
                    sectionNumber: '5.2',
                    title: 'Exceptions',
                    content: 'Limitation does not apply to: (a) breaches of confidentiality; (b) gross negligence.',
                    rawText: '5.2 Exceptions. The limitation in Section 5.1 does not apply to: (a) breaches of confidentiality; (b) gross negligence.',
                    extractedFromText: true,
                    subItems: ['breaches of confidentiality', 'gross negligence']
                  }
                ]
              }
            ],
            customClauseTypes: [],
            referencedExhibits: [],
            clauseHierarchy: {
              '5': ['5.1', '5.2']
            },
            missingClauses: [],
            certainty: 0.92
          },
          explanation: 'Complex clause with subclauses and cross-references preserved. Hierarchy captured.'
        }
      ],
      
      outputSchema: {
        clauses: `array of {
          id: string,
          type: string (category),
          title: string (exact title from document),
          sectionNumber?: string (exact numbering like "5.1" or "A.2.iii"),
          content: string (summarized content),
          rawClauseText?: string (EXACT verbatim text for important clauses),
          source: string,
          riskLevel: 'low' | 'medium' | 'high',
          importance: 'low' | 'medium' | 'high',
          obligations: string[],
          beneficiary: 'client' | 'vendor' | 'both' | 'unknown',
          concerns: string[],
          extractedFromText: boolean,
          crossReferences?: array of { from: string, to: string, context: string },
          definedTermsUsed?: string[],
          subclauses?: array of { id, sectionNumber, title, content, rawText, extractedFromText, subItems? }
        }`,
        customClauseTypes: 'array of strings - any clause types unique to this contract not fitting standard categories',
        referencedExhibits: 'array of { name: string, referencedInClause: string, purpose?: string }',
        clauseHierarchy: 'object - mapping of parent clause numbers to child clause numbers',
        missingClauses: 'array of strings (common clause types NOT found in document)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Each clause must have unique id',
        'Risk level must be: low, medium, or high',
        'Importance must be: low, medium, or high',
        'Content must be non-empty and must be from the document',
        'Every clause MUST have a source reference',
        'Risk assessment must be based on clause language, not assumptions',
        'rawClauseText should be EXACT verbatim text from document',
        'Cross-references must cite specific section/clause numbers'
      ],

      antiHallucinationRules: [
        'DO NOT invent clauses that are "typically" in contracts',
        'DO NOT generate standard boilerplate if not in document',
        'Risk level must be justified by the actual clause text',
        'If a clause type is expected but missing, add to missingClauses array',
        'Content field must quote or closely paraphrase actual text',
        'DO NOT assume obligations - they must be explicitly stated',
        'rawClauseText must be EXACT copy from document - no paraphrasing',
        'Section numbers must match the document exactly',
        'DO NOT normalize clause numbering (keep 5.1, A.2, etc. as they appear)'
      ],

      requiredFields: ['clauses'],
      nullableFields: ['missingClauses', 'customClauseTypes', 'referencedExhibits', 'clauseHierarchy']
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
- Location-based or time-based variations must be explicitly stated

CONTEXTUAL AI EXTRACTION - PRESERVE EXACT RATE TABLE STRUCTURE:
Rate cards in contracts vary widely. You MUST:
1. PRESERVE exact column headers as they appear (e.g., "Resource Category", "Blended Rate", "Location Premium")
2. EXTRACT raw table data in "rawRateTables" for 1:1 fidelity with the original document
3. CAPTURE any rate-related notes, footnotes, or conditions
4. IDENTIFY tier structures, volume discounts, or escalation clauses
5. NOTE effective date ranges for different rate periods
6. EXTRACT any rate comparison tables or benchmark data included

Use "rawRateTables" to preserve EXACT table structure with dynamic headers.
Use "ratePeriods" for time-based rate variations (Year 1 rates, Year 2 rates, etc.).
Use "rateConditions" for conditional pricing (overtime, weekend, emergency rates).`,
      
      userPrompt: `Extract all rate card and pricing information from the contract. Only include rates explicitly stated.

IMPORTANT: This is CONTEXTUAL AI extraction:
- Preserve exact rate table column structure (don't normalize to Role/Rate/Location)
- Capture any rate conditions, tiers, or escalation schedules
- Extract raw table data for 1:1 document reproduction`,
      
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
                source: 'Offshore rates: 30% discount',
                extractedFromText: false,
                requiresHumanReview: true,
                calculationMethod: 'Applied 30% discount to US rate',
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
        },
        {
          input: 'RATE CARD - EXHIBIT B\n| Resource Category | Standard Rate | Premium Rate | Emergency |\n| Technical Lead | $200/hr | $250/hr | $350/hr |\n| Engineer L3 | $175/hr | $220/hr | $300/hr |\n\nNote: Premium rates apply to after-hours work. Emergency rates apply to critical incidents.',
          output: {
            rateCards: [
              {
                role: 'Technical Lead',
                level: null,
                rate: 200,
                unit: 'hour',
                currency: 'USD',
                location: null,
                source: 'RATE CARD - EXHIBIT B',
                extractedFromText: true,
                effectiveDate: null,
                notes: 'Standard rate'
              },
              {
                role: 'Engineer L3',
                level: 'L3',
                rate: 175,
                unit: 'hour',
                currency: 'USD',
                location: null,
                source: 'RATE CARD - EXHIBIT B',
                extractedFromText: true,
                effectiveDate: null,
                notes: 'Standard rate'
              }
            ],
            rawRateTables: [
              {
                tableName: 'Rate Card - Exhibit B',
                headers: ['Resource Category', 'Standard Rate', 'Premium Rate', 'Emergency'],
                rawRows: [
                  ['Technical Lead', '$200/hr', '$250/hr', '$350/hr'],
                  ['Engineer L3', '$175/hr', '$220/hr', '$300/hr']
                ],
                rows: [
                  { 'Resource Category': 'Technical Lead', 'Standard Rate': '$200/hr', 'Premium Rate': '$250/hr', 'Emergency': '$350/hr' },
                  { 'Resource Category': 'Engineer L3', 'Standard Rate': '$175/hr', 'Premium Rate': '$220/hr', 'Emergency': '$300/hr' }
                ],
                notes: 'Premium rates apply to after-hours work. Emergency rates apply to critical incidents.',
                source: 'RATE CARD - EXHIBIT B',
                extractedFromText: true
              }
            ],
            rateConditions: [
              { condition: 'Premium', trigger: 'After-hours work', multiplier: null, source: 'Premium rates apply to after-hours work', extractedFromText: true },
              { condition: 'Emergency', trigger: 'Critical incidents', multiplier: null, source: 'Emergency rates apply to critical incidents', extractedFromText: true }
            ],
            roles: ['Technical Lead', 'Engineer L3'],
            locations: [],
            rateModifiers: [],
            certainty: 0.92
          },
          explanation: 'Rate table preserved with exact column structure. Multiple rate types (Standard, Premium, Emergency) captured. Conditions noted.'
        }
      ],
      
      outputSchema: {
        rateCards: 'array of {role, level, rate, unit, currency, location, source, extractedFromText, effectiveDate, notes}',
        calculatedRates: 'array of rates that were derived/calculated (must have requiresHumanReview: true)',
        rawRateTables: `array of {
          tableName?: string,
          headers: string[] (EXACT column headers as they appear),
          rawRows: string[][] (each row as array of cell values for 1:1 fidelity),
          rows: array of objects with keys matching headers,
          notes?: string (footnotes or annotations),
          source: string,
          extractedFromText: boolean
        }`,
        rateConditions: 'array of { condition, trigger, multiplier?, additionalRate?, source, extractedFromText }',
        ratePeriods: 'array of { period, startDate?, endDate?, rates: array of rate objects }',
        roles: 'array of strings',
        locations: 'array of strings',
        rateModifiers: 'array of {type, condition, adjustment, unit, source}',
        rateEscalation: 'object - { schedule, percentage?, fixedIncrease?, source, extractedFromText }',
        volumeDiscounts: 'array of { tier, threshold, discount, unit, source }',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Rates must be positive numbers',
        'Unit must be: hour, day, week, month, or year',
        'Currency must be valid ISO code',
        'Each rate card must have role and rate',
        'Every rate MUST have a source reference',
        'Calculated rates must be in separate calculatedRates array with requiresHumanReview: true',
        'rawRateTables must preserve EXACT column structure',
        'Use EXACT header names from document in rawRateTables'
      ],

      antiHallucinationRules: [
        'DO NOT calculate rates not explicitly stated',
        'DO NOT assume role levels if not specified',
        'DO NOT infer location-based pricing without explicit text',
        'Separate explicitly stated rates from calculated/derived rates',
        'If rate unit is ambiguous, use lower certainty and add note',
        'DO NOT normalize or rename table columns - use exact headers',
        'rawRows must contain exact cell values as they appear',
        'DO NOT invent rate conditions or modifiers not in the document'
      ],

      requiredFields: ['rateCards'],
      nullableFields: ['calculatedRates', 'rawRateTables', 'rateConditions', 'ratePeriods', 'roles', 'locations', 'rateModifiers', 'rateEscalation', 'volumeDiscounts']
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
- If no compliance requirements are found, return empty arrays (not typical requirements)

CONTEXTUAL AI EXTRACTION - CAPTURE ALL COMPLIANCE CONTEXT:
Every contract has unique compliance language. You MUST:
1. EXTRACT verbatim compliance clauses in "rawComplianceSections"
2. CAPTURE any compliance schedules, appendices, or referenced policies
3. IDENTIFY industry-specific compliance requirements (PCI-DSS, FEDRAMP, etc.)
4. NOTE compliance deadlines, remediation periods, and escalation paths
5. EXTRACT any penalty clauses for non-compliance
6. CAPTURE certification renewal requirements and timelines
7. IDENTIFY any contractual audit procedures in detail

Use "rawComplianceSections" to preserve exact compliance language.
Use "customRequirements" for contract-specific compliance obligations.
Use "complianceTimelines" for deadline-driven requirements.`,
      
      userPrompt: `Extract all compliance and regulatory information explicitly mentioned in the contract.

IMPORTANT: This is CONTEXTUAL AI extraction:
- Preserve exact compliance clause wording
- Capture any unique compliance structures in this contract
- Note timelines, penalties, and remediation procedures`,
      
      examples: [
        {
          input: 'Vendor must maintain SOC 2 Type II certification. All data processing must comply with GDPR. Annual security audits required.',
          output: {
            regulations: [
              { name: 'GDPR', scope: 'All data processing', source: 'All data processing must comply with GDPR', extractedFromText: true }
            ],
            certifications: [
              { name: 'SOC 2 Type II', holder: 'Vendor', renewalPeriod: null, source: 'Vendor must maintain SOC 2 Type II certification', extractedFromText: true }
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
              { right: 'Annual security audits', auditType: 'security', noticePeriod: null, source: 'Annual security audits required', extractedFromText: true }
            ],
            dataProtection: [
              { requirement: 'GDPR compliance', dataTypes: null, retentionPeriod: null, source: 'All data processing must comply with GDPR', extractedFromText: true }
            ],
            notFoundCompliance: [],
            certainty: 0.91
          },
          explanation: 'All compliance requirements extracted with source references. No inferred requirements.'
        },
        {
          input: 'EXHIBIT C - SECURITY REQUIREMENTS\n\n1. Vendor shall comply with ISO 27001 and provide annual certification.\n2. All personnel with access to Client data must complete security training within 30 days of assignment.\n3. Breach notification within 72 hours.\n4. Data retention: maximum 7 years or as required by law.\n5. Quarterly vulnerability assessments required.',
          output: {
            regulations: [],
            certifications: [
              { name: 'ISO 27001', holder: 'Vendor', renewalPeriod: 'annual', source: 'Vendor shall comply with ISO 27001 and provide annual certification', extractedFromText: true }
            ],
            complianceRequirements: [
              {
                requirement: 'ISO 27001 compliance with annual certification',
                category: 'Security',
                mandatory: true,
                frequency: 'annual',
                responsibility: 'vendor',
                source: 'Exhibit C, Section 1',
                extractedFromText: true
              },
              {
                requirement: 'Security training for personnel with data access',
                category: 'Training',
                mandatory: true,
                frequency: 'ongoing',
                responsibility: 'vendor',
                deadline: '30 days of assignment',
                source: 'Exhibit C, Section 2',
                extractedFromText: true
              },
              {
                requirement: 'Quarterly vulnerability assessments',
                category: 'Security',
                mandatory: true,
                frequency: 'quarterly',
                responsibility: 'vendor',
                source: 'Exhibit C, Section 5',
                extractedFromText: true
              }
            ],
            complianceTimelines: [
              { requirement: 'Security training completion', deadline: '30 days of assignment', source: 'within 30 days of assignment', extractedFromText: true },
              { requirement: 'Breach notification', deadline: '72 hours', source: 'Breach notification within 72 hours', extractedFromText: true }
            ],
            rawComplianceSections: {
              'Exhibit C - Security Requirements': 'EXHIBIT C - SECURITY REQUIREMENTS\n\n1. Vendor shall comply with ISO 27001 and provide annual certification.\n2. All personnel with access to Client data must complete security training within 30 days of assignment.\n3. Breach notification within 72 hours.\n4. Data retention: maximum 7 years or as required by law.\n5. Quarterly vulnerability assessments required.'
            },
            customRequirements: [
              { requirement: 'Personnel security training within 30 days', category: 'Personnel', source: 'Section 2', extractedFromText: true }
            ],
            breachNotification: {
              timeframe: '72 hours',
              source: 'Breach notification within 72 hours',
              extractedFromText: true
            },
            dataRetention: {
              period: '7 years maximum',
              conditions: 'or as required by law',
              source: 'Data retention: maximum 7 years or as required by law',
              extractedFromText: true
            },
            auditRights: [],
            dataProtection: [
              { requirement: 'Data retention limit', dataTypes: null, retentionPeriod: '7 years maximum', source: 'Section 4', extractedFromText: true }
            ],
            notFoundCompliance: [],
            certainty: 0.93
          },
          explanation: 'Detailed compliance extraction from security exhibit including timelines, breach notification, and data retention.'
        }
      ],
      
      outputSchema: {
        regulations: 'array of { name: string, scope?: string, source: string, extractedFromText: boolean }',
        certifications: 'array of { name: string, holder?: string, renewalPeriod?: string, source: string, extractedFromText: boolean }',
        complianceRequirements: 'array of {requirement, category, mandatory, frequency, responsibility, deadline?, source, extractedFromText}',
        complianceTimelines: 'array of { requirement: string, deadline: string, source: string, extractedFromText: boolean }',
        rawComplianceSections: 'object - key/value pairs preserving exact text of compliance sections/exhibits',
        customRequirements: 'array of contract-specific requirements not fitting standard categories',
        breachNotification: 'object - { timeframe, notificationRecipients?, source, extractedFromText }',
        dataRetention: 'object - { period, conditions?, dataTypes?, source, extractedFromText }',
        auditRights: 'array of { right: string, auditType?: string, noticePeriod?: string, source: string, extractedFromText: boolean }',
        dataProtection: 'array of { requirement: string, dataTypes?: string, retentionPeriod?: string, source: string, extractedFromText: boolean }',
        nonCompliancePenalties: 'array of { violation: string, penalty: string, source: string, extractedFromText: boolean }',
        notFoundCompliance: 'array of strings (common compliance items NOT found in document)',
        certainty: 'number (0-1)'
      },
      
      validationRules: [
        'Regulations must be recognized standards',
        'Certifications must be industry-standard',
        'Requirements must specify responsibility',
        'Frequency must be: ongoing, annual, quarterly, monthly, or one-time',
        'Every compliance item MUST have a source reference',
        'DO NOT infer compliance requirements - only extract explicit mentions',
        'rawComplianceSections must be EXACT verbatim text',
        'Timelines must be specific (dates or durations from document)'
      ],

      antiHallucinationRules: [
        'DO NOT assume GDPR/HIPAA/SOC2 requirements based on industry',
        'DO NOT add "typical" compliance requirements not in document',
        'If no compliance requirements found, return empty arrays',
        'Only include regulations EXPLICITLY mentioned by name',
        'Add missing common requirements to notFoundCompliance for awareness',
        'Responsibility must be explicitly stated, not inferred from context',
        'rawComplianceSections must be exact copies - no paraphrasing',
        'DO NOT invent deadlines or timelines not in the document'
      ],

      requiredFields: [],
      nullableFields: ['regulations', 'certifications', 'complianceRequirements', 'complianceTimelines', 'rawComplianceSections', 'customRequirements', 'breachNotification', 'dataRetention', 'auditRights', 'dataProtection', 'nonCompliancePenalties', 'notFoundCompliance']
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

CONTEXTUAL AI RISK ANALYSIS - COMPREHENSIVE UNDERSTANDING:
Every contract has unique risk profiles. You MUST:
1. PRESERVE exact problematic clause language in "rawRiskClauses"
2. IDENTIFY contract-specific risk categories beyond standard (Legal, Financial, Operational)
3. ANALYZE relationships between clauses that compound risk
4. ASSESS risk by party - who bears what risk
5. EXTRACT any indemnification, warranty, or liability clauses verbatim
6. NOTE favorable terms as risk mitigators
7. CAPTURE industry-specific risks mentioned in the contract

Use "rawRiskClauses" to preserve exact language of risky clauses.
Use "compoundRisks" for risks created by multiple clause interactions.
Use "riskByParty" to show risk distribution between parties.
Use "favorableTerms" to note risk-reducing provisions.
${financialContext}${clausesContext}`,
      
      userPrompt: `Analyze risks in the contract based ONLY on actual contract language. Every risk must reference its source in the document.

IMPORTANT: This is CONTEXTUAL AI risk analysis:
- Preserve exact language of risky clauses
- Identify risks unique to this contract
- Note favorable terms that reduce risk
- Analyze how clauses interact to create compound risks`,
      
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
                clauseReference: null,
                extractedFromText: true,
                impact: 'Could result in catastrophic financial loss',
                likelihood: 'medium',
                mitigation: 'Negotiate liability cap',
                affectedParty: 'vendor'
              },
              {
                category: 'Operational',
                severity: 'high',
                description: 'Termination without cause with only 7 days notice',
                source: 'Termination without cause with 7 days notice',
                clauseReference: null,
                extractedFromText: true,
                impact: 'Insufficient time to transition or find alternatives',
                likelihood: 'low',
                mitigation: 'Request 30-60 days notice period',
                affectedParty: 'vendor'
              },
              {
                category: 'Financial',
                severity: 'high',
                description: 'No cap on penalties',
                source: 'No cap on penalties',
                clauseReference: null,
                extractedFromText: true,
                impact: 'Unlimited financial exposure',
                likelihood: 'medium',
                mitigation: 'Negotiate penalty caps',
                affectedParty: 'vendor'
              }
            ],
            rawRiskClauses: {
              liability: 'Unlimited liability for data breaches',
              termination: 'Termination without cause with 7 days notice',
              penalties: 'No cap on penalties'
            },
            riskByParty: {
              client: { riskScore: 15, riskFactors: [] },
              vendor: { riskScore: 85, riskFactors: ['unlimited liability', 'short termination notice', 'uncapped penalties'] }
            },
            compoundRisks: [
              {
                description: 'Unlimited liability combined with short termination notice creates catastrophic risk',
                clausesInvolved: ['Unlimited liability for data breaches', 'Termination without cause with 7 days notice'],
                combinedImpact: 'Vendor could be terminated with 7 days notice while still being liable for unlimited damages',
                source: 'Multiple clauses',
                extractedFromText: true
              }
            ],
            favorableTerms: [],
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
              { flag: 'Unlimited liability exposure', source: 'Unlimited liability for data breaches', severity: 'critical', extractedFromText: true },
              { flag: 'Extremely short termination notice', source: 'Termination without cause with 7 days notice', severity: 'high', extractedFromText: true },
              { flag: 'Uncapped penalties', source: 'No cap on penalties', severity: 'high', extractedFromText: true }
            ],
            missingProtections: [],
            certainty: 0.89
          },
          explanation: 'All risks based on actual contract language with source references. Compound risk identified between liability and termination clauses.'
        },
        {
          input: 'Section 8.1: Vendor liability capped at contract value ($500,000). Section 8.2: Client indemnifies Vendor for third-party IP claims. Section 9: Force majeure includes pandemic. Section 10.3: 90-day termination notice required.',
          output: {
            overallScore: 25,
            riskLevel: 'low',
            riskFactors: [],
            rawRiskClauses: {},
            riskByParty: {
              client: { riskScore: 35, riskFactors: ['indemnifies vendor for third-party IP claims'] },
              vendor: { riskScore: 15, riskFactors: [] }
            },
            compoundRisks: [],
            favorableTerms: [
              { term: 'Liability cap at contract value', benefit: 'Maximum exposure limited to $500,000', source: 'Section 8.1', extractedFromText: true },
              { term: 'Force majeure includes pandemic', benefit: 'Protection against force majeure events', source: 'Section 9', extractedFromText: true },
              { term: '90-day termination notice', benefit: 'Adequate time to transition', source: 'Section 10.3', extractedFromText: true },
              { term: 'Client indemnifies for IP claims', benefit: 'Vendor protected from third-party IP claims', source: 'Section 8.2', extractedFromText: true }
            ],
            customRiskCategories: [],
            recommendations: [
              'This contract has favorable terms for the vendor',
              'Review IP indemnification scope for client comfort',
              'Verify force majeure trigger conditions'
            ],
            costSavingsOpportunities: [
              'Low risk profile may reduce insurance costs',
              'Liability cap provides predictable exposure'
            ],
            redFlags: [],
            missingProtections: [],
            certainty: 0.92
          },
          explanation: 'Low risk contract with multiple favorable terms. Client bears some risk with IP indemnification.'
        }
      ],
      
      outputSchema: {
        overallScore: 'number (0-100, higher = more risk)',
        riskLevel: 'string (low, medium, high, critical)',
        riskFactors: 'array of {category, severity, description, source, clauseReference?, extractedFromText, impact, likelihood, mitigation, affectedParty?}',
        rawRiskClauses: 'object - key/value pairs preserving exact text of risky clauses',
        riskByParty: 'object - { partyName: { riskScore: number, riskFactors: string[] } } for each party',
        compoundRisks: 'array of { description, clausesInvolved: string[], combinedImpact, source, extractedFromText }',
        favorableTerms: 'array of { term, benefit, source, extractedFromText } - risk-reducing provisions',
        customRiskCategories: 'array of contract-specific risk categories beyond standard (Legal, Financial, Operational)',
        recommendations: 'array of strings',
        redFlags: 'array of { flag: string, source: string, severity: string, extractedFromText: boolean }',
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
        'DO NOT invent risks - only assess risks from actual contract terms',
        'rawRiskClauses must be EXACT verbatim text from document',
        'Compound risks must cite specific interacting clauses'
      ],

      antiHallucinationRules: [
        'DO NOT invent risks that are not in the contract',
        'Every risk factor MUST cite specific contract language',
        'If contract has favorable terms, reflect in LOWER risk score',
        'Missing protections go in missingProtections array, not as invented risks',
        'Impact and likelihood assessments must be reasonable given the actual terms',
        'DO NOT assume worst-case scenarios not supported by contract language',
        'rawRiskClauses must be exact copies - no paraphrasing',
        'Favorable terms should reduce overall risk score - do not ignore them'
      ],

      requiredFields: ['overallScore', 'riskLevel'],
      nullableFields: ['riskFactors', 'rawRiskClauses', 'riskByParty', 'compoundRisks', 'favorableTerms', 'customRiskCategories', 'recommendations', 'redFlags', 'costSavingsOpportunities', 'missingProtections']
    };
  }
}

export const artifactPromptTemplatesService = ArtifactPromptTemplatesService.getInstance();

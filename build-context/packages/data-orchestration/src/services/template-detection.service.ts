/**
 * Template Detection Service
 * 
 * Identifies known contract templates to optimize extraction accuracy.
 * Detects template families, versions, and customizations.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('TemplateDetectionService');

// Template signature types
export interface TemplateSignature {
  id: string;
  name: string;
  family: TemplateFamily;
  version?: string;
  publisher?: string;
  industry?: string;
  
  // Detection patterns
  headerPatterns: RegExp[];
  footerPatterns: RegExp[];
  sectionPatterns: SectionPattern[];
  uniquePhrases: string[];
  clauseOrder: string[];
  
  // Extraction optimization
  fieldMappings: TemplateFieldMapping[];
  defaultValues: Record<string, unknown>;
  requiredClauses: string[];
  optionalClauses: string[];
  
  // Template metadata
  lastUpdated: Date;
  confidence: number;
}

export interface SectionPattern {
  name: string;
  pattern: RegExp;
  order: number;
  required: boolean;
}

export interface TemplateFieldMapping {
  field: string;
  location: FieldLocation;
  pattern?: RegExp;
  transform?: (value: string) => string;
}

export interface FieldLocation {
  section?: string;
  clauseType?: string;
  nearPhrase?: string;
  position?: 'first' | 'last' | 'any';
}

export type TemplateFamily = 
  | 'master_service_agreement'
  | 'software_license'
  | 'saas_subscription'
  | 'nda_mutual'
  | 'nda_unilateral'
  | 'employment_agreement'
  | 'consulting_agreement'
  | 'purchase_order'
  | 'vendor_agreement'
  | 'lease_agreement'
  | 'partnership_agreement'
  | 'distribution_agreement'
  | 'franchise_agreement'
  | 'merger_acquisition'
  | 'investment_agreement'
  | 'loan_agreement'
  | 'settlement_agreement'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'data_processing'
  | 'custom_unknown';

export interface TemplateMatch {
  signature: TemplateSignature;
  confidence: number;
  matchedPatterns: string[];
  deviations: TemplateDeviation[];
  customizations: TemplateCustomization[];
}

export interface TemplateDeviation {
  type: 'missing_section' | 'extra_section' | 'modified_clause' | 'reordered' | 'language_change';
  description: string;
  impact: 'low' | 'medium' | 'high';
  location?: string;
}

export interface TemplateCustomization {
  field: string;
  originalDefault?: unknown;
  customValue: unknown;
  section?: string;
}

export interface TemplateDetectionResult {
  detected: boolean;
  match?: TemplateMatch;
  alternativeMatches: TemplateMatch[];
  isStandardTemplate: boolean;
  isModified: boolean;
  extractionHints: ExtractionHint[];
}

export interface ExtractionHint {
  field: string;
  hint: string;
  confidence: number;
  suggestedLocation?: string;
  defaultValue?: unknown;
}

// Built-in template signatures
const TEMPLATE_SIGNATURES: TemplateSignature[] = [
  // Master Service Agreement Templates
  {
    id: 'msa-standard-v1',
    name: 'Standard Master Service Agreement',
    family: 'master_service_agreement',
    version: '1.0',
    headerPatterns: [
      /master\s+service\s+agreement/i,
      /msa\s+agreement/i,
      /master\s+services?\s+contract/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'definitions', pattern: /^(?:article|section)?\s*1\.?\s*definitions/i, order: 1, required: true },
      { name: 'services', pattern: /^(?:article|section)?\s*2\.?\s*(?:scope\s+of\s+)?services/i, order: 2, required: true },
      { name: 'payment', pattern: /^(?:article|section)?\s*3\.?\s*(?:fees?\s+and\s+)?payment/i, order: 3, required: true },
      { name: 'term', pattern: /^(?:article|section)?\s*4\.?\s*term\s+(?:and\s+termination)?/i, order: 4, required: true },
      { name: 'confidentiality', pattern: /^(?:article|section)?\s*5\.?\s*confidentiality/i, order: 5, required: true },
      { name: 'ip', pattern: /^(?:article|section)?\s*6\.?\s*intellectual\s+property/i, order: 6, required: true },
      { name: 'warranties', pattern: /^(?:article|section)?\s*7\.?\s*(?:representations?\s+(?:and|&)\s+)?warranties/i, order: 7, required: true },
      { name: 'liability', pattern: /^(?:article|section)?\s*8\.?\s*(?:limitation\s+of\s+)?liability/i, order: 8, required: true },
      { name: 'indemnification', pattern: /^(?:article|section)?\s*9\.?\s*indemnification/i, order: 9, required: true },
      { name: 'general', pattern: /^(?:article|section)?\s*10\.?\s*(?:general\s+provisions?|miscellaneous)/i, order: 10, required: true },
    ],
    uniquePhrases: [
      'statement of work',
      'sow',
      'work order',
      'service levels',
      'acceptance criteria',
    ],
    clauseOrder: ['definitions', 'services', 'payment', 'term', 'confidentiality', 'ip', 'warranties', 'liability', 'indemnification', 'general'],
    fieldMappings: [
      { field: 'serviceProvider', location: { section: 'parties', nearPhrase: 'provider|supplier|vendor' } },
      { field: 'client', location: { section: 'parties', nearPhrase: 'client|customer|company' } },
      { field: 'effectiveDate', location: { section: 'header', nearPhrase: 'effective|dated' } },
      { field: 'paymentTerms', location: { section: 'payment', nearPhrase: 'net|days|due' } },
      { field: 'termDuration', location: { section: 'term', nearPhrase: 'initial term|period' } },
    ],
    defaultValues: {
      paymentTerms: 'Net 30',
      termDuration: '12 months',
      autoRenewal: true,
    },
    requiredClauses: ['definitions', 'services', 'payment', 'term', 'confidentiality'],
    optionalClauses: ['insurance', 'audit', 'compliance'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.85,
  },
  
  // SaaS Subscription Agreement
  {
    id: 'saas-subscription-v1',
    name: 'SaaS Subscription Agreement',
    family: 'saas_subscription',
    version: '1.0',
    headerPatterns: [
      /saas\s+(?:subscription\s+)?agreement/i,
      /software\s+as\s+a\s+service\s+agreement/i,
      /cloud\s+services?\s+agreement/i,
      /subscription\s+services?\s+agreement/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'definitions', pattern: /^(?:article|section)?\s*1\.?\s*definitions/i, order: 1, required: true },
      { name: 'subscription', pattern: /^(?:article|section)?\s*2\.?\s*(?:subscription\s+)?services?/i, order: 2, required: true },
      { name: 'user_rights', pattern: /^(?:article|section)?\s*3\.?\s*(?:user\s+rights|license\s+grant)/i, order: 3, required: true },
      { name: 'fees', pattern: /^(?:article|section)?\s*4\.?\s*(?:subscription\s+)?fees/i, order: 4, required: true },
      { name: 'data', pattern: /^(?:article|section)?\s*5\.?\s*(?:customer\s+)?data/i, order: 5, required: true },
      { name: 'sla', pattern: /^(?:article|section)?\s*6\.?\s*(?:service\s+level|sla|uptime)/i, order: 6, required: true },
      { name: 'security', pattern: /^(?:article|section)?\s*7\.?\s*security/i, order: 7, required: true },
      { name: 'term', pattern: /^(?:article|section)?\s*8\.?\s*term/i, order: 8, required: true },
    ],
    uniquePhrases: [
      'subscription period',
      'user seats',
      'service credits',
      'uptime guarantee',
      'data processing',
      'api access',
    ],
    clauseOrder: ['definitions', 'subscription', 'user_rights', 'fees', 'data', 'sla', 'security', 'term'],
    fieldMappings: [
      { field: 'subscriptionTier', location: { section: 'subscription', nearPhrase: 'tier|plan|level' } },
      { field: 'userSeats', location: { section: 'subscription', nearPhrase: 'seats|users|licenses' } },
      { field: 'uptime', location: { section: 'sla', nearPhrase: 'uptime|availability' } },
      { field: 'serviceCredits', location: { section: 'sla', nearPhrase: 'credits|remedy' } },
    ],
    defaultValues: {
      uptime: '99.9%',
      billingCycle: 'monthly',
      autoRenewal: true,
    },
    requiredClauses: ['subscription', 'fees', 'data', 'sla'],
    optionalClauses: ['api', 'integrations', 'support'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.85,
  },
  
  // NDA Mutual
  {
    id: 'nda-mutual-v1',
    name: 'Mutual Non-Disclosure Agreement',
    family: 'nda_mutual',
    version: '1.0',
    headerPatterns: [
      /mutual\s+(?:non-?disclosure|confidentiality)\s+agreement/i,
      /bi-?lateral\s+nda/i,
      /two-?way\s+nda/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'purpose', pattern: /^(?:article|section)?\s*1\.?\s*purpose/i, order: 1, required: true },
      { name: 'confidential_info', pattern: /^(?:article|section)?\s*2\.?\s*(?:definition\s+of\s+)?confidential\s+information/i, order: 2, required: true },
      { name: 'obligations', pattern: /^(?:article|section)?\s*3\.?\s*obligations/i, order: 3, required: true },
      { name: 'exclusions', pattern: /^(?:article|section)?\s*4\.?\s*exclusions/i, order: 4, required: true },
      { name: 'term', pattern: /^(?:article|section)?\s*5\.?\s*term/i, order: 5, required: true },
      { name: 'return', pattern: /^(?:article|section)?\s*6\.?\s*return\s+(?:of\s+)?(?:materials|information)/i, order: 6, required: false },
    ],
    uniquePhrases: [
      'disclosing party',
      'receiving party',
      'confidential information',
      'need to know',
      'reasonably necessary',
    ],
    clauseOrder: ['purpose', 'confidential_info', 'obligations', 'exclusions', 'term', 'return'],
    fieldMappings: [
      { field: 'disclosingParty', location: { section: 'parties', nearPhrase: 'disclosing' } },
      { field: 'receivingParty', location: { section: 'parties', nearPhrase: 'receiving' } },
      { field: 'confidentialityPeriod', location: { section: 'term', nearPhrase: 'years|months|period' } },
      { field: 'purpose', location: { section: 'purpose', nearPhrase: 'purpose|evaluate|discuss' } },
    ],
    defaultValues: {
      confidentialityPeriod: '3 years',
      mutual: true,
    },
    requiredClauses: ['confidential_info', 'obligations', 'term'],
    optionalClauses: ['return', 'injunctive_relief'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.9,
  },
  
  // Software License Agreement
  {
    id: 'software-license-v1',
    name: 'Software License Agreement',
    family: 'software_license',
    version: '1.0',
    headerPatterns: [
      /(?:end\s+user\s+)?(?:software\s+)?license\s+agreement/i,
      /eula/i,
      /software\s+licensing\s+agreement/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'license_grant', pattern: /^(?:article|section)?\s*1\.?\s*(?:grant\s+of\s+)?license/i, order: 1, required: true },
      { name: 'restrictions', pattern: /^(?:article|section)?\s*2\.?\s*(?:license\s+)?restrictions/i, order: 2, required: true },
      { name: 'ip', pattern: /^(?:article|section)?\s*3\.?\s*(?:intellectual\s+property|ownership)/i, order: 3, required: true },
      { name: 'fees', pattern: /^(?:article|section)?\s*4\.?\s*(?:license\s+)?fees/i, order: 4, required: true },
      { name: 'support', pattern: /^(?:article|section)?\s*5\.?\s*(?:maintenance\s+and\s+)?support/i, order: 5, required: false },
      { name: 'warranties', pattern: /^(?:article|section)?\s*6\.?\s*warranties/i, order: 6, required: true },
      { name: 'termination', pattern: /^(?:article|section)?\s*7\.?\s*termination/i, order: 7, required: true },
    ],
    uniquePhrases: [
      'license grant',
      'perpetual license',
      'seat license',
      'source code',
      'object code',
      'derivative works',
    ],
    clauseOrder: ['license_grant', 'restrictions', 'ip', 'fees', 'support', 'warranties', 'termination'],
    fieldMappings: [
      { field: 'licenseType', location: { section: 'license_grant', nearPhrase: 'perpetual|subscription|term' } },
      { field: 'licensedUsers', location: { section: 'license_grant', nearPhrase: 'users|seats|installations' } },
      { field: 'softwareProduct', location: { section: 'license_grant', nearPhrase: 'software|product|application' } },
    ],
    defaultValues: {
      licenseType: 'perpetual',
      includesSource: false,
    },
    requiredClauses: ['license_grant', 'restrictions', 'ip'],
    optionalClauses: ['support', 'escrow', 'audit'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.85,
  },
  
  // Employment Agreement
  {
    id: 'employment-v1',
    name: 'Employment Agreement',
    family: 'employment_agreement',
    version: '1.0',
    headerPatterns: [
      /employment\s+agreement/i,
      /employment\s+contract/i,
      /offer\s+(?:letter|of\s+employment)/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'position', pattern: /^(?:article|section)?\s*1\.?\s*(?:position|employment)/i, order: 1, required: true },
      { name: 'duties', pattern: /^(?:article|section)?\s*2\.?\s*(?:duties|responsibilities)/i, order: 2, required: true },
      { name: 'compensation', pattern: /^(?:article|section)?\s*3\.?\s*(?:compensation|salary)/i, order: 3, required: true },
      { name: 'benefits', pattern: /^(?:article|section)?\s*4\.?\s*benefits/i, order: 4, required: false },
      { name: 'term', pattern: /^(?:article|section)?\s*5\.?\s*term/i, order: 5, required: true },
      { name: 'termination', pattern: /^(?:article|section)?\s*6\.?\s*termination/i, order: 6, required: true },
      { name: 'confidentiality', pattern: /^(?:article|section)?\s*7\.?\s*confidentiality/i, order: 7, required: true },
      { name: 'ip', pattern: /^(?:article|section)?\s*8\.?\s*(?:intellectual\s+property|inventions)/i, order: 8, required: true },
    ],
    uniquePhrases: [
      'at-will employment',
      'base salary',
      'annual bonus',
      'equity grant',
      'work for hire',
      'invention assignment',
    ],
    clauseOrder: ['position', 'duties', 'compensation', 'benefits', 'term', 'termination', 'confidentiality', 'ip'],
    fieldMappings: [
      { field: 'employeeName', location: { section: 'parties', nearPhrase: 'employee' } },
      { field: 'position', location: { section: 'position', nearPhrase: 'title|position|role' } },
      { field: 'salary', location: { section: 'compensation', nearPhrase: 'salary|annual|per year' } },
      { field: 'startDate', location: { section: 'position', nearPhrase: 'start|commence|begin' } },
    ],
    defaultValues: {
      employmentType: 'at-will',
      fullTime: true,
    },
    requiredClauses: ['position', 'compensation', 'confidentiality', 'ip'],
    optionalClauses: ['non_compete', 'non_solicitation', 'equity'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.85,
  },
  
  // Data Processing Agreement
  {
    id: 'dpa-gdpr-v1',
    name: 'Data Processing Agreement (GDPR)',
    family: 'data_processing',
    version: '1.0',
    industry: 'technology',
    headerPatterns: [
      /data\s+processing\s+a(?:greement|ddendum)/i,
      /dpa/i,
      /gdpr\s+(?:data\s+processing\s+)?addendum/i,
    ],
    footerPatterns: [],
    sectionPatterns: [
      { name: 'definitions', pattern: /^(?:article|section)?\s*1\.?\s*definitions/i, order: 1, required: true },
      { name: 'scope', pattern: /^(?:article|section)?\s*2\.?\s*(?:scope|subject\s+matter)/i, order: 2, required: true },
      { name: 'obligations', pattern: /^(?:article|section)?\s*3\.?\s*(?:processor\s+)?obligations/i, order: 3, required: true },
      { name: 'security', pattern: /^(?:article|section)?\s*4\.?\s*(?:data\s+)?security/i, order: 4, required: true },
      { name: 'subprocessors', pattern: /^(?:article|section)?\s*5\.?\s*sub-?processors/i, order: 5, required: true },
      { name: 'transfers', pattern: /^(?:article|section)?\s*6\.?\s*(?:international\s+)?transfers/i, order: 6, required: true },
      { name: 'data_subjects', pattern: /^(?:article|section)?\s*7\.?\s*data\s+subject\s+rights/i, order: 7, required: true },
      { name: 'breach', pattern: /^(?:article|section)?\s*8\.?\s*(?:data\s+)?breach/i, order: 8, required: true },
    ],
    uniquePhrases: [
      'data controller',
      'data processor',
      'personal data',
      'data subjects',
      'sub-processor',
      'standard contractual clauses',
      'article 28',
    ],
    clauseOrder: ['definitions', 'scope', 'obligations', 'security', 'subprocessors', 'transfers', 'data_subjects', 'breach'],
    fieldMappings: [
      { field: 'dataController', location: { section: 'parties', nearPhrase: 'controller' } },
      { field: 'dataProcessor', location: { section: 'parties', nearPhrase: 'processor' } },
      { field: 'dataCategories', location: { section: 'scope', nearPhrase: 'categories|types' } },
      { field: 'processingPurpose', location: { section: 'scope', nearPhrase: 'purpose' } },
    ],
    defaultValues: {
      gdprCompliant: true,
      breachNotification: '72 hours',
    },
    requiredClauses: ['definitions', 'scope', 'security', 'subprocessors', 'breach'],
    optionalClauses: ['audit', 'deletion', 'assistance'],
    lastUpdated: new Date('2024-01-01'),
    confidence: 0.9,
  },
];

export class TemplateDetectionService {
  private signatures: Map<string, TemplateSignature>;
  private familySignatures: Map<TemplateFamily, TemplateSignature[]>;
  private learnedSignatures: TemplateSignature[] = [];
  
  constructor() {
    this.signatures = new Map();
    this.familySignatures = new Map();
    
    // Initialize with built-in signatures
    for (const sig of TEMPLATE_SIGNATURES) {
      this.signatures.set(sig.id, sig);
      
      const familyList = this.familySignatures.get(sig.family) || [];
      familyList.push(sig);
      this.familySignatures.set(sig.family, familyList);
    }
    
    logger.info('Template detection service initialized', { signatureCount: this.signatures.size });
  }
  
  /**
   * Detect template from document text
   */
  detectTemplate(documentText: string): TemplateDetectionResult {
    logger.debug('Detecting template from document');
    
    const matches: TemplateMatch[] = [];
    
    // Score each signature
    for (const signature of this.signatures.values()) {
      const match = this.matchSignature(documentText, signature);
      if (match.confidence > 0.3) {
        matches.push(match);
      }
    }
    
    // Also check learned signatures
    for (const signature of this.learnedSignatures) {
      const match = this.matchSignature(documentText, signature);
      if (match.confidence > 0.3) {
        matches.push(match);
      }
    }
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    const bestMatch = matches[0];
    const detected = bestMatch && bestMatch.confidence >= 0.6;
    
    // Generate extraction hints
    const extractionHints = this.generateExtractionHints(documentText, bestMatch);
    
    return {
      detected,
      match: detected ? bestMatch : undefined,
      alternativeMatches: matches.slice(1, 4), // Top 3 alternatives
      isStandardTemplate: detected && bestMatch.deviations.length === 0,
      isModified: detected && bestMatch.deviations.length > 0,
      extractionHints,
    };
  }
  
  /**
   * Match document against a signature
   */
  private matchSignature(documentText: string, signature: TemplateSignature): TemplateMatch {
    let score = 0;
    let maxScore = 0;
    const matchedPatterns: string[] = [];
    const deviations: TemplateDeviation[] = [];
    const customizations: TemplateCustomization[] = [];
    
    // Check header patterns (high weight)
    maxScore += 30;
    for (const pattern of signature.headerPatterns) {
      if (pattern.test(documentText)) {
        score += 30 / signature.headerPatterns.length;
        matchedPatterns.push(`header:${pattern.source}`);
        break; // Only need one header match
      }
    }
    
    // Check section patterns
    const foundSections = new Set<string>();
    const sectionOrder: string[] = [];
    
    for (const sectionPattern of signature.sectionPatterns) {
      maxScore += sectionPattern.required ? 10 : 5;
      
      const match = sectionPattern.pattern.exec(documentText);
      if (match) {
        foundSections.add(sectionPattern.name);
        sectionOrder.push(sectionPattern.name);
        score += sectionPattern.required ? 10 : 5;
        matchedPatterns.push(`section:${sectionPattern.name}`);
      } else if (sectionPattern.required) {
        deviations.push({
          type: 'missing_section',
          description: `Required section "${sectionPattern.name}" not found`,
          impact: 'medium',
        });
      }
    }
    
    // Check section order
    if (sectionOrder.length > 1) {
      const expectedOrder = signature.clauseOrder.filter(s => foundSections.has(s));
      const isCorrectOrder = this.isCorrectOrder(sectionOrder, expectedOrder);
      
      maxScore += 10;
      if (isCorrectOrder) {
        score += 10;
        matchedPatterns.push('order:correct');
      } else {
        deviations.push({
          type: 'reordered',
          description: 'Sections appear in non-standard order',
          impact: 'low',
        });
      }
    }
    
    // Check unique phrases
    const lowerText = documentText.toLowerCase();
    let phraseMatches = 0;
    
    for (const phrase of signature.uniquePhrases) {
      maxScore += 5;
      if (lowerText.includes(phrase.toLowerCase())) {
        phraseMatches++;
        score += 5;
        matchedPatterns.push(`phrase:${phrase}`);
      }
    }
    
    // Check for extra sections not in template
    const extraSectionPatterns = this.findExtraSections(documentText, signature);
    for (const extra of extraSectionPatterns) {
      deviations.push({
        type: 'extra_section',
        description: `Additional section found: ${extra}`,
        impact: 'low',
        location: extra,
      });
    }
    
    // Detect customizations
    for (const mapping of signature.fieldMappings) {
      const defaultValue = signature.defaultValues[mapping.field];
      if (defaultValue !== undefined) {
        const extractedValue = this.extractFieldValue(documentText, mapping);
        if (extractedValue && extractedValue !== defaultValue) {
          customizations.push({
            field: mapping.field,
            originalDefault: defaultValue,
            customValue: extractedValue,
            section: mapping.location.section,
          });
        }
      }
    }
    
    // Calculate final confidence
    const confidence = maxScore > 0 ? score / maxScore : 0;
    
    return {
      signature,
      confidence,
      matchedPatterns,
      deviations,
      customizations,
    };
  }
  
  /**
   * Check if sections appear in correct order
   */
  private isCorrectOrder(found: string[], expected: string[]): boolean {
    let expectedIndex = 0;
    for (const section of found) {
      const idx = expected.indexOf(section, expectedIndex);
      if (idx < expectedIndex) {
        return false;
      }
      expectedIndex = idx;
    }
    return true;
  }
  
  /**
   * Find sections that aren't in the template
   */
  private findExtraSections(documentText: string, signature: TemplateSignature): string[] {
    const extras: string[] = [];
    
    // Generic section patterns
    const genericPatterns = [
      /^(?:article|section)\s+\d+[.:]\s*([^\n]+)/gim,
    ];
    
    const templateSectionNames = new Set(
      signature.sectionPatterns.map(p => p.name.toLowerCase())
    );
    
    for (const pattern of genericPatterns) {
      let match;
      while ((match = pattern.exec(documentText)) !== null) {
        const sectionName = match[1].toLowerCase().trim();
        
        // Check if this section is in the template
        let isTemplateSection = false;
        for (const name of templateSectionNames) {
          if (sectionName.includes(name) || name.includes(sectionName)) {
            isTemplateSection = true;
            break;
          }
        }
        
        if (!isTemplateSection) {
          extras.push(match[1].trim());
        }
      }
    }
    
    return extras;
  }
  
  /**
   * Extract field value based on mapping
   */
  private extractFieldValue(documentText: string, mapping: TemplateFieldMapping): string | null {
    if (mapping.pattern) {
      const match = mapping.pattern.exec(documentText);
      if (match) {
        const value = match[1] || match[0];
        return mapping.transform ? mapping.transform(value) : value;
      }
    }
    
    // Try to find near the specified phrase
    if (mapping.location.nearPhrase) {
      const nearPattern = new RegExp(
        `${mapping.location.nearPhrase}[:\\s]+([^\\n.;]+)`,
        'i'
      );
      const match = nearPattern.exec(documentText);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }
  
  /**
   * Generate extraction hints based on template
   */
  private generateExtractionHints(documentText: string, match?: TemplateMatch): ExtractionHint[] {
    const hints: ExtractionHint[] = [];
    
    if (!match) {
      // Generic hints for unknown template
      hints.push({
        field: 'contractType',
        hint: 'Could not detect known template. Manual verification recommended.',
        confidence: 0.5,
      });
      return hints;
    }
    
    const signature = match.signature;
    
    // Generate hints based on field mappings
    for (const mapping of signature.fieldMappings) {
      const hint: ExtractionHint = {
        field: mapping.field,
        hint: `Look for ${mapping.field} near "${mapping.location.nearPhrase || mapping.location.section}"`,
        confidence: match.confidence * 0.9,
      };
      
      if (mapping.location.section) {
        hint.suggestedLocation = mapping.location.section;
      }
      
      if (signature.defaultValues[mapping.field] !== undefined) {
        hint.defaultValue = signature.defaultValues[mapping.field];
        hint.hint += `. Default value: ${signature.defaultValues[mapping.field]}`;
      }
      
      hints.push(hint);
    }
    
    // Add hints for missing sections
    for (const deviation of match.deviations) {
      if (deviation.type === 'missing_section') {
        hints.push({
          field: deviation.location || 'unknown',
          hint: deviation.description,
          confidence: 0.7,
        });
      }
    }
    
    // Add hints for customizations
    for (const customization of match.customizations) {
      hints.push({
        field: customization.field,
        hint: `Customized from default (${customization.originalDefault}) to: ${customization.customValue}`,
        confidence: match.confidence,
        defaultValue: customization.originalDefault,
      });
    }
    
    return hints;
  }
  
  /**
   * Learn a new template signature from a document
   */
  learnTemplate(
    documentText: string,
    templateName: string,
    family: TemplateFamily,
    fieldMappings?: TemplateFieldMapping[]
  ): TemplateSignature {
    logger.info('Learning new template signature', { templateName, family });
    
    // Extract structure from document
    const sections = this.extractDocumentStructure(documentText);
    
    // Generate unique phrases
    const uniquePhrases = this.extractUniquePhrases(documentText);
    
    // Create signature
    const signature: TemplateSignature = {
      id: `learned-${Date.now()}`,
      name: templateName,
      family,
      headerPatterns: [new RegExp(this.escapeRegex(templateName), 'i')],
      footerPatterns: [],
      sectionPatterns: sections.map((s, i) => ({
        name: s.name,
        pattern: new RegExp(this.escapeRegex(s.header), 'i'),
        order: i + 1,
        required: true,
      })),
      uniquePhrases,
      clauseOrder: sections.map(s => s.name),
      fieldMappings: fieldMappings || [],
      defaultValues: {},
      requiredClauses: sections.slice(0, 5).map(s => s.name),
      optionalClauses: sections.slice(5).map(s => s.name),
      lastUpdated: new Date(),
      confidence: 0.7,
    };
    
    this.learnedSignatures.push(signature);
    this.signatures.set(signature.id, signature);
    
    return signature;
  }
  
  /**
   * Extract document structure
   */
  private extractDocumentStructure(documentText: string): Array<{ name: string; header: string }> {
    const sections: Array<{ name: string; header: string }> = [];
    
    // Common section header patterns
    const headerPatterns = [
      /^(?:article|section)\s+(\d+)[.:]\s*(.+)$/gim,
      /^(\d+)\.\s+([A-Z][^.]+)$/gm,
      /^([IVXLCDM]+)\.\s+(.+)$/gim,
    ];
    
    for (const pattern of headerPatterns) {
      let match;
      while ((match = pattern.exec(documentText)) !== null) {
        const header = match[0].trim();
        const name = match[2]?.toLowerCase().replace(/\s+/g, '_') || `section_${match[1]}`;
        
        if (!sections.find(s => s.name === name)) {
          sections.push({ name, header });
        }
      }
    }
    
    return sections;
  }
  
  /**
   * Extract unique phrases from document
   */
  private extractUniquePhrases(documentText: string): string[] {
    const phrases: string[] = [];
    
    // Look for defined terms
    const definedTerms = documentText.match(/"([^"]+)"\s+(?:means|shall mean)/gi);
    if (definedTerms) {
      for (const term of definedTerms) {
        const match = /"([^"]+)"/.exec(term);
        if (match) {
          phrases.push(match[1].toLowerCase());
        }
      }
    }
    
    // Look for capitalized multi-word phrases (likely key terms)
    const capitalizedPhrases = documentText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
    if (capitalizedPhrases) {
      const phraseCounts = new Map<string, number>();
      for (const phrase of capitalizedPhrases) {
        const lower = phrase.toLowerCase();
        phraseCounts.set(lower, (phraseCounts.get(lower) || 0) + 1);
      }
      
      // Get frequently occurring phrases
      for (const [phrase, count] of phraseCounts.entries()) {
        if (count >= 3 && !phrases.includes(phrase)) {
          phrases.push(phrase);
        }
      }
    }
    
    return phrases.slice(0, 10); // Limit to top 10
  }
  
  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Get extraction optimization for a detected template
   */
  getExtractionOptimization(match: TemplateMatch): ExtractionOptimization {
    const signature = match.signature;
    
    return {
      fieldPriority: signature.fieldMappings.map(m => m.field),
      expectedFields: Object.keys(signature.defaultValues),
      skipFields: [], // Fields unlikely to exist for this template
      
      sectionTargets: signature.fieldMappings.reduce((acc, m) => {
        if (m.location.section) {
          acc[m.field] = m.location.section;
        }
        return acc;
      }, {} as Record<string, string>),
      
      defaultValues: signature.defaultValues,
      
      validationRules: signature.requiredClauses.map(c => ({
        field: c,
        rule: 'required',
      })),
    };
  }
  
  /**
   * Get signature by ID
   */
  getSignature(id: string): TemplateSignature | undefined {
    return this.signatures.get(id);
  }
  
  /**
   * Get all signatures for a family
   */
  getSignaturesByFamily(family: TemplateFamily): TemplateSignature[] {
    return this.familySignatures.get(family) || [];
  }
  
  /**
   * List all available templates
   */
  listTemplates(): Array<{ id: string; name: string; family: TemplateFamily }> {
    const templates: Array<{ id: string; name: string; family: TemplateFamily }> = [];
    
    for (const sig of this.signatures.values()) {
      templates.push({
        id: sig.id,
        name: sig.name,
        family: sig.family,
      });
    }
    
    return templates;
  }
}

export interface ExtractionOptimization {
  fieldPriority: string[];
  expectedFields: string[];
  skipFields: string[];
  sectionTargets: Record<string, string>;
  defaultValues: Record<string, unknown>;
  validationRules: Array<{ field: string; rule: string }>;
}

// Export singleton instance
export const templateDetectionService = new TemplateDetectionService();

/**
 * Intelligent Document Analyzer Service
 * 
 * This service provides advanced AI-powered document analysis that:
 * 1. Automatically understands document type and structure
 * 2. Identifies what information is most important to extract
 * 3. Adapts extraction strategy based on document characteristics
 * 4. Discovers insights that standard templates might miss
 * 5. Provides contextual recommendations for contract management
 * 
 * Key Features:
 * - Dynamic field discovery (finds important info not in standard templates)
 * - Semantic structure analysis (understands document hierarchy)
 * - Industry-specific insights (tailored by contract type)
 * - Risk pattern recognition (proactive risk identification)
 * - Negotiation opportunity detection
 * - Relationship mapping (parties, references, dependencies)
 */

import { createLogger } from '../utils/logger';
import { estimateTokens } from '../utils/token-estimation';

const logger = createLogger('intelligent-document-analyzer');

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentAnalysisResult {
  // Document Understanding
  documentType: DocumentTypeAnalysis;
  structure: DocumentStructure;
  semanticSections: SemanticSection[];
  
  // Discovered Content
  discoveredFields: DiscoveredField[];
  keyInsights: DocumentInsight[];
  anomalies: DocumentAnomaly[];
  
  // Relationships
  parties: EnhancedPartyInfo[];
  referencedDocuments: ReferencedDocument[];
  externalReferences: ExternalReference[];
  
  // Strategic Analysis
  riskSignals: RiskSignal[];
  negotiationOpportunities: NegotiationOpportunity[];
  complianceFlags: ComplianceFlag[];
  
  // Recommendations
  recommendations: DocumentRecommendation[];
  
  // Quality & Confidence
  analysisQuality: AnalysisQuality;
  processingMetadata: ProcessingMetadata;
}

export interface DocumentTypeAnalysis {
  primaryType: string;
  subType?: string;
  confidence: number;
  alternativeTypes: Array<{ type: string; confidence: number }>;
  industry?: string;
  jurisdiction?: string;
  isTemplate: boolean;
  isAmendment: boolean;
  isExhibit: boolean;
  hasMultipleAgreements: boolean;
}

export interface DocumentStructure {
  totalSections: number;
  hierarchy: StructureNode[];
  hasTableOfContents: boolean;
  hasExhibits: boolean;
  hasSchedules: boolean;
  hasSignatureBlocks: boolean;
  estimatedPages: number;
  language: string;
  formality: 'formal' | 'semi-formal' | 'informal';
}

export interface StructureNode {
  id: string;
  title: string;
  level: number;
  type: 'section' | 'subsection' | 'clause' | 'paragraph' | 'exhibit' | 'schedule';
  startPosition: number;
  endPosition: number;
  children: StructureNode[];
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface SemanticSection {
  id: string;
  type: SemanticSectionType;
  title: string;
  content: string;
  summary?: string;
  importance: number; // 0-1
  containsFinancialInfo: boolean;
  containsDates: boolean;
  containsObligations: boolean;
  riskLevel: 'high' | 'medium' | 'low' | 'none';
}

export type SemanticSectionType = 
  | 'preamble'
  | 'definitions'
  | 'scope'
  | 'term'
  | 'pricing'
  | 'payment'
  | 'deliverables'
  | 'obligations'
  | 'warranties'
  | 'indemnification'
  | 'limitation_of_liability'
  | 'confidentiality'
  | 'intellectual_property'
  | 'termination'
  | 'dispute_resolution'
  | 'governing_law'
  | 'miscellaneous'
  | 'signatures'
  | 'exhibits'
  | 'unknown';

export interface DiscoveredField {
  fieldName: string;
  displayName: string;
  value: any;
  valueType: 'string' | 'number' | 'date' | 'currency' | 'duration' | 'percentage' | 'boolean' | 'list' | 'object';
  confidence: number;
  source: string;
  sourceSection: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  isStandardField: boolean;
  suggestedMetadataField?: string;
  explanation: string;
}

export interface DocumentInsight {
  id: string;
  type: 'observation' | 'warning' | 'opportunity' | 'recommendation' | 'question';
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  actionable: boolean;
  suggestedAction?: string;
  relatedSections: string[];
  confidence: number;
}

export interface DocumentAnomaly {
  type: 'missing_clause' | 'unusual_term' | 'inconsistency' | 'ambiguity' | 'placeholder' | 'incomplete';
  description: string;
  location: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface EnhancedPartyInfo {
  name: string;
  role: string;
  type: 'corporation' | 'llc' | 'partnership' | 'individual' | 'government' | 'nonprofit' | 'unknown';
  aliases: string[];
  jurisdiction?: string;
  registrationNumber?: string;
  address?: string;
  signatories: Array<{ name: string; title: string }>;
  responsibilities: string[];
  obligations: string[];
  confidence: number;
}

export interface ReferencedDocument {
  title: string;
  type: 'master_agreement' | 'amendment' | 'exhibit' | 'schedule' | 'sow' | 'order' | 'policy' | 'other';
  dateReference?: string;
  relationship: 'parent' | 'child' | 'related' | 'supersedes' | 'amends';
  isRequired: boolean;
  reference: string;
}

export interface ExternalReference {
  type: 'law' | 'regulation' | 'standard' | 'framework' | 'policy';
  name: string;
  version?: string;
  jurisdiction?: string;
  complianceRequired: boolean;
}

export interface RiskSignal {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: 'very_likely' | 'likely' | 'possible' | 'unlikely';
  financialImpact?: {
    amount?: number;
    type: 'fixed' | 'percentage' | 'uncapped' | 'unknown';
    currency?: string;
  };
  sourceClause: string;
  mitigationSuggestion: string;
  requiresReview: boolean;
}

export type RiskCategory = 
  | 'financial'
  | 'liability'
  | 'termination'
  | 'ip'
  | 'confidentiality'
  | 'compliance'
  | 'operational'
  | 'reputational'
  | 'vendor_lock_in'
  | 'performance'
  | 'regulatory';

export interface NegotiationOpportunity {
  id: string;
  type: 'favorable_term' | 'unfavorable_term' | 'missing_protection' | 'industry_standard' | 'one_sided';
  title: string;
  description: string;
  currentTerm: string;
  suggestedAlternative: string;
  priority: 'high' | 'medium' | 'low';
  potentialBenefit: string;
  negotiationTip: string;
}

export interface ComplianceFlag {
  regulation: string;
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'needs_review' | 'not_applicable';
  clauseReference?: string;
  gap?: string;
  remediation?: string;
}

export interface DocumentRecommendation {
  id: string;
  category: 'action' | 'review' | 'negotiation' | 'compliance' | 'risk' | 'optimization';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reason: string;
  deadline?: string;
  assignee?: string;
}

export interface AnalysisQuality {
  overallConfidence: number;
  documentClarity: number;
  extractionCompleteness: number;
  ocrQuality?: number;
  languageClarity: number;
  structureQuality: number;
  warnings: string[];
}

export interface ProcessingMetadata {
  analysisVersion: string;
  modelUsed: string;
  processingTime: number;
  tokenCount: number;
  timestamp: string;
}

// ============================================================================
// INTELLIGENT DOCUMENT ANALYZER SERVICE
// ============================================================================

export class IntelligentDocumentAnalyzerService {
  private static instance: IntelligentDocumentAnalyzerService;
  private readonly analysisVersion = '2.0.0';

  private constructor() {
    logger.info('Intelligent Document Analyzer Service initialized');
  }

  static getInstance(): IntelligentDocumentAnalyzerService {
    if (!IntelligentDocumentAnalyzerService.instance) {
      IntelligentDocumentAnalyzerService.instance = new IntelligentDocumentAnalyzerService();
    }
    return IntelligentDocumentAnalyzerService.instance;
  }

  // ==========================================================================
  // MAIN ANALYSIS METHOD
  // ==========================================================================

  /**
   * Perform comprehensive intelligent analysis of a document
   */
  async analyzeDocument(
    documentText: string,
    options: AnalysisOptions = {}
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();
    logger.info({ documentLength: documentText.length }, 'Starting intelligent document analysis');

    try {
      // Phase 1: Initial document understanding
      const documentType = await this.analyzeDocumentType(documentText);
      const structure = await this.analyzeDocumentStructure(documentText);
      const semanticSections = await this.extractSemanticSections(documentText, structure);

      // Phase 2: Deep content extraction
      const [
        discoveredFields,
        parties,
        referencedDocuments,
        externalReferences
      ] = await Promise.all([
        this.discoverFields(documentText, documentType, semanticSections),
        this.extractEnhancedParties(documentText, semanticSections),
        this.extractReferencedDocuments(documentText),
        this.extractExternalReferences(documentText)
      ]);

      // Phase 3: Strategic analysis
      const [
        riskSignals,
        negotiationOpportunities,
        complianceFlags,
        keyInsights,
        anomalies
      ] = await Promise.all([
        this.analyzeRiskSignals(documentText, semanticSections, documentType),
        this.identifyNegotiationOpportunities(documentText, semanticSections, documentType),
        this.checkCompliance(documentText, semanticSections, externalReferences),
        this.generateKeyInsights(documentText, semanticSections, documentType, discoveredFields),
        this.detectAnomalies(documentText, structure, semanticSections)
      ]);

      // Phase 4: Generate recommendations
      const recommendations = await this.generateRecommendations({
        documentType,
        riskSignals,
        negotiationOpportunities,
        complianceFlags,
        anomalies,
        keyInsights
      });

      // Calculate quality metrics
      const analysisQuality = this.calculateAnalysisQuality({
        documentText,
        structure,
        semanticSections,
        discoveredFields
      });

      const processingTime = Date.now() - startTime;

      logger.info({
        processingTime,
        discoveredFieldsCount: discoveredFields.length,
        insightsCount: keyInsights.length,
        risksCount: riskSignals.length
      }, 'Intelligent document analysis completed');

      return {
        documentType,
        structure,
        semanticSections,
        discoveredFields,
        keyInsights,
        anomalies,
        parties,
        referencedDocuments,
        externalReferences,
        riskSignals,
        negotiationOpportunities,
        complianceFlags,
        recommendations,
        analysisQuality,
        processingMetadata: {
          analysisVersion: this.analysisVersion,
          modelUsed: 'gpt-4o',
          processingTime,
          tokenCount: estimateTokens(documentText),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error({ error }, 'Document analysis failed');
      throw error;
    }
  }

  // ==========================================================================
  // DOCUMENT TYPE ANALYSIS
  // ==========================================================================

  private async analyzeDocumentType(documentText: string): Promise<DocumentTypeAnalysis> {
    const sampleText = documentText.substring(0, 8000);
    
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst. Analyze this document and determine its type, characteristics, and structure.

Return a JSON object with:
{
  "primaryType": "The main contract type (e.g., Master Service Agreement, NDA, SaaS Agreement, Employment Agreement, SOW, License Agreement, etc.)",
  "subType": "More specific type if applicable",
  "confidence": 0.0-1.0,
  "alternativeTypes": [{"type": "string", "confidence": 0.0-1.0}],
  "industry": "Industry if detectable (e.g., Technology, Healthcare, Finance)",
  "jurisdiction": "Governing law jurisdiction if stated",
  "isTemplate": true/false (if document has placeholders like [Company Name]),
  "isAmendment": true/false,
  "isExhibit": true/false,
  "hasMultipleAgreements": true/false
}`
          },
          {
            role: 'user',
            content: `Analyze this document:\n\n${sampleText}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : this.getDefaultDocumentType();
    } catch (error) {
      logger.warn({ error }, 'AI document type analysis failed, using fallback');
      return this.getDefaultDocumentType();
    }
  }

  private getDefaultDocumentType(): DocumentTypeAnalysis {
    return {
      primaryType: 'Unknown',
      confidence: 0.5,
      alternativeTypes: [],
      isTemplate: false,
      isAmendment: false,
      isExhibit: false,
      hasMultipleAgreements: false
    };
  }

  // ==========================================================================
  // DOCUMENT STRUCTURE ANALYSIS
  // ==========================================================================

  private async analyzeDocumentStructure(documentText: string): Promise<DocumentStructure> {
    const lines = documentText.split('\n');
    const hierarchy: StructureNode[] = [];
    
    // Pattern detection for structure elements
    const sectionPatterns = [
      /^(ARTICLE|SECTION)\s+(\d+|[IVXLC]+)[.:]\s*(.+)/i,
      /^(\d+)\.\s+([A-Z][A-Z\s]+)$/m,
      /^(\d+\.\d+)\s+(.+)$/m,
      /^(EXHIBIT|SCHEDULE|APPENDIX)\s+([A-Z0-9]+)/i,
    ];

    let currentPosition = 0;
    let nodeId = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      for (const pattern of sectionPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          hierarchy.push({
            id: `node-${nodeId++}`,
            title: trimmedLine,
            level: this.determineLevel(match[1]),
            type: this.determineNodeType(match[1]),
            startPosition: currentPosition,
            endPosition: currentPosition + line.length,
            children: [],
            importance: this.estimateImportance(trimmedLine)
          });
          break;
        }
      }
      currentPosition += line.length + 1;
    }

    return {
      totalSections: hierarchy.length,
      hierarchy,
      hasTableOfContents: /table\s+of\s+contents/i.test(documentText),
      hasExhibits: /\bexhibit\s+[a-z0-9]/i.test(documentText),
      hasSchedules: /\bschedule\s+[a-z0-9]/i.test(documentText),
      hasSignatureBlocks: /in\s+witness\s+whereof|signature|signed/i.test(documentText),
      estimatedPages: Math.ceil(documentText.length / 3000),
      language: 'en',
      formality: this.detectFormality(documentText)
    };
  }

  private determineLevel(indicator: string): number {
    const upper = indicator.toUpperCase();
    if (/^ARTICLE|^SECTION/.test(upper)) return 1;
    if (/^\d+$/.test(indicator)) return 1;
    if (/^\d+\.\d+$/.test(indicator)) return 2;
    if (/^\d+\.\d+\.\d+$/.test(indicator)) return 3;
    if (/^EXHIBIT|^SCHEDULE|^APPENDIX/.test(upper)) return 1;
    return 2;
  }

  private determineNodeType(indicator: string): StructureNode['type'] {
    const upper = indicator.toUpperCase();
    if (/^EXHIBIT/.test(upper)) return 'exhibit';
    if (/^SCHEDULE/.test(upper)) return 'schedule';
    if (/^ARTICLE|^SECTION/.test(upper)) return 'section';
    if (/^\d+\.\d+/.test(indicator)) return 'subsection';
    return 'clause';
  }

  private estimateImportance(title: string): StructureNode['importance'] {
    const critical = /termination|liability|indemnif|payment|price|fee|confidential/i;
    const high = /obligation|warranty|represent|term|scope|deliverable/i;
    const medium = /notice|amendment|assignment|force\s+majeure/i;
    
    if (critical.test(title)) return 'critical';
    if (high.test(title)) return 'high';
    if (medium.test(title)) return 'medium';
    return 'low';
  }

  private detectFormality(text: string): DocumentStructure['formality'] {
    const formalIndicators = /hereby|whereas|witnesseth|aforesaid|hereinafter/gi;
    const matches = text.match(formalIndicators) || [];
    if (matches.length > 10) return 'formal';
    if (matches.length > 3) return 'semi-formal';
    return 'informal';
  }

  // ==========================================================================
  // SEMANTIC SECTION EXTRACTION
  // ==========================================================================

  private async extractSemanticSections(
    documentText: string,
    structure: DocumentStructure
  ): Promise<SemanticSection[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Chunk the document if too large
      const maxChunkSize = 12000;
      const textToAnalyze = documentText.length > maxChunkSize 
        ? documentText.substring(0, maxChunkSize) 
        : documentText;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst. Identify and categorize all semantic sections in this document.

For each section, provide:
{
  "sections": [
    {
      "id": "unique-id",
      "type": "preamble|definitions|scope|term|pricing|payment|deliverables|obligations|warranties|indemnification|limitation_of_liability|confidentiality|intellectual_property|termination|dispute_resolution|governing_law|miscellaneous|signatures|exhibits|unknown",
      "title": "Section title as it appears",
      "summary": "Brief summary of content (1-2 sentences)",
      "importance": 0.0-1.0,
      "containsFinancialInfo": true/false,
      "containsDates": true/false,
      "containsObligations": true/false,
      "riskLevel": "high|medium|low|none"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyze this document and identify all semantic sections:\n\n${textToAnalyze}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.sections?.map((s: any, i: number) => ({
          id: s.id || `section-${i}`,
          type: s.type || 'unknown',
          title: s.title || `Section ${i + 1}`,
          content: '', // Would be extracted from document
          summary: s.summary,
          importance: s.importance || 0.5,
          containsFinancialInfo: s.containsFinancialInfo || false,
          containsDates: s.containsDates || false,
          containsObligations: s.containsObligations || false,
          riskLevel: s.riskLevel || 'none'
        })) || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Semantic section extraction failed');
      return [];
    }
  }

  // ==========================================================================
  // INTELLIGENT FIELD DISCOVERY
  // ==========================================================================

  private async discoverFields(
    documentText: string,
    documentType: DocumentTypeAnalysis,
    semanticSections: SemanticSection[]
  ): Promise<DiscoveredField[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert contract analyst. Extract ALL important data points from this contract.

Go beyond standard fields - discover anything that would be valuable for contract management:
- Specific dates, deadlines, and milestones
- All monetary values and financial terms
- Specific performance metrics and SLAs
- Named individuals and their roles
- Specific products, services, or deliverables mentioned
- Any thresholds, limits, or caps
- Specific locations or jurisdictions
- Any unique or unusual terms
- Key performance indicators
- Pricing tiers or volume discounts
- Penalty clauses and their triggers
- Insurance requirements
- Specific compliance requirements

Document Type: ${documentType.primaryType}
Industry: ${documentType.industry || 'Unknown'}

Return JSON with:
{
  "fields": [
    {
      "fieldName": "snake_case_identifier",
      "displayName": "Human Readable Name",
      "value": "extracted value (exact as in document)",
      "valueType": "string|number|date|currency|duration|percentage|boolean|list|object",
      "confidence": 0.0-1.0,
      "source": "exact quote from document",
      "sourceSection": "section name where found",
      "importance": "critical|high|medium|low",
      "category": "financial|dates|parties|obligations|compliance|sla|deliverables|other",
      "isStandardField": true/false,
      "suggestedMetadataField": "if maps to a standard field",
      "explanation": "why this field is important"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Extract all important data points from this ${documentType.primaryType}:\n\n${documentText.substring(0, 25000)}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.fields || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Field discovery failed');
      return [];
    }
  }

  // ==========================================================================
  // ENHANCED PARTY EXTRACTION
  // ==========================================================================

  private async extractEnhancedParties(
    documentText: string,
    semanticSections: SemanticSection[]
  ): Promise<EnhancedPartyInfo[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting party information from contracts. Extract comprehensive details about each party.

Return JSON:
{
  "parties": [
    {
      "name": "Full legal name",
      "role": "client|vendor|service_provider|customer|licensee|licensor|employer|employee|other",
      "type": "corporation|llc|partnership|individual|government|nonprofit|unknown",
      "aliases": ["any alternative names used in the document"],
      "jurisdiction": "state/country of incorporation if mentioned",
      "registrationNumber": "company registration if mentioned",
      "address": "address if mentioned",
      "signatories": [{"name": "signer name", "title": "signer title"}],
      "responsibilities": ["list of main responsibilities"],
      "obligations": ["list of key obligations"],
      "confidence": 0.0-1.0
    }
  ]
}

IMPORTANT: Only extract REAL party names, not placeholders like "[Company Name]" or "Party A".`
          },
          {
            role: 'user',
            content: `Extract party information from:\n\n${documentText.substring(0, 15000)}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.parties || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Enhanced party extraction failed');
      return [];
    }
  }

  // ==========================================================================
  // REFERENCED DOCUMENTS
  // ==========================================================================

  private async extractReferencedDocuments(documentText: string): Promise<ReferencedDocument[]> {
    const references: ReferencedDocument[] = [];
    
    // Pattern matching for common references
    const patterns = [
      /(?:master\s+(?:service[s]?\s+)?agreement|msa)\s+(?:dated|effective)\s+(\w+\s+\d+,?\s+\d+)/gi,
      /(?:pursuant\s+to|under|as\s+defined\s+in)\s+(?:the\s+)?([^,\n.]+(?:agreement|contract|order|exhibit))/gi,
      /(?:exhibit|schedule|appendix|attachment)\s+([a-z0-9]+)/gi,
      /amendment\s+(?:no\.?\s*)?(\d+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(documentText)) !== null) {
        references.push({
          title: match[0].trim(),
          type: this.classifyReferenceType(match[0]),
          relationship: this.determineRelationship(match[0]),
          isRequired: true,
          reference: match[0]
        });
      }
    }

    return references;
  }

  private classifyReferenceType(text: string): ReferencedDocument['type'] {
    const lower = text.toLowerCase();
    if (/master|msa/.test(lower)) return 'master_agreement';
    if (/amendment/.test(lower)) return 'amendment';
    if (/exhibit/.test(lower)) return 'exhibit';
    if (/schedule/.test(lower)) return 'schedule';
    if (/statement\s+of\s+work|sow/.test(lower)) return 'sow';
    if (/order/.test(lower)) return 'order';
    return 'other';
  }

  private determineRelationship(text: string): ReferencedDocument['relationship'] {
    const lower = text.toLowerCase();
    if (/master|governing/.test(lower)) return 'parent';
    if (/exhibit|schedule|appendix/.test(lower)) return 'child';
    if (/supersedes|replaces/.test(lower)) return 'supersedes';
    if (/amends|amendment/.test(lower)) return 'amends';
    return 'related';
  }

  // ==========================================================================
  // EXTERNAL REFERENCES (Laws, Regulations, Standards)
  // ==========================================================================

  private async extractExternalReferences(documentText: string): Promise<ExternalReference[]> {
    const references: ExternalReference[] = [];
    
    const regulationPatterns = [
      { pattern: /\bGDPR\b/g, name: 'General Data Protection Regulation', type: 'regulation' as const },
      { pattern: /\bCCPA\b/g, name: 'California Consumer Privacy Act', type: 'regulation' as const },
      { pattern: /\bHIPAA\b/g, name: 'Health Insurance Portability and Accountability Act', type: 'regulation' as const },
      { pattern: /\bSOC\s*2\b/gi, name: 'SOC 2', type: 'standard' as const },
      { pattern: /\bISO\s*27001\b/g, name: 'ISO 27001', type: 'standard' as const },
      { pattern: /\bPCI[\s-]?DSS\b/gi, name: 'PCI DSS', type: 'standard' as const },
      { pattern: /\bFedRAMP\b/gi, name: 'FedRAMP', type: 'framework' as const },
    ];

    for (const { pattern, name, type } of regulationPatterns) {
      if (pattern.test(documentText)) {
        references.push({
          type,
          name,
          complianceRequired: true
        });
      }
    }

    return references;
  }

  // ==========================================================================
  // RISK SIGNAL ANALYSIS
  // ==========================================================================

  private async analyzeRiskSignals(
    documentText: string,
    semanticSections: SemanticSection[],
    documentType: DocumentTypeAnalysis
  ): Promise<RiskSignal[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a contract risk analyst. Identify all risk signals in this contract.

Look for:
- Unlimited liability exposure
- One-sided indemnification
- Automatic renewal without clear opt-out
- Short termination notice periods
- Unfavorable IP ownership clauses
- Broad confidentiality scope
- Missing limitation of liability
- Penalty clauses with unclear triggers
- Unclear payment terms
- Vendor lock-in provisions
- Data handling risks
- Compliance gaps

Return JSON:
{
  "risks": [
    {
      "id": "risk-1",
      "category": "financial|liability|termination|ip|confidentiality|compliance|operational|reputational|vendor_lock_in|performance|regulatory",
      "title": "Risk title",
      "description": "Detailed description",
      "severity": "critical|high|medium|low",
      "likelihood": "very_likely|likely|possible|unlikely",
      "financialImpact": {
        "amount": number or null,
        "type": "fixed|percentage|uncapped|unknown",
        "currency": "USD"
      },
      "sourceClause": "Exact quote from the contract",
      "mitigationSuggestion": "How to mitigate this risk",
      "requiresReview": true/false
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyze risks in this ${documentType.primaryType}:\n\n${documentText.substring(0, 20000)}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.risks || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Risk analysis failed');
      return [];
    }
  }

  // ==========================================================================
  // NEGOTIATION OPPORTUNITIES
  // ==========================================================================

  private async identifyNegotiationOpportunities(
    documentText: string,
    semanticSections: SemanticSection[],
    documentType: DocumentTypeAnalysis
  ): Promise<NegotiationOpportunity[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a contract negotiation expert. Identify opportunities to negotiate better terms.

Look for:
- Terms that are unfavorable compared to industry standards
- Missing protections that should be added
- One-sided clauses that could be balanced
- Payment terms that could be improved
- Liability caps that are too low or missing
- Warranty periods that are too short
- Notice periods that don't match market norms

Return JSON:
{
  "opportunities": [
    {
      "id": "opp-1",
      "type": "favorable_term|unfavorable_term|missing_protection|industry_standard|one_sided",
      "title": "Opportunity title",
      "description": "What the issue is",
      "currentTerm": "Quote of current contract language",
      "suggestedAlternative": "Suggested improved language",
      "priority": "high|medium|low",
      "potentialBenefit": "What you gain from this negotiation",
      "negotiationTip": "How to approach this negotiation"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Identify negotiation opportunities in this ${documentType.primaryType}:\n\n${documentText.substring(0, 20000)}`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.opportunities || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Negotiation analysis failed');
      return [];
    }
  }

  // ==========================================================================
  // COMPLIANCE CHECKING
  // ==========================================================================

  private async checkCompliance(
    documentText: string,
    semanticSections: SemanticSection[],
    externalReferences: ExternalReference[]
  ): Promise<ComplianceFlag[]> {
    const flags: ComplianceFlag[] = [];

    // Check for common compliance requirements
    const complianceChecks = [
      {
        regulation: 'GDPR',
        requirements: [
          { check: /data\s+processing\s+agreement/i, name: 'Data Processing Agreement' },
          { check: /data\s+protection/i, name: 'Data Protection clause' },
          { check: /right\s+to\s+erasure|deletion/i, name: 'Right to Erasure' },
        ]
      },
      {
        regulation: 'Confidentiality',
        requirements: [
          { check: /confidential\s+information/i, name: 'Confidentiality definition' },
          { check: /non-?disclosure/i, name: 'Non-disclosure obligation' },
        ]
      }
    ];

    for (const { regulation, requirements } of complianceChecks) {
      for (const { check, name } of requirements) {
        const found = check.test(documentText);
        flags.push({
          regulation,
          requirement: name,
          status: found ? 'compliant' : 'needs_review',
          gap: found ? undefined : `${name} not found in document`
        });
      }
    }

    return flags;
  }

  // ==========================================================================
  // KEY INSIGHTS GENERATION
  // ==========================================================================

  private async generateKeyInsights(
    documentText: string,
    semanticSections: SemanticSection[],
    documentType: DocumentTypeAnalysis,
    discoveredFields: DiscoveredField[]
  ): Promise<DocumentInsight[]> {
    try {
      const OpenAI = await this.getOpenAI();
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a senior contract analyst. Generate key insights that would be valuable for someone managing this contract.

Think about:
- What are the most important things to know?
- What might someone miss on first read?
- What deadlines or dates are critical?
- What could cause problems if overlooked?
- What makes this contract unique or notable?
- What questions should be asked?

Return JSON:
{
  "insights": [
    {
      "id": "insight-1",
      "type": "observation|warning|opportunity|recommendation|question",
      "category": "financial|legal|operational|compliance|risk|strategic",
      "title": "Brief insight title",
      "description": "Detailed insight",
      "severity": "critical|high|medium|low|info",
      "actionable": true/false,
      "suggestedAction": "What to do about it",
      "relatedSections": ["section names"],
      "confidence": 0.0-1.0
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Generate key insights for this ${documentType.primaryType}:\n\n${documentText.substring(0, 15000)}`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return parsed.insights || [];
      }
      return [];
    } catch (error) {
      logger.warn({ error }, 'Insight generation failed');
      return [];
    }
  }

  // ==========================================================================
  // ANOMALY DETECTION
  // ==========================================================================

  private async detectAnomalies(
    documentText: string,
    structure: DocumentStructure,
    semanticSections: SemanticSection[]
  ): Promise<DocumentAnomaly[]> {
    const anomalies: DocumentAnomaly[] = [];

    // Check for placeholders
    const placeholderPatterns = [
      /\[(?:company|client|vendor|party|name|date|amount)[^\]]*\]/gi,
      /\{(?:company|client|vendor|party|name|date|amount)[^}]*\}/gi,
      /<(?:company|client|vendor|party|name|date|amount)[^>]*>/gi,
      /___+/g,
      /\.\.\./g,
    ];

    for (const pattern of placeholderPatterns) {
      const matches = documentText.match(pattern);
      if (matches && matches.length > 0) {
        anomalies.push({
          type: 'placeholder',
          description: `Document contains ${matches.length} placeholder(s): ${matches.slice(0, 3).join(', ')}`,
          location: 'Throughout document',
          severity: 'high',
          recommendation: 'This appears to be a template. Fill in all placeholders before finalizing.'
        });
        break;
      }
    }

    // Check for missing common sections
    const expectedSections = ['term', 'termination', 'governing_law', 'confidentiality'];
    const foundTypes = new Set(semanticSections.map(s => s.type));
    
    for (const expected of expectedSections) {
      if (!foundTypes.has(expected as any)) {
        anomalies.push({
          type: 'missing_clause',
          description: `No ${expected.replace('_', ' ')} section found`,
          location: 'Document-wide',
          severity: 'medium',
          recommendation: `Consider adding a ${expected.replace('_', ' ')} clause for completeness.`
        });
      }
    }

    return anomalies;
  }

  // ==========================================================================
  // RECOMMENDATION GENERATION
  // ==========================================================================

  private async generateRecommendations(context: {
    documentType: DocumentTypeAnalysis;
    riskSignals: RiskSignal[];
    negotiationOpportunities: NegotiationOpportunity[];
    complianceFlags: ComplianceFlag[];
    anomalies: DocumentAnomaly[];
    keyInsights: DocumentInsight[];
  }): Promise<DocumentRecommendation[]> {
    const recommendations: DocumentRecommendation[] = [];
    let recId = 0;

    // Generate recommendations from risks
    for (const risk of context.riskSignals.filter(r => r.severity === 'critical' || r.severity === 'high')) {
      recommendations.push({
        id: `rec-${recId++}`,
        category: 'risk',
        priority: risk.severity === 'critical' ? 'urgent' : 'high',
        title: `Address: ${risk.title}`,
        description: risk.mitigationSuggestion,
        reason: risk.description
      });
    }

    // Generate recommendations from compliance
    for (const flag of context.complianceFlags.filter(f => f.status === 'non_compliant')) {
      recommendations.push({
        id: `rec-${recId++}`,
        category: 'compliance',
        priority: 'high',
        title: `Compliance Gap: ${flag.regulation}`,
        description: flag.remediation || `Address ${flag.requirement} requirement`,
        reason: flag.gap || 'Non-compliant status detected'
      });
    }

    // Generate recommendations from negotiation opportunities
    for (const opp of context.negotiationOpportunities.filter(o => o.priority === 'high')) {
      recommendations.push({
        id: `rec-${recId++}`,
        category: 'negotiation',
        priority: 'medium',
        title: opp.title,
        description: opp.negotiationTip,
        reason: opp.potentialBenefit
      });
    }

    // Generate recommendations from anomalies
    for (const anomaly of context.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high')) {
      recommendations.push({
        id: `rec-${recId++}`,
        category: 'review',
        priority: anomaly.severity === 'critical' ? 'urgent' : 'high',
        title: `Review: ${anomaly.type.replace('_', ' ')}`,
        description: anomaly.recommendation,
        reason: anomaly.description
      });
    }

    return recommendations;
  }

  // ==========================================================================
  // QUALITY ASSESSMENT
  // ==========================================================================

  private calculateAnalysisQuality(context: {
    documentText: string;
    structure: DocumentStructure;
    semanticSections: SemanticSection[];
    discoveredFields: DiscoveredField[];
  }): AnalysisQuality {
    const warnings: string[] = [];

    // Document clarity
    const avgSentenceLength = context.documentText.split(/[.!?]+/).reduce((sum, s) => sum + s.length, 0) / 
                              (context.documentText.match(/[.!?]+/g)?.length || 1);
    const documentClarity = Math.min(1, Math.max(0, 1 - (avgSentenceLength - 100) / 200));

    // Extraction completeness
    const expectedFieldCount = 15; // Typical number of important fields
    const extractionCompleteness = Math.min(1, context.discoveredFields.length / expectedFieldCount);

    // Structure quality
    const structureQuality = context.structure.totalSections > 5 ? 0.9 : 
                             context.structure.totalSections > 2 ? 0.7 : 0.5;

    // Overall confidence
    const avgConfidence = context.discoveredFields.length > 0
      ? context.discoveredFields.reduce((sum, f) => sum + f.confidence, 0) / context.discoveredFields.length
      : 0.5;

    // Language clarity (simple heuristic)
    const languageClarity = context.structure.formality === 'formal' ? 0.9 : 0.7;

    // Warnings
    if (documentClarity < 0.5) warnings.push('Document has very long sentences, may affect extraction accuracy');
    if (extractionCompleteness < 0.5) warnings.push('Fewer fields extracted than expected');
    if (structureQuality < 0.7) warnings.push('Document structure is unclear');

    return {
      overallConfidence: (documentClarity + extractionCompleteness + avgConfidence + structureQuality) / 4,
      documentClarity,
      extractionCompleteness,
      languageClarity,
      structureQuality,
      warnings
    };
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private async getOpenAI(): Promise<any> {
    const openaiModule = await import('openai');
    return openaiModule.OpenAI || openaiModule.default;
  }
}

// ============================================================================
// ANALYSIS OPTIONS
// ============================================================================

export interface AnalysisOptions {
  skipRiskAnalysis?: boolean;
  skipNegotiationAnalysis?: boolean;
  skipComplianceCheck?: boolean;
  maxFieldsToDiscover?: number;
  targetConfidence?: number;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const intelligentDocumentAnalyzerService = IntelligentDocumentAnalyzerService.getInstance();

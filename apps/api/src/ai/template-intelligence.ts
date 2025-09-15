/**
 * Template Intelligence System
 * Automated contract template detection and standardization workflows
 */

import { OpenAI } from 'openai';
import prisma from 'clients-db';
import { AppError } from '../errors';

interface ContractTemplate {
  id: string;
  name: string;
  type: 'service-agreement' | 'nda' | 'employment' | 'purchase-order' | 'lease' | 'license' | 'partnership' | 'other';
  category: string;
  version: string;
  description: string;
  tenantId: string;
  signature: TemplateSignature;
  standardClauses: StandardClause[];
  requiredFields: TemplateField[];
  riskProfile: RiskProfile;
  complianceRequirements: string[];
  lastUpdated: Date;
  usage: {
    totalDocuments: number;
    successRate: number;
    avgConfidence: number;
  };
}

interface TemplateSignature {
  keyPhrases: string[];
  structuralPatterns: string[];
  sectionHeaders: string[];
  legalTerms: string[];
  confidenceThreshold: number;
}

interface StandardClause {
  id: string;
  name: string;
  type: 'mandatory' | 'recommended' | 'optional';
  content: string;
  alternatives: string[];
  riskLevel: 'low' | 'medium' | 'high';
  complianceCategory?: string;
}

interface TemplateField {
  name: string;
  type: 'text' | 'date' | 'number' | 'currency' | 'selection';
  required: boolean;
  validationRules?: any;
  defaultValue?: any;
}

interface RiskProfile {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
  mitigationStrategies: string[];
  reviewRequirements: string[];
}

interface TemplateMatch {
  templateId: string;
  confidence: number;
  matchedElements: {
    keyPhrases: number;
    structuralPatterns: number;
    sectionHeaders: number;
    legalTerms: number;
  };
  deviations: TemplateDeviation[];
  suggestions: TemplateSuggestion[];
}

interface TemplateDeviation {
  type: 'missing-clause' | 'modified-clause' | 'extra-clause' | 'format-change';
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  location: string;
  standardExpected: string;
  actualFound: string;
  riskImpact: string;
}

interface TemplateSuggestion {
  type: 'add-clause' | 'modify-clause' | 'remove-clause' | 'standardize-format';
  priority: 'low' | 'medium' | 'high';
  description: string;
  rationale: string;
  implementation: string;
}

export class TemplateIntelligenceSystem {
  private openai: OpenAI;
  private templates: Map<string, ContractTemplate> = new Map();

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    });
    
    // Initialize with common templates
    this.initializeStandardTemplates();
  }

  /**
   * Detect contract template from document content
   */
  async detectTemplate(
    documentContent: string,
    documentTitle?: string,
    tenantId: string = 'default'
  ): Promise<TemplateMatch[]> {
    // Get tenant-specific templates
    const availableTemplates = await this.getTenantTemplates(tenantId);
    
    // Use LLM for initial classification
    const classification = await this.classifyDocument(documentContent, documentTitle);
    
    // Score templates based on content matching
    const matches: TemplateMatch[] = [];
    
    for (const template of availableTemplates) {
      const match = await this.scoreTemplateMatch(documentContent, template, classification);
      if (match.confidence > 0.3) { // Minimum confidence threshold
        matches.push(match);
      }
    }
    
    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches.slice(0, 3); // Return top 3 matches
  }

  /**
   * Analyze template compliance and deviations
   */
  async analyzeTemplateCompliance(
    documentContent: string,
    templateId: string,
    tenantId: string
  ): Promise<{
    compliance: number;
    deviations: TemplateDeviation[];
    suggestions: TemplateSuggestion[];
    riskAssessment: any;
  }> {
    const template = await this.getTemplate(templateId, tenantId);
    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    // Analyze clause compliance
    const clauseAnalysis = await this.analyzeClauseCompliance(documentContent, template);
    
    // Check structural compliance  
    const structuralAnalysis = await this.analyzeStructuralCompliance(documentContent, template);
    
    // Generate improvement suggestions
    const suggestions = await this.generateImprovementSuggestions(
      documentContent, 
      template, 
      clauseAnalysis.deviations.concat(structuralAnalysis.deviations)
    );

    // Calculate overall compliance score
    const compliance = this.calculateComplianceScore(clauseAnalysis, structuralAnalysis);
    
    // Assess risk impact
    const riskAssessment = this.assessComplianceRisk(
      clauseAnalysis.deviations.concat(structuralAnalysis.deviations),
      template
    );

    return {
      compliance,
      deviations: clauseAnalysis.deviations.concat(structuralAnalysis.deviations),
      suggestions,
      riskAssessment
    };
  }

  /**
   * Create new template from document
   */
  async createTemplateFromDocument(
    documentContent: string,
    templateName: string,
    templateType: ContractTemplate['type'],
    tenantId: string,
    metadata?: any
  ): Promise<ContractTemplate> {
    // Extract template signature using LLM
    const signature = await this.extractTemplateSignature(documentContent);
    
    // Identify standard clauses
    const clauses = await this.extractStandardClauses(documentContent);
    
    // Determine required fields
    const fields = await this.extractTemplateFields(documentContent);
    
    // Assess risk profile
    const riskProfile = await this.assessTemplateRisk(documentContent, clauses);

    const template: ContractTemplate = {
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: templateName,
      type: templateType,
      category: metadata?.category || this.categorizeTemplate(templateType),
      version: '1.0.0',
      description: metadata?.description || `Template created from ${templateName}`,
      tenantId,
      signature,
      standardClauses: clauses,
      requiredFields: fields,
      riskProfile,
      complianceRequirements: metadata?.complianceRequirements || [],
      lastUpdated: new Date(),
      usage: {
        totalDocuments: 0,
        successRate: 0,
        avgConfidence: 0
      }
    };

    // Store template
    await this.storeTemplate(template);
    
    return template;
  }

  /**
   * Update template based on usage patterns
   */
  async updateTemplateFromUsage(
    templateId: string,
    tenantId: string,
    usageData: {
      documentContent: string;
      deviations: TemplateDeviation[];
      userFeedback?: any;
    }[]
  ): Promise<ContractTemplate> {
    const template = await this.getTemplate(templateId, tenantId);
    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    // Analyze common deviations
    const commonDeviations = this.analyzeCommonDeviations(
      usageData.flatMap(d => d.deviations)
    );

    // Update template signature based on patterns
    const updatedSignature = await this.updateTemplateSignature(
      template.signature,
      usageData.map(d => d.documentContent)
    );

    // Suggest new standard clauses
    const newClauses = await this.suggestNewStandardClauses(
      template.standardClauses,
      commonDeviations
    );

    // Update template
    const updatedTemplate: ContractTemplate = {
      ...template,
      signature: updatedSignature,
      standardClauses: [...template.standardClauses, ...newClauses],
      version: this.incrementVersion(template.version),
      lastUpdated: new Date()
    };

    await this.storeTemplate(updatedTemplate);
    
    return updatedTemplate;
  }

  /**
   * Generate standardized document from template
   */
  async generateStandardizedDocument(
    originalContent: string,
    templateId: string,
    tenantId: string,
    fieldValues: Record<string, any> = {}
  ): Promise<{
    standardizedContent: string;
    changes: any[];
    complianceImprovement: number;
  }> {
    const template = await this.getTemplate(templateId, tenantId);
    if (!template) {
      throw new AppError(404, 'Template not found');
    }

    // Analyze current compliance
    const originalCompliance = await this.analyzeTemplateCompliance(
      originalContent, 
      templateId, 
      tenantId
    );

    // Generate standardized version using LLM
    const standardizedContent = await this.generateStandardizedVersion(
      originalContent,
      template,
      fieldValues
    );

    // Calculate improvement
    const newCompliance = await this.analyzeTemplateCompliance(
      standardizedContent,
      templateId,
      tenantId
    );

    const complianceImprovement = newCompliance.compliance - originalCompliance.compliance;

    // Track changes made
    const changes = await this.trackDocumentChanges(originalContent, standardizedContent);

    return {
      standardizedContent,
      changes,
      complianceImprovement
    };
  }

  /**
   * Private helper methods
   */
  private async classifyDocument(content: string, title?: string): Promise<any> {
    const prompt = `Analyze this contract document and classify it:

Title: ${title || 'Unknown'}
Content: ${content.substring(0, 2000)}...

Classify the document type, identify key sections, and extract characteristic patterns.
Return JSON with: documentType, keyPhrases, sections, legalTerms, structuralPatterns.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  }

  private async scoreTemplateMatch(
    content: string,
    template: ContractTemplate,
    classification: any
  ): Promise<TemplateMatch> {
    let score = 0;
    const matchedElements = {
      keyPhrases: 0,
      structuralPatterns: 0,
      sectionHeaders: 0,
      legalTerms: 0
    };

    // Score key phrases
    const keyPhraseMatches = template.signature.keyPhrases.filter(phrase =>
      content.toLowerCase().includes(phrase.toLowerCase())
    );
    matchedElements.keyPhrases = keyPhraseMatches.length / template.signature.keyPhrases.length;
    score += matchedElements.keyPhrases * 0.3;

    // Score structural patterns
    const structuralMatches = template.signature.structuralPatterns.filter(pattern =>
      new RegExp(pattern, 'i').test(content)
    );
    matchedElements.structuralPatterns = structuralMatches.length / template.signature.structuralPatterns.length;
    score += matchedElements.structuralPatterns * 0.25;

    // Score section headers
    const headerMatches = template.signature.sectionHeaders.filter(header =>
      content.toLowerCase().includes(header.toLowerCase())
    );
    matchedElements.sectionHeaders = headerMatches.length / template.signature.sectionHeaders.length;
    score += matchedElements.sectionHeaders * 0.25;

    // Score legal terms
    const termMatches = template.signature.legalTerms.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );
    matchedElements.legalTerms = termMatches.length / template.signature.legalTerms.length;
    score += matchedElements.legalTerms * 0.2;

    // Generate deviations and suggestions (simplified for now)
    const deviations: TemplateDeviation[] = [];
    const suggestions: TemplateSuggestion[] = [];

    return {
      templateId: template.id,
      confidence: Math.min(score, 1.0),
      matchedElements,
      deviations,
      suggestions
    };
  }

  private async getTenantTemplates(tenantId: string): Promise<ContractTemplate[]> {
    // In production, this would query the database
    // For now, return standard templates + tenant-specific ones
    const standardTemplates = Array.from(this.templates.values());
    
    try {
      const model: any = (prisma as any).contractTemplate;
      if (!model || typeof model.findMany !== 'function') {
        return standardTemplates; // Model not available in current client build
      }
      const tenantTemplates = await model.findMany({ where: { tenantId } });
      return [...standardTemplates, ...tenantTemplates.map(this.dbToTemplate)];
    } catch {
      return standardTemplates;
    }
  }

  private async getTemplate(templateId: string, tenantId: string): Promise<ContractTemplate | null> {
    // Check in-memory templates first
    const memoryTemplate = this.templates.get(templateId);
    if (memoryTemplate) return memoryTemplate;

    // Check database
    try {
      const model: any = (prisma as any).contractTemplate;
      if (!model || typeof model.findFirst !== 'function') return null;
      const dbTemplate = await model.findFirst({ where: { id: templateId, tenantId } });
      return dbTemplate ? this.dbToTemplate(dbTemplate) : null;
    } catch {
      return null;
    }
  }

  private async storeTemplate(template: ContractTemplate): Promise<void> {
    try {
      const model: any = (prisma as any).contractTemplate;
      if (!model || typeof model.upsert !== 'function') {
        // Fallback: keep only in memory if persistence model missing
        this.templates.set(template.id, template);
        return;
      }
      await model.upsert({
        where: { id: template.id },
        update: this.templateToDb(template),
        create: this.templateToDb(template)
      });
    } catch (error) {
      console.error('Failed to store template:', error);
      throw new AppError(500, 'Failed to store template');
    }
  }

  private dbToTemplate(dbTemplate: any): ContractTemplate {
    return {
      ...dbTemplate,
      signature: dbTemplate.signature || {},
      standardClauses: dbTemplate.standardClauses || [],
      requiredFields: dbTemplate.requiredFields || [],
      riskProfile: dbTemplate.riskProfile || {},
      complianceRequirements: dbTemplate.complianceRequirements || [],
      usage: dbTemplate.usage || { totalDocuments: 0, successRate: 0, avgConfidence: 0 }
    };
  }

  private templateToDb(template: ContractTemplate): any {
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      version: template.version,
      description: template.description,
      tenantId: template.tenantId,
      signature: template.signature,
      standardClauses: template.standardClauses,
      requiredFields: template.requiredFields,
      riskProfile: template.riskProfile,
      complianceRequirements: template.complianceRequirements,
      lastUpdated: template.lastUpdated,
      usage: template.usage
    };
  }

  private initializeStandardTemplates(): void {
    // Initialize with common contract templates
    const standardTemplates: Partial<ContractTemplate>[] = [
      {
        id: 'std-nda',
        name: 'Non-Disclosure Agreement',
        type: 'nda',
        category: 'confidentiality',
        signature: {
          keyPhrases: ['confidential information', 'non-disclosure', 'proprietary', 'trade secrets'],
          structuralPatterns: ['definitions?', 'confidential information', 'term', 'return of materials'],
          sectionHeaders: ['definitions', 'confidential information', 'obligations', 'term'],
          legalTerms: ['disclosing party', 'receiving party', 'confidential', 'proprietary'],
          confidenceThreshold: 0.7
        }
      },
      {
        id: 'std-service-agreement',
        name: 'Service Agreement',
        type: 'service-agreement',
        category: 'services',
        signature: {
          keyPhrases: ['services', 'performance', 'deliverables', 'payment terms'],
          structuralPatterns: ['scope of work', 'payment', 'term', 'termination'],
          sectionHeaders: ['services', 'compensation', 'term', 'intellectual property'],
          legalTerms: ['service provider', 'client', 'deliverables', 'acceptance'],
          confidenceThreshold: 0.6
        }
      }
    ];

    standardTemplates.forEach(template => {
      if (template.id) {
        this.templates.set(template.id, template as ContractTemplate);
      }
    });
  }

  // Placeholder methods for complex operations
  private async analyzeClauseCompliance(content: string, template: ContractTemplate): Promise<any> {
    return { deviations: [], score: 0.8 };
  }

  private async analyzeStructuralCompliance(content: string, template: ContractTemplate): Promise<any> {
    return { deviations: [], score: 0.9 };
  }

  private async generateImprovementSuggestions(content: string, template: ContractTemplate, deviations: TemplateDeviation[]): Promise<TemplateSuggestion[]> {
    return [];
  }

  private calculateComplianceScore(clauseAnalysis: any, structuralAnalysis: any): number {
    return (clauseAnalysis.score + structuralAnalysis.score) / 2;
  }

  private assessComplianceRisk(deviations: TemplateDeviation[], template: ContractTemplate): any {
    return { overallRisk: 'low', factors: [] };
  }

  private async extractTemplateSignature(content: string): Promise<TemplateSignature> {
    return {
      keyPhrases: [],
      structuralPatterns: [],
      sectionHeaders: [],
      legalTerms: [],
      confidenceThreshold: 0.7
    };
  }

  private async extractStandardClauses(content: string): Promise<StandardClause[]> {
    return [];
  }

  private async extractTemplateFields(content: string): Promise<TemplateField[]> {
    return [];
  }

  private async assessTemplateRisk(content: string, clauses: StandardClause[]): Promise<RiskProfile> {
    return {
      overallRisk: 'medium',
      riskFactors: [],
      mitigationStrategies: [],
      reviewRequirements: []
    };
  }

  private categorizeTemplate(type: ContractTemplate['type']): string {
    const categoryMap = {
      'service-agreement': 'commercial',
      'nda': 'confidentiality',
      'employment': 'hr',
      'purchase-order': 'procurement',
      'lease': 'real-estate',
      'license': 'intellectual-property',
      'partnership': 'business',
      'other': 'general'
    };
    return categoryMap[type] || 'general';
  }

  private analyzeCommonDeviations(deviations: TemplateDeviation[]): any {
    return {};
  }

  private async updateTemplateSignature(signature: TemplateSignature, contents: string[]): Promise<TemplateSignature> {
    return signature;
  }

  private async suggestNewStandardClauses(existing: StandardClause[], deviations: any): Promise<StandardClause[]> {
    return [];
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  private async generateStandardizedVersion(content: string, template: ContractTemplate, fieldValues: Record<string, any>): Promise<string> {
    return content; // Placeholder
  }

  private async trackDocumentChanges(original: string, standardized: string): Promise<any[]> {
    return []; // Placeholder
  }
}

export const templateIntelligenceSystem = new TemplateIntelligenceSystem();
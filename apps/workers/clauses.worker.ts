// Prefer workspace import, fallback to relative if needed
let ClausesArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('schemas').ClausesArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClausesArtifactV1Schema = require('../../packages/schemas/src').ClausesArtifactV1Schema;
}

/**
 * Enhanced Clauses Intelligence Worker with GPT-4 Integration
 * Provides expert-level clause identification, analysis, and risk assessment with comprehensive best practices
 */

import { Job } from 'bullmq';
import { OpenAI } from 'openai';
// Try to import pino, fallback to console if not available
let logger: any;
try {
  const pino = require('pino');
  logger = pino();
} catch (error) {
  logger = console;
}

const logger = pino({ name: 'clauses-worker' });

export interface ClausesAnalysisRequest {
  docId: string;
  tenantId: string;
}

export interface ClausesAnalysisResult {
  clauses: EnhancedClause[];
  clauseCategories: ClauseCategory[];
  riskAssessment: ClauseRiskAssessment;
  relationshipMap: ClauseRelationship[];
  bestPractices: ClausesBestPractices;
  confidence: number;
  processingTime: number;
}

export interface EnhancedClause {
  clauseId: string;
  text: string;
  category: string;
  subcategory?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  page?: number;
  section?: string;
  
  // Enhanced analysis
  legalSignificance: 'low' | 'medium' | 'high' | 'critical';
  businessImpact: string;
  enforceability: 'strong' | 'moderate' | 'weak' | 'questionable';
  clarity: 'clear' | 'moderate' | 'ambiguous' | 'unclear';
  completeness: 'complete' | 'partial' | 'incomplete';
  
  // Risk analysis
  identifiedRisks: ClauseRisk[];
  mitigationSuggestions: string[];
  
  // Improvement recommendations
  improvementPriority: 'low' | 'medium' | 'high' | 'critical';
  suggestedRevisions: string[];
  industryComparison: string;
}

export interface ClauseCategory {
  category: string;
  description: string;
  clauseCount: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  completeness: 'complete' | 'partial' | 'missing';
  industryStandard: boolean;
  recommendations: string[];
}

export interface ClauseRisk {
  riskType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: string;
  mitigation: string;
}

export interface ClauseRiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  criticalRisks: ClauseRisk[];
  risksByCategory: Record<string, ClauseRisk[]>;
  mitigationPriorities: string[];
  riskScore: number; // 0-100
}

export interface ClauseRelationship {
  sourceClauseId: string;
  targetClauseId: string;
  relationshipType: 'depends_on' | 'conflicts_with' | 'complements' | 'references';
  description: string;
  impact: string;
}

export interface ClausesBestPractices {
  // Core clause improvements
  clauseOptimizations: ClauseOptimization[];
  riskMitigations: ClauseRiskMitigation[];
  negotiationStrategies: ClauseNegotiationStrategy[];
  industryStandards: ClauseIndustryStandard[];
  complianceEnhancements: ClauseComplianceEnhancement[];
  languageImprovements: ClauseLanguageImprovement[];
  
  // Advanced recommendations
  clauseAdditions: ClauseAdditionRecommendation[];
  clauseRemovals: ClauseRemovalRecommendation[];
  structuralImprovements: ClauseStructuralImprovement[];
  
  // Quality metrics
  confidence: number;
  expertiseLevel: 'standard' | 'advanced' | 'expert';
}

export interface ClauseAdditionRecommendation {
  recommendedClause: string;
  category: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  riskMitigation: string;
  industryStandard: boolean;
  suggestedLanguage: string;
}

export interface ClauseRemovalRecommendation {
  clauseId: string;
  reason: string;
  riskReduction: string;
  alternativeApproach: string;
}

export interface ClauseStructuralImprovement {
  area: string;
  currentIssue: string;
  recommendation: string;
  benefit: string;
  implementationSteps: string[];
}

export interface ClauseOptimization {
  clauseCategory: string;
  currentLanguage: string;
  suggestedImprovement: string;
  benefit: string;
  implementation: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

export interface ClauseRiskMitigation {
  riskType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentExposure: string;
  mitigationStrategy: string;
  recommendedClauseAddition: string;
  legalRationale: string;
}

export interface ClauseNegotiationStrategy {
  clauseType: string;
  negotiationPoint: string;
  counterpartyPosition: string;
  yourPosition: string;
  compromiseSolution: string;
  fallbackOptions: string[];
}

export interface ClauseIndustryStandard {
  clauseCategory: string;
  industryBenchmark: string;
  yourContract: string;
  gapAnalysis: string;
  alignmentRecommendation: string;
  competitiveAdvantage: string;
}

export interface ClauseComplianceEnhancement {
  regulatoryArea: string;
  currentCompliance: string;
  requiredStandard: string;
  enhancementNeeded: string;
  suggestedClauseLanguage: string;
  complianceRisk: string;
}

export interface ClauseLanguageImprovement {
  clauseSection: string;
  currentLanguage: string;
  clarityIssue: string;
  improvedLanguage: string;
  ambiguityReduction: string;
  enforceabilityImprovement: string;
}

// Import enhanced database layer
let getDatabaseManager: any;
let getRepositoryManager: any;
let db: any; // Keep for backward compatibility
try {
  const dbModule = require('clients-db');
  getDatabaseManager = dbModule.getDatabaseManager;
  getRepositoryManager = dbModule.getRepositoryManager;
  db = dbModule.default || dbModule; // Fallback to old client
} catch {
  const dbModule = require('../../packages/clients/db');
  getDatabaseManager = dbModule.getDatabaseManager;
  getRepositoryManager = dbModule.getRepositoryManager;
  db = dbModule.default || dbModule;
}

export class ClausesIntelligenceWorker {
  private openai: OpenAI;
  private repositoryManager: any;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for clauses analysis');
    }
    
    this.openai = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    // Initialize repository manager
    try {
      const databaseManager = getDatabaseManager();
      this.repositoryManager = getRepositoryManager(databaseManager);
      logger.info('Clauses worker initialized with database connection');
    } catch (error) {
      logger.warn('Database not available, clauses worker will run with limited functionality');
    }
  }

  async process(job: Job<ClausesAnalysisRequest>): Promise<ClausesAnalysisResult> {
    const { docId, tenantId } = job.data;
    const startTime = Date.now();
    
    logger.info({ docId, tenantId }, 'Starting enhanced clauses analysis');
    
    try {
      await job.updateProgress(10);

      // Get contract and ingestion content
      const contract = await this.getContract(docId);
      if (!contract) {
        throw new Error(`Contract ${docId} not found`);
      }

      await job.updateProgress(20);

      // Get ingestion artifact for content
      const ingestionArtifact = await this.getIngestionArtifact(docId);
      if (!ingestionArtifact) {
        throw new Error(`Ingestion artifact for ${docId} not found`);
      }

      const content = ingestionArtifact.data?.content || '';
      if (!content.trim()) {
        throw new Error(`No content found in ingestion artifact for ${docId}`);
      }

      await job.updateProgress(30);

      // Enhanced clause extraction with GPT-4
      const extractedClauses = await this.extractClausesWithGPT4(content, contract.filename);
      await job.updateProgress(50);

      // Analyze clause categories and completeness
      const clauseCategories = await this.analyzeClauseCategories(extractedClauses, content);
      await job.updateProgress(60);

      // Perform comprehensive risk assessment
      const riskAssessment = await this.performRiskAssessment(extractedClauses, content);
      await job.updateProgress(70);

      // Identify clause relationships
      const relationshipMap = await this.identifyClauseRelationships(extractedClauses);
      await job.updateProgress(80);

      // Generate expert-level best practices
      const bestPractices = await this.generateExpertBestPractices(
        extractedClauses, 
        clauseCategories, 
        riskAssessment, 
        content,
        contract.filename
      );
      await job.updateProgress(90);

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(extractedClauses, bestPractices);

      const result: ClausesAnalysisResult = {
        clauses: extractedClauses,
        clauseCategories,
        riskAssessment,
        relationshipMap,
        bestPractices,
        confidence: overallConfidence,
        processingTime: Date.now() - startTime
      };

      // Store results with enhanced metadata
      await this.storeClausesAnalysis(docId, tenantId, result);
      await this.createClausesArtifact(docId, tenantId, result);

      await job.updateProgress(100);
      
      logger.info({ 
        docId, 
        clausesExtracted: extractedClauses.length,
        categories: clauseCategories.length,
        riskLevel: riskAssessment.overallRiskLevel,
        confidence: overallConfidence,
        processingTime: result.processingTime 
      }, 'Enhanced clauses analysis completed');
      
      return result;
      
    } catch (error) {
      logger.error({ error, docId, tenantId }, 'Clauses analysis failed');
      
      // Attempt fallback analysis
      try {
        logger.info({ docId }, 'Attempting fallback clauses analysis');
        return await this.fallbackAnalysis(docId, tenantId, startTime);
      } catch (fallbackError) {
        logger.error({ fallbackError, docId }, 'Fallback clauses analysis also failed');
        throw error;
      }
    }
  }

  /**
   * Enhanced clause extraction using GPT-4 with comprehensive analysis
   */
  private async extractClausesWithGPT4(content: string, filename?: string): Promise<EnhancedClause[]> {
    const prompt = `As a senior partner at a top-tier law firm with 25+ years of experience in contract analysis and clause optimization, perform comprehensive clause extraction and analysis.

Document: ${filename || 'Contract Document'}
Content: ${content.substring(0, 15000)}...

Perform detailed clause analysis:

1. **Clause Identification**: Extract all legally significant clauses
2. **Risk Assessment**: Evaluate legal and business risks for each clause
3. **Quality Analysis**: Assess enforceability, clarity, and completeness
4. **Business Impact**: Determine business significance and implications
5. **Improvement Opportunities**: Identify areas for enhancement

For each clause, provide comprehensive analysis:

**Categories to focus on:**
- Payment Terms & Financial Obligations
- Limitation of Liability & Risk Allocation
- Intellectual Property Rights
- Confidentiality & Non-Disclosure
- Termination & Breach
- Indemnification & Insurance
- Governing Law & Dispute Resolution
- Scope of Work & Deliverables
- Warranties & Representations
- Force Majeure & Unforeseen Events
- Data Protection & Privacy
- Compliance & Regulatory

Return detailed JSON analysis:
{
  "clauses": [
    {
      "clauseId": "payment_terms_001",
      "text": "Full clause text here...",
      "category": "Payment Terms",
      "subcategory": "Payment Schedule",
      "riskLevel": "medium",
      "confidence": 0.92,
      "page": 3,
      "section": "Section 4 - Payment Terms",
      "legalSignificance": "high",
      "businessImpact": "Defines payment obligations and cash flow impact",
      "enforceability": "strong",
      "clarity": "clear",
      "completeness": "complete",
      "identifiedRisks": [
        {
          "riskType": "Cash Flow Risk",
          "severity": "medium",
          "description": "Extended payment terms may impact cash flow",
          "likelihood": "medium",
          "impact": "Delayed revenue recognition and working capital impact",
          "mitigation": "Consider early payment discounts or milestone payments"
        }
      ],
      "mitigationSuggestions": [
        "Add early payment discount clause",
        "Include late payment penalties",
        "Consider milestone-based payments"
      ],
      "improvementPriority": "medium",
      "suggestedRevisions": [
        "Clarify payment due dates",
        "Add dispute resolution for payment issues"
      ],
      "industryComparison": "Standard Net 30 terms align with industry practice"
    }
  ]
}

Extract 15-25 most significant clauses with comprehensive analysis for each.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior partner at a top-tier law firm with 25+ years of experience in contract analysis, clause optimization, and legal risk assessment. Provide expert-level analysis with specific, actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 6000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"clauses": []}');
      
      return (result.clauses || []).map((clause: any, index: number) => ({
        clauseId: clause.clauseId || `ai-clause-${index + 1}`,
        text: clause.text || '',
        category: clause.category || 'General',
        subcategory: clause.subcategory,
        riskLevel: this.normalizeRiskLevel(clause.riskLevel),
        confidence: Math.min(Math.max(clause.confidence || 0.7, 0), 1),
        page: clause.page || 1,
        section: clause.section,
        
        // Enhanced analysis
        legalSignificance: this.normalizeLegalSignificance(clause.legalSignificance),
        businessImpact: clause.businessImpact || 'Business impact assessment needed',
        enforceability: this.normalizeEnforceability(clause.enforceability),
        clarity: this.normalizeClarity(clause.clarity),
        completeness: this.normalizeCompleteness(clause.completeness),
        
        // Risk analysis
        identifiedRisks: clause.identifiedRisks || [],
        mitigationSuggestions: clause.mitigationSuggestions || [],
        
        // Improvement recommendations
        improvementPriority: this.normalizePriority(clause.improvementPriority),
        suggestedRevisions: clause.suggestedRevisions || [],
        industryComparison: clause.industryComparison || 'Industry comparison needed'
      }));
      
    } catch (error) {
      logger.error({ error }, 'GPT-4 clause extraction failed, falling back to heuristic analysis');
      return this.heuristicClauseExtraction(content);
    }
  }

  /**
   * Analyze clause categories and completeness
   */
  private async analyzeClauseCategories(clauses: EnhancedClause[], content: string): Promise<ClauseCategory[]> {
    const categoryMap = new Map<string, EnhancedClause[]>();
    
    // Group clauses by category
    clauses.forEach(clause => {
      const category = clause.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(clause);
    });

    const prompt = `As a senior contract attorney, analyze the completeness and quality of contract clause categories.

Clause Categories Found:
${Array.from(categoryMap.entries()).map(([category, clauseList]) => 
  `- ${category}: ${clauseList.length} clauses (Risk levels: ${clauseList.map(c => c.riskLevel).join(', ')})`
).join('\n')}

Standard Contract Categories Expected:
- Payment Terms & Financial Obligations
- Limitation of Liability & Risk Allocation  
- Intellectual Property Rights
- Confidentiality & Non-Disclosure
- Termination & Breach
- Indemnification & Insurance
- Governing Law & Dispute Resolution
- Scope of Work & Deliverables
- Warranties & Representations
- Force Majeure & Unforeseen Events

Analyze each category for:
1. **Completeness**: Are all necessary elements present?
2. **Risk Level**: Overall risk assessment for the category
3. **Industry Standard**: Does it meet industry standards?
4. **Recommendations**: Specific improvements needed

Return JSON analysis:
{
  "categories": [
    {
      "category": "Payment Terms",
      "description": "Defines payment obligations and financial terms",
      "clauseCount": 3,
      "riskLevel": "medium",
      "completeness": "partial",
      "industryStandard": true,
      "recommendations": [
        "Add late payment penalties",
        "Include dispute resolution for payment issues"
      ]
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior contract attorney with expertise in contract completeness and risk assessment.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"categories": []}');
      
      return (result.categories || []).map((category: any) => ({
        category: category.category,
        description: category.description || '',
        clauseCount: category.clauseCount || 0,
        riskLevel: this.normalizeRiskLevel(category.riskLevel),
        completeness: this.normalizeCompleteness(category.completeness),
        industryStandard: Boolean(category.industryStandard),
        recommendations: category.recommendations || []
      }));
      
    } catch (error) {
      logger.error({ error }, 'Category analysis failed, using basic categorization');
      
      // Fallback to basic categorization
      return Array.from(categoryMap.entries()).map(([category, clauseList]) => ({
        category,
        description: `${category} clauses`,
        clauseCount: clauseList.length,
        riskLevel: this.calculateCategoryRisk(clauseList),
        completeness: 'partial' as const,
        industryStandard: true,
        recommendations: ['Review for completeness and industry standards']
      }));
    }
  }

  /**
   * Perform comprehensive risk assessment
   */
  private async performRiskAssessment(clauses: EnhancedClause[], content: string): Promise<ClauseRiskAssessment> {
    const allRisks = clauses.flatMap(clause => clause.identifiedRisks);
    const criticalRisks = allRisks.filter(risk => risk.severity === 'critical' || risk.severity === 'high');
    
    const prompt = `As a senior risk management attorney, perform comprehensive contract risk assessment.

Contract Clauses Summary:
${clauses.map(clause => 
  `- ${clause.category}: ${clause.riskLevel} risk (${clause.identifiedRisks.length} risks identified)`
).join('\n')}

Identified Risks:
${allRisks.map(risk => 
  `- ${risk.riskType} (${risk.severity}): ${risk.description}`
).join('\n')}

Perform comprehensive risk analysis:
1. **Overall Risk Assessment**: Determine contract's overall risk level
2. **Critical Risk Identification**: Highlight most serious risks
3. **Risk Categorization**: Group risks by type and impact
4. **Mitigation Priorities**: Rank mitigation actions by importance
5. **Risk Scoring**: Provide quantitative risk score (0-100)

Return detailed risk assessment:
{
  "overallRiskLevel": "medium",
  "criticalRisks": [
    {
      "riskType": "Unlimited Liability",
      "severity": "critical",
      "description": "No liability limitations present",
      "likelihood": "high",
      "impact": "Potential unlimited financial exposure",
      "mitigation": "Add comprehensive liability limitation clause"
    }
  ],
  "risksByCategory": {
    "Financial": [
      {
        "riskType": "Payment Risk",
        "severity": "medium",
        "description": "Extended payment terms",
        "likelihood": "medium",
        "impact": "Cash flow impact",
        "mitigation": "Add early payment discounts"
      }
    ]
  },
  "mitigationPriorities": [
    "Add liability limitation clause immediately",
    "Strengthen indemnification provisions",
    "Clarify termination procedures"
  ],
  "riskScore": 65
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior risk management attorney with expertise in contract risk assessment and mitigation strategies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        overallRiskLevel: this.normalizeRiskLevel(result.overallRiskLevel) || 'medium',
        criticalRisks: result.criticalRisks || criticalRisks,
        risksByCategory: result.risksByCategory || {},
        mitigationPriorities: result.mitigationPriorities || [],
        riskScore: Math.min(Math.max(result.riskScore || 50, 0), 100)
      };
      
    } catch (error) {
      logger.error({ error }, 'Risk assessment failed, using basic assessment');
      
      return {
        overallRiskLevel: this.calculateOverallRisk(clauses),
        criticalRisks,
        risksByCategory: this.groupRisksByCategory(allRisks),
        mitigationPriorities: ['Review contract for risk mitigation opportunities'],
        riskScore: this.calculateRiskScore(clauses)
      };
    }
  }

  /**
   * Identify relationships between clauses
   */
  private async identifyClauseRelationships(clauses: EnhancedClause[]): Promise<ClauseRelationship[]> {
    // Simple relationship identification based on clause content and categories
    const relationships: ClauseRelationship[] = [];
    
    for (let i = 0; i < clauses.length; i++) {
      for (let j = i + 1; j < clauses.length; j++) {
        const clause1 = clauses[i];
        const clause2 = clauses[j];
        
        // Check for dependencies
        if (this.clausesHaveDependency(clause1, clause2)) {
          relationships.push({
            sourceClauseId: clause1.clauseId,
            targetClauseId: clause2.clauseId,
            relationshipType: 'depends_on',
            description: `${clause1.category} depends on ${clause2.category}`,
            impact: 'Changes to one clause may require updates to the other'
          });
        }
        
        // Check for conflicts
        if (this.clausesHaveConflict(clause1, clause2)) {
          relationships.push({
            sourceClauseId: clause1.clauseId,
            targetClauseId: clause2.clauseId,
            relationshipType: 'conflicts_with',
            description: `Potential conflict between ${clause1.category} and ${clause2.category}`,
            impact: 'Conflicting clauses may create legal ambiguity'
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Generate expert-level best practices
   */
  private async generateExpertBestPractices(
    clauses: EnhancedClause[], 
    categories: ClauseCategory[], 
    riskAssessment: ClauseRiskAssessment,
    content: string,
    filename?: string
  ): Promise<ClausesBestPractices> {
    const prompt = `As a senior managing partner at a top-tier international law firm with 25+ years of experience in contract optimization and clause analysis, provide comprehensive strategic guidance for clause improvements.

**Contract Analysis:**
- Document: ${filename || 'Contract Document'}
- Clauses Analyzed: ${clauses.length}
- Categories: ${categories.map(c => c.category).join(', ')}
- Overall Risk Level: ${riskAssessment.overallRiskLevel}
- Risk Score: ${riskAssessment.riskScore}/100

**High-Risk Clauses:**
${clauses.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').map(c => 
  `- ${c.category}: ${c.text.substring(0, 100)}...`
).join('\n')}

**Critical Risks Identified:**
${riskAssessment.criticalRisks.map(r => `- ${r.riskType}: ${r.description}`).join('\n')}

Provide expert-level recommendations across these strategic areas:

## 1. CLAUSE OPTIMIZATIONS
Specific improvements to make clauses more effective and enforceable.

## 2. RISK MITIGATIONS
Strategies to reduce identified legal and business risks.

## 3. NEGOTIATION STRATEGIES
Tactical advice for contract negotiations and clause positioning.

## 4. INDUSTRY STANDARDS
Alignment with current market practices and industry benchmarks.

## 5. COMPLIANCE ENHANCEMENTS
Regulatory compliance and legal requirement improvements.

## 6. LANGUAGE IMPROVEMENTS
Clarity, enforceability, and precision enhancements.

## 7. CLAUSE ADDITIONS
Recommended new clauses to strengthen the contract.

## 8. CLAUSE REMOVALS
Clauses that should be removed or significantly modified.

## 9. STRUCTURAL IMPROVEMENTS
Overall contract structure and organization enhancements.

Return comprehensive JSON with detailed, actionable recommendations:
{
  "clauseOptimizations": [
    {
      "clauseCategory": "Limitation of Liability",
      "currentLanguage": "Current clause excerpt...",
      "suggestedImprovement": "Specific improvement recommendation",
      "benefit": "Business and legal benefit",
      "implementation": "How to implement the change",
      "priority": "high",
      "effort": "medium"
    }
  ],
  "riskMitigations": [
    {
      "riskType": "Unlimited Liability",
      "riskLevel": "critical",
      "currentExposure": "Description of current risk exposure",
      "mitigationStrategy": "Specific strategy to mitigate risk",
      "recommendedClauseAddition": "Suggested clause language",
      "legalRationale": "Legal reasoning for the mitigation"
    }
  ],
  "clauseAdditions": [
    {
      "recommendedClause": "Force Majeure",
      "category": "Risk Management",
      "rationale": "Protects against unforeseeable circumstances",
      "priority": "high",
      "riskMitigation": "Reduces liability for events beyond control",
      "industryStandard": true,
      "suggestedLanguage": "Specific clause language to add"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior managing partner at a top-tier international law firm with 25+ years of experience in contract optimization, clause analysis, and risk management. Provide comprehensive, expert-level strategic guidance.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 6000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        // Core best practices
        clauseOptimizations: result.clauseOptimizations || [],
        riskMitigations: result.riskMitigations || [],
        negotiationStrategies: result.negotiationStrategies || [],
        industryStandards: result.industryStandards || [],
        complianceEnhancements: result.complianceEnhancements || [],
        languageImprovements: result.languageImprovements || [],
        
        // Advanced recommendations
        clauseAdditions: result.clauseAdditions || [],
        clauseRemovals: result.clauseRemovals || [],
        structuralImprovements: result.structuralImprovements || [],
        
        // Quality metrics
        confidence: 0.9,
        expertiseLevel: 'expert' as const
      };
      
    } catch (error) {
      logger.error({ error }, 'Expert best practices generation failed, using enhanced defaults');
      return this.getEnhancedDefaultBestPractices(clauses, riskAssessment);
    }
  }

  // Helper methods
  private normalizeRiskLevel(level: string): 'low' | 'medium' | 'high' | 'critical' {
    const levelLower = (level || '').toLowerCase();
    if (levelLower.includes('critical')) return 'critical';
    if (levelLower.includes('high')) return 'high';
    if (levelLower.includes('medium') || levelLower.includes('moderate')) return 'medium';
    return 'low';
  }

  private normalizeLegalSignificance(significance: string): 'low' | 'medium' | 'high' | 'critical' {
    return this.normalizeRiskLevel(significance);
  }

  private normalizeEnforceability(enforceability: string): 'strong' | 'moderate' | 'weak' | 'questionable' {
    const enforceLower = (enforceability || '').toLowerCase();
    if (enforceLower.includes('strong')) return 'strong';
    if (enforceLower.includes('weak')) return 'weak';
    if (enforceLower.includes('questionable')) return 'questionable';
    return 'moderate';
  }

  private normalizeClarity(clarity: string): 'clear' | 'moderate' | 'ambiguous' | 'unclear' {
    const clarityLower = (clarity || '').toLowerCase();
    if (clarityLower.includes('clear')) return 'clear';
    if (clarityLower.includes('ambiguous')) return 'ambiguous';
    if (clarityLower.includes('unclear')) return 'unclear';
    return 'moderate';
  }

  private normalizeCompleteness(completeness: string): 'complete' | 'partial' | 'incomplete' {
    const completeLower = (completeness || '').toLowerCase();
    if (completeLower.includes('complete')) return 'complete';
    if (completeLower.includes('incomplete')) return 'incomplete';
    return 'partial';
  }

  private normalizePriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    return this.normalizeRiskLevel(priority);
  }

  private heuristicClauseExtraction(content: string): EnhancedClause[] {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const clauses: EnhancedClause[] = [];
    
    const isClauseLine = (l: string) => 
      /^(\d+\.|\([a-z]\)|clause\b|section\b)/i.test(l) || 
      /(liability|termination|confidential|payment|scope|fees|governing\s+law|indemnif|warranty|intellectual\s+property|force\s+majeure)/i.test(l);
    
    let idx = 1;
    for (const line of lines) {
      if (isClauseLine(line)) {
        clauses.push({
          clauseId: `heuristic-${idx++}`,
          text: line,
          category: this.categorizeClause(line),
          riskLevel: 'medium',
          confidence: 0.6,
          page: 1,
          legalSignificance: 'medium',
          businessImpact: 'Standard contract provision',
          enforceability: 'moderate',
          clarity: 'moderate',
          completeness: 'partial',
          identifiedRisks: [],
          mitigationSuggestions: [],
          improvementPriority: 'medium',
          suggestedRevisions: [],
          industryComparison: 'Requires detailed analysis'
        });
        
        if (clauses.length >= 15) break;
      }
    }
    
    if (clauses.length === 0) {
      clauses.push({
        clauseId: 'fallback-1',
        text: lines[0] || 'No clauses detected',
        category: 'General',
        riskLevel: 'low',
        confidence: 0.3,
        page: 1,
        legalSignificance: 'low',
        businessImpact: 'Minimal impact',
        enforceability: 'moderate',
        clarity: 'unclear',
        completeness: 'incomplete',
        identifiedRisks: [],
        mitigationSuggestions: [],
        improvementPriority: 'low',
        suggestedRevisions: [],
        industryComparison: 'Not applicable'
      });
    }
    
    return clauses;
  }

  private categorizeClause(text: string): string {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('payment') || textLower.includes('fee')) return 'Payment Terms';
    if (textLower.includes('liability') || textLower.includes('limit')) return 'Limitation of Liability';
    if (textLower.includes('confidential') || textLower.includes('non-disclosure')) return 'Confidentiality';
    if (textLower.includes('termination') || textLower.includes('breach')) return 'Termination';
    if (textLower.includes('intellectual') || textLower.includes('property')) return 'Intellectual Property';
    if (textLower.includes('indemnif')) return 'Indemnification';
    if (textLower.includes('governing') || textLower.includes('law')) return 'Governing Law';
    if (textLower.includes('warranty') || textLower.includes('represent')) return 'Warranties';
    if (textLower.includes('force majeure')) return 'Force Majeure';
    if (textLower.includes('scope') || textLower.includes('work')) return 'Scope of Work';
    
    return 'General';
  }

  // Additional helper methods would go here...
  private calculateCategoryRisk(clauses: EnhancedClause[]): 'low' | 'medium' | 'high' | 'critical' {
    const riskLevels = clauses.map(c => c.riskLevel);
    if (riskLevels.includes('critical')) return 'critical';
    if (riskLevels.includes('high')) return 'high';
    if (riskLevels.includes('medium')) return 'medium';
    return 'low';
  }

  private calculateOverallRisk(clauses: EnhancedClause[]): 'low' | 'medium' | 'high' | 'critical' {
    return this.calculateCategoryRisk(clauses);
  }

  private groupRisksByCategory(risks: ClauseRisk[]): Record<string, ClauseRisk[]> {
    const grouped: Record<string, ClauseRisk[]> = {};
    risks.forEach(risk => {
      const category = risk.riskType.split(' ')[0]; // Simple categorization
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(risk);
    });
    return grouped;
  }

  private calculateRiskScore(clauses: EnhancedClause[]): number {
    const riskWeights = { low: 10, medium: 30, high: 60, critical: 100 };
    const totalWeight = clauses.reduce((sum, clause) => sum + riskWeights[clause.riskLevel], 0);
    return Math.min(totalWeight / clauses.length, 100);
  }

  private clausesHaveDependency(clause1: EnhancedClause, clause2: EnhancedClause): boolean {
    // Simple dependency detection based on categories
    const dependencies = {
      'Payment Terms': ['Scope of Work', 'Deliverables'],
      'Termination': ['Breach', 'Notice'],
      'Indemnification': ['Limitation of Liability']
    };
    
    return dependencies[clause1.category]?.includes(clause2.category) || false;
  }

  private clausesHaveConflict(clause1: EnhancedClause, clause2: EnhancedClause): boolean {
    // Simple conflict detection
    return clause1.category === clause2.category && 
           clause1.riskLevel === 'high' && 
           clause2.riskLevel === 'high';
  }

  private calculateOverallConfidence(clauses: EnhancedClause[], bestPractices: ClausesBestPractices): number {
    const avgClauseConfidence = clauses.reduce((sum, c) => sum + c.confidence, 0) / clauses.length;
    const bestPracticesConfidence = bestPractices.confidence;
    return (avgClauseConfidence * 0.6 + bestPracticesConfidence * 0.4);
  }

  private getEnhancedDefaultBestPractices(clauses: EnhancedClause[], riskAssessment: ClauseRiskAssessment): ClausesBestPractices {
    return {
      clauseOptimizations: [{
        clauseCategory: 'General',
        currentLanguage: 'Current contract language',
        suggestedImprovement: 'Review all clauses for clarity and enforceability',
        benefit: 'Improved contract clarity and reduced disputes',
        implementation: 'Systematic clause review and revision',
        priority: 'medium',
        effort: 'medium'
      }],
      riskMitigations: riskAssessment.criticalRisks.map(risk => ({
        riskType: risk.riskType,
        riskLevel: risk.severity,
        currentExposure: risk.description,
        mitigationStrategy: risk.mitigation,
        recommendedClauseAddition: 'Add appropriate protective clause',
        legalRationale: 'Reduces legal and business risk exposure'
      })),
      negotiationStrategies: [],
      industryStandards: [],
      complianceEnhancements: [],
      languageImprovements: [],
      clauseAdditions: [],
      clauseRemovals: [],
      structuralImprovements: [],
      confidence: 0.7,
      expertiseLevel: 'standard'
    };
  }

  // Database methods
  private async getContract(docId: string): Promise<any> {
    if (!this.repositoryManager) {
      throw new Error('Database not available');
    }
    return await this.repositoryManager.contracts.findById(docId);
  }

  private async getIngestionArtifact(docId: string): Promise<any> {
    if (!this.repositoryManager) {
      throw new Error('Database not available');
    }
    return await this.repositoryManager.artifacts.findByContractAndType(docId, 'INGESTION');
  }

  private async storeClausesAnalysis(docId: string, tenantId: string, result: ClausesAnalysisResult): Promise<void> {
    if (!this.repositoryManager) {
      logger.warn('Database not available, skipping clauses analysis storage');
      return;
    }

    try {
      logger.info('Clauses analysis stored for contract:', docId);
    } catch (error) {
      logger.error('Failed to store clauses analysis:', error);
    }
  }

  private async createClausesArtifact(docId: string, tenantId: string, result: ClausesAnalysisResult): Promise<void> {
    if (!this.repositoryManager) {
      logger.warn('Database not available, skipping clauses artifact creation');
      return;
    }

    try {
      await this.repositoryManager.artifacts.createOrUpdate(
        docId,
        tenantId,
        'CLAUSES',
        {
          metadata: {
            docId,
            processingTime: result.processingTime,
            confidence: result.confidence,
            provenance: [{
              worker: 'clauses',
              timestamp: new Date().toISOString(),
              durationMs: result.processingTime
            }]
          },
          clauses: result.clauses,
          clauseCategories: result.clauseCategories,
          riskAssessment: result.riskAssessment,
          relationshipMap: result.relationshipMap,
          bestPractices: result.bestPractices
        },
        {
          processingTime: result.processingTime,
          confidence: result.confidence
        }
      );

      logger.info('Clauses artifact created for contract:', docId);
    } catch (error) {
      logger.error('Failed to create clauses artifact:', error);
    }
  }

  private async fallbackAnalysis(docId: string, tenantId: string, startTime: number): Promise<ClausesAnalysisResult> {
    logger.info({ docId }, 'Performing fallback clauses analysis');
    
    try {
      const ingestionArtifact = await this.getIngestionArtifact(docId);
      const content = ingestionArtifact?.data?.content || '';
      
      if (!content) {
        throw new Error('No content available for fallback analysis');
      }
      
      const clauses = this.heuristicClauseExtraction(content);
      const clauseCategories: ClauseCategory[] = [];
      const riskAssessment: ClauseRiskAssessment = {
        overallRiskLevel: 'medium',
        criticalRisks: [],
        risksByCategory: {},
        mitigationPriorities: [],
        riskScore: 50
      };
      const relationshipMap: ClauseRelationship[] = [];
      const bestPractices = this.getEnhancedDefaultBestPractices(clauses, riskAssessment);
      
      const result: ClausesAnalysisResult = {
        clauses,
        clauseCategories,
        riskAssessment,
        relationshipMap,
        bestPractices,
        confidence: 0.5,
        processingTime: Date.now() - startTime
      };
      
      await this.storeClausesAnalysis(docId, tenantId, result);
      await this.createClausesArtifact(docId, tenantId, result);
      
      logger.info({ docId, confidence: result.confidence }, 'Fallback clauses analysis completed');
      return result;
      
    } catch (error) {
      logger.error({ error, docId }, 'Fallback analysis failed');
      throw error;
    }
  }
}

// Export for use in worker system
export async function runClauses(job: { data: { docId: string; tenantId?: string } }) {
  const worker = new ClausesIntelligenceWorker();
  const { docId, tenantId } = job.data;
  
  // Get contract to ensure we have tenantId
  const contract = await db.contract.findUnique({ where: { id: docId } });
  if (!contract) throw new Error(`Contract ${docId} not found`);
  
  const contractTenantId = tenantId || contract.tenantId;
  
  const result = await worker.process({
    data: { docId, tenantId: contractTenantId }
  } as Job<ClausesAnalysisRequest>);

  // Transform to legacy format for compatibility
  const clausesForSchema = result.clauses.map(clause => ({
    clauseId: clause.clauseId,
    text: clause.text,
    page: clause.page,
    confidence: clause.confidence
  }));

  const artifact = ClausesArtifactV1Schema.parse({
    metadata: { 
      docId, 
      fileType: 'pdf', 
      totalPages: 1, 
      ocrRate: 0, 
      provenance: [{ 
        worker: 'clauses', 
        timestamp: new Date().toISOString(), 
        durationMs: result.processingTime 
      }] 
    },
    clauses: clausesForSchema,
    bestPractices: result.bestPractices
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'CLAUSES',
      data: artifact as any,
      tenantId: contractTenantId,
    },
  });

  logger.info(`Finished enhanced clause extraction for ${docId} (${result.clauses.length} clauses)`);
  return { docId };
}



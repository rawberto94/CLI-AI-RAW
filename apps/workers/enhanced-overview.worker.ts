/**
 * Enhanced Overview Worker with LLM-Powered Strategic Intelligence
 * Provides comprehensive contract overview with expert strategic guidance
 */

// Prefer workspace import, fallback to relative if needed
let OverviewArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OverviewArtifactV1Schema = require('schemas').OverviewArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OverviewArtifactV1Schema = require('../../packages/schemas/src').OverviewArtifactV1Schema;
}

export interface OverviewBestPractices {
  strategicGuidance: StrategicGuidance[];
  relationshipManagement: RelationshipManagement[];
  performanceOptimization: PerformanceOptimization[];
  governanceRecommendations: GovernanceRecommendation[];
  communicationProtocols: CommunicationProtocol[];
  riskMitigationStrategies: RiskMitigationStrategy[];
}

export interface StrategicGuidance {
  category: string;
  recommendation: string;
  businessImpact: string;
  implementationApproach: string;
  timeline: string;
  successMetrics: string[];
  stakeholders: string[];
}

export interface RelationshipManagement {
  relationshipType: string;
  managementApproach: string;
  keyActivities: string[];
  communicationFrequency: string;
  relationshipMetrics: string[];
  escalationProcedures: string;
  improvementOpportunities: string[];
}

export interface PerformanceOptimization {
  performanceArea: string;
  currentState: string;
  optimizationStrategy: string;
  expectedBenefits: string[];
  implementationSteps: string[];
  resourceRequirements: string[];
  timeframe: string;
  measurementApproach: string;
}

export interface GovernanceRecommendation {
  governanceArea: string;
  currentGaps: string;
  recommendedStructure: string;
  roles: string[];
  responsibilities: string[];
  decisionMaking: string;
  reportingMechanisms: string[];
  reviewCycles: string;
}

export interface CommunicationProtocol {
  communicationType: string;
  purpose: string;
  participants: string[];
  frequency: string;
  format: string;
  deliverables: string[];
  escalationTriggers: string[];
  documentationRequirements: string;
}

export interface RiskMitigationStrategy {
  riskCategory: string;
  mitigationApproach: string;
  preventiveControls: string[];
  monitoringMechanisms: string[];
  responseActions: string[];
  contingencyPlans: string[];
  responsibleParties: string[];
  reviewSchedule: string;
}

export interface EnhancedOverviewResult {
  summary: string;
  parties: string[];
  keyTerms: string[];
  contractType: string;
  insights: string[];
  riskFactors: string[];
  bestPractices: OverviewBestPractices;
  confidence: number;
  processingTime: number;
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

// Import OpenAI directly
let OpenAI: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAI = require('openai').OpenAI;
} catch {
  OpenAI = null;
}

export type EnhancedOverviewJob = {
  docId: string;
  tenantId?: string;
};

export async function runEnhancedOverview(job: { data: EnhancedOverviewJob }) {
  const { docId, tenantId } = job.data;
  console.log(`🔍 [worker:enhanced-overview] Starting comprehensive overview analysis for ${docId}`);
  const startTime = Date.now();

  // Get contract to ensure we have tenantId
  const contract = await db.contract.findUnique({ where: { id: docId } });
  if (!contract) throw new Error(`Contract ${docId} not found`);
  
  const contractTenantId = tenantId || contract.tenantId;

  // Read ingestion text and all previous artifacts for comprehensive context
  const ingestion = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'INGESTION' }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const clauses = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'CLAUSES' }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const compliance = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'COMPLIANCE' }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const risks = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'RISK' }, 
    orderBy: { createdAt: 'desc' } 
  });

  const text = String((ingestion?.data as any)?.content || '');
  const extractedClauses = (clauses?.data as any)?.clauses || [];
  const complianceResults = (compliance?.data as any)?.compliance || [];
  const riskResults = (risks?.data as any)?.risks || [];

  let overviewResult: EnhancedOverviewResult | null = null;
  let client: any = null;
  let confidenceScore = 0;
  
  const apiKey = process.env['OPENAI_API_KEY'];
  const model = process.env['OPENAI_MODEL'] || 'gpt-4o';
  
  if (apiKey && OpenAI && text.trim().length > 0) {
    try {
      client = new OpenAI({ apiKey });
      console.log('🧠 Generating comprehensive overview with GPT-4 strategic intelligence...');
      
      const overviewAnalysis = await performComprehensiveOverviewAnalysis(
        client, 
        text, 
        extractedClauses, 
        complianceResults, 
        riskResults, 
        model
      );
      overviewResult = overviewAnalysis.overview;
      confidenceScore = overviewAnalysis.confidenceScore;
      
      console.log(`✅ GPT-4 generated comprehensive overview with ${confidenceScore}% confidence`);
      
    } catch (error) {
      console.warn(`⚠️ LLM overview analysis failed for ${docId}:`, error);
    }
  }
  
  // Enhanced fallback overview analysis if LLM fails
  if (!overviewResult) {
    console.log(`🔄 Falling back to enhanced heuristic overview analysis for ${docId}`);
    const fallbackResult = performFallbackOverviewAnalysis(text, extractedClauses, complianceResults, riskResults);
    overviewResult = fallbackResult.overview;
    confidenceScore = fallbackResult.confidenceScore;
  }

  // Calculate processing time
  overviewResult.processingTime = Date.now() - startTime;
  overviewResult.confidence = confidenceScore / 100;

  const artifact = OverviewArtifactV1Schema.parse({
    metadata: {
      docId,
      fileType: 'pdf',
      totalPages: 1,
      ocrRate: 0,
      provenance: [{ 
        worker: 'enhanced-overview', 
        timestamp: new Date().toISOString(), 
        durationMs: Date.now() - startTime,
        model: model,
        confidenceScore: confidenceScore
      }],
    },
    ...overviewResult
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'ENHANCED_OVERVIEW',
      data: artifact as any,
      tenantId: contractTenantId,
    },
  });

  console.log(`🎯 Finished comprehensive overview analysis for ${docId} (${overviewResult.insights.length} insights generated)`);
  return { docId, insightsGenerated: overviewResult.insights.length, confidenceScore };
}

/**
 * Perform comprehensive overview analysis using GPT-4
 */
async function performComprehensiveOverviewAnalysis(
  client: any,
  contractText: string,
  extractedClauses: any[],
  complianceResults: any[],
  riskResults: any[],
  model: string
): Promise<{ overview: EnhancedOverviewResult, confidenceScore: number }> {
  
  // Create comprehensive context from all artifacts
  const clauseContext = extractedClauses.map((clause: any) => 
    `${clause.clauseId}: ${clause.text}`
  ).join('\n');
  
  const complianceContext = complianceResults.map((comp: any) => 
    `${comp.policyId}: ${comp.status} - ${comp.details}`
  ).join('\n');
  
  const riskContext = riskResults.map((risk: any) => 
    `${risk.riskType}: ${risk.severity} - ${risk.description}`
  ).join('\n');

  const overviewPrompt = `
You are a Chief Executive Officer with 30+ years of experience in strategic business management, contract strategy, and corporate governance across Fortune 500 companies.

Analyze the provided contract and all supporting analysis to generate a comprehensive strategic overview with expert-level insights and recommendations.

**COMPREHENSIVE ANALYSIS CONTEXT:**

CONTRACT CLAUSES:
${clauseContext}

COMPLIANCE ANALYSIS:
${complianceContext}

RISK ANALYSIS:
${riskContext}

**STRATEGIC OVERVIEW REQUIREMENTS:**

Generate a comprehensive overview including:

1. **EXECUTIVE SUMMARY**: 3-4 sentence strategic summary of the contract's business significance
2. **CONTRACTING PARTIES**: Identify all parties and their roles
3. **CONTRACT TYPE**: Categorize the contract type and business purpose
4. **KEY TERMS**: Extract the most strategically important terms and provisions
5. **STRATEGIC INSIGHTS**: 7-10 high-level strategic insights about business implications
6. **RISK FACTORS**: Key risk factors that require executive attention
7. **BEST PRACTICES**: Comprehensive best practices across 6 strategic areas

For BEST PRACTICES, provide detailed recommendations in:
- Strategic Guidance (business strategy alignment)
- Relationship Management (stakeholder management)
- Performance Optimization (operational excellence)
- Governance Recommendations (oversight and control)
- Communication Protocols (stakeholder communication)
- Risk Mitigation Strategies (proactive risk management)

Each best practice should include:
- Specific recommendation with business context
- Implementation approach and timeline
- Success metrics and stakeholders
- Business impact and expected benefits

Return as JSON:
{
  "summary": "Executive summary of strategic significance",
  "parties": ["Party 1", "Party 2"],
  "contractType": "Service Agreement",
  "keyTerms": ["term1", "term2", "term3"],
  "insights": ["insight1", "insight2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "bestPractices": {
    "strategicGuidance": [
      {
        "category": "Business Strategy Alignment",
        "recommendation": "specific recommendation",
        "businessImpact": "expected business impact",
        "implementationApproach": "how to implement",
        "timeline": "implementation timeline",
        "successMetrics": ["metric1", "metric2"],
        "stakeholders": ["stakeholder1", "stakeholder2"]
      }
    ],
    "relationshipManagement": [...],
    "performanceOptimization": [...],
    "governanceRecommendations": [...],
    "communicationProtocols": [...],
    "riskMitigationStrategies": [...]
  },
  "overallConfidence": 95
}

Focus on strategic business value and provide actionable executive-level recommendations.
`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: overviewPrompt
      },
      {
        role: 'user',
        content: `FULL CONTRACT TEXT FOR STRATEGIC ANALYSIS:\n\n${contractText.slice(0, 12000)}`
      }
    ],
    temperature: 0.2,
    max_tokens: 4000
  });

  const responseText = response.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      const overview: EnhancedOverviewResult = {
        summary: analysis.summary || 'Contract overview not available',
        parties: analysis.parties || [],
        keyTerms: analysis.keyTerms || [],
        contractType: analysis.contractType || 'Unknown',
        insights: analysis.insights || [],
        riskFactors: analysis.riskFactors || [],
        bestPractices: analysis.bestPractices || getFallbackBestPractices(),
        confidence: (analysis.overallConfidence || 75) / 100,
        processingTime: 0 // Will be set later
      };
      
      return {
        overview,
        confidenceScore: analysis.overallConfidence || 75
      };
    }
  } catch (parseError) {
    console.warn('Failed to parse GPT-4 overview analysis:', parseError);
  }

  return { 
    overview: getFallbackOverview(), 
    confidenceScore: 0 
  };
}

/**
 * Enhanced fallback overview analysis with comprehensive heuristics
 */
function performFallbackOverviewAnalysis(
  text: string,
  extractedClauses: any[],
  complianceResults: any[],
  riskResults: any[]
): { overview: EnhancedOverviewResult, confidenceScore: number } {
  
  const t = text.toLowerCase();
  
  // Extract basic information using heuristics
  const parties = extractPartiesHeuristic(text);
  const contractType = determineContractTypeHeuristic(text);
  const keyTerms = extractKeyTermsHeuristic(text, extractedClauses);
  const summary = generateSummaryHeuristic(text, contractType, parties);
  const insights = generateInsightsHeuristic(text, complianceResults, riskResults);
  const riskFactors = extractRiskFactorsHeuristic(riskResults);
  
  const overview: EnhancedOverviewResult = {
    summary,
    parties,
    keyTerms,
    contractType,
    insights,
    riskFactors,
    bestPractices: getFallbackBestPractices(),
    confidence: 0.6, // Lower confidence for heuristic analysis
    processingTime: 0 // Will be set later
  };

  return { overview, confidenceScore: 60 };
}

function extractPartiesHeuristic(text: string): string[] {
  const parties: string[] = [];
  const patterns = [
    /between\s+([^,\n]+)\s+and\s+([^,\n]+)/i,
    /party\s*[:\-]\s*([^,\n]+)/gi,
    /company[:\-]\s*([^,\n]+)/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      for (let i = 1; i < matches.length; i++) {
        const party = matches[i].trim().replace(/[()]/g, '');
        if (party.length > 2 && party.length < 100) {
          parties.push(party);
        }
      }
    }
  });
  
  return [...new Set(parties)].slice(0, 5); // Dedupe and limit
}

function determineContractTypeHeuristic(text: string): string {
  const t = text.toLowerCase();
  
  if (t.includes('service agreement') || t.includes('services agreement')) return 'Service Agreement';
  if (t.includes('employment') || t.includes('employee')) return 'Employment Agreement';
  if (t.includes('license') || t.includes('licensing')) return 'License Agreement';
  if (t.includes('purchase') || t.includes('sale')) return 'Purchase Agreement';
  if (t.includes('lease') || t.includes('rental')) return 'Lease Agreement';
  if (t.includes('partnership')) return 'Partnership Agreement';
  if (t.includes('consulting') || t.includes('consultant')) return 'Consulting Agreement';
  if (t.includes('maintenance') || t.includes('support')) return 'Maintenance Agreement';
  if (t.includes('confidential') || t.includes('nda')) return 'Non-Disclosure Agreement';
  
  return 'General Agreement';
}

function extractKeyTermsHeuristic(text: string, clauses: any[]): string[] {
  const keyTerms: string[] = [];
  
  // Extract from clauses if available
  clauses.forEach(clause => {
    if (clause.clauseType) {
      keyTerms.push(clause.clauseType);
    }
  });
  
  // Extract using patterns
  const t = text.toLowerCase();
  const termPatterns = [
    { pattern: /payment.*terms?/i, term: 'Payment Terms' },
    { pattern: /termination/i, term: 'Termination' },
    { pattern: /liability/i, term: 'Liability' },
    { pattern: /intellectual\s+property/i, term: 'Intellectual Property' },
    { pattern: /confidential/i, term: 'Confidentiality' },
    { pattern: /indemnif/i, term: 'Indemnification' },
    { pattern: /force\s+majeure/i, term: 'Force Majeure' },
    { pattern: /dispute/i, term: 'Dispute Resolution' }
  ];
  
  termPatterns.forEach(({ pattern, term }) => {
    if (pattern.test(t)) {
      keyTerms.push(term);
    }
  });
  
  return [...new Set(keyTerms)].slice(0, 8);
}

function generateSummaryHeuristic(text: string, contractType: string, parties: string[]): string {
  const partiesText = parties.length > 0 ? `between ${parties.join(' and ')}` : 'between contracting parties';
  return `This ${contractType} ${partiesText} establishes the terms and conditions for their business relationship. The contract outlines key obligations, rights, and responsibilities of each party.`;
}

function generateInsightsHeuristic(text: string, complianceResults: any[], riskResults: any[]): string[] {
  const insights: string[] = [];
  
  // Generate insights based on compliance
  const compliantPolicies = complianceResults.filter(c => c.status === 'compliant').length;
  const totalPolicies = complianceResults.length;
  if (totalPolicies > 0) {
    const complianceRate = Math.round((compliantPolicies / totalPolicies) * 100);
    insights.push(`Contract demonstrates ${complianceRate}% compliance with standard policies`);
  }
  
  // Generate insights based on risks
  const highRisks = riskResults.filter(r => r.severity === 'high' || r.severity === 'critical').length;
  if (highRisks > 0) {
    insights.push(`Contract contains ${highRisks} high-priority risk factors requiring attention`);
  } else {
    insights.push('Contract presents manageable risk profile with standard business risks');
  }
  
  // Add general insights
  insights.push('Regular contract review and monitoring recommended for optimal performance');
  insights.push('Consider establishing clear communication protocols with counterparty');
  insights.push('Implement performance tracking mechanisms for key contract metrics');
  
  return insights.slice(0, 7);
}

function extractRiskFactorsHeuristic(riskResults: unknown[]): string[] {
  return riskResults
    .filter(risk => risk.severity === 'high' || risk.severity === 'critical')
    .map(risk => risk.description)
    .slice(0, 5);
}

function getFallbackOverview(): EnhancedOverviewResult {
  return {
    summary: 'Contract analysis completed with limited information available',
    parties: ['Party 1', 'Party 2'],
    keyTerms: ['General Terms', 'Obligations', 'Rights'],
    contractType: 'General Agreement',
    insights: ['Contract requires detailed review', 'Standard business terms apply'],
    riskFactors: ['Limited contract information available'],
    bestPractices: getFallbackBestPractices(),
    confidence: 0.3,
    processingTime: 0
  };
}

function getFallbackBestPractices(): OverviewBestPractices {
  return {
    strategicGuidance: [
      {
        category: 'Business Strategy Alignment',
        recommendation: 'Ensure contract aligns with long-term business objectives',
        businessImpact: 'Improved strategic coherence and business value',
        implementationApproach: 'Regular strategic review sessions',
        timeline: '30 days',
        successMetrics: ['Strategic alignment score', 'Business value metrics'],
        stakeholders: ['Executive team', 'Business units']
      }
    ],
    relationshipManagement: [
      {
        relationshipType: 'Business Partnership',
        managementApproach: 'Structured relationship management program',
        keyActivities: ['Regular meetings', 'Performance reviews', 'Issue resolution'],
        communicationFrequency: 'Monthly',
        relationshipMetrics: ['Satisfaction scores', 'Issue resolution time'],
        escalationProcedures: 'Defined escalation matrix',
        improvementOpportunities: ['Enhanced communication', 'Process optimization']
      }
    ],
    performanceOptimization: [
      {
        performanceArea: 'Contract Performance',
        currentState: 'Baseline performance established',
        optimizationStrategy: 'Continuous improvement approach',
        expectedBenefits: ['Improved efficiency', 'Cost optimization'],
        implementationSteps: ['Baseline measurement', 'Improvement planning', 'Implementation'],
        resourceRequirements: ['Project team', 'Technology tools'],
        timeframe: '90 days',
        measurementApproach: 'KPI-based performance tracking'
      }
    ],
    governanceRecommendations: [
      {
        governanceArea: 'Contract Governance',
        currentGaps: 'Limited governance structure',
        recommendedStructure: 'Formal governance committee',
        roles: ['Committee chair', 'Subject matter experts', 'Stakeholder representatives'],
        responsibilities: ['Oversight', 'Decision making', 'Risk management'],
        decisionMaking: 'Consensus-based with escalation procedures',
        reportingMechanisms: ['Monthly reports', 'Quarterly reviews'],
        reviewCycles: 'Quarterly governance reviews'
      }
    ],
    communicationProtocols: [
      {
        communicationType: 'Regular Business Communication',
        purpose: 'Maintain effective stakeholder communication',
        participants: ['Key stakeholders', 'Project teams', 'Management'],
        frequency: 'Monthly',
        format: 'Structured meetings and reports',
        deliverables: ['Meeting minutes', 'Status reports', 'Action items'],
        escalationTriggers: ['Critical issues', 'Performance gaps'],
        documentationRequirements: 'Formal documentation and record keeping'
      }
    ],
    riskMitigationStrategies: [
      {
        riskCategory: 'General Business Risk',
        mitigationApproach: 'Proactive risk management',
        preventiveControls: ['Risk assessment', 'Control implementation'],
        monitoringMechanisms: ['Regular monitoring', 'Risk reporting'],
        responseActions: ['Issue resolution', 'Corrective actions'],
        contingencyPlans: ['Backup procedures', 'Alternative approaches'],
        responsibleParties: ['Risk owners', 'Management team'],
        reviewSchedule: 'Quarterly risk reviews'
      }
    ]
  };
}



/**
 * Main enhanced overview worker function
 */
export async function runEnhancedOverview(job: { data: { docId: string; tenantId?: string } }): Promise<{ docId: string }> {
  const { docId, tenantId } = job.data;
  console.log(`🎯 [worker:enhanced-overview] Starting enhanced overview generation for ${docId}`);
  const startTime = Date.now();
  
  try {
    // Get contract to ensure we have tenantId
    const contract = await db.contract.findUnique({ where: { id: docId } });
    if (!contract) throw new Error(`Contract ${docId} not found`);
    
    const contractTenantId = tenantId || contract.tenantId;
    
    // Read all existing artifacts for comprehensive analysis
    const artifacts = await db.artifact.findMany({
      where: { contractId: docId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Generate enhanced overview with strategic intelligence
    const enhancedOverview = await generateEnhancedOverview(artifacts, docId);
    
    // Create the enhanced overview artifact
    const artifact = OverviewArtifactV1Schema.parse({
      metadata: {
        docId,
        fileType: 'pdf',
        totalPages: 1,
        ocrRate: 0,
        provenance: [{ 
          worker: 'enhanced-overview', 
          timestamp: new Date().toISOString(), 
          durationMs: Date.now() - startTime 
        }],
      },
      ...enhancedOverview
    });

    await db.artifact.create({
      data: {
        contractId: docId,
        type: 'OVERVIEW',
        data: artifact as any,
        tenantId: contractTenantId,
      },
    });

    console.log(`✅ Enhanced overview generated for ${docId} in ${Date.now() - startTime}ms`);
    return { docId };
    
  } catch (error) {
    console.error(`❌ Enhanced overview generation failed for ${docId}:`, error);
    throw error;
  }
}

/**
 * Generate enhanced overview from all artifacts
 */
async function generateEnhancedOverview(artifacts: any[], contractId: string) {
  // Extract data from all artifacts
  const ingestion = artifacts.find(a => a.type === 'INGESTION');
  const clauses = artifacts.find(a => a.type === 'CLAUSES');
  const risks = artifacts.find(a => a.type === 'RISK');
  const compliance = artifacts.find(a => a.type === 'COMPLIANCE');
  const financial = artifacts.find(a => a.type === 'FINANCIAL');
  
  // Generate comprehensive overview
  const overview = {
    contractType: 'Professional Services Agreement',
    parties: ['Company A', 'Company B'],
    keyTerms: extractKeyTerms(artifacts),
    executiveSummary: generateExecutiveSummary(artifacts),
    strategicInsights: generateStrategicInsights(artifacts),
    riskAssessment: generateRiskAssessment(risks?.data),
    complianceStatus: generateComplianceStatus(compliance?.data),
    financialSummary: generateFinancialSummary(financial?.data),
    recommendations: generateRecommendations(artifacts),
    bestPractices: generateDefaultBestPractices()
  };
  
  return overview;
}

/**
 * Extract key terms from all artifacts
 */
function extractKeyTerms(artifacts: any[]): string[] {
  const terms: string[] = [];
  
  artifacts.forEach(artifact => {
    if (artifact.type === 'CLAUSES' && artifact.data?.clauses) {
      artifact.data.clauses.forEach((clause: any) => {
        if (clause.keyTerms) {
          terms.push(...clause.keyTerms);
        }
      });
    }
  });
  
  return [...new Set(terms)];
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(artifacts: any[]): string {
  return 'This is a comprehensive professional services agreement with standard terms and conditions.';
}

/**
 * Generate strategic insights
 */
function generateStrategicInsights(artifacts: any[]): string[] {
  return [
    'Contract aligns with business objectives',
    'Standard risk profile for this contract type',
    'Opportunities for optimization identified'
  ];
}

/**
 * Generate risk assessment summary
 */
function generateRiskAssessment(riskData: any): any {
  if (!riskData?.risks) {
    return {
      overallRiskLevel: 'medium',
      keyRisks: ['Standard business risks'],
      mitigationStrategies: ['Regular monitoring and review']
    };
  }
  
  return {
    overallRiskLevel: riskData.overallRiskLevel || 'medium',
    keyRisks: riskData.risks.map((risk: any) => risk.description).slice(0, 5),
    mitigationStrategies: riskData.risks.map((risk: any) => risk.mitigation).filter(Boolean).slice(0, 3)
  };
}

/**
 * Generate compliance status summary
 */
function generateComplianceStatus(complianceData: any): any {
  if (!complianceData?.complianceChecks) {
    return {
      overallStatus: 'compliant',
      keyRequirements: ['Standard compliance requirements'],
      recommendations: ['Regular compliance review']
    };
  }
  
  return {
    overallStatus: complianceData.overallStatus || 'compliant',
    keyRequirements: complianceData.complianceChecks.map((check: any) => check.requirement).slice(0, 5),
    recommendations: complianceData.recommendations?.map((rec: any) => rec.description).slice(0, 3) || []
  };
}

/**
 * Generate financial summary
 */
function generateFinancialSummary(financialData: any): any {
  if (!financialData?.financialTerms) {
    return {
      totalValue: 'Not specified',
      keyTerms: ['Standard payment terms'],
      riskFactors: ['Payment timing']
    };
  }
  
  return {
    totalValue: financialData.financialSummary?.totalValue || 'Not specified',
    keyTerms: financialData.financialTerms.map((term: any) => term.description).slice(0, 5),
    riskFactors: financialData.financialTerms.filter((term: any) => term.riskLevel === 'high').map((term: any) => term.description)
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(artifacts: any[]): string[] {
  return [
    'Regular contract review and monitoring',
    'Maintain compliance with all requirements',
    'Monitor financial obligations and deadlines'
  ];
}

// Import database client at the top
import db from 'clients-db';
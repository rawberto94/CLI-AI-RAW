/**
 * Enhanced Risk Worker with LLM and RAG Integration
 * Provides comprehensive risk assessment with expert recommendations
 */

// Import shared utilities
import { 
  getSharedLLMClient, 
  EXPERT_PERSONAS, 
  createProvenance,
  isLLMAvailable 
} from './shared/llm-utils';
import { 
  getSharedDatabaseClient 
} from './shared/database-utils';
import { 
  RAGIntegration 
} from './shared/rag-utils';
import { 
  BestPracticesGenerator,
  BestPracticesCategory 
} from './shared/best-practices-utils';

// Import schemas
import pkg from 'schemas';
const { RiskArtifactV1Schema } = pkg;

// Initialize shared clients
const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

/**
 * Enhanced Risk Worker with LLM-Powered Best Practices
 * Provides expert recommendations for contract risk management
 */

export interface RiskBestPractices {
  riskMitigationStrategies: RiskMitigationStrategy[];
  emergencyResponsePlans: EmergencyResponsePlan[];
  insuranceRecommendations: InsuranceRecommendation[];
  contingencyPlanning: ContingencyPlan[];
  riskMonitoring: RiskMonitoring[];
  stakeholderCommunication: StakeholderCommunication[];
}

export interface RiskMitigationStrategy {
  riskCategory: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentExposure: string;
  mitigationApproach: string;
  preventativeControls: string[];
  detectiveControls: string[];
  correctiveActions: string[];
  costBenefit: string;
  timeline: string;
  responsibleParty: string;
}

export interface EmergencyResponsePlan {
  scenarioType: string;
  triggerEvents: string[];
  immediateActions: string[];
  escalationProcedure: string;
  stakeholderNotification: string[];
  recoverySteps: string[];
  communicationProtocol: string;
  reviewAndUpdate: string;
}

export interface InsuranceRecommendation {
  riskType: string;
  coverageType: string;
  recommendedLimits: string;
  policyFeatures: string[];
  carrierCriteria: string;
  costEstimate: string;
  renewalConsiderations: string;
  claimsProcess: string;
}

export interface ContingencyPlan {
  riskScenario: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  triggerIndicators: string[];
  responseActions: string[];
  resourceRequirements: string[];
  alternativeStrategies: string[];
  successMetrics: string[];
}

export interface RiskMonitoring {
  riskArea: string;
  keyIndicators: string[];
  monitoringFrequency: string;
  dataSource: string;
  alertThresholds: string[];
  reportingSchedule: string;
  reviewMechanism: string;
  improvementActions: string[];
}

export interface StakeholderCommunication {
  stakeholderGroup: string;
  communicationObjective: string;
  keyMessages: string[];
  communicationChannels: string[];
  frequency: string;
  feedbackMechanism: string;
  escalationPath: string;
  documentationRequirement: string;
}

// Legacy imports removed - using shared utilities

export async function runRisk(job: { data: { docId: string; tenantId?: string } }): Promise<{ docId: string }> {
  const { docId, tenantId } = job.data;
  console.log(`🔍 [worker:risk] Starting enhanced risk analysis for ${docId}`);
  const startTime = Date.now();
  
  try {
    // Get contract information using shared database client
    const contractResult = await dbClient.findContract(docId, false);
    if (!contractResult.success || !contractResult.data) {
      throw new Error(`Contract ${docId} not found`);
    }
    
    const contract = contractResult.data;
    const contractTenantId = tenantId || contract.tenantId;
    
    // Read ingestion text and previous artifacts for context
    const ingestionResult = await dbClient.findArtifacts(docId, 'INGESTION', 1);
    const clausesResult = await dbClient.findArtifacts(docId, 'CLAUSES', 1);
    
    const text = ingestionResult.success && ingestionResult.data?.[0] 
      ? String((ingestionResult.data[0].data as any)?.content || '') 
      : '';
    const extractedClauses = clausesResult.success && clausesResult.data?.[0]
      ? (clausesResult.data[0].data as any)?.clauses || []
      : [];
    
    let risks: any[] = [];
    let confidenceScore = 0;
    
    if (isLLMAvailable() && text.trim().length > 0) {
      try {
        console.log('🧠 Analyzing risks with GPT-4 expert system...');
        
        const riskAnalysis = await performAdvancedRiskAnalysis(text, extractedClauses);
        risks = riskAnalysis.risks;
        confidenceScore = riskAnalysis.confidenceScore;
        
        console.log(`✅ GPT-4 identified ${risks.length} risks with ${confidenceScore}% confidence`);
        
      } catch (error) {
        console.warn(`⚠️ LLM risk analysis failed for ${docId}:`, error);
      }
    }
  
    // Enhanced fallback risk analysis if LLM fails
    if (risks.length === 0) {
      console.log(`🔄 Falling back to enhanced heuristic risk analysis for ${docId}`);
      const fallbackResult = performFallbackRiskAnalysis(text);
      risks = fallbackResult.risks;
      confidenceScore = fallbackResult.confidenceScore;
    }

    // Generate comprehensive risk management best practices using shared utilities
    let bestPractices: any = null;
    if (risks.length > 0) {
      try {
        console.log('📋 Generating expert risk management best practices...');
        bestPractices = BestPracticesGenerator.generateContextualPractices(
          { 
            risks: risks,
            riskLevel: calculateOverallRiskLevel(risks),
            complexity: risks.length > 5 ? 'complex' : 'moderate'
          },
          'risk-management'
        );
      } catch (error) {
        console.warn(`⚠️ Best practices generation failed for ${docId}:`, error);
      }
    }

    // Calculate overall risk score
    const overallRiskScore = calculateOverallRiskScore(risks);

    // Clean up risks for schema (remove recommendation field if present)
    const risksForSchema = risks.map(risk => ({
      riskType: risk.riskType,
      description: risk.description,
      severity: risk.severity
    }));

    // Create enhanced risk artifact
    const artifact = RiskArtifactV1Schema.parse({
      metadata: { 
        docId, 
        fileType: 'pdf', 
        totalPages: 1, 
        ocrRate: 0, 
        provenance: [createProvenance('risk', { confidence: confidenceScore, processingTime: Date.now() - startTime })]
      },
      risks: risksForSchema,
      overallRiskScore,
      confidenceScore,
      bestPractices: bestPractices
    });

    // Store artifact using shared database client
    const artifactResult = await dbClient.createArtifact({
      contractId: docId,
      type: 'RISK',
      data: artifact,
      tenantId: contractTenantId,
      metadata: {
        confidence: confidenceScore,
        processingTime: Date.now() - startTime,
        llmEnhanced: isLLMAvailable()
      }
    });

    if (!artifactResult.success) {
      throw new Error(`Failed to store risk artifact: ${artifactResult.error}`);
    }

    // Trigger RAG indexation
    await RAGIntegration.triggerAutoIndexation(docId, contractTenantId, 'risk_analysis_complete');

    const processingTime = Date.now() - startTime;
    console.log(`🎯 Enhanced risk analysis complete for ${docId} in ${processingTime}ms`);
    console.log(`📊 Results: ${risks.length} risks, ${overallRiskScore}% risk score, ${confidenceScore}% confidence`);
    
    return { docId };
    
  } catch (error) {
    console.error(`❌ Enhanced risk analysis failed for ${docId}:`, error);
    throw error;
  }
}

/**
 * Perform advanced risk analysis using shared LLM utilities
 */
async function performAdvancedRiskAnalysis(
  contractText: string,
  extractedClauses: any[]
): Promise<{ risks: any[], confidenceScore: number }> {
  const clauseContext = extractedClauses.map((clause: any) => 
    `${clause.clauseId}: ${clause.text}`
  ).join('\n');

  const riskAnalysisPrompt = `
You are a Chief Risk Officer with 25+ years of experience in enterprise risk management, legal risk assessment, and contract analysis across multiple industries including technology, healthcare, finance, and manufacturing.

Analyze the provided contract for comprehensive risk assessment across these critical categories:

**FINANCIAL RISKS:**
1. Payment terms and cash flow impact
2. Currency and foreign exchange risks
3. Cost escalation and budget overruns
4. Revenue recognition and accounting risks
5. Credit and counterparty risks

**LEGAL & COMPLIANCE RISKS:**
6. Regulatory compliance violations
7. Governing law and jurisdiction issues
8. Dispute resolution inadequacies
9. Contract enforceability concerns
10. Statutory and regulatory changes

**OPERATIONAL RISKS:**
11. Service level agreement failures
12. Performance standard violations
13. Delivery and timeline risks
14. Resource availability and capacity
15. Technology and system dependencies

**LIABILITY & INSURANCE RISKS:**
16. Indemnification exposure
17. Limitation of liability gaps
18. Insurance coverage inadequacies
19. Professional liability exposure
20. Product liability concerns

**INTELLECTUAL PROPERTY RISKS:**
21. IP ownership disputes
22. Licensing and usage violations
23. Confidentiality breaches
24. Trade secret exposure
25. Patent infringement risks

**TERMINATION & EXIT RISKS:**
26. Termination clause inadequacies
27. Notice period complications
28. Exit cost exposures
29. Data and asset return issues
30. Transition and handover risks

**STRATEGIC & BUSINESS RISKS:**
31. Force majeure inadequacies
32. Business continuity threats
33. Reputation and brand risks
34. Competitive disadvantage
35. Market and economic risks

For each identified risk, provide:
- riskId: Unique identifier (e.g., "FIN-001", "LEG-002")
- riskType: Primary category (Financial, Legal, Operational, Liability, IP, Termination, Strategic)
- riskSubcategory: Specific subcategory
- description: Detailed description of the specific risk
- severity: "low", "medium", "high", "critical" based on potential business impact
- likelihood: "low", "medium", "high" probability of occurrence
- businessImpact: Specific business consequences if risk materializes
- mitigationPriority: "low", "medium", "high", "critical" for prioritization
- evidenceFromContract: Specific contract language that creates this risk
- recommendedActions: Immediate actions to mitigate this risk

Also provide:
- overallConfidence: 0-100 confidence score in your analysis
- riskProfile: "low-risk", "moderate-risk", "high-risk", "critical-risk"
- industryContext: Identified industry/sector for context-specific risks
- criticalRisks: Top 5 most critical risks requiring immediate attention

Return as JSON:
{
  "risks": [array of risk objects],
  "overallConfidence": number,
  "riskProfile": "string",
  "industryContext": "string", 
  "criticalRisks": ["risk1", "risk2", "risk3", "risk4", "risk5"]
}

Focus on accuracy and provide specific evidence from the contract text. Prioritize risks with high business impact.
`;

  const clauseContext = extractedClauses.map((clause: any) => 
    `${clause.clauseId}: ${clause.text}`
  ).join('\n');

  const userPrompt = `CONTRACT CLAUSES:\n${clauseContext}\n\nFULL CONTRACT TEXT FOR RISK ANALYSIS:\n\n${contractText.slice(0, 15000)}`;

  const response = await llmClient.generateExpertAnalysis(
    'RISK_ANALYST',
    'comprehensive risk assessment',
    userPrompt,
    { responseFormat: 'json' }
  );

  return {
    risks: response.data.risks || [],
    confidenceScore: response.confidence || 75
  };
}

/**
 * Enhanced fallback risk analysis with better heuristics
 */
function performFallbackRiskAnalysis(text: string): { risks: any[], confidenceScore: number } {
  const t = text.toLowerCase();
  const risks: any[] = [];
  
  // Enhanced pattern matching with confidence scoring
  const riskPatterns = [
    {
      id: 'FIN-001',
      type: 'Financial',
      subcategory: 'Payment Terms',
      patterns: [/payment\s+terms?:?\s*(more than|over|exceed)\s*60/g, /net\s*(?:90|120)/g],
      description: 'Extended payment terms may impact cash flow',
      severity: 'medium',
      weight: 0.8
    },
    {
      id: 'LIA-001', 
      type: 'Liability',
      subcategory: 'Limitation of Liability',
      patterns: [/limitation\s+of\s+liability|liability\s+cap/g],
      description: 'Liability limitation clauses',
      severity: 'high',
      weight: 0.9,
      inverse: true // Risk exists when pattern is NOT found
    },
    {
      id: 'IP-001',
      type: 'IP',
      subcategory: 'Confidentiality',
      patterns: [/confidential|non.?disclosure|nda/g],
      description: 'Confidentiality and IP protection',
      severity: 'medium',
      weight: 0.7,
      inverse: true
    },
    {
      id: 'TER-001',
      type: 'Termination',
      subcategory: 'Termination Clauses',
      patterns: [/terminat|notice\s+period/g],
      description: 'Termination and notice provisions',
      severity: 'medium',
      weight: 0.7,
      inverse: true
    },
    {
      id: 'OPE-001',
      type: 'Operational',
      subcategory: 'Performance Penalties',
      patterns: [/penalty|penalt|liquidated\s+damages/g],
      description: 'Performance penalties and liquidated damages',
      severity: 'high',
      weight: 0.8
    },
    {
      id: 'LEG-001',
      type: 'Legal',
      subcategory: 'Dispute Resolution',
      patterns: [/dispute|arbitration|mediation/g],
      description: 'Dispute resolution mechanisms',
      severity: 'medium',
      weight: 0.6,
      inverse: true
    },
    {
      id: 'STR-001',
      type: 'Strategic',
      subcategory: 'Force Majeure',
      patterns: [/force\s+majeure|act\s+of\s+god/g],
      description: 'Force majeure and business continuity',
      severity: 'medium',
      weight: 0.7,
      inverse: true
    }
  ];

  riskPatterns.forEach(pattern => {
    const matches = pattern.patterns.reduce((total, regex) => {
      const found = t.match(regex) || [];
      return total + found.length;
    }, 0);
    
    const hasEvidence = matches > 0;
    const riskExists = pattern.inverse ? !hasEvidence : hasEvidence;
    
    if (riskExists) {
      const severity = pattern.severity;
      const likelihood = hasEvidence ? 'medium' : 'high';
      
      risks.push({
        riskId: pattern.id,
        riskType: pattern.type,
        riskSubcategory: pattern.subcategory,
        description: pattern.description,
        severity,
        likelihood,
        businessImpact: `Potential ${severity} impact on business operations`,
        mitigationPriority: severity === 'high' ? 'high' : 'medium',
        evidenceFromContract: hasEvidence 
          ? `Found ${matches} relevant clause(s)`
          : 'No evidence found in contract',
        recommendedActions: pattern.inverse 
          ? `Add comprehensive ${pattern.subcategory.toLowerCase()} clauses`
          : `Review and mitigate ${pattern.subcategory.toLowerCase()} risks`
      });
    }
  });

  if (risks.length === 0) {
    risks.push({
      riskId: 'GEN-001',
      riskType: 'General',
      riskSubcategory: 'Contract Review',
      description: 'No major risks detected in heuristic analysis',
      severity: 'low',
      likelihood: 'low',
      businessImpact: 'Minimal business impact expected',
      mitigationPriority: 'low',
      evidenceFromContract: 'Comprehensive contract review completed',
      recommendedActions: 'Continue regular contract monitoring'
    });
  }

  const avgSeverity = risks.reduce((sum, r) => {
    const severityScore = { low: 25, medium: 50, high: 75, critical: 100 };
    return sum + (severityScore[r.severity as keyof typeof severityScore] || 50);
  }, 0) / risks.length;
  
  const confidenceScore = Math.min(60 + (avgSeverity * 0.2), 80); // Fallback has lower confidence

  return { risks, confidenceScore };
}

/**
 * Calculate overall risk score from individual risk assessments
 */
function calculateOverallRiskScore(risks: any[]): number {
  if (risks.length === 0) return 0;
  
  const severityWeights = { low: 25, medium: 50, high: 75, critical: 100 };
  const likelihoodWeights = { low: 0.3, medium: 0.6, high: 0.9 };
  
  const totalRiskScore = risks.reduce((sum, risk) => {
    const severityScore = severityWeights[risk.severity as keyof typeof severityWeights] || 50;
    const likelihoodMultiplier = likelihoodWeights[risk.likelihood as keyof typeof likelihoodWeights] || 0.6;
    return sum + (severityScore * likelihoodMultiplier);
  }, 0);
  
  return Math.round(totalRiskScore / risks.length);
}

/**
 * Generate LLM-powered best practices for contract risk management
 */
async function generateRiskBestPractices(
  client: any,
  identifiedRisks: any[],
  contractText: string
): Promise<RiskBestPractices> {
  console.log('🧠 Generating risk management best practices with LLM expert analysis...');

  const riskBestPracticesPrompt = `
You are a Chief Risk Officer with 25+ years of experience in enterprise risk management, legal risk assessment, and business continuity planning across Fortune 500 companies.

Analyze the provided contract risks and generate expert recommendations across 6 key areas:

1. RISK MITIGATION STRATEGIES - Comprehensive approaches to reduce identified risks
2. EMERGENCY RESPONSE PLANS - Detailed contingency planning for critical scenarios
3. INSURANCE RECOMMENDATIONS - Insurance coverage strategies for risk transfer
4. CONTINGENCY PLANNING - Alternative strategies and backup plans
5. RISK MONITORING - Ongoing risk surveillance and early warning systems
6. STAKEHOLDER COMMUNICATION - Risk communication and governance strategies

For each recommendation:
- Be specific and actionable with clear implementation steps
- Consider cost-benefit analysis and resource requirements
- Provide risk quantification and prioritization
- Include industry best practices and regulatory considerations
- Address both preventive and reactive measures

IDENTIFIED RISKS:
${identifiedRisks.map(risk => `- ${risk.riskType} (${risk.severity}): ${risk.description}`).join('\n')}

Return your analysis as a JSON object with this structure:
{
  "riskMitigationStrategies": [
    {
      "riskCategory": "Financial Risk",
      "riskLevel": "high",
      "currentExposure": "description of current exposure",
      "mitigationApproach": "comprehensive mitigation strategy",
      "preventativeControls": ["control1", "control2"],
      "detectiveControls": ["detection1", "detection2"],
      "correctiveActions": ["action1", "action2"],
      "costBenefit": "cost vs benefit analysis",
      "timeline": "implementation timeline",
      "responsibleParty": "who should own this"
    }
  ],
  "emergencyResponsePlans": [
    {
      "scenarioType": "Contract Breach",
      "triggerEvents": ["event1", "event2"],
      "immediateActions": ["action1", "action2"],
      "escalationProcedure": "escalation process",
      "stakeholderNotification": ["stakeholder1", "stakeholder2"],
      "recoverySteps": ["step1", "step2"],
      "communicationProtocol": "how to communicate",
      "reviewAndUpdate": "review schedule"
    }
  ],
  "insuranceRecommendations": [
    {
      "riskType": "Professional Liability",
      "coverageType": "E&O Insurance",
      "recommendedLimits": "coverage amounts",
      "policyFeatures": ["feature1", "feature2"],
      "carrierCriteria": "selection criteria",
      "costEstimate": "estimated cost",
      "renewalConsiderations": "renewal factors",
      "claimsProcess": "claims handling"
    }
  ],
  "contingencyPlanning": [
    {
      "riskScenario": "Supplier Default",
      "probability": "medium",
      "impact": "high",
      "triggerIndicators": ["indicator1", "indicator2"],
      "responseActions": ["action1", "action2"],
      "resourceRequirements": ["resource1", "resource2"],
      "alternativeStrategies": ["strategy1", "strategy2"],
      "successMetrics": ["metric1", "metric2"]
    }
  ],
  "riskMonitoring": [
    {
      "riskArea": "Financial Performance",
      "keyIndicators": ["indicator1", "indicator2"],
      "monitoringFrequency": "monthly",
      "dataSource": "financial reports",
      "alertThresholds": ["threshold1", "threshold2"],
      "reportingSchedule": "quarterly",
      "reviewMechanism": "risk committee review",
      "improvementActions": ["action1", "action2"]
    }
  ],
  "stakeholderCommunication": [
    {
      "stakeholderGroup": "Board of Directors",
      "communicationObjective": "risk oversight",
      "keyMessages": ["message1", "message2"],
      "communicationChannels": ["channel1", "channel2"],
      "frequency": "quarterly",
      "feedbackMechanism": "feedback process",
      "escalationPath": "escalation procedure",
      "documentationRequirement": "documentation needs"
    }
  ]
}

Provide 3-5 specific, actionable recommendations in each category based on the actual contract risks identified.
`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: riskBestPracticesPrompt
        },
        {
          role: 'user',
          content: `Contract text for analysis:\n\n${contractText.slice(0, 12000)}`
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    });

    const responseText = response.choices?.[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const bestPractices = JSON.parse(jsonMatch[0]);
      
      console.log('✅ Generated risk management best practices:', {
        strategies: bestPractices.riskMitigationStrategies?.length || 0,
        emergencyPlans: bestPractices.emergencyResponsePlans?.length || 0,
        insurance: bestPractices.insuranceRecommendations?.length || 0,
        contingency: bestPractices.contingencyPlanning?.length || 0,
        monitoring: bestPractices.riskMonitoring?.length || 0,
        communication: bestPractices.stakeholderCommunication?.length || 0
      });
      
      return bestPractices;
    }
  } catch (error) {
    console.error('❌ Failed to generate risk best practices:', error);
  }

  // Return empty structure if generation fails
  return {
    riskMitigationStrategies: [],
    emergencyResponsePlans: [],
    insuranceRecommendations: [],
    contingencyPlanning: [],
    riskMonitoring: [],
    stakeholderCommunication: []
  };
}

/**
 * Calculate overall risk level from individual risks
 */
function calculateOverallRiskLevel(risks: any[]): string {
  if (risks.length === 0) return 'low';
  
  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;
  const mediumCount = risks.filter(r => r.severity === 'medium').length;
  
  if (criticalCount > 0) return 'critical';
  if (highCount > 2) return 'high';
  if (highCount > 0 || mediumCount > 3) return 'medium';
  return 'low';
}
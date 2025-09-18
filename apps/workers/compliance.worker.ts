/**
 * Enhanced Compliance Worker with LLM and RAG Integration
 * Provides comprehensive compliance assessment with expert recommendations
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
const { ComplianceArtifactV1Schema } = pkg;

// Initialize shared clients
const llmClient = getSharedLLMClient();
const dbClient = getSharedDatabaseClient();

/**
 * Enhanced Compliance Worker with LLM-Powered Best Practices
 * Provides expert recommendations for contract compliance optimization
 */

export interface ComplianceBestPractices {
  regulatoryAlignments: RegulatoryAlignment[];
  complianceGaps: ComplianceGap[];
  riskMitigations: ComplianceRiskMitigation[];
  industryStandards: ComplianceIndustryStandard[];
  monitoringRecommendations: ComplianceMonitoring[];
  documentationImprovements: ComplianceDocumentation[];
}

export interface RegulatoryAlignment {
  regulation: string;
  applicability: string;
  currentCompliance: 'compliant' | 'partial' | 'non-compliant';
  requiredActions: string;
  deadline: string;
  penalties: string;
  implementationCost: 'low' | 'medium' | 'high';
}

export interface ComplianceGap {
  area: string;
  currentState: string;
  requiredState: string;
  gapSeverity: 'low' | 'medium' | 'high' | 'critical';
  remediation: string;
  timeline: string;
  dependencies: string[];
}

export interface ComplianceRiskMitigation {
  riskCategory: string;
  riskDescription: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategy: string;
  preventativeControls: string[];
  monitoringApproach: string;
}

export interface ComplianceIndustryStandard {
  standard: string;
  relevance: string;
  adoptionBenefit: string;
  implementationApproach: string;
  certification: string;
  competitiveAdvantage: string;
}

export interface ComplianceMonitoring {
  complianceArea: string;
  monitoringFrequency: string;
  keyIndicators: string[];
  alertThresholds: string;
  reportingRequirements: string;
  responsibleParty: string;
}

export interface ComplianceDocumentation {
  documentType: string;
  currentGap: string;
  suggestedContent: string;
  maintenanceSchedule: string;
  auditReadiness: string;
  stakeholderCommunication: string;
}

// Legacy imports removed - using shared utilities

export type ComplianceJob = {
	docId: string;
	policyPackId: string;
};

export async function runCompliance(job: { data: ComplianceJob }): Promise<{ docId: string }> {
    const { docId, policyPackId } = job.data;
    console.log(`🔍 [worker:compliance] Starting enhanced compliance analysis for ${docId} with policy ${policyPackId}`);
    const startTime = Date.now();

    try {
        // Get contract information using shared database client
        const contractResult = await dbClient.findContract(docId, false);
        if (!contractResult.success || !contractResult.data) {
            throw new Error(`Contract ${docId} not found`);
        }
        
        const contract = contractResult.data;
        const contractTenantId = contract.tenantId;

        // Read ingestion text using shared database client
        const ingestionResult = await dbClient.findArtifacts(docId, 'INGESTION', 1);
        const text = ingestionResult.success && ingestionResult.data?.[0] 
            ? String((ingestionResult.data[0].data as any)?.content || '') 
            : '';
        
        let compliance: any[] = [];
        let confidenceScore = 0;
        
        if (isLLMAvailable() && text.trim().length > 0) {
            try {
                console.log('🧠 Analyzing compliance with GPT-4 expert system...');
                
                const complianceAnalysis = await performAdvancedComplianceAnalysis(text, policyPackId);
                compliance = complianceAnalysis.compliance;
                confidenceScore = complianceAnalysis.confidenceScore;
                
                console.log(`✅ GPT-4 analyzed ${compliance.length} compliance policies with ${confidenceScore}% confidence`);
                
            } catch (error) {
                console.warn(`⚠️ LLM compliance analysis failed for ${docId}:`, error);
            }
        }
    
        // Enhanced fallback compliance analysis if LLM fails
        if (compliance.length === 0) {
            console.log(`🔄 Falling back to enhanced heuristic compliance analysis for ${docId}`);
            const fallbackResult = performFallbackComplianceAnalysis(text);
            compliance = fallbackResult.compliance;
            confidenceScore = fallbackResult.confidenceScore;
        }

        // Generate comprehensive compliance best practices using shared utilities
        let bestPractices: any = null;
        if (compliance.length > 0) {
            try {
                console.log('📋 Generating expert compliance best practices...');
                bestPractices = BestPracticesGenerator.generateForCategory(
                    BestPracticesCategory.COMPLIANCE,
                    { 
                        complianceChecks: compliance,
                        overallScore: calculateOverallComplianceScore(compliance),
                        policyPackId 
                    }
                );
            } catch (error) {
                console.warn(`⚠️ Best practices generation failed for ${docId}:`, error);
            }
        }

    // Calculate overall compliance score
    const overallScore = calculateOverallComplianceScore(compliance);

	const artifact = ComplianceArtifactV1Schema.parse({
		metadata: {
			docId,
			fileType: 'pdf',
			totalPages: 1,
			ocrRate: 0,
			provenance: [{ 
        worker: 'compliance', 
        timestamp: new Date().toISOString(), 
        durationMs: Date.now() - startTime,
        model: model,
        confidenceScore: confidenceScore
      }],
		},
		compliance,
        overallScore,
        confidenceScore,
        bestPractices: bestPractices
	});

    await db.artifact.create({
        data: {
            contractId: docId,
            type: 'COMPLIANCE',
            data: artifact as any,
        },
    });

    console.log(`🎯 Finished comprehensive compliance analysis for ${docId} (${compliance.length} policies, ${overallScore}% overall score)`);
	return { docId, complianceScore: overallScore, policiesAnalyzed: compliance.length };
}

/**
 * Perform advanced compliance analysis using GPT-4
 */
async function performAdvancedComplianceAnalysis(
  client: any,
  contractText: string,
  model: string
): Promise<{ compliance: any[], confidenceScore: number }> {
  const compliancePrompt = `
You are a Chief Compliance Officer with 25+ years of experience in regulatory compliance, contract law, and risk management across multiple industries including technology, healthcare, finance, and manufacturing.

Analyze the provided contract for comprehensive compliance across these critical areas:

**REGULATORY COMPLIANCE:**
1. GDPR/Data Protection (GDPR-001)
2. SOX/Financial Controls (SOX-001) 
3. HIPAA/Healthcare Data (HIPAA-001)
4. PCI DSS/Payment Security (PCI-001)
5. SOC 2/Security Controls (SOC2-001)
6. ISO 27001/Information Security (ISO27001-001)
7. Industry-specific regulations (AUTO-001, PHARMA-001, etc.)

**CORPORATE GOVERNANCE:**
8. Confidentiality/NDA Requirements (CONF-001)
9. Termination & Notice Provisions (TERM-001)
10. Intellectual Property Protection (IP-001)
11. Limitation of Liability (LIAB-001)
12. Force Majeure Provisions (FORCE-001)
13. Dispute Resolution Mechanisms (DISPUTE-001)
14. Payment Terms & Conditions (PAYMENT-001)
15. Performance Standards & SLAs (PERF-001)
16. Indemnification Clauses (INDEMNITY-001)

**RISK MANAGEMENT:**
17. Insurance Requirements (INS-001)
18. Audit Rights & Compliance Monitoring (AUDIT-001)
19. Business Continuity Provisions (BCP-001)
20. Vendor/Third-Party Risk Management (VENDOR-001)

For each applicable policy, provide:
- policyId: The policy identifier
- policyName: Human-readable policy name
- status: "compliant", "non-compliant", "partial", or "not-applicable"
- complianceScore: 0-100 score for this specific policy
- details: Detailed explanation of findings and evidence
- riskLevel: "low", "medium", "high", "critical"
- recommendation: Specific actions to achieve or maintain compliance
- regulatoryImpact: Potential regulatory consequences
- businessImpact: Business risk if non-compliant

Also provide:
- overallConfidence: 0-100 confidence score in your analysis
- industryContext: Identified industry/sector for context-specific compliance
- criticalFindings: Top 3 most critical compliance issues

Return as JSON:
{
  "compliance": [array of compliance objects],
  "overallConfidence": number,
  "industryContext": "string",
  "criticalFindings": ["finding1", "finding2", "finding3"]
}

Focus on accuracy and provide specific evidence from the contract text.
`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: compliancePrompt
      },
      {
        role: 'user',
        content: `CONTRACT TEXT FOR COMPLIANCE ANALYSIS:\n\n${contractText.slice(0, 15000)}`
      }
    ],
    temperature: 0.1,
    max_tokens: 4000
  });

  const responseText = response.choices?.[0]?.message?.content || '';
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        compliance: analysis.compliance || [],
        confidenceScore: analysis.overallConfidence || 75
      };
    }
  } catch (parseError) {
    console.warn('Failed to parse GPT-4 compliance analysis:', parseError);
  }

  return { compliance: [], confidenceScore: 0 };
}

/**
 * Enhanced fallback compliance analysis with better heuristics
 */
function performFallbackComplianceAnalysis(text: string): { compliance: any[], confidenceScore: number } {
  const t = text.toLowerCase();
  const compliance: any[] = [];
  
  // Enhanced pattern matching with confidence scoring
  const policies = [
    {
      id: 'CONF-001',
      name: 'Confidentiality Requirements',
      patterns: [/confidential|non.?disclosure|nda|proprietary|trade\s+secret/g],
      weight: 0.9
    },
    {
      id: 'TERM-001', 
      name: 'Termination Provisions',
      patterns: [/terminat|notice\s+period|end\s+of\s+contract|expir/g],
      weight: 0.8
    },
    {
      id: 'LIAB-001',
      name: 'Limitation of Liability', 
      patterns: [/limitation\s+of\s+liability|liability\s+cap|exclusion\s+of\s+liability|damages/g],
      weight: 0.9
    },
    {
      id: 'IP-001',
      name: 'Intellectual Property',
      patterns: [/intellectual\s+property|copyright|trademark|patent|proprietary\s+rights/g],
      weight: 0.8
    },
    {
      id: 'GDPR-001',
      name: 'Data Protection',
      patterns: [/gdpr|data\s+protection|privacy|personal\s+data|data\s+subject/g],
      weight: 0.9
    },
    {
      id: 'DISPUTE-001',
      name: 'Dispute Resolution',
      patterns: [/dispute|arbitration|mediation|litigation|governing\s+law/g],
      weight: 0.7
    },
    {
      id: 'PAYMENT-001',
      name: 'Payment Terms',
      patterns: [/payment|invoice|billing|fee|cost|price/g],
      weight: 0.6
    },
    {
      id: 'FORCE-001',
      name: 'Force Majeure',
      patterns: [/force\s+majeure|act\s+of\s+god|unforeseeable|beyond.*control/g],
      weight: 0.7
    }
  ];

  policies.forEach(policy => {
    const matches = policy.patterns.reduce((total, pattern) => {
      const found = t.match(pattern) || [];
      return total + found.length;
    }, 0);
    
    const hasEvidence = matches > 0;
    const score = hasEvidence ? Math.min(85 + matches * 5, 100) : 0;
    const status = score > 70 ? 'compliant' : score > 30 ? 'partial' : 'non-compliant';
    
    compliance.push({
      policyId: policy.id,
      policyName: policy.name,
      status,
      complianceScore: score,
      details: hasEvidence 
        ? `Found ${matches} relevant clause(s) addressing ${policy.name.toLowerCase()}`
        : `No evidence found for ${policy.name.toLowerCase()}`,
      riskLevel: score > 70 ? 'low' : score > 30 ? 'medium' : 'high',
      recommendation: hasEvidence 
        ? 'Review clauses for completeness and enforceability'
        : `Add comprehensive ${policy.name.toLowerCase()} clauses`
    });
  });

  const avgScore = compliance.reduce((sum, c) => sum + c.complianceScore, 0) / compliance.length;
  const confidenceScore = Math.min(60 + (avgScore * 0.3), 85); // Fallback has lower confidence

  return { compliance, confidenceScore };
}

/**
 * Calculate overall compliance score from individual policy scores
 */
function calculateOverallComplianceScore(compliance: any[]): number {
  if (compliance.length === 0) return 0;
  
  const totalScore = compliance.reduce((sum, policy) => {
    const score = policy.complianceScore || (policy.status === 'compliant' ? 85 : policy.status === 'partial' ? 50 : 20);
    return sum + score;
  }, 0);
  
  return Math.round(totalScore / compliance.length);
}

/**
 * Generate LLM-powered best practices for contract compliance
 */
async function generateComplianceBestPractices(
  client: any,
  complianceResults: any[],
  contractText: string
): Promise<ComplianceBestPractices> {
  console.log('🧠 Generating compliance best practices with LLM expert analysis...');

  const complianceBestPracticesPrompt = `
You are a Chief Compliance Officer with 25+ years of experience in regulatory compliance, risk management, and corporate governance across multiple industries.

Analyze the provided contract compliance assessment and generate expert recommendations across 6 key areas:

1. REGULATORY ALIGNMENTS - Alignment with relevant regulations and standards
2. COMPLIANCE GAPS - Identification and remediation of compliance gaps
3. RISK MITIGATIONS - Strategies to mitigate compliance-related risks
4. INDUSTRY STANDARDS - Adoption of relevant industry best practices
5. MONITORING RECOMMENDATIONS - Ongoing compliance monitoring strategies
6. DOCUMENTATION IMPROVEMENTS - Enhanced documentation for audit readiness

For each recommendation:
- Be specific and actionable
- Consider regulatory requirements and business impact
- Provide implementation guidance and timelines
- Assess resource requirements and priorities
- Address audit and enforcement perspectives

COMPLIANCE ASSESSMENT RESULTS:
${complianceResults.map(comp => `- ${comp.policyId}: ${comp.status} - ${comp.details}`).join('\n')}

Return your analysis as a JSON object with this structure:
{
  "regulatoryAlignments": [
    {
      "regulation": "GDPR",
      "applicability": "how it applies to this contract",
      "currentCompliance": "compliant|partial|non-compliant",
      "requiredActions": "specific actions needed",
      "deadline": "implementation timeline",
      "penalties": "potential penalties for non-compliance",
      "implementationCost": "low|medium|high"
    }
  ],
  "complianceGaps": [
    {
      "area": "Data Protection",
      "currentState": "current compliance state",
      "requiredState": "required compliance state",
      "gapSeverity": "low|medium|high|critical",
      "remediation": "remediation strategy",
      "timeline": "implementation timeline",
      "dependencies": ["dependency1", "dependency2"]
    }
  ],
  "riskMitigations": [
    {
      "riskCategory": "Regulatory Risk",
      "riskDescription": "description of the risk",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high|critical",
      "mitigationStrategy": "how to mitigate the risk",
      "preventativeControls": ["control1", "control2"],
      "monitoringApproach": "how to monitor this risk"
    }
  ],
  "industryStandards": [
    {
      "standard": "ISO 27001",
      "relevance": "why this standard is relevant",
      "adoptionBenefit": "benefits of adopting this standard",
      "implementationApproach": "how to implement",
      "certification": "certification requirements",
      "competitiveAdvantage": "competitive benefits"
    }
  ],
  "monitoringRecommendations": [
    {
      "complianceArea": "Data Privacy",
      "monitoringFrequency": "monthly",
      "keyIndicators": ["indicator1", "indicator2"],
      "alertThresholds": "when to trigger alerts",
      "reportingRequirements": "reporting obligations",
      "responsibleParty": "who is responsible"
    }
  ],
  "documentationImprovements": [
    {
      "documentType": "Privacy Policy",
      "currentGap": "what's missing or inadequate",
      "suggestedContent": "what should be included",
      "maintenanceSchedule": "how often to update",
      "auditReadiness": "how this helps with audits",
      "stakeholderCommunication": "how to communicate changes"
    }
  ]
}

Provide 3-5 specific, actionable recommendations in each category based on the actual compliance assessment provided.
`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: complianceBestPracticesPrompt
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
      
      console.log('✅ Generated compliance best practices:', {
        alignments: bestPractices.regulatoryAlignments?.length || 0,
        gaps: bestPractices.complianceGaps?.length || 0,
        mitigations: bestPractices.riskMitigations?.length || 0,
        standards: bestPractices.industryStandards?.length || 0,
        monitoring: bestPractices.monitoringRecommendations?.length || 0,
        documentation: bestPractices.documentationImprovements?.length || 0
      });
      
      return bestPractices;
    }
  } catch (error) {
    console.error('❌ Failed to generate compliance best practices:', error);
  }

  // Return empty structure if generation fails
  return {
    regulatoryAlignments: [],
    complianceGaps: [],
    riskMitigations: [],
    industryStandards: [],
    monitoringRecommendations: [],
    documentationImprovements: []
  };
}
/**
 * Perform advanced compliance analysis using shared LLM utilities
 */
async function performAdvancedComplianceAnalysis(
  contractText: string,
  policyPackId: string
): Promise<{ compliance: any[], confidenceScore: number }> {
  try {
    const userPrompt = `
POLICY PACK ID: ${policyPackId}

CONTRACT TEXT FOR COMPLIANCE ANALYSIS:
${contractText.slice(0, 15000)}

Analyze this contract for compliance with regulatory requirements and industry standards.
Focus on identifying compliance gaps, requirements, and recommendations.

Return analysis in JSON format:
{
  "compliance": [
    {
      "policyId": "string",
      "status": "compliant|non-compliant|unknown",
      "details": "string",
      "recommendation": "string"
    }
  ],
  "overallConfidence": 0-100
}
`;

    const response = await llmClient.generateExpertAnalysis(
      'COMPLIANCE_OFFICER',
      'regulatory compliance assessment',
      userPrompt,
      { responseFormat: 'json' }
    );

    return {
      compliance: response.data.compliance || [],
      confidenceScore: response.confidence || 75
    };
    
  } catch (error) {
    console.warn('LLM compliance analysis failed:', error);
    return { compliance: [], confidenceScore: 0 };
  }
}

/**
 * Enhanced fallback compliance analysis
 */
function performFallbackComplianceAnalysis(text: string): { compliance: any[], confidenceScore: number } {
  const t = text.toLowerCase();
  const compliance: any[] = [];
  
  // Basic compliance patterns
  const compliancePatterns = [
    {
      policyId: 'GDPR-001',
      pattern: /gdpr|data\s+protection|privacy\s+policy/g,
      status: 'unknown',
      details: 'GDPR compliance indicators found'
    },
    {
      policyId: 'SOX-001',
      pattern: /sarbanes.oxley|sox|financial\s+controls/g,
      status: 'unknown',
      details: 'SOX compliance indicators found'
    },
    {
      policyId: 'HIPAA-001',
      pattern: /hipaa|health\s+information|medical\s+records/g,
      status: 'unknown',
      details: 'HIPAA compliance indicators found'
    }
  ];

  compliancePatterns.forEach(pattern => {
    const matches = t.match(pattern.pattern);
    if (matches && matches.length > 0) {
      compliance.push({
        policyId: pattern.policyId,
        status: pattern.status,
        details: pattern.details,
        recommendation: 'Review compliance requirements in detail'
      });
    }
  });

  if (compliance.length === 0) {
    compliance.push({
      policyId: 'GEN-001',
      status: 'unknown',
      details: 'General compliance review required',
      recommendation: 'Conduct comprehensive compliance assessment'
    });
  }

  return { 
    compliance, 
    confidenceScore: Math.min(50 + (compliance.length * 10), 75) 
  };
}

/**
 * Calculate overall compliance score
 */
function calculateOverallComplianceScore(compliance: any[]): number {
  if (compliance.length === 0) return 0;
  
  const compliantCount = compliance.filter(c => c.status === 'compliant').length;
  const totalCount = compliance.length;
  
  return Math.round((compliantCount / totalCount) * 100);
}
// Prefer workspace import, fallback to relative if needed
let ComplianceArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ComplianceArtifactV1Schema = require('schemas').ComplianceArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ComplianceArtifactV1Schema = require('../../packages/schemas/src').ComplianceArtifactV1Schema;
}

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

let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../packages/clients/db');
  db = mod.default || mod;
}

let OpenAIClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAIClient = require('clients-openai').OpenAIClient;
} catch {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    OpenAIClient = require('../../packages/clients/openai').OpenAIClient;
  } catch {
    OpenAIClient = null;
  }
}

export type ComplianceJob = {
	docId: string;
	policyPackId: string;
};

export async function runCompliance(job: { data: ComplianceJob }) {
    const { docId, policyPackId } = job.data;
    console.log(`[worker:compliance] Starting advanced compliance check for ${docId} with policy ${policyPackId}`);
    const startTime = Date.now();

    // Read ingestion text and previous artifacts for context
    const ingestion = await db.artifact.findFirst({ 
      where: { contractId: docId, type: 'INGESTION' }, 
      orderBy: { createdAt: 'desc' } 
    });
    const text = String((ingestion?.data as any)?.content || '');
    
    let compliance: any[] = [];
    let client: any = null;
    
    const apiKey = process.env['OPENAI_API_KEY'];
    const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
    
    if (apiKey && OpenAIClient && text.trim().length > 0) {
      try {
        client = new OpenAIClient(apiKey);
        
        const compliancePrompt = `
You are a legal compliance expert specializing in contract policy compliance review. Analyze the provided contract against standard corporate policy requirements.

Review for the following common compliance policies and provide the assessment:

**Core Policies:**
1. CONF-001: Confidentiality/NDA clauses must be present
2. TERM-001: Clear termination clauses with notice periods
3. IP-001: Intellectual property ownership must be defined
4. LIAB-001: Limitation of liability clauses required
5. DATA-001: Data protection and privacy clauses (GDPR compliance)
6. FORCE-001: Force majeure provisions required
7. DISPUTE-001: Dispute resolution mechanism defined
8. PAYMENT-001: Payment terms clearly specified
9. PERF-001: Performance standards and SLAs defined
10. INDEMNITY-001: Indemnification clauses present

For each policy, provide:
- policyId: The policy identifier (e.g., "CONF-001")
- status: "compliant", "non-compliant", or "partial"
- details: Brief explanation of findings
- recommendation: (optional) What should be done to achieve compliance

Return the result as a JSON array of compliance objects. Focus on the most critical policies.
`;

        const response = await client.createChatCompletion({
          model,
          messages: [
            {
              role: 'system',
              content: compliancePrompt
            },
            {
              role: 'user',
              content: `CONTRACT TEXT (first 12000 characters):\n${text.slice(0, 12000)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 2000
        });

        const responseText = response.choices?.[0]?.message?.content || '';
        
        try {
          // Try to parse JSON from the response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedCompliance = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsedCompliance)) {
              compliance = parsedCompliance.map((comp: any) => ({
                policyId: comp.policyId || 'UNKNOWN',
                status: comp.status || 'partial',
                details: comp.details || 'Policy assessed'
              }));
            }
          }
        } catch (parseError) {
          console.warn(`[worker:compliance] Failed to parse LLM response as JSON for ${docId}:`, parseError);
        }
        
        console.log(`[worker:compliance] LLM analyzed ${compliance.length} compliance policies for ${docId}`);
        
      } catch (error) {
        console.warn(`[worker:compliance] LLM compliance analysis failed for ${docId}:`, error);
      }
    }
    
    // Fallback to heuristic compliance check if LLM fails
    if (compliance.length === 0) {
      console.log(`[worker:compliance] Falling back to heuristic compliance analysis for ${docId}`);
      const t = text.toLowerCase();
      
      // Confidentiality check
      const hasConfidentiality = /confidential|non.?disclosure|nda|proprietary/.test(t);
      compliance.push({
        policyId: 'CONF-001',
        status: hasConfidentiality ? 'compliant' : 'non-compliant',
        details: hasConfidentiality ? 'Confidentiality clause present' : 'No confidentiality clause found'
      });
      
      // Termination check
      const hasTermination = /terminat|notice\s+period|end\s+of\s+contract/.test(t);
      compliance.push({
        policyId: 'TERM-001',
        status: hasTermination ? 'compliant' : 'non-compliant',
        details: hasTermination ? 'Termination clause present' : 'No termination clause found'
      });
      
      // Liability check
      const hasLiability = /limitation\s+of\s+liability|liability\s+cap|exclusion\s+of\s+liability/.test(t);
      compliance.push({
        policyId: 'LIAB-001',
        status: hasLiability ? 'compliant' : 'non-compliant',
        details: hasLiability ? 'Limitation of liability clause present' : 'No liability limitation found'
      });
      
      // IP check
      const hasIP = /intellectual\s+property|copyright|trademark|patent|proprietary\s+rights/.test(t);
      compliance.push({
        policyId: 'IP-001',
        status: hasIP ? 'compliant' : 'partial',
        details: hasIP ? 'IP clauses present' : 'IP clauses may be unclear'
      });
      
      // Data protection check
      const hasDataProtection = /gdpr|data\s+protection|privacy|personal\s+data/.test(t);
      compliance.push({
        policyId: 'DATA-001',
        status: hasDataProtection ? 'compliant' : 'non-compliant',
        details: hasDataProtection ? 'Data protection clauses present' : 'No data protection clauses found'
      });
    }

    // Generate LLM-powered best practices for compliance
    let bestPractices: ComplianceBestPractices | null = null;
    if (client && compliance.length > 0) {
      try {
        bestPractices = await generateComplianceBestPractices(client, compliance, text);
      } catch (error) {
        console.warn(`[worker:compliance] Best practices generation failed for ${docId}:`, error);
      }
    }

	const artifact = ComplianceArtifactV1Schema.parse({
		metadata: {
			docId,
			fileType: 'pdf',
			totalPages: 1,
			ocrRate: 0,
			provenance: [{ worker: 'compliance', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime }],
		},
		compliance,
        // Add best practices to the artifact (if schema supports it)
        bestPractices: bestPractices
	});

    await db.artifact.create({
        data: {
            contractId: docId,
            type: 'COMPLIANCE',
            data: artifact as any,
        },
    });

    console.log(`[worker:compliance] Finished advanced compliance check for ${docId} (${compliance.length} policies assessed)`);
	return { docId };
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
    const response = await client.createChatCompletion({
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

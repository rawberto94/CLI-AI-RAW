// Prefer workspace import, fallback to relative if needed
let RiskArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RiskArtifactV1Schema = require('schemas').RiskArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RiskArtifactV1Schema = require('../../packages/schemas/src').RiskArtifactV1Schema;
}

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

export async function runRisk(job: { data: { docId: string } }) {
  const { docId } = job.data;
  console.log(`[worker:risk] Starting advanced risk analysis for ${docId}`);
  const startTime = Date.now();
  
  // Read ingestion text and previous artifacts for context
  const ingestion = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'INGESTION' }, 
    orderBy: { createdAt: 'desc' } 
  });
  const clauses = await db.artifact.findFirst({ 
    where: { contractId: docId, type: 'CLAUSES' }, 
    orderBy: { createdAt: 'desc' } 
  });
  
  const text = String((ingestion?.data as any)?.content || '');
  const extractedClauses = (clauses?.data as any)?.clauses || [];
  
  let risks: any[] = [];
  let client: any = null;
  
  const apiKey = process.env['OPENAI_API_KEY'];
  const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
  
  if (apiKey && OpenAIClient && text.trim().length > 0) {
    try {
      client = new OpenAIClient(apiKey);
      
      // Create context from extracted clauses
      const clauseContext = extractedClauses.map((clause: any) => 
        `${clause.clauseId}: ${clause.text}`
      ).join('\n');
      
      const riskAnalysisPrompt = `
You are a legal risk analysis expert specializing in contract review. Analyze the provided contract for potential business and legal risks.

Evaluate the following risk categories and identify specific risks:

1. **Financial Risks**: Payment terms, penalties, late fees, currency risks, cost overruns
2. **Legal/Compliance Risks**: Regulatory compliance, governing law issues, dispute resolution
3. **Operational Risks**: Service level agreements, performance standards, delivery requirements
4. **Liability Risks**: Indemnification, limitation of liability, insurance requirements
5. **Intellectual Property Risks**: IP ownership, licensing, confidentiality breaches
6. **Termination Risks**: Termination clauses, notice periods, exit costs
7. **Force Majeure Risks**: Force majeure coverage, business continuity

For each identified risk, provide:
- riskType: Category of risk (Financial, Legal, Operational, Liability, IP, Termination, Force Majeure)
- description: Clear description of the specific risk
- severity: LOW, MEDIUM, or HIGH based on potential business impact
- recommendation: Brief mitigation recommendation (optional)

Return the result as a JSON array of risk objects. Focus on the most significant risks (max 15).
`;

      const response = await client.createChatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: riskAnalysisPrompt
          },
          {
            role: 'user',
            content: `CONTRACT CLAUSES:\n${clauseContext}\n\nFULL CONTRACT TEXT (first 12000 characters):\n${text.slice(0, 12000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
      });

      const responseText = response.choices?.[0]?.message?.content || '';
      
      try {
        // Try to parse JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedRisks = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedRisks)) {
            risks = parsedRisks.map((risk: any) => ({
              riskType: risk.riskType || 'General',
              description: risk.description || 'Risk identified',
              severity: (risk.severity || 'medium').toLowerCase(),
              recommendation: risk.recommendation || undefined
            }));
          }
        }
      } catch (parseError) {
        console.warn(`[worker:risk] Failed to parse LLM response as JSON for ${docId}:`, parseError);
      }
      
      console.log(`[worker:risk] LLM identified ${risks.length} risks for ${docId}`);
      
    } catch (error) {
      console.warn(`[worker:risk] LLM risk analysis failed for ${docId}:`, error);
    }
  }
  
  // Fallback to heuristic risk analysis if LLM fails
  if (risks.length === 0) {
    console.log(`[worker:risk] Falling back to heuristic risk analysis for ${docId}`);
    const t = text.toLowerCase();
    
    // Financial risks
    if (/payment\s+terms?:?\s*(more than|over|exceed)\s*60/.test(t) || /net\s*(?:90|120)/.test(t)) {
      risks.push({ 
        riskType: 'Financial', 
        description: 'Extended payment terms may impact cash flow (60+ days)', 
        severity: 'medium' 
      });
    }
    
    // Liability risks
    if (!/limitation\s+of\s+liability|liability\s+cap/.test(t)) {
      risks.push({ 
        riskType: 'Liability', 
        description: 'No clear limitation of liability clause found', 
        severity: 'high' 
      });
    }
    
    // IP risks
    if (!/confidential/.test(t) && !/non.?disclosure/.test(t)) {
      risks.push({ 
        riskType: 'IP', 
        description: 'Confidentiality terms not clearly defined', 
        severity: 'medium' 
      });
    }
    
    // Termination risks
    if (!/terminat/.test(t) || !/notice/.test(t)) {
      risks.push({ 
        riskType: 'Termination', 
        description: 'Termination clauses may be unclear or missing', 
        severity: 'medium' 
      });
    }
    
    // Operational risks
    if (/penalty|penalt/.test(t) || /liquidated\s+damages/.test(t)) {
      risks.push({ 
        riskType: 'Operational', 
        description: 'Performance penalties or liquidated damages present', 
        severity: 'high' 
      });
    }
    
    if (risks.length === 0) {
      risks.push({ 
        riskType: 'General', 
        description: 'No major risks detected in heuristic analysis', 
        severity: 'low' 
      });
    }
  }

  // Generate LLM-powered best practices for risk management
  let bestPractices: RiskBestPractices | null = null;
  if (client && risks.length > 0) {
    try {
      bestPractices = await generateRiskBestPractices(client, risks, text);
    } catch (error) {
      console.warn(`[worker:risk] Best practices generation failed for ${docId}:`, error);
    }
  }

  // Clean up risks for schema (remove recommendation field if present)
  const risksForSchema = risks.map(risk => ({
    riskType: risk.riskType,
    description: risk.description,
    severity: risk.severity
  }));

  const artifact = RiskArtifactV1Schema.parse({
    metadata: { 
      docId, 
      fileType: 'pdf', 
      totalPages: 1, 
      ocrRate: 0, 
      provenance: [{ 
        worker: 'risk', 
        timestamp: new Date().toISOString(), 
        durationMs: Date.now() - startTime 
      }] 
    },
    risks: risksForSchema,
    // Add best practices to the artifact (if schema supports it)
    bestPractices: bestPractices
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'RISK',
      data: artifact as any,
    },
  });

  console.log(`[worker:risk] Finished advanced risk analysis for ${docId} (${risks.length} risks identified)`);
  return { docId };
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
    const response = await client.createChatCompletion({
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

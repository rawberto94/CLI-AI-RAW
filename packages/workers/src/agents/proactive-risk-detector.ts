import pino from 'pino';
import clientsDb from 'clients-db';
import OpenAI from 'openai';

// Lazy-init OpenAI for LLM-powered risk detection
let _riskOpenAI: OpenAI | null = null;
function getRiskOpenAI(): OpenAI {
  if (!_riskOpenAI) {
    _riskOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _riskOpenAI;
}

// Define types to match workflow-auto-start.service.ts
interface AutoStartRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  workflowTemplateKey: string;
}

interface AutoStartResult {
  triggered: boolean;
  rule?: AutoStartRule;
  executionId?: string;
  reason?: string;
}

interface ContractData {
  id: string;
  tenantId: string;
  title?: string;
  contractType?: string;
  value?: number;
  status?: string;
  riskLevel?: string;
  riskScore?: number;
  supplierName?: string;
  [key: string]: unknown;
}

interface WorkflowAutoStartService {
  evaluateContract(contractData: ContractData): Promise<AutoStartResult>;
  triggerWorkflow(tenantId: string, contractId: string, workflowKey: string): Promise<void>;
}

// Dynamic import to avoid circular dependencies
const getWorkflowAutoStartService = async (): Promise<WorkflowAutoStartService> => {
  try {
    // Import from specific service file using proper export path
    // @ts-ignore - Module resolution handled at runtime
    const { workflowAutoStartService } = await import('@repo/data-orchestration/services/workflow-auto-start.service') as any;
    if (workflowAutoStartService) {
      return workflowAutoStartService;
    }
    // Fallback to main module export
    const module = await import('@repo/data-orchestration') as any;
    if (module?.workflowAutoStartService) {
      return module.workflowAutoStartService;
    }
    throw new Error('workflowAutoStartService not found');
  } catch (error) {
    // Fallback: return a no-op service if not available
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'WorkflowAutoStartService not available, using no-op fallback');
    return {
      evaluateContract: async () => ({ triggered: false, reason: 'Service unavailable' }),
      triggerWorkflow: async () => {},
    };
  }
};

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

const logger = pino({ name: 'proactive-risk-detector' });

/**
 * Risk Types
 */
export enum RiskType {
  MISSING_CRITICAL_CLAUSE = 'missing_critical_clause',
  UNFAVORABLE_TERMS = 'unfavorable_terms',
  COMPLIANCE_GAP = 'compliance_gap',
  EXCESSIVE_LIABILITY = 'excessive_liability',
  RENEWAL_RISK = 'renewal_risk',
  PRICING_ANOMALY = 'pricing_anomaly',
  AMBIGUOUS_LANGUAGE = 'ambiguous_language',
  OBLIGATION_CONFLICT = 'obligation_conflict',
}

export enum RiskSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface DetectedRisk {
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  evidence: string;
  impact: string;
  recommendation: string;
  autoFixable: boolean;
  requiresHumanReview: boolean;
  estimatedCost?: number;
}

export interface RiskAnalysisResult {
  overallRiskScore: number; // 0-100
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  risks: DetectedRisk[];
  actionRequired: boolean;
  escalationNeeded: boolean;
}

/**
 * Proactive Risk Detector
 * Analyzes contracts for potential issues before they become problems
 */
export class ProactiveRiskDetector {
  /**
   * Analyze contract for all risk types
   */
  async analyzeContract(
    contractId: string,
    tenantId: string,
    contractType: string,
    contractText: string,
    artifacts?: Record<string, any>
  ): Promise<RiskAnalysisResult> {
    logger.info({ contractId, contractType }, '🔍 Starting proactive risk analysis');

    const risks: DetectedRisk[] = [];

    // Run all risk detection checks
    risks.push(...await this.detectMissingCriticalClauses(contractType, contractText, artifacts));
    risks.push(...await this.detectUnfavorableTerms(contractText, artifacts));
    risks.push(...await this.detectComplianceGaps(contractType, contractText, artifacts));
    risks.push(...await this.detectExcessiveLiability(contractText, artifacts));
    risks.push(...await this.detectRenewalRisks(contractId, tenantId, artifacts));
    risks.push(...await this.detectPricingAnomalies(contractType, tenantId, artifacts));
    risks.push(...await this.detectAmbiguousLanguage(contractText));
    risks.push(...await this.detectObligationConflicts(artifacts));

    // Calculate risk score
    const { overallRiskScore, criticalCount, highCount, mediumCount, lowCount } = this.calculateRiskScore(risks);

    const actionRequired = criticalCount > 0 || highCount > 2;
    const escalationNeeded = criticalCount > 2 || (criticalCount > 0 && highCount > 3);

    // Store risks in database
    await this.storeRisks(contractId, tenantId, risks);

    // ENHANCED: Trigger workflow escalation if needed
    if (escalationNeeded) {
      await this.triggerRiskEscalationWorkflow(contractId, tenantId, {
        overallRiskScore,
        criticalCount,
        highCount,
        risks: risks.filter(r => r.severity === RiskSeverity.CRITICAL || r.severity === RiskSeverity.HIGH),
      });
    }

    logger.info({
      contractId,
      overallRiskScore,
      criticalCount,
      highCount,
      actionRequired,
      escalationNeeded,
    }, '✅ Risk analysis complete');

    return {
      overallRiskScore,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      risks,
      actionRequired,
      escalationNeeded,
    };
  }

  /**
   * Detect missing critical clauses — regex fast-pass + LLM deep analysis
   */
  private async detectMissingCriticalClauses(
    contractType: string,
    contractText: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    // ── Stage 1: regex fast-pass (always runs) ──────────────────
    const regexRisks = this.detectMissingClausesRegex(contractText);

    // ── Stage 2: LLM semantic analysis (if key available) ───────
    if (process.env.OPENAI_API_KEY && contractText.length > 100) {
      try {
        const llmRisks = await this.detectMissingClausesLLM(contractType, contractText);
        // Merge: LLM results are more authoritative — deduplicate by title
        const seen = new Set(llmRisks.map(r => r.title));
        const merged = [...llmRisks, ...regexRisks.filter(r => !seen.has(r.title))];
        return merged;
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'LLM clause detection failed, using regex fallback');
      }
    }

    return regexRisks;
  }

  /**
   * Regex-based clause detection (fast, low-cost)
   */
  private detectMissingClausesRegex(contractText: string): DetectedRisk[] {
    const risks: DetectedRisk[] = [];
    const text = contractText.toLowerCase();

    const criticalClauses: Record<string, { keywords: string[]; severity: RiskSeverity }> = {
      'Limitation of Liability': { keywords: ['limit', 'liability', 'cap'], severity: RiskSeverity.CRITICAL },
      'Indemnification': { keywords: ['indemnif', 'hold harmless', 'defend'], severity: RiskSeverity.HIGH },
      'Termination': { keywords: ['termination', 'cancel', 'end agreement'], severity: RiskSeverity.HIGH },
      'Confidentiality': { keywords: ['confidential', 'proprietary', 'non-disclosure'], severity: RiskSeverity.HIGH },
      'IP Ownership': { keywords: ['intellectual property', 'ownership', 'ip rights'], severity: RiskSeverity.MEDIUM },
      'Data Protection': { keywords: ['data protection', 'privacy', 'gdpr'], severity: RiskSeverity.HIGH },
    };

    for (const [clause, { keywords, severity }] of Object.entries(criticalClauses)) {
      const found = keywords.some(kw => text.includes(kw));

      if (!found) {
        risks.push({
          type: RiskType.MISSING_CRITICAL_CLAUSE,
          severity,
          title: `Missing ${clause} Clause`,
          description: `Contract does not appear to contain a ${clause} clause`,
          evidence: `No mention of keywords: ${keywords.join(', ')}`,
          impact: this.getClauseImpact(clause),
          recommendation: `Add a ${clause} clause to protect your interests`,
          autoFixable: false,
          requiresHumanReview: true,
        });
      }
    }

    return risks;
  }

  /**
   * LLM-powered semantic clause detection
   */
  private async detectMissingClausesLLM(
    contractType: string,
    contractText: string,
  ): Promise<DetectedRisk[]> {
    const openai = getRiskOpenAI();
    const truncated = contractText.slice(0, 12000); // Stay within token limits

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a contract risk analyst. Analyze the contract text and identify MISSING critical clauses.

For each missing clause, return:
- "title": name of the missing clause
- "severity": "critical" | "high" | "medium" | "low"
- "description": why this clause is important
- "impact": business impact of this omission
- "recommendation": specific action to take

Return JSON: { "missing_clauses": [...] }
Only include genuinely missing clauses — do NOT flag clauses that ARE present. Be precise.`,
        },
        {
          role: 'user',
          content: `Contract type: ${contractType}\n\nContract text:\n${truncated}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const missingClauses = Array.isArray(parsed.missing_clauses) ? parsed.missing_clauses : [];

    const severityMap: Record<string, RiskSeverity> = {
      critical: RiskSeverity.CRITICAL,
      high: RiskSeverity.HIGH,
      medium: RiskSeverity.MEDIUM,
      low: RiskSeverity.LOW,
    };

    return missingClauses
      .filter((c: any) => c.title && c.severity)
      .slice(0, 10)
      .map((c: any) => ({
        type: RiskType.MISSING_CRITICAL_CLAUSE,
        severity: severityMap[c.severity?.toLowerCase()] || RiskSeverity.MEDIUM,
        title: `Missing ${String(c.title).slice(0, 100)}`,
        description: String(c.description || '').slice(0, 500),
        evidence: 'Identified by LLM semantic analysis',
        impact: String(c.impact || '').slice(0, 500),
        recommendation: String(c.recommendation || '').slice(0, 500),
        autoFixable: false,
        requiresHumanReview: true,
      }));
  }

  /**
   * Detect unfavorable terms
   */
  private async detectUnfavorableTerms(
    contractText: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];
    const text = contractText.toLowerCase();

    // Check for one-sided terms
    const unfavorablePatterns = [
      { pattern: /unlimited liability|no cap on liability/i, title: 'Unlimited Liability Exposure' },
      { pattern: /auto-renew|automatically renew/i, title: 'Auto-Renewal Without Notice' },
      { pattern: /non-compete|non-solicitation/i, title: 'Restrictive Covenants' },
      { pattern: /exclusive|sole provider/i, title: 'Exclusivity Clause' },
      { pattern: /no warranty|as is|as available/i, title: 'No Warranty Protection' },
    ];

    for (const { pattern, title } of unfavorablePatterns) {
      const match = contractText.match(pattern);
      if (match) {
        risks.push({
          type: RiskType.UNFAVORABLE_TERMS,
          severity: RiskSeverity.HIGH,
          title,
          description: `Contract contains potentially unfavorable terms`,
          evidence: match[0],
          impact: 'May expose organization to unexpected costs or restrictions',
          recommendation: 'Negotiate to modify or remove unfavorable language',
          autoFixable: false,
          requiresHumanReview: true,
        });
      }
    }

    return risks;
  }

  /**
   * Detect compliance gaps
   */
  private async detectComplianceGaps(
    contractType: string,
    contractText: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];
    const text = contractText.toLowerCase();

    // Check for required compliance mentions based on contract type
    const complianceChecks: Record<string, string[]> = {
      'service_agreement': ['gdpr', 'data protection', 'privacy'],
      'professional_services': ['liability insurance', 'professional indemnity'],
      'software_license': ['license compliance', 'audit rights'],
    };

    const requiredCompliance = complianceChecks[contractType.toLowerCase()] || [];

    for (const requirement of requiredCompliance) {
      if (!text.includes(requirement.toLowerCase())) {
        risks.push({
          type: RiskType.COMPLIANCE_GAP,
          severity: RiskSeverity.HIGH,
          title: `Missing ${requirement} Provisions`,
          description: `Contract lacks required ${requirement} provisions`,
          evidence: `No mention of "${requirement}" in contract`,
          impact: 'May violate regulatory requirements or company policy',
          recommendation: `Add ${requirement} provisions to ensure compliance`,
          autoFixable: false,
          requiresHumanReview: true,
        });
      }
    }

    return risks;
  }

  /**
   * Detect excessive liability exposure
   */
  private async detectExcessiveLiability(
    contractText: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];

    // Check RISK artifact if available
    if (artifacts?.RISK) {
      const riskData = artifacts.RISK;
      
      if (riskData.overallRisk === 'High' && riskData.riskScore > 70) {
        risks.push({
          type: RiskType.EXCESSIVE_LIABILITY,
          severity: RiskSeverity.CRITICAL,
          title: 'Excessive Liability Exposure',
          description: `Contract has high risk score (${riskData.riskScore}/100)`,
          evidence: riskData.risks?.map((r: any) => r.title).join(', ') || 'Multiple high-risk factors',
          impact: 'Significant financial and legal exposure',
          recommendation: 'Review liability terms and add protective caps',
          autoFixable: false,
          requiresHumanReview: true,
        });
      }
    }

    return risks;
  }

  /**
   * Detect renewal risks
   */
  private async detectRenewalRisks(
    contractId: string,
    tenantId: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];

    // Check RENEWAL artifact
    if (artifacts?.RENEWAL) {
      const renewalData = artifacts.RENEWAL;
      
      if (renewalData.renewalDate) {
        const renewalDate = new Date(renewalData.renewalDate);
        const daysUntilRenewal = (renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

        if (daysUntilRenewal < 30 && daysUntilRenewal > 0) {
          risks.push({
            type: RiskType.RENEWAL_RISK,
            severity: RiskSeverity.CRITICAL,
            title: 'Imminent Renewal Deadline',
            description: `Contract renews in ${Math.floor(daysUntilRenewal)} days`,
            evidence: `Renewal date: ${renewalDate.toLocaleDateString()}`,
            impact: 'Risk of auto-renewal without renegotiation',
            recommendation: 'Initiate renewal process immediately',
            autoFixable: false,
            requiresHumanReview: true,
          });
        } else if (daysUntilRenewal < 90 && daysUntilRenewal > 0) {
          risks.push({
            type: RiskType.RENEWAL_RISK,
            severity: RiskSeverity.HIGH,
            title: 'Upcoming Renewal',
            description: `Contract renews in ${Math.floor(daysUntilRenewal)} days`,
            evidence: `Renewal date: ${renewalDate.toLocaleDateString()}`,
            impact: 'Should begin renewal planning',
            recommendation: 'Start gathering renewal requirements and benchmarking',
            autoFixable: false,
            requiresHumanReview: false,
          });
        }
      }
    }

    return risks;
  }

  /**
   * Detect pricing anomalies
   */
  private async detectPricingAnomalies(
    contractType: string,
    tenantId: string,
    artifacts?: Record<string, any>
  ): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];

    // Check FINANCIAL artifact
    if (artifacts?.FINANCIAL) {
      const financialData = artifacts.FINANCIAL;

      // Get similar contracts for benchmarking
      const similarContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          contractType,
          id: { not: artifacts.contractId },
        },
        include: {
          artifacts: {
            where: { type: 'FINANCIAL' },
            select: { data: true },
          },
        },
        take: 10,
      });

      if (similarContracts.length >= 3) {
        const values = similarContracts
          .map((c: { artifacts: Array<{ data: unknown }> }) => c.artifacts[0]?.data as Record<string, unknown>)
          .filter((d: Record<string, unknown> | undefined) => d?.totalValue && (d.totalValue as Record<string, unknown>)?.value)
          .map((d: Record<string, unknown>) => parseFloat(String((d.totalValue as Record<string, unknown>)?.value)));

        if (values.length >= 3) {
          const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          const currentValue = parseFloat(financialData.totalValue?.value || 0);

          // Flag if current is 50% above average
          if (currentValue > avgValue * 1.5) {
            risks.push({
              type: RiskType.PRICING_ANOMALY,
              severity: RiskSeverity.HIGH,
              title: 'Pricing Significantly Above Market',
              description: `Contract value is ${((currentValue / avgValue - 1) * 100).toFixed(0)}% above similar contracts`,
              evidence: `Current: $${currentValue.toLocaleString()}, Average: $${avgValue.toLocaleString()}`,
              impact: 'Overpaying compared to market rates',
              recommendation: 'Negotiate pricing to align with market rates',
              autoFixable: false,
              requiresHumanReview: true,
              estimatedCost: currentValue - avgValue,
            });
          }
        }
      }
    }

    return risks;
  }

  /**
   * Detect ambiguous language — regex fast-pass + LLM semantic analysis
   */
  private async detectAmbiguousLanguage(contractText: string): Promise<DetectedRisk[]> {
    // ── Stage 1: regex fast-pass ─────────────────────────────────
    const regexRisks = this.detectAmbiguousLanguageRegex(contractText);

    // ── Stage 2: LLM semantic analysis ───────────────────────────
    if (process.env.OPENAI_API_KEY && contractText.length > 100) {
      try {
        const llmRisks = await this.detectAmbiguousLanguageLLM(contractText);
        const seen = new Set(llmRisks.map(r => r.title));
        return [...llmRisks, ...regexRisks.filter(r => !seen.has(r.title))];
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'LLM ambiguity detection failed, using regex fallback');
      }
    }

    return regexRisks;
  }

  /**
   * Regex-based ambiguity detection (fast, low-cost)
   */
  private detectAmbiguousLanguageRegex(contractText: string): DetectedRisk[] {
    const risks: DetectedRisk[] = [];

    const ambiguousPatterns = [
      { pattern: /reasonable efforts|best efforts/gi, title: 'Vague Performance Standards' },
      { pattern: /as soon as possible|promptly|timely/gi, title: 'Ambiguous Timing' },
      { pattern: /substantial|material|significant/gi, title: 'Undefined Terms' },
    ];

    for (const { pattern, title } of ambiguousPatterns) {
      const matches = contractText.match(pattern);
      if (matches && matches.length > 3) {
        risks.push({
          type: RiskType.AMBIGUOUS_LANGUAGE,
          severity: RiskSeverity.MEDIUM,
          title,
          description: `Contract uses ambiguous language ${matches.length} times`,
          evidence: `Examples: ${matches.slice(0, 3).join(', ')}`,
          impact: 'May lead to disputes about obligations',
          recommendation: 'Replace with specific, measurable terms',
          autoFixable: false,
          requiresHumanReview: true,
        });
      }
    }

    return risks;
  }

  /**
   * LLM-powered ambiguity detection for nuanced contract language issues
   */
  private async detectAmbiguousLanguageLLM(contractText: string): Promise<DetectedRisk[]> {
    const openai = getRiskOpenAI();
    const truncated = contractText.slice(0, 12000);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a contract language analyst specializing in detecting ambiguous, vague, or legally risky language.

Identify passages that could cause disputes: vague timing, undefined terms, unclear obligations, subjective standards, missing definitions, or contradictory statements.

For each issue return:
- "title": short descriptive title
- "severity": "critical" | "high" | "medium" | "low"
- "evidence": the exact phrase(s) found
- "description": why this is problematic
- "recommendation": specific fix

Return JSON: { "ambiguities": [...] }
Only flag genuinely problematic language, not standard legal phrasing.`,
        },
        {
          role: 'user',
          content: `Analyze this contract text for ambiguous language:\n\n${truncated}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const ambiguities = Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [];

    const severityMap: Record<string, RiskSeverity> = {
      critical: RiskSeverity.CRITICAL,
      high: RiskSeverity.HIGH,
      medium: RiskSeverity.MEDIUM,
      low: RiskSeverity.LOW,
    };

    return ambiguities
      .filter((a: any) => a.title)
      .slice(0, 8)
      .map((a: any) => ({
        type: RiskType.AMBIGUOUS_LANGUAGE,
        severity: severityMap[a.severity?.toLowerCase()] || RiskSeverity.MEDIUM,
        title: String(a.title).slice(0, 100),
        description: String(a.description || '').slice(0, 500),
        evidence: String(a.evidence || 'Identified by LLM semantic analysis').slice(0, 500),
        impact: 'May lead to disputes about obligations or create legal exposure',
        recommendation: String(a.recommendation || 'Review and clarify language').slice(0, 500),
        autoFixable: false,
        requiresHumanReview: true,
      }));
  }

  /**
   * Detect obligation conflicts
   */
  private async detectObligationConflicts(artifacts?: Record<string, any>): Promise<DetectedRisk[]> {
    const risks: DetectedRisk[] = [];

    if (artifacts?.OBLIGATIONS) {
      const obligations = artifacts.OBLIGATIONS.obligations || [];

      // Check for conflicting deadlines
      const deadlines = obligations
        .filter((o: any) => o.deadline)
        .map((o: any) => ({ title: o.title, deadline: new Date(o.deadline) }));

      for (let i = 0; i < deadlines.length; i++) {
        for (let j = i + 1; j < deadlines.length; j++) {
          const diff = Math.abs(deadlines[i].deadline.getTime() - deadlines[j].deadline.getTime());
          const daysDiff = diff / (1000 * 60 * 60 * 24);

          if (daysDiff < 7) {
            risks.push({
              type: RiskType.OBLIGATION_CONFLICT,
              severity: RiskSeverity.MEDIUM,
              title: 'Conflicting Obligation Deadlines',
              description: `Multiple obligations due within ${Math.floor(daysDiff)} days`,
              evidence: `${deadlines[i].title} and ${deadlines[j].title}`,
              impact: 'May be difficult to meet overlapping deadlines',
              recommendation: 'Negotiate staggered deadlines',
              autoFixable: false,
              requiresHumanReview: true,
            });
          }
        }
      }
    }

    return risks;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(risks: DetectedRisk[]): {
    overallRiskScore: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  } {
    const counts = {
      criticalCount: risks.filter(r => r.severity === RiskSeverity.CRITICAL).length,
      highCount: risks.filter(r => r.severity === RiskSeverity.HIGH).length,
      mediumCount: risks.filter(r => r.severity === RiskSeverity.MEDIUM).length,
      lowCount: risks.filter(r => r.severity === RiskSeverity.LOW).length,
    };

    // Weighted score
    const overallRiskScore = Math.min(100,
      counts.criticalCount * 40 +
      counts.highCount * 20 +
      counts.mediumCount * 10 +
      counts.lowCount * 5
    );

    return { overallRiskScore, ...counts };
  }

  /**
   * Get impact description for missing clause
   */
  private getClauseImpact(clause: string): string {
    const impacts: Record<string, string> = {
      'Limitation of Liability': 'Unlimited liability exposure for damages',
      'Indemnification': 'No protection against third-party claims',
      'Termination': 'No clear exit strategy from agreement',
      'Confidentiality': 'No protection for sensitive information',
      'IP Ownership': 'Unclear ownership of work product',
      'Data Protection': 'Non-compliance with data privacy regulations',
    };

    return impacts[clause] || 'May create legal or financial risk';
  }

  /**
   * ENHANCED: Trigger risk escalation workflow for high-risk contracts
   * Integrates with WorkflowAutoStartService for automated workflow creation
   */
  private async triggerRiskEscalationWorkflow(
    contractId: string,
    tenantId: string,
    riskSummary: {
      overallRiskScore: number;
      criticalCount: number;
      highCount: number;
      risks: DetectedRisk[];
    }
  ): Promise<void> {
    try {
      logger.info({ contractId, riskScore: riskSummary.overallRiskScore }, '🚨 Triggering risk escalation workflow');

      const workflowAutoStartService = await getWorkflowAutoStartService();

      // Get contract details for workflow creation
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: {
          contractTitle: true,
          contractType: true,
          totalValue: true,
          supplierName: true,
          fileName: true,
        },
      });

      if (!contract) {
        logger.warn({ contractId }, 'Contract not found for escalation workflow');
        return;
      }

      // Trigger the workflow using auto-start service with high-risk context
      const result = await workflowAutoStartService.evaluateContract({
        id: contractId,
        tenantId,
        contractType: 'risk_escalation', // Force risk escalation template
        value: Number(contract.totalValue) || 0,
        riskLevel: 'HIGH',
        riskScore: riskSummary.overallRiskScore,
        supplierName: contract.supplierName || 'Unknown',
      });

      if (result.triggered && result.executionId) {
        logger.info({
          contractId,
          executionId: result.executionId,
          rule: result.rule?.name,
        }, '✅ Risk escalation workflow triggered successfully');

        // Store workflow trigger event
        await prisma.contractActivity.create({
          data: {
            type: 'workflow_triggered',
            action: `Risk escalation workflow triggered - Score: ${riskSummary.overallRiskScore}, Critical: ${riskSummary.criticalCount}, High: ${riskSummary.highCount}`,
            contractId,
            tenantId,
            userId: 'system', // System-generated activity
            metadata: {
              triggeredBy: 'ProactiveRiskDetector',
              executionId: result.executionId,
              riskSummary,
            },
          },
        });
      } else {
        // Fallback: Create a manual notification if auto-start doesn't trigger
        logger.info({ contractId }, 'No auto-start rule matched, creating manual escalation notification');

        await prisma.notification.create({
          data: {
            tenantId,
            userId: 'system', // System-generated notification
            type: 'risk_escalation' as any,
            title: 'High-Risk Contract Requires Attention',
            message: `Contract "${contract.contractTitle || contract.fileName || contractId}" has a risk score of ${riskSummary.overallRiskScore}/100 with ${riskSummary.criticalCount} critical risks. Immediate review recommended.`,
            // Note: priority is stored in metadata since it's not a schema field
            metadata: {
              priority: 'critical',
              contractId,
              riskScore: riskSummary.overallRiskScore,
              criticalCount: riskSummary.criticalCount,
              risks: riskSummary.risks.slice(0, 5), // Top 5 risks
            },
          },
        });
      }
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        contractId,
      }, 'Failed to trigger risk escalation workflow');
      // Don't rethrow - this is a best-effort notification
    }
  }

  /**
   * Store risks in database
   */
  private async storeRisks(contractId: string, tenantId: string, risks: DetectedRisk[]): Promise<void> {
    try {
      // Store in artifact for now
      await prisma.artifact.upsert({
        where: {
          contractId_type: {
            contractId,
            type: 'PROACTIVE_RISKS' as any,
          },
        },
        create: {
          contractId,
          tenantId,
          type: 'PROACTIVE_RISKS' as any,
          data: {
            analyzedAt: new Date().toISOString(),
            risks,
            riskCount: risks.length,
          },
          validationStatus: 'valid',
          size: JSON.stringify(risks).length,
        },
        update: {
          data: {
            analyzedAt: new Date().toISOString(),
            risks,
            riskCount: risks.length,
          },
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store risks');
    }
  }
}

/**
 * Get singleton detector instance
 */
let detectorInstance: ProactiveRiskDetector | null = null;

export function getProactiveRiskDetector(): ProactiveRiskDetector {
  if (!detectorInstance) {
    detectorInstance = new ProactiveRiskDetector();
  }
  return detectorInstance;
}

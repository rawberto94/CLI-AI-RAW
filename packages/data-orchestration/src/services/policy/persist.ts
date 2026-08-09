/**
 * Persist PolicyEvaluation + PolicyFinding rows and upsert POLICY_CHECK artifact.
 */

import type { FindingDraft, PolicyEvaluationResult, PolicyPackDef } from './types';

function cuidLike(): string {
  return `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function persistPolicyEvaluation(args: {
  prisma: any;
  tenantId: string;
  contractId: string;
  pack: PolicyPackDef;
  result: Omit<PolicyEvaluationResult, 'evaluationId' | 'cached'>;
  findings: FindingDraft[];
  factsSnapshot: Record<string, unknown>;
  triggeredBy: string;
  durationMs?: number;
  llmCalls?: number;
  tokensUsed?: number;
}): Promise<{ evaluationId: string }> {
  const {
    prisma,
    tenantId,
    contractId,
    pack,
    result,
    findings,
    factsSnapshot,
    triggeredBy,
    durationMs,
    llmCalls = 0,
    tokensUsed,
  } = args;

  // Idempotent: unique on contractId+packId+inputsHash
  const existing = await prisma.policyEvaluation.findUnique({
    where: {
      contractId_packId_inputsHash: {
        contractId,
        packId: pack.id,
        inputsHash: result.inputsHash,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { evaluationId: existing.id };
  }

  const evaluationId = cuidLike();

  await prisma.policyEvaluation.create({
    data: {
      id: evaluationId,
      tenantId,
      contractId,
      packId: pack.id,
      packVersion: pack.version,
      status: result.status,
      policyScore: result.policyScore,
      penalty: result.penalty,
      applicableRules: result.applicableRules,
      evaluatedRules: result.evaluatedRules,
      coverage: result.coverage,
      criticalCount: result.criticalCount,
      highCount: result.highCount,
      mediumCount: result.mediumCount,
      lowCount: result.lowCount,
      waivedCount: result.waivedCount,
      needsReviewCount: result.needsReviewCount,
      inputsHash: result.inputsHash,
      factsSnapshot,
      scoringVersion: 'v1',
      llmCalls,
      tokensUsed: tokensUsed ?? null,
      durationMs: durationMs ?? null,
      triggeredBy,
      findings: {
        create: findings.map((f) => ({
          id: cuidLike(),
          tenantId,
          contractId,
          ruleId: f.ruleId,
          ruleCode: f.ruleCode,
          status: f.status,
          severity: f.severity,
          category: f.category,
          title: f.title,
          detail: f.detail,
          evidence: f.evidence || [],
          penaltyContribution: f.penaltyContribution ?? 0,
          confidence: f.confidence,
          method: f.method,
          observedValue: f.observedValue ?? undefined,
          expectedValue: f.expectedValue ?? undefined,
          remediation: f.remediation ?? null,
          aiDecisionId: f.aiDecisionId ?? null,
          waiverId: f.waiverId ?? null,
        })),
      },
    },
  });

  // Upsert POLICY_CHECK artifact
  const artifactData = {
    status: result.status,
    policyScore: result.policyScore,
    penalty: result.penalty,
    packId: pack.id,
    packName: pack.name,
    packVersion: pack.version,
    mode: pack.mode,
    coverage: result.coverage,
    applicableRules: result.applicableRules,
    evaluatedRules: result.evaluatedRules,
    criticalCount: result.criticalCount,
    highCount: result.highCount,
    mediumCount: result.mediumCount,
    lowCount: result.lowCount,
    waivedCount: result.waivedCount,
    needsReviewCount: result.needsReviewCount,
    findings: findings
      .filter((f) => f.status !== 'PASS')
      .map((f) => ({
        ruleCode: f.ruleCode,
        status: f.status,
        severity: f.severity,
        category: f.category,
        title: f.title,
        detail: f.detail,
        evidence: f.evidence,
        remediation: f.remediation,
        penaltyContribution: f.penaltyContribution ?? 0,
        method: f.method,
        confidence: f.confidence,
      })),
    evaluatedAt: new Date().toISOString(),
    inputsHash: result.inputsHash,
  };

  // Upsert POLICY_CHECK without relying on a specific unique constraint name
  try {
    const existingArt = await prisma.artifact.findFirst({
      where: { contractId, type: 'POLICY_CHECK' },
      select: { id: true },
    });
    if (existingArt) {
      await prisma.artifact.update({
        where: { id: existingArt.id },
        data: { data: artifactData },
      });
    } else {
      await prisma.artifact.create({
        data: {
          id: cuidLike(),
          contractId,
          tenantId,
          type: 'POLICY_CHECK',
          data: artifactData,
        },
      });
    }
  } catch (artErr) {
    // non-fatal — evaluation row is the source of truth
    console.warn('[policy] POLICY_CHECK artifact write failed', artErr);
  }

  // Blend risk score on ContractMetadata
  try {
    if (result.status !== 'INDETERMINATE') {
      const meta = await prisma.contractMetadata.findUnique({
        where: { contractId },
        select: { riskScore: true, artifactSummary: true },
      });
      const aiRisk = typeof meta?.riskScore === 'number' ? meta.riskScore : 50;
      const blended = Math.round(
        Math.min(100, Math.max(0, 0.7 * aiRisk + 0.3 * (100 - result.policyScore))),
      );
      const summary =
        meta?.artifactSummary && typeof meta.artifactSummary === 'object'
          ? (meta.artifactSummary as Record<string, unknown>)
          : {};
      await prisma.contractMetadata.upsert({
        where: { contractId },
        create: {
          contractId,
          tenantId,
          riskScore: blended,
          updatedBy: 'policy-evaluation',
          artifactSummary: {
            policyBlend: { aiRiskScore: aiRisk, policyScore: result.policyScore, blended },
          },
        },
        update: {
          riskScore: blended,
          artifactSummary: {
            ...summary,
            policyBlend: { aiRiskScore: aiRisk, policyScore: result.policyScore, blended },
          },
          updatedBy: 'policy-evaluation',
        },
      });
    }
  } catch {
    // non-fatal
  }

  // Update health score policy columns (best-effort)
  try {
    const violationCount =
      result.criticalCount + result.highCount + result.mediumCount + result.lowCount;
    await prisma.$executeRawUnsafe(
      `UPDATE contract_health_scores
       SET policy_score = $1,
           policy_violation_count = $2,
           policy_status = $3,
           updated_at = NOW()
       WHERE contract_id = $4 AND tenant_id = $5`,
      result.policyScore,
      violationCount,
      result.status,
      contractId,
      tenantId,
    );
  } catch {
    // table may not have columns yet in some envs
  }

  return { evaluationId };
}

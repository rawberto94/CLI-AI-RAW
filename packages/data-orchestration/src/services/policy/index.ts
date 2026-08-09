/**
 * Policy Pack evaluation public surface.
 */

import { createHash } from 'crypto';
import { prisma as prismaSingleton } from '../../lib/prisma';
import { buildContractFacts, factsHash } from './facts';
import { evaluateFieldRules } from './field-evaluator';
import { evaluatePatternRules } from './pattern-evaluator';
import { evaluateSemanticRules } from './semantic-evaluator';
import { persistPolicyEvaluation } from './persist';
import { resolvePacksForContract, ruleApplies } from './resolve';
import { scoreFindings, COVERAGE_THRESHOLD, MIN_RAW_TEXT_LENGTH } from './scoring';
import type {
  EvaluatePolicyPackArgs,
  FindingDraft,
  PolicyEvaluationResult,
  PolicyPackDef,
  PolicyRuleDef,
} from './types';

export * from './types';
export * from './operators';
export * from './scoring';
export * from './facts';
export * from './resolve';
export * from './field-evaluator';
export * from './pattern-evaluator';
export * from './playbook-import';
export { locateQuote } from './pattern-evaluator';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function inputsHash(packId: string, packVersion: number, rawTextHash: string, fHash: string): string {
  return sha256(`${packId}@${packVersion}|${rawTextHash}|${fHash}`);
}

async function loadApprovedWaivers(
  prisma: any,
  tenantId: string,
  contractId: string,
): Promise<Map<string, string>> {
  const now = new Date();
  try {
    const rows = await prisma.policyWaiver.findMany({
      where: {
        tenantId,
        contractId,
        status: 'approved',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true, ruleCode: true },
    });
    return new Map(rows.map((r: any) => [r.ruleCode, r.id]));
  } catch {
    return new Map();
  }
}

function applyWaivers(findings: FindingDraft[], waivers: Map<string, string>): FindingDraft[] {
  return findings.map((f) => {
    const wid = waivers.get(f.ruleCode);
    if (!wid) return f;
    return { ...f, waiverId: wid };
  });
}

async function evaluateSinglePack(args: {
  prisma: any;
  tenantId: string;
  contractId: string;
  pack: PolicyPackDef;
  rawText: string;
  facts: Awaited<ReturnType<typeof buildContractFacts>>;
  packResolution: string;
  triggeredBy: string;
  allowSemantic: boolean;
  dryRun: boolean;
}): Promise<PolicyEvaluationResult> {
  const {
    prisma,
    tenantId,
    contractId,
    pack,
    rawText,
    facts,
    packResolution,
    triggeredBy,
    allowSemantic,
    dryRun,
  } = args;

  const start = Date.now();
  const contractCtx = {
    contractType: facts.overview.contractType,
    contractCategoryId: null as string | null,
    totalValue: facts.financial.totalValue,
    currency: facts.financial.currency,
    jurisdiction: facts.overview.jurisdiction,
  };

  // Load category id for scoping
  try {
    const c = await prisma.contract.findFirst({
      where: { id: contractId },
      select: { contractCategoryId: true, contractType: true, totalValue: true, currency: true, jurisdiction: true },
    });
    if (c) {
      contractCtx.contractCategoryId = c.contractCategoryId;
      contractCtx.contractType = c.contractType ?? contractCtx.contractType;
      contractCtx.totalValue = c.totalValue != null ? Number(c.totalValue) : contractCtx.totalValue;
      contractCtx.currency = c.currency ?? contractCtx.currency;
      contractCtx.jurisdiction = c.jurisdiction ?? contractCtx.jurisdiction;
    }
  } catch {
    /* ignore */
  }

  const applicableRules = pack.rules.filter((r) => r.isActive !== false && ruleApplies(r, contractCtx));
  const fHash = factsHash(facts);
  const rawTextHash = sha256(rawText);
  const hash = inputsHash(pack.id, pack.version, rawTextHash, fHash);

  if (!dryRun) {
    try {
      const cached = await prisma.policyEvaluation.findUnique({
        where: {
          contractId_packId_inputsHash: {
            contractId,
            packId: pack.id,
            inputsHash: hash,
          },
        },
        include: { findings: true },
      });
      if (cached) {
        return {
          evaluationId: cached.id,
          packId: pack.id,
          packName: pack.name,
          packVersion: pack.version,
          status: cached.status,
          policyScore: cached.policyScore,
          penalty: cached.penalty,
          applicableRules: cached.applicableRules,
          evaluatedRules: cached.evaluatedRules,
          coverage: cached.coverage,
          criticalCount: cached.criticalCount,
          highCount: cached.highCount,
          mediumCount: cached.mediumCount,
          lowCount: cached.lowCount,
          waivedCount: cached.waivedCount,
          needsReviewCount: cached.needsReviewCount,
          findings: (cached.findings || []).map((f: any) => ({
            ruleId: f.ruleId,
            ruleCode: f.ruleCode,
            status: f.status,
            severity: f.severity,
            category: f.category,
            title: f.title,
            detail: f.detail,
            evidence: f.evidence || [],
            penaltyContribution: f.penaltyContribution,
            confidence: f.confidence,
            method: f.method,
            remediation: f.remediation,
            waiverId: f.waiverId,
          })),
          inputsHash: hash,
          cached: true,
          durationMs: Date.now() - start,
          mode: pack.mode,
          packResolution,
        };
      }
    } catch {
      /* table may not exist yet during tests */
    }
  }

  const fieldRules = applicableRules.filter((r) => r.kind === 'FIELD');
  const patternRules = applicableRules.filter((r) => r.kind === 'PATTERN');
  let semanticRules = applicableRules.filter((r) => r.kind === 'SEMANTIC');

  let findings: FindingDraft[] = [
    ...evaluateFieldRules({ rules: fieldRules, facts }),
    ...evaluatePatternRules({ rules: patternRules, rawText }),
  ];

  // Escalate FIELD/PATTERN unknowns to semantic when flagged
  const escalateCodes = new Set(
    findings.filter((f) => f.escalate && applicableRules.find((r) => r.code === f.ruleCode)?.escalateToSemantic).map((f) => f.ruleCode),
  );
  const escalated: PolicyRuleDef[] = applicableRules
    .filter((r) => escalateCodes.has(r.code) && r.semantic)
    .map((r) => ({ ...r, kind: 'SEMANTIC' as const, _forceSemantic: true } as any));
  semanticRules = [...semanticRules, ...escalated];

  let llmCalls = 0;
  let tokensUsed = 0;
  if (allowSemantic && semanticRules.length > 0) {
    const sem = await evaluateSemanticRules({
      rules: semanticRules,
      rawText,
      prisma: dryRun ? undefined : prisma,
      tenantId,
      contractId,
    });
    // Replace escalated field findings with semantic ones
    const semCodes = new Set(sem.findings.map((f) => f.ruleCode));
    findings = findings.filter((f) => !semCodes.has(f.ruleCode) || !escalateCodes.has(f.ruleCode));
    findings.push(...sem.findings);
    llmCalls = sem.llmCalls;
    tokensUsed = sem.tokensUsed;
  } else if (semanticRules.length > 0 && !allowSemantic) {
    findings.push(
      ...semanticRules.map((r) => ({
        ruleId: r.id,
        ruleCode: r.code,
        status: 'INSUFFICIENT_EVIDENCE' as const,
        severity: r.severity,
        category: r.category,
        title: r.title,
        detail: 'Semantic evaluation skipped (allowSemantic=false)',
        evidence: [],
        confidence: 0,
        method: 'semantic' as const,
        remediation: r.remediation,
        unevaluated: true,
      })),
    );
  }

  const waivers = dryRun ? new Map<string, string>() : await loadApprovedWaivers(prisma, tenantId, contractId);
  findings = applyWaivers(findings, waivers);

  const evaluatedRules = findings.filter((f) => !f.unevaluated).length;
  // For coverage: unevaluated missing facts reduce coverage
  const scored = scoreFindings({
    findings,
    applicableRules: applicableRules.length,
    evaluatedRules,
    rawTextLength: rawText.length,
    pack,
  });

  const result: PolicyEvaluationResult = {
    packId: pack.id,
    packName: pack.name,
    packVersion: pack.version,
    status: scored.status,
    policyScore: scored.policyScore,
    penalty: scored.penalty,
    applicableRules: applicableRules.length,
    evaluatedRules,
    coverage: applicableRules.length > 0 ? evaluatedRules / applicableRules.length : 0,
    criticalCount: scored.criticalCount,
    highCount: scored.highCount,
    mediumCount: scored.mediumCount,
    lowCount: scored.lowCount,
    waivedCount: scored.waivedCount,
    needsReviewCount: scored.needsReviewCount,
    findings: scored.findings,
    inputsHash: hash,
    llmCalls,
    tokensUsed,
    durationMs: Date.now() - start,
    mode: pack.mode,
    packResolution,
  };

  // Force INDETERMINATE when no rules / short text
  if (rawText.length < MIN_RAW_TEXT_LENGTH || applicableRules.length === 0) {
    result.status = 'INDETERMINATE';
    if (applicableRules.length === 0) {
      result.coverage = 0;
    }
  } else if (result.coverage < COVERAGE_THRESHOLD) {
    result.status = 'INDETERMINATE';
  }

  if (!dryRun) {
    const { evaluationId } = await persistPolicyEvaluation({
      prisma,
      tenantId,
      contractId,
      pack,
      result,
      findings: scored.findings,
      factsSnapshot: {
        resolvedPaths: Object.keys(facts._resolved),
        _packResolution: packResolution,
        document: facts.document,
      },
      triggeredBy,
      durationMs: result.durationMs,
      llmCalls,
      tokensUsed,
    });
    result.evaluationId = evaluationId;
  }

  return result;
}

/**
 * Evaluate contract against one or more applicable policy packs.
 * When multiple packs match by scope, findings are unioned (worst status wins).
 */
export async function evaluatePolicyPack(args: EvaluatePolicyPackArgs): Promise<PolicyEvaluationResult> {
  // Opt-out only when explicitly false; default enabled for API/manual checks.
  // Pipeline enqueue is gated separately by AUTO_POLICY_EVALUATION.
  if (process.env.POLICY_PACKS_ENABLED === 'false') {
    return {
      packId: args.packId || '',
      packVersion: 0,
      status: 'INDETERMINATE',
      policyScore: 100,
      penalty: 0,
      applicableRules: 0,
      evaluatedRules: 0,
      coverage: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      waivedCount: 0,
      needsReviewCount: 0,
      findings: [],
      inputsHash: '',
      packResolution: 'disabled',
    };
  }

  const prisma = args.prisma || prismaSingleton;
  const triggeredBy = args.triggeredBy || 'manual';
  const dryRun = Boolean(args.dryRun) || triggeredBy === 'dryrun';
  // Semantic rules opt-in (POLICY_SEMANTIC_RULES=true); default off for reproducibility
  const allowSemantic =
    args.allowSemantic !== undefined
      ? args.allowSemantic
      : process.env.POLICY_SEMANTIC_RULES === 'true' && !dryRun && triggeredBy !== 'backfill';

  const contract = await prisma.contract.findFirst({
    where: { id: args.contractId, tenantId: args.tenantId },
    select: { id: true, rawText: true },
  });
  if (!contract) {
    throw new Error('Contract not found');
  }

  const rawText = args.rawTextOverride ?? contract.rawText ?? '';
  const { packs, resolution } = await resolvePacksForContract({
    prisma,
    tenantId: args.tenantId,
    contractId: args.contractId,
    packId: args.packId,
  });

  if (packs.length === 0) {
    return {
      packId: '',
      packVersion: 0,
      status: 'INDETERMINATE',
      policyScore: 100,
      penalty: 0,
      applicableRules: 0,
      evaluatedRules: 0,
      coverage: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      waivedCount: 0,
      needsReviewCount: 0,
      findings: [],
      inputsHash: '',
      packResolution: resolution,
    };
  }

  const facts = await buildContractFacts({
    prisma,
    tenantId: args.tenantId,
    contractId: args.contractId,
    rawText,
  });

  const results: PolicyEvaluationResult[] = [];
  for (const pack of packs) {
    results.push(
      await evaluateSinglePack({
        prisma,
        tenantId: args.tenantId,
        contractId: args.contractId,
        pack,
        rawText,
        facts,
        packResolution: resolution,
        triggeredBy,
        allowSemantic,
        dryRun,
      }),
    );
  }

  // Merge: take worst status, min score, union findings
  if (results.length === 1) return results[0];

  const statusRank: Record<string, number> = {
    FAIL: 5,
    REVIEW: 4,
    INDETERMINATE: 3,
    PASS_WITH_NOTES: 2,
    PASS: 1,
  };
  const worst = results.reduce((a, b) =>
    (statusRank[b.status] || 0) > (statusRank[a.status] || 0) ? b : a,
  );
  return {
    ...worst,
    findings: results.flatMap((r) => r.findings),
    criticalCount: results.reduce((s, r) => s + r.criticalCount, 0),
    highCount: results.reduce((s, r) => s + r.highCount, 0),
    mediumCount: results.reduce((s, r) => s + r.mediumCount, 0),
    lowCount: results.reduce((s, r) => s + r.lowCount, 0),
    policyScore: Math.min(...results.map((r) => r.policyScore)),
    penalty: results.reduce((s, r) => s + r.penalty, 0),
    applicableRules: results.reduce((s, r) => s + r.applicableRules, 0),
    evaluatedRules: results.reduce((s, r) => s + r.evaluatedRules, 0),
  };
}

/**
 * Dry-run a pack against sample contracts (no persistence).
 */
export async function dryRunPolicyPack(args: {
  tenantId: string;
  packId: string;
  sampleSize?: number;
  prisma?: any;
}): Promise<{
  sampleSize: number;
  summary: {
    pass: number;
    passWithNotes: number;
    review: number;
    fail: number;
    indeterminate: number;
    avgScore: number;
    topViolations: Array<{ ruleCode: string; count: number; title: string }>;
  };
  samples: Array<{ contractId: string; status: string; policyScore: number; criticalCount: number }>;
}> {
  const prisma = args.prisma || prismaSingleton;
  const sampleSize = Math.min(args.sampleSize || 50, 200);

  const pack = await prisma.policyPack.findFirst({
    where: { id: args.packId, tenantId: args.tenantId },
    include: { rules: { where: { isActive: true } } },
  });
  if (!pack) throw new Error('Pack not found');

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId: args.tenantId,
      isDeleted: false,
      rawText: { not: null },
    },
    select: { id: true },
    take: sampleSize,
    orderBy: { createdAt: 'desc' },
  });

  const samples: Array<{ contractId: string; status: string; policyScore: number; criticalCount: number }> = [];
  const violationCounts = new Map<string, { count: number; title: string }>();
  const summary = { pass: 0, passWithNotes: 0, review: 0, fail: 0, indeterminate: 0, avgScore: 0, topViolations: [] as any[] };
  let scoreSum = 0;

  for (const c of contracts) {
    const result = await evaluatePolicyPack({
      tenantId: args.tenantId,
      contractId: c.id,
      packId: args.packId,
      triggeredBy: 'dryrun',
      allowSemantic: false,
      dryRun: true,
      prisma,
    });
    samples.push({
      contractId: c.id,
      status: result.status,
      policyScore: result.policyScore,
      criticalCount: result.criticalCount,
    });
    scoreSum += result.policyScore;
    if (result.status === 'PASS') summary.pass += 1;
    else if (result.status === 'PASS_WITH_NOTES') summary.passWithNotes += 1;
    else if (result.status === 'REVIEW') summary.review += 1;
    else if (result.status === 'FAIL') summary.fail += 1;
    else summary.indeterminate += 1;

    for (const f of result.findings) {
      if (f.status === 'PASS' || f.status === 'INSUFFICIENT_EVIDENCE') continue;
      const prev = violationCounts.get(f.ruleCode) || { count: 0, title: f.title };
      prev.count += 1;
      violationCounts.set(f.ruleCode, prev);
    }
  }

  summary.avgScore = contracts.length ? Math.round(scoreSum / contracts.length) : 0;
  summary.topViolations = [...violationCounts.entries()]
    .map(([ruleCode, v]) => ({ ruleCode, count: v.count, title: v.title }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { sampleSize: contracts.length, summary, samples };
}

export { resolvePacksForContract };

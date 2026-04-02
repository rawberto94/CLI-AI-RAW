import { getLegalReviewService } from 'data-orchestration/services';
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthApiHandler,
} from '@/lib/api-middleware';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRiskThresholds(riskThresholds: JsonRecord = {}) {
  const criticalCount = Number(
    riskThresholds.criticalCount ?? riskThresholds.criticalCountThreshold ?? 2,
  );
  const highRiskScore = Number(
    riskThresholds.highRiskScore ?? riskThresholds.highRiskScoreThreshold ?? 70,
  );
  const overallAcceptable = Number(
    riskThresholds.overallAcceptable ?? riskThresholds.acceptableScoreThreshold ?? 40,
  );

  return {
    criticalCount: Number.isFinite(criticalCount) ? criticalCount : 2,
    highRiskScore: Number.isFinite(highRiskScore) ? highRiskScore : 70,
    overallAcceptable: Number.isFinite(overallAcceptable) ? overallAcceptable : 40,
  };
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function unwrapPolicyPack(body: unknown): JsonRecord | undefined {
  const root = asRecord(body);
  if (!root) {
    return undefined;
  }

  const nested =
    asRecord(root.policyPack) ||
    asRecord(root.playbook) ||
    asRecord(root.data);

  const source = nested || root;

  return {
    ...source,
    contractTypes: source.contractTypes ?? source.contract_types,
    clauses: source.clauses,
    fallbackPositions:
      source.fallbackPositions ?? source.fallback_positions ?? source.fallbacks,
    riskThresholds:
      source.riskThresholds ?? source.risk_thresholds ?? source.thresholds,
    redFlags: source.redFlags ?? source.red_flags,
    preferredLanguage:
      source.preferredLanguage ?? source.preferred_language,
    isDefault: source.isDefault ?? source.is_default,
  };
}

function normalizeClauses(rawClauses: unknown) {
  if (!Array.isArray(rawClauses)) {
    return [];
  }

  return rawClauses
    .map((rawClause, index) => {
      const clause = asRecord(rawClause);
      if (!clause) {
        return undefined;
      }

      const category =
        asString(clause.category) ||
        asString(clause.type) ||
        asString(clause.key);
      const preferredText =
        asString(clause.preferredText) ||
        asString(clause.preferred_text) ||
        asString(clause.text) ||
        asString(clause.language);

      if (!category || !preferredText) {
        return undefined;
      }

      const riskLevel =
        asString(clause.riskLevel) ||
        asString(clause.risk_level) ||
        'medium';

      return {
        category,
        name:
          asString(clause.name) ||
          asString(clause.title) ||
          toTitleCase(category),
        preferredText,
        minimumAcceptable:
          asString(clause.minimumAcceptable) ||
          asString(clause.minimum_acceptable),
        walkawayTriggers:
          asStringList(clause.walkawayTriggers ?? clause.walkaway_triggers),
        riskLevel,
        notes: asString(clause.notes),
        negotiationGuidance:
          asString(clause.negotiationGuidance) ||
          asString(clause.negotiation_guidance),
        sortOrder: index,
      };
    })
    .filter((clause): clause is NonNullable<ReturnType<typeof normalizeClauses>[number]> => Boolean(clause));
}

function normalizeRedFlags(rawRedFlags: unknown) {
  if (!Array.isArray(rawRedFlags)) {
    return [];
  }

  return rawRedFlags
    .map((rawFlag) => {
      const redFlag = asRecord(rawFlag);
      if (!redFlag) {
        return undefined;
      }

      const pattern = asString(redFlag.pattern) || asString(redFlag.match);
      const category = asString(redFlag.category);
      const explanation = asString(redFlag.explanation);
      const suggestion = asString(redFlag.suggestion);

      if (!pattern || !category || !explanation || !suggestion) {
        return undefined;
      }

      return {
        pattern,
        category,
        severity:
          asString(redFlag.severity) ||
          asString(redFlag.riskLevel) ||
          'medium',
        explanation,
        suggestion,
        isRegex: Boolean(redFlag.isRegex ?? redFlag.is_regex),
      };
    })
    .filter((redFlag): redFlag is NonNullable<ReturnType<typeof normalizeRedFlags>[number]> => Boolean(redFlag));
}

function normalizeFallbackPositions(rawFallbacks: unknown) {
  const fallbackRecord = asRecord(rawFallbacks);
  if (!fallbackRecord) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fallbackRecord)
      .map(([category, rawValue]): [string, { initial: string; fallback1: string; fallback2: string | undefined; walkaway: string }] | undefined => {
        const value = asRecord(rawValue);
        if (!value) {
          return undefined;
        }

        const initial = asString(value.initial) || asString(value.preferred);
        const fallback1 = asString(value.fallback1) || asString(value.fallback_1);
        const fallback2 = asString(value.fallback2) || asString(value.fallback_2);

        if (!initial || !fallback1) {
          return undefined;
        }

        return [
          category,
          {
            initial,
            fallback1,
            fallback2,
            walkaway: asString(value.walkaway) || fallback2 || fallback1 || initial,
          },
        ];
      })
      .filter((entry): entry is [string, { initial: string; fallback1: string; fallback2: string | undefined; walkaway: string }] => Boolean(entry)),
  );
}

function normalizePreferredLanguage(rawPreferredLanguage: unknown) {
  const preferredLanguage = asRecord(rawPreferredLanguage);
  if (!preferredLanguage) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(preferredLanguage)
      .map(([category, text]) => [category, asString(text)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function buildClausesFromPreferredLanguage(preferredLanguage: Record<string, string>) {
  return Object.entries(preferredLanguage).map(([category, preferredText], index) => ({
    category,
    name: toTitleCase(category),
    preferredText,
    walkawayTriggers: [],
    riskLevel: 'medium',
    sortOrder: index,
  }));
}

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const body = await request.json();
  const policyPack = unwrapPolicyPack(body);

  if (!policyPack) {
    return createErrorResponse(
      ctx,
      'BAD_REQUEST',
      'Policy pack payload must be a JSON object.',
      400,
    );
  }

  const name = asString(policyPack.name);
  if (!name) {
    return createErrorResponse(
      ctx,
      'BAD_REQUEST',
      'Policy pack name is required.',
      400,
    );
  }

  const preferredLanguage = normalizePreferredLanguage(policyPack.preferredLanguage);
  const clauses = normalizeClauses(policyPack.clauses);
  const normalizedClauses = clauses.length > 0
    ? clauses
    : buildClausesFromPreferredLanguage(preferredLanguage);

  const playbook = await getLegalReviewService().createPlaybook({
    name,
    tenantId,
    description: asString(policyPack.description),
    contractTypes: asStringList(policyPack.contractTypes),
    clauses: normalizedClauses,
    fallbackPositions: normalizeFallbackPositions(policyPack.fallbackPositions),
    riskThresholds: normalizeRiskThresholds(asRecord(policyPack.riskThresholds) || {}),
    redFlags: normalizeRedFlags(policyPack.redFlags),
    isDefault: Boolean(policyPack.isDefault),
    createdBy: ctx.userId,
  });

  return createSuccessResponse(ctx, {
    success: true,
    playbook,
    imported: true,
  });
});
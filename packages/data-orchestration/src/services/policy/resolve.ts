/**
 * Resolve which policy packs apply to a contract.
 * Precedence: explicit contract.policyPackId → scope match → tenant default → none.
 */

import type { PolicyAppliesTo, PolicyPackDef, PolicyRuleDef } from './types';

function asAppliesTo(v: unknown): PolicyAppliesTo {
  if (!v || typeof v !== 'object') return {};
  return v as PolicyAppliesTo;
}

function normalizeSeverity(s: string): PolicyRuleDef['severity'] {
  const u = String(s || 'MEDIUM').toUpperCase();
  if (u === 'BLOCKER' || u === 'CRITICAL' || u === 'HIGH' || u === 'MEDIUM' || u === 'LOW') return u;
  return 'MEDIUM';
}

export function mapDbRule(r: any): PolicyRuleDef {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    kind: String(r.kind || 'FIELD').toUpperCase() as PolicyRuleDef['kind'],
    severity: normalizeSeverity(r.severity),
    category: r.category,
    appliesTo: asAppliesTo(r.appliesTo),
    assert: r.assert ?? null,
    match: r.match ?? null,
    semantic: r.semantic ?? null,
    escalateToSemantic: Boolean(r.escalateToSemantic),
    remediation: r.remediation,
    playbookClauseId: r.playbookClauseId,
    reference: r.reference,
    sortOrder: r.sortOrder ?? 0,
    isActive: r.isActive !== false,
  };
}

export function mapDbPack(p: any): PolicyPackDef {
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    version: p.version,
    status: p.status,
    mode: p.mode || 'advisory',
    scope: asAppliesTo(p.scope),
    scoring: (p.scoring as PolicyPackDef['scoring']) || {},
    isDefault: Boolean(p.isDefault),
    rules: (p.rules || []).filter((r: any) => r.isActive !== false).map(mapDbRule),
  };
}

export function scopeMatches(
  scope: PolicyAppliesTo | undefined,
  contract: {
    contractType?: string | null;
    contractCategoryId?: string | null;
    totalValue?: number | null;
    currency?: string | null;
    jurisdiction?: string | null;
  },
): boolean {
  if (!scope || Object.keys(scope).length === 0) return true;

  if (scope.contractTypes?.length) {
    const t = (contract.contractType || '').toUpperCase();
    if (!scope.contractTypes.some((ct) => ct.toUpperCase() === t)) return false;
  }
  if (scope.categoryIds?.length) {
    if (!contract.contractCategoryId || !scope.categoryIds.includes(contract.contractCategoryId)) {
      return false;
    }
  }
  if (scope.minValue != null && (contract.totalValue == null || Number(contract.totalValue) < scope.minValue)) {
    return false;
  }
  if (scope.maxValue != null && (contract.totalValue == null || Number(contract.totalValue) > scope.maxValue)) {
    return false;
  }
  if (scope.currency && contract.currency && scope.currency.toUpperCase() !== contract.currency.toUpperCase()) {
    return false;
  }
  if (scope.jurisdictions?.length) {
    const j = (contract.jurisdiction || '').toUpperCase();
    if (!j || !scope.jurisdictions.some((x) => x.toUpperCase() === j || j.includes(x.toUpperCase()))) {
      return false;
    }
  }
  return true;
}

export function ruleApplies(
  rule: PolicyRuleDef,
  contract: {
    contractType?: string | null;
    contractCategoryId?: string | null;
    totalValue?: number | null;
    currency?: string | null;
    jurisdiction?: string | null;
  },
): boolean {
  return scopeMatches(rule.appliesTo, contract);
}

export interface ResolvePacksResult {
  packs: PolicyPackDef[];
  resolution: string;
}

export async function resolvePacksForContract(args: {
  prisma: any;
  tenantId: string;
  contractId: string;
  packId?: string;
}): Promise<ResolvePacksResult> {
  const { prisma, tenantId, contractId, packId } = args;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      contractType: true,
      contractCategoryId: true,
      totalValue: true,
      currency: true,
      jurisdiction: true,
      policyPackId: true,
    },
  });

  if (!contract) {
    return { packs: [], resolution: 'contract_not_found' };
  }

  const includeRules = {
    rules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
  };

  // Explicit override: function arg or contract.policyPackId
  const explicitId = packId || contract.policyPackId;
  if (explicitId) {
    const pack = await prisma.policyPack.findFirst({
      where: { id: explicitId, tenantId, status: { in: ['active', 'draft'] } },
      include: includeRules,
    });
    if (pack) {
      return {
        packs: [mapDbPack(pack)],
        resolution: packId ? 'explicit_arg' : 'contract_policy_pack_id',
      };
    }
    // fall through if explicit pack missing/inactive
  }

  const activePacks = await prisma.policyPack.findMany({
    where: { tenantId, status: 'active' },
    include: includeRules,
    orderBy: [{ isDefault: 'desc' }, { publishedAt: 'desc' }],
  });

  const contractCtx = {
    contractType: contract.contractType,
    contractCategoryId: contract.contractCategoryId,
    totalValue: contract.totalValue != null ? Number(contract.totalValue) : null,
    currency: contract.currency,
    jurisdiction: contract.jurisdiction,
  };

  const scoped = activePacks.filter((p: any) => scopeMatches(asAppliesTo(p.scope), contractCtx));
  if (scoped.length > 0) {
    return {
      packs: scoped.map(mapDbPack),
      resolution: 'scope_match',
    };
  }

  const def = activePacks.find((p: any) => p.isDefault) || activePacks[0];
  if (def) {
    return {
      packs: [mapDbPack(def)],
      resolution: def.isDefault ? 'tenant_default' : 'first_active',
    };
  }

  return { packs: [], resolution: 'none' };
}

/**
 * Critical-field SSOT helpers — pure functions used by API + sync worker.
 * Canonical store: Contract columns (see docs/architecture/AGENT_TRUST_ADR.md).
 */

import {
  type FieldTrust,
  type FieldTrustValue,
  trustFromConfidence,
} from './field-trust';

export type CriticalFieldKey =
  | 'totalValue'
  | 'currency'
  | 'effectiveDate'
  | 'expirationDate'
  | 'parties'
  | 'autoRenewalEnabled'
  | 'noticePeriodDays';

export type CriticalFieldsMap = Record<CriticalFieldKey, FieldTrustValue>;

export interface CanonicalContractSlice {
  totalValue?: unknown;
  currency?: string | null;
  effectiveDate?: Date | string | null;
  expirationDate?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  clientName?: string | null;
  supplierName?: string | null;
  external_parties?: unknown;
  autoRenewalEnabled?: boolean | null;
  noticePeriodDays?: number | null;
  classificationConf?: number | null;
}

export interface DerivedMirrors {
  /** FINANCIAL / overview totalValue if present */
  artifactTotalValue?: number | null;
  artifactCurrency?: string | null;
  artifactEffectiveDate?: string | null;
  artifactExpirationDate?: string | null;
  /** parties artifact / overview parties */
  artifactParties?: Array<{ legalName?: string; name?: string; role?: string }>;
  fieldConfidence?: Record<string, number | { value?: number }>;
  /** pending agent write on this field */
  pendingAgentFields?: string[];
  /** human verified field keys */
  verifiedFields?: string[];
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as any).toNumber === 'function') {
    try {
      const n = (v as any).toNumber();
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return null;
}

function confFor(field: string, mirrors?: DerivedMirrors): number | null {
  const map = mirrors?.fieldConfidence;
  if (!map) return null;
  const raw = map[field] ?? map[field.replace(/([A-Z])/g, '_$1').toLowerCase()];
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw === 'object' && typeof raw.value === 'number') return raw.value;
  return null;
}

function resolveTrust(
  hasValue: boolean,
  field: string,
  mirrors: DerivedMirrors | undefined,
  conflict: boolean,
): FieldTrust {
  if (conflict) return 'conflict';
  if (!hasValue) return 'missing';
  if (mirrors?.pendingAgentFields?.includes(field)) return 'pending_agent';
  if (mirrors?.verifiedFields?.includes(field)) return 'canonical_verified';
  const c = confFor(field, mirrors);
  if (c != null) return trustFromConfidence(c);
  // Present on Contract without confidence → treat as AI-applied high enough to show
  return 'ai_high';
}

/** Build external_parties-style list from canonical client/supplier names. */
export function derivePartiesFromCanonical(contract: CanonicalContractSlice): Array<{
  legalName: string;
  role: string;
}> {
  const parties: Array<{ legalName: string; role: string }> = [];
  if (contract.clientName?.trim()) {
    parties.push({ legalName: contract.clientName.trim(), role: 'Client' });
  }
  if (contract.supplierName?.trim()) {
    parties.push({ legalName: contract.supplierName.trim(), role: 'Supplier' });
  }
  return parties;
}

/**
 * Whether legacy UI may invent external_parties from clientName/supplierName.
 * Default true until sync enforcer has been validated in prod.
 */
export function isLegacyPartyFallbackEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.LEGACY_PARTY_FALLBACK;
  if (raw == null || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase());
}

/** Material TCV drift (>5% and >100 absolute). */
export function hasTcvDrift(canonical: number | null, artifact: number | null | undefined): boolean {
  if (canonical == null || artifact == null) return false;
  if (canonical <= 0 || artifact <= 0) return false;
  const abs = Math.abs(canonical - artifact);
  const rel = abs / Math.max(canonical, artifact);
  return abs > 100 && rel > 0.05;
}

export function buildCriticalFields(
  contract: CanonicalContractSlice,
  mirrors: DerivedMirrors = {},
): CriticalFieldsMap {
  const totalValue = toNumber(contract.totalValue);
  const currency = contract.currency?.trim() || null;
  const effectiveDate =
    toIsoDate(contract.effectiveDate) || toIsoDate(contract.startDate);
  const expirationDate =
    toIsoDate(contract.expirationDate) || toIsoDate(contract.endDate);

  const tcvConflict = hasTcvDrift(totalValue, mirrors.artifactTotalValue ?? null);

  const partiesFromExternal = Array.isArray(contract.external_parties)
    ? (contract.external_parties as Array<Record<string, unknown>>)
        .map((p) => ({
          legalName: String(p.legalName || p.name || '').trim(),
          role: String(p.role || 'Party'),
        }))
        .filter((p) => p.legalName)
    : [];
  const parties =
    partiesFromExternal.length > 0
      ? partiesFromExternal
      : derivePartiesFromCanonical(contract);

  const partiesConflict =
    (mirrors.artifactParties?.length ?? 0) > 0 &&
    parties.length > 0 &&
    !parties.some((p) =>
      mirrors.artifactParties!.some(
        (a) =>
          (a.legalName || a.name || '').toLowerCase() === p.legalName.toLowerCase(),
      ),
    );

  const dateConflict =
    !!effectiveDate &&
    !!mirrors.artifactEffectiveDate &&
    effectiveDate !== mirrors.artifactEffectiveDate.slice(0, 10);

  return {
    totalValue: {
      value: totalValue,
      trust: resolveTrust(totalValue != null, 'totalValue', mirrors, tcvConflict),
      confidence: confFor('totalValue', mirrors) ?? confFor('tcv_amount', mirrors),
    },
    currency: {
      value: currency,
      trust: resolveTrust(!!currency, 'currency', mirrors, false),
      confidence: confFor('currency', mirrors),
    },
    effectiveDate: {
      value: effectiveDate,
      trust: resolveTrust(!!effectiveDate, 'effectiveDate', mirrors, dateConflict),
      confidence: confFor('effectiveDate', mirrors) ?? confFor('start_date', mirrors),
    },
    expirationDate: {
      value: expirationDate,
      trust: resolveTrust(
        !!expirationDate,
        'expirationDate',
        mirrors,
        !!expirationDate &&
          !!mirrors.artifactExpirationDate &&
          expirationDate !== mirrors.artifactExpirationDate.slice(0, 10),
      ),
      confidence: confFor('expirationDate', mirrors) ?? confFor('end_date', mirrors),
    },
    parties: {
      value: parties,
      trust: resolveTrust(parties.length > 0, 'parties', mirrors, partiesConflict),
      confidence: confFor('parties', mirrors),
    },
    autoRenewalEnabled: {
      value: contract.autoRenewalEnabled ?? null,
      trust: resolveTrust(
        contract.autoRenewalEnabled != null,
        'autoRenewalEnabled',
        mirrors,
        false,
      ),
      confidence: confFor('autoRenewalEnabled', mirrors),
    },
    noticePeriodDays: {
      value: contract.noticePeriodDays ?? null,
      trust: resolveTrust(
        contract.noticePeriodDays != null,
        'noticePeriodDays',
        mirrors,
        false,
      ),
      confidence: confFor('noticePeriodDays', mirrors),
    },
  };
}

export interface CriticalFieldDrift {
  field: CriticalFieldKey | string;
  canonical: unknown;
  derived: unknown;
  severity: 'warning' | 'error';
}

export function collectCriticalFieldDrift(
  fields: CriticalFieldsMap,
  mirrors: DerivedMirrors,
): CriticalFieldDrift[] {
  const drifts: CriticalFieldDrift[] = [];
  if (fields.totalValue.trust === 'conflict') {
    drifts.push({
      field: 'totalValue',
      canonical: fields.totalValue.value,
      derived: mirrors.artifactTotalValue,
      severity: 'error',
    });
  }
  if (fields.parties.trust === 'conflict') {
    drifts.push({
      field: 'parties',
      canonical: fields.parties.value,
      derived: mirrors.artifactParties,
      severity: 'warning',
    });
  }
  if (fields.effectiveDate.trust === 'conflict') {
    drifts.push({
      field: 'effectiveDate',
      canonical: fields.effectiveDate.value,
      derived: mirrors.artifactEffectiveDate,
      severity: 'warning',
    });
  }
  if (fields.expirationDate.trust === 'conflict') {
    drifts.push({
      field: 'expirationDate',
      canonical: fields.expirationDate.value,
      derived: mirrors.artifactExpirationDate,
      severity: 'warning',
    });
  }
  return drifts;
}

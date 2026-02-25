/**
 * Unified Contract Filtering
 *
 * A single pure function that filters contracts against all supported
 * dimensions.  Designed to be called inside a useMemo – no hooks, no
 * side-effects, fully testable.
 *
 * Usage:
 *   const filtered = applyContractFilters(contracts, criteria);
 */

import type { Contract } from '@/hooks/use-queries';
import type { FilterState } from '@/components/contracts/AdvancedFilterPanel';
import { DATE_PRESETS, VALUE_RANGES } from './filter-constants';

// ── Public criteria type ────────────────────────────────────────────
export interface ContractFilterCriteria {
  /** Free-text search (title, filename, parties, type, category) */
  searchQuery?: string;
  /** AdvancedFilterPanel state (status, roles, risk, supplier, client, …).
   *  Partial is accepted — omitted dimensions are treated as "match all". */
  filterState: Partial<FilterState>;
  /** Preset-based date range key (e.g. 'week', 'month', 'quarter') */
  dateRangePreset?: string | null;
  /** Expiration bucket filters (e.g. ['expired', 'expiring-30']) */
  expirationFilters?: string[];
  /** Signature status filters */
  signatureFilters?: string[];
  /** Document classification filters */
  documentTypeFilters?: string[];
  /** Preset-based value range key (e.g. 'under10k', '10k-50k') */
  valueRangePreset?: string | null;
}

// ── Matchers (private helpers) ──────────────────────────────────────

function matchesSearch(c: Contract, q: string | undefined): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (c.title?.toLowerCase().includes(lower) ?? false) ||
    (c.filename?.toLowerCase().includes(lower) ?? false) ||
    (c.parties?.client?.toLowerCase().includes(lower) ?? false) ||
    (c.parties?.supplier?.toLowerCase().includes(lower) ?? false) ||
    (c.clientName?.toLowerCase().includes(lower) ?? false) ||
    (c.supplierName?.toLowerCase().includes(lower) ?? false) ||
    (c.type?.toLowerCase().includes(lower) ?? false) ||
    (c.category?.name?.toLowerCase().includes(lower) ?? false)
  );
}

function matchesStatuses(c: Contract, statuses: string[] | undefined): boolean {
  if (!statuses?.length) return true;
  return statuses.some((s) => s.toLowerCase() === c.status?.toLowerCase());
}

function matchesDocumentRoles(c: Contract, roles: string[] | undefined): boolean {
  if (!roles?.length) return true;
  return roles.includes(c.documentRole || '');
}

function matchesRiskLevels(c: Contract, levels: string[] | undefined): boolean {
  if (!levels?.length) return true;
  if (c.riskScore === undefined || c.riskScore === null) return false;
  return levels.some((risk) => {
    switch (risk.toLowerCase()) {
      case 'low':      return c.riskScore! >= 0  && c.riskScore! < 30;
      case 'medium':   return c.riskScore! >= 30 && c.riskScore! < 70;
      case 'high':     return c.riskScore! >= 70 && c.riskScore! < 90;
      case 'critical': return c.riskScore! >= 90;
      default:         return false;
    }
  });
}

function matchesCategories(c: Contract, cats: string[] | undefined): boolean {
  if (!cats?.length) return true;
  return cats.some((cat) =>
    cat === 'uncategorized' ? !c.category : c.category?.id === cat,
  );
}

function matchesArrayField(
  contractValue: string | undefined,
  filterValues: string[] | undefined,
  titleFallback?: string,
): boolean {
  if (!filterValues?.length) return true;
  return filterValues.some((fv) => {
    const lower = fv.toLowerCase();
    return (
      contractValue?.toLowerCase().includes(lower) ||
      titleFallback?.toLowerCase().includes(lower) ||
      false
    );
  });
}

function matchesContractTypes(c: Contract, types: string[] | undefined): boolean {
  if (!types?.length) return true;
  return c.type ? types.some((t) => t.toLowerCase() === c.type!.toLowerCase()) : false;
}

function matchesDateRangeAdvanced(
  c: Contract,
  range: { from?: Date; to?: Date } | undefined,
): boolean {
  if (!range || (!range.from && !range.to)) return true;
  if (!c.createdAt) return true; // don't exclude contracts without a date
  const created = new Date(c.createdAt);
  if (range.from && created < range.from) return false;
  if (range.to && created > range.to) return false;
  return true;
}

function matchesDateRangePreset(
  c: Contract,
  preset: string | null | undefined,
  now: Date,
): boolean {
  if (!preset) return true;
  const config = DATE_PRESETS.find((p) => p.value === preset);
  if (!config || !c.createdAt) return true;
  const created = new Date(c.createdAt);
  const cutoff = new Date(now.getTime() - config.days * 86_400_000);
  return created >= cutoff;
}

function matchesValueRangeSlider(
  c: Contract,
  range: { min: number; max: number } | undefined,
): boolean {
  if (!range || (range.min <= 0 && range.max >= 1_000_000)) return true;
  const val = c.value ?? c.totalValue ?? 0;
  if (range.min > 0 && val < range.min) return false;
  if (range.max < 1_000_000 && val > range.max) return false;
  return true;
}

function matchesValueRangePreset(
  c: Contract,
  preset: string | null | undefined,
): boolean {
  if (!preset) return true;
  const config = VALUE_RANGES.find((r) => r.value === preset);
  if (!config) return true;
  const val = c.value ?? c.totalValue ?? 0;
  return val >= config.min && val < config.max;
}

function matchesExpiration(
  c: Contract,
  filters: string[] | undefined,
  now: Date,
): boolean {
  if (!filters?.length) return true;
  return filters.some((f) => {
    if (!c.expirationDate && f === 'no-expiry') return true;
    if (!c.expirationDate) return false;
    const days = Math.ceil(
      (new Date(c.expirationDate).getTime() - now.getTime()) / 86_400_000,
    );
    switch (f) {
      case 'expired':      return days < 0;
      case 'expiring-7':   return days >= 0 && days <= 7;
      case 'expiring-30':  return days >= 0 && days <= 30;
      case 'expiring-90':  return days >= 0 && days <= 90;
      default:             return true;
    }
  });
}

function matchesHasDeadline(
  c: Contract,
  flag: boolean | null | undefined,
): boolean {
  if (flag == null) return true;
  return flag ? !!c.expirationDate : !c.expirationDate;
}

function matchesIsExpiring(
  c: Contract,
  flag: boolean | null | undefined,
  now: Date,
): boolean {
  if (flag == null || !flag) return true;
  if (!c.expirationDate) return false;
  const days = Math.ceil(
    (new Date(c.expirationDate).getTime() - now.getTime()) / 86_400_000,
  );
  return days >= 0 && days <= 30;
}

function matchesSignature(
  c: Contract,
  filters: string[] | undefined,
): boolean {
  if (!filters?.length) return true;
  return filters.includes(c.signatureStatus || 'unknown');
}

function matchesDocumentType(
  c: Contract,
  filters: string[] | undefined,
): boolean {
  if (!filters?.length) return true;
  return filters.includes(c.documentClassification || 'contract');
}

// ── Main filter function ────────────────────────────────────────────

/**
 * Applies all filter criteria to a list of contracts and returns the
 * matching subset.  Pure function — safe for useMemo.
 */
export function applyContractFilters(
  contracts: Contract[],
  criteria: ContractFilterCriteria,
): Contract[] {
  if (!Array.isArray(contracts)) return [];

  const { filterState: f, searchQuery, dateRangePreset, expirationFilters,
    signatureFilters, documentTypeFilters, valueRangePreset } = criteria;
  const now = new Date();

  return contracts.filter((c) =>
    matchesSearch(c, searchQuery) &&
    matchesStatuses(c, f.statuses) &&
    matchesDocumentRoles(c, f.documentRoles) &&
    matchesRiskLevels(c, f.riskLevels) &&
    matchesCategories(c, f.categories) &&
    matchesContractTypes(c, f.contractTypes) &&
    matchesArrayField(c.parties?.supplier ?? c.supplierName, f.suppliers) &&
    matchesArrayField(c.parties?.client ?? c.clientName, f.clients) &&
    matchesArrayField(c.currency, f.currencies, c.title) &&
    matchesArrayField(c.jurisdiction, f.jurisdictions, c.title) &&
    matchesArrayField(c.paymentTerms, f.paymentTerms, c.title) &&
    matchesDateRangeAdvanced(c, f.dateRange) &&
    matchesDateRangePreset(c, dateRangePreset, now) &&
    matchesValueRangeSlider(c, f.valueRange) &&
    matchesValueRangePreset(c, valueRangePreset) &&
    matchesExpiration(c, expirationFilters, now) &&
    matchesHasDeadline(c, f.hasDeadline) &&
    matchesIsExpiring(c, f.isExpiring, now) &&
    matchesSignature(c, signatureFilters) &&
    matchesDocumentType(c, documentTypeFilters),
  );
}

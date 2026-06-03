/**
 * useContractsPageFilters – Filter state, derived values, handlers,
 * pagination, sorting, and server query params for the contracts list page.
 *
 * Does NOT hold `filteredContracts` / `sortedContracts` because those
 * depend on `contracts` data fetched via useContracts (called after this hook).
 */
"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type SetStateAction } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { FilterState, DEFAULT_FILTER_STATE } from "@/lib/contracts/filter-state";
import { type SavedSearch } from "@/components/contracts/SavedSearchPresets";
import {
  DATE_PRESETS,
  type SortField,
  type SortDirection,
  VALUE_RANGES,
  mapSortFieldToApi,
} from "@/lib/contracts/filter-constants";

// ── Status normalization ─────────────────────────────────────────────
const UI_STATUS_TO_API_STATUS = {
  uploaded: 'UPLOADED',
  processing: 'PROCESSING',
  completed: 'COMPLETED',
  failed: 'FAILED',
  archived: 'ARCHIVED',
} as const;

const STATUS_ALIASES: Record<string, keyof typeof UI_STATUS_TO_API_STATUS> = {
  uploaded: 'uploaded',
  pending: 'uploaded',
  processing: 'processing',
  queued: 'processing',
  completed: 'completed',
  active: 'completed',
  failed: 'failed',
  archived: 'archived',
};

function normalizeStatusValue(value: string): keyof typeof UI_STATUS_TO_API_STATUS | null {
  const normalized = value.trim().toLowerCase();
  return STATUS_ALIASES[normalized] ?? null;
}

function normalizeStatuses(values: string[] = []): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeStatusValue)
        .filter((value): value is keyof typeof UI_STATUS_TO_API_STATUS => value !== null),
    ),
  );
}

function normalizeFilterState(filters: FilterState): FilterState {
  return {
    ...filters,
    statuses: normalizeStatuses(filters.statuses),
    tags: filters.tags ?? [],
    metadataIssues: filters.metadataIssues ?? [],
  };
}

// ── Date helpers ─────────────────────────────────────────────────────
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

// ── URL serialization ────────────────────────────────────────────────
function filtersToParams(
  filterState: FilterState,
  searchQuery: string,
  searchScope: SearchScope,
  accessScope: 'all' | 'mine',
  sortField: SortField,
  sortDirection: SortDirection,
  page: number,
  pageSize: number,
): URLSearchParams {
  const p = new URLSearchParams();

  if (searchQuery.trim()) p.set('q', searchQuery.trim());
  if (searchScope !== 'all') p.set('scope_field', searchScope);
  if (filterState.statuses.length) p.set('status', filterState.statuses.join(','));
  if (filterState.documentRoles.length) p.set('role', filterState.documentRoles.join(','));
  if (filterState.riskLevels.length) p.set('risk', filterState.riskLevels.join(','));
  if (filterState.categories.length) p.set('category', filterState.categories.join(','));
  if (filterState.suppliers.length) p.set('supplier', filterState.suppliers.join(','));
  if (filterState.clients.length) p.set('client', filterState.clients.join(','));
  if (filterState.contractTypes.length) p.set('type', filterState.contractTypes.join(','));
  if (filterState.currencies.length) p.set('currency', filterState.currencies.join(','));
  if (filterState.jurisdictions.length) p.set('jurisdiction', filterState.jurisdictions.join(','));
  if (filterState.paymentTerms.length) p.set('payment', filterState.paymentTerms.join(','));
  if (filterState.tags.length) p.set('tag', filterState.tags.join(','));
  if (filterState.metadataIssues.length) p.set('metadata', filterState.metadataIssues.join(','));
  if (filterState.relationshipType.length) p.set('rel', filterState.relationshipType.join(','));

  if (filterState.dateRangePreset) p.set('datePreset', filterState.dateRangePreset);
  if (filterState.dateRange.from) p.set('from', filterState.dateRange.from.toISOString());
  if (filterState.dateRange.to) p.set('to', filterState.dateRange.to.toISOString());

  if (filterState.valueRangePreset) p.set('valuePreset', filterState.valueRangePreset);
  if (filterState.valueRange.min > 0) p.set('minValue', String(filterState.valueRange.min));
  if (filterState.valueRange.max < 1000000) p.set('maxValue', String(filterState.valueRange.max));

  if (filterState.expirationFilters.length) p.set('exp', filterState.expirationFilters.join(','));
  if (filterState.signatureFilters.length) p.set('sig', filterState.signatureFilters.join(','));
  if (filterState.documentTypeFilters.length) p.set('docType', filterState.documentTypeFilters.join(','));

  if (filterState.hasDeadline === true) p.set('deadline', 'true');
  if (filterState.isExpiring === true) p.set('expiring', 'true');

  if (accessScope !== 'all') p.set('scope', accessScope);
  if (sortField !== 'createdAt') p.set('sort', sortField);
  if (sortDirection !== 'desc') p.set('order', sortDirection);
  if (page !== 1) p.set('page', String(page));
  if (pageSize !== 25) p.set('limit', String(pageSize));

  return p;
}

function parseDateSafe(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function paramsToFilters(p: URLSearchParams): Partial<FilterState> {
  const result: Partial<FilterState> = {};

  const statuses = parseStringArray(p.get('status'));
  if (statuses.length) result.statuses = statuses;

  const roles = parseStringArray(p.get('role'));
  if (roles.length) result.documentRoles = roles;

  const risks = parseStringArray(p.get('risk'));
  if (risks.length) result.riskLevels = risks;

  const categories = parseStringArray(p.get('category'));
  if (categories.length) result.categories = categories;

  const suppliers = parseStringArray(p.get('supplier'));
  if (suppliers.length) result.suppliers = suppliers;

  const clients = parseStringArray(p.get('client'));
  if (clients.length) result.clients = clients;

  const types = parseStringArray(p.get('type'));
  if (types.length) result.contractTypes = types;

  const currencies = parseStringArray(p.get('currency'));
  if (currencies.length) result.currencies = currencies;

  const jurisdictions = parseStringArray(p.get('jurisdiction'));
  if (jurisdictions.length) result.jurisdictions = jurisdictions;

  const payments = parseStringArray(p.get('payment'));
  if (payments.length) result.paymentTerms = payments;

  const tags = parseStringArray(p.get('tag'));
  if (tags.length) result.tags = tags;

  const metadata = parseStringArray(p.get('metadata'));
  if (metadata.length) result.metadataIssues = metadata;

  const rel = parseStringArray(p.get('rel'));
  if (rel.length) result.relationshipType = rel;

  const exp = parseStringArray(p.get('exp'));
  if (exp.length) result.expirationFilters = exp;

  const sig = parseStringArray(p.get('sig'));
  if (sig.length) result.signatureFilters = sig;

  const docType = parseStringArray(p.get('docType'));
  if (docType.length) result.documentTypeFilters = docType;

  const datePreset = p.get('datePreset');
  if (datePreset) result.dateRangePreset = datePreset;

  const from = parseDateSafe(p.get('from'));
  const to = parseDateSafe(p.get('to'));
  if (from || to) result.dateRange = { from, to };

  const valuePreset = p.get('valuePreset');
  if (valuePreset) result.valueRangePreset = valuePreset;

  const minValue = p.get('minValue');
  const maxValue = p.get('maxValue');
  if (minValue !== null || maxValue !== null) {
    result.valueRange = {
      min: minValue !== null ? Number(minValue) : 0,
      max: maxValue !== null ? Number(maxValue) : 1000000,
    };
  }

  const deadline = p.get('deadline');
  if (deadline === 'true') result.hasDeadline = true;
  if (deadline === 'false') result.hasDeadline = false;

  const expiring = p.get('expiring');
  if (expiring === 'true') result.isExpiring = true;
  if (expiring === 'false') result.isExpiring = false;

  return result;
}

// ── Hook ─────────────────────────────────────────────────────────────
export type SearchScope = 'all' | 'title' | 'supplier' | 'client' | 'type' | 'tags' | 'jurisdiction';

export function useContractsPageFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Parse URL on mount ─────────────────────────────────────────────
  const urlFilters = useMemo(() => paramsToFilters(searchParams), [searchParams]);

  // ── Core filter state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [searchScope, setSearchScope] = useState<SearchScope>(() => {
    const s = searchParams.get('scope_field');
    const allowed: SearchScope[] = ['all', 'title', 'supplier', 'client', 'type', 'tags', 'jurisdiction'];
    return allowed.includes(s as SearchScope) ? (s as SearchScope) : 'all';
  });

  // Debounce search query for server requests (300ms)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const [filterStateValue, setFilterStateValue] = useState<FilterState>(() =>
    normalizeFilterState({ ...DEFAULT_FILTER_STATE, ...urlFilters }),
  );

  const setFilterState = useCallback((value: SetStateAction<FilterState>) => {
    setFilterStateValue((current) => {
      const next = typeof value === 'function'
        ? (value as (prevState: FilterState) => FilterState)(current)
        : value;
      return normalizeFilterState(next);
    });
  }, []);

  const filterState = filterStateValue;

  // ── Pagination & sorting ───────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(() => {
    const p = searchParams.get('page');
    return p ? Math.max(1, Number(p)) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const p = searchParams.get('limit');
    return p ? Number(p) : 25;
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    const p = searchParams.get('sort');
    const allowed: SortField[] = ['title', 'createdAt', 'value', 'expirationDate', 'status', 'tags'];
    return allowed.includes(p as SortField) ? (p as SortField) : 'createdAt';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const p = searchParams.get('order');
    return p === 'asc' ? 'asc' : 'desc';
  });
  const [accessScope, setAccessScope] = useState<'all' | 'mine'>(() => {
    const p = searchParams.get('scope');
    return p === 'mine' ? 'mine' : 'all';
  });

  // ── Search scope label ─────────────────────────────────────────────
  const searchScopeLabel = useMemo(() => {
    switch (searchScope) {
      case 'title': return 'Title';
      case 'supplier': return 'Supplier';
      case 'client': return 'Client';
      case 'type': return 'Type';
      case 'tags': return 'Tags';
      case 'jurisdiction': return 'Jurisdiction';
      default: return 'All fields';
    }
  }, [searchScope]);

  // ── Sync to URL on change ──────────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = filtersToParams(
      filterState,
      searchQuery,
      searchScope,
      accessScope,
      sortField,
      sortDirection,
      currentPage,
      pageSize,
    );
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [
    filterState,
    searchQuery,
    searchScope,
    accessScope,
    sortField,
    sortDirection,
    currentPage,
    pageSize,
    pathname,
    router,
  ]);

  // ── Server-side filter params ──────────────────────────────────────
  const effectiveValueRange = useMemo(() => {
    let min = filterState.valueRange.min;
    let max = filterState.valueRange.max;
    if (filterState.valueRangePreset) {
      const preset = VALUE_RANGES.find((r) => r.value === filterState.valueRangePreset);
      if (preset) {
        min = Math.max(min, preset.min);
        max = Math.min(max, preset.max === Infinity ? max : preset.max);
      }
    }
    return {
      min: min > 0 ? min : undefined,
      max: max < 1000000 ? max : undefined,
    };
  }, [filterState.valueRange, filterState.valueRangePreset]);

  const effectiveUploadedRange = useMemo(() => {
    let from = filterState.dateRange.from ? startOfDay(filterState.dateRange.from) : undefined;
    let to = filterState.dateRange.to ? endOfDay(filterState.dateRange.to) : undefined;

    if (filterState.dateRangePreset) {
      const preset = DATE_PRESETS.find((item) => item.value === filterState.dateRangePreset);
      if (preset) {
        const presetFrom = startOfDay(new Date(Date.now() - preset.days * 86_400_000));
        const presetTo = endOfDay(new Date());

        from = from ? new Date(Math.max(from.getTime(), presetFrom.getTime())) : presetFrom;
        to = to ? new Date(Math.min(to.getTime(), presetTo.getTime())) : presetTo;
      }
    }

    return { from, to };
  }, [filterState.dateRange, filterState.dateRangePreset]);

  /** Ready-to-use params object for `useContracts(serverParams, opts)`. */
  const serverParams = useMemo(
    () => ({
      status: filterState.statuses.length > 0 ? filterState.statuses : undefined,
      page: currentPage,
      limit: pageSize,
      sortBy: mapSortFieldToApi(sortField),
      sortOrder: sortDirection,
      search: debouncedSearch || undefined,
      documentRole: filterState.documentRoles.length > 0 ? filterState.documentRoles : undefined,
      riskLevel: filterState.riskLevels?.length ? filterState.riskLevels : undefined,
      contractType: filterState.contractTypes.length > 0 ? filterState.contractTypes : undefined,
      category: filterState.categories.length > 0 ? filterState.categories : undefined,
      clientName: filterState.clients?.length ? filterState.clients : undefined,
      supplierName: filterState.suppliers?.length ? filterState.suppliers : undefined,
      currency: filterState.currencies?.length ? filterState.currencies : undefined,
      jurisdiction: filterState.jurisdictions?.length ? filterState.jurisdictions : undefined,
      paymentTerms: filterState.paymentTerms?.length ? filterState.paymentTerms : undefined,
      tags: filterState.tags?.length ? filterState.tags : undefined,
      metadataIssue: filterState.metadataIssues?.length ? filterState.metadataIssues : undefined,
      relationshipType: filterState.relationshipType?.length ? filterState.relationshipType : undefined,
      signatureStatus: filterState.signatureFilters.length > 0 ? filterState.signatureFilters : undefined,
      documentClassification: filterState.documentTypeFilters.length > 0 ? filterState.documentTypeFilters : undefined,
      expirationFilter: filterState.expirationFilters.length > 0 ? filterState.expirationFilters : undefined,
      hasDeadline: filterState.hasDeadline === true ? 'true' : undefined,
      isExpiring: filterState.isExpiring === true ? 'true' : undefined,
      minValue: effectiveValueRange.min,
      maxValue: effectiveValueRange.max,
      uploadedAfter: effectiveUploadedRange.from?.toISOString(),
      uploadedBefore: effectiveUploadedRange.to?.toISOString(),
      accessScope,
    }),
    [
      currentPage,
      pageSize,
      sortField,
      sortDirection,
      debouncedSearch,
      filterState,
      effectiveValueRange,
      effectiveUploadedRange,
      accessScope,
    ],
  );

  // ── Active-filter indicators ───────────────────────────────────────
  const hasActiveFilters = Boolean(
    searchQuery ||
      searchScope !== 'all' ||
      filterState.statuses.length > 0 ||
      filterState.documentRoles.length > 0 ||
      filterState.categories.length > 0 ||
      filterState.hasDeadline !== null ||
      filterState.isExpiring !== null ||
      (filterState.riskLevels?.length ?? 0) > 0 ||
      (filterState.suppliers?.length ?? 0) > 0 ||
      (filterState.clients?.length ?? 0) > 0 ||
      (filterState.contractTypes?.length ?? 0) > 0 ||
      (filterState.currencies?.length ?? 0) > 0 ||
      (filterState.jurisdictions?.length ?? 0) > 0 ||
      (filterState.paymentTerms?.length ?? 0) > 0 ||
      (filterState.tags?.length ?? 0) > 0 ||
      (filterState.metadataIssues?.length ?? 0) > 0 ||
      (filterState.relationshipType?.length ?? 0) > 0 ||
      filterState.valueRangePreset ||
      filterState.dateRangePreset ||
      filterState.expirationFilters.length > 0 ||
      filterState.signatureFilters.length > 0 ||
      filterState.documentTypeFilters.length > 0 ||
      filterState.dateRange.from ||
      filterState.dateRange.to ||
      filterState.valueRange.min > 0 ||
      filterState.valueRange.max < 1000000,
  );

  const activeFilterCount = [
    searchQuery ? 1 : 0,
    searchScope !== 'all' ? 1 : 0,
    filterState.statuses.length,
    filterState.documentRoles.length,
    filterState.categories.length,
    filterState.hasDeadline !== null ? 1 : 0,
    filterState.isExpiring !== null ? 1 : 0,
    filterState.riskLevels?.length ?? 0,
    filterState.suppliers?.length ?? 0,
    filterState.clients?.length ?? 0,
    filterState.contractTypes?.length ?? 0,
    filterState.currencies?.length ?? 0,
    filterState.jurisdictions?.length ?? 0,
    filterState.paymentTerms?.length ?? 0,
    filterState.tags?.length ?? 0,
    filterState.metadataIssues?.length ?? 0,
    filterState.relationshipType?.length ?? 0,
    filterState.valueRangePreset ? 1 : 0,
    filterState.dateRangePreset ? 1 : 0,
    filterState.expirationFilters.length,
    filterState.signatureFilters.length,
    filterState.documentTypeFilters.length,
    filterState.dateRange.from || filterState.dateRange.to ? 1 : 0,
    filterState.valueRange.min > 0 || filterState.valueRange.max < 1000000 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // ── Auto-reset page on filter change ───────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchScope, filterState]);

  // ── Handlers ───────────────────────────────────────────────────────
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSearchScope('all');
    setFilterState(DEFAULT_FILTER_STATE);
  }, [setFilterState]);

  const handleClearFilter = useCallback((filterKey: keyof FilterState, value?: any) => {
    setFilterState((prev) => {
      switch (filterKey) {
        case 'statuses':
        case 'documentRoles':
        case 'categories':
        case 'riskLevels':
        case 'suppliers':
        case 'clients':
        case 'contractTypes':
        case 'currencies':
        case 'jurisdictions':
        case 'paymentTerms':
        case 'tags':
        case 'metadataIssues':
        case 'relationshipType':
        case 'expirationFilters':
        case 'signatureFilters':
        case 'documentTypeFilters': {
          const arr = prev[filterKey] as string[];
          if (value !== undefined) {
            return { ...prev, [filterKey]: arr.filter((v) => v !== value) };
          }
          return { ...prev, [filterKey]: [] };
        }
        case 'dateRange':
          return { ...prev, dateRange: {} };
        case 'valueRange':
          return { ...prev, valueRange: { min: 0, max: 1000000 } };
        case 'hasDeadline':
        case 'isExpiring':
          return { ...prev, [filterKey]: null };
        case 'valueRangePreset':
          return { ...prev, valueRangePreset: null };
        case 'dateRangePreset':
          return { ...prev, dateRangePreset: null };
        default:
          return prev;
      }
    });
  }, [setFilterState]);

  const handleLoadPreset = useCallback((search: SavedSearch) => {
    setSearchQuery(search.query);
    setFilterState(search.filters);
  }, [setFilterState]);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    // Filter state
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    searchScopeLabel,
    filterState,
    setFilterState,
    // Pagination & sorting
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    accessScope,
    setAccessScope,
    // Server query params
    serverParams,
    effectiveValueRange,
    effectiveUploadedRange,
    // Indicators
    hasActiveFilters,
    activeFilterCount,
    // Handlers
    clearFilters,
    handleClearFilter,
    handleLoadPreset,
  };
}

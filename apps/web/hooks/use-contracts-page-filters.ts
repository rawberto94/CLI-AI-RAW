/**
 * useContractsPageFilters – Filter state, derived values, handlers,
 * pagination, sorting, and server query params for the contracts list page.
 *
 * Does NOT hold `filteredContracts` / `sortedContracts` because those
 * depend on `contracts` data fetched via useContracts (called after this hook).
 */
"use client";

import { useState, useMemo, useCallback, useEffect, type SetStateAction } from "react";
import { type FilterState } from "@/components/contracts/AdvancedFilterPanel";
import { type SavedSearch } from "@/components/contracts/SavedSearchPresets";
import {
  DATE_PRESETS,
  type SortField,
  type SortDirection,
  VALUE_RANGES,
  mapSortFieldToApi,
} from "@/lib/contracts/filter-constants";

// ── Default filter state ─────────────────────────────────────────────
const DEFAULT_FILTER_STATE: FilterState = {
  statuses: [],
  documentRoles: [],
  dateRange: {},
  valueRange: { min: 0, max: 1000000 },
  categories: [],
  hasDeadline: null,
  isExpiring: null,
  riskLevels: [],
  suppliers: [],
  clients: [],
  contractTypes: [],
  currencies: [],
  jurisdictions: [],
  paymentTerms: [],
};

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
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function useContractsPageFilters() {
  // ── Core filter state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [valueRangeFilter, setValueRangeFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(null);
  const [expirationFilters, setExpirationFilters] = useState<string[]>([]);
  const [signatureFilters, setSignatureFilters] = useState<string[]>([]);
  const [documentTypeFilters, setDocumentTypeFilters] = useState<string[]>([]);

  const [filterStateValue, setFilterStateValue] = useState<FilterState>(DEFAULT_FILTER_STATE);

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // ── Consolidated filter accessors ──────────────────────────────────
  const statusFilter = filterState.statuses.length > 0 ? filterState.statuses[0] : "all";
  const typeFilters = filterState.contractTypes ?? [];
  const riskFilters = filterState.riskLevels ?? [];
  const supplierFilters = filterState.suppliers ?? [];
  const categoryFilter = filterState.categories.length > 0 ? filterState.categories[0] : null;

  const setStatusFilter = useCallback((val: string) => {
    setFilterState((prev) => ({ ...prev, statuses: val === "all" ? [] : [val] }));
  }, []);
  const setTypeFilters = useCallback((vals: string[]) => {
    setFilterState((prev) => ({ ...prev, contractTypes: vals }));
  }, []);
  const setRiskFilters = useCallback((vals: string[]) => {
    setFilterState((prev) => ({ ...prev, riskLevels: vals }));
  }, []);
  const setSupplierFilters = useCallback((vals: string[]) => {
    setFilterState((prev) => ({ ...prev, suppliers: vals }));
  }, []);
  const setCategoryFilter = useCallback((cat: string | null) => {
    setFilterState((prev) => ({ ...prev, categories: cat ? [cat] : [] }));
  }, []);

  // ── Server-side filter params ──────────────────────────────────────
  const effectiveValueRange = useMemo(() => {
    let min = filterState.valueRange.min;
    let max = filterState.valueRange.max;
    if (valueRangeFilter) {
      const preset = VALUE_RANGES.find((r) => r.value === valueRangeFilter);
      if (preset) {
        min = Math.max(min, preset.min);
        max = Math.min(max, preset.max === Infinity ? max : preset.max);
      }
    }
    return {
      min: min > 0 ? min : undefined,
      max: max < 1000000 ? max : undefined,
    };
  }, [filterState.valueRange, valueRangeFilter]);

  const effectiveUploadedRange = useMemo(() => {
    let from = filterState.dateRange.from ? startOfDay(filterState.dateRange.from) : undefined;
    let to = filterState.dateRange.to ? endOfDay(filterState.dateRange.to) : undefined;

    if (dateRangeFilter) {
      const preset = DATE_PRESETS.find((item) => item.value === dateRangeFilter);
      if (preset) {
        const presetFrom = startOfDay(new Date(Date.now() - preset.days * 86_400_000));
        const presetTo = endOfDay(new Date());

        from = from ? new Date(Math.max(from.getTime(), presetFrom.getTime())) : presetFrom;
        to = to ? new Date(Math.min(to.getTime(), presetTo.getTime())) : presetTo;
      }
    }

    return { from, to };
  }, [filterState.dateRange, dateRangeFilter]);

  /** Ready-to-use params object for `useContracts(serverParams, opts)`. */
  const serverParams = useMemo(
    () => ({
      status: filterState.statuses.length > 0 ? filterState.statuses : undefined,
      page: currentPage,
      limit: pageSize,
      sortBy: mapSortFieldToApi(sortField),
      sortOrder: sortDirection,
      search: searchQuery || undefined,
      documentRole: filterState.documentRoles.length > 0 ? filterState.documentRoles : undefined,
      riskLevel: filterState.riskLevels?.length ? filterState.riskLevels : undefined,
      contractType: typeFilters.length > 0 ? typeFilters : undefined,
      category: filterState.categories.length > 0 ? filterState.categories : undefined,
      clientName: filterState.clients?.length ? filterState.clients : undefined,
      supplierName: filterState.suppliers?.length ? filterState.suppliers : undefined,
      currency: filterState.currencies?.length ? filterState.currencies : undefined,
      jurisdiction: filterState.jurisdictions?.length ? filterState.jurisdictions : undefined,
      paymentTerms: filterState.paymentTerms?.length ? filterState.paymentTerms : undefined,
      signatureStatus: signatureFilters.length > 0 ? signatureFilters : undefined,
      documentClassification: documentTypeFilters.length > 0 ? documentTypeFilters : undefined,
      expirationFilter: expirationFilters.length > 0 ? expirationFilters : undefined,
      hasDeadline: filterState.hasDeadline === true ? 'true' : undefined,
      isExpiring: filterState.isExpiring === true ? 'true' : undefined,
      minValue: effectiveValueRange.min,
      maxValue: effectiveValueRange.max,
      uploadedAfter: effectiveUploadedRange.from?.toISOString(),
      uploadedBefore: effectiveUploadedRange.to?.toISOString(),
    }),
    [
      currentPage,
      pageSize,
      sortField,
      sortDirection,
      searchQuery,
      filterState,
      typeFilters,
      signatureFilters,
      documentTypeFilters,
      expirationFilters,
      effectiveValueRange,
      effectiveUploadedRange,
    ],
  );

  // ── Active-filter indicators ───────────────────────────────────────
  const hasActiveFilters = Boolean(
    searchQuery ||
      valueRangeFilter ||
      dateRangeFilter ||
      expirationFilters.length > 0 ||
      signatureFilters.length > 0 ||
      documentTypeFilters.length > 0 ||
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
      (filterState.paymentTerms?.length ?? 0) > 0,
  );

  const activeFilterCount = [
    searchQuery ? 1 : 0,
    valueRangeFilter ? 1 : 0,
    dateRangeFilter ? 1 : 0,
    expirationFilters.length,
    signatureFilters.length,
    documentTypeFilters.length,
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
  ].reduce((a, b) => a + b, 0);

  // ── Auto-reset page on filter change ───────────────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterState, valueRangeFilter, dateRangeFilter, expirationFilters, signatureFilters, documentTypeFilters]);

  // ── Handlers ───────────────────────────────────────────────────────
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setValueRangeFilter(null);
    setDateRangeFilter(null);
    setExpirationFilters([]);
    setSignatureFilters([]);
    setDocumentTypeFilters([]);
    setFilterState(DEFAULT_FILTER_STATE);
  }, []);

  const handleClearFilter = useCallback((filterKey: keyof FilterState, value?: any) => {
    setFilterState((prev) => {
      switch (filterKey) {
        case "statuses":
        case "documentRoles":
        case "categories":
        case "riskLevels":
        case "suppliers":
        case "clients":
        case "contractTypes":
        case "currencies":
        case "jurisdictions":
        case "paymentTerms": {
          const arr = prev[filterKey] as string[];
          if (value !== undefined) {
            return { ...prev, [filterKey]: arr.filter((v) => v !== value) };
          }
          return { ...prev, [filterKey]: [] };
        }
        case "dateRange":
          return { ...prev, dateRange: {} };
        case "valueRange":
          return { ...prev, valueRange: { min: 0, max: 1000000 } };
        case "hasDeadline":
        case "isExpiring":
          return { ...prev, [filterKey]: null };
        default:
          return prev;
      }
    });
  }, []);

  const handleLoadPreset = useCallback((search: SavedSearch) => {
    setSearchQuery(search.query);
    setFilterState(search.filters);
  }, []);

  // ── Return ─────────────────────────────────────────────────────────
  return {
    // Filter state
    searchQuery, setSearchQuery,
    filterState, setFilterState,
    valueRangeFilter, setValueRangeFilter,
    dateRangeFilter, setDateRangeFilter,
    expirationFilters, setExpirationFilters,
    signatureFilters, setSignatureFilters,
    documentTypeFilters, setDocumentTypeFilters,
    // Pagination & sorting
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    sortField, setSortField,
    sortDirection, setSortDirection,
    // Derived accessors
    statusFilter, typeFilters, riskFilters, supplierFilters, categoryFilter,
    // Setter callbacks
    setStatusFilter, setTypeFilters, setRiskFilters, setSupplierFilters, setCategoryFilter,
    // Server query params
    serverParams, effectiveValueRange,
    // Indicators
    hasActiveFilters, activeFilterCount,
    // Handlers
    clearFilters, handleClearFilter, handleLoadPreset,
  };
}

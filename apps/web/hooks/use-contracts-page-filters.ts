/**
 * useContractsPageFilters – Filter state, derived values, handlers,
 * pagination, sorting, and server query params for the contracts list page.
 *
 * Does NOT hold `filteredContracts` / `sortedContracts` because those
 * depend on `contracts` data fetched via useContracts (called after this hook).
 */
"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { type AdvancedSearchFilters } from "@/components/contracts/AdvancedSearchModal";
import { type FilterState } from "@/components/contracts/AdvancedFilterPanel";
import { type SavedSearch } from "@/components/contracts/SavedSearchPresets";
import { toast } from "sonner";
import {
  type SortField,
  type SortDirection,
  VALUE_RANGES,
  DATE_PRESETS,
  EXPIRATION_FILTERS,
  QUICK_PRESETS,
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

export function useContractsPageFilters() {
  // ── Core filter state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [approvalFilters, setApprovalFilters] = useState<string[]>([]);
  const [valueRangeFilter, setValueRangeFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(null);
  const [expirationFilters, setExpirationFilters] = useState<string[]>([]);
  const [signatureFilters, setSignatureFilters] = useState<string[]>([]);
  const [documentTypeFilters, setDocumentTypeFilters] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});

  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<Array<{ id: string; name: string; filters: any }>>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterName, setFilterName] = useState("");

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

  /** Ready-to-use params object for `useContracts(serverParams, opts)`. */
  const serverParams = useMemo(
    () => ({
      status: filterState.statuses.length > 0 ? filterState.statuses : undefined,
      page: currentPage,
      limit: pageSize,
      sortBy: mapSortFieldToApi(sortField),
      sortOrder: sortDirection,
      search: searchQuery || undefined,
      contractType: typeFilters.length > 0 ? typeFilters : undefined,
      clientName: filterState.clients?.length ? filterState.clients : undefined,
      supplierName: filterState.suppliers?.length ? filterState.suppliers : undefined,
      minValue: effectiveValueRange.min,
      maxValue: effectiveValueRange.max,
    }),
    [filterState, currentPage, pageSize, sortField, sortDirection, searchQuery, typeFilters, effectiveValueRange],
  );

  // ── Active-filter indicators ───────────────────────────────────────
  const hasActiveFilters = Boolean(
    searchQuery ||
      approvalFilters.length > 0 ||
      valueRangeFilter ||
      dateRangeFilter ||
      expirationFilters.length > 0 ||
      signatureFilters.length > 0 ||
      documentTypeFilters.length > 0 ||
      activePreset ||
      Object.keys(advancedFilters).length > 0 ||
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
    approvalFilters.length,
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
  }, [searchQuery, filterState, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters, signatureFilters, documentTypeFilters, advancedFilters]);

  // ── Handlers ───────────────────────────────────────────────────────
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setApprovalFilters([]);
    setValueRangeFilter(null);
    setDateRangeFilter(null);
    setExpirationFilters([]);
    setSignatureFilters([]);
    setDocumentTypeFilters([]);
    setActivePreset(null);
    setAdvancedFilters({});
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

  /** Apply visual builder output. Caller should close the builder modal. */
  const handleVisualBuilderApply = useCallback(
    (
      groups: Array<{
        id: string;
        logic: "AND" | "OR";
        filters: Array<{
          type: "status" | "date" | "value" | "risk" | "category" | "role" | "expiration" | "supplier" | "client" | "jurisdiction" | "payment" | "contractType" | "currency";
          operator: string;
          value: any;
        }>;
      }>,
      _interGroupLogic?: "AND" | "OR",
    ) => {
      const newFS: FilterState = {
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

      groups.forEach((group) => {
        group.filters.forEach((filter) => {
          switch (filter.type) {
            case "status":
              if (filter.value && !newFS.statuses.includes(filter.value)) newFS.statuses.push(filter.value);
              break;
            case "role":
              if (filter.value && !newFS.documentRoles.includes(filter.value)) newFS.documentRoles.push(filter.value);
              break;
            case "category":
              if (filter.value && !newFS.categories.includes(filter.value)) newFS.categories.push(filter.value);
              break;
            case "date":
              if (filter.operator === "between" && Array.isArray(filter.value) && filter.value.length === 2) {
                newFS.dateRange = { from: filter.value[0], to: filter.value[1] };
              }
              break;
            case "value":
              if (filter.operator === "between" && Array.isArray(filter.value) && filter.value.length === 2) {
                newFS.valueRange = { min: filter.value[0], max: filter.value[1] };
              } else if (filter.operator === "greater" && typeof filter.value === "number") {
                newFS.valueRange.min = filter.value;
              } else if (filter.operator === "less" && typeof filter.value === "number") {
                newFS.valueRange.max = filter.value;
              }
              break;
            case "expiration":
              newFS.isExpiring = true;
              break;
            case "risk":
              if (filter.value && !newFS.riskLevels.includes(filter.value)) newFS.riskLevels.push(filter.value);
              break;
            case "supplier":
              if (filter.value && !newFS.suppliers.includes(filter.value)) newFS.suppliers.push(filter.value);
              break;
            case "client":
              if (filter.value && !newFS.clients.includes(filter.value)) newFS.clients.push(filter.value);
              break;
            case "jurisdiction":
              if (filter.value && !newFS.jurisdictions.includes(filter.value)) newFS.jurisdictions.push(filter.value);
              break;
            case "payment":
              if (filter.value && !newFS.paymentTerms.includes(filter.value)) newFS.paymentTerms.push(filter.value);
              break;
            case "contractType":
              if (filter.value && !newFS.contractTypes.includes(filter.value)) newFS.contractTypes.push(filter.value);
              break;
            case "currency":
              if (filter.value && !newFS.currencies.includes(filter.value)) newFS.currencies.push(filter.value);
              break;
          }
        });
      });

      setFilterState(newFS);
      const filterCount = groups.reduce((acc, g) => acc + g.filters.length, 0);
      toast.success(`Applied ${filterCount} filter${filterCount === 1 ? "" : "s"} from visual builder`);
    },
    [],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      clearFilters();
      setActivePreset(presetId);
      const preset = QUICK_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      if (preset.filters.status) setStatusFilter(preset.filters.status);
      if (preset.filters.risk) setRiskFilters([preset.filters.risk]);
      if (preset.filters.approval) setApprovalFilters([preset.filters.approval]);
      if (preset.filters.minValue) {
        const range = VALUE_RANGES.find((r) => r.min <= preset.filters.minValue! && r.max > preset.filters.minValue!);
        if (range) setValueRangeFilter(range.value);
      }
      if (preset.filters.expirationDays) {
        const exp = EXPIRATION_FILTERS.find((e) => e.value === `expiring-${preset.filters.expirationDays}`);
        if (exp) setExpirationFilters([exp.value]);
      }
    },
    [clearFilters],
  );

  const handleSaveFilter = useCallback(() => {
    if (!filterName.trim()) return;
    setSavedFilters((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: filterName,
        filters: { statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters },
      },
    ]);
    setFilterName("");
    setShowSaveFilterModal(false);
    toast.success(`Filter "${filterName}" saved`);
  }, [filterName, statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters]);

  const handleLoadFilter = useCallback(
    (filter: (typeof savedFilters)[0]) => {
      clearFilters();
      if (filter.filters.statusFilter) setStatusFilter(filter.filters.statusFilter);
      if (filter.filters.typeFilters) setTypeFilters(filter.filters.typeFilters);
      if (filter.filters.riskFilters) setRiskFilters(filter.filters.riskFilters);
      if (filter.filters.approvalFilters) setApprovalFilters(filter.filters.approvalFilters);
      if (filter.filters.valueRangeFilter) setValueRangeFilter(filter.filters.valueRangeFilter);
      if (filter.filters.dateRangeFilter) setDateRangeFilter(filter.filters.dateRangeFilter);
      if (filter.filters.expirationFilters) setExpirationFilters(filter.filters.expirationFilters);
      toast.success(`Loaded filter "${filter.name}"`);
    },
    [clearFilters],
  );

  // ── Return ─────────────────────────────────────────────────────────
  return {
    // Filter state
    searchQuery, setSearchQuery,
    filterState, setFilterState,
    approvalFilters, setApprovalFilters,
    valueRangeFilter, setValueRangeFilter,
    dateRangeFilter, setDateRangeFilter,
    expirationFilters, setExpirationFilters,
    signatureFilters, setSignatureFilters,
    documentTypeFilters, setDocumentTypeFilters,
    activePreset, setActivePreset,
    advancedFilters, setAdvancedFilters,
    savedFilters, setSavedFilters,
    filterName, setFilterName,
    showSaveFilterModal, setShowSaveFilterModal,
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
    handleVisualBuilderApply, applyPreset,
    handleSaveFilter, handleLoadFilter,
  };
}

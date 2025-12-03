/**
 * Contract Filtering Hook
 * 
 * Centralized filtering logic for contracts with memoized computations
 */

import { useMemo, useCallback, useState } from 'react';
import type {
  Contract,
  FilterState,
  SortState,
  PaginationState,
  AdvancedFilters,
  ContractStats,
  FilteredStats,
  RiskLevel,
} from './types';
import {
  RISK_LEVELS,
  VALUE_RANGES,
  DATE_PRESETS,
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_STATE,
  DEFAULT_PAGE_SIZE,
} from './constants';

// ============================================================================
// FILTER MATCHERS
// ============================================================================

const matchesSearch = (contract: Contract, query: string): boolean => {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return (
    contract.title?.toLowerCase().includes(lowerQuery) ||
    contract.filename?.toLowerCase().includes(lowerQuery) ||
    contract.parties?.client?.toLowerCase().includes(lowerQuery) ||
    contract.parties?.supplier?.toLowerCase().includes(lowerQuery) ||
    contract.type?.toLowerCase().includes(lowerQuery) ||
    contract.category?.name?.toLowerCase().includes(lowerQuery) ||
    false
  );
};

const matchesStatus = (contract: Contract, status: string): boolean => {
  if (status === 'all') return true;
  return contract.status === status;
};

const matchesTypes = (contract: Contract, types: string[]): boolean => {
  if (types.length === 0) return true;
  return contract.type ? types.includes(contract.type) : false;
};

const matchesRiskLevels = (contract: Contract, levels: string[]): boolean => {
  if (levels.length === 0) return true;
  if (contract.riskScore === undefined || contract.riskScore === null) return false;
  
  return levels.some(level => {
    const config = RISK_LEVELS.find(l => l.value === level);
    if (!config) return false;
    return contract.riskScore! >= config.range[0] && contract.riskScore! < config.range[1];
  });
};

const matchesApproval = (contract: Contract, statuses: string[]): boolean => {
  if (statuses.length === 0) return true;
  const contractApproval = contract.approvalStatus || 'none';
  return statuses.includes(contractApproval);
};

const matchesValueRange = (contract: Contract, rangeValue: string | null): boolean => {
  if (!rangeValue) return true;
  const range = VALUE_RANGES.find(r => r.value === rangeValue);
  if (!range || !contract.value) return false;
  return contract.value >= range.min && contract.value < range.max;
};

const matchesDateRange = (contract: Contract, dateValue: string | null, now: Date): boolean => {
  if (!dateValue) return true;
  const preset = DATE_PRESETS.find(p => p.value === dateValue);
  if (!preset || !contract.createdAt) return false;
  
  const createdDate = new Date(contract.createdAt);
  const cutoffDate = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
  return createdDate >= cutoffDate;
};

const matchesExpiration = (contract: Contract, filters: string[], now: Date): boolean => {
  if (filters.length === 0) return true;
  
  return filters.some(filter => {
    if (!contract.expirationDate && filter === 'no-expiry') return true;
    if (!contract.expirationDate) return false;
    
    const expirationDate = new Date(contract.expirationDate);
    const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case 'expired': return daysUntilExpiry < 0;
      case 'expiring-7': return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
      case 'expiring-30': return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
      case 'expiring-90': return daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
      case 'expiring-year': return daysUntilExpiry >= 0 && daysUntilExpiry <= 365;
      default: return true;
    }
  });
};

const matchesCategory = (contract: Contract, categoryId: string | null): boolean => {
  if (!categoryId) return true;
  if (categoryId === 'uncategorized') return !contract.category;
  return contract.category?.id === categoryId;
};

const matchesAdvanced = (contract: Contract, advanced: AdvancedFilters): boolean => {
  if (advanced.clientName && !contract.parties?.client?.toLowerCase().includes(advanced.clientName.toLowerCase())) {
    return false;
  }
  if (advanced.supplierName && !contract.parties?.supplier?.toLowerCase().includes(advanced.supplierName.toLowerCase())) {
    return false;
  }
  if (advanced.minValue && (!contract.value || contract.value < advanced.minValue)) {
    return false;
  }
  if (advanced.maxValue && (!contract.value || contract.value > advanced.maxValue)) {
    return false;
  }
  return true;
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export interface UseContractFiltersOptions {
  contracts: Contract[];
  initialFilters?: Partial<FilterState>;
  initialSort?: Partial<SortState>;
  initialPage?: number;
  initialPageSize?: number;
}

export interface UseContractFiltersReturn {
  // State
  filters: FilterState;
  sort: SortState;
  pagination: PaginationState;
  advancedFilters: AdvancedFilters;
  
  // Computed
  filteredContracts: Contract[];
  sortedContracts: Contract[];
  paginatedContracts: Contract[];
  stats: ContractStats;
  filteredStats: FilteredStats;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setStatus: (status: string) => void;
  toggleType: (type: string) => void;
  setTypes: (types: string[]) => void;
  toggleRiskLevel: (level: string) => void;
  setRiskLevels: (levels: string[]) => void;
  toggleApprovalStatus: (status: string) => void;
  setApprovalStatuses: (statuses: string[]) => void;
  setValueRange: (range: string | null) => void;
  setDateRange: (range: string | null) => void;
  toggleExpirationFilter: (filter: string) => void;
  setExpirationFilters: (filters: string[]) => void;
  setCategory: (categoryId: string | null) => void;
  setAdvancedFilters: (filters: AdvancedFilters) => void;
  updateAdvancedFilter: <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) => void;
  
  setSortField: (field: SortState['field']) => void;
  setSortDirection: (direction: SortState['direction']) => void;
  toggleSortDirection: () => void;
  
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  clearFilters: () => void;
  clearAllFilters: () => void;
  applyPreset: (presetId: string) => void;
}

export function useContractFilters({
  contracts,
  initialFilters = {},
  initialSort = {},
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
}: UseContractFiltersOptions): UseContractFiltersReturn {
  
  // ========== STATE ==========
  
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTER_STATE,
    ...initialFilters,
  });
  
  const [sort, setSort] = useState<SortState>({
    ...DEFAULT_SORT_STATE,
    ...initialSort,
  });
  
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  });
  
  const [advancedFilters, setAdvancedFiltersState] = useState<AdvancedFilters>({});
  
  // ========== COMPUTED: Stats ==========
  
  const stats = useMemo<ContractStats>(() => {
    const total = contracts.length;
    const completed = contracts.filter(c => c.status === 'completed').length;
    const processing = contracts.filter(c => c.status === 'processing').length;
    const failed = contracts.filter(c => c.status === 'failed').length;
    const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const avgValue = total > 0 ? totalValue / total : 0;
    const highRiskCount = contracts.filter(c => (c.riskScore || 0) >= 70).length;
    const now = Date.now();
    const expiringCount = contracts.filter(c => {
      if (!c.expirationDate) return false;
      const days = (new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    }).length;
    const categorizedCount = contracts.filter(c => c.category).length;
    const uncategorizedCount = total - categorizedCount;
    
    return {
      total,
      completed,
      processing,
      failed,
      totalValue,
      avgValue,
      highRiskCount,
      expiringCount,
      categorizedCount,
      uncategorizedCount,
    };
  }, [contracts]);
  
  // ========== COMPUTED: Filtered Contracts ==========
  
  const filteredContracts = useMemo(() => {
    const now = new Date();
    
    return contracts.filter(contract => {
      return (
        matchesSearch(contract, filters.searchQuery) &&
        matchesStatus(contract, filters.status) &&
        matchesTypes(contract, filters.types) &&
        matchesRiskLevels(contract, filters.riskLevels) &&
        matchesApproval(contract, filters.approvalStatuses) &&
        matchesValueRange(contract, filters.valueRange) &&
        matchesDateRange(contract, filters.dateRange, now) &&
        matchesExpiration(contract, filters.expirationFilters, now) &&
        matchesCategory(contract, filters.categoryId) &&
        matchesAdvanced(contract, advancedFilters)
      );
    });
  }, [contracts, filters, advancedFilters]);
  
  // ========== COMPUTED: Sorted Contracts ==========
  
  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'value':
          comparison = (a.value || 0) - (b.value || 0);
          break;
        case 'expirationDate':
          comparison = new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime();
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'riskScore':
          comparison = (a.riskScore || 0) - (b.riskScore || 0);
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredContracts, sort]);
  
  // ========== COMPUTED: Paginated Contracts ==========
  
  const paginatedContracts = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return sortedContracts.slice(start, end);
  }, [sortedContracts, pagination]);
  
  // ========== COMPUTED: Filtered Stats ==========
  
  const filteredStats = useMemo<FilteredStats>(() => {
    const count = filteredContracts.length;
    const totalValue = filteredContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const avgValue = count > 0 ? totalValue / count : 0;
    const highRiskCount = filteredContracts.filter(c => (c.riskScore || 0) >= 70).length;
    const now = Date.now();
    const expiringCount = filteredContracts.filter(c => {
      if (!c.expirationDate) return false;
      const days = (new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    }).length;
    
    return { count, totalValue, avgValue, highRiskCount, expiringCount };
  }, [filteredContracts]);
  
  // ========== COMPUTED: Active Filters ==========
  
  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchQuery !== '' ||
      filters.status !== 'all' ||
      filters.types.length > 0 ||
      filters.riskLevels.length > 0 ||
      filters.approvalStatuses.length > 0 ||
      filters.valueRange !== null ||
      filters.dateRange !== null ||
      filters.expirationFilters.length > 0 ||
      filters.categoryId !== null ||
      Object.keys(advancedFilters).length > 0
    );
  }, [filters, advancedFilters]);
  
  const activeFilterCount = useMemo(() => {
    return [
      filters.searchQuery ? 1 : 0,
      filters.status !== 'all' ? 1 : 0,
      filters.types.length,
      filters.riskLevels.length,
      filters.approvalStatuses.length,
      filters.valueRange ? 1 : 0,
      filters.dateRange ? 1 : 0,
      filters.expirationFilters.length,
      filters.categoryId ? 1 : 0,
      Object.keys(advancedFilters).filter(k => advancedFilters[k as keyof AdvancedFilters]).length,
    ].reduce((a, b) => a + b, 0);
  }, [filters, advancedFilters]);
  
  // ========== ACTIONS ==========
  
  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setStatus = useCallback((status: string) => {
    setFilters(prev => ({ ...prev, status: status as FilterState['status'] }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const toggleType = useCallback((type: string) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setTypes = useCallback((types: string[]) => {
    setFilters(prev => ({ ...prev, types }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const toggleRiskLevel = useCallback((level: string) => {
    setFilters(prev => ({
      ...prev,
      riskLevels: prev.riskLevels.includes(level)
        ? prev.riskLevels.filter(l => l !== level)
        : [...prev.riskLevels, level],
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setRiskLevels = useCallback((levels: string[]) => {
    setFilters(prev => ({ ...prev, riskLevels: levels }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const toggleApprovalStatus = useCallback((status: string) => {
    setFilters(prev => ({
      ...prev,
      approvalStatuses: prev.approvalStatuses.includes(status)
        ? prev.approvalStatuses.filter(s => s !== status)
        : [...prev.approvalStatuses, status],
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setApprovalStatuses = useCallback((statuses: string[]) => {
    setFilters(prev => ({ ...prev, approvalStatuses: statuses }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setValueRange = useCallback((range: string | null) => {
    setFilters(prev => ({ ...prev, valueRange: range }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setDateRange = useCallback((range: string | null) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const toggleExpirationFilter = useCallback((filter: string) => {
    setFilters(prev => ({
      ...prev,
      expirationFilters: prev.expirationFilters.includes(filter)
        ? prev.expirationFilters.filter(f => f !== filter)
        : [...prev.expirationFilters, filter],
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setExpirationFilters = useCallback((filters: string[]) => {
    setFilters(prev => ({ ...prev, expirationFilters: filters }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setCategory = useCallback((categoryId: string | null) => {
    setFilters(prev => ({ ...prev, categoryId }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setAdvancedFilters = useCallback((newFilters: AdvancedFilters) => {
    setAdvancedFiltersState(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const updateAdvancedFilter = useCallback(<K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K]
  ) => {
    setAdvancedFiltersState(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const setSortField = useCallback((field: SortState['field']) => {
    setSort(prev => ({ ...prev, field }));
  }, []);
  
  const setSortDirection = useCallback((direction: SortState['direction']) => {
    setSort(prev => ({ ...prev, direction }));
  }, []);
  
  const toggleSortDirection = useCallback(() => {
    setSort(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
  }, []);
  
  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);
  
  const setPageSize = useCallback((pageSize: number) => {
    setPagination(prev => ({ ...prev, pageSize, page: 1 }));
  }, []);
  
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    setAdvancedFiltersState({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);
  
  const clearAllFilters = useCallback(() => {
    clearFilters();
    setSort(DEFAULT_SORT_STATE);
  }, [clearFilters]);
  
  const applyPreset = useCallback((presetId: string) => {
    // Import presets dynamically to avoid circular deps
    import('./constants').then(({ QUICK_PRESETS }) => {
      const preset = QUICK_PRESETS.find(p => p.id === presetId);
      if (!preset) return;
      
      clearFilters();
      
      const newFilters = { ...DEFAULT_FILTER_STATE };
      
      if (preset.filters.status) {
        newFilters.status = preset.filters.status as FilterState['status'];
      }
      if (preset.filters.risk) {
        newFilters.riskLevels = [preset.filters.risk];
      }
      if (preset.filters.approval) {
        newFilters.approvalStatuses = [preset.filters.approval];
      }
      if (preset.filters.categoryId) {
        newFilters.categoryId = preset.filters.categoryId;
      }
      if (preset.filters.expirationDays) {
        if (preset.filters.expirationDays <= 7) {
          newFilters.expirationFilters = ['expiring-7'];
        } else if (preset.filters.expirationDays <= 30) {
          newFilters.expirationFilters = ['expiring-30'];
        } else if (preset.filters.expirationDays <= 90) {
          newFilters.expirationFilters = ['expiring-90'];
        }
      }
      
      setFilters(newFilters);
      
      if (preset.filters.minValue) {
        setAdvancedFiltersState(prev => ({ ...prev, minValue: preset.filters.minValue }));
      }
      if (preset.filters.createdDays) {
        const days = preset.filters.createdDays;
        if (days <= 7) newFilters.dateRange = 'week';
        else if (days <= 30) newFilters.dateRange = 'month';
        else if (days <= 90) newFilters.dateRange = 'quarter';
        setFilters(newFilters);
      }
    });
  }, [clearFilters]);
  
  return {
    // State
    filters,
    sort,
    pagination,
    advancedFilters,
    
    // Computed
    filteredContracts,
    sortedContracts,
    paginatedContracts,
    stats,
    filteredStats,
    hasActiveFilters,
    activeFilterCount,
    
    // Actions
    setSearchQuery,
    setStatus,
    toggleType,
    setTypes,
    toggleRiskLevel,
    setRiskLevels,
    toggleApprovalStatus,
    setApprovalStatuses,
    setValueRange,
    setDateRange,
    toggleExpirationFilter,
    setExpirationFilters,
    setCategory,
    setAdvancedFilters,
    updateAdvancedFilter,
    setSortField,
    setSortDirection,
    toggleSortDirection,
    setPage,
    setPageSize,
    clearFilters,
    clearAllFilters,
    applyPreset,
  };
}

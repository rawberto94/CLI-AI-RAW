/**
 * Contracts Page Integration Hook
 * 
 * Combines all contracts page hooks into a single unified API
 * for easy consumption by the contracts page and related components.
 */

import { useCallback, useMemo } from 'react';
import { useContractFilters, ContractFilters, QuickPreset } from './use-contract-filters';
import { useContractSorting, SortField, SortDirection } from './use-contract-sorting';
import { usePagination } from './use-pagination';
import { useContractSelection, SelectionState, SelectionActions } from './use-contract-selection';
import { useBulkOperations, BulkOperationType, BulkOperationState, BulkOperationActions } from './use-bulk-operations';
import { useContractsKeyboardShortcuts, KeyboardShortcutHandlers } from './use-contracts-keyboard-shortcuts';
import type { Contract } from '@/lib/contracts/types';

// ============================================================================
// Types
// ============================================================================

export interface ContractsPageConfig {
  /** Initial filters to apply */
  initialFilters?: Partial<ContractFilters>;
  /** Initial sort field */
  initialSortField?: SortField;
  /** Initial sort direction */
  initialSortDirection?: SortDirection;
  /** Initial page size */
  initialPageSize?: number;
  /** Persist state to URL/localStorage */
  persistState?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Total items for pagination (from API) */
  totalItems?: number;
  /** All available contract IDs for selection */
  allContractIds?: string[];
}

export interface ContractsPageState {
  // Filter state
  filters: ContractFilters;
  activeFiltersCount: number;
  isFiltered: boolean;
  
  // Sort state
  sortField: SortField;
  sortDirection: SortDirection;
  sortKey: string;
  
  // Pagination state
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
  
  // Selection state
  selection: SelectionState;
  selectedCount: number;
  hasSelection: boolean;
  
  // Bulk operations state
  bulkOperation: BulkOperationState;
  isBulkOperationActive: boolean;
}

export interface ContractsPageActions {
  // Filter actions
  setFilter: <K extends keyof ContractFilters>(key: K, value: ContractFilters[K]) => void;
  setFilters: (filters: Partial<ContractFilters>) => void;
  resetFilters: () => void;
  applyQuickPreset: (preset: QuickPreset) => void;
  toggleFilterValue: (key: keyof ContractFilters, value: string) => void;
  
  // Sort actions
  setSort: (field: SortField, direction?: SortDirection) => void;
  toggleSort: (field: SortField) => void;
  resetSort: () => void;
  
  // Pagination actions
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  goToFirst: () => void;
  goToLast: () => void;
  resetPagination: () => void;
  
  // Selection actions
  selectItem: (id: string, shiftKey?: boolean) => void;
  deselectItem: (id: string) => void;
  toggleItem: (id: string, shiftKey?: boolean) => void;
  selectAll: () => void;
  deselectAll: () => void;
  toggleAll: () => void;
  selectRange: (startId: string, endId: string) => void;
  isSelected: (id: string) => boolean;
  
  // Bulk operations
  startBulkOperation: (operation: BulkOperationType, contractIds: string[]) => Promise<void>;
  cancelBulkOperation: () => void;
  undoLastOperation: () => Promise<void>;
  
  // Combined actions
  resetAll: () => void;
  applyFilterAndResetPage: (filters: Partial<ContractFilters>) => void;
}

export interface UseContractsPageReturn {
  state: ContractsPageState;
  actions: ContractsPageActions;
  
  // API query params helper
  queryParams: {
    page: number;
    pageSize: number;
    sortBy: string;
    sortOrder: string;
    search: string;
    status: string[];
    type: string[];
    vendor: string[];
    department: string[];
    tags: string[];
    riskLevel: string[];
    startDate: string | null;
    endDate: string | null;
    minValue: number | null;
    maxValue: number | null;
  };
  
  // Helper to filter contracts locally (if needed)
  filterContracts: (contracts: Contract[]) => Contract[];
  sortContracts: (contracts: Contract[]) => Contract[];
  paginateContracts: (contracts: Contract[]) => Contract[];
  
  // Register keyboard shortcuts
  registerShortcuts: (handlers: Partial<KeyboardShortcutHandlers>) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractsPage(config: ContractsPageConfig = {}): UseContractsPageReturn {
  const {
    initialFilters,
    initialSortField = 'lastUpdated',
    initialSortDirection = 'desc',
    initialPageSize = 20,
    persistState = true,
    enableKeyboardShortcuts = true,
    totalItems = 0,
    allContractIds = [],
  } = config;

  // Initialize individual hooks
  const filterHook = useContractFilters({
    initialFilters,
    persistToUrl: persistState,
    persistToLocalStorage: persistState,
    debounceMs: 300,
  });

  const sortHook = useContractSorting({
    initialField: initialSortField,
    initialDirection: initialSortDirection,
    persistToUrl: persistState,
    persistToLocalStorage: persistState,
  });

  const paginationHook = usePagination({
    totalItems,
    initialPageSize,
    initialPage: 1,
    persistToUrl: persistState,
  });

  const selectionHook = useContractSelection({
    allItemIds: allContractIds,
    preserveOnFilter: false,
    maxSelection: undefined,
    onSelectionChange: undefined,
  });

  const bulkOpsHook = useBulkOperations();

  // ============================================================================
  // Combined State
  // ============================================================================

  const state = useMemo<ContractsPageState>(() => ({
    // Filters
    filters: filterHook.filters,
    activeFiltersCount: filterHook.activeFiltersCount,
    isFiltered: filterHook.activeFiltersCount > 0 || filterHook.filters.search !== '',
    
    // Sorting
    sortField: sortHook.sortField,
    sortDirection: sortHook.sortDirection,
    sortKey: sortHook.sortKey,
    
    // Pagination
    currentPage: paginationHook.pagination.currentPage,
    pageSize: paginationHook.pagination.pageSize,
    totalPages: paginationHook.pagination.totalPages,
    totalItems: paginationHook.pagination.totalItems,
    hasNextPage: paginationHook.pagination.hasNextPage,
    hasPreviousPage: paginationHook.pagination.hasPreviousPage,
    startIndex: paginationHook.pagination.startIndex,
    endIndex: paginationHook.pagination.endIndex,
    
    // Selection
    selection: selectionHook.selection,
    selectedCount: selectionHook.selection.selectedIds.size,
    hasSelection: selectionHook.selection.selectedIds.size > 0,
    
    // Bulk operations
    bulkOperation: bulkOpsHook.state,
    isBulkOperationActive: bulkOpsHook.state.isProcessing,
  }), [
    filterHook.filters,
    filterHook.activeFiltersCount,
    sortHook.sortField,
    sortHook.sortDirection,
    sortHook.sortKey,
    paginationHook.pagination,
    selectionHook.selection,
    bulkOpsHook.state,
  ]);

  // ============================================================================
  // Combined Actions
  // ============================================================================

  const resetAll = useCallback(() => {
    filterHook.resetFilters();
    sortHook.resetSort();
    paginationHook.resetPagination();
    selectionHook.deselectAll();
  }, [filterHook, sortHook, paginationHook, selectionHook]);

  const applyFilterAndResetPage = useCallback((filters: Partial<ContractFilters>) => {
    filterHook.setFilters(filters);
    paginationHook.goToFirst();
    selectionHook.deselectAll();
  }, [filterHook, paginationHook, selectionHook]);

  const actions = useMemo<ContractsPageActions>(() => ({
    // Filter actions
    setFilter: filterHook.setFilter,
    setFilters: filterHook.setFilters,
    resetFilters: () => {
      filterHook.resetFilters();
      paginationHook.goToFirst();
    },
    applyQuickPreset: filterHook.applyQuickPreset,
    toggleFilterValue: filterHook.toggleFilterValue,
    
    // Sort actions
    setSort: sortHook.setSort,
    toggleSort: sortHook.toggleSort,
    resetSort: sortHook.resetSort,
    
    // Pagination actions
    goToPage: paginationHook.goToPage,
    nextPage: paginationHook.nextPage,
    previousPage: paginationHook.previousPage,
    setPageSize: paginationHook.setPageSize,
    goToFirst: paginationHook.goToFirst,
    goToLast: paginationHook.goToLast,
    resetPagination: paginationHook.resetPagination,
    
    // Selection actions
    selectItem: selectionHook.selectItem,
    deselectItem: selectionHook.deselectItem,
    toggleItem: selectionHook.toggleItem,
    selectAll: selectionHook.selectAll,
    deselectAll: selectionHook.deselectAll,
    toggleAll: selectionHook.toggleAll,
    selectRange: selectionHook.selectRange,
    isSelected: selectionHook.isSelected,
    
    // Bulk operations
    startBulkOperation: bulkOpsHook.startBulkOperation,
    cancelBulkOperation: bulkOpsHook.cancelOperation,
    undoLastOperation: bulkOpsHook.undoLastOperation,
    
    // Combined
    resetAll,
    applyFilterAndResetPage,
  }), [
    filterHook,
    sortHook,
    paginationHook,
    selectionHook,
    bulkOpsHook,
    resetAll,
    applyFilterAndResetPage,
  ]);

  // ============================================================================
  // Query Params Helper (for API calls)
  // ============================================================================

  const queryParams = useMemo(() => ({
    page: paginationHook.pagination.currentPage,
    pageSize: paginationHook.pagination.pageSize,
    sortBy: sortHook.sortField,
    sortOrder: sortHook.sortDirection,
    search: filterHook.filters.search,
    status: filterHook.filters.status,
    type: filterHook.filters.type,
    vendor: filterHook.filters.vendor,
    department: filterHook.filters.department,
    tags: filterHook.filters.tags,
    riskLevel: filterHook.filters.riskLevel,
    startDate: filterHook.filters.dateRange.start,
    endDate: filterHook.filters.dateRange.end,
    minValue: filterHook.filters.valueRange.min,
    maxValue: filterHook.filters.valueRange.max,
  }), [
    paginationHook.pagination.currentPage,
    paginationHook.pagination.pageSize,
    sortHook.sortField,
    sortHook.sortDirection,
    filterHook.filters,
  ]);

  // ============================================================================
  // Local Data Helpers
  // ============================================================================

  const filterContracts = useCallback((contracts: Contract[]): Contract[] => {
    return contracts.filter(contract => {
      const f = filterHook.filters;
      
      // Search filter
      if (f.search) {
        const searchLower = f.search.toLowerCase();
        const matchesSearch = 
          contract.title?.toLowerCase().includes(searchLower) ||
          contract.vendor?.toLowerCase().includes(searchLower) ||
          contract.description?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (f.status.length > 0 && !f.status.includes(contract.status)) {
        return false;
      }
      
      // Type filter
      if (f.type.length > 0 && !f.type.includes(contract.type || '')) {
        return false;
      }
      
      // Vendor filter
      if (f.vendor.length > 0 && !f.vendor.includes(contract.vendor || '')) {
        return false;
      }
      
      // Add more filters as needed...
      
      return true;
    });
  }, [filterHook.filters]);

  const sortContracts = useCallback((contracts: Contract[]): Contract[] => {
    return sortHook.sortContracts(contracts);
  }, [sortHook]);

  const paginateContracts = useCallback((contracts: Contract[]): Contract[] => {
    const { startIndex, endIndex } = paginationHook.pagination;
    return contracts.slice(startIndex, endIndex);
  }, [paginationHook.pagination]);

  // ============================================================================
  // Keyboard Shortcuts Registration
  // ============================================================================

  const registerShortcuts = useCallback((handlers: Partial<KeyboardShortcutHandlers>) => {
    // This would be called by the component to set up shortcuts
    // The actual hook handles the event listeners
  }, []);

  // Initialize keyboard shortcuts if enabled
  if (enableKeyboardShortcuts) {
    useContractsKeyboardShortcuts({
      onSearch: () => {
        // Focus search input - component should handle this
      },
      onRefresh: () => {
        // Trigger refresh - component should handle this
      },
      onToggleView: () => {
        // Toggle view mode - component should handle this
      },
      onNewContract: () => {
        // Open new contract dialog - component should handle this
      },
      onEscape: () => {
        selectionHook.deselectAll();
      },
      onSelectAll: () => {
        selectionHook.selectAll();
      },
      onExport: () => {
        if (selectionHook.selection.selectedIds.size > 0) {
          const ids = Array.from(selectionHook.selection.selectedIds);
          bulkOpsHook.startBulkOperation('export', ids);
        }
      },
      onDelete: () => {
        // Component should handle delete confirmation
      },
      enabled: enableKeyboardShortcuts,
    });
  }

  return {
    state,
    actions,
    queryParams,
    filterContracts,
    sortContracts,
    paginateContracts,
    registerShortcuts,
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  ContractFilters,
  QuickPreset,
} from './use-contract-filters';

export type {
  SortField,
  SortDirection,
} from './use-contract-sorting';

export type {
  PaginationState,
  PaginationActions,
} from './use-pagination';

export type {
  SelectionState,
  SelectionActions,
} from './use-contract-selection';

export type {
  BulkOperationType,
  BulkOperationState,
  BulkOperationActions,
} from './use-bulk-operations';

export type {
  KeyboardShortcutHandlers,
} from './use-contracts-keyboard-shortcuts';

export {
  QUICK_PRESETS,
  RISK_LEVELS,
  VALUE_RANGES,
} from './use-contract-filters';

export {
  SORT_OPTIONS,
} from './use-contract-sorting';

export {
  PAGE_SIZE_OPTIONS,
} from './use-pagination';

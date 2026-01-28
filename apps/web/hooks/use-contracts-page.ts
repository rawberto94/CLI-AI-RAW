/**
 * Contracts Page Integration Hook
 * 
 * Combines all contracts page hooks into a single unified API
 * for easy consumption by the contracts page and related components.
 * 
 * This hook adapts the individual hook interfaces into a flat API.
 */

import { useCallback, useMemo } from 'react';
import { 
  useContractFilters, 
  type FilterState,
  type FilterActions,
  type FilterStats,
} from './use-contract-filters';
import { 
  useContractSorting, 
  type SortField, 
  type SortDirection,
  type SortState,
  type SortActions,
} from './use-contract-sorting';
import { 
  usePagination,
  type PaginationState,
  type PaginationActions,
  type PaginationInfo,
} from './use-pagination';
import { 
  useContractSelection,
} from './use-contract-selection';
import { 
  useBulkOperations, 
  type BulkOperationType,
  type BulkOperationResult,
} from './use-bulk-operations';
import { 
  useContractsKeyboardShortcuts, 
} from './use-contracts-keyboard-shortcuts';
import type { Contract } from './use-queries';

// ============================================================================
// Types
// ============================================================================

// Alias for backward compatibility
export type ContractFilters = Partial<FilterState>;

export interface ContractsPageConfig {
  /** Contracts data to filter/sort/paginate */
  contracts?: Contract[];
  /** Initial sort field */
  initialSortField?: SortField;
  /** Initial sort direction */
  initialSortDirection?: SortDirection;
  /** Initial page size */
  initialPageSize?: number;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Tenant ID for bulk operations */
  tenantId?: string;
  /** Handler for keyboard shortcut actions */
  onKeyboardAction?: (action: string) => void;
}

export interface ContractsPageState {
  // Filter state (from FilterState)
  filters: FilterState;
  filterStats: FilterStats;
  
  // Sort state (from SortState)
  sort: SortState;
  
  // Pagination state
  pagination: PaginationState;
  paginationInfo: PaginationInfo;
  
  // Selection state
  selection: {
    selectedIds: Set<string>;
    selectedCount: number;
    isAllSelected: boolean;
    isSomeSelected: boolean;
  };
  
  // Bulk operations state
  bulkOps: {
    isProcessing: boolean;
    currentOperation: BulkOperationType | null;
    progress: number;
  };
}

export interface ContractsPageActions {
  // Filter actions
  filter: FilterActions;
  
  // Sort actions
  sort: SortActions;
  
  // Pagination actions
  pagination: PaginationActions;
  
  // Selection actions
  selection: {
    select: (id: string) => void;
    deselect: (id: string) => void;
    toggle: (id: string) => void;
    toggleAll: (allIds: string[]) => void;
    selectAll: (allIds: string[]) => void;
    deselectAll: () => void;
    selectRange: (fromId: string, toId: string, allIds: string[]) => void;
    setSelection: (ids: string[]) => void;
    isSelected: (id: string) => boolean;
    getSelectedIds: () => string[];
  };
  
  // Bulk operations
  bulkOps: {
    exportContracts: (ids: string[], format?: 'json' | 'csv' | 'pdf') => Promise<BulkOperationResult>;
    deleteContracts: (ids: string[]) => Promise<BulkOperationResult>;
    shareContracts: (ids: string[], shareWith: string[]) => Promise<BulkOperationResult>;
    categorizeContracts: (ids: string[], categoryId?: string) => Promise<BulkOperationResult>;
    archiveContracts: (ids: string[]) => Promise<BulkOperationResult>;
    cancelOperation: () => void;
  };
  
  // Combined actions
  resetAll: () => void;
}

export interface UseContractsPageReturn {
  // State object with all combined states
  state: ContractsPageState;
  
  // Actions object with all combined actions  
  actions: ContractsPageActions;
  
  // Processed data
  data: {
    filteredContracts: Contract[];
    sortedContracts: Contract[];
    paginatedContracts: Contract[];
  };
  
  // Direct access to individual hooks (for advanced use cases)
  hooks: {
    filter: ReturnType<typeof useContractFilters>;
    sort: ReturnType<typeof useContractSorting>;
    pagination: ReturnType<typeof usePagination<Contract>>;
    selection: ReturnType<typeof useContractSelection>;
    bulkOps: ReturnType<typeof useBulkOperations>;
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractsPage(config: ContractsPageConfig = {}): UseContractsPageReturn {
  const {
    contracts = [],
    initialSortField = 'createdAt',
    initialSortDirection = 'desc',
    initialPageSize = 25,
    enableKeyboardShortcuts = true,
    tenantId,
    onKeyboardAction,
  } = config;

  // Initialize individual hooks with proper arguments
  const filterHook = useContractFilters(contracts);
  const sortHook = useContractSorting(
    filterHook.filteredContracts, 
    initialSortField, 
    initialSortDirection
  );
  const paginationHook = usePagination<Contract>(
    sortHook.sortedContracts,
    initialPageSize
  );
  const selectionHook = useContractSelection();
  const bulkOpsHook = useBulkOperations({ tenantId });

  // Keyboard shortcuts
  useContractsKeyboardShortcuts({
    onFocusSearch: () => onKeyboardAction?.('search'),
    onRefresh: () => onKeyboardAction?.('refresh'),
    onToggleViewMode: () => onKeyboardAction?.('toggleView'),
    onNavigateToUpload: () => onKeyboardAction?.('newContract'),
    onDeselectAll: () => selectionHook.deselectAll(),
    onSelectAll: () => selectionHook.selectAll(contracts.map(c => c.id)),
    onExport: () => {
      const ids = selectionHook.getSelectedIds();
      if (ids.length > 0) {
        bulkOpsHook.exportContracts(ids);
      }
    },
    onDelete: () => onKeyboardAction?.('delete'),
    enabled: enableKeyboardShortcuts,
  });

  // ============================================================================
  // Combined State
  // ============================================================================

  const state = useMemo<ContractsPageState>(() => ({
    filters: filterHook.state,
    filterStats: filterHook.stats,
    sort: sortHook.state,
    pagination: paginationHook.state,
    paginationInfo: paginationHook.info,
    selection: {
      selectedIds: selectionHook.selectedIds,
      selectedCount: selectionHook.selectedCount,
      isAllSelected: selectionHook.isAllSelected,
      isSomeSelected: selectionHook.isSomeSelected,
    },
    bulkOps: {
      isProcessing: bulkOpsHook.isProcessing,
      currentOperation: bulkOpsHook.currentOperation,
      progress: bulkOpsHook.progress,
    },
  }), [
    filterHook.state,
    filterHook.stats,
    sortHook.state,
    paginationHook.state,
    paginationHook.info,
    selectionHook.selectedIds,
    selectionHook.selectedCount,
    selectionHook.isAllSelected,
    selectionHook.isSomeSelected,
    bulkOpsHook.isProcessing,
    bulkOpsHook.currentOperation,
    bulkOpsHook.progress,
  ]);

  // ============================================================================
  // Combined Actions
  // ============================================================================

  const resetAll = useCallback(() => {
    filterHook.actions.clearAllFilters();
    paginationHook.actions.firstPage();
    selectionHook.deselectAll();
  }, [filterHook.actions, paginationHook.actions, selectionHook]);

  const actions = useMemo<ContractsPageActions>(() => ({
    filter: filterHook.actions,
    sort: sortHook.actions,
    pagination: paginationHook.actions,
    selection: {
      select: selectionHook.select,
      deselect: selectionHook.deselect,
      toggle: selectionHook.toggle,
      toggleAll: selectionHook.toggleAll,
      selectAll: selectionHook.selectAll,
      deselectAll: selectionHook.deselectAll,
      selectRange: selectionHook.selectRange,
      setSelection: selectionHook.setSelection,
      isSelected: selectionHook.isSelected,
      getSelectedIds: selectionHook.getSelectedIds,
    },
    bulkOps: {
      exportContracts: bulkOpsHook.exportContracts,
      deleteContracts: bulkOpsHook.deleteContracts,
      shareContracts: bulkOpsHook.shareContracts,
      categorizeContracts: bulkOpsHook.categorizeContracts,
      archiveContracts: bulkOpsHook.archiveContracts,
      cancelOperation: bulkOpsHook.cancelOperation,
    },
    resetAll,
  }), [
    filterHook.actions,
    sortHook.actions,
    paginationHook.actions,
    selectionHook,
    bulkOpsHook,
    resetAll,
  ]);

  // ============================================================================
  // Processed Data
  // ============================================================================

  const data = useMemo(() => ({
    filteredContracts: filterHook.filteredContracts,
    sortedContracts: sortHook.sortedContracts,
    paginatedContracts: paginationHook.paginatedItems,
  }), [
    filterHook.filteredContracts,
    sortHook.sortedContracts,
    paginationHook.paginatedItems,
  ]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    state,
    actions,
    data,
    hooks: {
      filter: filterHook,
      sort: sortHook,
      pagination: paginationHook,
      selection: selectionHook,
      bulkOps: bulkOpsHook,
    },
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  FilterState,
  FilterActions,
  FilterStats,
  QuickPreset,
} from './use-contract-filters';

export type {
  SortField,
  SortDirection,
  SortState,
  SortActions,
} from './use-contract-sorting';

export type {
  PaginationState,
  PaginationActions,
  PaginationInfo,
} from './use-pagination';

export type {
  SelectionState,
  SelectionActions,
} from './use-contract-selection';

export type {
  BulkOperationType,
  BulkOperationState,
  BulkOperationActions,
  BulkOperationResult,
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

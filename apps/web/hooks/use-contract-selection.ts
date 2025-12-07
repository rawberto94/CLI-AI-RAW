/**
 * Contract Selection Hook
 * 
 * Manages selection state for contracts with support for
 * multi-select, shift-select, and bulk operations.
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

// Alias types for backward compatibility with use-contracts-page
export interface SelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  lastSelectedId?: string | null;
}

export interface SelectionActions {
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
}

export interface UseContractSelectionOptions {
  /** Maximum number of items that can be selected */
  maxSelection?: number;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface UseContractSelectionResult {
  // State
  selectedIds: Set<string>;
  selectedCount: number;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  
  // Actions
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggle: (id: string) => void;
  toggleAll: (allIds: string[]) => void;
  selectAll: (allIds: string[]) => void;
  deselectAll: () => void;
  selectRange: (fromId: string, toId: string, allIds: string[]) => void;
  setSelection: (ids: string[]) => void;
  
  // Checkers
  isSelected: (id: string) => boolean;
  
  // Bulk operation helpers
  getSelectedIds: () => string[];
  hasSelection: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractSelection(
  options: UseContractSelectionOptions = {}
): UseContractSelectionResult {
  const { maxSelection, onSelectionChange } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Update selection and notify
  const updateSelection = useCallback((newSelection: Set<string>) => {
    setSelectedIds(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  }, [onSelectionChange]);

  // Select a single item
  const select = useCallback((id: string) => {
    setSelectedIds(prev => {
      if (maxSelection && prev.size >= maxSelection) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
    setLastSelectedId(id);
  }, [maxSelection, onSelectionChange]);

  // Deselect a single item
  const deselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }, [onSelectionChange]);

  // Toggle selection of a single item
  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (maxSelection && next.size >= maxSelection) {
          return prev;
        }
        next.add(id);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
    setLastSelectedId(id);
  }, [maxSelection, onSelectionChange]);

  // Toggle all items
  const toggleAll = useCallback((allIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = allIds.every(id => prev.has(id));
      if (allSelected) {
        onSelectionChange?.([]);
        return new Set();
      } else {
        const limitedIds = maxSelection ? allIds.slice(0, maxSelection) : allIds;
        onSelectionChange?.(limitedIds);
        return new Set(limitedIds);
      }
    });
  }, [maxSelection, onSelectionChange]);

  // Select all items
  const selectAll = useCallback((allIds: string[]) => {
    const limitedIds = maxSelection ? allIds.slice(0, maxSelection) : allIds;
    const next = new Set(limitedIds);
    updateSelection(next);
  }, [maxSelection, updateSelection]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    updateSelection(new Set());
  }, [updateSelection]);

  // Select a range of items (for shift-click)
  const selectRange = useCallback((fromId: string, toId: string, allIds: string[]) => {
    const fromIndex = allIds.indexOf(fromId);
    const toIndex = allIds.indexOf(toId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = allIds.slice(start, end + 1);
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of rangeIds) {
        if (maxSelection && next.size >= maxSelection) break;
        next.add(id);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
    setLastSelectedId(toId);
  }, [maxSelection, onSelectionChange]);

  // Set selection directly
  const setSelection = useCallback((ids: string[]) => {
    const limitedIds = maxSelection ? ids.slice(0, maxSelection) : ids;
    updateSelection(new Set(limitedIds));
  }, [maxSelection, updateSelection]);

  // Check if item is selected
  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get selected IDs as array
  const getSelectedIds = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  // Computed values
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  return {
    selectedIds,
    selectedCount,
    isAllSelected: false, // Will be computed by consumer with allIds
    isSomeSelected: hasSelection,
    select,
    deselect,
    toggle,
    toggleAll,
    selectAll,
    deselectAll,
    selectRange,
    setSelection,
    isSelected,
    getSelectedIds,
    hasSelection,
  };
}

// ============================================================================
// Hook with visible items context
// ============================================================================

export interface UseContractSelectionWithContextOptions extends UseContractSelectionOptions {
  /** All visible contract IDs */
  visibleIds: string[];
}

export function useContractSelectionWithContext(
  options: UseContractSelectionWithContextOptions
): UseContractSelectionResult & {
  isAllVisibleSelected: boolean;
  isSomeVisibleSelected: boolean;
  selectAllVisible: () => void;
  toggleAllVisible: () => void;
} {
  const { visibleIds, ...baseOptions } = options;
  const base = useContractSelection(baseOptions);

  const isAllVisibleSelected = useMemo(() => {
    return visibleIds.length > 0 && visibleIds.every(id => base.selectedIds.has(id));
  }, [visibleIds, base.selectedIds]);

  const isSomeVisibleSelected = useMemo(() => {
    return visibleIds.some(id => base.selectedIds.has(id)) && !isAllVisibleSelected;
  }, [visibleIds, base.selectedIds, isAllVisibleSelected]);

  const selectAllVisible = useCallback(() => {
    base.selectAll(visibleIds);
  }, [base, visibleIds]);

  const toggleAllVisible = useCallback(() => {
    base.toggleAll(visibleIds);
  }, [base, visibleIds]);

  return {
    ...base,
    isAllSelected: isAllVisibleSelected,
    isAllVisibleSelected,
    isSomeVisibleSelected,
    selectAllVisible,
    toggleAllVisible,
  };
}

export default useContractSelection;

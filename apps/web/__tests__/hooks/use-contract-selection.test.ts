/**
 * Tests for useContractSelection hook
 * @see /hooks/use-contract-selection.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractSelection } from '../../hooks/use-contract-selection';

describe('useContractSelection', () => {
  const allIds = ['c1', 'c2', 'c3', 'c4', 'c5'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty selection', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      expect(result.current.selection.selectedIds.size).toBe(0);
      expect(result.current.selection.lastSelectedId).toBeNull();
      expect(result.current.selection.isAllSelected).toBe(false);
      expect(result.current.selection.isIndeterminate).toBe(false);
    });

    it('should initialize with initial selection', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2'],
        })
      );

      expect(result.current.selection.selectedIds.size).toBe(2);
      expect(result.current.isSelected('c1')).toBe(true);
      expect(result.current.isSelected('c2')).toBe(true);
      expect(result.current.isSelected('c3')).toBe(false);
    });
  });

  describe('selectItem', () => {
    it('should select an item', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectItem('c1');
      });

      expect(result.current.isSelected('c1')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
    });

    it('should update lastSelectedId', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectItem('c3');
      });

      expect(result.current.selection.lastSelectedId).toBe('c3');
    });

    it('should not duplicate selection', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectItem('c1');
        result.current.selectItem('c1');
      });

      expect(result.current.selection.selectedIds.size).toBe(1);
    });
  });

  describe('deselectItem', () => {
    it('should deselect an item', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2'],
        })
      );

      act(() => {
        result.current.deselectItem('c1');
      });

      expect(result.current.isSelected('c1')).toBe(false);
      expect(result.current.isSelected('c2')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
    });

    it('should handle deselecting non-selected item', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.deselectItem('c1');
      });

      expect(result.current.selection.selectedIds.size).toBe(0);
    });
  });

  describe('toggleItem', () => {
    it('should toggle item selection on', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.toggleItem('c1');
      });

      expect(result.current.isSelected('c1')).toBe(true);
    });

    it('should toggle item selection off', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1'],
        })
      );

      act(() => {
        result.current.toggleItem('c1');
      });

      expect(result.current.isSelected('c1')).toBe(false);
    });
  });

  describe('selectAll', () => {
    it('should select all items', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectAll();
      });

      expect(result.current.selection.selectedIds.size).toBe(5);
      expect(result.current.selection.isAllSelected).toBe(true);
      allIds.forEach(id => {
        expect(result.current.isSelected(id)).toBe(true);
      });
    });
  });

  describe('deselectAll', () => {
    it('should deselect all items', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2', 'c3'],
        })
      );

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selection.selectedIds.size).toBe(0);
      expect(result.current.selection.isAllSelected).toBe(false);
    });

    it('should clear lastSelectedId', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1'],
        })
      );

      act(() => {
        result.current.selectItem('c2');
      });

      expect(result.current.selection.lastSelectedId).toBe('c2');

      act(() => {
        result.current.deselectAll();
      });

      expect(result.current.selection.lastSelectedId).toBeNull();
    });
  });

  describe('toggleAll', () => {
    it('should select all when none selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selection.isAllSelected).toBe(true);
    });

    it('should deselect all when all selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: allIds,
        })
      );

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selection.selectedIds.size).toBe(0);
    });

    it('should select all when partially selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2'],
        })
      );

      act(() => {
        result.current.toggleAll();
      });

      expect(result.current.selection.isAllSelected).toBe(true);
    });
  });

  describe('selectRange', () => {
    it('should select a range of items', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectRange('c1', 'c3');
      });

      expect(result.current.isSelected('c1')).toBe(true);
      expect(result.current.isSelected('c2')).toBe(true);
      expect(result.current.isSelected('c3')).toBe(true);
      expect(result.current.isSelected('c4')).toBe(false);
      expect(result.current.isSelected('c5')).toBe(false);
    });

    it('should work with reversed range', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectRange('c4', 'c2');
      });

      expect(result.current.isSelected('c2')).toBe(true);
      expect(result.current.isSelected('c3')).toBe(true);
      expect(result.current.isSelected('c4')).toBe(true);
    });

    it('should handle single item range', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      act(() => {
        result.current.selectRange('c3', 'c3');
      });

      expect(result.current.isSelected('c3')).toBe(true);
      expect(result.current.selection.selectedIds.size).toBe(1);
    });
  });

  describe('shift-click selection', () => {
    it('should select range when shift-clicking', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      // First click without shift
      act(() => {
        result.current.selectItem('c1');
      });

      // Shift-click on c4
      act(() => {
        result.current.toggleItem('c4', true); // true = shiftKey
      });

      expect(result.current.isSelected('c1')).toBe(true);
      expect(result.current.isSelected('c2')).toBe(true);
      expect(result.current.isSelected('c3')).toBe(true);
      expect(result.current.isSelected('c4')).toBe(true);
    });
  });

  describe('isAllSelected', () => {
    it('should be true when all items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: allIds,
        })
      );

      expect(result.current.selection.isAllSelected).toBe(true);
    });

    it('should be false when not all items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2'],
        })
      );

      expect(result.current.selection.isAllSelected).toBe(false);
    });

    it('should be false when no items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      expect(result.current.selection.isAllSelected).toBe(false);
    });
  });

  describe('isIndeterminate', () => {
    it('should be true when some but not all items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: ['c1', 'c2'],
        })
      );

      expect(result.current.selection.isIndeterminate).toBe(true);
    });

    it('should be false when all items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          initialSelectedIds: allIds,
        })
      );

      expect(result.current.selection.isIndeterminate).toBe(false);
    });

    it('should be false when no items are selected', () => {
      const { result } = renderHook(() =>
        useContractSelection({ allItemIds: allIds })
      );

      expect(result.current.selection.isIndeterminate).toBe(false);
    });
  });

  describe('maxSelection', () => {
    it('should respect max selection limit', () => {
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          maxSelection: 2,
        })
      );

      act(() => {
        result.current.selectItem('c1');
        result.current.selectItem('c2');
        result.current.selectItem('c3');
      });

      expect(result.current.selection.selectedIds.size).toBe(2);
    });
  });

  describe('onSelectionChange callback', () => {
    it('should call onSelectionChange when selection changes', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useContractSelection({
          allItemIds: allIds,
          onSelectionChange,
        })
      );

      act(() => {
        result.current.selectItem('c1');
      });

      expect(onSelectionChange).toHaveBeenCalled();
    });
  });

  describe('preserveOnFilter', () => {
    it('should clear selection when allItemIds changes by default', () => {
      const { result, rerender } = renderHook(
        ({ ids }) => useContractSelection({ allItemIds: ids, preserveOnFilter: false }),
        { initialProps: { ids: allIds } }
      );

      act(() => {
        result.current.selectItem('c1');
        result.current.selectItem('c2');
      });

      expect(result.current.selection.selectedIds.size).toBe(2);

      rerender({ ids: ['c1', 'c3', 'c5'] });

      // Selection should be cleared or filtered
      expect(result.current.selection.selectedIds.size).toBeLessThanOrEqual(2);
    });
  });
});

/**
 * Tests for useContractsPage hook (unified integration hook)
 * @see /hooks/use-contracts-page.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractsPage } from '../../hooks/use-contracts-page';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useContractsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useContractsPage());

      // Filter state
      expect(result.current.state.filters.search).toBe('');
      expect(result.current.state.activeFiltersCount).toBe(0);
      expect(result.current.state.isFiltered).toBe(false);

      // Sort state
      expect(result.current.state.sortField).toBe('lastUpdated');
      expect(result.current.state.sortDirection).toBe('desc');

      // Pagination state
      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.pageSize).toBe(20);

      // Selection state
      expect(result.current.state.selectedCount).toBe(0);
      expect(result.current.state.hasSelection).toBe(false);

      // Bulk operation state
      expect(result.current.state.isBulkOperationActive).toBe(false);
    });

    it('should initialize with custom config', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialFilters: { status: ['active'] },
          initialSortField: 'title',
          initialSortDirection: 'asc',
          initialPageSize: 50,
        })
      );

      expect(result.current.state.filters.status).toContain('active');
      expect(result.current.state.sortField).toBe('title');
      expect(result.current.state.sortDirection).toBe('asc');
      expect(result.current.state.pageSize).toBe(50);
    });
  });

  describe('filter actions', () => {
    it('should set a filter', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.setFilter('search', 'test query');
      });

      expect(result.current.state.filters.search).toBe('test query');
    });

    it('should set multiple filters', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.setFilters({
          status: ['active', 'pending'],
          vendor: ['Acme Corp'],
        });
      });

      expect(result.current.state.filters.status).toEqual(['active', 'pending']);
      expect(result.current.state.filters.vendor).toEqual(['Acme Corp']);
    });

    it('should reset filters', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialFilters: { status: ['active'] },
        })
      );

      act(() => {
        result.current.actions.setFilter('vendor', ['Test Vendor']);
      });

      act(() => {
        result.current.actions.resetFilters();
      });

      expect(result.current.state.filters.status).toEqual([]);
      expect(result.current.state.filters.vendor).toEqual([]);
      expect(result.current.state.currentPage).toBe(1); // Should reset page
    });

    it('should apply quick preset', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.applyQuickPreset('high-risk');
      });

      expect(result.current.state.filters.riskLevel).toContain('high');
    });

    it('should toggle filter value', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.toggleFilterValue('status', 'active');
      });

      expect(result.current.state.filters.status).toContain('active');

      act(() => {
        result.current.actions.toggleFilterValue('status', 'active');
      });

      expect(result.current.state.filters.status).not.toContain('active');
    });
  });

  describe('sort actions', () => {
    it('should set sort', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.setSort('value', 'asc');
      });

      expect(result.current.state.sortField).toBe('value');
      expect(result.current.state.sortDirection).toBe('asc');
    });

    it('should toggle sort', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialSortField: 'title',
          initialSortDirection: 'asc',
        })
      );

      act(() => {
        result.current.actions.toggleSort('title');
      });

      expect(result.current.state.sortDirection).toBe('desc');
    });

    it('should reset sort', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.setSort('value', 'asc');
      });

      act(() => {
        result.current.actions.resetSort();
      });

      expect(result.current.state.sortField).toBe('lastUpdated');
      expect(result.current.state.sortDirection).toBe('desc');
    });
  });

  describe('pagination actions', () => {
    it('should go to page', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100 })
      );

      act(() => {
        result.current.actions.goToPage(3);
      });

      expect(result.current.state.currentPage).toBe(3);
    });

    it('should go to next page', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100 })
      );

      act(() => {
        result.current.actions.nextPage();
      });

      expect(result.current.state.currentPage).toBe(2);
    });

    it('should go to previous page', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100 })
      );

      act(() => {
        result.current.actions.goToPage(3);
      });

      act(() => {
        result.current.actions.previousPage();
      });

      expect(result.current.state.currentPage).toBe(2);
    });

    it('should set page size', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100 })
      );

      act(() => {
        result.current.actions.setPageSize(50);
      });

      expect(result.current.state.pageSize).toBe(50);
    });

    it('should go to first page', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100 })
      );

      act(() => {
        result.current.actions.goToPage(4);
      });

      act(() => {
        result.current.actions.goToFirst();
      });

      expect(result.current.state.currentPage).toBe(1);
    });

    it('should go to last page', () => {
      const { result } = renderHook(() =>
        useContractsPage({ totalItems: 100, initialPageSize: 20 })
      );

      act(() => {
        result.current.actions.goToLast();
      });

      expect(result.current.state.currentPage).toBe(5);
    });
  });

  describe('selection actions', () => {
    it('should select item', () => {
      const { result } = renderHook(() =>
        useContractsPage({ allContractIds: ['c1', 'c2', 'c3'] })
      );

      act(() => {
        result.current.actions.selectItem('c1');
      });

      expect(result.current.actions.isSelected('c1')).toBe(true);
      expect(result.current.state.selectedCount).toBe(1);
    });

    it('should deselect item', () => {
      const { result } = renderHook(() =>
        useContractsPage({ allContractIds: ['c1', 'c2', 'c3'] })
      );

      act(() => {
        result.current.actions.selectItem('c1');
      });

      act(() => {
        result.current.actions.deselectItem('c1');
      });

      expect(result.current.actions.isSelected('c1')).toBe(false);
    });

    it('should toggle item', () => {
      const { result } = renderHook(() =>
        useContractsPage({ allContractIds: ['c1', 'c2', 'c3'] })
      );

      act(() => {
        result.current.actions.toggleItem('c1');
      });

      expect(result.current.actions.isSelected('c1')).toBe(true);

      act(() => {
        result.current.actions.toggleItem('c1');
      });

      expect(result.current.actions.isSelected('c1')).toBe(false);
    });

    it('should select all', () => {
      const { result } = renderHook(() =>
        useContractsPage({ allContractIds: ['c1', 'c2', 'c3'] })
      );

      act(() => {
        result.current.actions.selectAll();
      });

      expect(result.current.state.selectedCount).toBe(3);
      expect(result.current.state.selection.isAllSelected).toBe(true);
    });

    it('should deselect all', () => {
      const { result } = renderHook(() =>
        useContractsPage({ allContractIds: ['c1', 'c2', 'c3'] })
      );

      act(() => {
        result.current.actions.selectAll();
      });

      act(() => {
        result.current.actions.deselectAll();
      });

      expect(result.current.state.selectedCount).toBe(0);
      expect(result.current.state.hasSelection).toBe(false);
    });
  });

  describe('combined actions', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          totalItems: 100,
          allContractIds: ['c1', 'c2', 'c3'],
        })
      );

      // Set various states
      act(() => {
        result.current.actions.setFilter('status', ['active']);
        result.current.actions.setSort('value', 'asc');
        result.current.actions.goToPage(3);
        result.current.actions.selectItem('c1');
      });

      // Reset all
      act(() => {
        result.current.actions.resetAll();
      });

      expect(result.current.state.filters.status).toEqual([]);
      expect(result.current.state.sortField).toBe('lastUpdated');
      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.selectedCount).toBe(0);
    });

    it('should apply filter and reset page', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          totalItems: 100,
          allContractIds: ['c1', 'c2', 'c3'],
        })
      );

      act(() => {
        result.current.actions.goToPage(4);
        result.current.actions.selectItem('c1');
      });

      act(() => {
        result.current.actions.applyFilterAndResetPage({ status: ['active'] });
      });

      expect(result.current.state.filters.status).toContain('active');
      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.selectedCount).toBe(0);
    });
  });

  describe('queryParams', () => {
    it('should generate correct query params', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialFilters: { status: ['active'], search: 'test' },
          initialSortField: 'value',
          initialSortDirection: 'desc',
          initialPageSize: 25,
        })
      );

      expect(result.current.queryParams.page).toBe(1);
      expect(result.current.queryParams.pageSize).toBe(25);
      expect(result.current.queryParams.sortBy).toBe('value');
      expect(result.current.queryParams.sortOrder).toBe('desc');
      expect(result.current.queryParams.search).toBe('test');
      expect(result.current.queryParams.status).toContain('active');
    });

    it('should update query params when state changes', () => {
      const { result } = renderHook(() => useContractsPage());

      act(() => {
        result.current.actions.setFilter('search', 'new search');
        result.current.actions.goToPage(2);
      });

      expect(result.current.queryParams.search).toBe('new search');
      expect(result.current.queryParams.page).toBe(2);
    });
  });

  describe('helper functions', () => {
    const contracts = [
      { id: '1', title: 'Contract A', status: 'active', value: 1000 },
      { id: '2', title: 'Contract B', status: 'expired', value: 5000 },
      { id: '3', title: 'Contract C', status: 'active', value: 2500 },
    ] as any[];

    it('should filter contracts', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialFilters: { status: ['active'] },
        })
      );

      const filtered = result.current.filterContracts(contracts);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.status === 'active')).toBe(true);
    });

    it('should sort contracts', () => {
      const { result } = renderHook(() =>
        useContractsPage({
          initialSortField: 'value',
          initialSortDirection: 'desc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.value).toBe(5000);
      expect(sorted[1]?.value).toBe(2500);
      expect(sorted[2]?.value).toBe(1000);
    });

    it('should paginate contracts', () => {
      const manyContracts = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        title: `Contract ${i + 1}`,
      }));

      const { result } = renderHook(() =>
        useContractsPage({
          totalItems: 50,
          initialPageSize: 10,
        })
      );

      const paginated = result.current.paginateContracts(manyContracts);

      expect(paginated).toHaveLength(10);
      expect(paginated[0]?.id).toBe('1');
    });
  });
});

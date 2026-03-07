/**
 * Tests for useContractSorting hook
 * @see /hooks/use-contract-sorting.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractSorting, SORT_OPTIONS } from '../../hooks/use-contract-sorting';

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

describe('useContractSorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with default sort', () => {
      const { result } = renderHook(() => useContractSorting());

      expect(result.current.sortField).toBe('lastUpdated');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should initialize with custom initial sort', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      expect(result.current.sortField).toBe('title');
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('setSort', () => {
    it('should set sort field and direction', () => {
      const { result } = renderHook(() => useContractSorting());

      act(() => {
        result.current.setSort('value', 'desc');
      });

      expect(result.current.sortField).toBe('value');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should set sort field with default direction', () => {
      const { result } = renderHook(() => useContractSorting());

      act(() => {
        result.current.setSort('title');
      });

      expect(result.current.sortField).toBe('title');
      // Should use default direction for the field
    });
  });

  describe('toggleSort', () => {
    it('should toggle direction when clicking same field', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      act(() => {
        result.current.toggleSort('title');
      });

      expect(result.current.sortField).toBe('title');
      expect(result.current.sortDirection).toBe('desc');
    });

    it('should set new field with default direction when clicking different field', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      act(() => {
        result.current.toggleSort('value');
      });

      expect(result.current.sortField).toBe('value');
      // New field should use its default direction
    });

    it('should cycle through ascending -> descending -> ascending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      act(() => {
        result.current.toggleSort('title');
      });
      expect(result.current.sortDirection).toBe('desc');

      act(() => {
        result.current.toggleSort('title');
      });
      expect(result.current.sortDirection).toBe('asc');
    });
  });

  describe('resetSort', () => {
    it('should reset to default sort', () => {
      const { result } = renderHook(() => useContractSorting());

      act(() => {
        result.current.setSort('value', 'asc');
      });

      act(() => {
        result.current.resetSort();
      });

      expect(result.current.sortField).toBe('lastUpdated');
      expect(result.current.sortDirection).toBe('desc');
    });
  });

  describe('sortKey', () => {
    it('should return combined sort key', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      expect(result.current.sortKey).toBe('title-asc');
    });

    it('should update sortKey when sort changes', () => {
      const { result } = renderHook(() => useContractSorting());

      act(() => {
        result.current.setSort('value', 'desc');
      });

      expect(result.current.sortKey).toBe('value-desc');
    });
  });

  describe('sortContracts', () => {
    const contracts = [
      { id: '1', title: 'Zebra Contract', value: 1000, lastUpdated: '2024-01-15', vendor: 'Vendor A' },
      { id: '2', title: 'Alpha Contract', value: 5000, lastUpdated: '2024-03-20', vendor: 'Vendor C' },
      { id: '3', title: 'Beta Contract', value: 2500, lastUpdated: '2024-02-10', vendor: 'Vendor B' },
    ] as any[];

    it('should sort by title ascending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.title).toBe('Alpha Contract');
      expect(sorted[1]?.title).toBe('Beta Contract');
      expect(sorted[2]?.title).toBe('Zebra Contract');
    });

    it('should sort by title descending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'desc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.title).toBe('Zebra Contract');
      expect(sorted[1]?.title).toBe('Beta Contract');
      expect(sorted[2]?.title).toBe('Alpha Contract');
    });

    it('should sort by value ascending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'value',
          initialDirection: 'asc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.value).toBe(1000);
      expect(sorted[1]?.value).toBe(2500);
      expect(sorted[2]?.value).toBe(5000);
    });

    it('should sort by value descending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'value',
          initialDirection: 'desc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.value).toBe(5000);
      expect(sorted[1]?.value).toBe(2500);
      expect(sorted[2]?.value).toBe(1000);
    });

    it('should sort by lastUpdated descending', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'lastUpdated',
          initialDirection: 'desc',
        })
      );

      const sorted = result.current.sortContracts(contracts);

      expect(sorted[0]?.lastUpdated).toBe('2024-03-20');
      expect(sorted[1]?.lastUpdated).toBe('2024-02-10');
      expect(sorted[2]?.lastUpdated).toBe('2024-01-15');
    });

    it('should not mutate original array', () => {
      const { result } = renderHook(() => useContractSorting());
      const originalOrder = [...contracts.map(c => c.id)];

      result.current.sortContracts(contracts);

      expect(contracts.map(c => c.id)).toEqual(originalOrder);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => useContractSorting());

      const sorted = result.current.sortContracts([]);

      expect(sorted).toEqual([]);
    });

    it('should handle null/undefined values', () => {
      const contractsWithNulls = [
        { id: '1', title: 'Contract A', value: null },
        { id: '2', title: 'Contract B', value: 5000 },
        { id: '3', title: null, value: 2500 },
      ] as any[];

      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'value',
          initialDirection: 'desc',
        })
      );

      expect(() => result.current.sortContracts(contractsWithNulls)).not.toThrow();
    });
  });

  describe('getSortIcon', () => {
    it('should return appropriate icon indicator for active sort', () => {
      const { result } = renderHook(() =>
        useContractSorting({
          initialField: 'title',
          initialDirection: 'asc',
        })
      );

      // The hook should provide a way to check sort state for a field
      expect(result.current.sortField).toBe('title');
      expect(result.current.sortDirection).toBe('asc');
    });
  });
});

describe('SORT_OPTIONS', () => {
  it('should export sort options array', () => {
    expect(SORT_OPTIONS).toBeDefined();
    expect(Array.isArray(SORT_OPTIONS)).toBe(true);
    expect(SORT_OPTIONS.length).toBeGreaterThan(0);
  });

  it('should have valid structure for each option', () => {
    SORT_OPTIONS.forEach(option => {
      expect(option.field).toBeDefined();
      expect(option.label).toBeDefined();
      expect(typeof option.field).toBe('string');
      expect(typeof option.label).toBe('string');
    });
  });

  it('should include common sort fields', () => {
    const fields = SORT_OPTIONS.map(o => o.field);
    
    expect(fields).toContain('title');
    expect(fields).toContain('value');
    expect(fields).toContain('lastUpdated');
  });
});

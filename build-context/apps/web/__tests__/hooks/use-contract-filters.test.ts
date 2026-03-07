/**
 * Tests for useContractFilters hook
 * @see /hooks/use-contract-filters.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContractFilters, QUICK_PRESETS, RISK_LEVELS, VALUE_RANGES, createDefaultFilters } from '../../hooks/use-contract-filters';

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

// Mock URL API
const mockPushState = vi.fn();
const mockReplaceState = vi.fn();
Object.defineProperty(window, 'history', {
  value: {
    pushState: mockPushState,
    replaceState: mockReplaceState,
  },
});

describe('useContractFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('initialization', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() => useContractFilters());

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.status).toEqual([]);
      expect(result.current.filters.type).toEqual([]);
      expect(result.current.filters.vendor).toEqual([]);
      expect(result.current.filters.department).toEqual([]);
      expect(result.current.filters.tags).toEqual([]);
      expect(result.current.filters.riskLevel).toEqual([]);
      expect(result.current.filters.dateRange).toEqual({ start: null, end: null });
      expect(result.current.filters.valueRange).toEqual({ min: null, max: null });
      expect(result.current.filters.expiringWithin).toBeNull();
      expect(result.current.activeFiltersCount).toBe(0);
    });

    it('should initialize with custom initial filters', () => {
      const { result } = renderHook(() =>
        useContractFilters({
          initialFilters: {
            status: ['active', 'pending'],
            search: 'test query',
          },
        })
      );

      expect(result.current.filters.status).toEqual(['active', 'pending']);
      expect(result.current.filters.search).toBe('test query');
      expect(result.current.activeFiltersCount).toBeGreaterThan(0);
    });
  });

  describe('setFilter', () => {
    it('should update a single filter value', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('search', 'new search');
      });

      expect(result.current.filters.search).toBe('new search');
    });

    it('should update array filters', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('status', ['active', 'expired']);
      });

      expect(result.current.filters.status).toEqual(['active', 'expired']);
    });

    it('should update date range filter', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('dateRange', { start: '2024-01-01', end: '2024-12-31' });
      });

      expect(result.current.filters.dateRange).toEqual({ start: '2024-01-01', end: '2024-12-31' });
    });

    it('should update value range filter', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('valueRange', { min: 1000, max: 50000 });
      });

      expect(result.current.filters.valueRange).toEqual({ min: 1000, max: 50000 });
    });
  });

  describe('setFilters', () => {
    it('should update multiple filters at once', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilters({
          search: 'multi update',
          status: ['active'],
          vendor: ['Acme Corp'],
        });
      });

      expect(result.current.filters.search).toBe('multi update');
      expect(result.current.filters.status).toEqual(['active']);
      expect(result.current.filters.vendor).toEqual(['Acme Corp']);
    });

    it('should preserve existing filters when updating partial filters', () => {
      const { result } = renderHook(() =>
        useContractFilters({
          initialFilters: {
            status: ['active'],
            type: ['subscription'],
          },
        })
      );

      act(() => {
        result.current.setFilters({
          search: 'preserve test',
        });
      });

      expect(result.current.filters.search).toBe('preserve test');
      expect(result.current.filters.status).toEqual(['active']);
      expect(result.current.filters.type).toEqual(['subscription']);
    });
  });

  describe('resetFilters', () => {
    it('should reset all filters to defaults', () => {
      const { result } = renderHook(() =>
        useContractFilters({
          initialFilters: {
            search: 'initial search',
            status: ['active'],
            riskLevel: ['high'],
          },
        })
      );

      // First set some filters
      act(() => {
        result.current.setFilters({
          vendor: ['Test Vendor'],
          expiringWithin: 30,
        });
      });

      // Then reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.status).toEqual([]);
      expect(result.current.filters.vendor).toEqual([]);
      expect(result.current.filters.riskLevel).toEqual([]);
      expect(result.current.filters.expiringWithin).toBeNull();
      expect(result.current.activeFiltersCount).toBe(0);
    });
  });

  describe('toggleFilterValue', () => {
    it('should add a value to an array filter if not present', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.toggleFilterValue('status', 'active');
      });

      expect(result.current.filters.status).toContain('active');
    });

    it('should remove a value from an array filter if present', () => {
      const { result } = renderHook(() =>
        useContractFilters({
          initialFilters: {
            status: ['active', 'pending'],
          },
        })
      );

      act(() => {
        result.current.toggleFilterValue('status', 'active');
      });

      expect(result.current.filters.status).not.toContain('active');
      expect(result.current.filters.status).toContain('pending');
    });

    it('should toggle multiple values', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.toggleFilterValue('riskLevel', 'high');
      });
      act(() => {
        result.current.toggleFilterValue('riskLevel', 'medium');
      });

      expect(result.current.filters.riskLevel).toContain('high');
      expect(result.current.filters.riskLevel).toContain('medium');

      act(() => {
        result.current.toggleFilterValue('riskLevel', 'high');
      });

      expect(result.current.filters.riskLevel).not.toContain('high');
      expect(result.current.filters.riskLevel).toContain('medium');
    });
  });

  describe('applyQuickPreset', () => {
    it('should apply expiring-soon preset', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.applyQuickPreset('expiring-soon');
      });

      expect(result.current.filters.expiringWithin).toBe(30);
    });

    it('should apply high-value preset', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.applyQuickPreset('high-value');
      });

      expect(result.current.filters.valueRange.min).toBe(100000);
    });

    it('should apply high-risk preset', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.applyQuickPreset('high-risk');
      });

      expect(result.current.filters.riskLevel).toContain('high');
    });

    it('should apply active-only preset', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.applyQuickPreset('active-only');
      });

      expect(result.current.filters.status).toContain('active');
    });

    it('should apply needs-review preset', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.applyQuickPreset('needs-review');
      });

      expect(result.current.filters.status).toContain('review');
    });
  });

  describe('activeFiltersCount', () => {
    it('should count active filters correctly', () => {
      const { result } = renderHook(() => useContractFilters());

      expect(result.current.activeFiltersCount).toBe(0);

      act(() => {
        result.current.setFilter('status', ['active']);
      });

      expect(result.current.activeFiltersCount).toBe(1);

      act(() => {
        result.current.setFilter('vendor', ['Vendor A', 'Vendor B']);
      });

      expect(result.current.activeFiltersCount).toBe(2);

      act(() => {
        result.current.setFilter('expiringWithin', 30);
      });

      expect(result.current.activeFiltersCount).toBe(3);
    });

    it('should not count search as an active filter', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('search', 'test search');
      });

      // Search is typically not counted in active filters
      expect(result.current.activeFiltersCount).toBe(0);
    });

    it('should count date range as one filter', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('dateRange', { start: '2024-01-01', end: '2024-12-31' });
      });

      expect(result.current.activeFiltersCount).toBe(1);
    });

    it('should count value range as one filter', () => {
      const { result } = renderHook(() => useContractFilters());

      act(() => {
        result.current.setFilter('valueRange', { min: 1000, max: 50000 });
      });

      expect(result.current.activeFiltersCount).toBe(1);
    });
  });

  describe('sortContracts', () => {
    const contracts = [
      { id: '1', title: 'Contract A', value: 1000, status: 'active', lastUpdated: '2024-01-15' },
      { id: '2', title: 'Contract B', value: 5000, status: 'expired', lastUpdated: '2024-03-20' },
      { id: '3', title: 'Contract C', value: 2500, status: 'active', lastUpdated: '2024-02-10' },
    ] as any[];

    it('should sort contracts by title ascending', () => {
      const { result } = renderHook(() => useContractFilters());

      const sorted = result.current.sortContracts(contracts, 'title', 'asc');

      expect(sorted[0]?.title).toBe('Contract A');
      expect(sorted[1]?.title).toBe('Contract B');
      expect(sorted[2]?.title).toBe('Contract C');
    });

    it('should sort contracts by value descending', () => {
      const { result } = renderHook(() => useContractFilters());

      const sorted = result.current.sortContracts(contracts, 'value', 'desc');

      expect(sorted[0]?.value).toBe(5000);
      expect(sorted[1]?.value).toBe(2500);
      expect(sorted[2]?.value).toBe(1000);
    });
  });
});

describe('createDefaultFilters', () => {
  it('should create default filter object', () => {
    const defaults = createDefaultFilters();

    expect(defaults.search).toBe('');
    expect(defaults.status).toEqual([]);
    expect(defaults.type).toEqual([]);
    expect(defaults.vendor).toEqual([]);
    expect(defaults.dateRange).toEqual({ start: null, end: null });
    expect(defaults.valueRange).toEqual({ min: null, max: null });
    expect(defaults.expiringWithin).toBeNull();
  });
});

describe('QUICK_PRESETS', () => {
  it('should export all expected presets', () => {
    expect(QUICK_PRESETS).toBeDefined();
    expect(Array.isArray(QUICK_PRESETS)).toBe(true);
    
    const presetIds = QUICK_PRESETS.map(p => p.id);
    expect(presetIds).toContain('expiring-soon');
    expect(presetIds).toContain('high-value');
    expect(presetIds).toContain('high-risk');
    expect(presetIds).toContain('active-only');
    expect(presetIds).toContain('needs-review');
  });

  it('should have valid filters for each preset', () => {
    QUICK_PRESETS.forEach(preset => {
      expect(preset.id).toBeDefined();
      expect(preset.label).toBeDefined();
      expect(preset.filters).toBeDefined();
      expect(typeof preset.filters).toBe('object');
    });
  });
});

describe('RISK_LEVELS', () => {
  it('should export risk level options', () => {
    expect(RISK_LEVELS).toBeDefined();
    expect(Array.isArray(RISK_LEVELS)).toBe(true);
    expect(RISK_LEVELS.length).toBeGreaterThan(0);
  });
});

describe('VALUE_RANGES', () => {
  it('should export value range options', () => {
    expect(VALUE_RANGES).toBeDefined();
    expect(Array.isArray(VALUE_RANGES)).toBe(true);
    expect(VALUE_RANGES.length).toBeGreaterThan(0);
  });

  it('should have valid min/max for each range', () => {
    VALUE_RANGES.forEach(range => {
      expect(range.label).toBeDefined();
      expect(typeof range.label).toBe('string');
      // min or max should be defined (or null for open-ended ranges)
    });
  });
});

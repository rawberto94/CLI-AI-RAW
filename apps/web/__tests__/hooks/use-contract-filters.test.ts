/**
 * Tests for useContractFilters hook
 * @see /hooks/use-contract-filters.ts
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useContractFilters,
  QUICK_PRESETS,
  RISK_LEVELS,
  VALUE_RANGES,
  DATE_PRESETS,
  CONTRACT_TYPES,
} from '../../hooks/use-contract-filters';
import type { Contract } from '../../hooks/use-queries';

// Helper to create mock contracts
function createContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c-1',
    title: 'Test Contract',
    status: 'active',
    type: 'Service Agreement',
    value: 50000,
    riskScore: 45,
    parties: { client: 'Acme Corp', supplier: 'Vendor Inc' },
    createdAt: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    category: { id: 'cat-1', name: 'IT', color: '#000', icon: '💻', path: '/it' },
    ...overrides,
  };
}

function createContracts(): Contract[] {
  return [
    createContract({ id: 'c-1', title: 'Alpha Service', status: 'active', type: 'Service Agreement', value: 10000, riskScore: 20 }),
    createContract({ id: 'c-2', title: 'Beta NDA', status: 'draft', type: 'Non-Disclosure Agreement', value: 5000, riskScore: 50 }),
    createContract({ id: 'c-3', title: 'Gamma License', status: 'active', type: 'License Agreement', value: 200000, riskScore: 80 }),
    createContract({ id: 'c-4', title: 'Delta SOW', status: 'expired', type: 'Statement of Work', value: 75000, riskScore: 10 }),
    createContract({ id: 'c-5', title: 'Epsilon Consulting', status: 'active', type: 'Consulting Agreement', value: 0, riskScore: 95, category: null }),
  ];
}

describe('useContractFilters', () => {
  describe('initialization', () => {
    it('should initialize with default filter state', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      expect(result.current.state.searchQuery).toBe('');
      expect(result.current.state.statusFilter).toBe('all');
      expect(result.current.state.typeFilters).toEqual([]);
      expect(result.current.state.riskFilters).toEqual([]);
      expect(result.current.state.approvalFilters).toEqual([]);
      expect(result.current.state.valueRangeFilter).toBeNull();
      expect(result.current.state.dateRangeFilter).toBeNull();
      expect(result.current.state.expirationFilters).toEqual([]);
      expect(result.current.state.categoryFilter).toBeNull();
      expect(result.current.state.advancedFilters).toEqual({});
      expect(result.current.state.activePreset).toBeNull();
    });

    it('should return all contracts when no filters are active', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      expect(result.current.filteredContracts).toHaveLength(5);
    });

    it('should report no active filters initially', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      expect(result.current.stats.hasActiveFilters).toBe(false);
      expect(result.current.stats.activeFilterCount).toBe(0);
    });
  });

  describe('search filter', () => {
    it('should filter contracts by search query on title', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('Alpha');
      });

      expect(result.current.filteredContracts).toHaveLength(1);
      expect(result.current.filteredContracts[0]!.title).toBe('Alpha Service');
    });

    it('should filter by client name in search', () => {
      const contracts = [
        createContract({ id: 'c-1', parties: { client: 'UniqueClient', supplier: 'Vendor' } }),
        createContract({ id: 'c-2', parties: { client: 'Other', supplier: 'Other' } }),
      ];
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('UniqueClient');
      });

      expect(result.current.filteredContracts).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('alpha');
      });

      expect(result.current.filteredContracts).toHaveLength(1);
    });
  });

  describe('status filter', () => {
    it('should filter by status', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setStatusFilter('active');
      });

      expect(result.current.filteredContracts.every(c => c.status === 'active')).toBe(true);
    });

    it('should show all when status is "all"', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setStatusFilter('active');
      });

      act(() => {
        result.current.actions.setStatusFilter('all');
      });

      expect(result.current.filteredContracts).toHaveLength(5);
    });
  });

  describe('type filters', () => {
    it('should filter by contract type', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setTypeFilters(['Service Agreement']);
      });

      expect(result.current.filteredContracts).toHaveLength(1);
      expect(result.current.filteredContracts[0]!.type).toBe('Service Agreement');
    });

    it('should support multiple type filters', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setTypeFilters(['Service Agreement', 'Non-Disclosure Agreement']);
      });

      expect(result.current.filteredContracts).toHaveLength(2);
    });
  });

  describe('risk filters', () => {
    it('should filter by risk level', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setRiskFilters(['high']);
      });

      // riskScore >= 70 and < 100: c-3 (80) and c-5 (95)
      expect(result.current.filteredContracts).toHaveLength(2);
      expect(result.current.filteredContracts.every(c => (c.riskScore ?? 0) >= 70)).toBe(true);
    });

    it('should filter by low risk', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setRiskFilters(['low']);
      });

      // riskScore >= 0 and < 30: c-1 (20) and c-4 (10)
      expect(result.current.filteredContracts).toHaveLength(2);
    });
  });

  describe('clearAllFilters', () => {
    it('should reset all filters to defaults', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('test');
        result.current.actions.setStatusFilter('active');
        result.current.actions.setRiskFilters(['high']);
      });

      act(() => {
        result.current.actions.clearAllFilters();
      });

      expect(result.current.state.searchQuery).toBe('');
      expect(result.current.state.statusFilter).toBe('all');
      expect(result.current.state.riskFilters).toEqual([]);
      expect(result.current.stats.hasActiveFilters).toBe(false);
      expect(result.current.filteredContracts).toHaveLength(5);
    });
  });

  describe('stats', () => {
    it('should compute filteredCount', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      expect(result.current.stats.filteredCount).toBe(5);

      act(() => {
        result.current.actions.setStatusFilter('active');
      });

      expect(result.current.stats.filteredCount).toBe(3);
    });

    it('should compute totalValue', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      // 10000 + 5000 + 200000 + 75000 + 0 = 290000
      expect(result.current.stats.totalValue).toBe(290000);
    });

    it('should compute highRiskCount', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      // riskScore >= 70: c-3 (80) and c-5 (95)
      expect(result.current.stats.highRiskCount).toBe(2);
    });

    it('should compute uncategorizedCount', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      // c-5 has category: null
      expect(result.current.stats.uncategorizedCount).toBe(1);
      expect(result.current.stats.categorizedCount).toBe(4);
    });

    it('should track activeFilterCount', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('test');
      });

      expect(result.current.stats.activeFilterCount).toBe(1);

      act(() => {
        result.current.actions.setStatusFilter('active');
      });

      expect(result.current.stats.activeFilterCount).toBe(2);
    });
  });

  describe('presets', () => {
    it('should apply a preset', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.applyPreset('high-risk');
      });

      expect(result.current.state.activePreset).toBe('high-risk');
      expect(result.current.state.riskFilters).toEqual(['high']);
    });

    it('should clear previous filters when applying a preset', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setSearchQuery('test');
      });

      act(() => {
        result.current.actions.applyPreset('active-only');
      });

      expect(result.current.state.searchQuery).toBe('');
      expect(result.current.state.statusFilter).toBe('active');
    });
  });

  describe('advanced filters', () => {
    it('should filter by client name', () => {
      const contracts = [
        createContract({ id: 'c-1', parties: { client: 'Acme Corp', supplier: 'Vendor' } }),
        createContract({ id: 'c-2', parties: { client: 'Beta Inc', supplier: 'Vendor' } }),
      ];
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setAdvancedFilters({ clientName: 'Acme' });
      });

      expect(result.current.filteredContracts).toHaveLength(1);
      expect(result.current.filteredContracts[0]!.parties?.client).toBe('Acme Corp');
    });

    it('should filter by min/max value', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setAdvancedFilters({ minValue: 10000, maxValue: 100000 });
      });

      // c-1 (10000), c-3 (200000 - excluded), c-4 (75000), c-2 (5000 - excluded), c-5 (0 - excluded)
      expect(result.current.filteredContracts.every(c => (c.value ?? 0) >= 10000 && (c.value ?? 0) <= 100000)).toBe(true);
    });
  });

  describe('combined filters', () => {
    it('should combine multiple filters with AND logic', () => {
      const contracts = createContracts();
      const { result } = renderHook(() => useContractFilters(contracts));

      act(() => {
        result.current.actions.setStatusFilter('active');
        result.current.actions.setRiskFilters(['high']);
      });

      // active + high risk: c-3 (active, 80) and c-5 (active, 95)
      expect(result.current.filteredContracts).toHaveLength(2);
    });
  });

  describe('exported constants', () => {
    it('should export RISK_LEVELS', () => {
      expect(RISK_LEVELS).toBeDefined();
      expect(RISK_LEVELS).toHaveLength(3);
      expect(RISK_LEVELS.map(r => r.value)).toEqual(['low', 'medium', 'high']);
    });

    it('should export VALUE_RANGES', () => {
      expect(VALUE_RANGES).toBeDefined();
      expect(VALUE_RANGES.length).toBeGreaterThan(0);
    });

    it('should export DATE_PRESETS', () => {
      expect(DATE_PRESETS).toBeDefined();
      expect(DATE_PRESETS.length).toBeGreaterThan(0);
    });

    it('should export CONTRACT_TYPES', () => {
      expect(CONTRACT_TYPES).toBeDefined();
      expect(CONTRACT_TYPES).toContain('Service Agreement');
    });

    it('should export QUICK_PRESETS', () => {
      expect(QUICK_PRESETS).toBeDefined();
      expect(QUICK_PRESETS.length).toBeGreaterThan(0);
      expect(QUICK_PRESETS.find(p => p.id === 'high-risk')).toBeDefined();
    });
  });

  describe('empty / edge cases', () => {
    it('should handle empty contracts array', () => {
      const { result } = renderHook(() => useContractFilters([]));

      expect(result.current.filteredContracts).toHaveLength(0);
      expect(result.current.stats.filteredCount).toBe(0);
      expect(result.current.stats.totalValue).toBe(0);
    });

    it('should handle contracts with missing optional fields', () => {
      const contracts = [
        { id: 'c-min', title: 'Minimal', status: 'active' } as Contract,
      ];
      const { result } = renderHook(() => useContractFilters(contracts));

      expect(result.current.filteredContracts).toHaveLength(1);
    });
  });
});

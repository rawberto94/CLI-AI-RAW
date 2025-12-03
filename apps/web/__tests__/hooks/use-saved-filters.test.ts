/**
 * Unit Tests for use-saved-filters hook
 * 
 * Tests saved filter CRUD operations, localStorage persistence,
 * pinning, and reordering functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSavedFilters } from '../../hooks/use-saved-filters';
import type { ContractFilters } from '../../hooks/use-contract-filters';

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSavedFilters', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockFilters: Partial<ContractFilters> = {
    search: 'test',
    status: 'active',
    type: 'MSA',
  };

  describe('Initialization', () => {
    it('should initialize with empty filters when no defaults', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));
      
      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });
      
      expect(result.current.state.savedFilters).toEqual([]);
    });

    it('should load saved filters from localStorage', async () => {
      const existingFilters = [
        {
          id: '1',
          name: 'My Filter',
          filters: mockFilters,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPinned: false,
          usageCount: 5,
        },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingFilters));

      const { result } = renderHook(() => useSavedFilters());
      
      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });
      
      expect(result.current.state.savedFilters.length).toBe(1);
      expect(result.current.state.savedFilters[0].name).toBe('My Filter');
    });
  });

  describe('Creating Filters', () => {
    it('should create a new saved filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({
          name: 'New Filter',
          filters: mockFilters,
        });
      });

      expect(result.current.state.savedFilters.length).toBe(1);
      expect(result.current.state.savedFilters[0].name).toBe('New Filter');
    });

    it('should create filter with description', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({
          name: 'Described Filter',
          filters: mockFilters,
          description: 'This is a test filter',
        });
      });

      expect(result.current.state.savedFilters[0].description).toBe('This is a test filter');
    });

    it('should assign unique IDs to filters', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter 1', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter 2', filters: mockFilters });
      });

      expect(result.current.state.savedFilters[0].id).not.toBe(result.current.state.savedFilters[1].id);
    });

    it('should initialize usage count to 0', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'New Filter', filters: mockFilters });
      });

      expect(result.current.state.savedFilters[0].usageCount).toBe(0);
    });
  });

  describe('Updating Filters', () => {
    it('should update an existing filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Original', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      act(() => {
        result.current.actions.updateFilter(filterId, { name: 'Updated' });
      });

      expect(result.current.state.savedFilters[0].name).toBe('Updated');
    });

    it('should update filter criteria', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;
      const updatedFilters = { ...mockFilters, status: 'expired' as const };

      act(() => {
        result.current.actions.updateFilter(filterId, { filters: updatedFilters });
      });

      expect(result.current.state.savedFilters[0].filters.status).toBe('expired');
    });
  });

  describe('Deleting Filters', () => {
    it('should delete a saved filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'To Delete', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      act(() => {
        result.current.actions.deleteFilter(filterId);
      });

      expect(result.current.state.savedFilters.length).toBe(0);
    });

    it('should only delete the specified filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Keep', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Delete', filters: mockFilters });
      });

      const deleteId = result.current.state.savedFilters.find(f => f.name === 'Delete')!.id;

      act(() => {
        result.current.actions.deleteFilter(deleteId);
      });

      expect(result.current.state.savedFilters.length).toBe(1);
      expect(result.current.state.savedFilters[0].name).toBe('Keep');
    });
  });

  describe('Pinning Filters', () => {
    it('should pin a filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      expect(result.current.state.savedFilters[0].isPinned).toBeFalsy();

      act(() => {
        result.current.actions.pinFilter(filterId);
      });

      expect(result.current.state.savedFilters[0].isPinned).toBe(true);
    });

    it('should unpin a filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters, isPinned: true });
      });

      const filterId = result.current.state.savedFilters[0].id;

      act(() => {
        result.current.actions.unpinFilter(filterId);
      });

      expect(result.current.state.savedFilters[0].isPinned).toBe(false);
    });

    it('should return pinned filters in pinnedFilters', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Unpinned 1', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Pinned', filters: mockFilters });
      });

      const pinnedId = result.current.state.savedFilters.find(f => f.name === 'Pinned')!.id;

      act(() => {
        result.current.actions.pinFilter(pinnedId);
      });

      expect(result.current.pinnedFilters.length).toBe(1);
      expect(result.current.pinnedFilters[0].name).toBe('Pinned');
    });
  });

  describe('Default Filter', () => {
    it('should set a filter as default', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      expect(result.current.defaultFilter).toBeNull();

      act(() => {
        result.current.actions.setAsDefault(filterId);
      });

      expect(result.current.defaultFilter?.name).toBe('Filter');
    });

    it('should clear default filter', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters, isDefault: true });
      });

      act(() => {
        result.current.actions.clearDefault();
      });

      expect(result.current.defaultFilter).toBeNull();
    });
  });

  describe('Usage Tracking', () => {
    it('should increment usage count when filter is used', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      expect(result.current.state.savedFilters[0].usageCount).toBe(0);

      act(() => {
        result.current.actions.recordUsage(filterId);
      });

      expect(result.current.state.savedFilters[0].usageCount).toBe(1);
    });

    it('should update lastUsedAt when filter is used', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Filter', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      expect(result.current.state.savedFilters[0].lastUsedAt).toBeUndefined();

      act(() => {
        result.current.actions.recordUsage(filterId);
      });

      expect(result.current.state.savedFilters[0].lastUsedAt).toBeDefined();
    });
  });

  describe('Duplicating Filters', () => {
    it('should duplicate a filter with new name', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Original', filters: mockFilters });
      });

      const filterId = result.current.state.savedFilters[0].id;

      act(() => {
        result.current.actions.duplicateFilter(filterId);
      });

      expect(result.current.state.savedFilters.length).toBe(2);
      expect(result.current.state.savedFilters[1].name).toBe('Original (Copy)');
    });

    it('should reset pinned and default status on duplicate', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Original', filters: mockFilters, isPinned: true, isDefault: true });
      });

      const filterId = result.current.state.savedFilters[0].id;

      act(() => {
        result.current.actions.duplicateFilter(filterId);
      });

      expect(result.current.state.savedFilters[1].isPinned).toBe(false);
      expect(result.current.state.savedFilters[1].isDefault).toBe(false);
    });
  });

  describe('Reordering Filters', () => {
    it('should reorder filters', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'A', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'B', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'C', filters: mockFilters });
      });

      // Move C (index 2) to first position (index 0)
      act(() => {
        result.current.actions.reorderFilters(2, 0);
      });

      expect(result.current.state.savedFilters[0].name).toBe('C');
      expect(result.current.state.savedFilters[1].name).toBe('A');
      expect(result.current.state.savedFilters[2].name).toBe('B');
    });

    it('should move filter to top', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'A', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'B', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'C', filters: mockFilters });
      });

      const cId = result.current.state.savedFilters.find(f => f.name === 'C')!.id;

      act(() => {
        result.current.actions.moveToTop(cId);
      });

      expect(result.current.state.savedFilters[0].name).toBe('C');
    });
  });

  describe('Recent Filters', () => {
    it('should return recently used filters', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Old', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Recent', filters: mockFilters });
      });

      const recentId = result.current.state.savedFilters.find(f => f.name === 'Recent')!.id;

      act(() => {
        result.current.actions.recordUsage(recentId);
      });

      expect(result.current.recentFilters.length).toBe(1);
      expect(result.current.recentFilters[0].name).toBe('Recent');
    });
  });

  describe('Export/Import', () => {
    it('should export filters to JSON', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Export Me', filters: mockFilters });
      });

      const exported = result.current.actions.exportFilters();
      const parsed = JSON.parse(exported);

      expect(parsed.length).toBe(1);
      expect(parsed[0].name).toBe('Export Me');
    });

    it('should import filters from JSON', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      const importData = JSON.stringify([
        {
          name: 'Imported Filter',
          filters: mockFilters,
        },
      ]);

      let success = false;
      act(() => {
        success = result.current.actions.importFilters(importData);
      });

      expect(success).toBe(true);
      expect(result.current.state.savedFilters.length).toBe(1);
      expect(result.current.state.savedFilters[0].name).toBe('Imported Filter');
    });

    it('should merge imported filters with existing', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'Existing', filters: mockFilters });
      });

      const importData = JSON.stringify([
        {
          name: 'Imported',
          filters: mockFilters,
        },
      ]);

      act(() => {
        result.current.actions.importFilters(importData);
      });

      expect(result.current.state.savedFilters.length).toBe(2);
    });

    it('should reject invalid import data', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      let success = false;
      act(() => {
        success = result.current.actions.importFilters('not valid json');
      });

      expect(success).toBe(false);
      expect(result.current.state.error).toBeDefined();
    });
  });

  describe('Bulk Operations', () => {
    it('should delete all filters', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      act(() => {
        result.current.actions.createFilter({ name: 'A', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'B', filters: mockFilters });
      });

      act(() => {
        result.current.actions.deleteAllFilters();
      });

      expect(result.current.state.savedFilters.length).toBe(0);
    });

    it('should reset to default filters', async () => {
      const defaultFilters = [
        {
          id: 'default-1',
          name: 'Default Filter',
          filters: mockFilters,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
        },
      ];

      const { result } = renderHook(() => useSavedFilters({ defaultFilters }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      // Add custom filter
      act(() => {
        result.current.actions.createFilter({ name: 'Custom', filters: mockFilters });
      });

      // Reset
      act(() => {
        result.current.actions.resetToDefaults();
      });

      expect(result.current.state.savedFilters.length).toBe(1);
      expect(result.current.state.savedFilters[0].name).toBe('Default Filter');
    });
  });

  describe('Computed Values', () => {
    it('should track filter count', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [] }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.filterCount).toBe(0);

      act(() => {
        result.current.actions.createFilter({ name: 'A', filters: mockFilters });
      });

      expect(result.current.filterCount).toBe(1);

      act(() => {
        result.current.actions.createFilter({ name: 'B', filters: mockFilters });
      });

      expect(result.current.filterCount).toBe(2);
    });

    it('should track hasReachedLimit', async () => {
      const { result } = renderHook(() => useSavedFilters({ defaultFilters: [], maxFilters: 2 }));

      await waitFor(() => {
        expect(result.current.state.isLoading).toBe(false);
      });

      expect(result.current.hasReachedLimit).toBe(false);

      act(() => {
        result.current.actions.createFilter({ name: 'A', filters: mockFilters });
      });

      act(() => {
        result.current.actions.createFilter({ name: 'B', filters: mockFilters });
      });

      expect(result.current.hasReachedLimit).toBe(true);
    });
  });
});

/**
 * Saved Filters Hook
 * 
 * Manages saved/custom filter presets that persist to localStorage.
 * Users can create, update, delete, and reorder their saved filters.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ContractFilters } from './use-contract-filters';

// ============================================================================
// Types
// ============================================================================

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  filters: Partial<ContractFilters>;
  isDefault?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt?: string;
}

export interface SavedFiltersState {
  savedFilters: SavedFilter[];
  isLoading: boolean;
  error: string | null;
}

export interface SavedFiltersActions {
  // CRUD operations
  createFilter: (filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => SavedFilter;
  updateFilter: (id: string, updates: Partial<Omit<SavedFilter, 'id' | 'createdAt'>>) => void;
  deleteFilter: (id: string) => void;
  duplicateFilter: (id: string, newName?: string) => SavedFilter | null;
  
  // Ordering
  reorderFilters: (fromIndex: number, toIndex: number) => void;
  moveToTop: (id: string) => void;
  
  // Pin/Default
  pinFilter: (id: string) => void;
  unpinFilter: (id: string) => void;
  setAsDefault: (id: string) => void;
  clearDefault: () => void;
  
  // Usage tracking
  recordUsage: (id: string) => void;
  
  // Import/Export
  exportFilters: () => string;
  importFilters: (json: string) => boolean;
  
  // Bulk operations
  deleteAllFilters: () => void;
  resetToDefaults: () => void;
}

export interface UseSavedFiltersOptions {
  storageKey?: string;
  maxFilters?: number;
  defaultFilters?: SavedFilter[];
}

export interface UseSavedFiltersReturn {
  state: SavedFiltersState;
  actions: SavedFiltersActions;
  
  // Computed values
  pinnedFilters: SavedFilter[];
  recentFilters: SavedFilter[];
  defaultFilter: SavedFilter | null;
  filterCount: number;
  hasReachedLimit: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'contracts-saved-filters';
const MAX_RECENT_FILTERS = 5;
const DEFAULT_MAX_FILTERS = 50;

// Default saved filters for new users
const DEFAULT_SAVED_FILTERS: SavedFilter[] = [
  {
    id: 'default-expiring',
    name: 'Expiring This Month',
    description: 'Contracts expiring within 30 days',
    icon: '⏰',
    color: '#f59e0b',
    filters: {
      expirationFilters: ['30-days'],
    },
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-high-risk',
    name: 'High Risk Contracts',
    description: 'All contracts with high risk score',
    icon: '🔴',
    color: '#ef4444',
    filters: {
      riskFilters: ['high'],
    },
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-uncategorized',
    name: 'Needs Organization',
    description: 'Uncategorized or untagged contracts',
    icon: '🏷️',
    color: '#6366f1',
    filters: {
      // Would filter for uncategorized
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `sf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadFromStorage(key: string): SavedFilter[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    
    // Validate and migrate old formats
    return parsed.map((item: any) => ({
      id: item.id || generateId(),
      name: item.name || 'Unnamed Filter',
      description: item.description || '',
      icon: item.icon || '📁',
      color: item.color || '#6366f1',
      filters: item.filters || {},
      isDefault: item.isDefault || false,
      isPinned: item.isPinned || false,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      usageCount: item.usageCount || 0,
      lastUsedAt: item.lastUsedAt,
    }));
  } catch (error) {
    console.error('Failed to load saved filters:', error);
    return [];
  }
}

function saveToStorage(key: string, filters: SavedFilter[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    console.error('Failed to save filters:', error);
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSavedFilters(options: UseSavedFiltersOptions = {}): UseSavedFiltersReturn {
  const {
    storageKey = STORAGE_KEY,
    maxFilters = DEFAULT_MAX_FILTERS,
    defaultFilters = DEFAULT_SAVED_FILTERS,
  } = options;

  // State
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from storage on mount
  useEffect(() => {
    setIsLoading(true);
    try {
      const stored = loadFromStorage(storageKey);
      if (stored.length === 0) {
        // Initialize with defaults for new users
        setSavedFilters(defaultFilters);
        saveToStorage(storageKey, defaultFilters);
      } else {
        setSavedFilters(stored);
      }
    } catch (err) {
      setError('Failed to load saved filters');
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save to storage when filters change
  useEffect(() => {
    if (!isLoading) {
      saveToStorage(storageKey, savedFilters);
    }
  }, [savedFilters, storageKey, isLoading]);

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  const createFilter = useCallback((
    filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
  ): SavedFilter => {
    const now = new Date().toISOString();
    const newFilter: SavedFilter = {
      ...filter,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };

    setSavedFilters(prev => {
      // Check limit
      if (prev.length >= maxFilters) {
        setError(`Maximum of ${maxFilters} saved filters reached`);
        return prev;
      }
      return [...prev, newFilter];
    });

    return newFilter;
  }, [maxFilters]);

  const updateFilter = useCallback((
    id: string, 
    updates: Partial<Omit<SavedFilter, 'id' | 'createdAt'>>
  ): void => {
    setSavedFilters(prev => prev.map(filter => 
      filter.id === id
        ? { 
            ...filter, 
            ...updates, 
            updatedAt: new Date().toISOString() 
          }
        : filter
    ));
  }, []);

  const deleteFilter = useCallback((id: string): void => {
    setSavedFilters(prev => prev.filter(filter => filter.id !== id));
  }, []);

  const duplicateFilter = useCallback((id: string, newName?: string): SavedFilter | null => {
    const original = savedFilters.find(f => f.id === id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicate: SavedFilter = {
      ...original,
      id: generateId(),
      name: newName || `${original.name} (Copy)`,
      isDefault: false,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      lastUsedAt: undefined,
    };

    setSavedFilters(prev => {
      if (prev.length >= maxFilters) {
        setError(`Maximum of ${maxFilters} saved filters reached`);
        return prev;
      }
      return [...prev, duplicate];
    });

    return duplicate;
  }, [savedFilters, maxFilters]);

  // ============================================================================
  // Ordering
  // ============================================================================

  const reorderFilters = useCallback((fromIndex: number, toIndex: number): void => {
    setSavedFilters(prev => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      if (removed) {
        result.splice(toIndex, 0, removed);
      }
      return result;
    });
  }, []);

  const moveToTop = useCallback((id: string): void => {
    setSavedFilters(prev => {
      const index = prev.findIndex(f => f.id === id);
      if (index <= 0) return prev;
      
      const result = [...prev];
      const [removed] = result.splice(index, 1);
      if (removed) {
        result.unshift(removed);
      }
      return result;
    });
  }, []);

  // ============================================================================
  // Pin/Default
  // ============================================================================

  const pinFilter = useCallback((id: string): void => {
    updateFilter(id, { isPinned: true });
  }, [updateFilter]);

  const unpinFilter = useCallback((id: string): void => {
    updateFilter(id, { isPinned: false });
  }, [updateFilter]);

  const setAsDefault = useCallback((id: string): void => {
    setSavedFilters(prev => prev.map(filter => ({
      ...filter,
      isDefault: filter.id === id,
      updatedAt: filter.id === id ? new Date().toISOString() : filter.updatedAt,
    })));
  }, []);

  const clearDefault = useCallback((): void => {
    setSavedFilters(prev => prev.map(filter => ({
      ...filter,
      isDefault: false,
    })));
  }, []);

  // ============================================================================
  // Usage Tracking
  // ============================================================================

  const recordUsage = useCallback((id: string): void => {
    const now = new Date().toISOString();
    setSavedFilters(prev => prev.map(filter => 
      filter.id === id
        ? {
            ...filter,
            usageCount: filter.usageCount + 1,
            lastUsedAt: now,
          }
        : filter
    ));
  }, []);

  // ============================================================================
  // Import/Export
  // ============================================================================

  const exportFilters = useCallback((): string => {
    return JSON.stringify(savedFilters, null, 2);
  }, [savedFilters]);

  const importFilters = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        setError('Invalid filter format');
        return false;
      }

      // Validate each filter
      const validFilters = parsed.filter((item: any) => 
        item && typeof item.name === 'string' && typeof item.filters === 'object'
      );

      if (validFilters.length === 0) {
        setError('No valid filters found');
        return false;
      }

      // Generate new IDs and timestamps
      const now = new Date().toISOString();
      const importedFilters: SavedFilter[] = validFilters.map((item: any) => ({
        id: generateId(),
        name: item.name,
        description: item.description || '',
        icon: item.icon || '📁',
        color: item.color || '#6366f1',
        filters: item.filters,
        isDefault: false,
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      }));

      setSavedFilters(prev => {
        const combined = [...prev, ...importedFilters];
        if (combined.length > maxFilters) {
          setError(`Import limited to ${maxFilters} total filters`);
          return combined.slice(0, maxFilters);
        }
        return combined;
      });

      return true;
    } catch (err) {
      setError('Failed to parse import data');
      return false;
    }
  }, [maxFilters]);

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  const deleteAllFilters = useCallback((): void => {
    setSavedFilters([]);
  }, []);

  const resetToDefaults = useCallback((): void => {
    setSavedFilters(defaultFilters);
  }, [defaultFilters]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const pinnedFilters = useMemo(() => 
    savedFilters.filter(f => f.isPinned),
    [savedFilters]
  );

  const recentFilters = useMemo(() => 
    [...savedFilters]
      .filter(f => f.lastUsedAt)
      .sort((a, b) => 
        new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime()
      )
      .slice(0, MAX_RECENT_FILTERS),
    [savedFilters]
  );

  const defaultFilter = useMemo(() => 
    savedFilters.find(f => f.isDefault) || null,
    [savedFilters]
  );

  const filterCount = savedFilters.length;
  const hasReachedLimit = filterCount >= maxFilters;

  // ============================================================================
  // Return
  // ============================================================================

  return {
    state: {
      savedFilters,
      isLoading,
      error,
    },
    actions: {
      createFilter,
      updateFilter,
      deleteFilter,
      duplicateFilter,
      reorderFilters,
      moveToTop,
      pinFilter,
      unpinFilter,
      setAsDefault,
      clearDefault,
      recordUsage,
      exportFilters,
      importFilters,
      deleteAllFilters,
      resetToDefaults,
    },
    pinnedFilters,
    recentFilters,
    defaultFilter,
    filterCount,
    hasReachedLimit,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ContractFilters,
} from './use-contract-filters';

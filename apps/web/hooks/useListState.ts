"use client";

/**
 * useListState Hook
 * 
 * Comprehensive state management for lists with filtering, sorting, pagination, and search.
 */

import { useState, useMemo, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type SortDirection = "asc" | "desc";

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterConfig<T> {
  key: keyof T | string;
  value: unknown;
  operator?: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "lt" | "gte" | "lte" | "in" | "between";
}

export interface UseListStateOptions<T> {
  initialSort?: SortConfig<T>;
  initialPageSize?: number;
  initialFilters?: FilterConfig<T>[];
  searchKeys?: (keyof T | string)[];
}

export interface UseListStateReturn<T> {
  // Data
  items: T[];
  filteredItems: T[];
  paginatedItems: T[];
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Sorting
  sortConfig: SortConfig<T> | null;
  setSortConfig: (config: SortConfig<T> | null) => void;
  toggleSort: (key: keyof T | string) => void;
  getSortDirection: (key: keyof T | string) => SortDirection | null;
  
  // Filtering
  filters: FilterConfig<T>[];
  setFilter: (key: keyof T | string, value: unknown, operator?: FilterConfig<T>["operator"]) => void;
  removeFilter: (key: keyof T | string) => void;
  clearFilters: () => void;
  
  // Pagination
  pagination: PaginationConfig;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalPages: number;
  
  // Bulk updates
  setItems: (items: T[]) => void;
  addItem: (item: T) => void;
  updateItem: (index: number, item: T) => void;
  removeItem: (index: number) => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function matchesFilter<T>(item: T, filter: FilterConfig<T>): boolean {
  const value = getNestedValue(item, filter.key as string);
  const filterValue = filter.value;
  const operator = filter.operator || "equals";

  if (value === undefined || value === null) {
    return filterValue === undefined || filterValue === null;
  }

  switch (operator) {
    case "equals":
      return value === filterValue;
    case "contains":
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
    case "startsWith":
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
    case "endsWith":
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
    case "gt":
      return Number(value) > Number(filterValue);
    case "lt":
      return Number(value) < Number(filterValue);
    case "gte":
      return Number(value) >= Number(filterValue);
    case "lte":
      return Number(value) <= Number(filterValue);
    case "in":
      return Array.isArray(filterValue) && filterValue.includes(value);
    case "between":
      if (Array.isArray(filterValue) && filterValue.length === 2) {
        const num = Number(value);
        return num >= Number(filterValue[0]) && num <= Number(filterValue[1]);
      }
      return false;
    default:
      return false;
  }
}

function matchesSearch<T>(item: T, query: string, searchKeys: (keyof T | string)[]): boolean {
  if (!query) return true;
  
  const lowerQuery = query.toLowerCase();
  
  return searchKeys.some((key) => {
    const value = getNestedValue(item, key as string);
    if (value === undefined || value === null) return false;
    return String(value).toLowerCase().includes(lowerQuery);
  });
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return direction === "asc" ? 1 : -1;
  if (b === null || b === undefined) return direction === "asc" ? -1 : 1;

  if (typeof a === "string" && typeof b === "string") {
    return direction === "asc" 
      ? a.localeCompare(b) 
      : b.localeCompare(a);
  }

  if (a instanceof Date && b instanceof Date) {
    return direction === "asc" 
      ? a.getTime() - b.getTime() 
      : b.getTime() - a.getTime();
  }

  if (typeof a === "number" && typeof b === "number") {
    return direction === "asc" ? a - b : b - a;
  }

  return 0;
}

// ============================================================================
// useListState Hook
// ============================================================================

export function useListState<T>(
  initialItems: T[] = [],
  options: UseListStateOptions<T> = {}
): UseListStateReturn<T> {
  const {
    initialSort = null,
    initialPageSize = 10,
    initialFilters = [],
    searchKeys = [],
  } = options;

  // State
  const [items, setItems] = useState<T[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort);
  const [filters, setFilters] = useState<FilterConfig<T>[]>(initialFilters);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Filtered items (search + filters)
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search
    if (searchQuery && searchKeys.length > 0) {
      result = result.filter((item) => matchesSearch(item, searchQuery, searchKeys));
    }

    // Apply filters
    for (const filter of filters) {
      result = result.filter((item) => matchesFilter(item, filter));
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortConfig.key as string);
        const bValue = getNestedValue(b, sortConfig.key as string);
        return compareValues(aValue, bValue, sortConfig.direction);
      });
    }

    return result;
  }, [items, searchQuery, searchKeys, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Sorting functions
  const toggleSort = useCallback((key: keyof T | string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") {
          return { key, direction: "desc" };
        }
        return null; // Remove sort on third click
      }
      return { key, direction: "asc" };
    });
  }, []);

  const getSortDirection = useCallback((key: keyof T | string): SortDirection | null => {
    if (sortConfig?.key === key) {
      return sortConfig.direction;
    }
    return null;
  }, [sortConfig]);

  // Filter functions
  const setFilter = useCallback((
    key: keyof T | string,
    value: unknown,
    operator: FilterConfig<T>["operator"] = "equals"
  ) => {
    setFilters((prev) => {
      const existing = prev.findIndex((f) => f.key === key);
      const newFilter = { key, value, operator };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newFilter;
        return updated;
      }
      return [...prev, newFilter];
    });
    setPageState(1); // Reset to first page when filtering
  }, []);

  const removeFilter = useCallback((key: keyof T | string) => {
    setFilters((prev) => prev.filter((f) => f.key !== key));
    setPageState(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setPageState(1);
  }, []);

  // Pagination functions
  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) setPageState((p) => p + 1);
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) setPageState((p) => p - 1);
  }, [hasPrevPage]);

  const goToFirstPage = useCallback(() => setPageState(1), []);
  const goToLastPage = useCallback(() => setPageState(totalPages || 1), [totalPages]);

  // Item manipulation
  const addItem = useCallback((item: T) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const updateItem = useCallback((index: number, item: T) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = item;
      return updated;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Reset
  const reset = useCallback(() => {
    setItems(initialItems);
    setSearchQuery("");
    setSortConfig(initialSort);
    setFilters(initialFilters);
    setPageState(1);
    setPageSizeState(initialPageSize);
  }, [initialItems, initialSort, initialFilters, initialPageSize]);

  return {
    // Data
    items,
    filteredItems,
    paginatedItems,
    
    // Search
    searchQuery,
    setSearchQuery: useCallback((q: string) => {
      setSearchQuery(q);
      setPageState(1);
    }, []),
    
    // Sorting
    sortConfig,
    setSortConfig,
    toggleSort,
    getSortDirection,
    
    // Filtering
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    
    // Pagination
    pagination: {
      page,
      pageSize,
      total: filteredItems.length,
    },
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage,
    hasPrevPage,
    totalPages,
    
    // Bulk updates
    setItems,
    addItem,
    updateItem,
    removeItem,
    
    // Reset
    reset,
  };
}

// ============================================================================
// useFilteredList Hook - Simpler version
// ============================================================================

export interface UseFilteredListOptions<T> {
  searchKeys?: (keyof T | string)[];
  initialFilters?: Record<string, unknown>;
}

export function useFilteredList<T>(
  items: T[],
  options: UseFilteredListOptions<T> = {}
) {
  const { searchKeys = [], initialFilters = {} } = options;

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>(initialFilters);

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Apply search
    if (searchQuery && searchKeys.length > 0) {
      result = result.filter((item) => matchesSearch(item, searchQuery, searchKeys));
    }

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        result = result.filter((item) => {
          const itemValue = getNestedValue(item, key);
          if (Array.isArray(value)) {
            return value.includes(itemValue);
          }
          return itemValue === value;
        });
      }
    }

    return result;
  }, [items, searchQuery, searchKeys, filters]);

  const setFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilter = useCallback((key: string) => {
    setFilters((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
  }, []);

  return {
    filteredItems,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters: searchQuery.length > 0 || Object.values(filters).some((v) => v !== undefined && v !== null && v !== ""),
    activeFilterCount: Object.values(filters).filter((v) => v !== undefined && v !== null && v !== "").length + (searchQuery ? 1 : 0),
  };
}

// ============================================================================
// useSortedList Hook
// ============================================================================

export function useSortedList<T>(
  items: T[],
  initialSort?: SortConfig<T>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort ?? null);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key as string);
      const bValue = getNestedValue(b, sortConfig.key as string);
      return compareValues(aValue, bValue, sortConfig.direction);
    });
  }, [items, sortConfig]);

  const toggleSort = useCallback((key: keyof T | string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" 
          ? { key, direction: "desc" } 
          : null;
      }
      return { key, direction: "asc" };
    });
  }, []);

  const clearSort = useCallback(() => setSortConfig(null), []);

  return {
    sortedItems,
    sortConfig,
    setSortConfig,
    toggleSort,
    clearSort,
    isSorted: sortConfig !== null,
  };
}

// ============================================================================
// usePaginatedList Hook
// ============================================================================

export interface UsePaginatedListOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function usePaginatedList<T>(
  items: T[],
  options: UsePaginatedListOptions = {}
) {
  const { initialPage = 1, initialPageSize = 10 } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.ceil(items.length / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages || 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) setPage((p) => p + 1);
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) setPage((p) => p - 1);
  }, [hasPrevPage]);

  // Reset to page 1 when items change
  const resetPagination = useCallback(() => setPage(1), []);

  return {
    paginatedItems,
    page,
    pageSize,
    totalPages,
    total: items.length,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setPageSize: useCallback((size: number) => {
      setPageSize(size);
      setPage(1);
    }, []),
    resetPagination,
    // Computed values for display
    startIndex: (page - 1) * pageSize,
    endIndex: Math.min(page * pageSize, items.length),
    showingText: `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, items.length)} of ${items.length}`,
  };
}

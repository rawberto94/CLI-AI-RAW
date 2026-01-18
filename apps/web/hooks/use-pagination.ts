/**
 * Pagination Hook
 * 
 * Generic pagination hook that can be used with any list of items.
 */

import { useState, useMemo, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationActions {
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  goToPage: (page: number) => void;
}

export interface PaginationInfo {
  startIndex: number;
  endIndex: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pageNumbers: number[];
}

export interface UsePaginationResult<T> {
  state: PaginationState;
  actions: PaginationActions;
  info: PaginationInfo;
  paginatedItems: T[];
}

// ============================================================================
// Constants
// ============================================================================

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePagination<T>(
  items: T[],
  initialPageSize: number = DEFAULT_PAGE_SIZE
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Calculate total pages
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page is valid when items or pageSize change
  const validatedCurrentPage = useMemo(() => {
    if (currentPage > totalPages) return totalPages;
    if (currentPage < 1) return 1;
    return currentPage;
  }, [currentPage, totalPages]);

  // Sync state if validation changed the page
  if (validatedCurrentPage !== currentPage) {
    setCurrentPage(validatedCurrentPage);
  }

  // Calculate indices
  const startIndex = (validatedCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  // Navigation helpers
  const isFirstPage = validatedCurrentPage === 1;
  const isLastPage = validatedCurrentPage === totalPages;
  const hasNextPage = validatedCurrentPage < totalPages;
  const hasPrevPage = validatedCurrentPage > 1;

  // Generate page numbers for pagination UI
  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    const pages: number[] = [];
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisible / 2);
      let start = Math.max(1, validatedCurrentPage - half);
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }, [totalPages, validatedCurrentPage]);

  // Actions
  const setPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPrevPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const goToPage = useCallback((page: number) => {
    setPage(page);
  }, [setPage]);

  return {
    state: {
      currentPage: validatedCurrentPage,
      pageSize,
      totalItems,
      totalPages,
    },
    actions: {
      setPage,
      setPageSize: handleSetPageSize,
      nextPage,
      prevPage,
      firstPage,
      lastPage,
      goToPage,
    },
    info: {
      startIndex,
      endIndex,
      isFirstPage,
      isLastPage,
      hasNextPage,
      hasPrevPage,
      pageNumbers,
    },
    paginatedItems,
  };
}

export default usePagination;

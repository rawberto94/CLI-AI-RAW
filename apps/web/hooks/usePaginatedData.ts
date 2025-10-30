/**
 * Paginated Data Hook
 * Manages paginated data fetching and state
 * Requirements: 4.3
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UsePaginatedDataOptions<T> {
  fetchFn: (page: number, pageSize: number, filters?: any) => Promise<PaginatedResponse<T>>;
  initialPage?: number;
  initialPageSize?: number;
  initialFilters?: any;
  autoFetch?: boolean;
}

export interface UsePaginatedDataResult<T> {
  data: T[];
  pagination: PaginatedResponse<T>['pagination'] | null;
  loading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  filters: any;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: any) => void;
  refresh: () => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
}

export function usePaginatedData<T>({
  fetchFn,
  initialPage = 1,
  initialPageSize = 20,
  initialFilters = {},
  autoFetch = true,
}: UsePaginatedDataOptions<T>): UsePaginatedDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginatedResponse<T>['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState(initialFilters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startTime = performance.now();

    try {
      const result = await fetchFn(page, pageSize, filters);
      setData(result.data);
      setPagination(result.pagination);

      const duration = performance.now() - startTime;
      performanceMonitor.trackApiCall(
        'paginated-data-fetch',
        'GET',
        duration,
        200,
        false
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(error);

      const duration = performance.now() - startTime;
      performanceMonitor.trackApiCall(
        'paginated-data-fetch',
        'GET',
        duration,
        500,
        false
      );
    } finally {
      setLoading(false);
    }
  }, [fetchFn, page, pageSize, filters]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [fetchData, autoFetch]);

  const handleSetPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSetPageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  const handleSetFilters = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when changing filters
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const nextPage = useCallback(() => {
    if (pagination && pagination.hasNext) {
      setPage((prev) => prev + 1);
    }
  }, [pagination]);

  const prevPage = useCallback(() => {
    if (pagination && pagination.hasPrev) {
      setPage((prev) => Math.max(1, prev - 1));
    }
  }, [pagination]);

  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    if (pagination) {
      setPage(pagination.totalPages);
    }
  }, [pagination]);

  return {
    data,
    pagination,
    loading,
    error,
    page,
    pageSize,
    filters,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    setFilters: handleSetFilters,
    refresh,
    nextPage,
    prevPage,
    goToFirstPage,
    goToLastPage,
  };
}

/**
 * Hook for cursor-based pagination
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
}

export interface UseCursorPaginationOptions<T> {
  fetchFn: (cursor: string | null, pageSize: number) => Promise<CursorPaginatedResponse<T>>;
  initialPageSize?: number;
  autoFetch?: boolean;
}

export function useCursorPagination<T>({
  fetchFn,
  initialPageSize = 20,
  autoFetch = true,
}: UseCursorPaginationOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(initialPageSize);

  const fetchData = useCallback(
    async (newCursor: string | null = cursor) => {
      setLoading(true);
      setError(null);

      const startTime = performance.now();

      try {
        const result = await fetchFn(newCursor, pageSize);
        setData(result.data);
        setNextCursor(result.nextCursor);
        setPrevCursor(result.prevCursor);
        setHasMore(result.hasMore);
        setCursor(newCursor);

        const duration = performance.now() - startTime;
        performanceMonitor.trackApiCall(
          'cursor-paginated-data-fetch',
          'GET',
          duration,
          200,
          false
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch data');
        setError(error);

        const duration = performance.now() - startTime;
        performanceMonitor.trackApiCall(
          'cursor-paginated-data-fetch',
          'GET',
          duration,
          500,
          false
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchFn, pageSize, cursor]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchData(null);
    }
  }, [autoFetch]); // Only run on mount

  const nextPage = useCallback(() => {
    if (nextCursor) {
      fetchData(nextCursor);
    }
  }, [nextCursor, fetchData]);

  const prevPage = useCallback(() => {
    if (prevCursor) {
      fetchData(prevCursor);
    }
  }, [prevCursor, fetchData]);

  const refresh = useCallback(() => {
    fetchData(null);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    hasMore,
    nextPage,
    prevPage,
    refresh,
    canGoNext: !!nextCursor,
    canGoPrev: !!prevCursor,
  };
}

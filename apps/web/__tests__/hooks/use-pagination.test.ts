/**
 * Tests for usePagination hook
 * @see /hooks/use-pagination.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination, PAGE_SIZE_OPTIONS } from '../../hooks/use-pagination';

describe('usePagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      expect(result.current.pagination.currentPage).toBe(1);
      expect(result.current.pagination.pageSize).toBe(20);
      expect(result.current.pagination.totalItems).toBe(100);
      expect(result.current.pagination.totalPages).toBe(5);
    });

    it('should initialize with custom page size', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 10,
        })
      );

      expect(result.current.pagination.pageSize).toBe(10);
      expect(result.current.pagination.totalPages).toBe(10);
    });

    it('should initialize with custom initial page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 3,
        })
      );

      expect(result.current.pagination.currentPage).toBe(3);
    });

    it('should calculate correct start and end indices', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 1,
        })
      );

      expect(result.current.pagination.startIndex).toBe(0);
      expect(result.current.pagination.endIndex).toBe(20);
    });
  });

  describe('goToPage', () => {
    it('should navigate to a specific page', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.goToPage(3);
      });

      expect(result.current.pagination.currentPage).toBe(3);
    });

    it('should not navigate to page below 1', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.goToPage(0);
      });

      expect(result.current.pagination.currentPage).toBe(1);

      act(() => {
        result.current.goToPage(-5);
      });

      expect(result.current.pagination.currentPage).toBe(1);
    });

    it('should not navigate to page above total pages', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
        })
      );

      act(() => {
        result.current.goToPage(10);
      });

      expect(result.current.pagination.currentPage).toBe(5); // Max is 5
    });
  });

  describe('nextPage', () => {
    it('should navigate to next page', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.pagination.currentPage).toBe(2);
    });

    it('should not navigate past last page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 5,
        })
      );

      act(() => {
        result.current.nextPage();
      });

      expect(result.current.pagination.currentPage).toBe(5);
    });
  });

  describe('previousPage', () => {
    it('should navigate to previous page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 3,
        })
      );

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.pagination.currentPage).toBe(2);
    });

    it('should not navigate before first page', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.previousPage();
      });

      expect(result.current.pagination.currentPage).toBe(1);
    });
  });

  describe('goToFirst', () => {
    it('should navigate to first page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 4,
        })
      );

      act(() => {
        result.current.goToFirst();
      });

      expect(result.current.pagination.currentPage).toBe(1);
    });
  });

  describe('goToLast', () => {
    it('should navigate to last page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
        })
      );

      act(() => {
        result.current.goToLast();
      });

      expect(result.current.pagination.currentPage).toBe(5);
    });
  });

  describe('setPageSize', () => {
    it('should update page size', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.setPageSize(10);
      });

      expect(result.current.pagination.pageSize).toBe(10);
      expect(result.current.pagination.totalPages).toBe(10);
    });

    it('should reset to page 1 when page size changes', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 3,
        })
      );

      act(() => {
        result.current.setPageSize(10);
      });

      expect(result.current.pagination.currentPage).toBe(1);
    });

    it('should recalculate total pages', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
        })
      );

      expect(result.current.pagination.totalPages).toBe(5);

      act(() => {
        result.current.setPageSize(50);
      });

      expect(result.current.pagination.totalPages).toBe(2);
    });
  });

  describe('setTotalItems', () => {
    it('should update total items', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 100 }));

      act(() => {
        result.current.setTotalItems(200);
      });

      expect(result.current.pagination.totalItems).toBe(200);
      expect(result.current.pagination.totalPages).toBe(10);
    });

    it('should adjust current page if it exceeds new total pages', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 5,
        })
      );

      act(() => {
        result.current.setTotalItems(50);
      });

      expect(result.current.pagination.totalPages).toBe(3);
      expect(result.current.pagination.currentPage).toBe(3); // Adjusted to max
    });
  });

  describe('hasNextPage / hasPreviousPage', () => {
    it('should indicate when there is a next page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 1,
        })
      );

      expect(result.current.pagination.hasNextPage).toBe(true);
    });

    it('should indicate when there is no next page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 5,
        })
      );

      expect(result.current.pagination.hasNextPage).toBe(false);
    });

    it('should indicate when there is a previous page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 3,
        })
      );

      expect(result.current.pagination.hasPreviousPage).toBe(true);
    });

    it('should indicate when there is no previous page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPage: 1,
        })
      );

      expect(result.current.pagination.hasPreviousPage).toBe(false);
    });
  });

  describe('start and end indices', () => {
    it('should calculate correct indices for first page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 1,
        })
      );

      expect(result.current.pagination.startIndex).toBe(0);
      expect(result.current.pagination.endIndex).toBe(20);
    });

    it('should calculate correct indices for middle page', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 3,
        })
      );

      expect(result.current.pagination.startIndex).toBe(40);
      expect(result.current.pagination.endIndex).toBe(60);
    });

    it('should calculate correct indices for last page with partial items', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 95,
          initialPageSize: 20,
          initialPage: 5,
        })
      );

      expect(result.current.pagination.startIndex).toBe(80);
      expect(result.current.pagination.endIndex).toBe(95);
    });
  });

  describe('paginateItems', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

    it('should return correct slice of items', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          initialPageSize: 10,
          initialPage: 1,
        })
      );

      const paginated = result.current.paginateItems(items);

      expect(paginated).toHaveLength(10);
      expect(paginated[0]?.id).toBe(1);
      expect(paginated[9]?.id).toBe(10);
    });

    it('should return correct slice for page 3', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 50,
          initialPageSize: 10,
          initialPage: 3,
        })
      );

      const paginated = result.current.paginateItems(items);

      expect(paginated).toHaveLength(10);
      expect(paginated[0]?.id).toBe(21);
      expect(paginated[9]?.id).toBe(30);
    });

    it('should handle last page with partial items', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 45,
          initialPageSize: 10,
          initialPage: 5,
        })
      );

      const partialItems = items.slice(0, 45);
      const paginated = result.current.paginateItems(partialItems);

      expect(paginated).toHaveLength(5);
      expect(paginated[0]?.id).toBe(41);
      expect(paginated[4]?.id).toBe(45);
    });

    it('should handle empty array', () => {
      const { result } = renderHook(() => usePagination({ totalItems: 0 }));

      const paginated = result.current.paginateItems([]);

      expect(paginated).toEqual([]);
    });
  });

  describe('resetPagination', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() =>
        usePagination({
          totalItems: 100,
          initialPageSize: 20,
          initialPage: 1,
        })
      );

      act(() => {
        result.current.goToPage(4);
        result.current.setPageSize(50);
      });

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.pagination.currentPage).toBe(1);
      expect(result.current.pagination.pageSize).toBe(20);
    });
  });
});

describe('PAGE_SIZE_OPTIONS', () => {
  it('should export page size options', () => {
    expect(PAGE_SIZE_OPTIONS).toBeDefined();
    expect(Array.isArray(PAGE_SIZE_OPTIONS)).toBe(true);
    expect(PAGE_SIZE_OPTIONS.length).toBeGreaterThan(0);
  });

  it('should contain common page sizes', () => {
    expect(PAGE_SIZE_OPTIONS).toContain(10);
    expect(PAGE_SIZE_OPTIONS).toContain(20);
    expect(PAGE_SIZE_OPTIONS).toContain(50);
  });

  it('should be sorted in ascending order', () => {
    for (let i = 1; i < PAGE_SIZE_OPTIONS.length; i++) {
      expect(PAGE_SIZE_OPTIONS[i]! > PAGE_SIZE_OPTIONS[i - 1]!).toBe(true);
    }
  });
});

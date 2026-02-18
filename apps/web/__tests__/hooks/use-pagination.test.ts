/**
 * Tests for usePagination hook
 * @see /hooks/use-pagination.ts
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../hooks/use-pagination';

describe('usePagination', () => {
  const createItems = (count: number) => Array.from({ length: count }, (_, i) => i);

  describe('initialization', () => {
    it('should initialize with default page size', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items));

      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(result.current.state.totalItems).toBe(100);
      expect(result.current.state.totalPages).toBe(Math.ceil(100 / DEFAULT_PAGE_SIZE));
    });

    it('should initialize with custom page size', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.state.pageSize).toBe(10);
      expect(result.current.state.totalPages).toBe(10);
    });

    it('should return first page of paginated items', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.paginatedItems).toHaveLength(10);
      expect(result.current.paginatedItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('should handle empty items array', () => {
      const { result } = renderHook(() => usePagination([], 10));

      expect(result.current.state.totalItems).toBe(0);
      expect(result.current.state.totalPages).toBe(1);
      expect(result.current.paginatedItems).toHaveLength(0);
    });

    it('should export PAGE_SIZE_OPTIONS', () => {
      expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
    });
  });

  describe('info', () => {
    it('should calculate correct start and end indices', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.info.startIndex).toBe(0);
      expect(result.current.info.endIndex).toBe(10);
    });

    it('should report first page flags correctly', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.info.isFirstPage).toBe(true);
      expect(result.current.info.isLastPage).toBe(false);
      expect(result.current.info.hasNextPage).toBe(true);
      expect(result.current.info.hasPrevPage).toBe(false);
    });

    it('should generate page numbers', () => {
      const items = createItems(30);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.info.pageNumbers).toEqual([1, 2, 3]);
    });
  });

  describe('actions.goToPage / actions.setPage', () => {
    it('should navigate to a specific page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(3);
      });

      expect(result.current.state.currentPage).toBe(3);
      expect(result.current.paginatedItems).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    });

    it('should clamp page to valid range (below 1)', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(0);
      });

      expect(result.current.state.currentPage).toBe(1);

      act(() => {
        result.current.actions.goToPage(-5);
      });

      expect(result.current.state.currentPage).toBe(1);
    });

    it('should clamp page to valid range (above total)', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(100);
      });

      expect(result.current.state.currentPage).toBe(10);
    });
  });

  describe('actions.nextPage / actions.prevPage', () => {
    it('should navigate to next page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.nextPage();
      });

      expect(result.current.state.currentPage).toBe(2);
    });

    it('should not go past last page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(10);
      });

      act(() => {
        result.current.actions.nextPage();
      });

      expect(result.current.state.currentPage).toBe(10);
    });

    it('should navigate to previous page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(5);
      });

      act(() => {
        result.current.actions.prevPage();
      });

      expect(result.current.state.currentPage).toBe(4);
    });

    it('should not go before first page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.prevPage();
      });

      expect(result.current.state.currentPage).toBe(1);
    });
  });

  describe('actions.firstPage / actions.lastPage', () => {
    it('should navigate to first page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(5);
      });

      act(() => {
        result.current.actions.firstPage();
      });

      expect(result.current.state.currentPage).toBe(1);
    });

    it('should navigate to last page', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.lastPage();
      });

      expect(result.current.state.currentPage).toBe(10);
      expect(result.current.info.isLastPage).toBe(true);
    });
  });

  describe('actions.setPageSize', () => {
    it('should change page size and reset to page 1', () => {
      const items = createItems(100);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.goToPage(5);
      });

      act(() => {
        result.current.actions.setPageSize(25);
      });

      expect(result.current.state.pageSize).toBe(25);
      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.totalPages).toBe(4);
      expect(result.current.paginatedItems).toHaveLength(25);
    });
  });

  describe('edge cases', () => {
    it('should handle items fewer than page size', () => {
      const items = createItems(3);
      const { result } = renderHook(() => usePagination(items, 10));

      expect(result.current.state.totalPages).toBe(1);
      expect(result.current.paginatedItems).toHaveLength(3);
      expect(result.current.info.isFirstPage).toBe(true);
      expect(result.current.info.isLastPage).toBe(true);
    });

    it('should handle last page with fewer items', () => {
      const items = createItems(25);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.lastPage();
      });

      expect(result.current.state.currentPage).toBe(3);
      expect(result.current.paginatedItems).toHaveLength(5);
      expect(result.current.info.endIndex).toBe(25);
    });

    it('should adjust current page when items shrink', () => {
      const { result, rerender } = renderHook(
        ({ items }) => usePagination(items, 10),
        { initialProps: { items: createItems(100) } }
      );

      act(() => {
        result.current.actions.goToPage(10);
      });

      expect(result.current.state.currentPage).toBe(10);

      // Shrink items - page 10 no longer exists
      rerender({ items: createItems(20) });

      expect(result.current.state.currentPage).toBe(2);
      expect(result.current.state.totalPages).toBe(2);
    });

    it('should update info flags on last page', () => {
      const items = createItems(20);
      const { result } = renderHook(() => usePagination(items, 10));

      act(() => {
        result.current.actions.lastPage();
      });

      expect(result.current.info.isLastPage).toBe(true);
      expect(result.current.info.hasNextPage).toBe(false);
      expect(result.current.info.hasPrevPage).toBe(true);
      expect(result.current.info.isFirstPage).toBe(false);
    });
  });
});

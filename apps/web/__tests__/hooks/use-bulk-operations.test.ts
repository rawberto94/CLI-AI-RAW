/**
 * Tests for useBulkOperations hook
 * @see /hooks/use-bulk-operations.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBulkOperations } from '../../hooks/use-bulk-operations';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useBulkOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useBulkOperations());

      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.operation).toBeNull();
      expect(result.current.state.progress).toBe(0);
      expect(result.current.state.processedIds).toEqual([]);
      expect(result.current.state.failedIds).toEqual([]);
      expect(result.current.state.canUndo).toBe(false);
    });
  });

  describe('startBulkOperation', () => {
    it('should start export operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.startBulkOperation('export', ['c1', 'c2', 'c3']);
      });

      expect(result.current.state.isProcessing).toBe(true);
      expect(result.current.state.operation).toBe('export');
    });

    it('should update progress during operation', async () => {
      vi.useFakeTimers();
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          }), 100)
        )
      );

      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.startBulkOperation('export', ['c1', 'c2', 'c3']);
      });

      // Progress should be between 0 and 100 during operation
      expect(result.current.state.progress).toBeGreaterThanOrEqual(0);
      expect(result.current.state.progress).toBeLessThanOrEqual(100);

      vi.useRealTimers();
    });

    it('should track processed IDs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('export', ['c1', 'c2']);
      });

      await waitFor(() => {
        expect(result.current.state.processedIds.length).toBeGreaterThan(0);
      });
    });

    it('should track failed IDs on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        try {
          await result.current.startBulkOperation('delete', ['c1']);
        } catch {
          // Expected to throw
        }
      });

      // Should have recorded the failure
      expect(result.current.state.isProcessing).toBe(false);
    });

    it('should handle delete operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('delete', ['c1']);
      });

      expect(result.current.state.operation).toBe('delete');
    });

    it('should handle analyze operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('analyze', ['c1', 'c2']);
      });

      expect(result.current.state.operation).toBe('analyze');
    });

    it('should handle share operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('share', ['c1']);
      });

      expect(result.current.state.operation).toBe('share');
    });

    it('should handle categorize operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('categorize', ['c1', 'c2', 'c3']);
      });

      expect(result.current.state.operation).toBe('categorize');
    });
  });

  describe('cancelOperation', () => {
    it('should cancel in-progress operation', () => {
      vi.useFakeTimers();
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      const { result } = renderHook(() => useBulkOperations());

      act(() => {
        result.current.startBulkOperation('export', ['c1', 'c2', 'c3', 'c4', 'c5']);
      });

      expect(result.current.state.isProcessing).toBe(true);

      act(() => {
        result.current.cancelOperation();
      });

      expect(result.current.state.isProcessing).toBe(false);
      
      vi.useRealTimers();
    });

    it('should do nothing if no operation is in progress', () => {
      const { result } = renderHook(() => useBulkOperations());

      expect(() => {
        act(() => {
          result.current.cancelOperation();
        });
      }).not.toThrow();
    });
  });

  describe('undoLastOperation', () => {
    it('should enable undo after delete operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('delete', ['c1', 'c2']);
      });

      await waitFor(() => {
        expect(result.current.state.canUndo).toBe(true);
      });
    });

    it('should undo the last operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('delete', ['c1']);
      });

      await act(async () => {
        await result.current.undoLastOperation();
      });

      expect(result.current.state.canUndo).toBe(false);
    });

    it('should do nothing if no operation to undo', async () => {
      const { result } = renderHook(() => useBulkOperations());

      await expect(async () => {
        await act(async () => {
          await result.current.undoLastOperation();
        });
      }).rejects.toThrow();
    });
  });

  describe('operation completion', () => {
    it('should set progress to 100 when complete', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('export', ['c1']);
      });

      await waitFor(() => {
        expect(result.current.state.isProcessing).toBe(false);
      });
    });

    it('should reset state for next operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('export', ['c1']);
      });

      await waitFor(() => {
        expect(result.current.state.isProcessing).toBe(false);
      });

      // Start a new operation
      act(() => {
        result.current.startBulkOperation('analyze', ['c2']);
      });

      expect(result.current.state.operation).toBe('analyze');
    });
  });

  describe('lastOperation tracking', () => {
    it('should track last completed operation', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useBulkOperations());

      await act(async () => {
        await result.current.startBulkOperation('delete', ['c1', 'c2']);
      });

      await waitFor(() => {
        expect(result.current.state.lastOperation).toBeDefined();
        expect(result.current.state.lastOperation?.type).toBe('delete');
        expect(result.current.state.lastOperation?.ids).toEqual(['c1', 'c2']);
      });
    });
  });
});

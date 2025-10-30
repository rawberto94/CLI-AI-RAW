/**
 * useLoadingState Hook
 * Manages loading states for async operations with progress tracking
 */

'use client';

import { useState, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  currentStep?: string;
  error?: Error | null;
}

export interface UseLoadingStateOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  trackProgress?: boolean;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    progress: 0,
    currentStep: undefined,
    error: null,
  });

  const startLoading = useCallback((initialStep?: string) => {
    setState({
      isLoading: true,
      progress: 0,
      currentStep: initialStep,
      error: null,
    });
  }, []);

  const updateProgress = useCallback((progress: number, step?: string) => {
    setState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      currentStep: step || prev.currentStep,
    }));
  }, []);

  const setStep = useCallback((step: string) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  const finishLoading = useCallback(() => {
    setState({
      isLoading: false,
      progress: 100,
      currentStep: undefined,
      error: null,
    });
    options.onSuccess?.();
  }, [options]);

  const setError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      error,
    }));
    options.onError?.(error);
  }, [options]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      progress: 0,
      currentStep: undefined,
      error: null,
    });
  }, []);

  const executeWithLoading = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      steps?: string[]
    ): Promise<T | null> => {
      try {
        startLoading(steps?.[0]);

        if (steps && options.trackProgress) {
          const stepProgress = 100 / steps.length;
          for (let i = 0; i < steps.length; i++) {
            setStep(steps[i]);
            updateProgress((i + 1) * stepProgress);
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UX
          }
        }

        const result = await operation();
        finishLoading();
        return result;
      } catch (error) {
        setError(error as Error);
        return null;
      }
    },
    [startLoading, setStep, updateProgress, finishLoading, setError, options.trackProgress]
  );

  return {
    ...state,
    startLoading,
    updateProgress,
    setStep,
    finishLoading,
    setError,
    reset,
    executeWithLoading,
  };
}

// ============================================================================
// Multi-operation Loading State
// ============================================================================

export interface Operation {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: Error;
}

export function useMultiOperationLoading() {
  const [operations, setOperations] = useState<Map<string, Operation>>(new Map());

  const addOperation = useCallback((id: string, name: string) => {
    setOperations(prev => {
      const next = new Map(prev);
      next.set(id, {
        id,
        name,
        progress: 0,
        status: 'pending',
      });
      return next;
    });
  }, []);

  const startOperation = useCallback((id: string) => {
    setOperations(prev => {
      const next = new Map(prev);
      const op = next.get(id);
      if (op) {
        next.set(id, { ...op, status: 'running' });
      }
      return next;
    });
  }, []);

  const updateOperationProgress = useCallback((id: string, progress: number) => {
    setOperations(prev => {
      const next = new Map(prev);
      const op = next.get(id);
      if (op) {
        next.set(id, { ...op, progress: Math.min(100, Math.max(0, progress)) });
      }
      return next;
    });
  }, []);

  const completeOperation = useCallback((id: string) => {
    setOperations(prev => {
      const next = new Map(prev);
      const op = next.get(id);
      if (op) {
        next.set(id, { ...op, status: 'completed', progress: 100 });
      }
      return next;
    });
  }, []);

  const failOperation = useCallback((id: string, error: Error) => {
    setOperations(prev => {
      const next = new Map(prev);
      const op = next.get(id);
      if (op) {
        next.set(id, { ...op, status: 'failed', error });
      }
      return next;
    });
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setOperations(prev => {
      const next = new Map(prev);
      Array.from(next.entries()).forEach(([id, op]) => {
        if (op.status === 'completed') {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  const getOverallProgress = useCallback(() => {
    const ops = Array.from(operations.values());
    if (ops.length === 0) return 0;
    const totalProgress = ops.reduce((sum, op) => sum + op.progress, 0);
    return totalProgress / ops.length;
  }, [operations]);

  const hasRunningOperations = useCallback(() => {
    return Array.from(operations.values()).some(op => op.status === 'running');
  }, [operations]);

  return {
    operations: Array.from(operations.values()),
    addOperation,
    startOperation,
    updateOperationProgress,
    completeOperation,
    failOperation,
    removeOperation,
    clearCompleted,
    getOverallProgress,
    hasRunningOperations,
  };
}

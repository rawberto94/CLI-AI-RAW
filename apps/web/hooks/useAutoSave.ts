/**
 * Auto-Save Hook
 * Automatically saves form data at intervals with conflict detection
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { toast } from 'sonner';

interface UseAutoSaveOptions<T> {
  /** Data to auto-save */
  data: T;
  /** Save function that persists data */
  onSave: (data: T) => Promise<void>;
  /** Delay in ms before saving (default: 3000) */
  delay?: number;
  /** Enable auto-save (default: true) */
  enabled?: boolean;
  /** Show success toast (default: false) */
  showSuccessToast?: boolean;
  /** Show error toast (default: true) */
  showErrorToast?: boolean;
  /** Custom success message */
  successMessage?: string;
  /** Callback after successful save */
  onSuccess?: () => void;
  /** Callback after error */
  onError?: (error: Error) => void;
}

interface UseAutoSaveReturn {
  /** Whether currently saving */
  isSaving: boolean;
  /** Last save timestamp */
  lastSaved: Date | null;
  /** Manually trigger save */
  saveNow: () => Promise<void>;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 3000,
  enabled = true,
  showSuccessToast = false,
  showErrorToast = true,
  successMessage = 'Changes saved',
  onSuccess,
  onError,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const debouncedData = useDebounce(data, delay);
  const previousDataRef = useRef<T>(data);
  const lastSavedRef = useRef<Date | null>(null);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveNow = useCallback(async () => {
    if (isSavingRef.current || !enabled) return;

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      await onSave(data);

      const now = new Date();
      lastSavedRef.current = now;
      setLastSaved(now);
      previousDataRef.current = data;
      setHasUnsavedChanges(false);

      if (showSuccessToast) {
        toast.success(successMessage);
      }

      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Save failed');
      
      if (showErrorToast) {
        toast.error(`Failed to save: ${err.message}`);
      }

      onError?.(err);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [data, enabled, onSave, showSuccessToast, showErrorToast, successMessage, onSuccess, onError]);

  // Track unsaved changes
  useEffect(() => {
    if (JSON.stringify(data) !== JSON.stringify(previousDataRef.current)) {
      setHasUnsavedChanges(true);
    }
  }, [data]);

  // Auto-save when debounced data changes
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) return;
    
    if (JSON.stringify(debouncedData) !== JSON.stringify(previousDataRef.current)) {
      saveNow();
    }
  }, [debouncedData, enabled, hasUnsavedChanges, saveNow]);

  // Save before unload
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, hasUnsavedChanges]);

  return {
    isSaving,
    lastSaved,
    saveNow,
    hasUnsavedChanges,
  };
}

/**
 * Hook for localStorage-backed auto-save
 */
export function useLocalStorageAutoSave<T>(
  key: string,
  data: T,
  delay: number = 1000
): void {
  const debouncedData = useDebounce(data, delay);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(debouncedData));
    } catch {
      // Failed to save to localStorage
    }
  }, [key, debouncedData]);
}

/**
 * Hook to restore data from localStorage
 */
export function useRestoreFromLocalStorage<T>(
  key: string,
  defaultValue: T
): T {
  const [data, setData] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        setData(JSON.parse(saved));
      }
    } catch {
      // Failed to restore from localStorage
    }
  }, [key]);

  return data;
}

import { useState } from 'react';

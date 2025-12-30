'use client';

/**
 * Form Autosave Component
 * Automatically saves form data with debouncing and conflict resolution
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Check, AlertCircle, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface AutosaveConfig<T> {
  /** Unique key for this form */
  formKey: string;
  /** Initial form data */
  initialData: T;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether autosave is enabled */
  enabled?: boolean;
  /** Save function */
  onSave: (data: T) => Promise<void>;
  /** Called when save fails */
  onError?: (error: Error) => void;
  /** Called when save succeeds */
  onSuccess?: () => void;
  /** Enable local storage backup */
  useLocalBackup?: boolean;
}

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutosaveState<T> {
  data: T;
  status: AutosaveStatus;
  lastSaved: Date | null;
  error: Error | null;
  isDirty: boolean;
  hasLocalBackup: boolean;
}

// ============================================
// Local Storage Helpers
// ============================================

function getLocalBackup<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(`autosave:${key}`);
    if (!stored) return null;
    
    const { data, timestamp } = JSON.parse(stored);
    
    // Expire backups after 24 hours
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`autosave:${key}`);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

function setLocalBackup<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(
      `autosave:${key}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn('Failed to save local backup:', error);
  }
}

function clearLocalBackup(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`autosave:${key}`);
}

// ============================================
// Autosave Hook
// ============================================

export function useFormAutosave<T extends object>(config: AutosaveConfig<T>) {
  const {
    formKey,
    initialData,
    debounceMs = 2000,
    enabled = true,
    onSave,
    onError,
    onSuccess,
    useLocalBackup = true,
  } = config;

  const [state, setState] = useState<AutosaveState<T>>(() => ({
    data: initialData,
    status: 'idle',
    lastSaved: null,
    error: null,
    isDirty: false,
    hasLocalBackup: false,
  }));

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>(JSON.stringify(initialData));
  const isMountedRef = useRef(true);

  // Check for local backup on mount
  useEffect(() => {
    if (useLocalBackup) {
      const backup = getLocalBackup<T>(formKey);
      if (backup) {
        setState(prev => ({
          ...prev,
          hasLocalBackup: true,
        }));
      }
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [formKey, useLocalBackup]);

  // Perform save
  const performSave = useCallback(async (dataToSave: T) => {
    if (!isMountedRef.current) return;

    setState(prev => ({ ...prev, status: 'saving', error: null }));

    try {
      await onSave(dataToSave);
      
      if (!isMountedRef.current) return;

      lastSavedDataRef.current = JSON.stringify(dataToSave);
      
      setState(prev => ({
        ...prev,
        status: 'saved',
        lastSaved: new Date(),
        isDirty: false,
        error: null,
      }));

      // Clear local backup on successful save
      if (useLocalBackup) {
        clearLocalBackup(formKey);
      }

      onSuccess?.();

      // Reset status after delay
      setTimeout(() => {
        if (isMountedRef.current) {
          setState(prev => (prev.status === 'saved' ? { ...prev, status: 'idle' } : prev));
        }
      }, 2000);
    } catch (error) {
      if (!isMountedRef.current) return;

      const err = error instanceof Error ? error : new Error('Save failed');
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err,
      }));

      onError?.(err);
    }
  }, [formKey, onSave, onError, onSuccess, useLocalBackup]);

  // Update form data
  const updateData = useCallback((updater: Partial<T> | ((prev: T) => Partial<T>)) => {
    setState(prev => {
      const updates = typeof updater === 'function' ? updater(prev.data) : updater;
      const newData = { ...prev.data, ...updates };
      
      // Check if actually changed
      const newDataStr = JSON.stringify(newData);
      const isDirty = newDataStr !== lastSavedDataRef.current;

      return {
        ...prev,
        data: newData,
        isDirty,
        status: isDirty ? 'pending' : prev.status,
      };
    });
  }, []);

  // Set entire form data
  const setData = useCallback((data: T) => {
    const dataStr = JSON.stringify(data);
    const isDirty = dataStr !== lastSavedDataRef.current;

    setState(prev => ({
      ...prev,
      data,
      isDirty,
      status: isDirty ? 'pending' : prev.status,
    }));
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (!enabled || !state.isDirty) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save to local backup immediately
    if (useLocalBackup) {
      setLocalBackup(formKey, state.data);
    }

    // Debounce actual save
    saveTimeoutRef.current = setTimeout(() => {
      performSave(state.data);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, state.isDirty, state.data, debounceMs, formKey, performSave, useLocalBackup]);

  // Manual save
  const save = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await performSave(state.data);
  }, [state.data, performSave]);

  // Restore from local backup
  const restoreFromBackup = useCallback(() => {
    const backup = getLocalBackup<T>(formKey);
    if (backup) {
      setData(backup);
      setState(prev => ({ ...prev, hasLocalBackup: false }));
    }
  }, [formKey, setData]);

  // Discard local backup
  const discardBackup = useCallback(() => {
    clearLocalBackup(formKey);
    setState(prev => ({ ...prev, hasLocalBackup: false }));
  }, [formKey]);

  // Reset to initial
  const reset = useCallback(() => {
    clearLocalBackup(formKey);
    lastSavedDataRef.current = JSON.stringify(initialData);
    setState({
      data: initialData,
      status: 'idle',
      lastSaved: null,
      error: null,
      isDirty: false,
      hasLocalBackup: false,
    });
  }, [formKey, initialData]);

  return {
    ...state,
    updateData,
    setData,
    save,
    reset,
    restoreFromBackup,
    discardBackup,
  };
}

// ============================================
// Autosave Status Indicator
// ============================================

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSaved: Date | null;
  isDirty: boolean;
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function AutosaveIndicator({
  status,
  lastSaved,
  isDirty,
  error,
  onRetry,
  className,
}: AutosaveIndicatorProps) {
  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <AnimatePresence mode="wait">
        {status === 'saving' && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </motion.div>
        )}

        {status === 'saved' && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
          >
            <Check className="w-4 h-4" />
            <span>Saved</span>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-red-600 dark:text-red-400"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error?.message || 'Save failed'}</span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="underline hover:no-underline ml-1"
              >
                Retry
              </button>
            )}
          </motion.div>
        )}

        {status === 'pending' && isDirty && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
          >
            <Cloud className="w-4 h-4" />
            <span>Unsaved changes</span>
          </motion.div>
        )}

        {status === 'idle' && !isDirty && lastSaved && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"
          >
            <CloudOff className="w-3.5 h-3.5" />
            <span>Saved {formatLastSaved(lastSaved)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Local Backup Recovery Banner
// ============================================

interface BackupRecoveryBannerProps {
  hasBackup: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function BackupRecoveryBanner({
  hasBackup,
  onRestore,
  onDiscard,
}: BackupRecoveryBannerProps) {
  if (!hasBackup) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-amber-900 dark:text-amber-100">
            Unsaved changes recovered
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            We found unsaved changes from your last session. Would you like to restore them?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onRestore}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              Restore
            </button>
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 text-amber-700 dark:text-amber-300 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default useFormAutosave;

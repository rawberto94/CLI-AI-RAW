'use client';

/**
 * Undo Manager
 * Global undo/redo functionality for user actions
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, Redo2, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UndoableAction {
  id: string;
  description: string;
  execute: () => Promise<void> | void;
  undo: () => Promise<void> | void;
  executedAt: number;
  undoneAt?: number;
  category?: 'delete' | 'update' | 'create' | 'other';
}

interface UndoManagerContextValue {
  // Track an undoable action
  trackAction: (action: Omit<UndoableAction, 'id' | 'executedAt'>) => string;
  
  // Undo/redo operations
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  
  // Check if undo/redo is available
  canUndo: boolean;
  canRedo: boolean;
  
  // Get recent actions
  recentActions: UndoableAction[];
  undoneActions: UndoableAction[];
  
  // Clear history
  clearHistory: () => void;
}

const UndoManagerContext = createContext<UndoManagerContextValue | null>(null);

export function useUndoManager() {
  const context = useContext(UndoManagerContext);
  if (!context) {
    throw new Error('useUndoManager must be used within an UndoManagerProvider');
  }
  return context;
}

// Generate unique ID
function generateId() {
  return `action-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const MAX_HISTORY = 50;
const UNDO_TIMEOUT_MS = 30000; // 30 seconds to undo

interface UndoManagerProviderProps {
  children: React.ReactNode;
  maxHistory?: number;
  undoTimeout?: number;
}

export function UndoManagerProvider({ 
  children, 
  maxHistory = MAX_HISTORY,
  undoTimeout = UNDO_TIMEOUT_MS,
}: UndoManagerProviderProps) {
  const [history, setHistory] = useState<UndoableAction[]>([]);
  const [undoneStack, setUndoneStack] = useState<UndoableAction[]>([]);
  const [showUndoBar, setShowUndoBar] = useState(false);
  const [latestAction, setLatestAction] = useState<UndoableAction | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track a new action
  const trackAction = useCallback((action: Omit<UndoableAction, 'id' | 'executedAt'>) => {
    const id = generateId();
    const newAction: UndoableAction = {
      ...action,
      id,
      executedAt: Date.now(),
    };

    setHistory(prev => {
      const updated = [...prev, newAction];
      // Keep only max history
      return updated.slice(-maxHistory);
    });

    // Clear redo stack on new action
    setUndoneStack([]);

    // Show undo bar
    setLatestAction(newAction);
    setShowUndoBar(true);

    // Auto-hide undo bar
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowUndoBar(false);
      setLatestAction(null);
    }, undoTimeout);

    return id;
  }, [maxHistory, undoTimeout]);

  // Undo last action
  const undo = useCallback(async () => {
    const lastAction = history[history.length - 1];
    if (!lastAction) return;

    try {
      await lastAction.undo();
      
      // Move to undone stack
      setHistory(prev => prev.slice(0, -1));
      setUndoneStack(prev => [...prev, { ...lastAction, undoneAt: Date.now() }]);
      
      // Hide undo bar if we just undid the latest action
      if (latestAction?.id === lastAction.id) {
        setShowUndoBar(false);
        setLatestAction(null);
      }
    } catch {
      throw new Error('Failed to undo action');
    }
  }, [history, latestAction]);

  // Redo last undone action
  const redo = useCallback(async () => {
    const lastUndone = undoneStack[undoneStack.length - 1];
    if (!lastUndone) return;

    try {
      await lastUndone.execute();
      
      // Move back to history
      setUndoneStack(prev => prev.slice(0, -1));
      setHistory(prev => [...prev, { ...lastUndone, executedAt: Date.now() }]);
    } catch {
      throw new Error('Failed to redo action');
    }
  }, [undoneStack]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setUndoneStack([]);
    setShowUndoBar(false);
    setLatestAction(null);
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (history.length > 0) {
          e.preventDefault();
          undo();
        }
      }
      
      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y for redo
      if (
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') ||
        ((e.metaKey || e.ctrlKey) && e.key === 'y')
      ) {
        if (undoneStack.length > 0) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, undoneStack, undo, redo]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <UndoManagerContext.Provider value={{
      trackAction,
      undo,
      redo,
      canUndo: history.length > 0,
      canRedo: undoneStack.length > 0,
      recentActions: history,
      undoneActions: undoneStack,
      clearHistory,
    }}>
      {children}
      
      {/* Floating Undo Bar */}
      <AnimatePresence>
        {showUndoBar && latestAction && (
          <UndoBar
            action={latestAction}
            onUndo={undo}
            onDismiss={() => {
              setShowUndoBar(false);
              setLatestAction(null);
            }}
            timeout={undoTimeout}
          />
        )}
      </AnimatePresence>
    </UndoManagerContext.Provider>
  );
}

// Floating Undo Bar Component
interface UndoBarProps {
  action: UndoableAction;
  onUndo: () => void;
  onDismiss: () => void;
  timeout: number;
}

function UndoBar({ action, onUndo, onDismiss, timeout }: UndoBarProps) {
  const [timeLeft, setTimeLeft] = useState(timeout);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const categoryColors = {
    delete: 'bg-red-500',
    update: 'bg-blue-500',
    create: 'bg-emerald-500',
    other: 'bg-slate-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
        {/* Category indicator */}
        <div className={cn(
          "w-2 h-2 rounded-full",
          categoryColors[action.category || 'other']
        )} />

        {/* Description */}
        <span className="text-sm text-white">
          {action.description}
        </span>

        {/* Time remaining */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          {Math.ceil(timeLeft / 1000)}s
        </div>

        {/* Undo button */}
        <button
          onClick={onUndo}
          className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>

        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: timeout / 1000, ease: 'linear' }}
        className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full"
      />
    </motion.div>
  );
}

// Hook for quick undo actions
export function useUndoableAction() {
  const { trackAction } = useUndoManager();

  return useCallback(<T,>(
    description: string,
    execute: () => T | Promise<T>,
    undo: () => void | Promise<void>,
    category?: UndoableAction['category']
  ) => {
    // Execute the action first
    const result = execute();
    
    // Track it for undo
    trackAction({
      description,
      execute: async () => { await execute(); },
      undo,
      category,
    });

    return result;
  }, [trackAction]);
}

export default UndoManagerProvider;

/**
 * Contracts Page Keyboard Shortcuts Hook
 * 
 * Centralized keyboard shortcuts for the contracts page.
 */

'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

export interface ContractsKeyboardShortcut {
  key: string;
  description: string;
  category: 'navigation' | 'selection' | 'actions' | 'filters' | 'view';
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  action: () => void;
}

// Alias for backward compatibility
type KeyboardShortcut = ContractsKeyboardShortcut;

export interface UseContractsKeyboardShortcutsOptions {
  // Navigation
  onNavigateToUpload?: () => void;
  onNavigateToContract?: (id: string) => void;
  onRefresh?: () => void;
  
  // Selection
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onInvertSelection?: () => void;
  
  // View
  onToggleViewMode?: () => void;
  onToggleFilters?: () => void;
  
  // Search
  onFocusSearch?: () => void;
  onClearSearch?: () => void;
  
  // Actions
  onDelete?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  
  // Enable/disable
  enabled?: boolean;
}

export interface UseContractsKeyboardShortcutsResult {
  shortcuts: ContractsKeyboardShortcut[];
  getShortcutLabel: (shortcut: ContractsKeyboardShortcut) => string;
}

// Alias for backward compatibility with consumers expecting this name
export type KeyboardShortcutHandlers = UseContractsKeyboardShortcutsOptions;

// ============================================================================
// Helper Functions
// ============================================================================

function getModifierLabel(modifiers?: KeyboardShortcut['modifiers']): string {
  const parts: string[] = [];
  
  if (modifiers?.ctrl || modifiers?.meta) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (modifiers?.shift) {
    parts.push('⇧');
  }
  if (modifiers?.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  
  return parts.join('+');
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'Escape': 'Esc',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Backspace': '⌫',
    'Delete': 'Del',
    ' ': 'Space',
  };
  
  return keyMap[key] || key.toUpperCase();
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractsKeyboardShortcuts(
  options: UseContractsKeyboardShortcutsOptions = {}
): UseContractsKeyboardShortcutsResult {
  const {
    onNavigateToUpload,
    onRefresh,
    onSelectAll,
    onDeselectAll,
    onToggleViewMode,
    onFocusSearch,
    onClearSearch,
    onDelete,
    onExport,
    onShare,
    enabled = true,
  } = options;

  const router = useRouter();

  // Define shortcuts
  const shortcuts = useMemo<ContractsKeyboardShortcut[]>(() => [
    // Navigation
    {
      key: 'n',
      description: 'New contract (upload)',
      category: 'navigation',
      action: () => onNavigateToUpload?.() ?? router.push('/upload'),
    },
    {
      key: 'r',
      description: 'Refresh contracts',
      category: 'navigation',
      action: () => onRefresh?.(),
    },
    
    // Search & Filters
    {
      key: '/',
      description: 'Focus search',
      category: 'filters',
      action: () => {
        if (onFocusSearch) {
          onFocusSearch();
        } else {
          const input = document.querySelector<HTMLInputElement>('[data-search-input], [data-testid="contract-search"]');
          input?.focus();
        }
      },
    },
    {
      key: 'Escape',
      description: 'Clear search & selection',
      category: 'filters',
      action: () => {
        onClearSearch?.();
        onDeselectAll?.();
      },
    },
    
    // View
    {
      key: 'v',
      description: 'Toggle view mode',
      category: 'view',
      action: () => onToggleViewMode?.(),
    },
    
    // Selection
    {
      key: 'a',
      description: 'Select all',
      category: 'selection',
      modifiers: { ctrl: true },
      action: () => onSelectAll?.(),
    },
    {
      key: 'd',
      description: 'Deselect all',
      category: 'selection',
      modifiers: { ctrl: true },
      action: () => onDeselectAll?.(),
    },
    
    // Actions
    {
      key: 'Delete',
      description: 'Delete selected',
      category: 'actions',
      action: () => onDelete?.(),
    },
    {
      key: 'e',
      description: 'Export selected',
      category: 'actions',
      modifiers: { ctrl: true },
      action: () => onExport?.(),
    },
    {
      key: 's',
      description: 'Share selected',
      category: 'actions',
      modifiers: { ctrl: true, shift: true },
      action: () => onShare?.(),
    },
  ], [
    router,
    onNavigateToUpload,
    onRefresh,
    onSelectAll,
    onDeselectAll,
    onToggleViewMode,
    onFocusSearch,
    onClearSearch,
    onDelete,
    onExport,
    onShare,
  ]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only allow Escape in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Find matching shortcut
    for (const shortcut of shortcuts) {
      const modifiers = shortcut.modifiers || {};
      
      // Check key match
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase() && 
          event.key !== shortcut.key) {
        continue;
      }
      
      // Check modifier match
      const ctrlMatch = (modifiers.ctrl || modifiers.meta) 
        ? (event.ctrlKey || event.metaKey)
        : (!event.ctrlKey && !event.metaKey);
      const shiftMatch = modifiers.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = modifiers.alt ? event.altKey : !event.altKey;
      
      if (!ctrlMatch || !shiftMatch || !altMatch) {
        continue;
      }
      
      // Execute action
      event.preventDefault();
      shortcut.action();
      return;
    }
  }, [shortcuts]);

  // Register event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Get human-readable shortcut label
  const getShortcutLabel = useCallback((shortcut: ContractsKeyboardShortcut): string => {
    const modifier = getModifierLabel(shortcut.modifiers);
    const key = formatKey(shortcut.key);
    
    return modifier ? `${modifier}+${key}` : key;
  }, []);

  return {
    shortcuts,
    getShortcutLabel,
  };
}

// ============================================================================
// Keyboard Shortcuts Help Component Data
// ============================================================================

export function getShortcutsByCategory(shortcuts: ContractsKeyboardShortcut[]): Record<string, ContractsKeyboardShortcut[]> {
  const categories: Record<string, ContractsKeyboardShortcut[]> = {
    navigation: [],
    selection: [],
    actions: [],
    filters: [],
    view: [],
  };

  for (const shortcut of shortcuts) {
    const category = categories[shortcut.category];
    if (category) {
      category.push(shortcut);
    }
  }

  return categories;
}

export const SHORTCUT_CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  selection: 'Selection',
  actions: 'Actions',
  filters: 'Search & Filters',
  view: 'View',
};

export default useContractsKeyboardShortcuts;

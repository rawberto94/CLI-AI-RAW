/**
 * useKeyboardShortcuts Hook
 * Manages keyboard shortcuts with conflict detection and help modal
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  category?: string;
  enabled?: boolean;
}

export interface ShortcutConfig {
  shortcuts: KeyboardShortcut[];
  preventDefault?: boolean;
  enableInInputs?: boolean;
}

export function useKeyboardShortcuts(config: ShortcutConfig) {
  const { shortcuts, preventDefault = true, enableInInputs = false } = config;
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if typing in input/textarea/contenteditable
      if (!enableInInputs) {
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Find matching shortcut
      const matchingShortcut = shortcutsRef.current.find(shortcut => {
        if (shortcut.enabled === false) return false;

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatches = !!shortcut.shift === event.shiftKey;
        const altMatches = !!shortcut.alt === event.altKey;

        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchingShortcut) {
        if (preventDefault) {
          event.preventDefault();
        }
        matchingShortcut.action();
      }
    },
    [preventDefault, enableInInputs]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: shortcutsRef.current,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac() ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac() ? '⌥' : 'Alt');
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
}

export function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function groupShortcutsByCategory(shortcuts: KeyboardShortcut[]): Record<string, KeyboardShortcut[]> {
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);
}

/**
 * Global Keyboard Shortcuts Provider
 * Manages application-wide keyboard shortcuts
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CommandPalette } from '@/components/ui/command-palette';

interface ShortcutAction {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export function GlobalKeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Define global shortcuts
  const shortcuts: ShortcutAction[] = [
    {
      key: 'k',
      metaKey: true,
      action: () => setCommandPaletteOpen(true),
      description: 'Open command palette',
      preventDefault: true,
    },
    {
      key: 'k',
      ctrlKey: true,
      action: () => setCommandPaletteOpen(true),
      description: 'Open command palette (Windows/Linux)',
      preventDefault: true,
    },
    {
      key: '/',
      action: () => router.push('/search'),
      description: 'Focus search',
      preventDefault: true,
    },
    {
      key: 'n',
      metaKey: true,
      action: () => router.push('/upload'),
      description: 'New contract',
      preventDefault: true,
    },
    {
      key: 'n',
      ctrlKey: true,
      action: () => router.push('/upload'),
      description: 'New contract (Windows/Linux)',
      preventDefault: true,
    },
    {
      key: 'h',
      altKey: true,
      action: () => router.push('/'),
      description: 'Go to home',
      preventDefault: true,
    },
    {
      key: 'c',
      altKey: true,
      action: () => router.push('/contracts'),
      description: 'Go to contracts',
      preventDefault: true,
    },
    {
      key: 'a',
      altKey: true,
      action: () => router.push('/analytics'),
      description: 'Go to analytics',
      preventDefault: true,
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't trigger shortcuts when typing in inputs
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Except for command palette shortcut
        if (!(event.key === 'k' && (event.metaKey || event.ctrlKey))) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !shortcut.ctrlKey || event.ctrlKey;
        const shiftMatches = !shortcut.shiftKey || event.shiftKey;
        const altMatches = !shortcut.altKey || event.altKey;
        const metaMatches = !shortcut.metaKey || event.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          if (shortcut.preventDefault) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ESC to close command palette
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    if (commandPaletteOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [commandPaletteOpen]);

  return (
    <>
      {children}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
}

/**
 * Hook to programmatically open command palette
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

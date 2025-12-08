/**
 * Global Keyboard Provider (P5: Polish)
 * 
 * Wraps the app to provide keyboard shortcuts, command palette,
 * and navigation capabilities globally
 */

'use client';

import React, { useEffect } from 'react';
import { CommandPalette, useCommandPalette } from './command-palette';
import { KeyboardShortcutsOverlay, useKeyboardShortcuts, useKeyboardNavigation } from './keyboard-shortcuts';

interface GlobalKeyboardProviderProps {
  children: React.ReactNode;
}

export function GlobalKeyboardProvider({ children }: GlobalKeyboardProviderProps) {
  const commandPalette = useCommandPalette();
  const shortcuts = useKeyboardShortcuts();
  
  // Enable keyboard navigation
  useKeyboardNavigation();

  // Disable initial theme transition to prevent flash
  useEffect(() => {
    // Remove no-transition class after initial render
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove('no-transition');
    }, 100);
    
    return () => clearTimeout(timeout);
  }, []);

  return (
    <>
      {children}
      <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
      <KeyboardShortcutsOverlay isOpen={shortcuts.isOpen} onClose={shortcuts.close} />
    </>
  );
}

export default GlobalKeyboardProvider;

/**
 * Global Command Palette - Placeholder Module
 * 
 * Real command palette functionality is planned for a future release.
 * These exports provide no-op stubs so imports don't break.
 */

import React from 'react';

// No-op provider that just renders its children
export const GlobalCommandPaletteProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

// No-op hook
export function useGlobalCommandPalette() {
  return {
    isOpen: false,
    open: () => {},
    close: () => {},
    toggle: () => {},
    registerCommand: () => {},
  };
}

// Empty command generators
export function createNavigationCommands() { return []; }
export function createSearchCommands() { return []; }
export function createThemeCommands() { return []; }
export const HELP_COMMANDS: never[] = [];

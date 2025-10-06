/**
 * Keyboard Shortcuts Hook
 * Provides cross-platform keyboard shortcut support for the application
 */

import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  meta?: boolean // Cmd on Mac
  shift?: boolean
  alt?: boolean
  callback: () => void
  description: string
  preventDefault?: boolean
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  shortcuts: KeyboardShortcut[]
}

/**
 * Hook to register keyboard shortcuts
 * Automatically handles Cmd (Mac) vs Ctrl (Windows/Linux)
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { enabled = true, shortcuts } = options
  const shortcutsRef = useRef(shortcuts)

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    
    for (const shortcut of shortcutsRef.current) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
      
      // Handle Cmd (Mac) or Ctrl (Windows/Linux)
      const modifierMatches = shortcut.ctrl || shortcut.meta
        ? isMac 
          ? event.metaKey 
          : event.ctrlKey
        : true

      const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatches = shortcut.alt ? event.altKey : !event.altKey

      if (keyMatches && modifierMatches && shiftMatches && altMatches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.callback()
        break
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}

/**
 * Get the display string for a keyboard shortcut
 * Shows Cmd on Mac, Ctrl on Windows/Linux
 */
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const parts: string[] = []

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }
  
  parts.push(shortcut.key.toUpperCase())

  return parts.join(isMac ? '' : '+')
}

/**
 * Predefined shortcuts for common actions
 */
export const commonShortcuts = {
  save: (callback: () => void): KeyboardShortcut => ({
    key: 's',
    ctrl: true,
    meta: true,
    callback,
    description: 'Save'
  }),
  
  export: (callback: () => void): KeyboardShortcut => ({
    key: 'e',
    ctrl: true,
    meta: true,
    callback,
    description: 'Export'
  }),
  
  share: (callback: () => void): KeyboardShortcut => ({
    key: 's',
    ctrl: true,
    meta: true,
    shift: true,
    callback,
    description: 'Share'
  }),
  
  search: (callback: () => void): KeyboardShortcut => ({
    key: 'k',
    ctrl: true,
    meta: true,
    callback,
    description: 'Search / Command Palette'
  }),
  
  help: (callback: () => void): KeyboardShortcut => ({
    key: '?',
    shift: true,
    callback,
    description: 'Show Help'
  }),
  
  escape: (callback: () => void): KeyboardShortcut => ({
    key: 'Escape',
    callback,
    description: 'Close / Cancel',
    preventDefault: false
  }),
  
  tab: (number: number, callback: () => void): KeyboardShortcut => ({
    key: number.toString(),
    ctrl: true,
    meta: true,
    callback,
    description: `Switch to Tab ${number}`
  })
}

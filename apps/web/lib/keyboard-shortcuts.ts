/**
 * Global Keyboard Shortcuts Manager
 * 
 * Provides centralized keyboard shortcut handling across the application
 */

export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  description: string
  action: () => void
  category?: string
}

export class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private enabled: boolean = true

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this))
    }
  }

  /**
   * Register a keyboard shortcut
   */
  register(id: string, shortcut: KeyboardShortcut) {
    this.shortcuts.set(id, shortcut)
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string) {
    this.shortcuts.delete(id)
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): Array<{ id: string; shortcut: KeyboardShortcut }> {
    return Array.from(this.shortcuts.entries()).map(([id, shortcut]) => ({
      id,
      shortcut
    }))
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: string): Array<{ id: string; shortcut: KeyboardShortcut }> {
    return this.getAll().filter(({ shortcut }) => shortcut.category === category)
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent) {
    if (!this.enabled) return

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Cmd+K even in inputs for command palette
      if (!(event.key === 'k' && (event.metaKey || event.ctrlKey))) {
        return
      }
    }

    for (const [id, shortcut] of this.shortcuts) {
      if (this.matchesShortcut(event, shortcut)) {
        event.preventDefault()
        event.stopPropagation()
        shortcut.action()
        break
      }
    }
  }

  /**
   * Check if event matches shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const key = event.key.toLowerCase()
    const shortcutKey = shortcut.key.toLowerCase()

    if (key !== shortcutKey) return false

    const ctrl = event.ctrlKey || event.metaKey
    const alt = event.altKey
    const shift = event.shiftKey

    return (
      (shortcut.ctrl === undefined || shortcut.ctrl === ctrl) &&
      (shortcut.meta === undefined || shortcut.meta === (event.metaKey || event.ctrlKey)) &&
      (shortcut.alt === undefined || shortcut.alt === alt) &&
      (shortcut.shift === undefined || shortcut.shift === shift)
    )
  }

  /**
   * Format shortcut for display
   */
  static formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = []
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

    if (shortcut.ctrl || shortcut.meta) {
      parts.push(isMac ? '⌘' : 'Ctrl')
    }
    if (shortcut.alt) {
      parts.push(isMac ? '⌥' : 'Alt')
    }
    if (shortcut.shift) {
      parts.push(isMac ? '⇧' : 'Shift')
    }
    parts.push(shortcut.key.toUpperCase())

    return parts.join(isMac ? '' : '+')
  }
}

// Global instance
export const keyboardShortcuts = new KeyboardShortcutsManager()

// Default shortcuts
export const DEFAULT_SHORTCUTS = {
  COMMAND_PALETTE: {
    key: 'k',
    meta: true,
    description: 'Open command palette',
    category: 'Navigation'
  },
  HELP_CENTER: {
    key: '?',
    meta: true,
    description: 'Open help center',
    category: 'Help'
  },
  SHORTCUTS_LIST: {
    key: '/',
    meta: true,
    description: 'Show keyboard shortcuts',
    category: 'Help'
  },
  SEARCH: {
    key: 'f',
    meta: true,
    description: 'Search contracts',
    category: 'Navigation'
  },
  NEW_CONTRACT: {
    key: 'n',
    meta: true,
    description: 'Upload new contract',
    category: 'Actions'
  },
  DASHBOARD: {
    key: 'h',
    meta: true,
    description: 'Go to dashboard',
    category: 'Navigation'
  },
  ANALYTICS: {
    key: 'a',
    meta: true,
    description: 'Go to analytics',
    category: 'Navigation'
  }
}

'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { keyboardShortcuts, DEFAULT_SHORTCUTS } from '@/lib/keyboard-shortcuts'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'

/**
 * Global Keyboard Shortcuts Provider
 * 
 * Registers and manages global keyboard shortcuts for the application
 */
export function GlobalKeyboardShortcuts() {
  const router = useRouter()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Register command palette shortcut (Cmd+K)
    keyboardShortcuts.register('command-palette', {
      ...DEFAULT_SHORTCUTS.COMMAND_PALETTE,
      action: () => {
        // Trigger command palette
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true
        })
        document.dispatchEvent(event)
      }
    })

    // Register help center shortcut (Cmd+?)
    keyboardShortcuts.register('help-center', {
      ...DEFAULT_SHORTCUTS.HELP_CENTER,
      action: () => {
        setShowHelp(true)
      }
    })

    // Register shortcuts list shortcut (Cmd+/)
    keyboardShortcuts.register('shortcuts-list', {
      ...DEFAULT_SHORTCUTS.SHORTCUTS_LIST,
      action: () => {
        setShowShortcuts(true)
      }
    })

    // Register search shortcut (Cmd+F)
    keyboardShortcuts.register('search', {
      ...DEFAULT_SHORTCUTS.SEARCH,
      action: () => {
        router.push('/search')
      }
    })

    // Register new contract shortcut (Cmd+N)
    keyboardShortcuts.register('new-contract', {
      ...DEFAULT_SHORTCUTS.NEW_CONTRACT,
      action: () => {
        router.push('/contracts/upload')
      }
    })

    // Register dashboard shortcut (Cmd+H)
    keyboardShortcuts.register('dashboard', {
      ...DEFAULT_SHORTCUTS.DASHBOARD,
      action: () => {
        router.push('/')
      }
    })

    // Register analytics shortcut (Cmd+A)
    keyboardShortcuts.register('analytics', {
      ...DEFAULT_SHORTCUTS.ANALYTICS,
      action: () => {
        router.push('/analytics')
      }
    })

    // Cleanup
    return () => {
      keyboardShortcuts.unregister('command-palette')
      keyboardShortcuts.unregister('help-center')
      keyboardShortcuts.unregister('shortcuts-list')
      keyboardShortcuts.unregister('search')
      keyboardShortcuts.unregister('new-contract')
      keyboardShortcuts.unregister('dashboard')
      keyboardShortcuts.unregister('analytics')
    }
  }, [router])

  return (
    <>
      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
      />

      {/* Help Center Dialog - placeholder for now */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Help Center</h2>
            <p className="text-gray-600 mb-4">
              Help center coming soon! For now, use Cmd+/ to view keyboard shortcuts.
            </p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => setShowHelp(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Keyboard,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ShortcutItem {
  keys: string[]
  description: string
  category: 'navigation' | 'actions' | 'general'
}

const shortcuts: ShortcutItem[] = [
  // Navigation
  { keys: ['1'], description: 'Switch to Summary tab', category: 'navigation' },
  { keys: ['2'], description: 'Switch to Details tab', category: 'navigation' },
  { keys: ['3'], description: 'Switch to Activity tab', category: 'navigation' },
  { keys: ['P'], description: 'Toggle PDF viewer', category: 'navigation' },
  { keys: ['Esc'], description: 'Close dialogs / Exit edit mode', category: 'navigation' },
  // Actions
  { keys: ['E'], description: 'Enter edit mode', category: 'actions' },
  { keys: ['⌘', 'D'], description: 'Download contract', category: 'actions' },
  { keys: ['⌘', 'R'], description: 'Refresh data', category: 'actions' },
  { keys: ['⌘', 'S'], description: 'Save changes (in edit mode)', category: 'actions' },
  // General
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'general' },
  { keys: ['⌘', 'K'], description: 'Open command palette', category: 'general' },
]

const categoryLabels = {
  navigation: 'Navigation',
  actions: 'Actions',
  general: 'General',
}

const KeyboardKey = memo(function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded shadow-sm">
      {children}
    </kbd>
  )
})

export const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp() {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) acc[shortcut.category] = []
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, ShortcutItem[]>)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-1.5 text-xs text-slate-500 hover:text-slate-700"
        >
          <Keyboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-slate-500" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h4>
              <div className="space-y-2">
                {items.map((shortcut, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-slate-700">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <KeyboardKey>{key}</KeyboardKey>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-slate-400 text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Press <KeyboardKey>?</KeyboardKey> anytime to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
})

// Compact inline help for the header
export const ShortcutsHint = memo(function ShortcutsHint() {
  return (
    <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
      <span>Quick:</span>
      <div className="flex items-center gap-1">
        <KeyboardKey>P</KeyboardKey>
        <span>PDF</span>
      </div>
      <span className="text-slate-300">·</span>
      <div className="flex items-center gap-1">
        <KeyboardKey>E</KeyboardKey>
        <span>Edit</span>
      </div>
      <span className="text-slate-300">·</span>
      <div className="flex items-center gap-1">
        <KeyboardKey>?</KeyboardKey>
        <span>More</span>
      </div>
    </div>
  )
})

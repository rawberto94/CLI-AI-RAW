/**
 * Command Palette (Cmd+K / Ctrl+K)
 * Global search and action menu for power users
 * Provides quick access to all features without mouse
 */

'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  FileText,
  MessageSquare,
  FileSignature,
  Download,
  Share2,
  Edit2,
  ThumbsUp,
  Home,
  Calendar,
  Shield,
  Workflow,
  Users,
  Filter,
  Settings,
  HelpCircle,
  ArrowRight,
  Command as CommandIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  description?: string
  icon: any
  category: 'navigation' | 'actions' | 'search' | 'help'
  shortcut?: string
  keywords?: string[]
  action: () => void
}

interface CommandPaletteProps {
  contractId?: string
  onClose?: () => void
}

export function CommandPalette({ contractId, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Define all available commands
  const allCommands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-home',
      label: 'Go to Contracts',
      description: 'View all contracts',
      icon: Home,
      category: 'navigation',
      shortcut: 'g h',
      keywords: ['contracts', 'list', 'home'],
      action: () => router.push('/contracts'),
    },
    {
      id: 'nav-deadlines',
      label: 'Go to Deadlines',
      description: 'View upcoming deadlines',
      icon: Calendar,
      category: 'navigation',
      shortcut: 'g d',
      keywords: ['deadlines', 'renewals', 'expirations'],
      action: () => router.push('/deadlines'),
    },
    {
      id: 'nav-templates',
      label: 'Go to Templates',
      description: 'Browse contract templates',
      icon: FileText,
      category: 'navigation',
      shortcut: 'g t',
      keywords: ['templates', 'library'],
      action: () => router.push('/templates'),
    },
    {
      id: 'nav-generate',
      label: 'Generate New Contract',
      description: 'Create contract from template',
      icon: FileText,
      category: 'navigation',
      shortcut: 'cmd n',
      keywords: ['generate', 'create', 'new'],
      action: () => router.push('/contracts/generate'),
    },

    // Actions (contract-specific)
    ...(contractId ? [
      {
        id: 'action-comment',
        label: 'Add Comment',
        description: 'Start a discussion',
        icon: MessageSquare,
        category: 'actions' as const,
        shortcut: 'cmd shift c',
        keywords: ['comment', 'discuss', 'mention'],
        action: () => {
          document.querySelector<HTMLTextAreaElement>('[data-comment-input]')?.focus()
        },
      },
      {
        id: 'action-signature',
        label: 'Request Signature',
        description: 'Send for e-signature',
        icon: FileSignature,
        category: 'actions' as const,
        shortcut: 'cmd shift s',
        keywords: ['sign', 'signature', 'docusign'],
        action: () => {
          document.querySelector<HTMLButtonElement>('[data-signature-button]')?.click()
        },
      },
      {
        id: 'action-export',
        label: 'Export Contract',
        description: 'Download as PDF or Word',
        icon: Download,
        category: 'actions' as const,
        shortcut: 'cmd e',
        keywords: ['export', 'download', 'pdf', 'word'],
        action: () => {
          document.querySelector<HTMLButtonElement>('[data-export-button]')?.click()
        },
      },
      {
        id: 'action-share',
        label: 'Share Contract',
        description: 'Share with team members',
        icon: Share2,
        category: 'actions' as const,
        shortcut: 'cmd shift h',
        keywords: ['share', 'collaborate', 'invite'],
        action: () => {
          // TODO: Implement share dialog
          console.log('Share contract')
        },
      },
      {
        id: 'action-metadata',
        label: 'Edit Metadata',
        description: 'Update contract details',
        icon: Edit2,
        category: 'actions' as const,
        shortcut: 'cmd m',
        keywords: ['edit', 'metadata', 'details'],
        action: () => {
          document.querySelector<HTMLButtonElement>('[data-metadata-edit]')?.click()
        },
      },
      {
        id: 'action-approve',
        label: 'Approve Workflow Step',
        description: 'Approve pending step',
        icon: ThumbsUp,
        category: 'actions' as const,
        shortcut: 'cmd a',
        keywords: ['approve', 'workflow', 'accept'],
        action: () => {
          document.querySelector<HTMLButtonElement>('[data-workflow-approve]')?.click()
        },
      },
    ] : []),

    // Search & Filter
    {
      id: 'search-contracts',
      label: 'Search Contracts',
      description: 'Find contracts by name or content',
      icon: Search,
      category: 'search',
      shortcut: 'cmd /',
      keywords: ['search', 'find'],
      action: () => {
        router.push('/contracts')
        setTimeout(() => {
          document.querySelector<HTMLInputElement>('[data-search-input]')?.focus()
        }, 100)
      },
    },
    {
      id: 'filter-client',
      label: 'Filter by Client',
      description: 'Show contracts for specific client',
      icon: Filter,
      category: 'search',
      keywords: ['filter', 'client', 'party'],
      action: () => {
        // TODO: Open filter panel
        console.log('Filter by client')
      },
    },

    // Help
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all shortcuts',
      icon: HelpCircle,
      category: 'help',
      shortcut: '?',
      keywords: ['help', 'shortcuts', 'keyboard'],
      action: () => {
        // TODO: Show shortcuts help
        console.log('Show shortcuts')
      },
    },
  ], [contractId, router])

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return allCommands

    const query = search.toLowerCase()
    return allCommands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some(kw => kw.includes(query))
    )
  }, [search, allCommands])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      navigation: [],
      actions: [],
      search: [],
      help: [],
    }

    filteredCommands.forEach(cmd => {
      if (groups[cmd.category]) {
        groups[cmd.category]!.push(cmd)
      }
    })

    return groups
  }, [filteredCommands])

  // Handle keyboard shortcuts to open/close palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        return
      }

      // Close with Escape
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }

      if (!open) return

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => 
          Math.min(prev + 1, filteredCommands.length - 1)
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const command = filteredCommands[selectedIndex]
        if (command) {
          command.action()
          setOpen(false)
          onClose?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, selectedIndex, filteredCommands, onClose])

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Reset search when opening
  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedIndex(0)
    }
  }, [open])

  const executeCommand = (command: Command) => {
    command.action()
    setOpen(false)
    onClose?.()
  }

  const categoryLabels = {
    navigation: 'Navigation',
    actions: 'Actions',
    search: 'Search & Filter',
    help: 'Help',
  }

  return (
    <>
      {/* Trigger Button (optional - mainly keyboard driven) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="ml-auto px-2 py-0.5 text-xs font-mono bg-white border border-gray-300 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Command Palette Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          {/* Search Input */}
          <div className="border-b border-gray-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a command or search..."
                className="pl-10 pr-20 h-12 text-base border-0 focus-visible:ring-0 bg-transparent"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
                  esc
                </kbd>
              </div>
            </div>
          </div>

          {/* Commands List */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No commands found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedCommands).map(([category, commands]) => {
                  if (commands.length === 0) return null

                  return (
                    <div key={category}>
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {categoryLabels[category as keyof typeof categoryLabels]}
                      </p>
                      <div className="space-y-1">
                        {commands.map((command, index) => {
                          const globalIndex = filteredCommands.indexOf(command)
                          const isSelected = globalIndex === selectedIndex

                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              isSelected={isSelected}
                              onClick={() => executeCommand(command)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">esc</kbd>
                Close
              </span>
            </div>
            <span>
              {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CommandItem({
  command,
  isSelected,
  onClick,
  onMouseEnter,
}: {
  command: Command
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const Icon = command.icon

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-blue-50 border-blue-200'
          : 'hover:bg-gray-50'
      )}
    >
      <div className={cn(
        'p-2 rounded-lg',
        isSelected ? 'bg-blue-100' : 'bg-gray-100'
      )}>
        <Icon className={cn(
          'h-4 w-4',
          isSelected ? 'text-blue-600' : 'text-gray-600'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          isSelected ? 'text-blue-900' : 'text-gray-900'
        )}>
          {command.label}
        </p>
        {command.description && (
          <p className={cn(
            'text-xs truncate',
            isSelected ? 'text-blue-700' : 'text-gray-500'
          )}>
            {command.description}
          </p>
        )}
      </div>

      {command.shortcut && (
        <kbd className={cn(
          'px-2 py-1 text-xs font-mono border rounded',
          isSelected
            ? 'bg-white border-blue-300 text-blue-700'
            : 'bg-gray-100 border-gray-300 text-gray-600'
        )}>
          {command.shortcut}
        </kbd>
      )}

      {isSelected && (
        <ArrowRight className="h-4 w-4 text-blue-600" />
      )}
    </button>
  )
}

// Export a hook for programmatic access
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

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
  Upload,
  Brain,
  GitCompare,
  Clock,
  CheckCircle,
  AlertTriangle,
  Bell,
  Sparkles,
  Eye,
  Trash2,
  RefreshCw,
  DollarSign,
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
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Define all available commands
  const allCommands: Command[] = useMemo(() => [
    // Navigation - Core
    {
      id: 'nav-home',
      label: 'Go to Dashboard',
      description: 'View main dashboard',
      icon: Home,
      category: 'navigation',
      shortcut: 'g d',
      keywords: ['dashboard', 'home', 'overview'],
      action: () => router.push('/'),
    },
    {
      id: 'nav-contracts',
      label: 'Go to Contracts',
      description: 'View all contracts',
      icon: FileText,
      category: 'navigation',
      shortcut: 'g c',
      keywords: ['contracts', 'list'],
      action: () => router.push('/contracts'),
    },
    {
      id: 'nav-upload',
      label: 'Upload Contract',
      description: 'Upload a new contract',
      icon: Upload,
      category: 'navigation',
      shortcut: 'cmd u',
      keywords: ['upload', 'new', 'add'],
      action: () => router.push('/upload'),
    },
    
    // Navigation - Workflow
    {
      id: 'nav-approvals',
      label: 'Go to Approvals',
      description: 'View pending approvals',
      icon: CheckCircle,
      category: 'navigation',
      shortcut: 'g a',
      keywords: ['approvals', 'pending', 'review'],
      action: () => router.push('/approvals'),
    },
    {
      id: 'nav-workflows',
      label: 'Go to Workflows',
      description: 'Manage workflows',
      icon: Workflow,
      category: 'navigation',
      shortcut: 'g w',
      keywords: ['workflows', 'automation', 'rules'],
      action: () => router.push('/workflows'),
    },
    {
      id: 'nav-deadlines',
      label: 'Go to Deadlines',
      description: 'View upcoming deadlines',
      icon: Clock,
      category: 'navigation',
      shortcut: 'g l',
      keywords: ['deadlines', 'renewals', 'expirations', 'expiring'],
      action: () => router.push('/deadlines'),
    },
    {
      id: 'nav-renewals',
      label: 'Go to Renewals',
      description: 'Manage contract renewals',
      icon: RefreshCw,
      category: 'navigation',
      shortcut: 'g r',
      keywords: ['renewals', 'expiring', 'renew'],
      action: () => router.push('/renewals'),
    },
    
    // Navigation - AI
    {
      id: 'nav-ai-chat',
      label: 'AI Chat',
      description: 'Chat with AI about contracts',
      icon: MessageSquare,
      category: 'navigation',
      shortcut: 'g i',
      keywords: ['ai', 'chat', 'ask', 'question'],
      action: () => router.push('/ai/chat'),
    },
    {
      id: 'nav-ai-search',
      label: 'AI Search',
      description: 'Advanced semantic search',
      icon: Brain,
      category: 'navigation',
      shortcut: 'cmd shift f',
      keywords: ['ai', 'search', 'semantic', 'find'],
      action: () => router.push('/search/advanced'),
    },
    {
      id: 'nav-ai-compare',
      label: 'Compare Contracts',
      description: 'AI-powered contract comparison',
      icon: GitCompare,
      category: 'navigation',
      shortcut: 'cmd shift c',
      keywords: ['compare', 'diff', 'difference'],
      action: () => router.push('/ai/compare'),
    },
    
    // Navigation - Analysis
    {
      id: 'nav-rate-cards',
      label: 'Go to Rate Cards',
      description: 'View rate card analysis',
      icon: DollarSign,
      category: 'navigation',
      shortcut: 'g p',
      keywords: ['rate', 'cards', 'pricing', 'costs'],
      action: () => router.push('/rate-cards'),
    },
    {
      id: 'nav-risk',
      label: 'Go to Risk Analysis',
      description: 'View risk dashboard',
      icon: AlertTriangle,
      category: 'navigation',
      shortcut: 'g k',
      keywords: ['risk', 'analysis', 'alerts'],
      action: () => router.push('/risk'),
    },
    {
      id: 'nav-compliance',
      label: 'Go to Compliance',
      description: 'View compliance status',
      icon: Shield,
      category: 'navigation',
      shortcut: 'g o',
      keywords: ['compliance', 'legal', 'regulations'],
      action: () => router.push('/compliance'),
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
      icon: Sparkles,
      category: 'navigation',
      shortcut: 'cmd n',
      keywords: ['generate', 'create', 'new'],
      action: () => router.push('/contracts/generate'),
    },

    // Actions (contract-specific)
    ...(contractId ? [
      {
        id: 'action-ai-analyze',
        label: 'AI Analysis',
        description: 'Run AI analysis on this contract',
        icon: Brain,
        category: 'actions' as const,
        shortcut: 'cmd i',
        keywords: ['ai', 'analyze', 'analysis'],
        action: () => {
          router.push(`/contracts/${contractId}?tab=artifacts`)
        },
      },
      {
        id: 'action-comment',
        label: 'Add Comment',
        description: 'Start a discussion',
        icon: MessageSquare,
        category: 'actions' as const,
        shortcut: 'c',
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
          document.querySelector<HTMLButtonElement>('[data-share-button]')?.click()
        },
      },
      {
        id: 'action-approve',
        label: 'Request Approval',
        description: 'Submit for approval',
        icon: CheckCircle,
        category: 'actions' as const,
        shortcut: 'cmd shift a',
        keywords: ['approve', 'approval', 'submit'],
        action: () => {
          router.push(`/approvals/new?contractId=${contractId}`)
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
        id: 'action-compare',
        label: 'Compare With...',
        description: 'Compare with another contract',
        icon: GitCompare,
        category: 'actions' as const,
        shortcut: 'cmd shift p',
        keywords: ['compare', 'diff'],
        action: () => {
          router.push(`/ai/compare?contracts=${contractId}`)
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
          document.querySelector<HTMLInputElement>('[data-testid="contract-search"]')?.focus()
        }, 100)
      },
    },
    {
      id: 'search-ai',
      label: 'AI Semantic Search',
      description: 'Search using natural language',
      icon: Sparkles,
      category: 'search',
      shortcut: 'cmd shift /',
      keywords: ['ai', 'semantic', 'natural', 'language'],
      action: () => {
        router.push('/search/advanced')
      },
    },
    {
      id: 'filter-expiring',
      label: 'Show Expiring Soon',
      description: 'Filter contracts expiring in 90 days',
      icon: Clock,
      category: 'search',
      keywords: ['filter', 'expiring', 'deadline'],
      action: () => {
        router.push('/contracts?filter=expiring')
      },
    },
    {
      id: 'filter-high-risk',
      label: 'Show High Risk',
      description: 'Filter high risk contracts',
      icon: AlertTriangle,
      category: 'search',
      keywords: ['filter', 'risk', 'high'],
      action: () => {
        router.push('/contracts?risk=high')
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
        setShowShortcuts(true)
        setOpen(false)
      },
    },
    {
      id: 'help-notifications',
      label: 'Notifications',
      description: 'View notifications',
      icon: Bell,
      category: 'help',
      shortcut: 'cmd shift n',
      keywords: ['notifications', 'alerts', 'updates'],
      action: () => {
        document.querySelector<HTMLButtonElement>('[data-notification-button]')?.click()
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

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                <CommandIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-500">Navigate faster with these shortcuts</p>
              </div>
            </div>

            {/* Global */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500" />
                Global
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutRow keys={['⌘', 'K']} description="Open command palette" />
                <ShortcutRow keys={['?']} description="Show this help" />
                <ShortcutRow keys={['Esc']} description="Close modal/cancel" />
                <ShortcutRow keys={['/']} description="Focus search" />
              </div>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Navigation
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutRow keys={['g', 'd']} description="Go to Dashboard" />
                <ShortcutRow keys={['g', 'c']} description="Go to Contracts" />
                <ShortcutRow keys={['g', 'u']} description="Upload Contract" />
                <ShortcutRow keys={['g', 'a']} description="Go to Analytics" />
                <ShortcutRow keys={['g', 'w']} description="Go to Workflows" />
                <ShortcutRow keys={['g', 'r']} description="Go to Rate Cards" />
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutRow keys={['⌘', 'S']} description="Save changes" />
                <ShortcutRow keys={['⌘', 'Z']} description="Undo" />
                <ShortcutRow keys={['⌘', '⇧', 'Z']} description="Redo" />
                <ShortcutRow keys={['⌘', 'E']} description="Export document" />
                <ShortcutRow keys={['⌘', '⇧', 'S']} description="Share" />
                <ShortcutRow keys={['⌘', '↵']} description="Submit/confirm" />
              </div>
            </div>

            {/* Contract Context */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Contract Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutRow keys={['e']} description="Edit metadata" />
                <ShortcutRow keys={['r']} description="Open redline editor" />
                <ShortcutRow keys={['a']} description="View AI analysis" />
                <ShortcutRow keys={['v']} description="Compare versions" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Shortcut display row
function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
      <span className="text-sm text-gray-600">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded min-w-[24px] text-center"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
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
          ? 'bg-violet-50 border-violet-200'
          : 'hover:bg-gray-50'
      )}
    >
      <div className={cn(
        'p-2 rounded-lg',
        isSelected ? 'bg-violet-100' : 'bg-gray-100'
      )}>
        <Icon className={cn(
          'h-4 w-4',
          isSelected ? 'text-violet-600' : 'text-gray-600'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          isSelected ? 'text-violet-900' : 'text-gray-900'
        )}>
          {command.label}
        </p>
        {command.description && (
          <p className={cn(
            'text-xs truncate',
            isSelected ? 'text-violet-700' : 'text-gray-500'
          )}>
            {command.description}
          </p>
        )}
      </div>

      {command.shortcut && (
        <kbd className={cn(
          'px-2 py-1 text-xs font-mono border rounded',
          isSelected
            ? 'bg-white border-violet-300 text-violet-700'
            : 'bg-gray-100 border-gray-300 text-gray-600'
        )}>
          {command.shortcut}
        </kbd>
      )}

      {isSelected && (
        <ArrowRight className="h-4 w-4 text-violet-600" />
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

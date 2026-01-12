'use client'

/**
 * Quick Actions Component
 * 
 * Renders actionable buttons within chat messages.
 * These actions can trigger navigation, chatbot commands, or UI state changes.
 */

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Plus,
  RefreshCw,
  Eye,
  Download,
  Upload,
  GitCompare,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  Edit,
  Trash2,
  Filter,
  Search,
  ChevronRight,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  Copy,
  Share2,
  Bookmark,
  Star,
  Settings,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ============ TYPES ============

export interface QuickAction {
  id?: string
  label: string
  action: string // Action identifier like 'navigate:/contracts', 'command:show-help', 'callback:function-name'
  icon?: string
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning'
  disabled?: boolean
  tooltip?: string
}

interface QuickActionsProps {
  actions: QuickAction[]
  onAction?: (action: QuickAction) => void
  onSendMessage?: (message: string) => void
  variant?: 'inline' | 'grid' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// ============ ICON MAPPING ============

const ICON_MAP: Record<string, React.ElementType> = {
  'file': FileText,
  'plus': Plus,
  'refresh': RefreshCw,
  'view': Eye,
  'eye': Eye,
  'download': Download,
  'upload': Upload,
  'compare': GitCompare,
  'revert': RotateCcw,
  'check': Check,
  'approve': CheckCircle2,
  'reject': X,
  'cancel': X,
  'external': ExternalLink,
  'edit': Edit,
  'delete': Trash2,
  'filter': Filter,
  'search': Search,
  'next': ChevronRight,
  'play': Play,
  'pause': Pause,
  'clock': Clock,
  'warning': AlertTriangle,
  'success': CheckCircle2,
  'send': Send,
  'copy': Copy,
  'share': Share2,
  'bookmark': Bookmark,
  'star': Star,
  'settings': Settings,
  'help': HelpCircle,
}

// ============ ACTION PARSER ============

interface ParsedAction {
  type: 'navigate' | 'command' | 'callback' | 'copy' | 'external' | 'unknown'
  value: string
  params?: Record<string, string>
}

function parseAction(actionString: string): ParsedAction {
  // Format: type:value or type:value?param1=val1&param2=val2
  const [typeValue, queryString] = actionString.split('?')
  const [type, ...valueParts] = typeValue.split(':')
  const value = valueParts.join(':') // Rejoin in case value has colons
  
  // Parse query params if present
  let params: Record<string, string> | undefined
  if (queryString) {
    params = {}
    queryString.split('&').forEach(pair => {
      const [key, val] = pair.split('=')
      if (key && val) {
        params![key] = decodeURIComponent(val)
      }
    })
  }
  
  const knownTypes = ['navigate', 'command', 'callback', 'copy', 'external']
  const parsedType = knownTypes.includes(type) ? type : 'unknown'
  
  return {
    type: parsedType as ParsedAction['type'],
    value: value || actionString,
    params,
  }
}

// ============ VARIANT STYLES ============

const getButtonVariant = (variant: QuickAction['variant']) => {
  switch (variant) {
    case 'success':
      return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'warning':
      return 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
    case 'destructive':
      return 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
    default:
      return undefined
  }
}

// ============ MAIN COMPONENT ============

export const QuickActions = memo(({
  actions,
  onAction,
  onSendMessage,
  variant = 'inline',
  size = 'sm',
  className,
}: QuickActionsProps) => {
  const router = useRouter()

  const handleAction = async (action: QuickAction) => {
    const parsed = parseAction(action.action)
    
    switch (parsed.type) {
      case 'navigate':
        // Navigate to a page
        router.push(parsed.value)
        break
        
      case 'command':
        // Send as a chatbot command
        if (onSendMessage) {
          onSendMessage(parsed.value)
        }
        break
        
      case 'callback':
        // Call the custom callback
        if (onAction) {
          onAction(action)
        }
        break
        
      case 'copy':
        // Copy text to clipboard
        await navigator.clipboard.writeText(parsed.value)
        toast.success('Copied to clipboard')
        break
        
      case 'external':
        // Open external URL
        window.open(parsed.value, '_blank', 'noopener,noreferrer')
        break
        
      default:
        // Default: try callback, then send as message
        if (onAction) {
          onAction(action)
        } else if (onSendMessage) {
          onSendMessage(action.label)
        }
    }
  }
  
  const getIcon = (iconName?: string) => {
    if (!iconName) return null
    // Remove emoji if present
    const cleanName = iconName.replace(/[^\w-]/g, '').toLowerCase()
    const IconComponent = ICON_MAP[cleanName]
    return IconComponent ? <IconComponent className="h-3.5 w-3.5 mr-1.5" /> : null
  }
  
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2.5',
  }
  
  const containerClasses = {
    inline: 'flex flex-wrap gap-2',
    grid: 'grid grid-cols-2 gap-2',
    vertical: 'flex flex-col gap-2',
  }
  
  if (!actions || actions.length === 0) return null
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mt-3 pt-3 border-t border-slate-100",
        containerClasses[variant],
        className
      )}
    >
      {actions.map((action, index) => {
        const customVariant = getButtonVariant(action.variant)
        
        return (
          <motion.button
            key={action.id || index}
            onClick={() => handleAction(action)}
            disabled={action.disabled}
            className={cn(
              "inline-flex items-center justify-center rounded-md border font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              sizeClasses[size],
              customVariant || "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title={action.tooltip}
          >
            {getIcon(action.icon)}
            <span>{action.label}</span>
          </motion.button>
        )
      })}
    </motion.div>
  )
})

QuickActions.displayName = 'QuickActions'

// ============ PRESET ACTION GENERATORS ============

export const presetActions = {
  // Contract actions
  viewContract: (id: string, name?: string): QuickAction => ({
    label: name ? `View ${name}` : 'View Contract',
    action: `navigate:/contracts/${id}`,
    icon: 'view',
  }),
  
  editContract: (id: string): QuickAction => ({
    label: 'Edit',
    action: `navigate:/contracts/${id}/edit`,
    icon: 'edit',
  }),
  
  compareContracts: (idA: string, idB: string): QuickAction => ({
    label: 'Compare',
    action: `navigate:/contracts/compare?a=${idA}&b=${idB}`,
    icon: 'compare',
  }),
  
  // Version actions
  showVersionHistory: (): QuickAction => ({
    label: 'Show Version History',
    action: 'command:show version history',
    icon: 'clock',
  }),
  
  compareVersions: (contractId: string, v1: number, v2: number): QuickAction => ({
    label: `Compare v${v1} vs v${v2}`,
    action: `navigate:/contracts/${contractId}/versions/compare?v1=${v1}&v2=${v2}`,
    icon: 'compare',
  }),
  
  createSnapshot: (): QuickAction => ({
    label: 'Create Snapshot',
    action: 'command:create a version snapshot',
    icon: 'plus',
  }),
  
  // Workflow actions
  startApproval: (): QuickAction => ({
    label: 'Start Approval',
    action: 'command:start approval workflow',
    icon: 'play',
  }),
  
  approve: (): QuickAction => ({
    label: 'Approve',
    action: 'command:approve this',
    icon: 'approve',
    variant: 'success',
  }),
  
  reject: (reason?: string): QuickAction => ({
    label: 'Reject',
    action: reason ? `command:reject because ${reason}` : 'command:reject this',
    icon: 'reject',
    variant: 'destructive',
  }),
  
  // Repository actions
  showExpired: (): QuickAction => ({
    label: 'Show Expired',
    action: 'command:show expired contracts',
    icon: 'warning',
  }),
  
  showExpiring: (): QuickAction => ({
    label: 'Expiring Soon',
    action: 'command:show expiring contracts',
    icon: 'clock',
  }),
  
  filterByStatus: (status: string): QuickAction => ({
    label: `Show ${status}`,
    action: `command:show ${status} contracts`,
    icon: 'filter',
  }),
  
  // Navigation actions
  goToRepository: (): QuickAction => ({
    label: 'Go to Repository',
    action: 'navigate:/contracts',
    icon: 'file',
  }),
  
  goToAnalytics: (): QuickAction => ({
    label: 'View Analytics',
    action: 'navigate:/analytics',
    icon: 'external',
  }),
  
  // Help actions
  showHelp: (): QuickAction => ({
    label: 'Help',
    action: 'command:help',
    icon: 'help',
  }),
  
  showCommands: (): QuickAction => ({
    label: 'List Commands',
    action: 'command:list all commands',
    icon: 'help',
  }),
}

export default QuickActions

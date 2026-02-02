'use client'

import React, { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Download,
  FileSignature,
  Share2,
  MoreHorizontal,
  Sparkles,
  RefreshCw,
  Edit3,
  Copy,
  Trash2,
  Archive,
  Star,
  StarOff,
  Send,
  Printer,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  FileText,
  Workflow,
  Link,
  Lock,
  Unlock,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface QuickAction {
  id: string
  label: string
  icon: React.ElementType
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  badge?: string
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'warning'
  tooltip?: string
  shortcut?: string
  disabled?: boolean
  loading?: boolean
  hidden?: boolean
  onClick: () => void
}

interface ContractQuickActionsBarProps {
  contractId: string
  contractStatus: 'draft' | 'active' | 'expired' | 'terminated' | 'pending_review'
  signatureStatus: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  isFavorite?: boolean
  isLocked?: boolean
  hasUnsavedChanges?: boolean
  isProcessing?: boolean
  processingLabel?: string
  onDownload?: () => void
  onShare?: () => void
  onEdit?: () => void
  onAIExtract?: () => void
  onRequestSignature?: () => void
  onDuplicate?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onToggleFavorite?: () => void
  onToggleLock?: () => void
  onPrint?: () => void
  onEmail?: () => void
  onAddNote?: () => void
  onCreateTask?: () => void
  onCopyLink?: () => void
  onViewVersions?: () => void
  onExportPDF?: () => void
  onExportWord?: () => void
  onStartWorkflow?: () => void
  className?: string
}

export const ContractQuickActionsBar = memo(function ContractQuickActionsBar({
  contractId,
  contractStatus,
  signatureStatus,
  isFavorite = false,
  isLocked = false,
  hasUnsavedChanges = false,
  isProcessing = false,
  processingLabel,
  onDownload,
  onShare,
  onEdit,
  onAIExtract,
  onRequestSignature,
  onDuplicate,
  onArchive,
  onDelete,
  onToggleFavorite,
  onToggleLock,
  onPrint,
  onEmail,
  onAddNote,
  onCreateTask,
  onCopyLink,
  onViewVersions,
  onExportPDF,
  onExportWord,
  onStartWorkflow,
  className,
}: ContractQuickActionsBarProps) {
  
  // Primary actions (always visible)
  const primaryActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = []
    
    // Edit (if contract is editable)
    if (onEdit && contractStatus !== 'terminated') {
      actions.push({
        id: 'edit',
        label: 'Edit',
        icon: Edit3,
        variant: 'outline',
        tooltip: 'Edit contract details',
        shortcut: 'E',
        disabled: isLocked,
        onClick: onEdit,
      })
    }
    
    // AI Extract
    if (onAIExtract) {
      actions.push({
        id: 'ai-extract',
        label: 'AI Extract',
        icon: Sparkles,
        variant: 'default',
        tooltip: 'Run AI extraction',
        badge: 'AI',
        badgeVariant: 'secondary',
        onClick: onAIExtract,
      })
    }
    
    // Request Signature (if unsigned)
    if (onRequestSignature && signatureStatus !== 'signed') {
      actions.push({
        id: 'request-signature',
        label: signatureStatus === 'partially_signed' ? 'Complete Signing' : 'Request Signature',
        icon: FileSignature,
        variant: signatureStatus === 'unsigned' ? 'default' : 'outline',
        tooltip: 'Request e-signature',
        badge: signatureStatus === 'unsigned' ? 'Required' : undefined,
        badgeVariant: 'warning',
        onClick: onRequestSignature,
      })
    }
    
    // Download
    if (onDownload) {
      actions.push({
        id: 'download',
        label: 'Download',
        icon: Download,
        variant: 'outline',
        tooltip: 'Download original file',
        shortcut: 'D',
        onClick: onDownload,
      })
    }
    
    // Share
    if (onShare) {
      actions.push({
        id: 'share',
        label: 'Share',
        icon: Share2,
        variant: 'outline',
        tooltip: 'Share contract',
        onClick: onShare,
      })
    }
    
    return actions
  }, [contractStatus, signatureStatus, isLocked, onEdit, onAIExtract, onRequestSignature, onDownload, onShare])
  
  // Copy link handler
  const handleCopyLink = () => {
    if (onCopyLink) {
      onCopyLink()
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/contracts/${contractId}`)
      toast.success('Link copied to clipboard')
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-2 p-3 sm:p-4 bg-white border-b border-slate-200",
      "sticky top-0 z-20",
      className
    )}>
      {/* Processing indicator */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200"
          >
            <RefreshCw className="h-3.5 w-3.5 text-violet-600 animate-spin" />
            <span className="text-xs font-medium text-violet-700">
              {processingLabel || 'Processing...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Unsaved changes indicator */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 border border-amber-200"
          >
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-medium text-amber-700">Unsaved</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Locked indicator */}
      {isLocked && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                <Lock className="h-3 w-3 text-slate-500" />
                <span className="text-[10px] font-medium text-slate-600">Locked</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>This contract is locked for editing</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Primary action buttons */}
      <div className="flex items-center gap-2">
        {primaryActions.map((action) => {
          if (action.hidden) return null
          
          const ActionIcon = action.icon
          
          return (
            <TooltipProvider key={action.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={action.variant || 'outline'}
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    className={cn(
                      "text-xs gap-1.5 hidden sm:flex",
                      action.variant === 'default' && "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0"
                    )}
                  >
                    {action.loading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ActionIcon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden md:inline">{action.label}</span>
                    {action.badge && (
                      <Badge 
                        variant={action.badgeVariant === 'warning' ? 'outline' : 'secondary'}
                        className={cn(
                          "text-[9px] px-1 py-0",
                          action.badgeVariant === 'warning' && "border-amber-300 text-amber-700 bg-amber-50"
                        )}
                      >
                        {action.badge}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.tooltip || action.label}</p>
                  {action.shortcut && (
                    <p className="text-xs text-slate-400 mt-1">
                      Press <kbd className="px-1 py-0.5 rounded bg-slate-100">{action.shortcut}</kbd>
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
        
        {/* Favorite toggle */}
        {onToggleFavorite && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggleFavorite}
                  className={cn(
                    "h-8 w-8 p-0",
                    isFavorite && "text-amber-500 hover:text-amber-600"
                  )}
                >
                  {isFavorite ? (
                    <Star className="h-4 w-4 fill-current" />
                  ) : (
                    <StarOff className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Contract Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Quick actions */}
            <DropdownMenuItem onClick={handleCopyLink}>
              <Link className="h-4 w-4 mr-2" />
              Copy Link
            </DropdownMenuItem>
            
            {onAddNote && (
              <DropdownMenuItem onClick={onAddNote}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </DropdownMenuItem>
            )}
            
            {onCreateTask && (
              <DropdownMenuItem onClick={onCreateTask}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Task
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            {/* Export submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FileText className="h-4 w-4 mr-2" />
                Export As
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {onExportPDF && (
                  <DropdownMenuItem onClick={onExportPDF}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                )}
                {onExportWord && (
                  <DropdownMenuItem onClick={onExportWord}>
                    <FileText className="h-4 w-4 mr-2" />
                    Word Document
                  </DropdownMenuItem>
                )}
                {onPrint && (
                  <DropdownMenuItem onClick={onPrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            {/* Send submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Send className="h-4 w-4 mr-2" />
                Send
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {onEmail && (
                  <DropdownMenuItem onClick={onEmail}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem onClick={onShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Link
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            
            <DropdownMenuSeparator />
            
            {/* Workflow & Versions */}
            {onStartWorkflow && (
              <DropdownMenuItem onClick={onStartWorkflow}>
                <Workflow className="h-4 w-4 mr-2" />
                Start Workflow
              </DropdownMenuItem>
            )}
            
            {onViewVersions && (
              <DropdownMenuItem onClick={onViewVersions}>
                <Clock className="h-4 w-4 mr-2" />
                Version History
              </DropdownMenuItem>
            )}
            
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
            )}
            
            {onToggleLock && (
              <DropdownMenuItem onClick={onToggleLock}>
                {isLocked ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Unlock Contract
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Lock Contract
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            {/* Danger zone */}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            )}
            
            {onDelete && (
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

export default ContractQuickActionsBar

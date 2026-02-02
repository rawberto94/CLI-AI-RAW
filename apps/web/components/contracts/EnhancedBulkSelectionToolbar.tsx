'use client'

import React, { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  X,
  CheckCircle2,
  Download,
  Trash2,
  Archive,
  Folder,
  Share2,
  FileSignature,
  AlertTriangle,
  MoreHorizontal,
  ChevronDown,
  Calendar,
  RefreshCw,
  Sparkles,
  Star,
  StarOff,
  Lock,
  Unlock,
  GitBranch,
  FileText,
  Copy,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface _BulkAction {
  id: string
  label: string
  icon: React.ElementType
  variant?: 'default' | 'destructive' | 'secondary'
  requiresConfirmation?: boolean
  confirmationTitle?: string
  confirmationDescription?: string
  disabled?: boolean
  tooltip?: string
}

interface Category {
  id: string
  name: string
  color?: string
}

interface EnhancedBulkSelectionToolbarProps {
  selectedCount: number
  totalCount: number
  selectedIds: string[]
  onClearSelection: () => void
  onSelectAll?: () => void
  categories?: Category[]
  // Action handlers
  onBulkDownload?: () => void
  onBulkDelete?: () => void
  onBulkArchive?: () => void
  onBulkExport?: (format: 'pdf' | 'csv' | 'excel') => void
  onBulkTag?: (tags: string[]) => void
  onBulkCategorize?: (categoryId: string) => void
  onBulkShare?: () => void
  onBulkRequestSignature?: () => void
  onBulkSetReminder?: () => void
  onBulkAssign?: (userId: string) => void
  onBulkFavorite?: () => void
  onBulkUnfavorite?: () => void
  onBulkLock?: () => void
  onBulkUnlock?: () => void
  onBulkAIAnalyze?: () => void
  onBulkCompare?: () => void
  onBulkDuplicate?: () => void
  isProcessing?: boolean
  processingAction?: string
  className?: string
}

export const EnhancedBulkSelectionToolbar = memo(function EnhancedBulkSelectionToolbar({
  selectedCount,
  totalCount,
  selectedIds: _selectedIds,
  onClearSelection,
  onSelectAll,
  categories = [],
  onBulkDownload,
  onBulkDelete,
  onBulkArchive,
  onBulkExport,
  onBulkTag: _onBulkTag,
  onBulkCategorize,
  onBulkShare,
  onBulkRequestSignature,
  onBulkSetReminder,
  onBulkAssign: _onBulkAssign,
  onBulkFavorite,
  onBulkUnfavorite,
  onBulkLock,
  onBulkUnlock,
  onBulkAIAnalyze,
  onBulkCompare,
  onBulkDuplicate,
  isProcessing = false,
  processingAction,
  className,
}: EnhancedBulkSelectionToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  
  const _allSelected = selectedCount === totalCount && totalCount > 0
  const someSelected = selectedCount > 0 && selectedCount < totalCount

  if (selectedCount === 0) return null

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "sticky top-0 z-30 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600",
            "shadow-lg shadow-violet-500/20 rounded-lg mx-4 mb-4",
            className
          )}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            {/* Selection info */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
                className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {selectedCount} selected
                  </span>
                </div>
                
                {someSelected && onSelectAll && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onSelectAll}
                    className="text-xs text-white/70 hover:text-white hover:bg-white/10 h-7 px-2"
                  >
                    Select all {totalCount}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10">
                <RefreshCw className="h-3.5 w-3.5 text-white animate-spin" />
                <span className="text-xs text-white/90">
                  {processingAction || 'Processing...'}
                </span>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Primary Actions */}
              <TooltipProvider>
                {/* Download */}
                {onBulkDownload && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onBulkDownload}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download selected</TooltipContent>
                  </Tooltip>
                )}
                
                {/* Share */}
                {onBulkShare && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onBulkShare}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share selected</TooltipContent>
                  </Tooltip>
                )}
                
                {/* AI Analyze */}
                {onBulkAIAnalyze && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onBulkAIAnalyze}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI analyze selected</TooltipContent>
                  </Tooltip>
                )}
                
                {/* Compare */}
                {onBulkCompare && selectedCount >= 2 && selectedCount <= 4 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onBulkCompare}
                        disabled={isProcessing}
                        className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                      >
                        <GitBranch className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compare selected ({selectedCount})</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
              
              {/* Divider */}
              <div className="w-px h-5 bg-white/20 mx-1" />
              
              {/* Category dropdown */}
              {onBulkCategorize && categories.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isProcessing}
                      className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10 text-xs"
                    >
                      <Folder className="h-3.5 w-3.5 mr-1" />
                      Categorize
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Move to category</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {categories.map(cat => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => onBulkCategorize(cat.id)}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: cat.color || '#6366f1' }}
                        />
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* Export dropdown */}
              {onBulkExport && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isProcessing}
                      className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10 text-xs"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Export
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onBulkExport('pdf')}>
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBulkExport('csv')}>
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onBulkExport('excel')}>
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              
              {/* More actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isProcessing}
                    className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {onBulkRequestSignature && (
                    <DropdownMenuItem onClick={onBulkRequestSignature}>
                      <FileSignature className="h-4 w-4 mr-2" />
                      Request Signatures
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkSetReminder && (
                    <DropdownMenuItem onClick={onBulkSetReminder}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Set Reminders
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkDuplicate && (
                    <DropdownMenuItem onClick={onBulkDuplicate}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {onBulkFavorite && (
                    <DropdownMenuItem onClick={onBulkFavorite}>
                      <Star className="h-4 w-4 mr-2" />
                      Add to Favorites
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkUnfavorite && (
                    <DropdownMenuItem onClick={onBulkUnfavorite}>
                      <StarOff className="h-4 w-4 mr-2" />
                      Remove from Favorites
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkLock && (
                    <DropdownMenuItem onClick={onBulkLock}>
                      <Lock className="h-4 w-4 mr-2" />
                      Lock Contracts
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkUnlock && (
                    <DropdownMenuItem onClick={onBulkUnlock}>
                      <Unlock className="h-4 w-4 mr-2" />
                      Unlock Contracts
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {onBulkArchive && (
                    <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  )}
                  
                  {onBulkDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
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
        </motion.div>
      </AnimatePresence>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {selectedCount} contracts?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected contracts and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkDelete?.()
                setShowDeleteDialog(false)
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-500" />
              Archive {selectedCount} contracts?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived contracts will be hidden from the main view but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkArchive?.()
                setShowArchiveDialog(false)
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

export default EnhancedBulkSelectionToolbar

'use client'

import React, { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import {
  Star,
  Bell,
  BellOff,
  Printer,
  Link2,
  Trash2,
  MoreHorizontal,
  FileDown,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  Archive,
  ArchiveRestore,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface ContractFloatingActionsProps {
  contractId: string
  filename: string
  isFavorite?: boolean
  hasReminder?: boolean
  isArchived?: boolean
  isExpired?: boolean
  onToggleFavorite: () => Promise<void>
  onToggleReminder: () => Promise<void>
  onDelete: () => Promise<void>
  onArchive: () => Promise<void>
  onExport: (format: 'pdf' | 'docx' | 'xlsx' | 'json') => Promise<void>
  onPrint: () => void
  onCreateRenewal?: () => void
}

export const ContractFloatingActions = memo(function ContractFloatingActions({
  contractId,
  filename,
  isFavorite = false,
  hasReminder = false,
  isArchived = false,
  isExpired = false,
  onToggleFavorite,
  onToggleReminder,
  onDelete,
  onArchive,
  onExport,
  onPrint,
  onCreateRenewal,
}: ContractFloatingActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isFavoriting, setIsFavoriting] = useState(false)
  const [isTogglingReminder, setIsTogglingReminder] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [justCopied, setJustCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/contracts/${contractId}`
      await navigator.clipboard.writeText(url)
      setJustCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setJustCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleToggleFavorite = async () => {
    setIsFavoriting(true)
    try {
      await onToggleFavorite()
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites')
    } catch {
      toast.error('Failed to update favorite')
    } finally {
      setIsFavoriting(false)
    }
  }

  const handleToggleReminder = async () => {
    setIsTogglingReminder(true)
    try {
      await onToggleReminder()
      toast.success(hasReminder ? 'Reminder disabled' : 'Reminder enabled')
    } catch {
      toast.error('Failed to update reminder')
    } finally {
      setIsTogglingReminder(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx' | 'xlsx' | 'json') => {
    setExportingFormat(format)
    try {
      await onExport(format)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`)
    } finally {
      setExportingFormat(null)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
      toast.success('Contract deleted')
    } catch {
      toast.error('Failed to delete contract')
      setIsDeleting(false)
    }
  }

  const handleArchive = async () => {
    setIsArchiving(true)
    try {
      await onArchive()
      toast.success(isArchived ? 'Contract restored' : 'Contract archived')
      setShowArchiveDialog(false)
    } catch {
      toast.error('Failed to update archive status')
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-full shadow-lg px-2 py-1.5">
          <TooltipProvider delayDuration={300}>
            {/* Favorite */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFavorite}
                  disabled={isFavoriting}
                  className={cn(
                    "h-9 w-9 rounded-full transition-colors",
                    isFavorite && "text-yellow-500 hover:text-yellow-600"
                  )}
                >
                  {isFavoriting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</TooltipContent>
            </Tooltip>

            {/* Reminder */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleReminder}
                  disabled={isTogglingReminder}
                  className={cn(
                    "h-9 w-9 rounded-full transition-colors",
                    hasReminder && "text-blue-500 hover:text-blue-600"
                  )}
                >
                  {isTogglingReminder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : hasReminder ? (
                    <BellOff className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hasReminder ? 'Disable reminder' : 'Set expiry reminder'}</TooltipContent>
            </Tooltip>

            {/* Copy Link */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="h-9 w-9 rounded-full transition-colors"
                >
                  <AnimatePresence mode="wait">
                    {justCopied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="link"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Link2 className="h-4 w-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy link</TooltipContent>
            </Tooltip>

            {/* Print */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrint}
                  className="h-9 w-9 rounded-full transition-colors"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print</TooltipContent>
            </Tooltip>

            {/* Create Renewal - show for expired or expiring contracts */}
            {(isExpired || onCreateRenewal) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCreateRenewal}
                    className={cn(
                      "h-9 w-9 rounded-full transition-colors",
                      isExpired && "text-amber-500 hover:text-amber-600"
                    )}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create Renewal</TooltipContent>
              </Tooltip>
            )}

            <div className="w-px h-6 bg-slate-200" />

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full transition-colors"
                  disabled={!!exportingFormat}
                >
                  {exportingFormat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-red-500" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('docx')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  Export as Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('xlsx')} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-slate-500" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem 
                  onClick={() => window.open(`/contracts/${contractId}`, '_blank')}
                  className="cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigator.clipboard.writeText(contractId)}
                  className="cursor-pointer"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy contract ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowArchiveDialog(true)}
                  className="cursor-pointer"
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Restore from archive
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive contract
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete contract
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Contract</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete <span className="font-medium text-slate-900">&ldquo;{filename}&rdquo;</span>? 
              This action cannot be undone and will permanently remove all associated data, including:
              <ul className="mt-2 ml-4 list-disc text-sm">
                <li>Contract metadata and extracted data</li>
                <li>AI analysis and insights</li>
                <li>Version history</li>
                <li>Audit logs</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? 'Restore Contract' : 'Archive Contract'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived ? (
                <>
                  Restore <span className="font-medium text-slate-900">&ldquo;{filename}&rdquo;</span> from the archive? 
                  It will be visible in your contracts list again.
                </>
              ) : (
                <>
                  Archive <span className="font-medium text-slate-900">&ldquo;{filename}&rdquo;</span>? 
                  Archived contracts are hidden from the main list but can be restored later.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isArchived ? 'Restoring...' : 'Archiving...'}
                </>
              ) : (
                <>
                  {isArchived ? (
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                  ) : (
                    <Archive className="h-4 w-4 mr-2" />
                  )}
                  {isArchived ? 'Restore' : 'Archive'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

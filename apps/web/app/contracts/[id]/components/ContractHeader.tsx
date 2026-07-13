'use client'

import React, { memo, useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator'
import { CopyableId } from '@/components/contracts/detail/CopyableId'
import { StatusBadge } from '@/components/contracts/detail/StatusBadge'
import { cn } from '@/lib/utils'
import { useDemoMode } from '@/hooks/useDemoMode'
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  FileType,
  Pencil,
  Sparkles,
  Download,
  Share2,
  GitCompare,
  ChevronDown,
  GitBranch,
  RefreshCcw,
  Scale,
  Target,
  Edit3,
  ClipboardList,
  Loader2,
  CalendarPlus,
  FileDown,
  AlertTriangle,
  Clock,
  PenLine,
  ShieldAlert,
} from 'lucide-react'

interface ContractHeaderProps {
  contractId: string
  filename: string
  displayTitle?: string
  originalName?: string
  status: string
  signatureStatus?: string | null
  signatureRequiredFlag?: boolean | null
  riskLevel?: string | null
  endDate?: string | null
  failedArtifactTypes?: string[]
  currentVersion?: number
  showPdfViewer: boolean
  isEditing: boolean
  isExtractingAI: boolean
  isExtractingObligations?: boolean
  isExpiredOrExpiring?: boolean
  onRefresh: () => void
  onTogglePdf: () => void
  onEdit: () => void
  onAIExtract: () => void
  onExtractObligations?: () => void
  onDownload: () => void
  onDownloadReport: () => void
  isDownloadingReport?: boolean
  onShare: () => void
  onCompare: () => void
  onCreateRenewal?: () => void
  onExtendContract?: () => void
  onRename?: (newTitle: string) => void
}

export const ContractHeader = memo(function ContractHeader({
  contractId,
  filename,
  displayTitle,
  originalName,
  status,
  signatureStatus,
  signatureRequiredFlag,
  riskLevel,
  endDate,
  failedArtifactTypes = [],
  currentVersion,
  showPdfViewer,
  isEditing,
  isExtractingAI,
  isExtractingObligations = false,
  isExpiredOrExpiring = false,
  onRefresh,
  onTogglePdf,
  onEdit,
  onAIExtract,
  onExtractObligations,
  onDownload,
  onDownloadReport,
  isDownloadingReport = false,
  onShare,
  onCompare,
  onCreateRenewal,
  onExtendContract,
  onRename,
}: ContractHeaderProps) {
  const isDemo = useDemoMode()
  const heading = displayTitle || filename || 'Contract Details'
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(heading || '')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== heading && onRename) {
      onRename(trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, heading, onRename])

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') {
      setRenameValue(heading || '')
      setIsRenaming(false)
    }
  }, [handleRenameSubmit, heading])

  const headerWarnings = React.useMemo(() => {
    const warnings: Array<{
      key: string
      label: string
      detail: string
      className: string
      Icon: React.ElementType
    }> = []

    const normalizedSignature = signatureStatus?.toLowerCase()
    if (normalizedSignature === 'partially_signed') {
      warnings.push({
        key: 'signature-partial',
        label: 'Partially signed',
        detail: 'Some parties have not signed yet.',
        className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        Icon: PenLine,
      })
    } else if (normalizedSignature === 'unsigned' || (signatureRequiredFlag && normalizedSignature !== 'signed')) {
      warnings.push({
        key: 'signature-missing',
        label: 'Signature needed',
        detail: 'This contract still needs execution or a signed copy.',
        className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-200',
        Icon: PenLine,
      })
    }

    if (endDate) {
      const daysRemaining = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)
      if (Number.isFinite(daysRemaining) && daysRemaining < 0) {
        warnings.push({
          key: 'renewal-overdue',
          label: 'Expired',
          detail: `Ended ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago.`,
          className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200',
          Icon: AlertTriangle,
        })
      } else if (Number.isFinite(daysRemaining) && daysRemaining <= 90) {
        warnings.push({
          key: 'renewal-window',
          label: `${daysRemaining}d to renewal`,
          detail: 'Renewal or expiry is inside the 90-day review window.',
          className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
          Icon: Clock,
        })
      }
    }

    if (riskLevel === 'high') {
      warnings.push({
        key: 'risk-high',
        label: 'High risk',
        detail: 'High-risk terms or compliance issues were detected.',
        className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
        Icon: ShieldAlert,
      })
    }

    if (failedArtifactTypes.length > 0) {
      warnings.push({
        key: 'partial-analysis',
        label: 'Partial analysis',
        detail: `${failedArtifactTypes.length} analysis section${failedArtifactTypes.length === 1 ? '' : 's'} need regeneration.`,
        className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        Icon: AlertTriangle,
      })
    }

    return warnings.slice(0, 4)
  }, [endDate, failedArtifactTypes.length, riskLevel, signatureRequiredFlag, signatureStatus])
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-40 shadow-sm dark:shadow-slate-900/50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="sm" 
              asChild 
              className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
            >
              <Link href="/contracts">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Contracts</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative group shrink-0">
                <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-lg shadow-violet-500/25 transition-transform group-hover:scale-105">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-sm" />
                </div>
              </div>
              <div className="min-w-0">
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={handleRenameKeyDown}
                    className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-violet-300 rounded-md px-2 py-0.5 w-full max-w-[250px] lg:max-w-[350px] outline-none focus:ring-2 focus:ring-violet-400"
                  />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h1
                          className="text-sm sm:text-base font-semibold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 dark:from-slate-100 dark:via-slate-300 dark:to-slate-400 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-[250px] lg:max-w-[350px] cursor-pointer hover:opacity-80 transition-opacity"
                          onDoubleClick={() => {
                            if (onRename) {
                              setRenameValue(heading || '')
                              setIsRenaming(true)
                            }
                          }}
                        >
                          {heading}
                        </h1>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{heading}</p>
                        {filename && filename !== heading && (
                          <p className="text-xs text-slate-400 mt-0.5">File: {filename}</p>
                        )}
                        {originalName && originalName !== filename && (
                          <p className="text-xs text-slate-400 mt-0.5">Original: {originalName}</p>
                        )}
                        {onRename && <p className="text-xs text-slate-400 mt-0.5">Double-click to rename</p>}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <CopyableId id={contractId} />
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <StatusBadge status={status || 'unknown'} />
                  {currentVersion !== undefined && currentVersion > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                              <GitBranch className="h-3 w-3" />
                              v{currentVersion}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Current Version</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  {headerWarnings.length > 0 && (
                    <TooltipProvider>
                      <div className="hidden md:flex items-center gap-1.5 min-w-0">
                        {headerWarnings.map(({ key, label, detail, className, Icon }) => (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <span className={cn('inline-flex max-w-[150px] items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none', className)}>
                                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{label}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">{detail}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <PresenceIndicator maxAvatars={2} showConnectionStatus={false} />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onRefresh} 
                    className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label="Refresh contract data"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh (Ctrl+R)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  aria-label="Contract actions menu"
                >
                  <span className="hidden sm:inline">Actions</span>
                  <ChevronDown className="h-4 w-4 sm:ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800">
                <DropdownMenuItem onClick={onDownloadReport} disabled={isDownloadingReport} className="cursor-pointer font-medium">
                  {isDownloadingReport ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {isDownloadingReport ? 'Generating...' : 'Download Report'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onTogglePdf} className="cursor-pointer">
                  <FileType className="h-4 w-4 mr-2" />
                  {showPdfViewer ? 'Hide PDF' : 'View PDF'}
                  <span className="ml-auto text-xs text-slate-400">P</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit} disabled={isEditing} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Metadata
                  <span className="ml-auto text-xs text-slate-400">E</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDownload} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                  <span className="ml-auto text-xs text-slate-400">⌘D</span>
                </DropdownMenuItem>
                {!isDemo && (
                  <DropdownMenuItem onClick={onShare} className="cursor-pointer">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                )}
                {!isDemo && (
                  <DropdownMenuItem onClick={onCompare} className="cursor-pointer">
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare Versions
                  </DropdownMenuItem>
                )}
                {onCreateRenewal && !isDemo && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onCreateRenewal} 
                      className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400 focus:bg-amber-50 dark:focus:bg-amber-900/30"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      {isExpiredOrExpiring ? 'Initiate Renewal' : 'Create Renewal'}
                    </DropdownMenuItem>
                    {!isDemo && (
                      <DropdownMenuItem
                        onClick={onExtendContract}
                        className="cursor-pointer text-blue-600 dark:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-blue-50 dark:focus:bg-blue-900/30"
                      >
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        Extend Contract
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30">
                  ✨ AI Features
                </div>
                <DropdownMenuItem onClick={onAIExtract} disabled={isExtractingAI} className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                  <Sparkles className="h-4 w-4 mr-2 text-violet-600" />
                  {isExtractingAI ? 'Extracting...' : 'AI Extract'}
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                </DropdownMenuItem>
                {onExtractObligations && (
                  <DropdownMenuItem onClick={onExtractObligations} disabled={isExtractingObligations} className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                    <ClipboardList className="h-4 w-4 mr-2 text-violet-600" />
                    {isExtractingObligations ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      'Extract Obligations'
                    )}
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                  </DropdownMenuItem>
                )}
                {!isDemo && (
                  <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                    <Link href={`/contracts/${contractId}/legal-review`}>
                      <Scale className="h-4 w-4 mr-2 text-violet-600" />
                      Legal Review
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {!isDemo && (
                  <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                    <Link href={`/contracts/${contractId}/redline`}>
                      <Edit3 className="h-4 w-4 mr-2 text-violet-600" />
                      Redline Editor
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                  <Link href={`/obligations?contract=${contractId}`}>
                    <Target className="h-4 w-4 mr-2 text-violet-600" />
                    Track Obligations
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
})

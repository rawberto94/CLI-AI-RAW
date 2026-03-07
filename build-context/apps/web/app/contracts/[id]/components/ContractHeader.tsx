'use client'

import React, { memo } from 'react'
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
} from 'lucide-react'

interface ContractHeaderProps {
  contractId: string
  filename: string
  status: string
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
  onShare: () => void
  onCompare: () => void
  onCreateRenewal?: () => void
}

export const ContractHeader = memo(function ContractHeader({
  contractId,
  filename,
  status,
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
  onShare,
  onCompare,
  onCreateRenewal,
}: ContractHeaderProps) {
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-40 shadow-sm dark:shadow-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <h1 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 dark:from-slate-100 dark:via-slate-300 dark:to-slate-400 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-[250px] lg:max-w-[350px]">
                  {filename || 'Contract Details'}
                </h1>
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
                >
                  <span className="hidden sm:inline">Actions</span>
                  <ChevronDown className="h-4 w-4 sm:ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800">
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
                <DropdownMenuItem onClick={onAIExtract} disabled={isExtractingAI} className="cursor-pointer">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isExtractingAI ? 'Extracting...' : 'AI Extract'}
                </DropdownMenuItem>
                {onExtractObligations && (
                  <DropdownMenuItem onClick={onExtractObligations} disabled={isExtractingObligations} className="cursor-pointer">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    {isExtractingObligations ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Extracting Obligations...
                      </>
                    ) : (
                      'Extract Obligations'
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDownload} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                  <span className="ml-auto text-xs text-slate-400">⌘D</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onShare} className="cursor-pointer">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCompare} className="cursor-pointer">
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare Versions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-950/30">
                  ✨ Premium AI Features
                </div>
                <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                  <Link href={`/contracts/${contractId}/legal-review`}>
                    <Scale className="h-4 w-4 mr-2 text-violet-600" />
                    Legal Review & Redlining
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                  <Link href={`/contracts/${contractId}/redline`}>
                    <Edit3 className="h-4 w-4 mr-2 text-violet-600" />
                    Redline Editor
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/30 dark:to-pink-950/30 text-violet-700 dark:text-violet-300 focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/40 dark:focus:to-pink-900/40">
                  <Link href={`/obligations?contract=${contractId}`}>
                    <Target className="h-4 w-4 mr-2 text-violet-600" />
                    Track Obligations
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-600 text-white rounded font-medium">AI</span>
                  </Link>
                </DropdownMenuItem>
                {onCreateRenewal && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onCreateRenewal} 
                      className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400 focus:bg-amber-50 dark:focus:bg-amber-900/30"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      {isExpiredOrExpiring ? 'Initiate Renewal' : 'Create Renewal'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
})

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
} from 'lucide-react'

interface ContractHeaderProps {
  contractId: string
  filename: string
  status: string
  showPdfViewer: boolean
  isEditing: boolean
  isExtractingAI: boolean
  onRefresh: () => void
  onTogglePdf: () => void
  onEdit: () => void
  onAIExtract: () => void
  onDownload: () => void
  onShare: () => void
  onCompare: () => void
}

export const ContractHeader = memo(function ContractHeader({
  contractId,
  filename,
  status,
  showPdfViewer,
  isEditing,
  isExtractingAI,
  onRefresh,
  onTogglePdf,
  onEdit,
  onAIExtract,
  onDownload,
  onShare,
  onCompare,
}: ContractHeaderProps) {
  return (
    <div className="bg-white/95 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4 min-w-0">
            <Button 
              variant="ghost" 
              size="sm" 
              asChild 
              className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
            >
              <Link href="/contracts">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Contracts</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative group shrink-0">
                <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 transition-transform group-hover:scale-105">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow-sm" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-[250px] lg:max-w-[350px]">
                  {filename || 'Contract Details'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <CopyableId id={contractId} />
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <StatusBadge status={status || 'unknown'} />
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
                    className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-slate-100 transition-colors"
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
                  className="shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <span className="hidden sm:inline">Actions</span>
                  <ChevronDown className="h-4 w-4 sm:ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-xl border-slate-200">
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
})

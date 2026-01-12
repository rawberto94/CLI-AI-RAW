'use client'

/**
 * Version Timeline Component
 * 
 * A visual timeline showing contract version history with 
 * interactive nodes and quick actions.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import {
  GitBranch,
  User,
  Clock,
  Eye,
  GitCompare,
  RotateCcw,
  Download,
  ChevronRight,
  FileText,
  CheckCircle2,
  History,
  Plus,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

interface ContractVersion {
  id: string
  versionNumber: number
  uploadedBy: string | null
  uploadedAt: string
  isActive: boolean
  summary: string | null
  changes?: Record<string, { old?: unknown; new?: unknown }>
  fileUrl?: string | null
}

interface VersionTimelineProps {
  versions: ContractVersion[]
  contractId: string
  onCompare?: (versionA: number, versionB: number) => void
  onRevert?: (version: ContractVersion) => void
  onView?: (version: ContractVersion) => void
  onCreateSnapshot?: () => void
  className?: string
  compact?: boolean
}

// ============ HELPER FUNCTIONS ============

const formatVersionDate = (dateString: string): string => {
  const date = new Date(dateString)
  return format(date, 'MMM d, yyyy')
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  return formatDistanceToNow(date, { addSuffix: true })
}

const getVersionColor = (version: ContractVersion, index: number, total: number): string => {
  if (version.isActive) return 'bg-emerald-500 border-emerald-600'
  const age = (total - index - 1) / Math.max(total - 1, 1)
  if (age < 0.3) return 'bg-blue-400 border-blue-500'
  if (age < 0.6) return 'bg-slate-400 border-slate-500'
  return 'bg-slate-300 border-slate-400'
}

// ============ SUB-COMPONENTS ============

interface TimelineNodeProps {
  version: ContractVersion
  index: number
  total: number
  isSelected: boolean
  onSelect: () => void
  onCompare: () => void
  compact?: boolean
}

function TimelineNode({ 
  version, 
  index, 
  total, 
  isSelected, 
  onSelect,
  onCompare,
  compact 
}: TimelineNodeProps) {
  const colorClass = getVersionColor(version, index, total)
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            className={cn(
              "relative flex flex-col items-center group",
              compact ? "min-w-[40px]" : "min-w-[60px]"
            )}
            onClick={onSelect}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Node */}
            <div
              className={cn(
                "rounded-full border-2 flex items-center justify-center transition-all",
                compact ? "w-8 h-8" : "w-12 h-12",
                colorClass,
                isSelected && "ring-2 ring-offset-2 ring-indigo-500"
              )}
            >
              <span className={cn(
                "font-bold text-white",
                compact ? "text-xs" : "text-sm"
              )}>
                {version.versionNumber}
              </span>
            </div>
            
            {/* Current badge */}
            {version.isActive && (
              <Badge 
                className={cn(
                  "absolute bg-emerald-500 text-white border-0",
                  compact ? "-top-1 -right-1 text-[8px] px-1" : "-top-2 -right-2 text-[10px]"
                )}
              >
                Current
              </Badge>
            )}
            
            {/* Date label */}
            {!compact && (
              <span className="mt-2 text-[10px] text-slate-500 whitespace-nowrap">
                {formatVersionDate(version.uploadedAt)}
              </span>
            )}
            
            {/* Compare handle - appears on hover */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileHover={{ opacity: 1, scale: 1 }}
              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCompare()
                }}
                className={cn(
                  "bg-indigo-500 rounded-full p-0.5 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity",
                  compact ? "hidden" : ""
                )}
              >
                <GitCompare className="h-3 w-3" />
              </button>
            </motion.div>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          <div className="text-xs">
            <p className="font-semibold">Version {version.versionNumber}</p>
            {version.summary && (
              <p className="text-slate-400 mt-1">{version.summary}</p>
            )}
            <p className="text-slate-500 mt-1">
              {version.uploadedBy || 'System'} • {formatRelativeTime(version.uploadedAt)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface VersionDetailPanelProps {
  version: ContractVersion
  onCompare: () => void
  onRevert: () => void
  onView: () => void
  onClose: () => void
}

function VersionDetailPanel({ 
  version, 
  onCompare, 
  onRevert, 
  onView,
  onClose 
}: VersionDetailPanelProps) {
  const changeCount = version.changes ? Object.keys(version.changes).length : 0
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-white border border-slate-200 rounded-lg shadow-lg p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900">
              Version {version.versionNumber}
            </h4>
            {version.isActive && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Current
              </Badge>
            )}
          </div>
          {version.summary && (
            <p className="text-sm text-slate-600 mt-1">{version.summary}</p>
          )}
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {version.uploadedBy || 'System'}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(version.uploadedAt)}
        </span>
        {changeCount > 0 && (
          <span className="flex items-center gap-1">
            <History className="h-3 w-3" />
            {changeCount} {changeCount === 1 ? 'change' : 'changes'}
          </span>
        )}
        {version.fileUrl && (
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Has document
          </span>
        )}
      </div>
      
      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-4">
        <Button 
          size="sm" 
          variant="outline"
          onClick={onView}
          className="text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={onCompare}
          className="text-xs"
        >
          <GitCompare className="h-3 w-3 mr-1" />
          Compare
        </Button>
        {version.fileUrl && (
          <Button 
            size="sm" 
            variant="outline"
            className="text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        )}
        {!version.isActive && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onRevert}
            className="text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Revert
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ============ MAIN COMPONENT ============

export function VersionTimeline({
  versions,
  contractId,
  onCompare,
  onRevert,
  onView,
  onCreateSnapshot,
  className,
  compact = false,
}: VersionTimelineProps) {
  const [selectedVersion, setSelectedVersion] = useState<ContractVersion | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersions, setCompareVersions] = useState<number[]>([])
  
  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber)
  
  const handleNodeClick = (version: ContractVersion) => {
    if (compareMode) {
      // In compare mode, select versions for comparison
      if (compareVersions.includes(version.versionNumber)) {
        setCompareVersions(prev => prev.filter(v => v !== version.versionNumber))
      } else if (compareVersions.length < 2) {
        const newVersions = [...compareVersions, version.versionNumber]
        setCompareVersions(newVersions)
        if (newVersions.length === 2) {
          // Trigger comparison
          onCompare?.(Math.min(...newVersions), Math.max(...newVersions))
          setCompareMode(false)
          setCompareVersions([])
        }
      }
    } else {
      // Normal mode - toggle selection
      setSelectedVersion(prev => prev?.id === version.id ? null : version)
    }
  }
  
  const handleCompareClick = (version: ContractVersion) => {
    setCompareMode(true)
    setCompareVersions([version.versionNumber])
    setSelectedVersion(null)
  }
  
  const handleRevert = (version: ContractVersion) => {
    onRevert?.(version)
    setSelectedVersion(null)
  }
  
  const handleView = (version: ContractVersion) => {
    onView?.(version)
  }
  
  if (sortedVersions.length === 0) {
    return (
      <div className={cn("text-center py-8 text-slate-500", className)}>
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No versions yet</p>
        {onCreateSnapshot && (
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-3"
            onClick={onCreateSnapshot}
          >
            <Camera className="h-3 w-3 mr-1" />
            Create First Snapshot
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with compare mode indicator */}
      {compareMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <GitCompare className="h-4 w-4" />
            <span>
              {compareVersions.length === 0 
                ? 'Select first version to compare'
                : compareVersions.length === 1
                ? `Selected v${compareVersions[0]} - Select second version`
                : 'Comparing...'
              }
            </span>
          </div>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => {
              setCompareMode(false)
              setCompareVersions([])
            }}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Cancel
          </Button>
        </motion.div>
      )}
      
      {/* Timeline */}
      <div className="relative">
        {/* Connector line */}
        <div 
          className={cn(
            "absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2",
            compact ? "top-4" : "top-6"
          )} 
        />
        
        {/* Version nodes */}
        <div className={cn(
          "relative flex items-start justify-between",
          compact ? "gap-1" : "gap-2"
        )}>
          {sortedVersions.map((version, index) => (
            <TimelineNode
              key={version.id}
              version={version}
              index={index}
              total={sortedVersions.length}
              isSelected={
                selectedVersion?.id === version.id || 
                compareVersions.includes(version.versionNumber)
              }
              onSelect={() => handleNodeClick(version)}
              onCompare={() => handleCompareClick(version)}
              compact={compact}
            />
          ))}
          
          {/* Add new version node */}
          {onCreateSnapshot && !compact && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    className="flex flex-col items-center min-w-[60px]"
                    onClick={onCreateSnapshot}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="mt-2 text-[10px] text-slate-400 whitespace-nowrap">
                      New
                    </span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent>Create new version snapshot</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* Selected version detail panel */}
      <AnimatePresence>
        {selectedVersion && !compareMode && (
          <VersionDetailPanel
            version={selectedVersion}
            onCompare={() => handleCompareClick(selectedVersion)}
            onRevert={() => handleRevert(selectedVersion)}
            onView={() => handleView(selectedVersion)}
            onClose={() => setSelectedVersion(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default VersionTimeline

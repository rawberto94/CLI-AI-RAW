'use client'

/**
 * Contract Version Manager
 * 
 * A comprehensive version management panel for the contract detail page.
 * Displays version history, allows version comparison, upload, and revert.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import {
  History,
  GitBranch,
  Upload,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  FileText,
  ArrowRight,
  RotateCcw,
  Eye,
  Download,
  Diff,
  MoreHorizontal,
  Plus,
  Loader2,
  X,
  GitCompare,
  Camera,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner'

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

interface VersionManagerProps {
  contractId: string
  contractTitle: string
  onVersionChange?: (versionId: string) => void
  className?: string
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

const formatChangeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ============ SUB-COMPONENTS ============

interface VersionItemProps {
  version: ContractVersion
  isLast: boolean
  onCompare: (version: ContractVersion) => void
  onRevert: (version: ContractVersion) => void
  onView: (version: ContractVersion) => void
}

function VersionItem({ version, isLast, onCompare, onRevert, onView }: VersionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasChanges = version.changes && Object.keys(version.changes).length > 0

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-200" />
      )}
      
      <div className="flex gap-4">
        {/* Timeline node */}
        <div className={cn(
          "relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2",
          version.isActive 
            ? "bg-violet-100 border-violet-500 text-violet-700"
            : "bg-white border-slate-300 text-slate-500"
        )}>
          <span className="text-sm font-semibold">v{version.versionNumber}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 pb-6">
          <div 
            className={cn(
              "rounded-lg border transition-colors",
              version.isActive ? "bg-violet-50 border-violet-200" : "bg-white border-slate-200 hover:border-slate-300"
            )}
          >
            {/* Header */}
            <div 
              className="p-3 cursor-pointer"
              onClick={() => hasChanges && setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {version.isActive && (
                    <Badge className="bg-violet-500 text-white text-[10px]">
                      Current
                    </Badge>
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {version.summary || `Version ${version.versionNumber}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(version)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCompare(version)}>
                        <GitCompare className="h-4 w-4 mr-2" />
                        Compare
                      </DropdownMenuItem>
                      {version.fileUrl && (
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download File
                        </DropdownMenuItem>
                      )}
                      {!version.isActive && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onRevert(version)}
                            className="text-amber-600"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Revert to this version
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {version.uploadedBy || 'System'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(version.uploadedAt)}
                </span>
                {version.fileUrl && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Has document
                  </span>
                )}
              </div>
            </div>
            
            {/* Expanded changes */}
            <AnimatePresence>
              {isExpanded && hasChanges && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 pt-0">
                    <Separator className="mb-3" />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                        Changes
                      </p>
                      {Object.entries(version.changes || {}).map(([field, change]) => (
                        <div 
                          key={field}
                          className="flex items-center gap-2 text-sm bg-slate-50 rounded-md px-2 py-1"
                        >
                          <span className="font-medium text-slate-700 capitalize">
                            {field.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <span className="text-red-600 line-through">
                            {formatChangeValue(change?.old)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="text-violet-600">
                            {formatChangeValue(change?.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function VersionManager({ 
  contractId, 
  contractTitle,
  onVersionChange,
  className 
}: VersionManagerProps) {
  // State
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showCompareDialog, setShowCompareDialog] = useState(false)
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<ContractVersion | null>(null)
  const [compareVersionA, setCompareVersionA] = useState<number | null>(null)
  const [compareVersionB, setCompareVersionB] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [snapshotSummary, setSnapshotSummary] = useState('')
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)
  const [isReverting, setIsReverting] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        headers: { 'x-tenant-id': getTenantId() }
      })
      
      if (!response.ok) throw new Error('Failed to fetch versions')
      
      const data = await response.json()
      setVersions(data.versions || [])
      setError(null)
    } catch {
      setError('Failed to load version history')
    } finally {
      setIsLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  // Handlers
  const handleUploadVersion = useCallback(async (file: File, summary: string) => {
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('summary', summary)
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 10, 80))
      }, 200)
      
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        method: 'POST',
        headers: { 'x-tenant-id': getTenantId() },
        body: formData
      })
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      if (!response.ok) throw new Error('Upload failed')
      
      const data = await response.json()
      
      toast.success('New version uploaded', {
        description: `Version ${data.version.versionNumber} created successfully`
      })
      
      setShowUploadDialog(false)
      fetchVersions()
      onVersionChange?.(data.version.id)
    } catch {
      toast.error('Failed to upload new version')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [contractId, fetchVersions, onVersionChange])

  const handleCreateSnapshot = useCallback(async () => {
    if (!snapshotSummary.trim()) {
      toast.error('Please enter a summary for this snapshot')
      return
    }
    
    setIsCreatingSnapshot(true)
    
    try {
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId() 
        },
        body: JSON.stringify({ summary: snapshotSummary })
      })
      
      if (!response.ok) throw new Error('Failed to create snapshot')
      
      const data = await response.json()
      
      toast.success('Snapshot created', {
        description: `Version ${data.version.versionNumber} saved`
      })
      
      setShowSnapshotDialog(false)
      setSnapshotSummary('')
      fetchVersions()
    } catch {
      toast.error('Failed to create snapshot')
    } finally {
      setIsCreatingSnapshot(false)
    }
  }, [contractId, snapshotSummary, fetchVersions])

  const handleRevertVersion = useCallback(async (version: ContractVersion) => {
    setIsReverting(true)
    
    try {
      const response = await fetch(`/api/contracts/${contractId}/versions`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId() 
        },
        body: JSON.stringify({ versionNumber: version.versionNumber })
      })
      
      if (!response.ok) throw new Error('Failed to revert')
      
      toast.success(`Reverted to version ${version.versionNumber}`, {
        description: version.summary || undefined
      })
      
      fetchVersions()
      onVersionChange?.(version.id)
    } catch {
      toast.error('Failed to revert version')
    } finally {
      setIsReverting(false)
    }
  }, [contractId, fetchVersions, onVersionChange])

  const handleCompare = useCallback((version: ContractVersion) => {
    setSelectedVersion(version)
    setCompareVersionA(version.versionNumber)
    
    // Set version B to current or next
    const currentVersion = versions.find(v => v.isActive)
    if (currentVersion && currentVersion.versionNumber !== version.versionNumber) {
      setCompareVersionB(currentVersion.versionNumber)
    } else {
      const nextVersion = versions.find(v => v.versionNumber > version.versionNumber)
      setCompareVersionB(nextVersion?.versionNumber || version.versionNumber)
    }
    
    setShowCompareDialog(true)
  }, [versions])

  const currentVersion = versions.find(v => v.isActive) || versions[versions.length - 1]

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <History className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Version History</CardTitle>
              <CardDescription className="text-xs">
                {versions.length} version{versions.length !== 1 ? 's' : ''} • Current: v{currentVersion?.versionNumber || 1}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowSnapshotDialog(true)}
                    className="h-8"
                  >
                    <Camera className="h-3 w-3 mr-1" />
                    Snapshot
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a snapshot of current state</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button 
              size="sm"
              onClick={() => setShowUploadDialog(true)}
              className="h-8 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
            >
              <Upload className="h-3 w-3 mr-1" />
              New Version
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchVersions} className="mt-2">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-1">No version history yet</p>
            <p className="text-xs text-slate-500 mb-4">
              Version tracking will start when you upload updates or create snapshots
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSnapshotDialog(true)}
            >
              <Camera className="h-3 w-3 mr-1" />
              Create First Snapshot
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-0">
              {[...versions].reverse().map((version, index) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isLast={index === versions.length - 1}
                  onCompare={handleCompare}
                  onRevert={handleRevertVersion}
                  onView={() => setSelectedVersion(version)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-violet-500" />
              Upload New Version
            </DialogTitle>
            <DialogDescription>
              Upload an updated contract document to create a new version
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document File</Label>
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Click to select file</p>
                <p className="text-xs text-slate-400">PDF, Word, or images</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleUploadVersion(file, 'New document version')
                  }
                }}
              />
            </div>
            
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-slate-500 text-center">
                  {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Snapshot Dialog */}
      <Dialog open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-violet-500" />
              Create Snapshot
            </DialogTitle>
            <DialogDescription>
              Save the current state of this contract as a new version
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-summary">Summary</Label>
              <Textarea
                id="snapshot-summary"
                placeholder="What changed in this version?"
                value={snapshotSummary}
                onChange={(e) => setSnapshotSummary(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnapshotDialog(false)} disabled={isCreatingSnapshot}>
              Cancel
            </Button>
            <Button onClick={handleCreateSnapshot} disabled={isCreatingSnapshot}>
              {isCreatingSnapshot ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Create Snapshot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-violet-500" />
              Compare Versions
            </DialogTitle>
            <DialogDescription>
              Select two versions to compare
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label>From</Label>
              <select 
                className="w-full border rounded-md p-2 text-sm"
                value={compareVersionA || ''}
                onChange={(e) => setCompareVersionA(parseInt(e.target.value))}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.versionNumber}>
                    Version {v.versionNumber} - {formatVersionDate(v.uploadedAt)}
                  </option>
                ))}
              </select>
            </div>
            
            <ArrowRight className="h-5 w-5 text-slate-400 mt-6" />
            
            <div className="flex-1 space-y-2">
              <Label>To</Label>
              <select 
                className="w-full border rounded-md p-2 text-sm"
                value={compareVersionB || ''}
                onChange={(e) => setCompareVersionB(parseInt(e.target.value))}
              >
                {versions.map(v => (
                  <option key={v.id} value={v.versionNumber}>
                    Version {v.versionNumber} - {formatVersionDate(v.uploadedAt)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (compareVersionA && compareVersionB) {
                  window.open(
                    `/contracts/${contractId}/versions/compare?v1=${compareVersionA}&v2=${compareVersionB}`,
                    '_blank'
                  )
                }
              }}
              disabled={!compareVersionA || !compareVersionB || compareVersionA === compareVersionB}
            >
              <Diff className="h-4 w-4 mr-2" />
              Compare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default VersionManager

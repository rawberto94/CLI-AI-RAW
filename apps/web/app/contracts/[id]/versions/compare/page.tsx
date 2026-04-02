'use client'

/**
 * Version Comparison Page
 * 
 * Side-by-side comparison of two contract versions with diff highlighting.
 * Accessible via /contracts/[id]/versions/compare?v1=1&v2=2
 */

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  ArrowRight as _ArrowRight,
  GitCompare,
  History,
  ChevronDown as _ChevronDown,
  FileText,
  User,
  Clock,
  Plus,
  Minus,
  Equal,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download as _Download,
  Copy,
  Check,
  ArrowLeftRight,
  Eye as _Eye,
  EyeOff as _EyeOff,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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

interface FieldChange {
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
  changeType: 'added' | 'removed' | 'modified' | 'unchanged'
}

// ============ HELPER FUNCTIONS ============

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  if (value instanceof Date) return format(value, 'MMM d, yyyy')
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const getFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    title: 'Title',
    document_title: 'Document Title',
    status: 'Status',
    totalValue: 'Total Value',
    tcv_amount: 'TCV Amount',
    clientName: 'Client Name',
    supplierName: 'Supplier Name',
    effectiveDate: 'Effective Date',
    expirationDate: 'Expiration Date',
    start_date: 'Start Date',
    end_date: 'End Date',
    contractType: 'Contract Type',
    description: 'Description',
    jurisdiction: 'Jurisdiction',
    contract_language: 'Language',
    payment_type: 'Payment Type',
    notice_period: 'Notice Period',
  }
  return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
}

const detectChanges = (
  oldVersion: ContractVersion | null,
  newVersion: ContractVersion | null
): FieldChange[] => {
  if (!oldVersion || !newVersion) return []
  
  const changes: FieldChange[] = []
  const oldChanges = oldVersion.changes || {}
  const newChanges = newVersion.changes || {}
  
  // Collect all unique fields
  const allFields = new Set([...Object.keys(oldChanges), ...Object.keys(newChanges)])
  
  allFields.forEach(field => {
    const oldEntry = oldChanges[field]
    const newEntry = newChanges[field]
    
    const oldValue = oldEntry?.new ?? oldEntry?.old ?? null
    const newValue = newEntry?.new ?? newEntry?.old ?? null
    
    let changeType: FieldChange['changeType'] = 'unchanged'
    if (oldValue === null && newValue !== null) changeType = 'added'
    else if (oldValue !== null && newValue === null) changeType = 'removed'
    else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changeType = 'modified'
    
    changes.push({
      field,
      label: getFieldLabel(field),
      oldValue,
      newValue,
      changeType,
    })
  })
  
  return changes.sort((a, b) => {
    const order = { added: 0, removed: 1, modified: 2, unchanged: 3 }
    return order[a.changeType] - order[b.changeType]
  })
}

// ============ COMPONENTS ============

interface VersionSelectorProps {
  versions: ContractVersion[]
  selectedVersion: number | null
  onSelect: (version: number) => void
  label: string
  excludeVersion?: number | null
}

function VersionSelector({ 
  versions, 
  selectedVersion, 
  onSelect, 
  label,
  excludeVersion 
}: VersionSelectorProps) {
  const availableVersions = versions.filter(v => v.versionNumber !== excludeVersion)
  
  return (
    <div className="space-y-2">
      <Label className="text-xs text-slate-500 uppercase tracking-wide">{label}</Label>
      <Select
        value={selectedVersion?.toString() || ''}
        onValueChange={(value) => onSelect(parseInt(value))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select version" />
        </SelectTrigger>
        <SelectContent>
          {availableVersions.map((version) => (
            <SelectItem key={version.id} value={version.versionNumber.toString()}>
              <div className="flex items-center gap-2">
                <span className="font-medium">v{version.versionNumber}</span>
                {version.isActive && (
                  <Badge variant="secondary" className="text-[10px] h-4">Current</Badge>
                )}
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(version.uploadedAt), { addSuffix: true })}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface ChangeRowProps {
  change: FieldChange
  showUnchanged: boolean
}

function ChangeRow({ change, showUnchanged }: ChangeRowProps) {
  if (change.changeType === 'unchanged' && !showUnchanged) return null
  
  const icons = {
    added: <Plus className="h-3.5 w-3.5 text-violet-600" />,
    removed: <Minus className="h-3.5 w-3.5 text-red-600" />,
    modified: <ArrowLeftRight className="h-3.5 w-3.5 text-amber-600" />,
    unchanged: <Equal className="h-3.5 w-3.5 text-slate-400" />,
  }
  
  const bgColors = {
    added: 'bg-violet-50 border-violet-200',
    removed: 'bg-red-50 border-red-200',
    modified: 'bg-amber-50 border-amber-200',
    unchanged: 'bg-slate-50 border-slate-200',
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-3 transition-colors",
        bgColors[change.changeType]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icons[change.changeType]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{change.label}</p>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className={cn(
              "rounded px-2 py-1",
              change.changeType === 'removed' || change.changeType === 'modified'
                ? "bg-red-100/50 line-through text-red-700"
                : "bg-slate-100 text-slate-600"
            )}>
              {formatValue(change.oldValue)}
            </div>
            <div className={cn(
              "rounded px-2 py-1",
              change.changeType === 'added' || change.changeType === 'modified'
                ? "bg-violet-100/50 text-violet-700"
                : "bg-slate-100 text-slate-600"
            )}>
              {formatValue(change.newValue)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============ MAIN PAGE ============

export default function VersionComparePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const contractId = params.id as string
  const initialV1 = searchParams.get('v1')
  const initialV2 = searchParams.get('v2')
  
  // State
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [versionA, setVersionA] = useState<number | null>(initialV1 ? parseInt(initialV1) : null)
  const [versionB, setVersionB] = useState<number | null>(initialV2 ? parseInt(initialV2) : null)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Fetch versions
  useEffect(() => {
    async function fetchVersions() {
      try {
        setLoading(true)
        const response = await fetch(`/api/contracts/${contractId}/versions`, {
          headers: { 'x-tenant-id': getTenantId() }
        })
        
        if (!response.ok) throw new Error('Failed to load versions')
        
        const raw = await response.json()
        const data = raw.data ?? raw
        setVersions(data.versions || [])
        
        // Set default versions if not provided
        if (data.versions?.length >= 2) {
          if (!versionA) setVersionA(data.versions[0].versionNumber)
          if (!versionB) setVersionB(data.versions[data.versions.length - 1].versionNumber)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load versions')
      } finally {
        setLoading(false)
      }
    }
    
    fetchVersions()
  }, [contractId])
  
  // Get selected version objects
  const selectedVersionA = useMemo(
    () => versions.find(v => v.versionNumber === versionA) || null,
    [versions, versionA]
  )
  
  const selectedVersionB = useMemo(
    () => versions.find(v => v.versionNumber === versionB) || null,
    [versions, versionB]
  )
  
  // Detect changes between versions
  const changes = useMemo(
    () => detectChanges(selectedVersionA, selectedVersionB),
    [selectedVersionA, selectedVersionB]
  )
  
  // Stats
  const stats = useMemo(() => {
    const added = changes.filter(c => c.changeType === 'added').length
    const removed = changes.filter(c => c.changeType === 'removed').length
    const modified = changes.filter(c => c.changeType === 'modified').length
    const unchanged = changes.filter(c => c.changeType === 'unchanged').length
    return { added, removed, modified, unchanged, total: changes.length }
  }, [changes])
  
  // Update URL when versions change
  useEffect(() => {
    if (versionA && versionB) {
      const url = new URL(window.location.href)
      url.searchParams.set('v1', versionA.toString())
      url.searchParams.set('v2', versionB.toString())
      window.history.replaceState({}, '', url.toString())
    }
  }, [versionA, versionB])
  
  // Swap versions
  const handleSwap = () => {
    const temp = versionA
    setVersionA(versionB)
    setVersionB(temp)
  }
  
  // Copy comparison link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading versions...</p>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Versions</h2>
            <p className="text-slate-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Not enough versions
  if (versions.length < 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-yellow-50/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <History className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Not Enough Versions</h2>
            <p className="text-slate-600 mb-4">
              You need at least 2 versions to compare. Create a snapshot or upload a new version to enable comparison.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/contracts/${contractId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contract
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20",
      isFullscreen && "fixed inset-0 z-50"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/contracts/${contractId}`}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Back</span>
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6 hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                  <GitCompare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-semibold text-slate-900">
                    Version Comparison
                  </h1>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Compare changes between versions
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleCopyLink}
                      className="h-9 w-9"
                    >
                      {copied ? <Check className="h-4 w-4 text-violet-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy link</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="h-9 w-9"
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Version Selectors */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1">
                <VersionSelector
                  versions={versions}
                  selectedVersion={versionA}
                  onSelect={setVersionA}
                  label="From Version"
                  excludeVersion={versionB}
                />
              </div>
              
              <div className="flex items-center justify-center">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleSwap}
                  className="rounded-full h-10 w-10"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex-1">
                <VersionSelector
                  versions={versions}
                  selectedVersion={versionB}
                  onSelect={setVersionB}
                  label="To Version"
                  excludeVersion={versionA}
                />
              </div>
            </div>
            
            {/* Version Info */}
            {selectedVersionA && selectedVersionB && (
              <div className="mt-4 flex flex-col sm:flex-row gap-4 text-sm">
                <div className="flex-1 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="h-3.5 w-3.5" />
                    <span>{selectedVersionA.uploadedBy || 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(new Date(selectedVersionA.uploadedAt), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {selectedVersionA.summary && (
                    <p className="text-slate-600 mt-2 text-xs">{selectedVersionA.summary}</p>
                  )}
                </div>
                
                <div className="flex-1 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="h-3.5 w-3.5" />
                    <span>{selectedVersionB.uploadedBy || 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(new Date(selectedVersionB.uploadedAt), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {selectedVersionB.summary && (
                    <p className="text-slate-600 mt-2 text-xs">{selectedVersionB.summary}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-violet-600" />
              <span className="text-lg font-bold text-violet-700">{stats.added}</span>
            </div>
            <p className="text-xs text-violet-600 mt-1">Added</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-red-600" />
              <span className="text-lg font-bold text-red-700">{stats.removed}</span>
            </div>
            <p className="text-xs text-red-600 mt-1">Removed</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-amber-600" />
              <span className="text-lg font-bold text-amber-700">{stats.modified}</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">Modified</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <Equal className="h-4 w-4 text-slate-500" />
              <span className="text-lg font-bold text-slate-700">{stats.unchanged}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Unchanged</p>
          </div>
        </div>
        
        {/* Changes List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                Changes
              </CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-unchanged"
                  checked={showUnchanged}
                  onCheckedChange={setShowUnchanged}
                />
                <Label htmlFor="show-unchanged" className="text-xs text-slate-600">
                  Show unchanged
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {changes.length === 0 ? (
                    <div key="changes-length" className="text-center py-8">
                      <GitCompare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">No changes detected between these versions</p>
                    </div>
                  ) : (
                    changes.map((change) => (
                      <ChangeRow
                        key={change.field}
                        change={change}
                        showUnchanged={showUnchanged}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

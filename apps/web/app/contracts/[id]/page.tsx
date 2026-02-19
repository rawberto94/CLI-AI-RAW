'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  FileText,
  Sparkles,
  Loader2,
  Brain,
  Pencil,
  History,
  Tag,
  FileType,
  Activity,
  Globe,
  Link2,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner'
import { ComprehensiveAIAnalysis } from '@/components/artifacts/ComprehensiveAIAnalysis'
import { ContractAIAnalyst } from '@/components/contracts/ContractAIAnalyst'
import { ContractIntelligenceBrief } from '@/components/ai/ContractIntelligenceBrief'
import { EnhancedNegotiationPanel } from '@/components/ai/EnhancedNegotiationPanel'
import { PredictiveInsightsWidget } from '@/components/ai/PredictiveInsightsWidget'
import { ShareDialog } from '@/components/collaboration/ShareDialog'
import { useWebSocket } from '@/contexts/websocket-context'
import { useCrossModuleInvalidation } from '@/hooks/use-queries'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ContractComparison, 
  CategoryBadge, 
  CategorySelector, 
  ContractAuditLog, 
  EnhancedContractMetadataSection, 
  ContractRelationshipsCard,
  ContractScoresCard,
  ExtractionAccuracyCard 
} from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { ActivityTab } from '@/components/contracts/detail/ActivityTab'
import { VersionManager } from '@/components/contracts/VersionManager'
import { useSplitPaneResize } from '@/hooks/use-split-pane-resize'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Breadcrumbs } from '@/components/breadcrumbs'

// Import print styles
import './print.css'

// Import new modular components
import { 
  ContractHeader,
  ContractQuickOverview,
  ContractStatusBanner,
  ContractSummaryTab,
  ContractFloatingActions,
  ContractReminderDialog,
  KeyboardShortcutsHelp,
  ContractNotes,
  ContractTimeline,
  RelatedContracts,
  SkipToContent,
  SectionErrorBoundary,
} from './components'
import { useContractMetadata } from './hooks'

// ============ TYPES ============

interface CategoryInfo {
  id: string
  name: string
  color: string
  icon: string
  path: string
  level?: number
  l1?: string | null
  l2?: string | null
  parent?: {
    id: string
    name: string
    code: string
    color: string
    icon: string
  } | null
}

interface ContractData {
  id: string
  filename: string
  status: string
  uploadDate: string
  fileSize: number
  mimeType: string
  extractedData?: any
  artifacts?: any[]
  artifactCount?: number
  summary?: any
  insights?: any[]
  category?: CategoryInfo | null
  categoryL1?: string | null
  categoryL2?: string | null
  contractCategoryId?: string | null
  classifiedAt?: string | null
  aiSuggestedCategory?: CategoryInfo | null
  processing?: {
    progress: number
    currentStage: string
    status: string
  }
  // Contract metadata fields
  totalValue?: number | string | null
  currency?: string | null
  contractType?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  clientName?: string | null
  supplierName?: string | null
  description?: string | null
  tags?: string[] | null
  // Official schema fields
  document_number?: string | null
  document_title?: string | null
  contract_short_description?: string | null
  jurisdiction?: string | null
  contract_language?: string | null
  external_parties?: Array<{ legalName: string; role?: string; legalForm?: string }> | null
  tcv_amount?: number | null
  tcv_text?: string | null
  payment_type?: string | null
  billing_frequency_type?: string | null
  periodicity?: string | null
  signature_date?: string | null
  signature_status?: string | null
  signature_required_flag?: boolean | null
  document_classification?: string | null
  document_classification_warning?: string | null
  start_date?: string | null
  end_date?: string | null
  termination_date?: string | null
  notice_period?: string | null
  reminder_enabled?: boolean | null
  reminder_days_before_end?: number | null
  // Contract Hierarchy
  parentContract?: {
    id: string
    title: string
    type: string | null
    status: string
    clientName: string | null
    supplierName: string | null
    effectiveDate: string | null
    expirationDate: string | null
  } | null
  childContracts?: Array<{
    id: string
    title: string
    type: string | null
    status: string
    relationshipType: string | null
    clientName: string | null
    supplierName: string | null
    effectiveDate: string | null
    expirationDate: string | null
    totalValue: number | null
    createdAt: string | null
  }>
  parentContractId?: string | null
  relationshipType?: string | null
  relationshipNote?: string | null
  linkedAt?: string | null
  // Raw text for intelligent deep analysis
  rawText?: string | null
}

// ============ MAIN COMPONENT ============

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { dataMode } = useDataMode()
  const wsContext = useWebSocket()
  const crossModule = useCrossModuleInvalidation()
  
  // Core state
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const validTabs = useMemo(() => new Set(['overview', 'details', 'activity', 'ai']), [])

  const setPdfViewerOpen = useCallback((open: boolean) => {
    setShowPdfViewer(open)
    const next = new URLSearchParams(searchParams?.toString?.() || '')
    if (open) next.set('pdf', '1')
    else next.delete('pdf')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])

  const setTab = useCallback((tab: string) => {
    if (!validTabs.has(tab)) return
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams?.toString?.() || '')
    next.set('tab', tab)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, validTabs])
  
  // UI state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [isExtractingAI, setIsExtractingAI] = useState(false)
  const [isExtractingObligations, setIsExtractingObligations] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  
  // Notes state
  const [notes, setNotes] = useState<Array<{
    id: string
    content: string
    createdAt: Date
    updatedAt?: Date
    author: { id: string; name: string; avatar?: string }
    isPinned?: boolean
  }>>([])
  
  // Contract versions for comparison
  const [contractVersions, setContractVersions] = useState<Array<{
    id: string
    version: string
    title: string
    createdAt: Date
    createdBy: string
    status: 'active' | 'archived'
  }>>([])
  
  // Current version number for header badge
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1)
  
  // Health data from family-health API
  const [healthData, setHealthData] = useState<{
    healthScore: number
    completeness: number
    issues: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }>
  } | null>(null)
  
  // Extraction confidence from extraction-confidence API (real data, not mock)
  const [extractionConfidence, setExtractionConfidence] = useState<number | undefined>(undefined)
  
  // Split pane for PDF viewer
  const isMobile = useMediaQuery('(max-width: 768px)')
  const {
    containerRef: splitContainerRef,
    ratio: pdfSplitRatio,
    setRatio: setPdfSplitRatio,
    isResizing: isResizingPanel,
    beginResize: beginResizePanel,
    aria: splitAria,
  } = useSplitPaneResize({ initialRatio: 45, minRatio: 20, maxRatio: 75 })

  // Use the custom hook for metadata derivation
  const { metadata, riskInfo, complianceInfo, isProcessing, overviewData, financialData } = useContractMetadata(contract as any)

  // ============ KEYBOARD SHORTCUTS ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key) {
          case '1': setTab('overview'); break
          case '2': setTab('details'); break
          case '3': setTab('activity'); break
          case '4': case 'a': case 'A': setTab('ai'); break
          case 'p': case 'P': setPdfViewerOpen(!showPdfViewer); break
          case 'e': case 'E': if (!isEditing) setIsEditing(true); break
          case 'Escape':
            if (isEditing) setIsEditing(false)
            if (showPdfViewer) setPdfViewerOpen(false)
            break
        }
      }
      
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'd':
            e.preventDefault()
            handleDownload()
            break
          case 'r':
            e.preventDefault()
            loadContract()
            break
          case 's':
            if (isEditing) {
              e.preventDefault()
              // Save would be handled by the metadata section
            }
            break
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    
  }, [isEditing, setPdfViewerOpen, setTab, showPdfViewer, handleDownload, loadContract])

  // Initialize tab from URL (shareable deep-link)
  useEffect(() => {
    const requestedTab = searchParams?.get?.('tab')
    if (requestedTab && validTabs.has(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
  }, [activeTab, searchParams, validTabs])

  // Initialize PDF viewer from URL (shareable deep-link)
  useEffect(() => {
    const requestedPdf = searchParams?.get?.('pdf')
    const shouldShow = requestedPdf === '1'
    if (shouldShow !== showPdfViewer) {
      setShowPdfViewer(shouldShow)
    }
  }, [searchParams, showPdfViewer])

  // ============ WEBSOCKET CONNECTION ============
  useEffect(() => {
    if (params.id && wsContext?.joinDocument) {
      wsContext.joinDocument(params.id as string, 'contract')
    }
    return () => { wsContext?.leaveDocument?.() }
  }, [params.id, wsContext])

  // ============ DATA LOADING ============
  const loadContract = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        headers: { 'x-data-mode': dataMode }
      })
      
      if (response.status === 404) {
        throw new Error('Contract not found. It may have been deleted or the ID is invalid.')
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load contract: ${response.status}`)
      }
      
      const raw = await response.json()
      const data = raw.data ?? raw
      if (data.error) throw new Error(data.error)
      
      setContract(data)
      loadVersions()
      loadNotes()
      loadHealthData()
      loadExtractionConfidence()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
    } finally {
      setLoading(false)
    }
    
  }, [params.id, dataMode])

  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${params.id}/versions`, {
        headers: { 'x-data-mode': dataMode }
      })
      
      if (!response.ok) return
      
      const raw = await response.json()
      const data = raw.data ?? raw
      if (data.versions && Array.isArray(data.versions)) {
        setContractVersions(data.versions.map((v: any) => ({
          id: v.id,
          version: `v${v.versionNumber}.0`,
          title: v.summary || (v.isActive ? 'Current Version' : `Version ${v.versionNumber}`),
          createdAt: new Date(v.uploadedAt),
          createdBy: v.uploadedBy || 'System',
          status: v.isActive ? 'active' as const : 'archived' as const
        })))
        
        // Set current version number
        const activeVersion = data.versions.find((v: any) => v.isActive)
        if (activeVersion) {
          setCurrentVersionNumber(activeVersion.versionNumber)
        } else if (data.versions.length > 0) {
          // Fallback to highest version number
          const maxVersion = Math.max(...data.versions.map((v: any) => v.versionNumber))
          setCurrentVersionNumber(maxVersion)
        }
      }
    } catch {
      // Version loading failed silently
    }
  }, [params.id, dataMode])

  const loadNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${params.id}/notes`, {
        headers: { 'x-tenant-id': getTenantId() }
      })
      
      if (!response.ok) return
      
      const raw = await response.json()
      const data = raw.data ?? raw
      if (data.notes && Array.isArray(data.notes)) {
        setNotes(data.notes.map((n: any) => ({
          id: n.id,
          content: n.content,
          createdAt: new Date(n.createdAt),
          updatedAt: n.updatedAt ? new Date(n.updatedAt) : undefined,
          author: n.author || { id: 'unknown', name: 'Unknown User' },
          isPinned: n.isPinned || false
        })))
      }
    } catch {
      // Notes loading failed silently
    }
  }, [params.id])

  const loadHealthData = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${params.id}/family-health`)
      if (!response.ok) return
      
      const raw = await response.json()
      const data = raw.data ?? raw
      if (data.success !== false) {
        setHealthData({
          healthScore: data.healthScore ?? 100,
          completeness: data.completeness ?? 0,
          issues: data.issues || []
        })
      }
    } catch {
      // Health data loading failed silently - will use defaults
    }
  }, [params.id])

  const loadExtractionConfidence = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${params.id}/extraction-confidence`, {
        headers: { 'x-tenant-id': getTenantId() }
      })
      if (!response.ok) return
      
      const data = await response.json()
      if (data.success && data.data?.summary?.averageConfidence !== null) {
        setExtractionConfidence(data.data.summary.averageConfidence)
      }
    } catch {
      // Extraction confidence loading failed silently
    }
  }, [params.id])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  // Auto-refresh when contract is still processing
  useEffect(() => {
    if (!isProcessing || !contract) return
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/contracts/${params.id}`, {
          headers: { 'x-data-mode': dataMode }
        })
        if (!response.ok) return
        
        const raw = await response.json()
        const data = raw.data ?? raw
        
        // If status changed from processing, do a full reload
        const newStatus = data.status?.toLowerCase()
        if (newStatus && newStatus !== 'processing' && newStatus !== 'uploaded') {
          clearInterval(pollInterval)
          loadContract()
        }
      } catch {
        // Silent fail - will retry on next interval
      }
    }, 5000) // Poll every 5 seconds
    
    return () => clearInterval(pollInterval)
  }, [isProcessing, contract, params.id, dataMode, loadContract])

  // ============ ACTION HANDLERS ============
  const handleDownload = useCallback(async () => {
    try {
      toast.info('Preparing download...')
      const response = await fetch(`/api/contracts/${params.id}/export?format=pdf`, {
        headers: { 'x-tenant-id': getTenantId() },
      })
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contract-${params.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Download started')
    } catch {
      toast.error('Failed to download contract')
    }
  }, [params.id])

  const handleAIExtraction = useCallback(async () => {
    setIsExtractingAI(true)
    try {
      const response = await fetch(`/api/contracts/${params.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ force: true })
      })
      
      if (!response.ok) throw new Error('AI extraction failed')
      
      toast.success('AI extraction started. This may take a few moments...')
      setTimeout(async () => {
        await loadContract()
        toast.success('AI extraction completed!')
      }, 3000)
    } catch {
      toast.error('Failed to start AI extraction.')
    } finally {
      setIsExtractingAI(false)
    }
  }, [params.id, loadContract])

  const handleExtractObligations = useCallback(async () => {
    setIsExtractingObligations(true)
    try {
      toast.info('Extracting obligations from contract...')
      
      const response = await fetch('/api/obligations/v2', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-tenant-id': getTenantId() 
        },
        body: JSON.stringify({
          action: 'extract',
          contractId: params.id,
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract obligations')
      }
      
      const data = await response.json()
      const count = data.obligations?.length || 0
      
      if (count > 0) {
        toast.success(`Successfully extracted ${count} obligation${count > 1 ? 's' : ''} from this contract!`, {
          action: {
            label: 'View Obligations',
            onClick: () => router.push(`/obligations?contract=${params.id}`)
          }
        })
      } else {
        toast.warning('No obligations found in this contract. The AI could not identify specific obligations, deadlines, or requirements.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to extract obligations')
    } finally {
      setIsExtractingObligations(false)
    }
  }, [params.id, router])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    setIsSavingCategory(true)
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ categoryId })
      })
      
      if (!response.ok) throw new Error('Failed to update category')
      
      toast.success('Category updated successfully')
      setShowCategorySelector(false)
      crossModule.onTaxonomyChange()
      await loadContract()
    } catch {
      toast.error('Failed to update category')
    } finally {
      setIsSavingCategory(false)
    }
  }, [params.id, crossModule, loadContract])

  const handleAICategorize = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ contractIds: [params.id], force: true })
      })
      
      if (!response.ok) throw new Error('Failed to categorize')
      
      const data = await response.json()
      const result = data.data?.results?.[0]
      if (result?.success && result?.category) {
        toast.success(`Contract categorized as "${result.category}" (${result.confidence}% confidence)`)
        crossModule.onTaxonomyChange()
        await loadContract()
      } else {
        // Show specific error reason from API response
        const errorReason = result?.error || ''
        if (errorReason.includes('No taxonomy categories')) {
          toast.error('No categories defined. Go to Settings → Taxonomy to set up categories.', { duration: 5000 })
        } else if (errorReason.includes('No text available')) {
          toast.warning('Contract has no text to analyze. Try uploading a document first.')
        } else if (errorReason.includes('AI not configured')) {
          toast.error('AI service not available. Please configure OpenAI API key or add keywords to categories.', { duration: 5000 })
        } else if (errorReason.includes('No category keywords')) {
          toast.warning('Add keywords to your categories in Settings → Taxonomy for automatic categorization.', { duration: 5000 })
        } else if (errorReason) {
          toast.warning(errorReason, { duration: 5000 })
        } else {
          toast.warning('Could not determine category. Try selecting one manually.')
        }
      }
    } catch {
      toast.error('Failed to run AI categorization')
    }
  }, [params.id, crossModule, loadContract])

  const handleAnalyzeWithAI = useCallback(() => {
    const partyNames = metadata.external_parties
      .filter(p => p.legalName)
      .map(p => p.legalName)
      .join(' and ')
    
    window.dispatchEvent(new CustomEvent('openAIChatbot', {
      detail: {
        autoMessage: `Analyze this contract "${metadata.document_title || contract?.filename || 'Contract'}"${partyNames ? ` between ${partyNames}` : ''}. What are the key terms, obligations, and risks I should be aware of?`,
        contractId: contract?.id
      }
    }))
  }, [metadata.external_parties, metadata.document_title, contract?.filename, contract?.id])

  const handleCopyLink = useCallback(async () => {
    try {
      const url = window.location.href
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        el.setAttribute('readonly', '')
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        el.remove()
      }
      toast.success('Link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }, [])

  // ============ ERROR STATE ============
  if (error) {
    const isNotFound = error.includes('not found') || error.includes('404')
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/20 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card className="max-w-md w-full bg-white/90 backdrop-blur-xl border-white/50 shadow-xl">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                  className={cn(
                    "mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 shadow-lg",
                    isNotFound ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-gradient-to-br from-red-500 to-rose-600"
                  )}
                >
                  <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </motion.div>
                <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent mb-2">
                  {isNotFound ? 'Contract Not Found' : 'Error Loading Contract'}
                </h2>
                <p className="text-sm text-slate-600 mb-6 max-w-[280px] mx-auto">{error}</p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                  {!isNotFound && (
                    <Button onClick={loadContract} size="sm" className="bg-gradient-to-r from-violet-500 to-purple-600">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  <Button variant={isNotFound ? "default" : "outline"} size="sm" asChild>
                    <Link href="/contracts">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Contracts
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="h-8 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
            <div className="h-6 w-48 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
          </motion.div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[1, 2, 3, 4].map(i => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="h-24 sm:h-28 bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl shadow-sm animate-pulse"
              />
            ))}
          </div>
          <div className="h-80 sm:h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 print-container">
      {/* Skip to main content link for accessibility */}
      <SkipToContent targetId="main-content" />
      
      {/* Breadcrumbs with Keyboard Shortcuts Help */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 no-print">
        <div className="flex items-center justify-between">
          <Breadcrumbs 
            items={[
              { label: 'Contracts', href: '/contracts', icon: FileText },
              { label: contract?.filename || 'Contract Details' }
            ]} 
            showHomeIcon 
          />
          <KeyboardShortcutsHelp />
        </div>
      </div>
      
      {/* Header */}
      <ContractHeader
        contractId={params.id as string}
        filename={contract?.filename || ''}
        status={contract?.status || 'unknown'}
        currentVersion={currentVersionNumber}
        showPdfViewer={showPdfViewer}
        isEditing={isEditing}
        isExtractingAI={isExtractingAI}
        isExtractingObligations={isExtractingObligations}
        isExpiredOrExpiring={
          metadata.end_date 
            ? new Date(metadata.end_date) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            : false
        }
        onRefresh={loadContract}
        onTogglePdf={() => setPdfViewerOpen(!showPdfViewer)}
        onEdit={() => setIsEditing(true)}
        onAIExtract={handleAIExtraction}
        onExtractObligations={handleExtractObligations}
        onDownload={handleDownload}
        onShare={() => setShowShareDialog(true)}
        onCompare={() => setShowComparison(true)}
        onCreateRenewal={() => router.push(`/contracts/${params.id}/renew`)}
      />

      {/* Main Content */}
      <div 
        ref={splitContainerRef}
        className={cn(
          showPdfViewer && !isMobile ? "flex h-[calc(100vh-4rem)]" : "",
          showPdfViewer && isMobile ? "flex flex-col h-[calc(100vh-4rem)]" : "",
          isResizingPanel && "select-none"
        )}
      >
        {/* PDF Viewer Panel */}
        {showPdfViewer && (
          <>
            <div 
              className={cn(
                "bg-slate-100 flex-shrink-0 relative",
                isMobile ? "w-full h-[50vh]" : "h-full"
              )}
              style={isMobile ? undefined : { width: `${pdfSplitRatio}%`, minWidth: '280px' }}
            >
              <RobustPDFViewer
                contractId={params.id as string}
                filename={contract?.filename || 'Contract'}
                height="100%"
                onToggle={() => setPdfViewerOpen(false)}
                isExpanded={showPdfViewer}
              />
            </div>
            
            {/* Resize Handle - hidden on mobile */}
            {!isMobile && (
            <div
              className={cn(
                "w-1.5 cursor-col-resize bg-slate-300 hover:bg-violet-500 transition-colors flex-shrink-0",
                "flex items-center justify-center group",
                isResizingPanel && "bg-violet-500"
              )}
              role="separator"
              tabIndex={0}
              aria-label="Resize panels"
              aria-orientation="vertical"
              aria-valuemin={splitAria.min}
              aria-valuemax={splitAria.max}
              aria-valuenow={splitAria.now}
              onMouseDown={(e) => { e.preventDefault(); beginResizePanel() }}
              onKeyDown={(e) => {
                const step = 2
                switch (e.key) {
                  case 'ArrowLeft': e.preventDefault(); setPdfSplitRatio(pdfSplitRatio - step); break
                  case 'ArrowRight': e.preventDefault(); setPdfSplitRatio(pdfSplitRatio + step); break
                  case 'Home': e.preventDefault(); setPdfSplitRatio(splitAria.min); break
                  case 'End': e.preventDefault(); setPdfSplitRatio(splitAria.max); break
                }
              }}
            >
              <div className="w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
            </div>
            )}
          </>
        )}
        
        {/* Details Panel - Main Content */}
        <div 
          id="main-content"
          tabIndex={-1}
          className={cn("overflow-auto", showPdfViewer ? "flex-1" : "w-full")} 
          style={showPdfViewer && !isMobile ? { minWidth: '320px' } : undefined}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            
            {/* Processing Banner */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div key="processing"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 sm:mb-6"
                >
                  <Card className="border-violet-200 bg-violet-50/50">
                    <CardContent className="py-3 sm:py-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 animate-spin" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-violet-900 text-sm sm:text-base">Processing Contract</p>
                          <p className="text-xs sm:text-sm text-violet-700 truncate">
                            {contract?.processing?.currentStage || 'Generating artifacts...'} ({contract?.processing?.progress || 0}%)
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={loadContract} className="shrink-0">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* PDF Toggle Button (when hidden) */}
            {!showPdfViewer && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <Button variant="outline" size="sm" onClick={() => setPdfViewerOpen(true)} className="gap-2">
                  <FileType className="h-4 w-4" />
                  <span className="hidden sm:inline">View Original PDF</span>
                  <span className="sm:hidden">View PDF</span>
                </Button>
              </motion.div>
            )}

            {/* Status Banner */}
            <ContractStatusBanner
              endDate={metadata.end_date}
              riskLevel={riskInfo.riskLevel}
              complianceOk={complianceInfo.isCompliant}
              contractStatus={contract?.status}
              signatureStatus={metadata.signature_status}
              documentClassification={metadata.document_classification}
              documentClassificationWarning={metadata.document_classification_warning}
              onAction={() => setActiveTab('overview')}
              onInitiateRenewal={() => router.push(`/contracts/${params.id}/renew`)}
              onSetReminder={() => setShowReminderDialog(true)}
              onStartReview={() => router.push(`/contracts/${params.id}/legal-review`)}
              onStartRedline={() => router.push(`/contracts/${params.id}/redline`)}
            />

            {/* Quick Overview Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
              <ContractQuickOverview
                tcvAmount={metadata.tcv_amount}
                currency={metadata.currency}
                paymentType={metadata.payment_type}
                periodicity={metadata.periodicity}
                parties={metadata.external_parties}
                startDate={metadata.start_date}
                endDate={metadata.end_date}
                noticePeriod={metadata.notice_period}
                riskLevel={riskInfo.riskLevel}
                complianceStatus={complianceInfo.isCompliant ? 'ok' : 'review'}
                contractStatus={contract?.status || 'active'}
                signatureStatus={metadata.signature_status}
                signatureRequiredFlag={metadata.signature_required_flag}
              />
            </motion.div>

            {/* Quick Actions Bar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                {/* Category */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 hover:border-slate-300 transition-colors">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  {isSavingCategory ? (
                    <span className="text-xs text-slate-500 flex items-center gap-1.5 px-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </span>
                  ) : contract?.category ? (
                    <Button variant="ghost" size="sm" onClick={() => setShowCategorySelector(true)} className="h-7 px-2">
                      <CategoryBadge category={contract.category.name} color={contract.category.color} icon={contract.category.icon} size="sm" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setShowCategorySelector(true)} className="h-7 px-2 text-xs sm:text-sm">
                        Add category
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleAICategorize}
                              className="h-7 w-7"
                              aria-label="Suggest category with AI"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Suggest category with AI</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>
                
                {/* File Info */}
                <div className="hidden sm:flex items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs bg-white text-slate-600 flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="font-medium">{contract?.mimeType?.split('/')[1]?.toUpperCase() || 'PDF'}</span>
                          {contract?.fileSize && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{(contract.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                            </>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {contract?.mimeType || 'application/pdf'}
                          {contract?.fileSize ? ` · ${(contract.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Jurisdiction & Language */}
                {(metadata.jurisdiction || metadata.contract_language) && (
                  <div className="hidden md:flex items-center gap-1.5">
                    {metadata.jurisdiction && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs bg-white text-slate-600">
                              <Globe className="h-3 w-3 mr-1" />
                              {metadata.jurisdiction}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Jurisdiction</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {metadata.contract_language && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs bg-white text-slate-600">
                              {metadata.contract_language.toUpperCase()}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Language</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
                
                <div className="flex-1" />
                
                {/* Ask AI Quick Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTab('ai')}
                        aria-label="Ask AI about this contract"
                        className="h-8 px-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                      >
                        <MessageSquare className="h-4 w-4 mr-1.5" />
                        <span className="text-xs font-medium hidden sm:inline">Ask AI</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ask AI about this contract (press A)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Copy link */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyLink}
                        aria-label="Copy link"
                        className="h-8 px-2 text-slate-500 hover:text-slate-700"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </motion.div>

            {/* Main Tabs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Tabs value={activeTab} onValueChange={setTab} className="space-y-4 sm:space-y-6">
                <div className="sticky top-0 z-20 bg-gradient-to-b from-slate-50 via-slate-50/95 to-transparent pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  <TabsList className="w-full bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 p-1.5 h-auto grid grid-cols-2 sm:flex gap-1.5 shadow-lg shadow-slate-200/50">
                    <TabsTrigger value="overview" className="py-2.5 sm:py-3 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-800 data-[state=active]:to-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg justify-center transition-all duration-200 hover:bg-slate-100">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="details" className="py-2.5 sm:py-3 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-800 data-[state=active]:to-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg justify-center transition-all duration-200 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="py-2.5 sm:py-3 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/20 rounded-lg justify-center transition-all duration-200 hover:bg-violet-50">
                      <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      AI
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="py-2.5 sm:py-3 text-xs sm:text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-800 data-[state=active]:to-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg justify-center transition-all duration-200 hover:bg-slate-100">
                      <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                      Activity
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Summary Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Contract Summary Section */}
                  <ContractSummaryTab
                    summary={metadata.contract_short_description || overviewData?.summary || ''}
                    keyTerms={overviewData?.keyTerms}
                    parties={metadata.external_parties}
                    signatureDate={metadata.signature_date}
                    startDate={metadata.start_date}
                    endDate={metadata.end_date}
                    noticePeriod={metadata.notice_period}
                    risks={riskInfo.risks}
                    riskLevel={riskInfo.riskLevel}
                  />
                  
                  {/* Timeline & Related Contracts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contract Timeline */}
                    <SectionErrorBoundary sectionName="Timeline">
                      <ContractTimeline
                        signatureDate={metadata.signature_date}
                        startDate={metadata.start_date}
                        endDate={metadata.end_date}
                        terminationDate={metadata.termination_date}
                      />
                    </SectionErrorBoundary>
                    
                    {/* Related Contracts */}
                    <SectionErrorBoundary sectionName="Related Contracts">
                      <RelatedContracts
                        contractId={params.id as string}
                        clientName={metadata.external_parties?.[0]?.legalName}
                        categoryId={contract?.category?.id}
                      />
                    </SectionErrorBoundary>
                  </div>
                </TabsContent>

                {/* AI Tab */}
                <TabsContent value="ai" className="space-y-4 sm:space-y-6">
                  {/* Interactive AI Analyst - Always show this */}
                  <ContractAIAnalyst
                    contract={{
                      id: params.id as string,
                      name: contract?.filename || contract?.document_title || 'Contract',
                      supplierName: contract?.supplierName || metadata.external_parties?.find(p => p.role?.toLowerCase() === 'supplier' || p.role?.toLowerCase() === 'vendor')?.legalName || metadata.external_parties?.[0]?.legalName,
                      contractType: contract?.category?.name || contract?.contractType || undefined,
                      totalValue: typeof contract?.totalValue === 'number' ? contract.totalValue : undefined,
                      startDate: metadata.start_date || undefined,
                      endDate: metadata.end_date || undefined,
                      status: contract?.status,
                      extractedText: contract?.rawText || undefined,
                      metadata: {
                        jurisdiction: metadata.jurisdiction,
                        language: metadata.contract_language,
                        noticePeriod: metadata.notice_period,
                        parties: metadata.external_parties,
                        paymentType: metadata.payment_type,
                        currency: metadata.currency,
                      },
                    }}
                    defaultExpanded={!contract?.extractedData}
                    className="mb-6"
                  />

                  {contract?.extractedData ? (
                    <ComprehensiveAIAnalysis
                      artifacts={contract.extractedData}
                      contractId={params.id as string}
                      contractType={contract?.category?.name || metadata.contract_type}
                      className="w-full"
                      documentText={contract.rawText || undefined}
                    />
                  ) : (
                    <Card className="border-slate-200">
                      <CardContent className="py-12">
                        <div className="text-center max-w-sm mx-auto">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-slate-100 mb-4">
                            <Brain className="h-6 w-6 text-slate-600" />
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 mb-2">
                            AI Analysis Not Available
                          </h3>
                          <p className="text-sm text-slate-500 mb-6">
                            Run AI analysis to extract key terms, identify risks, and get actionable insights.
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            <Button 
                              onClick={handleAIExtraction} 
                              disabled={isExtractingAI}
                              className="gap-2"
                            >
                              {isExtractingAI ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  Run Analysis
                                </>
                              )}
                            </Button>
                            <Button variant="outline" onClick={handleAnalyzeWithAI} className="gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Chat with AI
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Intelligence Brief */}
                  <SectionErrorBoundary sectionName="Intelligence Brief">
                    <ContractIntelligenceBrief
                      contractId={params.id as string}
                      contractName={contract?.filename || contract?.document_title || 'Contract'}
                    />
                  </SectionErrorBoundary>

                  {/* Predictive Insights + Negotiation Copilot */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <SectionErrorBoundary sectionName="Predictive Insights">
                      <PredictiveInsightsWidget contractId={params.id as string} />
                    </SectionErrorBoundary>
                    <SectionErrorBoundary sectionName="Negotiation Copilot">
                      <EnhancedNegotiationPanel
                        contractId={params.id as string}
                        contractName={contract?.filename || contract?.document_title || 'Contract'}
                      />
                    </SectionErrorBoundary>
                  </div>
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 sm:space-y-6">
                  {/* Contract Scores & Assessment - Prominent position */}
                  <ContractScoresCard
                    riskInfo={riskInfo}
                    complianceInfo={complianceInfo}
                    healthInfo={{
                      score: healthData?.healthScore ?? 100,
                      completeness: healthData?.completeness ?? 0,
                      issues: healthData?.issues || [],
                    }}
                    extractionConfidence={extractionConfidence}
                    isProcessing={isProcessing}
                    onRefresh={loadContract}
                  />
                  
                  {/* Contract Metadata */}
                  <EnhancedContractMetadataSection
                    contractId={params.id as string}
                    tenantId="demo"
                    contract={contract as unknown as Record<string, unknown>}
                    overviewData={overviewData}
                    financialData={financialData}
                    onRefresh={loadContract}
                    onVerificationChange={() => loadHealthData()}
                  />
                  
                  {/* Contract Relationships - Improved UI with AI suggestions */}
                  <ContractRelationshipsCard
                    contractId={params.id as string}
                    contractTitle={contract?.filename}
                    parentContract={contract?.parentContract}
                    childContracts={contract?.childContracts}
                    parentContractId={contract?.parentContractId}
                    relationshipType={contract?.relationshipType}
                    relationshipNote={contract?.relationshipNote}
                    linkedAt={contract?.linkedAt}
                    isEditing={isEditing}
                    onLinkParent={async (parentId, relType, note) => {
                      const response = await fetch(`/api/contracts/${params.id}/hierarchy`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parentContractId: parentId, relationshipType: relType, relationshipNote: note }),
                      })
                      if (!response.ok) throw new Error('Failed to link parent contract')
                      toast.success('Contract linked successfully')
                      await loadContract()
                    }}
                    onUnlinkParent={async () => {
                      const response = await fetch(`/api/contracts/${params.id}/hierarchy`, { method: 'DELETE' })
                      if (!response.ok) throw new Error('Failed to unlink parent contract')
                      toast.success('Contract unlinked')
                      await loadContract()
                    }}
                  />

                  {/* AI Extraction Accuracy & Learning */}
                  <ExtractionAccuracyCard
                    contractId={params.id as string}
                    onUpdate={loadContract}
                    fields={[
                      { name: 'supplierName', label: 'Supplier', value: metadata.external_parties?.find(p => p.role?.toLowerCase() === 'supplier' || p.role?.toLowerCase() === 'vendor')?.legalName || contract?.supplierName, confidence: extractionConfidence ?? 0, source: 'ai' },
                      { name: 'clientName', label: 'Client', value: metadata.external_parties?.find(p => p.role?.toLowerCase() === 'client' || p.role?.toLowerCase() === 'buyer')?.legalName || contract?.clientName, confidence: extractionConfidence ?? 0, source: 'ai' },
                      { name: 'totalValue', label: 'Total Value', value: metadata.tcv_amount ?? contract?.totalValue, confidence: extractionConfidence ?? 0, source: 'ai' },
                      { name: 'effectiveDate', label: 'Effective Date', value: metadata.start_date || contract?.effectiveDate, confidence: extractionConfidence ?? 0, source: 'ai' },
                      { name: 'expirationDate', label: 'Expiration Date', value: metadata.end_date || contract?.expirationDate, confidence: extractionConfidence ?? 0, source: 'ai' },
                      { name: 'contractType', label: 'Contract Type', value: metadata.contract_type || contract?.contractType, confidence: extractionConfidence ?? 0, source: 'ai' },
                    ].filter(f => f.value !== null && f.value !== undefined)}
                  />
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-4">
                  {/* Version History */}
                  <SectionErrorBoundary sectionName="Version History">
                    <VersionManager
                      contractId={params.id as string}
                      contractTitle={metadata.document_title || contract?.filename || 'Contract'}
                      onVersionChange={() => {
                        toast.success('Version updated')
                        loadContract()
                      }}
                    />
                  </SectionErrorBoundary>
                  
                  {/* Notes & Comments */}
                  <ContractNotes
                    contractId={params.id as string}
                    notes={notes}
                    currentUserId={session?.user?.id ?? "anonymous"}
                    onAddNote={async (content) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
                        body: JSON.stringify({ content })
                      })
                      if (!response.ok) throw new Error('Failed to add note')
                      loadNotes() // Refresh notes after adding
                    }}
                    onEditNote={async (id, content) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
                        body: JSON.stringify({ content })
                      })
                      if (!response.ok) throw new Error('Failed to edit note')
                      loadNotes() // Refresh notes after editing
                    }}
                    onDeleteNote={async (id) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'DELETE',
                        headers: { 'x-tenant-id': getTenantId() }
                      })
                      if (!response.ok) throw new Error('Failed to delete note')
                      loadNotes() // Refresh notes after deleting
                    }}
                    onPinNote={async (id, pinned) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
                        body: JSON.stringify({ isPinned: pinned })
                      })
                      if (!response.ok) throw new Error('Failed to update note')
                      loadNotes() // Refresh notes after pinning
                    }}
                  />
                  
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-violet-500" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ActivityTab contractId={params.id as string} />
                    </CardContent>
                  </Card>
                  
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <History className="h-4 w-4 text-slate-500" />
                        Audit Log
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ContractAuditLog contractId={params.id as string} maxHeight="300px" />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        documentId={params.id as string}
        documentType="contract"
        documentTitle={contract?.filename || 'Contract'}
      />

      <ContractComparison
        contractId={params.id as string}
        versions={contractVersions.length > 0 ? contractVersions : [
          { id: contract?.id || 'current', version: 'v1.0', title: 'Current Version', createdAt: contract?.uploadDate ? new Date(contract.uploadDate) : new Date(), createdBy: 'System', status: 'active' as const }
        ]}
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
      />

      <Dialog open={showCategorySelector} onOpenChange={setShowCategorySelector}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base font-semibold">
              <span>Assign Category</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCategorySelector(false)
                  handleAICategorize()
                }}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Categorize
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <CategorySelector
              value={contract?.category?.id || null}
              onChange={(category) => {
                if (category) {
                  handleCategorySelect(category.id)
                }
              }}
              tenantId="demo"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <ContractReminderDialog
        isOpen={showReminderDialog}
        onClose={() => setShowReminderDialog(false)}
        contractId={params.id as string}
        contractName={contract?.filename || 'Contract'}
        expirationDate={metadata.end_date}
        currentConfig={{
          enabled: metadata.reminder_enabled ?? contract?.reminder_enabled ?? false,
          daysBeforeExpiry: metadata.reminder_days_before_end ?? contract?.reminder_days_before_end ?? 30,
          notificationChannels: ['email', 'in-app'],
        }}
        onSave={async (config) => {
          const response = await fetch(`/api/contracts/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
            body: JSON.stringify({
              reminder_enabled: config.enabled,
              reminder_days_before_end: config.daysBeforeExpiry,
            })
          })
          if (!response.ok) throw new Error('Failed to save reminder')
          await loadContract()
        }}
      />

      {/* Floating Actions */}
      <ContractFloatingActions
        contractId={params.id as string}
        filename={contract?.filename || 'Contract'}
        isFavorite={isFavorite}
        hasReminder={metadata.reminder_enabled ?? contract?.reminder_enabled ?? false}
        isArchived={contract?.status === 'archived'}
        isExpired={metadata.end_date ? new Date(metadata.end_date) < new Date() : false}
        onToggleFavorite={async () => {
          const response = await fetch(`/api/contracts/${params.id}/favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
            body: JSON.stringify({ favorite: !isFavorite })
          })
          if (!response.ok) throw new Error('Failed to toggle favorite')
          setIsFavorite(!isFavorite)
        }}
        onToggleReminder={() => {
          setShowReminderDialog(true)
          return Promise.resolve()
        }}
        onDelete={async () => {
          const response = await fetch(`/api/contracts/${params.id}`, {
            method: 'DELETE',
            headers: { 'x-tenant-id': getTenantId() }
          })
          if (!response.ok) throw new Error('Failed to delete contract')
          // Invalidate cache before navigating so list page shows fresh data
          crossModule.onContractChange(params.id as string)
          router.push('/contracts')
        }}
        onArchive={async () => {
          const newStatus = contract?.status === 'archived' ? 'active' : 'archived'
          const response = await fetch(`/api/contracts/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
            body: JSON.stringify({ status: newStatus })
          })
          if (!response.ok) throw new Error('Failed to archive contract')
          await loadContract()
        }}
        onExport={async (format) => {
          const response = await fetch(`/api/contracts/${params.id}/export?format=${format}`, {
            headers: { 'x-tenant-id': getTenantId() },
          })
          if (!response.ok) throw new Error('Export failed')
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `contract-${params.id}.${format}`
          document.body.appendChild(a)
          a.click()
          a.remove()
          window.URL.revokeObjectURL(url)
        }}
        onPrint={() => window.print()}
        onCreateRenewal={() => router.push(`/contracts/${params.id}/renew`)}
      />

    </div>
  )
}

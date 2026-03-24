'use client'

import React, { useEffect, useCallback, lazy, Suspense } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useDataMode } from '@/contexts/DataModeContext'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Link2,
  PenTool,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant'
import { toast } from 'sonner'
import { ShareDialog } from '@/components/collaboration/ShareDialog'
import { useWebSocket } from '@/contexts/websocket-context'
import { useCrossModuleInvalidation } from '@/hooks/use-queries'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ContractComparison,
  CategorySelector,
  EnhancedContractMetadataSection,
  ContractRelationshipsCard,
  ContractScoresCard,
  ExtractionAccuracyCard,
} from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { VersionManager } from '@/components/contracts/VersionManager'
import { useSplitPaneResize } from '@/hooks/use-split-pane-resize'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Breadcrumbs } from '@/components/breadcrumbs'

import './print.css'

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
import { useContractMetadata, useContractUIStore } from './hooks'
import {
  contractKeys,
  useContractQuery,
  useVersionsQuery,
  useNotesQuery,
  useHealthQuery,
  useExtractionConfidenceQuery,
  useNoteMutations,
  useAIExtraction,
  useExtractObligations,
  useExtendContract,
  useUploadSignedCopy,
  useCategoryMutations,
} from './hooks/useContractQueries'
import type { ContractData, AIExtensionRecommendation, TabValue } from './types'

// Lazy-load heavy AI tab components (only fetched when user clicks AI tab)
const ComprehensiveAIAnalysis = lazy(() =>
  import('@/components/artifacts/ComprehensiveAIAnalysis').then((m) => ({ default: m.ComprehensiveAIAnalysis }))
)
const ContractAIAnalyst = lazy(() =>
  import('@/components/contracts/ContractAIAnalyst').then((m) => ({ default: m.ContractAIAnalyst }))
)
const ContractIntelligenceBrief = lazy(() =>
  import('@/components/ai/ContractIntelligenceBrief').then((m) => ({ default: m.ContractIntelligenceBrief }))
)
const EnhancedNegotiationPanel = lazy(() =>
  import('@/components/ai/EnhancedNegotiationPanel').then((m) => ({ default: m.EnhancedNegotiationPanel }))
)
const PredictiveInsightsWidget = lazy(() =>
  import('@/components/ai/PredictiveInsightsWidget').then((m) => ({ default: m.PredictiveInsightsWidget }))
)
const ActivityTab = lazy(() =>
  import('@/components/contracts/detail/ActivityTab').then((m) => ({ default: m.ActivityTab }))
)
const ContractAuditLog = lazy(() =>
  import('@/components/contracts/ContractAuditLog').then((m) => ({ default: m.ContractAuditLog }))
)

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
    </div>
  )
}


// ============================================================================
// Valid tabs for URL deep-linking
// ============================================================================
const VALID_TABS = new Set<TabValue>(['overview', 'details', 'ai', 'activity'])

// ============================================================================
// Main Component
// ============================================================================
export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { data: session } = useSession()
  const { dataMode } = useDataMode()
  const wsContext = useWebSocket()
  const crossModule = useCrossModuleInvalidation()
  const queryClient = useQueryClient()
  const contractId = params.id as string

  // ── Zustand UI state ──────────────────────────────────────────────────────
  const {
    activeTab, showPdfViewer, isEditing, isFavorite,
    showShareDialog, showComparison, showCategorySelector,
    showReminderDialog, showUploadSignedDialog, showExtendDialog,
    setActiveTab, setShowPdfViewer, togglePdfViewer,
    openDialog, closeDialog, setIsEditing, setIsFavorite,
  } = useContractUIStore()

  // ── React Query data ──────────────────────────────────────────────────────
  const {
    data: contract,
    isLoading: loading,
    error: queryError,
    refetch: refetchContract,
  } = useContractQuery(contractId, dataMode)

  const { data: versionsData } = useVersionsQuery(contractId, dataMode)
  const { data: notesData } = useNotesQuery(contractId, activeTab === 'activity')
  const { data: healthData } = useHealthQuery(contractId)
  const { data: extractionConfidence } = useExtractionConfidenceQuery(contractId)

  const contractVersions = versionsData?.versions ?? []
  const currentVersionNumber = versionsData?.currentVersionNumber ?? 1
  const notes = notesData ?? []
  const error = queryError?.message ?? null

  // ── Derived metadata ──────────────────────────────────────────────────────
  const { metadata, riskInfo, complianceInfo, isProcessing, overviewData, financialData } =
    useContractMetadata(contract as any)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const aiExtraction = useAIExtraction(contractId)
  const extractObligations = useExtractObligations(contractId)
  const extendContract = useExtendContract(contractId)
  const uploadSignedCopy = useUploadSignedCopy(contractId)
  const { setCategory, aiCategorize } = useCategoryMutations(contractId)
  const { addNote, editNote, deleteNote, pinNote } = useNoteMutations(contractId)

  // ── Extension dialog local state ──────────────────────────────────────────
  const [extensionDate, setExtensionDate] = React.useState('')
  const [extensionNote, setExtensionNote] = React.useState('')
  const [extensionValue, setExtensionValue] = React.useState('')
  const [aiExtensionRec, setAiExtensionRec] = React.useState<AIExtensionRecommendation | null>(null)
  const [aiExtensionLoading, setAiExtensionLoading] = React.useState(false)
  const signedFileRef = React.useRef<HTMLInputElement>(null)

  // ── Split pane for PDF viewer ─────────────────────────────────────────────
  const isMobile = useMediaQuery('(max-width: 768px)')
  const {
    containerRef: splitContainerRef,
    ratio: pdfSplitRatio,
    setRatio: setPdfSplitRatio,
    isResizing: isResizingPanel,
    beginResize: beginResizePanel,
    aria: splitAria,
  } = useSplitPaneResize({ initialRatio: 45, minRatio: 20, maxRatio: 75 })

  // ── URL sync for tabs & PDF viewer ────────────────────────────────────────
  const setTab = useCallback((tab: string) => {
    if (!VALID_TABS.has(tab as TabValue)) return
    setActiveTab(tab as TabValue)
    const next = new URLSearchParams(searchParams?.toString?.() || '')
    next.set('tab', tab)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, setActiveTab])

  const setPdfViewerOpen = useCallback((open: boolean) => {
    setShowPdfViewer(open)
    const next = new URLSearchParams(searchParams?.toString?.() || '')
    if (open) next.set('pdf', '1')
    else next.delete('pdf')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, searchParams, setShowPdfViewer])

  // Initialize tab and PDF from URL
  useEffect(() => {
    const requestedTab = searchParams?.get?.('tab') as TabValue | null
    if (requestedTab && VALID_TABS.has(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
    const shouldShowPdf = searchParams?.get?.('pdf') === '1'
    if (shouldShowPdf !== showPdfViewer) {
      setShowPdfViewer(shouldShowPdf)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── WebSocket connection ──────────────────────────────────────────────────
  useEffect(() => {
    if (contractId && wsContext?.joinDocument) {
      wsContext.joinDocument(contractId, 'contract')
    }
    return () => { wsContext?.leaveDocument?.() }
  }, [contractId, wsContext])

  // ── Auto-refresh while processing ─────────────────────────────────────────
  useEffect(() => {
    if (!isProcessing || !contract) return

    let emptyCompletedPolls = 0
    const MAX_EMPTY_COMPLETED_POLLS = 12

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}`, {
          headers: { 'x-data-mode': dataMode },
        })
        if (!response.ok) return
        const raw = await response.json()
        const data = raw.data ?? raw
        const newStatus = data.status?.toLowerCase()

        if (newStatus && newStatus !== 'processing' && newStatus !== 'uploaded') {
          const hasData = data.extractedData && typeof data.extractedData === 'object' &&
            Object.keys(data.extractedData).length > 0
          if (!hasData && emptyCompletedPolls < MAX_EMPTY_COMPLETED_POLLS) {
            emptyCompletedPolls++
            return
          }
          clearInterval(pollInterval)
          queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
        }
      } catch { /* retry on next interval */ }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [isProcessing, contract, contractId, dataMode, queryClient])


  // ── Action handlers ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetchContract()
  }, [refetchContract])

  const fetchAiExtensionRec = useCallback(async () => {
    if (aiExtensionLoading) return
    setAiExtensionLoading(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/extend/ai-recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const raw = await response.json()
        const data = raw.data ?? raw
        setAiExtensionRec(data.recommendation)
      }
    } catch { /* AI recommendation is optional */ }
    finally { setAiExtensionLoading(false) }
  }, [contractId, aiExtensionLoading])

  const handleExtendContract = useCallback(async () => {
    if (!extensionDate) {
      toast.error('Please select a new expiration date')
      return
    }
    try {
      const result = await extendContract.mutateAsync({
        newExpirationDate: new Date(extensionDate).toISOString(),
        ...(extensionValue ? { newTotalValue: parseFloat(extensionValue) } : {}),
        extensionNote: extensionNote || undefined,
      })
      const ext = (result.data ?? result).extension
      toast.success(`Contract extended by ${ext?.extensionDays || ''} days`)
      closeDialog('extend')
      setExtensionDate('')
      setExtensionNote('')
      setExtensionValue('')
      crossModule.onContractChange(contractId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extend contract')
    }
  }, [extensionDate, extensionNote, extensionValue, contractId, extendContract, crossModule, closeDialog])

  const handleDownload = useCallback(async () => {
    try {
      toast.info('Preparing download...')
      const response = await fetch(`/api/contracts/${contractId}/download`, {
        headers: { 'x-tenant-id': getTenantId() },
      })

      if (!response.ok) {
        const exportResp = await fetch(`/api/contracts/${contractId}/export?format=pdf`, {
          headers: { 'x-tenant-id': getTenantId() },
        })
        if (!exportResp.ok) throw new Error('Export failed')
        const blob = await exportResp.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `contract-${contractId}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.success('Download started (exported)')
        return
      }

      const disposition = response.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/)
      const downloadName = filenameMatch?.[1] || contract?.filename || `contract-${contractId}`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Download started')
    } catch {
      toast.error('Failed to download contract')
    }
  }, [contractId, contract?.filename])

  const handleRequestSignature = useCallback(() => {
    router.push(`/contracts/${contractId}/esign`)
  }, [contractId, router])

  const handleUploadSignedCopy = useCallback(async (file: File, signers?: string, notes?: string) => {
    try {
      await uploadSignedCopy.mutateAsync({ file, signers, notes })
      closeDialog('uploadSigned')
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload signed copy')
    }
  }, [uploadSignedCopy, closeDialog])

  const handleDownloadSignedCopy = useCallback(async () => {
    try {
      toast.info('Downloading signed copy...')
      const response = await fetch(`/api/contracts/${contractId}/signed-copy`, {
        headers: { 'x-tenant-id': getTenantId() },
      })
      if (!response.ok) throw new Error('Signed copy not found')

      const disposition = response.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/)
      const downloadName = filenameMatch?.[1] || `signed-contract-${contractId}.pdf`

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Signed copy downloaded')
    } catch {
      toast.error('Failed to download signed copy')
    }
  }, [contractId])

  const handleAIExtraction = useCallback(async () => {
    aiExtraction.mutate()
  }, [aiExtraction])

  const handleExtractObligations = useCallback(async () => {
    extractObligations.mutate(undefined, {
      onSuccess: (data) => {
        const count = data?.obligations?.length || 0
        if (count > 0) {
          toast.success(`Successfully extracted ${count} obligation${count > 1 ? 's' : ''} from this contract!`, {
            action: {
              label: 'View Obligations',
              onClick: () => router.push(`/obligations?contract=${contractId}`),
            },
          })
        } else {
          toast.warning('No obligations found in this contract.')
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to extract obligations')
      },
    })
  }, [extractObligations, contractId, router])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    setCategory.mutate(categoryId, {
      onSuccess: () => {
        closeDialog('categorySelector')
        crossModule.onTaxonomyChange()
      },
      onError: () => {
        toast.error('Failed to update category')
      },
    })
  }, [setCategory, crossModule, closeDialog])

  const handleAICategorize = useCallback(async () => {
    aiCategorize.mutate(undefined, {
      onSuccess: () => {
        crossModule.onTaxonomyChange()
      },
      onError: () => {
        toast.error('Failed to run AI categorization')
      },
    })
  }, [aiCategorize, crossModule])

  const handleAnalyzeWithAI = useCallback(() => {
    const partyNames = metadata.external_parties
      .filter((p: any) => p.legalName)
      .map((p: any) => p.legalName)
      .join(' and ')
    window.dispatchEvent(new CustomEvent('openAIChatbot', {
      detail: {
        autoMessage: `Analyze this contract "${metadata.document_title || contract?.filename || 'Contract'}"${partyNames ? ` between ${partyNames}` : ''}. What are the key terms, obligations, and risks I should be aware of?`,
        contractId: contract?.id,
      },
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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
          case 'd': e.preventDefault(); handleDownload(); break
          case 'r': e.preventDefault(); handleRefresh(); break
          case 's': if (isEditing) e.preventDefault(); break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, setPdfViewerOpen, setTab, showPdfViewer, handleDownload, handleRefresh, setIsEditing])


  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    const isNotFound = error.includes('not found') || error.includes('404')
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/20 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Card className="max-w-md w-full bg-white/90 backdrop-blur-xl border-white/50 shadow-xl">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                  className={cn(
                    'mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 shadow-lg',
                    isNotFound
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-red-500 to-rose-600'
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
                    <Button onClick={handleRefresh} size="sm" className="bg-gradient-to-r from-violet-500 to-purple-600">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  <Button variant={isNotFound ? 'default' : 'outline'} size="sm" asChild>
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

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 mb-6 sm:mb-8">
            <div className="h-8 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
            <div className="h-6 w-48 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
          </motion.div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[1, 2, 3, 4].map((i) => (
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


  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print-container">
      <SkipToContent targetId="main-content" />

      {/* Breadcrumbs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 no-print">
        <div className="flex items-center justify-between">
          <Breadcrumbs
            items={[
              { label: 'Contracts', href: '/contracts', icon: FileText },
              { label: contract?.filename || 'Contract Details' },
            ]}
            showHomeIcon
          />
          <KeyboardShortcutsHelp />
        </div>
      </div>

      {/* Header */}
      <ContractHeader
        contractId={contractId}
        filename={contract?.filename || ''}
        status={contract?.status || 'unknown'}
        currentVersion={currentVersionNumber}
        showPdfViewer={showPdfViewer}
        isEditing={isEditing}
        isExtractingAI={aiExtraction.isPending}
        isExtractingObligations={extractObligations.isPending}
        isExpiredOrExpiring={
          metadata.end_date
            ? new Date(metadata.end_date) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            : false
        }
        onRefresh={handleRefresh}
        onTogglePdf={() => setPdfViewerOpen(!showPdfViewer)}
        onEdit={() => setIsEditing(true)}
        onAIExtract={handleAIExtraction}
        onExtractObligations={handleExtractObligations}
        onDownload={handleDownload}
        onShare={() => openDialog('share')}
        onCompare={() => openDialog('comparison')}
        onCreateRenewal={() => router.push(`/contracts/${contractId}/renew`)}
        onExtendContract={() => { openDialog('extend'); fetchAiExtensionRec() }}
      />

      {/* Main Content with optional PDF split */}
      <div
        ref={splitContainerRef}
        className={cn(
          showPdfViewer && !isMobile ? 'flex h-[calc(100vh-4rem)]' : '',
          showPdfViewer && isMobile ? 'flex flex-col h-[calc(100vh-4rem)]' : '',
          isResizingPanel && 'select-none'
        )}
      >
        {/* PDF Viewer Panel */}
        {showPdfViewer && (
          <>
            <div
              className={cn(
                'bg-slate-100 dark:bg-slate-800 flex-shrink-0 relative',
                isMobile ? 'w-full h-[50vh]' : 'h-full'
              )}
              style={isMobile ? undefined : { width: `${pdfSplitRatio}%`, minWidth: '280px' }}
            >
              <RobustPDFViewer
                contractId={contractId}
                filename={contract?.filename || 'Contract'}
                height="100%"
                onToggle={() => setPdfViewerOpen(false)}
                isExpanded={showPdfViewer}
              />
            </div>

            {/* Resize Handle */}
            {!isMobile && (
              <div
                className={cn(
                  'w-1.5 cursor-col-resize bg-slate-300 dark:bg-slate-600 hover:bg-violet-500 transition-colors flex-shrink-0',
                  'flex items-center justify-center group',
                  isResizingPanel && 'bg-violet-500'
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

        {/* Details Panel */}
        <div
          id="main-content"
          tabIndex={-1}
          className={cn('overflow-auto', showPdfViewer ? 'flex-1' : 'w-full')}
          style={showPdfViewer && !isMobile ? { minWidth: '320px' } : undefined}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Processing Banner */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  key="processing"
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
                          <p className="text-sm font-medium text-violet-900">
                            Processing Contract...
                          </p>
                          <p className="text-xs text-violet-600 truncate">
                            {contract?.processing?.currentStage || 'Analyzing document'}
                            {contract?.processing?.progress ? ` — ${contract.processing.progress}%` : ''}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status Banners */}
            <ContractStatusBanner
              endDate={metadata.end_date}
              riskLevel={riskInfo.riskLevel}
              complianceOk={complianceInfo.isCompliant}
              contractStatus={contract?.status}
              signatureStatus={metadata.signature_status}
              documentClassification={metadata.document_classification}
              documentClassificationWarning={metadata.document_classification_warning}
              onAction={() => setTab('overview')}
              onInitiateRenewal={() => router.push(`/contracts/${contractId}/renew`)}
              onSetReminder={() => openDialog('reminder')}
              onStartReview={() => router.push(`/contracts/${contractId}/legal-review`)}
              onStartRedline={() => router.push(`/contracts/${contractId}/redline`)}
            />

            {/* Quick Overview */}
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


            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8 no-print">
              {contract?.category && (
                <button onClick={() => openDialog('categorySelector')} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 hover:border-violet-300 transition-colors">
                  <Tag className="h-3 w-3" />
                  {contract.category.name}
                </button>
              )}
              {!contract?.category && (
                <button onClick={handleAICategorize} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 border border-violet-200 hover:bg-violet-100 text-violet-700 transition-colors">
                  <Sparkles className="h-3 w-3" />
                  Auto-categorize
                </button>
              )}
              {contract?.signature_status === 'unsigned' && (
                <button onClick={handleRequestSignature} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 transition-colors">
                  <PenTool className="h-3 w-3" />
                  Request Signature
                </button>
              )}
              {contract?.signature_status === 'signed' && (
                <button onClick={handleDownloadSignedCopy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 border border-green-200 hover:bg-green-100 text-green-700 transition-colors">
                  <CheckCircle2 className="h-3 w-3" />
                  Download Signed
                </button>
              )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setTab} className="space-y-4 sm:space-y-6">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-white/80 backdrop-blur-sm border border-slate-200/60 p-1 rounded-xl shadow-sm h-auto">
                <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Summary</span>
                </TabsTrigger>
                <TabsTrigger value="details" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all">
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Details</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all">
                  <History className="h-3.5 w-3.5" />
                  <span>Activity</span>
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-1.5 text-xs sm:text-sm py-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white rounded-lg transition-all">
                  <Brain className="h-3.5 w-3.5" />
                  <span>AI</span>
                </TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6 mt-0">
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
                <SectionErrorBoundary sectionName="Timeline">
                  <ContractTimeline
                        signatureDate={metadata.signature_date}
                        startDate={metadata.start_date}
                        endDate={metadata.end_date}
                        terminationDate={metadata.termination_date}
                      />
                </SectionErrorBoundary>
                <SectionErrorBoundary sectionName="Related Contracts">
                  <RelatedContracts contractId={contractId} />
                </SectionErrorBoundary>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4 sm:space-y-6 mt-0">
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
                    onRefresh={handleRefresh}
                  />
                <EnhancedContractMetadataSection
                    contractId={contractId}
                    tenantId="demo"
                    contract={contract as unknown as Record<string, unknown>}
                    overviewData={overviewData}
                    financialData={financialData}
                    onRefresh={handleRefresh}
                    onVerificationChange={() => {
                      queryClient.invalidateQueries({ queryKey: contractKeys.health(contractId) })
                    }}
                  />
                <ContractRelationshipsCard
                    contractId={contractId}
                    contractTitle={contract?.filename}
                    parentContract={contract?.parentContract}
                    childContracts={contract?.childContracts}
                    parentContractId={contract?.parentContractId}
                    relationshipType={contract?.relationshipType}
                    relationshipNote={contract?.relationshipNote}
                    linkedAt={contract?.linkedAt}
                    isEditing={isEditing}
                  />
                <ExtractionAccuracyCard contractId={contractId} />
              </TabsContent>

              {/* Activity Tab — lazy-loaded */}
              <TabsContent value="activity" className="space-y-4 sm:space-y-6 mt-0">
                <VersionManager
                    contractId={contractId}
                    contractTitle={contract?.filename || 'Contract'}
                    onVersionChange={() => {
                      queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
                    }}
                  />
                <ContractNotes
                    contractId={contractId}
                    notes={notes}
                    currentUserId={session?.user?.id ?? 'anonymous'}
                    onAddNote={async (content) => { await addNote.mutateAsync(content) }}
                    onEditNote={async (id, content) => { await editNote.mutateAsync({ noteId: id, content }) }}
                    onDeleteNote={async (id) => { await deleteNote.mutateAsync(id) }}
                    onPinNote={async (id, pinned) => { await pinNote.mutateAsync({ noteId: id, isPinned: pinned }) }}
                  />
                <Suspense fallback={<TabFallback />}>
                  <ActivityTab contractId={contractId} />
                </Suspense>
                <Suspense fallback={<TabFallback />}>
                  <ContractAuditLog contractId={contractId} />
                </Suspense>
              </TabsContent>

              {/* AI Tab — fully lazy-loaded */}
              <TabsContent value="ai" className="space-y-4 sm:space-y-6 mt-0">
                <Suspense fallback={<TabFallback />}>
                  {contract?.rawText || contract?.extractedData ? (
                    <>
                      <ContractAIAnalyst
                        contract={{
                          id: contractId,
                          name: contract?.filename || contract?.document_title || 'Contract',
                          supplierName: contract?.supplierName || metadata.external_parties?.find((p: { role?: string }) => p.role?.toLowerCase() === 'supplier' || p.role?.toLowerCase() === 'vendor')?.legalName || metadata.external_parties?.[0]?.legalName,
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
                      <ComprehensiveAIAnalysis
                        artifacts={contract?.extractedData as any}
                        contractId={contractId}
                        contractType={contract?.category?.name || metadata.contract_type}
                        className="w-full"
                        documentText={contract?.rawText || undefined}
                      />
                      <SectionErrorBoundary sectionName="Intelligence Brief">
                        <ContractIntelligenceBrief
                          contractId={contractId}
                          contractName={contract?.filename || contract?.document_title || 'Contract'}
                        />
                      </SectionErrorBoundary>
                      <SectionErrorBoundary sectionName="Predictive Insights">
                        <PredictiveInsightsWidget contractId={contractId} />
                      </SectionErrorBoundary>
                      <SectionErrorBoundary sectionName="Negotiation Copilot">
                        <EnhancedNegotiationPanel
                          contractId={contractId}
                          contractName={contract?.filename || contract?.document_title || 'Contract'}
                        />
                      </SectionErrorBoundary>
                    </>
                  ) : (
                    <Card className="border-dashed border-2 border-slate-200">
                      <CardContent className="py-12 text-center">
                        <Brain className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">AI Analysis Not Available</h3>
                        <p className="text-sm text-slate-500 mb-4">
                          This contract hasn&apos;t been processed by AI yet.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button onClick={handleAIExtraction} disabled={aiExtraction.isPending}>
                            {aiExtraction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            <Sparkles className="h-4 w-4 mr-2" />
                            Run Analysis
                          </Button>
                          <Button variant="outline" onClick={handleAnalyzeWithAI}>
                            <Brain className="h-4 w-4 mr-2" />
                            Chat with AI
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Suspense>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>


      {/* Floating Actions */}
      <ContractFloatingActions
        contractId={contractId}
        filename={contract?.filename || 'Contract'}
        isFavorite={isFavorite}
        hasReminder={metadata.reminder_enabled ?? contract?.reminder_enabled ?? false}
        isArchived={contract?.status === 'archived'}
        onToggleFavorite={async () => {
          const response = await fetch(`/api/contracts/${contractId}/favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
            body: JSON.stringify({ favorite: !isFavorite })
          })
          if (!response.ok) throw new Error('Failed to toggle favorite')
          setIsFavorite(!isFavorite)
        }}
        onToggleReminder={async () => {
          openDialog('reminder')
        }}
        onDelete={async () => {
          const response = await fetch(`/api/contracts/${contractId}`, {
            method: 'DELETE',
            headers: { 'x-tenant-id': getTenantId() }
          })
          if (!response.ok) throw new Error('Failed to delete contract')
          try { await crossModule.onContractChange(contractId) } catch {}
          router.push('/contracts')
        }}
        onArchive={async () => {
          const newStatus = contract?.status === 'archived' ? 'active' : 'archived'
          const response = await fetch(`/api/contracts/${contractId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
            body: JSON.stringify({ status: newStatus })
          })
          if (!response.ok) throw new Error('Failed to archive contract')
          queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
        }}
        onExport={async (format) => {
          const response = await fetch(`/api/contracts/${contractId}/export?format=${encodeURIComponent(format)}`, {
            headers: { 'x-tenant-id': getTenantId() },
          })
          if (!response.ok) throw new Error('Export failed')
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          try {
            const a = document.createElement('a')
            a.href = url
            a.download = `contract-${contractId}.${format}`
            document.body.appendChild(a)
            a.click()
            a.remove()
          } finally {
            window.URL.revokeObjectURL(url)
          }
        }}
        onPrint={() => window.print()}
      />

      {/* Dialogs */}
      {showShareDialog && (
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => closeDialog('share')}
          documentId={contractId}
          documentType="contract"
          documentTitle={contract?.filename || 'Contract'}
        />
      )}

      {showComparison && (
        <ContractComparison
          contractId={contractId}
          versions={contractVersions}
          isOpen={showComparison}
          onClose={() => closeDialog('comparison')}
        />
      )}

      {showCategorySelector && (
        <Dialog open={showCategorySelector} onOpenChange={() => closeDialog('categorySelector')}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select Category</DialogTitle>
            </DialogHeader>
            <CategorySelector
              value={contract?.category?.id || null}
              onChange={(category) => {
                if (category) {
                  handleCategorySelect(category.id)
                }
              }}
              tenantId="demo"
            />
          </DialogContent>
        </Dialog>
      )}

      {showReminderDialog && (
        <ContractReminderDialog
          isOpen={showReminderDialog}
          onClose={() => closeDialog('reminder')}
          contractId={contractId}
          contractName={contract?.filename || 'Contract'}
          expirationDate={metadata.end_date}
          currentConfig={{
            enabled: metadata.reminder_enabled ?? contract?.reminder_enabled ?? false,
            daysBeforeExpiry: metadata.reminder_days_before_end ?? contract?.reminder_days_before_end ?? 30,
            notificationChannels: ['email', 'in-app'],
          }}
          onSave={async (config) => {
            const response = await fetch(`/api/contracts/${contractId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
              body: JSON.stringify({
                reminder_enabled: config.enabled,
                reminder_days_before_end: config.daysBeforeExpiry,
              }),
            })
            if (!response.ok) throw new Error('Failed to save reminder')
            toast.success('Reminder settings saved')
            closeDialog('reminder')
            queryClient.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
          }}
        />
      )}

      {showUploadSignedDialog && (
        <Dialog open={showUploadSignedDialog} onOpenChange={() => closeDialog('uploadSigned')}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Signed Copy</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const file = formData.get('file') as File
                if (!file?.size) { toast.error('Please select a file'); return }
                handleUploadSignedCopy(file, formData.get('signers') as string, formData.get('notes') as string)
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="signed-file" className="block text-sm font-medium text-slate-700 mb-1">Signed Document</label>
                <input ref={signedFileRef} id="signed-file" name="file" type="file" accept=".pdf,.docx" required className="w-full text-sm" />
              </div>
              <div>
                <label htmlFor="signers" className="block text-sm font-medium text-slate-700 mb-1">Signers (optional)</label>
                <input id="signers" name="signers" placeholder="Names of signers" className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div>
                <label htmlFor="sign-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <input id="sign-notes" name="notes" placeholder="Any notes about the signing" className="w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => closeDialog('uploadSigned')}>Cancel</Button>
                <Button type="submit" disabled={uploadSignedCopy.isPending}>
                  {uploadSignedCopy.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Upload
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {showExtendDialog && (
        <Dialog open={showExtendDialog} onOpenChange={() => closeDialog('extend')}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Extend Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* AI Recommendation */}
              {aiExtensionLoading && (
                <div className="flex items-center gap-2 text-sm text-violet-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating AI recommendation...
                </div>
              )}
              {aiExtensionRec && (
                <Card className="border-violet-200 bg-violet-50/50">
                  <CardContent className="py-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-violet-900">{aiExtensionRec.recommendedAction}</p>
                        <p className="text-xs text-violet-600 mt-1">{aiExtensionRec.reasoning}</p>
                        {aiExtensionRec.suggestedExtensionMonths && (
                          <p className="text-xs text-violet-600 mt-1">Suggested: {aiExtensionRec.suggestedExtensionMonths} months</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <label htmlFor="ext-date" className="block text-sm font-medium text-slate-700 mb-1">New Expiration Date *</label>
                <input
                  id="ext-date"
                  type="date"
                  value={extensionDate}
                  onChange={(e) => setExtensionDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="ext-value" className="block text-sm font-medium text-slate-700 mb-1">New Total Value (optional)</label>
                <input
                  id="ext-value"
                  type="number"
                  value={extensionValue}
                  onChange={(e) => setExtensionValue(e.target.value)}
                  placeholder="Leave blank to keep current value"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="ext-note" className="block text-sm font-medium text-slate-700 mb-1">Extension Note (optional)</label>
                <textarea
                  id="ext-note"
                  value={extensionNote}
                  onChange={(e) => setExtensionNote(e.target.value)}
                  rows={2}
                  placeholder="Reason for extension..."
                  className="w-full px-3 py-2 border rounded-md text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => closeDialog('extend')}>Cancel</Button>
                <Button onClick={handleExtendContract} disabled={extendContract.isPending || !extensionDate}>
                  {extendContract.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Extend Contract
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  FileType,
  Activity,
  Globe,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
import { ShareDialog } from '@/components/collaboration/ShareDialog'
import { useWebSocket } from '@/contexts/websocket-context'
import { useCrossModuleInvalidation } from '@/hooks/use-queries'
import { formatDate } from '@/lib/design-tokens'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  AISummarizer, 
  ContractComparison, 
  CategoryBadge, 
  CategorySelector, 
  ContractAuditLog, 
  EnhancedContractMetadataSection, 
  ContractHierarchy 
} from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { ActivityTab } from '@/components/contracts/detail/ActivityTab'
import { useSplitPaneResize } from '@/hooks/use-split-pane-resize'
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
  ContractSearch,
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
}

// ============ MAIN COMPONENT ============

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dataMode } = useDataMode()
  const wsContext = useWebSocket()
  const crossModule = useCrossModuleInvalidation()
  
  // Core state
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  // UI state
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showAISummarizer, setShowAISummarizer] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [showCategoryConfirm, setShowCategoryConfirm] = useState(false)
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [isExtractingAI, setIsExtractingAI] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<{ id: string; name: string } | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  
  // Contract versions for comparison
  const [contractVersions, setContractVersions] = useState<Array<{
    id: string
    version: string
    title: string
    createdAt: Date
    createdBy: string
    status: 'active' | 'archived'
  }>>([])
  
  // Split pane for PDF viewer
  const {
    containerRef: splitContainerRef,
    ratio: pdfSplitRatio,
    setRatio: setPdfSplitRatio,
    isResizing: isResizingPanel,
    beginResize: beginResizePanel,
    aria: splitAria,
  } = useSplitPaneResize({ initialRatio: 45, minRatio: 20, maxRatio: 75 })

  // Use the custom hook for metadata derivation
  const { metadata, riskInfo, complianceInfo, isProcessing, overviewData, financialData } = useContractMetadata(contract)

  // ============ KEYBOARD SHORTCUTS ============
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key) {
          case '1': setActiveTab('overview'); break
          case '2': setActiveTab('details'); break
          case '3': setActiveTab('activity'); break
          case 'p': case 'P': setShowPdfViewer(prev => !prev); break
          case 'e': case 'E': if (!isEditing) setIsEditing(true); break
          case 'f': case 'F': setIsFavorite(prev => !prev); break
          case '?': setShowShortcutsDialog(true); break
          case 'Escape':
            if (isEditing) setIsEditing(false)
            if (showPdfViewer) setShowPdfViewer(false)
            if (showShortcutsDialog) setShowShortcutsDialog(false)
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
  }, [isEditing, showPdfViewer])

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
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      setContract(data)
      loadVersions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
      console.error('Failed to load contract:', err)
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
      
      const data = await response.json()
      if (data.versions && Array.isArray(data.versions)) {
        setContractVersions(data.versions.map((v: any) => ({
          id: v.id,
          version: `v${v.versionNumber}.0`,
          title: v.summary || (v.isActive ? 'Current Version' : `Version ${v.versionNumber}`),
          createdAt: new Date(v.uploadedAt),
          createdBy: v.uploadedBy || 'System',
          status: v.isActive ? 'active' as const : 'archived' as const
        })))
      }
    } catch (err) {
      console.warn('Failed to load versions:', err)
    }
  }, [params.id, dataMode])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  // ============ ACTION HANDLERS ============
  const handleDownload = useCallback(async () => {
    try {
      toast.info('Preparing download...')
      const response = await fetch(`/api/contracts/${params.id}/export?format=pdf`, {
        headers: { 'x-tenant-id': 'demo' },
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
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download contract')
    }
  }, [params.id])

  const handleAIExtraction = useCallback(async () => {
    setIsExtractingAI(true)
    try {
      const response = await fetch(`/api/contracts/${params.id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
        body: JSON.stringify({ force: true, includeConfidence: true })
      })
      
      if (!response.ok) throw new Error('AI extraction failed')
      
      toast.success('AI extraction started. This may take a few moments...')
      setTimeout(async () => {
        await loadContract()
        toast.success('AI extraction completed!')
      }, 3000)
    } catch (err) {
      console.error('Failed to trigger AI extraction:', err)
      toast.error('Failed to start AI extraction.')
    } finally {
      setIsExtractingAI(false)
    }
  }, [params.id, loadContract])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    setIsSavingCategory(true)
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
        body: JSON.stringify({ categoryId })
      })
      
      if (!response.ok) throw new Error('Failed to update category')
      
      toast.success('Category updated successfully')
      setShowCategorySelector(false)
      crossModule.onTaxonomyChange()
      await loadContract()
    } catch (err) {
      console.error('Failed to update category:', err)
      toast.error('Failed to update category')
    } finally {
      setIsSavingCategory(false)
    }
  }, [params.id, crossModule, loadContract])

  const handleAICategorize = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
        body: JSON.stringify({ contractIds: [params.id], force: true })
      })
      
      if (!response.ok) throw new Error('Failed to categorize')
      
      const data = await response.json()
      if (data.data?.results?.[0]?.success) {
        toast.success('Contract categorized by AI')
        crossModule.onTaxonomyChange()
        await loadContract()
      } else {
        toast.warning('AI could not determine a category')
      }
    } catch (err) {
      console.error('AI categorization failed:', err)
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
                    <Button onClick={loadContract} size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 print-container">
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
        showPdfViewer={showPdfViewer}
        isEditing={isEditing}
        isExtractingAI={isExtractingAI}
        onRefresh={loadContract}
        onTogglePdf={() => setShowPdfViewer(!showPdfViewer)}
        onEdit={() => setIsEditing(true)}
        onAIExtract={handleAIExtraction}
        onDownload={handleDownload}
        onShare={() => setShowShareDialog(true)}
        onCompare={() => setShowComparison(true)}
      />

      {/* Main Content */}
      <div 
        ref={splitContainerRef}
        className={cn(
          "flex",
          showPdfViewer ? "h-[calc(100vh-4rem)]" : "",
          isResizingPanel && "select-none"
        )}
      >
        {/* PDF Viewer Panel */}
        {showPdfViewer && (
          <>
            <div 
              className="h-full bg-slate-100 flex-shrink-0 relative"
              style={{ width: `${pdfSplitRatio}%`, minWidth: '280px' }}
            >
              <RobustPDFViewer
                contractId={params.id as string}
                filename={contract?.filename || 'Contract'}
                height="100%"
                onToggle={() => setShowPdfViewer(false)}
                isExpanded={showPdfViewer}
              />
            </div>
            
            {/* Resize Handle */}
            <div
              className={cn(
                "w-1.5 cursor-col-resize bg-slate-300 hover:bg-blue-500 transition-colors flex-shrink-0",
                "flex items-center justify-center group",
                isResizingPanel && "bg-blue-500"
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
          </>
        )}
        
        {/* Details Panel - Main Content */}
        <div 
          id="main-content"
          tabIndex={-1}
          className={cn("overflow-auto", showPdfViewer ? "flex-1" : "w-full")} 
          style={showPdfViewer ? { minWidth: '320px' } : undefined}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            
            {/* Processing Banner */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 sm:mb-6"
                >
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="py-3 sm:py-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 animate-spin" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-blue-900 text-sm sm:text-base">Processing Contract</p>
                          <p className="text-xs sm:text-sm text-blue-700 truncate">
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
                <Button variant="outline" size="sm" onClick={() => setShowPdfViewer(true)} className="gap-2">
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
              onAction={() => setActiveTab('overview')}
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
              />
            </motion.div>

            {/* Quick Actions Bar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                {/* Category */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 hover:border-slate-300 transition-colors">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  {contract?.category ? (
                    <button onClick={() => setShowCategorySelector(true)} className="hover:opacity-80 transition-opacity">
                      <CategoryBadge category={contract.category.name} color={contract.category.color} icon={contract.category.icon} size="sm" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setShowCategorySelector(true)} className="text-slate-500 hover:text-slate-700 font-medium text-xs sm:text-sm">
                        Add category
                      </button>
                      <button onClick={handleAICategorize} className="text-purple-500 hover:text-purple-700 p-0.5 rounded hover:bg-purple-50" title="AI suggest">
                        <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* File Info */}
                <div className="hidden sm:flex items-center gap-2 text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5 text-xs sm:text-sm">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-medium">{contract?.mimeType?.split('/')[1]?.toUpperCase() || 'PDF'}</span>
                  {contract?.fileSize && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>{(contract.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                    </>
                  )}
                </div>
                
                {/* Jurisdiction & Language */}
                {(metadata.jurisdiction || metadata.contract_language) && (
                  <div className="hidden md:flex items-center gap-1.5">
                    {metadata.jurisdiction && (
                      <Badge variant="outline" className="text-xs bg-white">
                        <Globe className="h-3 w-3 mr-1" />
                        {metadata.jurisdiction}
                      </Badge>
                    )}
                    {metadata.contract_language && (
                      <Badge variant="outline" className="text-xs bg-white text-slate-500">
                        {metadata.contract_language.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="flex-1" />
                
                {/* Search Contract */}
                <ContractSearch contractId={params.id as string} />
                
                {/* AI Analyze Button */}
                <button 
                  onClick={handleAnalyzeWithAI}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Analyze with AI</span>
                  <span className="sm:hidden">Analyze</span>
                </button>
              </div>
            </motion.div>

            {/* Main Tabs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
                <TabsList className="w-full bg-white rounded-lg border border-slate-200 p-1 h-auto">
                  <TabsTrigger value="overview" className="flex-1 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Summary
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex-1 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md">
                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 py-2 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md">
                    <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="overview" className="space-y-4">
                  {/* Two-column layout for summary and sidebar */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Main Summary Content */}
                    <div className="lg:col-span-2 space-y-4">
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
                      
                      {/* AI Analysis */}
                      {contract?.extractedData && (
                        <Card className="border-slate-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                              <Brain className="h-4 w-4 text-purple-500" />
                              AI Analysis
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Clauses, financials, risk assessment, and compliance
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-0">
                            <EnhancedArtifactViewer
                              artifacts={contract.extractedData}
                              contractId={params.id as string}
                              initialTab={searchParams.get('tab') || 'overview'}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                    
                    {/* Sidebar */}
                    <div className="space-y-4">
                      {/* Contract Timeline - wrapped in error boundary */}
                      <SectionErrorBoundary sectionName="Timeline">
                        <ContractTimeline
                          signatureDate={metadata.signature_date}
                          startDate={metadata.start_date}
                          endDate={metadata.end_date}
                          terminationDate={contract?.termination_date}
                        />
                      </SectionErrorBoundary>
                      
                      {/* Related Contracts - wrapped in error boundary */}
                      <SectionErrorBoundary sectionName="Related Contracts">
                        <RelatedContracts
                          contractId={params.id as string}
                          clientName={metadata.external_parties?.[0]?.legalName}
                          categoryId={contract?.category?.id}
                        />
                      </SectionErrorBoundary>
                    </div>
                  </div>
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 sm:space-y-6">
                  <EnhancedContractMetadataSection
                    contractId={params.id as string}
                    tenantId="demo"
                    contract={contract}
                    overviewData={overviewData}
                    financialData={financialData}
                    onRefresh={loadContract}
                  />
                  
                  <ContractHierarchy
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
                      await loadContract()
                    }}
                    onUnlinkParent={async () => {
                      const response = await fetch(`/api/contracts/${params.id}/hierarchy`, { method: 'DELETE' })
                      if (!response.ok) throw new Error('Failed to unlink parent contract')
                      await loadContract()
                    }}
                  />
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="space-y-4">
                  {/* Notes & Comments */}
                  <ContractNotes
                    contractId={params.id as string}
                    notes={[]} // Would be fetched from API
                    currentUserId="current-user" // Would come from auth context
                    onAddNote={async (content) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
                        body: JSON.stringify({ content })
                      })
                      if (!response.ok) throw new Error('Failed to add note')
                    }}
                    onEditNote={async (id, content) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
                        body: JSON.stringify({ content })
                      })
                      if (!response.ok) throw new Error('Failed to edit note')
                    }}
                    onDeleteNote={async (id) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'DELETE',
                        headers: { 'x-tenant-id': 'demo' }
                      })
                      if (!response.ok) throw new Error('Failed to delete note')
                    }}
                    onPinNote={async (id, pinned) => {
                      const response = await fetch(`/api/contracts/${params.id}/notes/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
                        body: JSON.stringify({ isPinned: pinned })
                      })
                      if (!response.ok) throw new Error('Failed to update note')
                    }}
                  />
                  
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-blue-500" />
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

      <AISummarizer
        contractId={params.id as string}
        contractTitle={contract?.filename || 'Contract'}
        isOpen={showAISummarizer}
        onClose={() => setShowAISummarizer(false)}
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
            <DialogTitle className="text-lg sm:text-xl font-semibold">Assign Category</DialogTitle>
            <p className="text-sm text-muted-foreground">Select a category to organize this contract</p>
          </DialogHeader>
          <div className="mt-2">
            <CategorySelector
              value={contract?.category?.id || null}
              onChange={(category) => {
                if (category) {
                  setPendingCategory({ id: category.id, name: category.name })
                  setShowCategorySelector(false)
                  setShowCategoryConfirm(true)
                }
              }}
              tenantId="demo"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryConfirm} onOpenChange={setShowCategoryConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-semibold">Confirm Category Change</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Change category to <span className="font-medium text-foreground">&ldquo;{pendingCategory?.name}&rdquo;</span>?
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => { setShowCategoryConfirm(false); setPendingCategory(null) }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingCategory) handleCategorySelect(pendingCategory.id)
                setShowCategoryConfirm(false)
                setPendingCategory(null)
              }}
              disabled={isSavingCategory}
            >
              {isSavingCategory ? "Saving..." : "Confirm"}
            </Button>
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
          enabled: contract?.reminder_enabled ?? false,
          daysBeforeExpiry: contract?.reminder_days_before_end ?? 30,
          notificationChannels: ['email', 'in-app'],
        }}
        onSave={async (config) => {
          const response = await fetch(`/api/contracts/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
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
        hasReminder={contract?.reminder_enabled ?? false}
        isArchived={contract?.status === 'archived'}
        onToggleFavorite={async () => {
          const response = await fetch(`/api/contracts/${params.id}/favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
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
            headers: { 'x-tenant-id': 'demo' }
          })
          if (!response.ok) throw new Error('Failed to delete contract')
          router.push('/contracts')
        }}
        onArchive={async () => {
          const newStatus = contract?.status === 'archived' ? 'active' : 'archived'
          const response = await fetch(`/api/contracts/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'demo' },
            body: JSON.stringify({ status: newStatus })
          })
          if (!response.ok) throw new Error('Failed to archive contract')
          await loadContract()
        }}
        onExport={async (format) => {
          const response = await fetch(`/api/contracts/${params.id}/export?format=${format}`, {
            headers: { 'x-tenant-id': 'demo' },
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
      />
    </div>
  )
}

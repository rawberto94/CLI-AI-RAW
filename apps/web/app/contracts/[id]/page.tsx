'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  ArrowRight,
  RefreshCw, 
  AlertCircle, 
  FileText,
  DollarSign,
  Shield,
  Download,
  Sparkles,
  Clock,
  Calendar,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Share2,
  MoreHorizontal,
  Brain,
  Eye,
  ChevronDown,
  ExternalLink,
  Info,
  Pencil,
  Save,
  X,
  Tag,
  GitCompare,
  History,
  PanelLeftClose,
  PanelRightClose,
  FileType,
  Heart,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
import { ScoreRing } from '@/components/artifacts/ArtifactCards'
import { ShareDialog } from '@/components/collaboration/ShareDialog'
import { SubmitForApprovalModal } from '@/components/collaboration/SubmitForApprovalModal'
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator'
import { useWebSocket } from '@/contexts/websocket-context'
import { useCrossModuleInvalidation } from '@/hooks/use-queries'
import { formatCurrency, formatDate } from '@/lib/design-tokens'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuickSummarizeButton, AISummarizer, AIInsightsCard, CompareButton, ContractComparison, ContractHealthScore, CategoryBadge, CategorySelector, ContractReminders, ContractAuditLog, EnhancedContractMetadataSection } from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { HealthIndicator } from '@/components/contracts/EnhancedContractCard'
import { ActivityTab } from '@/components/contracts/detail/ActivityTab'
import { CopyableId } from '@/components/contracts/detail/CopyableId'
import { StatusBadge } from '@/components/contracts/detail/StatusBadge'
import { StatCard } from '@/components/contracts/detail/StatCard'
import { KeyTermBadge } from '@/components/contracts/detail/KeyTermBadge'
import { useSplitPaneResize } from '@/hooks/use-split-pane-resize'

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
}

interface ContractMetadata {
  contractType: string
  effectiveDate: string
  expirationDate: string
  totalValue: string
  currency: string
  clientName: string
  supplierName: string
  description: string
  tags: string[]
}

const CONTRACT_TYPES = [
  'Service Agreement',
  'Master Services Agreement',
  'Statement of Work',
  'License Agreement',
  'Non-Disclosure Agreement',
  'Employment Contract',
  'Consulting Agreement',
  'Purchase Agreement',
  'Lease Agreement',
  'Partnership Agreement',
  'Other'
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR']

// ============ HELPER COMPONENTS ============

// ============ MAIN COMPONENT ============

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dataMode } = useDataMode()
  const wsContext = useWebSocket()
  const crossModule = useCrossModuleInvalidation()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  
  // AI Summarizer state
  const [showAISummarizer, setShowAISummarizer] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  
  // Contract Comparison state
  const [showComparison, setShowComparison] = useState(false)
  
  // Category state
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<{ id: string; name: string } | null>(null)
  const [showCategoryConfirm, setShowCategoryConfirm] = useState(false)
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  
  // PDF Viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const {
    containerRef: splitContainerRef,
    ratio: pdfSplitRatio,
    setRatio: setPdfSplitRatio,
    isResizing: isResizingPanel,
    beginResize: beginResizePanel,
    aria: splitAria,
  } = useSplitPaneResize({ initialRatio: 45, minRatio: 20, maxRatio: 75 })
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [metadata, setMetadata] = useState<ContractMetadata>({
    contractType: '',
    effectiveDate: '',
    expirationDate: '',
    totalValue: '',
    currency: 'USD',
    clientName: '',
    supplierName: '',
    description: '',
    tags: []
  })
  const [newTag, setNewTag] = useState('')

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Tab navigation: 1-3 keys (simplified tabs)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        switch (e.key) {
          case '1':
            setActiveTab('overview')
            break
          case '2':
            setActiveTab('details')
            break
          case '3':
            setActiveTab('activity')
            break
          case 'p':
            setShowPdfViewer(prev => !prev)
            break
          case 'e':
            if (!isEditing) setIsEditing(true)
            break
          case 'Escape':
            if (isEditing) handleCancelEdit()
            if (showPdfViewer) setShowPdfViewer(false)
            break
        }
      }
      
      // Cmd/Ctrl shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 's':
            if (isEditing) {
              e.preventDefault()
              handleSaveMetadata()
            }
            break
          case 'd':
            e.preventDefault()
            handleDownload()
            break
          case 'r':
            e.preventDefault()
            loadContract()
            break
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, showPdfViewer])

  // Join document for real-time collaboration
  useEffect(() => {
    if (params.id && wsContext?.joinDocument) {
      wsContext.joinDocument(params.id as string, 'contract')
    }
    return () => {
      wsContext?.leaveDocument?.()
    }
  }, [params.id, wsContext])

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
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setContract(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
      console.error('Failed to load contract:', err)
    } finally {
      setLoading(false)
    }
  }, [params.id, dataMode])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  // Initialize metadata when contract loads
  // IMPORTANT: Prioritize user-edited metadata (from database) over AI-extracted data
  useEffect(() => {
    if (contract) {
      const overviewData = contract.extractedData?.overview
      const financialData = contract.extractedData?.financial
      
      // Helper to find supplier/vendor party (AI might use different role names)
      const findSupplierParty = (parties: any[]) => parties?.find((p: any) => 
        ['Supplier', 'Vendor', 'Service Provider', 'Provider', 'Contractor', 'Seller'].includes(p.role)
      );
      
      // Helper to find client party
      const findClientParty = (parties: any[]) => parties?.find((p: any) => 
        ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(p.role)
      );
      
      // Get total value - prioritize database field, fallback to AI extraction
      const totalValue = contract.totalValue || financialData?.totalValue || overviewData?.totalValue || overviewData?.contractValue || '';
      const currency = contract.currency || financialData?.currency || overviewData?.currency || 'USD';
      
      // Format date helper
      const formatDate = (date: string | Date | null | undefined) => {
        if (!date) return '';
        try {
          return new Date(date).toISOString().split('T')[0];
        } catch {
          return '';
        }
      };
      
      setMetadata({
        // Prioritize database fields (user-edited), fallback to AI-extracted
        contractType: contract.contractType || overviewData?.contractType || '',
        effectiveDate: formatDate(contract.effectiveDate) || formatDate(overviewData?.effectiveDate) || '',
        expirationDate: formatDate(contract.expirationDate) || formatDate(overviewData?.expirationDate) || '',
        totalValue: totalValue?.toString() || '',
        currency: currency,
        clientName: contract.clientName || String(findClientParty(overviewData?.parties)?.name ?? ''),
        supplierName: contract.supplierName || String(findSupplierParty(overviewData?.parties)?.name ?? ''),
        description: contract.description || overviewData?.summary || '',
        tags: contract.tags || (Array.isArray(contract.extractedData?.tags) ? contract.extractedData.tags : [])
      })
    }
  }, [contract])

  // Handle metadata field change
  const handleMetadataChange = (field: keyof ContractMetadata, value: string | string[]) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
  }

  // Add tag
  const handleAddTag = () => {
    if (newTag.trim() && !metadata.tags.includes(newTag.trim())) {
      setMetadata(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }))
      setNewTag('')
    }
  }

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setMetadata(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }))
  }

  // Download contract
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

  // Save metadata
  const handleSaveMetadata = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch(`/api/contracts/${params.id}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': dataMode
        },
        body: JSON.stringify({
          contractType: metadata.contractType,
          effectiveDate: metadata.effectiveDate || null,
          expirationDate: metadata.expirationDate || null,
          totalValue: metadata.totalValue ? parseFloat(metadata.totalValue) : null,
          currency: metadata.currency,
          clientName: metadata.clientName,
          supplierName: metadata.supplierName,
          description: metadata.description,
          tags: metadata.tags
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save metadata')
      }
      
      // Invalidate related caches across modules
      crossModule.onContractChange(params.id as string)
      
      setSaveSuccess(true)
      setIsEditing(false)
      await loadContract() // Refresh contract data
      
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save metadata:', err)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    // Reset metadata to current contract values (prioritize database over AI-extracted)
    if (contract) {
      const overviewData = contract.extractedData?.overview
      const financialData = contract.extractedData?.financial
      
      // Helper to find supplier/vendor party
      const findSupplierParty = (parties: any[]) => parties?.find((p: any) => 
        ['Supplier', 'Vendor', 'Service Provider', 'Provider', 'Contractor', 'Seller'].includes(p.role)
      );
      
      // Helper to find client party
      const findClientParty = (parties: any[]) => parties?.find((p: any) => 
        ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(p.role)
      );
      
      // Get total value - prioritize database field
      const totalValue = contract.totalValue || financialData?.totalValue || overviewData?.totalValue || '';
      const currency = contract.currency || financialData?.currency || overviewData?.currency || 'USD';
      
      // Format date helper
      const formatDate = (date: string | Date | null | undefined) => {
        if (!date) return '';
        try {
          return new Date(date).toISOString().split('T')[0];
        } catch {
          return '';
        }
      };
      
      setMetadata({
        contractType: contract.contractType || overviewData?.contractType || '',
        effectiveDate: formatDate(contract.effectiveDate) || formatDate(overviewData?.effectiveDate) || '',
        expirationDate: formatDate(contract.expirationDate) || formatDate(overviewData?.expirationDate) || '',
        totalValue: totalValue?.toString() || '',
        currency: currency,
        clientName: contract.clientName || String(findClientParty(overviewData?.parties)?.name ?? ''),
        supplierName: contract.supplierName || String(findSupplierParty(overviewData?.parties)?.name ?? ''),
        description: contract.description || overviewData?.summary || '',
        tags: contract.tags || (Array.isArray(contract.extractedData?.tags) ? contract.extractedData.tags : [])
      })
    }
  }

  // Handle category selection
  const handleCategorySelect = async (categoryId: string) => {
    setIsSavingCategory(true)
    const previousCategory = contract?.category?.name || 'None'
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo'
        },
        body: JSON.stringify({ categoryId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update category')
      }
      
      // Log to audit trail
      try {
        await fetch(`/api/contracts/${params.id}/audit`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-tenant-id': 'demo'
          },
          body: JSON.stringify({
            action: 'categorize',
            category: 'modification',
            details: {
              previousCategory,
              newCategoryId: categoryId,
              source: 'manual'
            },
            status: 'success'
          })
        })
      } catch (auditErr) {
        console.warn('Failed to log category change to audit trail:', auditErr)
      }
      
      toast.success('Category updated successfully')
      setShowCategorySelector(false)
      
      // Invalidate related caches
      crossModule.onTaxonomyChange()
      
      await loadContract()
    } catch (err) {
      console.error('Failed to update category:', err)
      toast.error('Failed to update category')
    } finally {
      setIsSavingCategory(false)
    }
  }

  // Handle AI category suggestion
  const handleAICategorize = async () => {
    try {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo'
        },
        body: JSON.stringify({ 
          contractIds: [params.id],
          force: true 
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to categorize')
      }
      
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
  }

  // Extract data helpers
  const overviewData = contract?.extractedData?.overview
  const financialData = contract?.extractedData?.financial
  const riskData = contract?.extractedData?.risk
  const complianceData = contract?.extractedData?.compliance

  // Calculate risk level from data
  const getRiskLevel = () => {
    const score = riskData?.riskScore || riskData?.overallScore;
    const level = riskData?.riskLevel || riskData?.overallRisk;
    if (level) return level.toLowerCase();
    if (score !== undefined) {
      if (score < 30) return 'low';
      if (score < 60) return 'medium';
      return 'high';
    }
    return 'medium';
  };

  const getRiskScore = () => {
    if (riskData?.riskScore !== undefined) return riskData.riskScore;
    if (riskData?.overallScore !== undefined) return riskData.overallScore;
    const level = getRiskLevel();
    return level === 'low' ? 25 : level === 'medium' ? 50 : 75;
  };

  // Error state
  if (error) {
    const isNotFound = error.includes('not found') || error.includes('404');
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/20 flex items-center justify-center p-6">
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
                    "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg",
                    isNotFound 
                      ? "bg-gradient-to-br from-amber-500 to-orange-600" 
                      : "bg-gradient-to-br from-red-500 to-rose-600"
                  )}
                >
                  <AlertCircle className="h-8 w-8 text-white" />
                </motion.div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent mb-2">
                  {isNotFound ? 'Contract Not Found' : 'Error Loading Contract'}
                </h2>
                <p className="text-sm text-slate-600 mb-6 max-w-[280px] mx-auto">{error}</p>
                <div className="flex gap-3 justify-center">
                  {!isNotFound && (
                    <Button 
                      onClick={loadContract} 
                      size="sm"
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    >
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header skeleton */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="h-8 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
            <div className="h-6 w-48 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg animate-pulse" />
          </motion.div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="h-28 bg-white/80 backdrop-blur-sm border border-white/50 rounded-xl shadow-sm animate-pulse"
              >
                <div className="p-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-100 rounded-xl mb-3" />
                  <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
                  <div className="h-6 w-16 bg-slate-200 rounded" />
                </div>
              </motion.div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  const isProcessing = contract?.status?.toLowerCase() === 'processing' || 
                       contract?.status?.toLowerCase() === 'uploaded';

  const riskLevel = getRiskLevel();
  const riskScore = getRiskScore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header - Enhanced with glassmorphism and better visual hierarchy */}
      <div className="bg-white/95 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                <Link href="/contracts">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Contracts
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6 bg-slate-200" />
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 transition-transform group-hover:scale-105">
                    <FileText className="h-5 w-5 text-white drop-shadow-sm" />
                  </div>
                  {/* Subtle glow effect on hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity" />
                </div>
                <div>
                  <h1 className="text-base font-semibold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-600 bg-clip-text text-transparent line-clamp-1 max-w-[200px] sm:max-w-[300px]">
                    {contract?.filename || 'Contract Details'}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CopyableId id={params.id as string} />
                    <span className="text-slate-300">•</span>
                    <StatusBadge status={contract?.status || 'unknown'} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right: Actions - Enhanced styling */}
            <div className="flex items-center gap-2">
              {/* Collaboration Presence */}
              <PresenceIndicator maxAvatars={3} showConnectionStatus={false} />
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={loadContract} 
                      className="h-9 w-9 hover:bg-slate-100 transition-colors"
                      aria-label="Refresh contract data"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-700">Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                    Actions
                    <ChevronDown className="h-4 w-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 shadow-xl border-slate-200">
                  <DropdownMenuItem onClick={() => setShowPdfViewer(!showPdfViewer)} className="cursor-pointer">
                    <FileType className="h-4 w-4 mr-2" />
                    {showPdfViewer ? 'Hide Original PDF' : 'View Original PDF'}
                    <span className="ml-auto text-xs text-muted-foreground">P</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)} disabled={isEditing} className="cursor-pointer">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Metadata
                    <span className="ml-auto text-xs text-muted-foreground">E</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                    <span className="ml-auto text-xs text-muted-foreground">⌘D</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* Submit for Approval - Hidden for now, will be enabled in future */}
                  {/* <DropdownMenuItem onClick={() => setShowApprovalModal(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit for Approval
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={() => setShowComparison(true)}>
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare Versions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Keyboard Shortcuts</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>1-3</span><span>Switch tabs</span>
                      <span>P</span><span>Toggle PDF</span>
                      <span>E</span><span>Edit metadata</span>
                      <span>⌘R</span><span>Refresh</span>
                      <span>⌘S</span><span>Save (edit mode)</span>
                      <span>Esc</span><span>Cancel/Close</span>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Side by Side Layout */}
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
              style={{ width: `${pdfSplitRatio}%`, minWidth: '300px' }}
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
              onMouseDown={(e) => {
                e.preventDefault()
                beginResizePanel()
              }}
              onKeyDown={(e) => {
                if (!showPdfViewer) return

                const step = 2
                switch (e.key) {
                  case 'ArrowLeft':
                    e.preventDefault()
                    setPdfSplitRatio(pdfSplitRatio - step)
                    break
                  case 'ArrowRight':
                    e.preventDefault()
                    setPdfSplitRatio(pdfSplitRatio + step)
                    break
                  case 'Home':
                    e.preventDefault()
                    setPdfSplitRatio(splitAria.min)
                    break
                  case 'End':
                    e.preventDefault()
                    setPdfSplitRatio(splitAria.max)
                    break
                }
              }}
            >
              <div className="w-0.5 h-8 bg-slate-400 group-hover:bg-white rounded-full" />
            </div>
          </>
        )}
        
        {/* Details Panel */}
        <div 
          className={cn(
            "overflow-auto",
            showPdfViewer ? "flex-1" : "w-full"
          )}
          style={showPdfViewer ? { minWidth: '400px' } : undefined}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Banner - Simple text status */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="font-medium text-blue-900">Processing Contract</p>
                      <p className="text-sm text-blue-700">
                        {contract?.processing?.currentStage || 'Generating artifacts...'} ({contract?.processing?.progress || 0}%)
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadContract} className="ml-auto">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* PDF Viewer Toggle Button (when hidden) */}
        {!showPdfViewer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPdfViewer(true)}
              className="gap-2"
            >
              <FileType className="h-4 w-4" />
              View Original PDF
            </Button>
          </motion.div>
        )}

        {/* Contract Health Score - Enhanced with better visual design */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="mb-6"
        >
          <Card className="bg-gradient-to-br from-white via-white to-slate-50/50 border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-6">
                {/* Health Ring */}
                <div className="relative">
                  <HealthIndicator 
                    health={{
                      score: riskScore ? Math.max(20, 100 - riskScore) : 85,
                      issues: riskScore && riskScore >= 70 ? ['High risk score'] : [],
                      lastChecked: new Date(),
                    }}
                    size="lg"
                    showLabel
                  />
                </div>
                
                {/* Health Details - Enhanced card styling */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className="text-center p-3.5 bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-default"
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Completeness</p>
                    <p className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">{contract?.status === 'completed' ? '100%' : '75%'}</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className={cn(
                      "text-center p-3.5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-default",
                      riskLevel === 'low' ? 'bg-gradient-to-br from-emerald-50 to-green-50/50 border-emerald-100' : 
                      riskLevel === 'medium' ? 'bg-gradient-to-br from-amber-50 to-yellow-50/50 border-amber-100' : 
                      'bg-gradient-to-br from-red-50 to-rose-50/50 border-red-100'
                    )}
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Risk Level</p>
                    <p className={cn(
                      "text-xl font-bold",
                      riskLevel === 'low' ? 'text-emerald-600' : 
                      riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                    </p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className="text-center p-3.5 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-xl border border-purple-100 shadow-sm hover:shadow-md transition-all cursor-default"
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">AI Artifacts</p>
                    <p className="text-xl font-bold text-purple-600">{contract?.artifactCount || 5}</p>
                  </motion.div>
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className={cn(
                      "text-center p-3.5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-default",
                      complianceData?.compliant 
                        ? 'bg-gradient-to-br from-emerald-50 to-green-50/50 border-emerald-100' 
                        : 'bg-gradient-to-br from-amber-50 to-yellow-50/50 border-amber-100'
                    )}
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">Compliance</p>
                    <p className={cn(
                      "text-xl font-bold",
                      complianceData?.compliant ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                      {complianceData?.compliant ? 'Pass' : 'Review'}
                    </p>
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats - Enhanced with better hover states */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          {financialData?.totalValue && (
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/80 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">
                {formatCurrency(financialData.totalValue, financialData.currency || 'USD')}
              </span>
            </motion.div>
          )}
          
          <motion.div 
            whileHover={{ scale: 1.03 }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm hover:shadow-md transition-all",
            riskLevel === 'low' ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/80' : 
            riskLevel === 'medium' ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/80' : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200/80'
          )}>
            <AlertTriangle className={cn(
              "h-4 w-4",
              riskLevel === 'low' ? 'text-emerald-600' : 
              riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
            )} />
            <span className={cn(
              "text-sm font-semibold",
              riskLevel === 'low' ? 'text-emerald-700' : 
              riskLevel === 'medium' ? 'text-amber-700' : 'text-red-700'
            )}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </span>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.03 }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm hover:shadow-md transition-all",
              complianceData?.compliant 
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/80' 
                : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/80'
            )}
          >
            <Shield className={cn(
              "h-4 w-4",
              complianceData?.compliant ? 'text-emerald-600' : 'text-amber-600'
            )} />
            <span className={cn(
              "text-sm font-semibold",
              complianceData?.compliant ? 'text-emerald-700' : 'text-amber-700'
            )}>
              {complianceData?.compliant ? 'Compliant' : 'Review Needed'}
            </span>
          </motion.div>
          
          <motion.div 
            whileHover={{ scale: 1.03 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <Brain className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">
              {contract?.artifactCount || 5} AI Artifacts
            </span>
          </motion.div>
        </motion.div>

        {/* Category & Quick Actions Bar - Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mb-6 flex flex-wrap items-center gap-4"
        >
          {/* Category - Enhanced styling */}
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all">
            <Tag className="h-4 w-4 text-slate-400" />
            {contract?.category ? (
              <button 
                onClick={() => setShowCategorySelector(true)}
                className="hover:opacity-80 transition-opacity"
              >
                <CategoryBadge
                  category={contract.category.name}
                  color={contract.category.color}
                  icon={contract.category.icon}
                  size="sm"
                />
              </button>
            ) : (
              <button 
                onClick={() => setShowCategorySelector(true)}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 font-medium"
              >
                <span>Add category</span>
              </button>
            )}
            {!contract?.category && (
              <button 
                onClick={handleAICategorize}
                className="ml-1 text-purple-500 hover:text-purple-700 p-1 rounded-lg hover:bg-purple-50 transition-colors"
                title="AI suggest category"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          {/* Renewal Soon Alert - Enhanced styling */}
          {overviewData?.expirationDate && new Date(overviewData.expirationDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) && (
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/80 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Clock className="h-4 w-4" />
              </motion.div>
              <span>Renewal Soon</span>
            </motion.div>
          )}
          
          {/* Ask AI - Enhanced prominent action button */}
          <motion.button 
            onClick={() => window.dispatchEvent(new CustomEvent('openAIChatbot'))}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-purple-600 hover:via-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-500/30"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </motion.button>
        </motion.div>

        {/* Main Tabs - Enhanced with better visual hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-sm">
              <TabsList className="w-full bg-transparent gap-1">
                <TabsTrigger 
                  value="overview" 
                  className="flex-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-100 data-[state=active]:to-slate-50 data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Summary
                </TabsTrigger>
                <TabsTrigger 
                  value="details" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Edit Details
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
                >
                  <History className="h-4 w-4 mr-2" />
                  Activity & Reminders
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Summary Tab - Combines Overview + AI Analysis in one flow */}
            <TabsContent value="overview" className="space-y-6">
              {/* Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed">
                    {overviewData?.summary || 'Contract summary will appear here once processing is complete.'}
                  </p>
                  
                  {/* Key Terms */}
                  {overviewData?.keyTerms && overviewData.keyTerms.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Key Terms</p>
                      <div className="flex flex-wrap gap-2">
                        {overviewData.keyTerms.map((term: string, i: number) => (
                          <KeyTermBadge key={i} term={term} />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Two Column Layout */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Parties */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      Contract Parties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {overviewData?.parties && overviewData.parties.length > 0 ? (
                      <div className="space-y-3">
                        {overviewData.parties.map((party: any, i: number) => (
                          <div 
                            key={i}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center",
                              ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role)
                                ? "bg-blue-100" 
                                : "bg-purple-100"
                            )}>
                              {['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role) ? (
                                <Building className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Users className="h-5 w-5 text-purple-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{party.name || 'Unknown Party'}</p>
                              <p className="text-sm text-slate-500">{party.role || 'Party'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No parties identified yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Key Dates */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      Key Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <span className="text-sm font-medium text-emerald-700">Effective Date</span>
                        <span className="text-sm text-slate-700">
                          {overviewData?.effectiveDate ? formatDate(overviewData.effectiveDate) : 'Not specified'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-700">Upload Date</span>
                        <span className="text-sm text-slate-700">
                          {contract?.uploadDate ? formatDate(contract.uploadDate) : 'Not specified'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm font-medium text-amber-700">Expiration</span>
                        <span className="text-sm text-slate-700">
                          {overviewData?.expirationDate ? formatDate(overviewData.expirationDate) : 'Not specified'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Summary */}
              {riskData && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          riskLevel === 'low' ? 'text-emerald-600' : 
                          riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
                        )} />
                        Risk Assessment
                      </CardTitle>
                      <Badge className={cn(
                        riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' : 
                        riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {riskData.risks && riskData.risks.length > 0 ? (
                      <div className="space-y-3">
                        {riskData.risks.map((risk: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className={cn(
                              "w-2 h-2 rounded-full mt-2",
                              risk.level?.toLowerCase() === 'low' ? 'bg-emerald-500' : 
                              risk.level?.toLowerCase() === 'medium' ? 'bg-amber-500' : 'bg-red-500'
                            )} />
                            <div>
                              <p className="font-medium text-slate-900">{risk.category}</p>
                              <p className="text-sm text-slate-600">{risk.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No specific risks identified.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Insights Card */}
              <AIInsightsCard
                contractId={params.id as string}
                onRefresh={() => {
                  toast.info('Refreshing AI insights...');
                }}
              />

              {/* AI Extracted Details - Integrated into Summary */}
              {contract?.extractedData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-600" />
                      AI-Extracted Details
                    </CardTitle>
                    <CardDescription>
                      Detailed analysis of clauses, financials, risk, and compliance
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

              {/* Contract Health Score */}
              <ContractHealthScore
                contractId={params.id as string}
                variant="full"
              />
            </TabsContent>

            {/* Details Tab - Enhanced Metadata using new schema */}
            <TabsContent value="details" className="space-y-6">
              <EnhancedContractMetadataSection
                contractId={params.id as string}
                tenantId="demo"
                contract={contract}
                overviewData={overviewData}
                financialData={financialData}
                onRefresh={loadContract}
              />
              
              {/* Compliance Details - Keep for additional context */}
              {complianceData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-600" />
                      Compliance Checks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {complianceData.checks && complianceData.checks.length > 0 ? (
                      <div className="space-y-2">
                        {complianceData.checks.map((check: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {check.status === 'compliant' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                              )}
                              <span className="text-sm font-medium text-slate-900">{check.regulation}</span>
                            </div>
                            <Badge className={cn(
                              check.status === 'compliant' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            )}>
                              {check.status === 'compliant' ? 'Passed' : 'Review'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No compliance checks available.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Activity & Reminders Tab - Combined for simplicity */}
            <TabsContent value="activity" className="space-y-6">
              {/* Reminders Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Reminders
                </h3>
                <ContractReminders contractId={params.id as string} />
              </div>
              
              <Separator className="my-8" />
              
              {/* Activity Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  Recent Activity
                </h3>
                <ActivityTab contractId={params.id as string} />
              </div>
              
              {/* Audit Log */}
              <ContractAuditLog 
                contractId={params.id as string}
                maxHeight="400px"
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        documentId={params.id as string}
        documentType="contract"
        documentTitle={contract?.filename || 'Contract'}
      />

      {/* Submit for Approval Modal - Hidden for now, will be enabled in future */}
      {/* <SubmitForApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        contractId={params.id as string}
        contractTitle={contract?.filename || 'Contract'}
      /> */}

      {/* AI Summarizer FAB */}
      <QuickSummarizeButton
        onClick={() => {
          setIsGeneratingSummary(true);
          setShowAISummarizer(true);
          // Simulate loading, then stop after modal opens
          setTimeout(() => setIsGeneratingSummary(false), 500);
        }}
        isLoading={isGeneratingSummary}
      />

      {/* AI Summarizer Modal */}
      <AISummarizer
        contractId={params.id as string}
        contractTitle={contract?.filename || 'Contract'}
        isOpen={showAISummarizer}
        onClose={() => setShowAISummarizer(false)}
      />

      {/* Contract Comparison Modal */}
      <ContractComparison
        contractId={params.id as string}
        versions={[
          { id: 'v2', version: 'v2.0', title: 'Current Version', createdAt: new Date(), createdBy: 'System', status: 'active' as const },
          { id: 'v1', version: 'v1.0', title: 'Initial Version', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), createdBy: 'System', status: 'archived' as const },
        ]}
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
      />

      {/* Category Selector Modal */}
      <Dialog open={showCategorySelector} onOpenChange={setShowCategorySelector}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Assign Category</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select a category to organize this contract
            </p>
          </DialogHeader>
          <div className="mt-2">
            <CategorySelector
              value={contract?.category?.id || null}
              onChange={(category) => {
                if (category) {
                  setPendingCategory({ id: category.id, name: category.name });
                  setShowCategorySelector(false);
                  setShowCategoryConfirm(true);
                }
              }}
              tenantId="demo"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Change Confirmation Dialog */}
      <Dialog open={showCategoryConfirm} onOpenChange={setShowCategoryConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Confirm Category Change</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Are you sure you want to change the category to <span className="font-medium text-foreground">&ldquo;{pendingCategory?.name}&rdquo;</span>?
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoryConfirm(false);
                setPendingCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingCategory) {
                  handleCategorySelect(pendingCategory.id);
                }
                setShowCategoryConfirm(false);
                setPendingCategory(null);
              }}
              disabled={isSavingCategory}
            >
              {isSavingCategory ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

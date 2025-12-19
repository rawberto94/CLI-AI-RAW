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
  Globe,
  Bell,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
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
import { QuickSummarizeButton, AISummarizer, CompareButton, ContractComparison, CategoryBadge, CategorySelector, ContractReminders, ContractAuditLog, EnhancedContractMetadataSection } from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { HealthIndicator } from '@/components/contracts/EnhancedContractCard'
import { ActivityTab } from '@/components/contracts/detail/ActivityTab'
import { CopyableId } from '@/components/contracts/detail/CopyableId'
import { StatusBadge } from '@/components/contracts/detail/StatusBadge'
import { StatCard } from '@/components/contracts/detail/StatCard'
import { KeyTermBadge } from '@/components/contracts/detail/KeyTermBadge'
import { useSplitPaneResize } from '@/hooks/use-split-pane-resize'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { 
  formatPaymentType, 
  formatBillingFrequency, 
  formatPeriodicity 
} from '@/lib/types/contract-metadata-schema'
import type { ExternalParty } from '@/lib/types/contract-metadata-schema'

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
}

/**
 * Contract Metadata - aligned with official schema
 * @see lib/types/contract-metadata-schema.ts
 */
interface ContractMetadata {
  // Identification
  document_number: string
  document_title: string
  contract_short_description: string
  jurisdiction: string
  contract_language: string
  
  // Parties (derived from external_parties for display)
  external_parties: Array<{ legalName: string; role?: string; legalForm?: string }>
  
  // Commercials
  tcv_amount: number
  tcv_text: string
  payment_type: string
  billing_frequency_type: string
  periodicity: string
  currency: string
  
  // Dates
  signature_date: string
  start_date: string
  end_date: string
  termination_date: string
  
  // Reminders & Notices
  reminder_enabled: boolean
  reminder_days_before_end: number
  notice_period: string
}

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
  const [contractVersions, setContractVersions] = useState<Array<{
    id: string;
    version: string;
    title: string;
    createdAt: Date;
    createdBy: string;
    status: 'active' | 'archived';
  }>>([])
  
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
    // Identification
    document_number: '',
    document_title: '',
    contract_short_description: '',
    jurisdiction: '',
    contract_language: '',
    // Parties
    external_parties: [],
    // Commercials
    tcv_amount: 0,
    tcv_text: '',
    payment_type: 'none',
    billing_frequency_type: 'none',
    periodicity: 'none',
    currency: 'USD',
    // Dates
    signature_date: '',
    start_date: '',
    end_date: '',
    termination_date: '',
    // Reminders & Notices
    reminder_enabled: true,
    reminder_days_before_end: 60,
    notice_period: ''
  })

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
      
      // Load versions after contract loads
      loadVersions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
      console.error('Failed to load contract:', err)
    } finally {
      setLoading(false)
    }
  }, [params.id, dataMode])

  // Load contract versions
  const loadVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${params.id}/versions`, {
        headers: { 'x-data-mode': dataMode }
      })
      
      if (!response.ok) {
        console.warn('Failed to load versions')
        return
      }
      
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

  // Initialize metadata when contract loads
  // Maps contract data to official schema fields
  // Priority: database fields (user-edited) > AI-extracted data > defaults
  useEffect(() => {
    if (contract) {
      const overviewData = contract.extractedData?.overview
      const financialData = contract.extractedData?.financial
      
      // Format date helper
      const formatDateStr = (date: string | Date | null | undefined): string => {
        if (!date) return '';
        try {
          const result = new Date(date).toISOString().split('T')[0];
          return result ?? '';
        } catch {
          return '';
        }
      };
      
      // Build external_parties from various sources
      const buildExternalParties = (): Array<{ legalName: string; role?: string; legalForm?: string }> => {
        // First check if contract has external_parties array
        if (contract.external_parties && Array.isArray(contract.external_parties)) {
          return contract.external_parties;
        }
        // Fallback to AI-extracted parties
        if (overviewData?.parties && Array.isArray(overviewData.parties)) {
          return overviewData.parties.map((p: any) => ({
            legalName: p.name || p.legalName || '',
            role: p.role || '',
            legalForm: p.legalForm || ''
          }));
        }
        // Fallback to legacy clientName/supplierName fields
        const parties: Array<{ legalName: string; role?: string; legalForm?: string }> = [];
        if (contract.clientName) {
          parties.push({ legalName: contract.clientName, role: 'Client' });
        }
        if (contract.supplierName) {
          parties.push({ legalName: contract.supplierName, role: 'Supplier' });
        }
        return parties;
      };
      
      setMetadata({
        // Identification
        document_number: contract.document_number || contract.id || '',
        document_title: contract.document_title || contract.filename || '',
        contract_short_description: contract.contract_short_description || contract.description || overviewData?.summary || '',
        jurisdiction: contract.jurisdiction || overviewData?.jurisdiction || '',
        contract_language: contract.contract_language || overviewData?.language || 'en',
        
        // Parties
        external_parties: buildExternalParties(),
        
        // Commercials - prioritize official schema fields
        tcv_amount: contract.tcv_amount ?? financialData?.totalValue ?? contract.totalValue ?? 0,
        tcv_text: contract.tcv_text || financialData?.description || '',
        payment_type: contract.payment_type || financialData?.paymentType || 'none',
        billing_frequency_type: contract.billing_frequency_type || financialData?.billingFrequency || 'none',
        periodicity: contract.periodicity || financialData?.periodicity || 'none',
        currency: contract.currency || financialData?.currency || 'USD',
        
        // Dates - map from official or legacy fields
        signature_date: formatDateStr(contract.signature_date),
        start_date: formatDateStr(contract.start_date || contract.effectiveDate || overviewData?.effectiveDate),
        end_date: formatDateStr(contract.end_date || contract.expirationDate || overviewData?.expirationDate),
        termination_date: formatDateStr(contract.termination_date),
        
        // Reminders & Notices
        reminder_enabled: contract.reminder_enabled ?? true,
        reminder_days_before_end: contract.reminder_days_before_end ?? 60,
        notice_period: contract.notice_period || overviewData?.noticePeriod || ''
      })
    }
  }, [contract])

  // Handle metadata field change
  const handleMetadataChange = (field: keyof ContractMetadata, value: string | string[]) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
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

  // Save metadata - Using official schema fields only
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
          // Identification
          document_number: metadata.document_number,
          document_title: metadata.document_title,
          contract_short_description: metadata.contract_short_description,
          jurisdiction: metadata.jurisdiction,
          contract_language: metadata.contract_language,
          // Parties
          external_parties: metadata.external_parties,
          // Commercial terms
          tcv_amount: metadata.tcv_amount ? parseFloat(String(metadata.tcv_amount)) : null,
          tcv_text: metadata.tcv_text,
          payment_type: metadata.payment_type,
          billing_frequency_type: metadata.billing_frequency_type,
          periodicity: metadata.periodicity,
          currency: metadata.currency,
          // Dates
          signature_date: metadata.signature_date || null,
          start_date: metadata.start_date || null,
          end_date: metadata.end_date || null,
          termination_date: metadata.termination_date || null,
          // Reminders
          reminder_enabled: metadata.reminder_enabled,
          reminder_days_before_end: metadata.reminder_days_before_end,
          notice_period: metadata.notice_period
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
      
      // Build external parties from contract data
      const clientParty = findClientParty(overviewData?.parties);
      const supplierParty = findSupplierParty(overviewData?.parties);
      const parties: Array<{ legalName: string; role?: string; legalForm?: string }> = [];
      if (clientParty) parties.push({ legalName: clientParty.name || contract.clientName || '', role: 'Client' });
      if (supplierParty) parties.push({ legalName: supplierParty.name || contract.supplierName || '', role: 'Supplier' });
      
      setMetadata({
        // Identification
        document_number: contract.document_number || contract.id || '',
        document_title: contract.document_title || overviewData?.title || contract.filename || '',
        contract_short_description: contract.contract_short_description || contract.description || overviewData?.summary || '',
        jurisdiction: contract.jurisdiction || overviewData?.jurisdiction || '',
        contract_language: contract.contract_language || overviewData?.language || 'English',
        // Parties
        external_parties: contract.external_parties || parties,
        // Commercials
        tcv_amount: contract.tcv_amount || Number(totalValue) || 0,
        tcv_text: contract.tcv_text || totalValue?.toString() || '',
        payment_type: contract.payment_type || financialData?.paymentType || 'none',
        billing_frequency_type: contract.billing_frequency_type || financialData?.billingFrequency || 'none',
        periodicity: contract.periodicity || financialData?.periodicity || 'none',
        currency: currency,
        // Dates
        signature_date: contract.signature_date || formatDate(overviewData?.signatureDate) || '',
        start_date: contract.start_date || formatDate(contract.effectiveDate) || formatDate(overviewData?.effectiveDate) || '',
        end_date: contract.end_date || formatDate(contract.expirationDate) || formatDate(overviewData?.expirationDate) || '',
        termination_date: contract.termination_date || '',
        // Reminders & Notices
        reminder_enabled: contract.reminder_enabled ?? true,
        reminder_days_before_end: contract.reminder_days_before_end ?? 60,
        notice_period: contract.notice_period || overviewData?.noticePeriod || ''
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
      {/* Breadcrumbs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumbs 
          items={[
            { label: 'Contracts', href: '/contracts', icon: FileText },
            { label: contract?.filename || 'Contract Details' }
          ]} 
          showHomeIcon 
        />
      </div>
      
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

        {/* Contract Quick Overview - Key Metadata at a Glance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Smart Status Banner - Shows the most important thing right now */}
          {(() => {
            // Use official schema field: end_date
            const endDate = metadata.end_date;
            const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const isExpired = daysRemaining !== null && daysRemaining < 0;
            const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 90;
            const isHighRisk = riskLevel === 'high';
            const needsReview = !complianceData?.compliant;
            
            // Determine what to show
            if (isExpired) {
              return (
                <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">Contract Expired</span>
                    <span className="mx-2">·</span>
                    <span>Ended {formatDate(endDate)} ({Math.abs(daysRemaining)} days ago)</span>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    Initiate Renewal
                  </Button>
                </div>
              );
            }
            if (isExpiringSoon) {
              return (
                <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <Clock className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">Expiring Soon</span>
                    <span className="mx-2">·</span>
                    <span>{daysRemaining} days until {formatDate(endDate)}</span>
                  </div>
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                    Set Reminder
                  </Button>
                </div>
              );
            }
            if (isHighRisk || needsReview) {
              return (
                <div className="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    {isHighRisk && <><span className="font-semibold">High Risk</span><span className="mx-2">·</span></>}
                    {needsReview && <span>Compliance review needed</span>}
                    {isHighRisk && !needsReview && <span>Review recommended</span>}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => setActiveTab('overview')}
                  >
                    View Details
                  </Button>
                </div>
              );
            }
            return null;
          })()}
          
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
              {/* Contract Value - The "What" */}
              <div className="p-5 border-b sm:border-b lg:border-b-0 sm:border-r border-slate-100 bg-gradient-to-br from-emerald-50/40 via-white to-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-100">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contract Value</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 mb-2">
                  {metadata.tcv_amount > 0 
                    ? formatCurrency(metadata.tcv_amount, metadata.currency || 'USD')
                    : <span className="text-slate-400 text-lg">Not specified</span>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {metadata.payment_type && metadata.payment_type !== 'none' && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs font-medium hover:bg-emerald-100">
                      {formatPaymentType(metadata.payment_type as any)}
                    </Badge>
                  )}
                  {metadata.periodicity && metadata.periodicity !== 'none' && (
                    <Badge variant="outline" className="text-xs text-slate-600 border-slate-200">
                      {formatPeriodicity(metadata.periodicity as any)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Contracting Parties - The "Who" */}
              <div className="p-5 border-b lg:border-b-0 sm:border-r border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-blue-100">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Parties</span>
                </div>
                <div className="space-y-2">
                  {metadata.external_parties.length > 0 ? (
                    metadata.external_parties.slice(0, 2).map((party, idx) => {
                      const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '');
                      return (
                        <div key={idx} className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                            isClient ? "bg-blue-100" : "bg-purple-100"
                          )}>
                            {isClient ? (
                              <Building className="h-3.5 w-3.5 text-blue-600" />
                            ) : (
                              <Users className="h-3.5 w-3.5 text-purple-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{party.legalName}</p>
                            {party.role && (
                              <p className={cn(
                                "text-xs",
                                isClient ? "text-blue-600" : "text-purple-600"
                              )}>
                                {party.role}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-400 italic">No parties identified</p>
                  )}
                  {metadata.external_parties.length > 2 && (
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      +{metadata.external_parties.length - 2} more parties
                    </button>
                  )}
                </div>
              </div>

              {/* Contract Period - The "When" */}
              <div className="p-5 border-b sm:border-b-0 sm:border-r border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-100">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</span>
                </div>
                {(() => {
                  const startDate = metadata.start_date;
                  const endDate = metadata.end_date;
                  const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                  const isActive = startDate && new Date(startDate) <= new Date() && (!endDate || new Date(endDate) >= new Date());
                  const isExpired = endDate && new Date(endDate) < new Date();
                  const isEvergreen = !endDate;
                  
                  return (
                    <div className="space-y-2">
                      {/* Date Range */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">{startDate ? formatDate(startDate) : '—'}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <span className={cn(
                          "font-medium",
                          isExpired ? "text-red-600" : 
                          isEvergreen ? "text-blue-600" :
                          daysRemaining !== null && daysRemaining <= 90 ? "text-amber-600" : 
                          "text-slate-700"
                        )}>
                          {endDate ? formatDate(endDate) : 'Evergreen'}
                        </span>
                      </div>
                      
                      {/* Status Badge + Days */}
                      <div className="flex items-center gap-2">
                        {isExpired ? (
                          <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        ) : isEvergreen ? (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5" />
                            Auto-renewing
                          </Badge>
                        ) : isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">
                            Not started
                          </Badge>
                        )}
                        {daysRemaining !== null && daysRemaining > 0 && !isEvergreen && (
                          <span className={cn(
                            "text-xs font-medium",
                            daysRemaining <= 30 ? "text-red-600" :
                            daysRemaining <= 90 ? "text-amber-600" : "text-slate-500"
                          )}>
                            {daysRemaining}d left
                          </span>
                        )}
                      </div>
                      
                      {/* Notice Period */}
                      {metadata.notice_period && !isExpired && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          {metadata.notice_period} notice
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Assessment - The "How" */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-100">
                    <Shield className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assessment</span>
                </div>
                <div className="space-y-2.5">
                  {/* Risk Level - Primary */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        riskLevel === 'low' ? 'bg-emerald-500' : 
                        riskLevel === 'medium' ? 'bg-amber-500' : 
                        'bg-red-500'
                      )} />
                      <span className="text-sm font-medium text-slate-700">Risk</span>
                    </div>
                    <Badge 
                      className={cn(
                        "text-xs font-medium border-0",
                        riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' : 
                        riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                      )}
                    >
                      {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                    </Badge>
                  </div>
                  
                  {/* Compliance */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        complianceData?.compliant ? 'bg-emerald-500' : 'bg-amber-500'
                      )} />
                      <span className="text-sm font-medium text-slate-700">Compliance</span>
                    </div>
                    <Badge 
                      className={cn(
                        "text-xs font-medium border-0",
                        complianceData?.compliant 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {complianceData?.compliant ? 'OK' : 'Review'}
                    </Badge>
                  </div>
                  
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Status</span>
                    <StatusBadge status={contract?.status || 'active'} />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick Actions Bar - Category, File Info, AI Assistant */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Category Selector */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
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
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setShowCategorySelector(true)}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Add category
                  </button>
                  <button 
                    onClick={handleAICategorize}
                    className="text-purple-500 hover:text-purple-700 p-0.5 rounded hover:bg-purple-50 transition-colors"
                    title="AI suggest category"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            
            {/* File Info - Compact */}
            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="font-medium">{contract?.mimeType?.split('/')[1]?.toUpperCase() || 'PDF'}</span>
              {contract?.fileSize && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{(contract.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                </>
              )}
              {contract?.uploadDate && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>Uploaded {formatDate(contract.uploadDate)}</span>
                </>
              )}
            </div>
            
            {/* Jurisdiction & Language (from official schema) */}
            {(metadata.jurisdiction || metadata.contract_language) && (
              <div className="flex items-center gap-1.5">
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
            
            {/* Spacer */}
            <div className="flex-1" />
            
            {/* Quick AI Analysis Button - uses schema fields */}
            <button 
              onClick={() => {
                // Build party names from external_parties array
                const partyNames = metadata.external_parties
                  .filter(p => p.legalName)
                  .map(p => p.legalName)
                  .join(' and ');
                
                window.dispatchEvent(new CustomEvent('openAIChatbot', {
                  detail: {
                    autoMessage: `Analyze this contract "${metadata.document_title || contract?.filename || 'Contract'}"${partyNames ? ` between ${partyNames}` : ''}. What are the key terms, obligations, and risks I should be aware of?`,
                    contractId: contract?.id
                  }
                }));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
            >
              <Sparkles className="h-4 w-4" />
              Analyze with AI
            </button>
          </div>
        </motion.div>

        {/* Main Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full bg-white rounded-lg border border-slate-200 p-1 h-auto">
              <TabsTrigger 
                value="overview" 
                className="flex-1 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md transition-all"
              >
                <FileText className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="flex-1 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md transition-all"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="flex-1 py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 rounded-md transition-all"
              >
                <History className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            {/* Summary Tab - Key insights and analysis */}
            <TabsContent value="overview" className="space-y-4">
              {/* Executive Summary */}
              <Card className="border-slate-200 overflow-hidden">
                <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-100">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Main Summary - using contract_short_description from schema */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {metadata.contract_short_description || overviewData?.summary || 'Contract summary will appear here once processing is complete.'}
                  </p>
                  
                  {/* Key Terms - Important contractual terms extracted by AI */}
                  {overviewData?.keyTerms && overviewData.keyTerms.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Key Terms Identified</p>
                      <div className="flex flex-wrap gap-1.5">
                        {overviewData.keyTerms.map((term: string, i: number) => (
                          <KeyTermBadge key={i} term={term} />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Parties & Dates Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Parties - using external_parties from schema */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      Contract Parties
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Show external_parties from official schema */}
                    {metadata.external_parties && metadata.external_parties.length > 0 ? (
                      <div className="space-y-2">
                        {metadata.external_parties.map((party, i) => {
                          const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '');
                          return (
                            <div 
                              key={i}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border",
                                isClient ? "bg-blue-50 border-blue-100" : "bg-purple-50 border-purple-100"
                              )}
                            >
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center",
                                isClient ? "bg-blue-100" : "bg-purple-100"
                              )}>
                                {isClient ? (
                                  <Building className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Users className="h-4 w-4 text-purple-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {party.legalName || 'Unknown Party'}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className={cn(
                                    "text-xs font-medium",
                                    isClient ? "text-blue-600" : "text-purple-600"
                                  )}>
                                    {party.role || 'Party'}
                                  </p>
                                  {party.legalForm && (
                                    <span className="text-xs text-slate-400">· {party.legalForm}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : overviewData?.parties && overviewData.parties.length > 0 ? (
                      // Fallback to AI-extracted parties if no schema parties
                      <div className="space-y-2">
                        {overviewData.parties.map((party: any, i: number) => (
                          <div 
                            key={i}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role)
                                ? "bg-blue-50 border-blue-100" 
                                : "bg-purple-50 border-purple-100"
                            )}
                          >
                            <div className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center",
                              ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role)
                                ? "bg-blue-100" 
                                : "bg-purple-100"
                            )}>
                              {['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role) ? (
                                <Building className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Users className="h-4 w-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{party.name || 'Unknown Party'}</p>
                              <p className={cn(
                                "text-xs font-medium",
                                ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role) ? "text-blue-600" : "text-purple-600"
                              )}>
                                {party.role || 'Party'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 py-4 text-center">No parties identified yet.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Key Dates - using schema fields: start_date, end_date, signature_date */}
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      Key Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Signature Date (if available) */}
                      {metadata.signature_date && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-slate-700">Signed</span>
                          </div>
                          <span className="text-sm font-semibold text-blue-700">
                            {formatDate(metadata.signature_date)}
                          </span>
                        </div>
                      )}
                      
                      {/* Start Date (from schema: start_date) */}
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium text-slate-700">Start Date</span>
                        </div>
                        <span className="text-sm font-semibold text-emerald-700">
                          {metadata.start_date ? formatDate(metadata.start_date) : '—'}
                        </span>
                      </div>
                      
                      {/* End/Expiration Date (from schema: end_date) */}
                      {(() => {
                        const endDate = metadata.end_date;
                        const isEvergreen = !endDate;
                        const isExpiringSoon = endDate && new Date(endDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                        const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                        
                        return (
                          <div className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            isEvergreen ? "bg-blue-50 border-blue-100" :
                            isExpiringSoon ? "bg-amber-50 border-amber-200" : 
                            "bg-slate-50 border-slate-100"
                          )}>
                            <div className="flex items-center gap-2">
                              {isEvergreen ? (
                                <div className="w-4 h-4 flex items-center justify-center">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                </div>
                              ) : isExpiringSoon ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Calendar className="h-4 w-4 text-slate-500" />
                              )}
                              <div>
                                <span className={cn(
                                  "text-sm font-medium",
                                  isEvergreen ? "text-blue-700" :
                                  isExpiringSoon ? "text-amber-700" : "text-slate-600"
                                )}>
                                  {isEvergreen ? 'Evergreen' : 'End Date'}
                                </span>
                                {daysRemaining !== null && daysRemaining > 0 && (
                                  <p className={cn(
                                    "text-xs",
                                    isExpiringSoon ? "text-amber-600" : "text-slate-500"
                                  )}>
                                    {daysRemaining} days remaining
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              "text-sm font-semibold",
                              isEvergreen ? "text-blue-700" :
                              isExpiringSoon ? "text-amber-700" : "text-slate-700"
                            )}>
                              {endDate ? formatDate(endDate) : 'No end date'}
                            </span>
                          </div>
                        );
                      })()}
                      
                      {/* Notice Period (if set) */}
                      {metadata.notice_period && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-600">Notice Period</span>
                          </div>
                          <span className="text-sm font-medium text-slate-700">
                            {metadata.notice_period}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Assessment */}
              {riskData && riskData.risks && riskData.risks.length > 0 && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          riskLevel === 'low' ? 'text-emerald-500' : 
                          riskLevel === 'medium' ? 'text-amber-500' : 'text-red-500'
                        )} />
                        Key Risks
                      </CardTitle>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' : 
                        riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        {riskData.risks.length} identified
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {riskData.risks.slice(0, 3).map((risk: any, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                            risk.level?.toLowerCase() === 'low' ? 'bg-emerald-500' : 
                            risk.level?.toLowerCase() === 'medium' ? 'bg-amber-500' : 'bg-red-500'
                          )} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{risk.category}</p>
                            <p className="text-xs text-slate-500 line-clamp-2">{risk.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Extracted Details */}
              {contract?.extractedData && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      AI Analysis
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Clauses, financials, risk assessment, and compliance details
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

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              {/* Reminders */}
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContractReminders contractId={params.id as string} />
                </CardContent>
              </Card>
              
              {/* Recent Activity */}
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
              
              {/* Audit Log */}
              <Card className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-500" />
                    Audit Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ContractAuditLog 
                    contractId={params.id as string}
                    maxHeight="300px"
                  />
                </CardContent>
              </Card>
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
        versions={contractVersions.length > 0 ? contractVersions : [
          { id: contract?.id || 'current', version: 'v1.0', title: 'Current Version', createdAt: contract?.uploadDate ? new Date(contract.uploadDate) : new Date(), createdBy: 'System', status: 'active' as const }
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

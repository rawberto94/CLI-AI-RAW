'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
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
import { QuickSummarizeButton, AISummarizer, AIInsightsCard, CompareButton, ContractComparison, ContractHealthScore, CategoryBadge, CategorySelector, ContractReminders, ContractAuditLog } from '@/components/contracts'
import { RobustPDFViewer } from '@/components/contracts/RobustPDFViewer'
import { HealthIndicator } from '@/components/contracts/EnhancedContractCard'

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

// Activity Tab Component
function ActivityTab({ contractId }: { contractId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        // Fetch approval history
        const approvalRes = await fetch(`/api/approvals?contractId=${contractId}`);
        if (approvalRes.ok) {
          const data = await approvalRes.json();
          setApprovalHistory(data.data?.items || []);
        }

        // Generate mock activities (would come from activity log API)
        const mockActivities = [
          {
            id: '1',
            type: 'view',
            user: 'Sarah Johnson',
            action: 'viewed this contract',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          },
          {
            id: '2',
            type: 'edit',
            user: 'Mike Chen',
            action: 'updated contract metadata',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
          },
          {
            id: '3',
            type: 'share',
            user: 'You',
            action: 'shared with Legal Team',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
          {
            id: '4',
            type: 'upload',
            user: 'You',
            action: 'uploaded this contract',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
        ];
        setActivities(mockActivities);
      } catch (e) {
        // Failed to fetch activity - non-critical error
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [contractId]);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white border border-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Approval Workflow Status - Hidden for now, will be enabled in future */}
      {/* {approvalHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Approval Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvalHistory.map((approval: any) => (
                <div key={approval.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={cn(
                          approval.status === 'approved' && 'bg-green-50 text-green-700 border-green-200',
                          approval.status === 'rejected' && 'bg-red-50 text-red-700 border-red-200',
                          approval.status === 'pending' && 'bg-amber-50 text-amber-700 border-amber-200'
                        )}
                      >
                        {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                      </Badge>
                      <span className="text-sm text-slate-600">{approval.title || 'Approval Request'}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatTimeAgo(new Date(approval.requestedAt || approval.createdAt))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                return (
                  <div 
                    key={activity.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{activity.user}</span>{' '}
                        {activity.action}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 ml-4">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType; label: string; animate?: boolean }> = {
    completed: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      icon: CheckCircle2,
      label: 'Completed'
    },
    processing: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      icon: Loader2,
      label: 'Processing',
      animate: true
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Error'
    },
    failed: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: AlertCircle,
      label: 'Failed'
    },
    uploaded: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
      label: 'Pending'
    }
  };
  
  const statusConfig = config[status.toLowerCase()] || {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-700',
    icon: FileText,
    label: status
  };
  
  const Icon = statusConfig.icon;
  const shouldAnimate = 'animate' in statusConfig && statusConfig.animate;
  
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium border", statusConfig.bg, statusConfig.text)}>
      <Icon className={cn("h-3 w-3", shouldAnimate && "animate-spin")} />
      {statusConfig.label}
    </Badge>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={copyId}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-mono transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <span className="truncate max-w-[100px]">{id.slice(0, 8)}...</span>
                <Copy className="h-3 w-3" />
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs">{id}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  color = 'slate',
  score
}: { 
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'slate'
  score?: number
}) {
  const gradientClasses = {
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
    slate: 'from-slate-500 to-gray-600'
  };

  const bgClasses = {
    emerald: 'bg-emerald-50/50 border-emerald-100/50',
    amber: 'bg-amber-50/50 border-amber-100/50',
    red: 'bg-red-50/50 border-red-100/50',
    blue: 'bg-blue-50/50 border-blue-100/50',
    purple: 'bg-purple-50/50 border-purple-100/50',
    slate: 'bg-slate-50/50 border-slate-100/50'
  };
  
  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "bg-white/90 backdrop-blur-sm rounded-xl border p-4 transition-all duration-300 hover:shadow-lg",
        bgClasses[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={cn(
            "inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 shadow-lg",
            `bg-gradient-to-br ${gradientClasses[color]}`
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent mt-1">
            {value}
          </p>
          {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
        </div>
        {score !== undefined && (
          <ScoreRing score={score} size="sm" />
        )}
      </div>
    </motion.div>
  );
}

function KeyTermBadge({ term }: { term: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
      {term}
    </span>
  );
}

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
  const [pdfSplitRatio, setPdfSplitRatio] = useState(45)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)
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

  // Handle panel resize mouse events
  useEffect(() => {
    if (!isResizingPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const containerRect = splitContainerRef.current.getBoundingClientRect();
      const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      // Clamp between 20% and 75%
      setPdfSplitRatio(Math.max(20, Math.min(75, newRatio)));
    };
    
    const handleMouseUp = () => {
      setIsResizingPanel(false);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingPanel]);

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
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-white/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-slate-600 hover:bg-white/50">
                <Link href="/contracts">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Contracts
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent line-clamp-1">
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
            
            {/* Right: Actions - Simplified */}
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
                      className="h-9 w-9"
                      aria-label="Refresh contract data"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                    <ChevronDown className="h-4 w-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowPdfViewer(!showPdfViewer)}>
                    <FileType className="h-4 w-4 mr-2" />
                    {showPdfViewer ? 'Hide Original PDF' : 'View Original PDF'}
                    <span className="ml-auto text-xs text-muted-foreground">P</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)} disabled={isEditing}>
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
                      <span>1-5</span><span>Switch tabs</span>
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
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingPanel(true);
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

        {/* Contract Health Score - Enhanced Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <Card className="bg-gradient-to-br from-white to-slate-50/50 border-slate-200/80 overflow-hidden">
            <CardContent className="p-4">
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
                
                {/* Health Details */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white/80 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Completeness</p>
                    <p className="text-lg font-bold text-slate-900">{contract?.status === 'completed' ? '100%' : '75%'}</p>
                  </div>
                  <div className="text-center p-3 bg-white/80 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Risk Level</p>
                    <p className={cn(
                      "text-lg font-bold",
                      riskLevel === 'low' ? 'text-emerald-600' : 
                      riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white/80 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">AI Artifacts</p>
                    <p className="text-lg font-bold text-purple-600">{contract?.artifactCount || 5}</p>
                  </div>
                  <div className="text-center p-3 bg-white/80 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Compliance</p>
                    <p className={cn(
                      "text-lg font-bold",
                      complianceData?.compliant ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                      {complianceData?.compliant ? 'Pass' : 'Review'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats - Compact inline badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-3 mb-6"
        >
          {financialData?.totalValue && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                {formatCurrency(financialData.totalValue, financialData.currency || 'USD')}
              </span>
            </div>
          )}
          
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border rounded-lg",
            riskLevel === 'low' ? 'bg-emerald-50 border-emerald-200' : 
            riskLevel === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          )}>
            <AlertTriangle className={cn(
              "h-4 w-4",
              riskLevel === 'low' ? 'text-emerald-600' : 
              riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
            )} />
            <span className={cn(
              "text-sm font-medium",
              riskLevel === 'low' ? 'text-emerald-700' : 
              riskLevel === 'medium' ? 'text-amber-700' : 'text-red-700'
            )}>
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
            </span>
          </div>
          
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border rounded-lg",
            complianceData?.compliant ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          )}>
            <Shield className={cn(
              "h-4 w-4",
              complianceData?.compliant ? 'text-emerald-600' : 'text-amber-600'
            )} />
            <span className={cn(
              "text-sm font-medium",
              complianceData?.compliant ? 'text-emerald-700' : 'text-amber-700'
            )}>
              {complianceData?.compliant ? 'Compliant' : 'Review Needed'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
            <Brain className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">
              {contract?.artifactCount || 5} AI Artifacts
            </span>
          </div>
        </motion.div>

        {/* Category & Quick Actions Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="mb-6 flex flex-wrap items-center gap-4"
        >
          {/* Category */}
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2">
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
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
              >
                <span>Add category</span>
              </button>
            )}
            {!contract?.category && (
              <button 
                onClick={handleAICategorize}
                className="ml-1 text-purple-500 hover:text-purple-700"
                title="AI suggest category"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          
          {/* Renewal Soon Alert - Only show when expiring within 90 days */}
          {overviewData?.expirationDate && new Date(overviewData.expirationDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) && (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>Renewal Soon</span>
            </div>
          )}
          
          {/* Ask AI - Single prominent action */}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('openAIChatbot'))}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Ask AI
          </button>
        </motion.div>

        {/* Main Tabs - Simplified to 3 core tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-1.5">
              <TabsList className="w-full bg-transparent gap-1">
                <TabsTrigger 
                  value="overview" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
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

            {/* Details Tab - Editable Metadata */}
            <TabsContent value="details" className="space-y-6">
              {/* Success Message */}
              <AnimatePresence>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700">
                      Contract metadata saved successfully and stored in the database.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Editable Contract Information */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-600" />
                        Contract Metadata
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {isEditing 
                          ? 'Edit the AI-extracted metadata. Changes will be saved to the database.' 
                          : 'Review and edit contract details. Click Edit to make changes.'}
                      </CardDescription>
                    </div>
                    {!isEditing ? (
                      <Button 
                        size="sm" 
                        onClick={() => setIsEditing(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Edit Metadata
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveMetadata}
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1.5" />
                          )}
                          Approve & Save
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contract ID - Read only */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contract ID</Label>
                      <p className="text-sm font-mono text-slate-900 mt-1">{params.id}</p>
                    </div>

                    {/* File Name - Read only */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Name</Label>
                      <p className="text-sm text-slate-900 mt-1">{contract?.filename || 'Unknown'}</p>
                    </div>

                    {/* Contract Type - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Contract Type</Label>
                      {isEditing ? (
                        <Select 
                          value={metadata.contractType} 
                          onValueChange={(v) => handleMetadataChange('contractType', v)}
                        >
                          <SelectTrigger className="h-9 bg-white">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTRACT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-slate-900">{metadata.contractType || overviewData?.contractType || 'Unknown'}</p>
                      )}
                    </div>

                    {/* Status - Read only */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</Label>
                      <div className="mt-1"><StatusBadge status={contract?.status || 'unknown'} /></div>
                    </div>

                    {/* Total Value - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Value</Label>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={metadata.totalValue}
                            onChange={(e) => handleMetadataChange('totalValue', e.target.value)}
                            placeholder="Enter value"
                            className="h-9 bg-white flex-1"
                          />
                          <Select 
                            value={metadata.currency} 
                            onValueChange={(v) => handleMetadataChange('currency', v)}
                          >
                            <SelectTrigger className="h-9 bg-white w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-900">
                          {metadata.totalValue 
                            ? `${metadata.currency} ${parseFloat(metadata.totalValue).toLocaleString()}`
                            : financialData?.totalValue 
                              ? formatCurrency(financialData.totalValue, financialData.currency || 'USD')
                              : 'Not specified'}
                        </p>
                      )}
                    </div>

                    {/* File Size/Type - Read only */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Details</Label>
                      <p className="text-sm text-slate-900 mt-1">
                        {contract?.fileSize ? `${(contract.fileSize / 1024).toFixed(1)} KB` : 'Unknown'} • {contract?.mimeType || 'Unknown'}
                      </p>
                    </div>

                    {/* Effective Date - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Effective Date</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={metadata.effectiveDate}
                          onChange={(e) => handleMetadataChange('effectiveDate', e.target.value)}
                          className="h-9 bg-white"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">
                          {metadata.effectiveDate 
                            ? formatDate(metadata.effectiveDate) 
                            : overviewData?.effectiveDate 
                              ? formatDate(overviewData.effectiveDate) 
                              : 'Not specified'}
                        </p>
                      )}
                    </div>

                    {/* Expiration Date - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Expiration Date</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={metadata.expirationDate}
                          onChange={(e) => handleMetadataChange('expirationDate', e.target.value)}
                          className="h-9 bg-white"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">
                          {metadata.expirationDate 
                            ? formatDate(metadata.expirationDate) 
                            : overviewData?.expirationDate 
                              ? formatDate(overviewData.expirationDate) 
                              : 'Not specified'}
                        </p>
                      )}
                    </div>

                    {/* Client Name - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Client / Buyer</Label>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={metadata.clientName}
                          onChange={(e) => handleMetadataChange('clientName', e.target.value)}
                          placeholder="Enter client name"
                          className="h-9 bg-white"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">
                          {metadata.clientName || overviewData?.parties?.find((p: any) => ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(p.role))?.name || 'Not specified'}
                        </p>
                      )}
                    </div>

                    {/* Supplier Name - Editable */}
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Supplier / Vendor</Label>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={metadata.supplierName}
                          onChange={(e) => handleMetadataChange('supplierName', e.target.value)}
                          placeholder="Enter supplier name"
                          className="h-9 bg-white"
                        />
                      ) : (
                        <p className="text-sm text-slate-900">
                          {metadata.supplierName || overviewData?.parties?.find((p: any) => ['Supplier', 'Vendor', 'Service Provider', 'Provider', 'Contractor', 'Seller'].includes(p.role))?.name || 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description - Full width */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">Description / Summary</Label>
                    {isEditing ? (
                      <Textarea
                        value={metadata.description}
                        onChange={(e) => handleMetadataChange('description', e.target.value)}
                        placeholder="Enter contract description or summary..."
                        className="mt-1 bg-white min-h-[100px]"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 mt-1">
                        {metadata.description || overviewData?.summary || 'No description available.'}
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {metadata.tags.map((tag, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className={cn(
                            "text-xs",
                            isEditing && "pr-1"
                          )}
                        >
                          {tag}
                          {isEditing && (
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {metadata.tags.length === 0 && !isEditing && (
                        <span className="text-sm text-slate-500">No tags</span>
                      )}
                    </div>
                    {isEditing && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="Add a tag..."
                          className="h-8 bg-white text-sm"
                        />
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleAddTag}
                          className="h-8"
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Details */}
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

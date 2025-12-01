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
  History
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
import { GenerationFlowVisualization } from '@/components/artifacts/GenerationFlowVisualization'
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

// ============ TYPES ============

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
  processing?: {
    progress: number
    currentStage: string
    status: string
  }
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

function ApprovalStatusBadge({ contractId }: { contractId: string }) {
  const [status, setStatus] = useState<{
    hasActiveApproval: boolean;
    status: string;
    currentStep?: number;
    totalSteps?: number;
    currentApprover?: string;
  } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/approvals?contractId=${contractId}`);
        if (response.ok) {
          const data = await response.json();
          const items = data.data?.items || [];
          const activeApproval = items.find((item: { status: string }) => 
            item.status === 'pending' || item.status === 'in_progress'
          );
          if (activeApproval) {
            setStatus({
              hasActiveApproval: true,
              status: activeApproval.status,
              currentStep: activeApproval.currentStep,
              totalSteps: activeApproval.totalSteps,
              currentApprover: activeApproval.stage || activeApproval.assignedTo?.name,
            });
          }
        }
      } catch (e) {
        console.log('Failed to fetch approval status');
      }
    };
    fetchStatus();
  }, [contractId]);

  if (!status?.hasActiveApproval) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-amber-50 border-amber-200 text-amber-700 gap-1.5"
          >
            <Clock className="h-3 w-3" />
            Approval {status.currentStep}/{status.totalSteps}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-medium">Pending Approval</p>
            {status.currentApprover && (
              <p className="text-slate-400">Awaiting: {status.currentApprover}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
        console.log('Failed to fetch activity');
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [contractId]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'view': return Eye;
      case 'edit': return Pencil;
      case 'share': return Share2;
      case 'upload': return FileText;
      case 'approval': return CheckCircle2;
      default: return FileText;
    }
  };

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
      {/* Approval Workflow Status */}
      {approvalHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-amber-600" />
              Approval Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalHistory.map((approval: any) => (
                <div key={approval.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
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
                  
                  {/* Approval Chain Progress */}
                  {approval.approvalChain && approval.approvalChain.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {approval.approvalChain.map((step: any, idx: number) => (
                        <React.Fragment key={idx}>
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
                            step.status === 'completed' && 'bg-green-100 text-green-700',
                            step.status === 'pending' && 'bg-amber-100 text-amber-700',
                            step.status === 'waiting' && 'bg-slate-100 text-slate-500'
                          )}>
                            {step.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                            {step.status === 'pending' && <Clock className="h-3 w-3" />}
                            {step.role}
                          </div>
                          {idx < approval.approvalChain.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div 
                    key={activity.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{activity.user}</span>{' '}
                        {activity.action}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
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
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100'
  };
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg mb-3", colorClasses[color])}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
        </div>
        {score !== undefined && (
          <ScoreRing score={score} size="sm" />
        )}
      </div>
    </div>
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
  const { joinDocument, leaveDocument } = useWebSocket()
  const crossModule = useCrossModuleInvalidation()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
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

  // Join document for real-time collaboration
  useEffect(() => {
    if (params.id) {
      joinDocument(params.id as string, 'contract')
    }
    return () => {
      leaveDocument()
    }
  }, [params.id, joinDocument, leaveDocument])

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
  useEffect(() => {
    if (contract) {
      const overviewData = contract.extractedData?.overview
      const financialData = contract.extractedData?.financial
      setMetadata({
        contractType: overviewData?.contractType || '',
        effectiveDate: overviewData?.effectiveDate ? new Date(overviewData.effectiveDate).toISOString().split('T')[0] ?? '' : '',
        expirationDate: overviewData?.expirationDate ? new Date(overviewData.expirationDate).toISOString().split('T')[0] ?? '' : '',
        totalValue: financialData?.totalValue?.toString() || '',
        currency: financialData?.currency || 'USD',
        clientName: String(overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.name ?? ''),
        supplierName: String(overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name ?? ''),
        description: overviewData?.summary || '',
        tags: Array.isArray(contract.extractedData?.tags) ? contract.extractedData.tags : []
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
    // Reset metadata to current contract values
    if (contract) {
      const overviewData = contract.extractedData?.overview
      const financialData = contract.extractedData?.financial
      setMetadata({
        contractType: overviewData?.contractType || '',
        effectiveDate: overviewData?.effectiveDate ? (new Date(overviewData.effectiveDate).toISOString().split('T')[0] ?? '') : '',
        expirationDate: overviewData?.expirationDate ? (new Date(overviewData.expirationDate).toISOString().split('T')[0] ?? '') : '',
        totalValue: financialData?.totalValue?.toString() || '',
        currency: financialData?.currency || 'USD',
        clientName: String(overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.name ?? ''),
        supplierName: String(overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name ?? ''),
        description: overviewData?.summary || '',
        tags: Array.isArray(contract.extractedData?.tags) ? contract.extractedData.tags : []
      })
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                isNotFound ? 'bg-amber-100' : 'bg-red-100'
              }`}>
                <AlertCircle className={`h-6 w-6 ${isNotFound ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {isNotFound ? 'Contract Not Found' : 'Error Loading Contract'}
              </h2>
              <p className="text-sm text-slate-600 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                {!isNotFound && (
                  <Button onClick={loadContract} size="sm">
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
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="text-slate-600">
                <Link href="/contracts">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Contracts
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-slate-900 line-clamp-1">
                    {contract?.filename || 'Contract Details'}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CopyableId id={params.id as string} />
                    <span className="text-slate-300">•</span>
                    <StatusBadge status={contract?.status || 'unknown'} />
                    <ApprovalStatusBadge contractId={params.id as string} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Collaboration Presence */}
              <PresenceIndicator maxAvatars={3} showConnectionStatus={true} />
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={loadContract}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 mr-2" />
                    View Original
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Banner */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <GenerationFlowVisualization
                contractId={params.id as string}
                isConnected={true}
                currentStage={(contract?.processing?.currentStage || 'ARTIFACT_GENERATION') as any}
                progress={contract?.processing?.progress || 50}
                artifacts={[]}
                onRetry={loadContract}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            icon={DollarSign}
            label="Contract Value"
            value={financialData?.totalValue ? formatCurrency(financialData.totalValue, financialData.currency || 'USD') : '$0'}
            subValue={financialData?.currency || 'USD'}
            color="emerald"
          />
          <StatCard
            icon={AlertTriangle}
            label="Risk Level"
            value={riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            subValue={`${riskData?.risks?.length || 0} factors identified`}
            color={riskLevel === 'low' ? 'emerald' : riskLevel === 'medium' ? 'amber' : 'red'}
            score={riskScore}
          />
          <StatCard
            icon={Shield}
            label="Compliance"
            value={complianceData?.compliant ? 'Compliant' : 'Review Needed'}
            subValue={`${complianceData?.checks?.length || 0} checks passed`}
            color={complianceData?.compliant ? 'emerald' : 'amber'}
          />
          <StatCard
            icon={Brain}
            label="AI Artifacts"
            value={contract?.artifactCount || 5}
            subValue="Generated"
            color="purple"
          />
        </motion.div>

        {/* Cross-Module Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border-slate-200">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-600 mr-2">Quick Actions:</span>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-indigo-50 hover:border-indigo-300"
                          onClick={handleDownload}
                        >
                          <Download className="h-4 w-4 mr-1.5 text-indigo-600" />
                          Download
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download original document</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-cyan-50 hover:border-cyan-300"
                          asChild
                        >
                          <Link href={`/contracts/${params.id}/versions`}>
                            <History className="h-4 w-4 mr-1.5 text-cyan-600" />
                            Versions
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compare document versions</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-red-50 hover:border-red-300"
                          asChild
                        >
                          <Link href={`/contracts/${params.id}/redline`}>
                            <GitCompare className="h-4 w-4 mr-1.5 text-red-600" />
                            Redline
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit and redline this contract</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-purple-50 hover:border-purple-300"
                          onClick={() => {
                            // Open the floating AI chatbot
                            window.dispatchEvent(new CustomEvent('openAIChatbot'));
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-1.5 text-purple-600" />
                          Ask AI
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Chat with AI about this contract</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-amber-50 hover:border-amber-300"
                          asChild
                        >
                          <Link href="/renewals">
                            <Clock className="h-4 w-4 mr-1.5 text-amber-600" />
                            Renewals
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Manage renewal schedule</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-green-50 hover:border-green-300"
                          onClick={() => setShowShareDialog(true)}
                        >
                          <Share2 className="h-4 w-4 mr-1.5 text-green-600" />
                          Share
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share with team members</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-blue-50 hover:border-blue-300"
                          onClick={() => setShowApprovalModal(true)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-blue-600" />
                          Submit to Workflow
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Submit contract for approval workflow</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-indigo-50 hover:border-indigo-300"
                          asChild
                        >
                          <Link href={`/contracts/${params.id}/sign`}>
                            <Pencil className="h-4 w-4 mr-1.5 text-indigo-600" />
                            Signatures
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Collect signatures for this contract</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-white hover:bg-emerald-50 hover:border-emerald-300"
                          asChild
                        >
                          <Link href={`/contracts/${params.id}/store`}>
                            <Shield className="h-4 w-4 mr-1.5 text-emerald-600" />
                            Finalize & Store
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Finalize and archive the contract</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Related Modules Summary */}
                <div className="flex items-center gap-4 text-sm">
                  {overviewData?.expirationDate && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>
                        {new Date(overviewData.expirationDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) 
                          ? 'Renewal Soon' 
                          : 'Active'}
                      </span>
                    </div>
                  )}
                  {riskLevel === 'high' && (
                    <div className="flex items-center gap-1.5 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>High Risk</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Tabs */}
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
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="artifacts" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  AI Analysis
                </TabsTrigger>
                <TabsTrigger 
                  value="details" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger 
                  value="activity" 
                  className="flex-1 data-[state=active]:bg-slate-100 data-[state=active]:shadow-none rounded-lg"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
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
                              party.role === 'Client' || party.role === 'Buyer' 
                                ? "bg-blue-100" 
                                : "bg-purple-100"
                            )}>
                              {party.role === 'Client' || party.role === 'Buyer' ? (
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
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="artifacts">
              {contract?.extractedData && (
                <EnhancedArtifactViewer
                  artifacts={contract.extractedData}
                  contractId={params.id as string}
                  initialTab={searchParams.get('tab') || 'overview'}
                />
              )}
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
                          {metadata.clientName || overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.name || 'Not specified'}
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
                          {metadata.supplierName || overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name || 'Not specified'}
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

            {/* Activity Tab - Approval History & Collaboration */}
            <TabsContent value="activity" className="space-y-6">
              <ActivityTab contractId={params.id as string} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        documentId={params.id as string}
        documentType="contract"
        documentTitle={contract?.filename || 'Contract'}
      />

      {/* Submit for Approval Modal */}
      <SubmitForApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        contractId={params.id as string}
        contractTitle={contract?.filename || 'Contract'}
      />
    </div>
  )
}

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  FileText,
  DollarSign,
  Shield,
  FileCheck,
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
  Info
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
import { GenerationFlowVisualization } from '@/components/artifacts/GenerationFlowVisualization'
import { ScoreRing } from '@/components/artifacts/ArtifactCards'
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

// ============ HELPER COMPONENTS ============

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
  
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium border", statusConfig.bg, statusConfig.text)}>
      <Icon className={cn("h-3 w-3", statusConfig.animate && "animate-spin")} />
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
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const loadContract = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        headers: { 'x-data-mode': dataMode }
      })
      
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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Contract</h2>
              <p className="text-sm text-slate-600 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={loadContract} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contracts">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
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
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex items-center gap-2">
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
                  <DropdownMenuItem>
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

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Contract Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contract ID</dt>
                      <dd className="text-sm font-mono text-slate-900 mt-1">{params.id}</dd>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Name</dt>
                      <dd className="text-sm text-slate-900 mt-1">{contract?.filename || 'Unknown'}</dd>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Size</dt>
                      <dd className="text-sm text-slate-900 mt-1">
                        {contract?.fileSize ? `${(contract.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}
                      </dd>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">File Type</dt>
                      <dd className="text-sm text-slate-900 mt-1">{contract?.mimeType || 'Unknown'}</dd>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Contract Type</dt>
                      <dd className="text-sm text-slate-900 mt-1">{overviewData?.contractType || 'Unknown'}</dd>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-lg">
                      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</dt>
                      <dd className="mt-1"><StatusBadge status={contract?.status || 'unknown'} /></dd>
                    </div>
                  </dl>
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
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  FileText,
  DollarSign,
  Shield,
  FileCheck,
  TrendingUp,
  Download,
  MoreVertical,
  Sparkles,
  Clock,
  Calendar,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  MessageSquare,
  Activity,
  GitCompare,
  FileSignature,
  Share2,
  Bell,
  ChevronRight,
  Scale,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EnhancedArtifactViewer } from '@/components/artifacts/EnhancedArtifactViewer'
import { GenerationFlowVisualization, CompactGenerationFlow } from '@/components/artifacts/GenerationFlowVisualization'
import { MetricCard, ScoreRing } from '@/components/artifacts/ArtifactCards'
import { formatCurrency, formatDate, getRiskColor, getComplianceColor } from '@/lib/design-tokens'
import { CustomArtifactGenerator } from '@/components/artifacts/CustomArtifactGenerator'
import SmartMetadataValidator from '@/components/metadata/SmartMetadataValidator'
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator'
import { useContract } from '@/hooks/use-queries'

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

interface QuickAction {
  id: string
  label: string
  icon: React.ElementType
  color: string
  onClick: () => void
}

// ============ HELPER COMPONENTS ============

function StatusBadge({ status }: { status: string }) {
  const config = {
    completed: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      icon: CheckCircle2,
      label: 'Completed'
    },
    processing: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-700',
      icon: Loader2,
      label: 'Processing',
      animate: true
    },
    error: {
      bg: 'bg-rose-100',
      text: 'text-rose-700',
      icon: AlertCircle,
      label: 'Error'
    },
    failed: {
      bg: 'bg-rose-100',
      text: 'text-rose-700',
      icon: AlertCircle,
      label: 'Failed'
    },
    uploaded: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: Clock,
      label: 'Pending'
    }
  }[status.toLowerCase()] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    icon: FileText,
    label: status
  };
  
  const Icon = config.icon;
  
  return (
    <Badge className={cn("px-3 py-1.5", config.bg, config.text)}>
      <Icon className={cn("h-3.5 w-3.5 mr-1.5", config.animate && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

function ContractIdBadge({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={copyId}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" />
          <span className="text-emerald-600">Copied!</span>
        </>
      ) : (
        <>
          <span className="truncate max-w-[120px]">{id}</span>
          <Copy className="h-3 w-3" />
        </>
      )}
    </button>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  
  return (
    <button
      onClick={action.onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white",
        "hover:bg-slate-50 hover:border-slate-300 transition-all",
        "text-sm font-medium text-slate-700"
      )}
    >
      <Icon className={cn("h-4 w-4", action.color)} />
      {action.label}
    </button>
  );
}

function InsightCard({ insight, index }: { insight: any; index: number }) {
  const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
    yellow: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
    red: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600' }
  };
  
  const defaultColors = { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' };
  const colors = colorMap[insight.color] ?? defaultColors;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "p-4 rounded-xl border-l-4",
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles className={cn("h-5 w-5 mt-0.5 shrink-0", colors.icon)} />
        <div>
          <h4 className="font-semibold text-slate-900">{insight.title}</h4>
          <p className="text-sm text-slate-600 mt-1">{insight.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============ MAIN COMPONENT ============

export default function EnhancedContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dataMode } = useDataMode()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('artifacts')

  const loadContract = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        headers: { 'x-data-mode': dataMode }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to load contract: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setContract(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contract'
      setError(errorMessage)
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
  const clausesData = contract?.extractedData?.clauses

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      color: 'text-slate-600',
      onClick: () => console.log('Export')
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      color: 'text-blue-600',
      onClick: () => console.log('Share')
    },
    {
      id: 'remind',
      label: 'Set Reminder',
      icon: Bell,
      color: 'text-amber-600',
      onClick: () => console.log('Remind')
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      color: 'text-purple-600',
      onClick: () => console.log('Compare')
    }
  ];

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-rose-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Error Loading Contract
              </h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={loadContract} className="bg-indigo-600 hover:bg-indigo-700">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Link href="/contracts">
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-24 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  const isProcessing = contract?.status?.toLowerCase() === 'processing' || 
                       contract?.status?.toLowerCase() === 'uploaded';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white overflow-x-hidden">
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-4">
              <Link href="/contracts">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200/50">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {contract?.filename || 'Contract Details'}
                  </h1>
                </div>
                
                <div className="flex items-center gap-3">
                  <ContractIdBadge id={params.id as string} />
                  <StatusBadge status={contract?.status || 'unknown'} />
                  {contract?.uploadDate && (
                    <span className="text-sm text-slate-500">
                      Uploaded {formatDate(contract.uploadDate)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Real-time collaboration presence indicator */}
              <PresenceIndicator 
                maxAvatars={4}
                showConnectionStatus
              />
              {quickActions.map(action => (
                <QuickActionButton key={action.id} action={action} />
              ))}
              <Button onClick={loadContract} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Processing Status */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
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

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {/* Contract Value */}
          {financialData?.totalValue && (
            <MetricCard
              title="Contract Value"
              value={formatCurrency(financialData.totalValue, financialData.currency || 'USD')}
              icon={DollarSign}
              color="green"
              trend={{ value: 12, label: 'vs avg' }}
            />
          )}
          
          {/* Risk Score */}
          {riskData?.riskScore !== undefined && (
            <Card className="border-slate-200/80 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Risk Score</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {riskData.riskScore}/100
                    </p>
                    <Badge 
                      className={cn(
                        "mt-2",
                        riskData.riskScore < 30 ? "bg-emerald-100 text-emerald-700" :
                        riskData.riskScore < 60 ? "bg-amber-100 text-amber-700" :
                        "bg-rose-100 text-rose-700"
                      )}
                    >
                      {riskData.riskLevel || (riskData.riskScore < 30 ? 'Low' : riskData.riskScore < 60 ? 'Medium' : 'High')}
                    </Badge>
                  </div>
                  <ScoreRing score={riskData.riskScore} size="md" />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Compliance Score */}
          {complianceData?.complianceScore !== undefined && (
            <Card className="border-slate-200/80 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Compliance</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {complianceData.complianceScore}%
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      {complianceData.regulations?.length || 0} regulations
                    </p>
                  </div>
                  <ScoreRing score={complianceData.complianceScore} size="md" />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Artifacts */}
          <MetricCard
            title="AI Artifacts"
            value={contract?.artifactCount || contract?.artifacts?.length || 5}
            subtitle="Generated"
            icon={Sparkles}
            color="purple"
          />
        </motion.div>

        {/* Contract Summary */}
        {overviewData?.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <Card className="border-slate-200/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">{overviewData.summary}</p>
                
                {/* Parties */}
                {overviewData.parties && overviewData.parties.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">Contract Parties</h4>
                    <div className="flex flex-wrap gap-3">
                      {overviewData.parties.map((party: any, i: number) => (
                        <div 
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg"
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            party.role === 'Client' || party.role === 'Buyer' 
                              ? "bg-blue-100" 
                              : "bg-purple-100"
                          )}>
                            {party.role === 'Client' || party.role === 'Buyer' ? (
                              <Building className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Users className="h-4 w-4 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{party.name}</p>
                            <p className="text-xs text-slate-500">{party.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Key Dates */}
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-600 mb-3">Key Dates</h4>
                  <div className="grid grid-cols-3 gap-4">
                    {overviewData.startDate && (
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <p className="text-xs text-emerald-600 font-medium">Effective</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {formatDate(overviewData.startDate)}
                        </p>
                      </div>
                    )}
                    {overviewData.contractDate && (
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium">Signed</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {formatDate(overviewData.contractDate)}
                        </p>
                      </div>
                    )}
                    {(overviewData.endDate || overviewData.expiryDate) && (
                      <div className="text-center p-3 bg-amber-50 rounded-lg">
                        <p className="text-xs text-amber-600 font-medium">Expires</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {formatDate(overviewData.endDate || overviewData.expiryDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* AI Insights */}
        {contract?.insights && contract.insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-900">AI Insights</h2>
              <Badge className="bg-purple-100 text-purple-700">
                {contract.insights.length} findings
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contract.insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Artifacts Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">AI-Generated Artifacts</h2>
            <Badge className="bg-indigo-100 text-indigo-700">
              {contract?.artifactCount || 5} artifacts
            </Badge>
          </div>
          
          {contract?.extractedData && (
            <EnhancedArtifactViewer
              artifacts={contract.extractedData}
              contractId={params.id as string}
              initialTab={searchParams.get('tab') || 'overview'}
            />
          )}
        </motion.div>

        {/* Custom Artifact Generation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-900">Custom Analysis</h2>
            <Badge className="bg-purple-100 text-purple-700">AI-Powered</Badge>
          </div>
          <CustomArtifactGenerator
            contractId={params.id as string}
            contractText={contract?.filename || 'Contract'}
            onInsightsGenerated={(insights) => {
              console.log('New insights generated:', insights);
              // Optionally refresh artifacts
            }}
          />
        </motion.div>

        {/* Metadata Validation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.47 }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Metadata Validation</h2>
            <Badge className="bg-emerald-100 text-emerald-700">AI + Human</Badge>
          </div>
          <SmartMetadataValidator
            contractId={params.id as string}
            initialMetadata={contract?.extractedData}
            onSave={(metadata) => {
              console.log('Metadata saved:', metadata);
              // Optionally refresh contract data
            }}
          />
        </motion.div>

        {/* Quick Links Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="border-slate-200/80 hover:border-slate-300 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Comments</h3>
                <p className="text-sm text-slate-500">View discussion</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </CardContent>
          </Card>
          
          <Card className="border-slate-200/80 hover:border-slate-300 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100 group-hover:bg-purple-200 transition-colors">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Activity</h3>
                <p className="text-sm text-slate-500">View history</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </CardContent>
          </Card>
          
          <Card className="border-slate-200/80 hover:border-slate-300 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 group-hover:bg-amber-200 transition-colors">
                <FileSignature className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Signatures</h3>
                <p className="text-sm text-slate-500">Request signatures</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

// Import for Brain icon that was missing
import { Brain } from 'lucide-react'

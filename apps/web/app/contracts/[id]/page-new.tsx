'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  FileText,
  DollarSign,
  Shield,
  FileCheck,
  TrendingUp,
  Download as _Download,
  Edit as _Edit,
  MoreVertical as _MoreVertical,
  Sparkles,
  Clock,
  Calendar,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { ModernArtifactViewer } from '@/components/contracts/ModernArtifactViewer'
import { ExportMenu } from '@/components/contracts/ExportMenu'

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

export default function ContractDetailPage() {
  const params = useParams()
  const _router = useRouter()
  const searchParams = useSearchParams()
  const { dataMode } = useDataMode()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, _setActiveTab] = useState(searchParams.get('tab') || 'overview')

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
    } finally {
      setLoading(false)
    }
  }, [params.id, dataMode])

  useEffect(() => {
    loadContract()
  }, [loadContract])

  // Status badge styling
  const getStatusConfig = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { 
          label: 'Completed', 
          className: 'bg-gradient-to-r from-violet-500 to-violet-500 text-white border-0',
          icon: CheckCircle2
        }
      case 'processing':
        return { 
          label: 'Processing', 
          className: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0',
          icon: Loader2
        }
      case 'error':
      case 'failed':
        return { 
          label: 'Failed', 
          className: 'bg-gradient-to-r from-red-500 to-pink-500 text-white border-0',
          icon: AlertTriangle
        }
      default:
        return { 
          label: 'Unknown', 
          className: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border-0',
          icon: Clock
        }
    }
  }

  const statusConfig = getStatusConfig(contract?.status)
  const StatusIcon = statusConfig.icon

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full shadow-2xl border-0">
          <CardContent className="p-12 text-center">
            <div className="p-4 bg-red-100 dark:bg-red-950/30 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              Error Loading Contract
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-8 text-lg">
              {error}
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={loadContract} size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                <RefreshCw className="h-5 w-5 mr-2" />
                Try Again
              </Button>
              <Link href="/contracts">
                <Button variant="outline" size="lg">
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Contracts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-32 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
            <div className="h-12 flex-1 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
          </div>
          <div className="h-64 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-lg"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-40 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-lg"></div>
            <div className="h-40 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-lg"></div>
            <div className="h-40 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-lg"></div>
          </div>
          <div className="h-96 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-lg"></div>
        </div>
      </div>
    )
  }

  const overviewData = contract?.extractedData?.overview
  const financialData = contract?.extractedData?.financial
  const riskData = contract?.extractedData?.risk
  const complianceData = contract?.extractedData?.compliance

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Link href="/contracts">
              <Button variant="ghost" size="lg" className="hover:bg-white dark:bg-slate-800/80">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-slate-100 truncate">
                  {contract?.filename || 'Contract Details'}
                </h1>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm text-gray-500 dark:text-slate-400 font-mono bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                  ID: {params.id}
                </span>
                <Badge className={`${statusConfig.className} px-4 py-2 shadow-md text-sm font-semibold`}>
                  <StatusIcon className={`h-4 w-4 mr-2 ${contract?.status === 'processing' ? 'animate-spin' : ''}`} />
                  {statusConfig.label}
                </Badge>
                {contract?.processing && contract.status === 'processing' && (
                  <Badge className="bg-violet-100 text-violet-700 px-4 py-2 text-sm font-medium">
                    {contract.processing.progress}% Complete
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={loadContract} className="hover:bg-violet-50 dark:bg-violet-950/30 hover:border-violet-400">
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh
            </Button>
            <ExportMenu contractId={params.id as string} contractName={contract?.filename} />
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Contract Value */}
          {financialData?.totalValue && (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-violet-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
              <Card className="relative bg-white dark:bg-slate-800 shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">Contract Value</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                    {financialData.currency} {financialData.totalValue?.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Risk Score */}
          {riskData?.riskScore !== undefined && (
            <div className="group relative">
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${
                riskData.riskScore < 30 ? 'from-violet-500 to-violet-500' :
                riskData.riskScore < 70 ? 'from-yellow-500 to-orange-500' :
                'from-red-500 to-pink-500'
              } rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur`}></div>
              <Card className="relative bg-white dark:bg-slate-800 shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 bg-gradient-to-br ${
                      riskData.riskScore < 30 ? 'from-violet-500 to-violet-600' :
                      riskData.riskScore < 70 ? 'from-yellow-500 to-orange-600' :
                      'from-red-500 to-pink-600'
                    } rounded-xl shadow-lg`}>
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <AlertTriangle className={`h-5 w-5 ${
                      riskData.riskScore < 30 ? 'text-green-600' :
                      riskData.riskScore < 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">Risk Score</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                    {riskData.riskScore}/100
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{riskData.riskLevel} Risk</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Compliance Score */}
          {complianceData?.complianceScore !== undefined && (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
              <Card className="relative bg-white dark:bg-slate-800 shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                      <FileCheck className="h-6 w-6 text-white" />
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-violet-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">Compliance</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                    {complianceData.complianceScore}%
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{complianceData.regulations?.length || 0} regulations</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Artifacts Count */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white dark:bg-slate-800 shadow-xl border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <FileText className="h-5 w-5 text-violet-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">AI Artifacts</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                  {contract?.artifactCount || contract?.artifacts?.length || 0}
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Generated insights</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contract Overview Card */}
        {overviewData && (
          <Card className="shadow-2xl border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Contract Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overviewData.parties?.map((party: any, idx: number) => (
                  <div key={party.name || party.role || `party-${idx}`} className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                      {['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role) ? (
                        <Building className="h-5 w-5 text-violet-600" />
                      ) : (
                        <Users className="h-5 w-5 text-violet-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase">{party.role}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{party.name}</p>
                    </div>
                  </div>
                ))}
                
                {(overviewData.startDate || overviewData.contractDate) && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase">Start Date</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{overviewData.startDate || overviewData.contractDate}</p>
                    </div>
                  </div>
                )}
                
                {(overviewData.endDate || overviewData.expiryDate) && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100 dark:border-slate-700">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase">End Date</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{overviewData.endDate || overviewData.expiryDate}</p>
                    </div>
                  </div>
                )}
              </div>

              {overviewData.summary && (
                <div className="mt-6 p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Executive Summary</h3>
                  <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{overviewData.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Artifacts Viewer */}
        <Card className="shadow-2xl border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                AI-Generated Artifacts
              </h2>
              <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white px-4 py-2 shadow-md">
                <Sparkles className="h-4 w-4 mr-2" />
                {contract?.artifactCount || 0} Artifacts
              </Badge>
            </div>
            
            {contract?.extractedData && (
              <ModernArtifactViewer
                artifacts={contract.extractedData}
                contractId={params.id as string}
                initialTab={activeTab}
              />
            )}
          </CardContent>
        </Card>

        {/* Insights Section */}
        {contract?.insights && contract.insights.length > 0 && (
          <Card className="shadow-2xl border-0 bg-white dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                AI Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.insights.map((insight: any, idx: number) => (
                  <div key={insight.id || insight.title || `insight-${idx}`} className={`p-6 rounded-xl border-l-4 shadow-md ${
                    insight.color === 'green' ? 'bg-green-50 border-green-500' :
                    insight.color === 'yellow' ? 'bg-yellow-50 border-yellow-500' :
                    insight.color === 'red' ? 'bg-red-50 border-red-500' :
                    insight.color === 'blue' ? 'bg-violet-50 border-violet-500' :
                    'bg-violet-50 border-violet-500'
                  }`}>
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-2">{insight.title}</h3>
                    <p className="text-sm text-gray-700 dark:text-slate-300">{insight.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

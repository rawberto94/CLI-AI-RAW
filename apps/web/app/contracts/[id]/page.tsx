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
  Download,
  Edit,
  MoreVertical,
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
import { ContractComments } from '@/components/contracts/ContractComments'
import { ActivityFeed } from '@/components/contracts/ActivityFeed'
import { ExportMenu } from '@/components/contracts/ExportMenu'
import { ContractMetadataEditor } from '@/components/contracts/ContractMetadataEditor'
import { RiskAnalysisPanel } from '@/components/contracts/RiskAnalysisPanel'
import { WorkflowExecutionTracker } from '@/components/contracts/WorkflowExecutionTracker'
import { VersionComparison } from '@/components/contracts/VersionComparison'
import { SignatureRequest } from '@/components/contracts/SignatureRequest'
import { SignatureWorkflowTracker } from '@/components/contracts/SignatureWorkflowTracker'
import { ContractContextSidebar } from '@/components/contracts/ContractContextSidebar'
import { CommandPalette } from '@/components/contracts/CommandPalette'
import { Scale, FileWarning, Lock, Zap, GitCompare, FileSignature } from 'lucide-react'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dataMode } = useDataMode()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview')
  const [showVersionComparison, setShowVersionComparison] = useState(false)
  const [showSignatureRequest, setShowSignatureRequest] = useState(false)

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

  // Status badge styling
  const getStatusConfig = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { 
          label: 'Completed', 
          className: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0',
          icon: CheckCircle2
        }
      case 'processing':
        return { 
          label: 'Processing', 
          className: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0',
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full shadow-2xl border-0">
          <CardContent className="p-12 text-center">
            <div className="p-4 bg-red-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Error Loading Contract
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              {error}
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={loadContract} size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-12 flex-1 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="h-64 bg-white rounded-2xl animate-pulse shadow-lg"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-40 bg-white rounded-2xl animate-pulse shadow-lg"></div>
            <div className="h-40 bg-white rounded-2xl animate-pulse shadow-lg"></div>
            <div className="h-40 bg-white rounded-2xl animate-pulse shadow-lg"></div>
          </div>
          <div className="h-96 bg-white rounded-2xl animate-pulse shadow-lg"></div>
        </div>
      </div>
    )
  }

  const overviewData = contract?.extractedData?.overview
  const financialData = contract?.extractedData?.financial
  const riskData = contract?.extractedData?.risk
  const complianceData = contract?.extractedData?.compliance

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
      {/* Command Palette - Global keyboard shortcuts */}
      <CommandPalette contractId={params.id as string} />
      
      <div className="max-w-[1800px] mx-auto">
        <div className="flex gap-6">
          {/* Left: Context Sidebar */}
          <ContractContextSidebar
            contractId={params.id as string}
            contractName={contract?.filename || 'Contract'}
            status={contract?.status || 'unknown'}
            value={financialData?.totalValue}
            currency={financialData?.currency}
            riskScore={riskData?.riskScore}
            riskLevel={riskData?.riskLevel}
            effectiveDate={overviewData?.effectiveDate || overviewData?.startDate}
            expirationDate={overviewData?.expirationDate || overviewData?.expiryDate || overviewData?.endDate}
            startDate={overviewData?.startDate || overviewData?.contractDate}
            endDate={overviewData?.endDate}
            client={{
              name: overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.name || overviewData?.clientName,
              contact: overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.email,
            }}
            supplier={{
              name: overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name || overviewData?.supplierName,
              contact: overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.email,
            }}
            onExport={() => document.querySelector<HTMLButtonElement>('[data-export-button]')?.click()}
            onShare={() => console.log('Share contract')}
            onReminder={() => console.log('Set reminder')}
            onDuplicate={() => console.log('Duplicate contract')}
          />

          {/* Right: Main Content */}
          <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Link href="/contracts">
              <Button variant="ghost" size="lg" className="hover:bg-white/80">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 truncate">
                  {contract?.filename || 'Contract Details'}
                </h1>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
                  ID: {params.id}
                </span>
                <Badge className={`${statusConfig.className} px-4 py-2 shadow-md text-sm font-semibold`}>
                  <StatusIcon className={`h-4 w-4 mr-2 ${contract?.status === 'processing' ? 'animate-spin' : ''}`} />
                  {statusConfig.label}
                </Badge>
                {contract?.processing && contract.status === 'processing' && (
                  <Badge className="bg-blue-100 text-blue-700 px-4 py-2 text-sm font-medium">
                    {contract.processing.progress}% Complete
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="lg" 
              data-signature-button
              onClick={() => setShowSignatureRequest(!showSignatureRequest)}
              className="hover:bg-pink-50 hover:border-pink-400"
            >
              <FileSignature className="h-5 w-5 mr-2" />
              Request Signature
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => setShowVersionComparison(!showVersionComparison)}
              className="hover:bg-purple-50 hover:border-purple-400"
            >
              <GitCompare className="h-5 w-5 mr-2" />
              Compare Versions
            </Button>
            <Button variant="outline" size="lg" onClick={loadContract} className="hover:bg-blue-50 hover:border-blue-400">
              <RefreshCw className="h-5 w-5 mr-2" />
              Refresh
            </Button>
            <div data-export-button>
              <ExportMenu contractId={params.id as string} contractName={contract?.filename} />
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Contract Value */}
          {financialData?.totalValue && (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
              <Card className="relative bg-white shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Contract Value</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
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
                riskData.riskScore < 30 ? 'from-green-500 to-emerald-500' :
                riskData.riskScore < 70 ? 'from-yellow-500 to-orange-500' :
                'from-red-500 to-pink-500'
              } rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur`}></div>
              <Card className="relative bg-white shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-3 bg-gradient-to-br ${
                      riskData.riskScore < 30 ? 'from-green-500 to-emerald-600' :
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
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Risk Score</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {riskData.riskScore}/100
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{riskData.riskLevel} Risk</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Compliance Score */}
          {complianceData?.complianceScore !== undefined && (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
              <Card className="relative bg-white shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                      <FileCheck className="h-6 w-6 text-white" />
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Compliance</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {complianceData.complianceScore}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{complianceData.regulations?.length || 0} regulations</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Artifacts Count */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white shadow-xl border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">AI Artifacts</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {contract?.artifactCount || contract?.artifacts?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">Generated insights</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Enhanced Metadata Editor with Confidence Scores */}
        <div className="rounded-2xl overflow-hidden">
          <ContractMetadataEditor
            contractId={params.id as string}
            initialData={{
              contractTitle: { value: overviewData?.title, confidence: overviewData?.titleConfidence },
              description: { value: overviewData?.summary, confidence: overviewData?.summaryConfidence },
              clientName: { value: overviewData?.parties?.find((p: any) => p.role === 'Client' || p.role === 'Buyer')?.name, confidence: 0.85 },
              supplierName: { value: overviewData?.parties?.find((p: any) => p.role === 'Supplier' || p.role === 'Vendor')?.name, confidence: 0.85 },
              contractType: { value: overviewData?.type || overviewData?.contractType, confidence: 0.90 },
              category: { value: overviewData?.category, confidence: 0.75 },
              totalValue: { value: financialData?.totalValue, confidence: financialData?.totalValueConfidence },
              currency: { value: financialData?.currency, confidence: 0.95 },
              effectiveDate: { value: overviewData?.effectiveDate, confidence: 0.88 },
              startDate: { value: overviewData?.startDate || overviewData?.contractDate, confidence: 0.88 },
              endDate: { value: overviewData?.endDate, confidence: 0.85 },
              expirationDate: { value: overviewData?.expiryDate, confidence: 0.85 },
              jurisdiction: { value: overviewData?.jurisdiction, confidence: 0.65 },
              status: { value: contract?.status?.toUpperCase(), confidence: 1.0 },
              tags: { value: overviewData?.tags || [], confidence: 0.70 },
              keywords: { value: overviewData?.keywords || [], confidence: 0.70 },
            }}
            onUpdate={async (updatedData) => {
              console.log('Metadata updated:', updatedData)
              // Reload contract to show updated data
              await loadContract()
            }}
          />
        </div>

        {/* Risk Analysis Panel */}
        {(riskData || complianceData) && (
          <RiskAnalysisPanel
            contractId={params.id as string}
            overallRiskScore={riskData?.riskScore || 0}
            riskLevel={riskData?.riskLevel || 'UNKNOWN'}
            categories={riskData?.categories || [
              {
                id: 'liability',
                name: 'Liability & Indemnification',
                score: riskData?.liabilityScore || 0,
                level: (riskData?.liabilityScore || 0) >= 70 ? 'high' : (riskData?.liabilityScore || 0) >= 40 ? 'medium' : 'low',
                issues: riskData?.liabilityIssues || [],
                description: 'Risk associated with liability clauses and indemnification terms',
                icon: Scale
              },
              {
                id: 'termination',
                name: 'Termination & Renewal',
                score: riskData?.terminationScore || 0,
                level: (riskData?.terminationScore || 0) >= 70 ? 'high' : (riskData?.terminationScore || 0) >= 40 ? 'medium' : 'low',
                issues: riskData?.terminationIssues || [],
                description: 'Risk related to termination clauses and renewal terms',
                icon: FileWarning
              },
              {
                id: 'payment',
                name: 'Payment & Financial Terms',
                score: riskData?.paymentScore || 0,
                level: (riskData?.paymentScore || 0) >= 70 ? 'high' : (riskData?.paymentScore || 0) >= 40 ? 'medium' : 'low',
                issues: riskData?.paymentIssues || [],
                description: 'Financial risks and payment obligation concerns',
                icon: DollarSign
              },
              {
                id: 'confidentiality',
                name: 'Confidentiality & IP',
                score: riskData?.confidentialityScore || 0,
                level: (riskData?.confidentialityScore || 0) >= 70 ? 'high' : (riskData?.confidentialityScore || 0) >= 40 ? 'medium' : 'low',
                issues: riskData?.confidentialityIssues || [],
                description: 'Risk related to confidentiality and intellectual property',
                icon: Lock
              },
              {
                id: 'compliance',
                name: 'Compliance & Regulatory',
                score: complianceData?.complianceScore || 0,
                level: (complianceData?.complianceScore || 0) < 70 ? 'high' : (complianceData?.complianceScore || 0) < 90 ? 'medium' : 'low',
                issues: complianceData?.complianceIssues || [],
                description: 'Compliance with regulatory requirements and standards',
                icon: Shield
              }
            ]}
          />
        )}

        {/* Workflow Execution Tracker */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Active Workflows
          </h2>
          <WorkflowExecutionTracker
            contractId={params.id as string}
            onApprove={async (stepId, comment) => {
              console.log('Approving step:', stepId, comment)
              // TODO: Implement approval API call
              await loadContract()
            }}
            onReject={async (stepId, comment) => {
              console.log('Rejecting step:', stepId, comment)
              // TODO: Implement rejection API call
              await loadContract()
            }}
          />
        </div>

        {/* E-Signature Workflow Tracker */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent flex items-center gap-3">
            <FileSignature className="h-7 w-7 text-blue-600" />
            E-Signature Status
          </h2>
          <SignatureWorkflowTracker
            contractId={params.id as string}
            onRequestNew={() => setShowSignatureRequest(true)}
          />
        </div>

        {/* Contract Overview Card */}
        {overviewData && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Contract Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {overviewData.parties?.map((party: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {party.role === 'Client' || party.role === 'Buyer' ? (
                        <Building className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Users className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase">{party.role}</p>
                      <p className="text-sm font-bold text-gray-900">{party.name}</p>
                    </div>
                  </div>
                ))}
                
                {(overviewData.startDate || overviewData.contractDate) && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase">Start Date</p>
                      <p className="text-sm font-bold text-gray-900">{overviewData.startDate || overviewData.contractDate}</p>
                    </div>
                  </div>
                )}
                
                {(overviewData.endDate || overviewData.expiryDate) && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase">End Date</p>
                      <p className="text-sm font-bold text-gray-900">{overviewData.endDate || overviewData.expiryDate}</p>
                    </div>
                  </div>
                )}
              </div>

              {overviewData.summary && (
                <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h3>
                  <p className="text-gray-700 leading-relaxed">{overviewData.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Artifacts Viewer */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                AI-Generated Artifacts
              </h2>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 shadow-md">
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
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                AI Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.insights.map((insight: any, idx: number) => (
                  <div key={idx} className={`p-6 rounded-xl border-l-4 shadow-md ${
                    insight.color === 'green' ? 'bg-green-50 border-green-500' :
                    insight.color === 'yellow' ? 'bg-yellow-50 border-yellow-500' :
                    insight.color === 'red' ? 'bg-red-50 border-red-500' :
                    insight.color === 'blue' ? 'bg-blue-50 border-blue-500' :
                    'bg-purple-50 border-purple-500'
                  }`}>
                    <h3 className="font-bold text-gray-900 mb-2">{insight.title}</h3>
                    <p className="text-sm text-gray-700">{insight.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* E-Signature Request Section */}
        {showSignatureRequest && (
          <SignatureRequest 
            contractId={params.id as string}
            contractName={contract?.filename || 'Contract'}
            onClose={() => setShowSignatureRequest(false)}
          />
        )}

        {/* Version Comparison Section */}
        {showVersionComparison && (
          <VersionComparison 
            contractId={params.id as string}
            onClose={() => setShowVersionComparison(false)}
          />
        )}

        {/* Collaboration Tools Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContractComments contractId={params.id as string} />
          <ActivityFeed contractId={params.id as string} />
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}

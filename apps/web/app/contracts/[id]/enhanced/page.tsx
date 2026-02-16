'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  Shield,
  DollarSign,
  Award,
  Zap,
  Download,
  Share,
  Edit,
  RefreshCw,
  Users,
  Calendar as _Calendar,
  TrendingUp,
  Target,
  Eye,
  BarChart3,
  CheckCircle as _CheckCircle,
  Clock as _Clock,
  Loader2,
  Star,
  Brain,
  Network as _Network,
  Activity,
  PieChart as _PieChart,
  Tag as _Tag,
  Settings as _Settings
} from 'lucide-react'
import { ContractMetadataEditor as _ContractMetadataEditor } from '@/components/contracts/ContractMetadataEditor'
import Link from 'next/link'

// Unwrap potentially wrapped AI values
function unwrapValue<T>(val: T | { value: T; source?: string } | undefined): T | undefined {
  if (val && typeof val === 'object' && 'value' in val) {
    return (val as { value: T }).value;
  }
  return val as T;
}

function unwrapString(val: string | { value: string; source?: string } | undefined): string {
  const unwrapped = unwrapValue(val);
  return typeof unwrapped === 'string' ? unwrapped : '';
}

interface EnhancedContractData {
  id: string
  filename: string
  uploadDate: string
  status: string
  fileSize: number
  totalValue?: number
  currency?: string
  supplierName?: string
  clientName?: string
  
  // Intelligence data
  intelligence?: {
    patterns: number
    insights: number
    riskScore: number
    opportunityScore: number
    flags: string[]
    recommendations: Array<{
      type: string
      priority: string
      title: string
      description: string
      action: string
    }>
  }
  
  // Processing info
  processing?: {
    progress: number
    currentStage: string
    startTime: string
    completedAt?: string
  }
  
  // Analysis results
  metadata?: any
  financial?: any
  risk?: any
  compliance?: any
  clauses?: any
  
  // Summary stats
  summary?: {
    totalClauses: number
    riskFactors: number
    complianceIssues: number
    financialTerms: number
    keyParties: number
  }
  
  // AI insights
  insights?: Array<{
    type: string
    title: string
    description: string
    confidence: number
    impact: string
  }>
}

export default function EnhancedContractDetailPage() {
  const params = useParams()
  const _router = useRouter()
  const contractId = params.id as string

  const [contract, setContract] = useState<EnhancedContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (contractId) {
      loadContract()
    }
    
  }, [contractId])

  // Auto-refresh for processing contracts
  useEffect(() => {
    if (contract?.status === 'PROCESSING') {
      const interval = setInterval(loadContract, 3000)
      return () => clearInterval(interval)
    }
    
  }, [contract?.status])

  const loadContract = async () => {
    try {
      setError(null)
      const response = await fetch(`/api/contracts/${contractId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load contract: ${response.status}`)
      }

      const raw = await response.json()
      const data = raw.data ?? raw
      setContract(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract?.filename}_analysis.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      // Error handled silently
    }
  }

  const _formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200'
      case 'PROCESSING': return 'bg-violet-100 text-violet-800 border-violet-200'
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const _getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-violet-600'
    return 'text-green-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4"></div>
            <Brain className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Contract Analysis
          </h3>
          <p className="text-gray-600">Gathering intelligence and insights...</p>
        </div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-50 flex items-center justify-center">
        <Card className="max-w-md shadow-xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Contract
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={loadContract} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Link href="/contracts">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Contracts
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
              <Link href="/contracts" className="hover:text-gray-700 flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                Contracts
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{contract.filename}</span>
            </nav>
            
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {contract.filename}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <Badge className={getStatusColor(contract.status)}>
                    {contract.status}
                  </Badge>
                  <span className="text-gray-600">
                    {new Date(contract.uploadDate).toLocaleDateString()}
                  </span>
                  <span className="text-gray-600">
                    {formatFileSize(contract.fileSize)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Processing Status */}
        {contract.status === 'PROCESSING' && contract.processing && (
          <Card className="shadow-xl border-0 border-l-4 border-l-violet-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                    <Activity className="w-4 h-4 text-violet-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      AI Analysis in Progress
                    </h3>
                    <p className="text-gray-600">
                      {contract.processing.currentStage.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-violet-600">
                    {contract.processing.progress}%
                  </div>
                  <div className="text-sm text-gray-600">Complete</div>
                </div>
              </div>
              <Progress value={contract.processing.progress} className="h-3 mb-2" />
              <p className="text-sm text-gray-600">
                Started {new Date(contract.processing.startTime).toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Intelligence Overview */}
        {contract.intelligence && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-red-100">
              <CardContent className="p-6 text-center">
                <Shield className="w-8 h-8 text-red-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-red-900 mb-1">
                  {contract.intelligence.riskScore}
                </div>
                <div className="text-sm text-red-700">Risk Score</div>
                <div className="text-xs text-red-600 mt-1">
                  {contract.intelligence.riskScore >= 80 ? 'Critical' :
                   contract.intelligence.riskScore >= 60 ? 'High' :
                   contract.intelligence.riskScore >= 40 ? 'Medium' : 'Low'} Risk
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-violet-50 to-purple-100">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-green-900 mb-1">
                  {contract.intelligence.opportunityScore}
                </div>
                <div className="text-sm text-green-700">Opportunity Score</div>
                <div className="text-xs text-green-600 mt-1">
                  Cost optimization potential
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-violet-50 to-purple-100">
              <CardContent className="p-6 text-center">
                <Target className="w-8 h-8 text-violet-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-violet-900 mb-1">
                  {contract.intelligence.patterns}
                </div>
                <div className="text-sm text-violet-700">Patterns Detected</div>
                <div className="text-xs text-violet-600 mt-1">
                  AI-identified patterns
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-violet-50 to-purple-100">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-violet-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-violet-900 mb-1">
                  {contract.intelligence.insights}
                </div>
                <div className="text-sm text-violet-700">Insights Generated</div>
                <div className="text-xs text-violet-600 mt-1">
                  Actionable recommendations
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Smart Recommendations */}
        {contract.intelligence?.recommendations && contract.intelligence.recommendations.length > 0 && (
          <Card className="shadow-xl border-0 border-l-4 border-l-amber-500">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-600" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.intelligence.recommendations.map((rec, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        rec.priority === 'high' ? 'bg-red-100' :
                        rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-violet-100'
                      }`}>
                        {rec.type === 'risk' ? <Shield className="w-5 h-5 text-red-600" /> :
                         rec.type === 'cost' ? <DollarSign className="w-5 h-5 text-green-600" /> :
                         <Target className="w-5 h-5 text-violet-600" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{rec.title}</h4>
                        <p className="text-gray-600 text-sm mb-2">{rec.description}</p>
                        <Button variant="outline" size="sm">
                          {rec.action}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        {contract.status === 'COMPLETED' && (
          <Card className="shadow-xl border-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="bg-gradient-to-r from-white to-gray-50 border-b">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="financial" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Financial
                  </TabsTrigger>
                  <TabsTrigger value="risk" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Risk
                  </TabsTrigger>
                  <TabsTrigger value="compliance" className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Compliance
                  </TabsTrigger>
                  <TabsTrigger value="clauses" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Clauses
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-6">
                <TabsContent value="overview" className="space-y-6">
                  {/* Contract Summary Stats */}
                  {contract.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-violet-50 rounded-lg">
                        <FileText className="w-6 h-6 text-violet-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-violet-900">{contract.summary.totalClauses}</div>
                        <div className="text-sm text-violet-700">Clauses</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <Shield className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-red-900">{contract.summary.riskFactors}</div>
                        <div className="text-sm text-red-700">Risk Factors</div>
                      </div>
                      <div className="text-center p-4 bg-violet-50 rounded-lg">
                        <Award className="w-6 h-6 text-violet-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-violet-900">{contract.summary.complianceIssues}</div>
                        <div className="text-sm text-violet-700">Compliance Issues</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-900">{contract.summary.financialTerms}</div>
                        <div className="text-sm text-green-700">Financial Terms</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <Users className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-orange-900">{contract.summary.keyParties}</div>
                        <div className="text-sm text-orange-700">Key Parties</div>
                      </div>
                    </div>
                  )}

                  {/* Contract Metadata */}
                  {contract.metadata && (
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {unwrapValue(contract.metadata.summary) && (
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Summary</h4>
                            <p className="text-gray-900">{unwrapString(contract.metadata.summary)}</p>
                          </div>
                        )}
                        
                        {unwrapValue(contract.metadata.contractType) && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Contract Type</h4>
                            <p className="text-gray-900 font-medium">{unwrapString(contract.metadata.contractType)}</p>
                          </div>
                        )}

                        {unwrapValue(contract.metadata.parties) && (unwrapValue(contract.metadata.parties) as any[]).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Contracting Parties</h4>
                            <div className="space-y-1">
                              {(unwrapValue(contract.metadata.parties) as any[]).map((party: any, idx: number) => {
                                const partyName = typeof party === 'string' ? party : unwrapString(party?.name) || party;
                                return (
                                  <div key={`party-${partyName}-${idx}`} className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-violet-500" />
                                    <span className="text-gray-900">{partyName}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {unwrapValue(contract.metadata.effectiveDate) && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Effective Date</h4>
                            <p className="text-gray-900">
                              {new Date(unwrapValue(contract.metadata.effectiveDate) as string).toLocaleDateString()}
                            </p>
                          </div>
                        )}

                        {unwrapValue(contract.metadata.expirationDate) && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-600 mb-2">Expiration Date</h4>
                            <p className="text-gray-900">
                              {new Date(unwrapValue(contract.metadata.expirationDate) as string).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Other tab contents would go here */}
                <TabsContent value="financial">
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Financial Analysis</h3>
                    <p className="text-gray-500">Detailed financial analysis will be displayed here</p>
                  </div>
                </TabsContent>

                <TabsContent value="risk">
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Risk Analysis</h3>
                    <p className="text-gray-500">Risk assessment and mitigation strategies will be displayed here</p>
                  </div>
                </TabsContent>

                <TabsContent value="compliance">
                  <div className="text-center py-12">
                    <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Compliance Analysis</h3>
                    <p className="text-gray-500">Compliance requirements and gaps will be displayed here</p>
                  </div>
                </TabsContent>

                <TabsContent value="clauses">
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Contract Clauses</h3>
                    <p className="text-gray-500">Extracted and analyzed clauses will be displayed here</p>
                  </div>
                </TabsContent>

                <TabsContent value="analytics">
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Advanced Analytics</h3>
                    <p className="text-gray-500">Performance metrics and insights will be displayed here</p>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        )}
      </div>
    </div>
  )
}
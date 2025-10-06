'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  DollarSign,
  Award,
  Zap,
  Download,
  Share,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  BarChart3,
  Users,
  Calendar,
  Building
} from 'lucide-react'
import Link from 'next/link'

interface ContractData {
  id: string
  filename: string
  uploadDate: string
  status: 'processing' | 'completed' | 'error'
  tenantId: string
  uploadedBy: string
  clientId?: string
  supplierId?: string
  fileSize: number
  mimeType: string
  processing: {
    jobId: string
    status: string
    currentStage: string
    progress: number
    startTime: string
    completedAt?: string
  }
  extractedData: any
  financial?: {
    totalValue?: number
    currency?: string
    paymentTerms?: string
    rateCards?: Array<{
      title?: string
      rates?: Array<{
        role: string
        level: string
        hourlyRate: number
        dailyRate: number
        marketBenchmark: number
        variance: string
      }>
      insights?: {
        totalAnnualSavings: string
        averageVariance: string
        recommendation: string
      }
    }>
    extractedTables?: Array<{
      title: string
      rows: Array<Record<string, any>>
    }>
  }
  summary: {
    totalClauses: number
    riskFactors: number
    complianceIssues: number
    financialTerms: number
    keyParties: number
  }
  insights: Array<{
    type: string
    title: string
    description: string
    icon: string
    color: string
  }>
  processingDuration: number
}

export default function ContractDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (contractId) {
      loadContract()
      
      // Set up polling for processing status if still processing
      const interval = setInterval(() => {
        if (contract?.status === 'processing') {
          loadContract()
        }
      }, 2000)
      
      return () => clearInterval(interval)
    }
  }, [contractId, contract?.status])

  const loadContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) {
        throw new Error('Failed to load contract')
      }
      const data = await response.json()
      setContract(data)
      setError(null)
    } catch (err) {
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
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export file')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Loading contract details...</h3>
        </div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Contract</h3>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/contracts" className="hover:text-gray-700 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Contracts
            </Link>
            <span>/</span>
            <span className="text-gray-900">{contract.filename}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            {contract.filename}
          </h1>
        </div>
        
        {/* Export Actions */}
        {contract.status === 'completed' && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('summary')}>
              <Download className="w-4 h-4 mr-2" />
              Export Summary
            </Button>
          </div>
        )}
      </div>
      
      <div>
        <div>
          <div className="flex items-center gap-4 mt-2">
            <Badge className={
              contract.status === 'completed' ? 'bg-green-100 text-green-800' :
              contract.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }>
              {contract.status === 'processing' ? 'Processing' : 
               contract.status === 'completed' ? 'Completed' : 'Error'}
            </Badge>
            <span className="text-gray-600">
              Uploaded {new Date(contract.uploadDate).toLocaleDateString()}
            </span>
            <span className="text-gray-600">
              {(contract.fileSize / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Processing Status */}
      {contract.status === 'processing' && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Processing Contract</h3>
                  <p className="text-gray-600">Current stage: {contract.processing.currentStage.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{contract.processing.progress}%</div>
                <div className="text-sm text-gray-600">Complete</div>
              </div>
            </div>
            <Progress value={contract.processing.progress} className="h-3" />
            <p className="text-sm text-gray-600 mt-2">
              Started {new Date(contract.processing.startTime).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contract completed - show results */}
      {contract.status === 'completed' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{contract.summary.totalClauses}</div>
                <div className="text-sm text-gray-600">Clauses</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Shield className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{contract.summary.riskFactors}</div>
                <div className="text-sm text-gray-600">Risk Factors</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{contract.summary.complianceIssues}</div>
                <div className="text-sm text-gray-600">Compliance Issues</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{contract.summary.financialTerms}</div>
                <div className="text-sm text-gray-600">Financial Terms</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{contract.summary.keyParties}</div>
                <div className="text-sm text-gray-600">Key Parties</div>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contract.insights.map((insight, index) => (
                  <div key={index} className={`p-4 rounded-lg border-2 ${
                    insight.color === 'green' ? 'border-green-200 bg-green-50' :
                    insight.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                    insight.color === 'red' ? 'border-red-200 bg-red-50' :
                    insight.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                    'border-purple-200 bg-purple-50'
                  }`}>
                    <h4 className="font-semibold text-gray-900 mb-2">{insight.title}</h4>
                    <p className="text-gray-700 text-sm">{insight.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis - Financial Data, Rate Cards, Tables */}
          {contract.extractedData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  Financial Analysis & Rate Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Financial Terms */}
                {contract.financial && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Financial Terms</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {contract.financial.totalValue && (
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">Total Value</div>
                          <div className="text-xl font-bold text-green-700">
                            ${contract.financial.totalValue.toLocaleString()} {contract.financial.currency}
                          </div>
                        </div>
                      )}
                      {contract.financial.paymentTerms && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">Payment Terms</div>
                          <div className="text-xl font-bold text-blue-700">{contract.financial.paymentTerms}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rate Cards */}
                {contract.financial?.rateCards && contract.financial.rateCards.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Rate Cards</h3>
                    {contract.financial.rateCards.map((rateCard: any, idx: number) => (
                      <div key={idx} className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3">{rateCard.title || 'Rate Card'}</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hourly Rate</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Daily Rate</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Market Benchmark</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {rateCard.rates?.map((rate: any, rateIdx: number) => (
                                <tr key={rateIdx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rate.role}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{rate.level}</td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">${rate.hourlyRate}</td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900">${rate.dailyRate}</td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-600">${rate.marketBenchmark}</td>
                                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                                    rate.variance?.startsWith('+') ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {rate.variance}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {rateCard.insights && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                            <h5 className="font-medium text-blue-900 mb-2">Insights</h5>
                            <div className="text-sm text-blue-800 space-y-1">
                              <div>Total Annual Savings: <span className="font-bold">{rateCard.insights.totalAnnualSavings}</span></div>
                              <div>Average Variance: <span className="font-bold">{rateCard.insights.averageVariance}</span></div>
                              <div>Recommendation: {rateCard.insights.recommendation}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Extracted Tables */}
                {contract.financial?.extractedTables && contract.financial.extractedTables.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Extracted Tables</h3>
                    {contract.financial.extractedTables.map((table: any, idx: number) => (
                      <div key={idx} className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3">{table.title}</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(table.rows[0] || {}).map((header) => (
                                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {table.rows.map((row: any, rowIdx: number) => (
                                <tr key={rowIdx} className="hover:bg-gray-50">
                                  {Object.values(row).map((cell: any, cellIdx: number) => (
                                    <td key={cellIdx} className="px-4 py-3 text-sm text-gray-900">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw Extracted Data (for debugging) */}
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium">
                    View Raw Extracted Data (JSON)
                  </summary>
                  <pre className="mt-4 p-4 bg-gray-50 rounded-lg overflow-auto text-xs">
                    {JSON.stringify(contract.extractedData, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
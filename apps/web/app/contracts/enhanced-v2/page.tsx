'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  FileText,
  Upload,
  Search,
  Filter,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  Users,
  RefreshCw,
  BarChart3,
  Zap,
  Target,
  Eye,
  Download,
  Settings,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Star,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'
import Link from 'next/link'

interface EnhancedContract {
  id: string
  filename: string
  originalName?: string
  status: string
  uploadedAt: string
  fileSize: number
  totalValue?: number
  currency?: string
  supplierName?: string
  clientName?: string
  category?: string
  intelligence?: {
    patterns: number
    insights: number
    riskScore: number
    opportunityScore: number
    flags: string[]
  }
}

interface ContractsData {
  contracts: EnhancedContract[]
  pagination: {
    total: number
    page: number
    totalPages: number
    hasMore: boolean
  }
  intelligence?: {
    totalPatterns: number
    totalInsights: number
    criticalIssues: number
    opportunities: number
  }
  analytics?: {
    portfolio: {
      totalContracts: number
      totalValue: number
      averageValue: number
      completionRate: number
    }
    suppliers: {
      total: number
      concentration: number
    }
    trends: {
      processingEfficiency: number
      recentActivity: number
    }
  }
  recommendations?: Array<{
    type: string
    priority: string
    title: string
    description: string
    action: string
  }>
}

export default function EnhancedContractsPage() {
  const [data, setData] = useState<ContractsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('uploadedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        includeIntelligence: 'true',
        includeAnalytics: 'true',
        includeRecommendations: 'true',
        sortBy,
        sortOrder,
      })

      if (searchTerm) params.set('search', searchTerm)

      const response = await fetch(`/api/contracts/enhanced?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to load contracts')
      }
    } catch (err) {
      console.error('Error fetching contracts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }  
// Filter contracts based on search and filters
  const filteredContracts = useMemo(() => {
    if (!data?.contracts) return []
    
    let filtered = data.contracts

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(contract =>
        contract.filename.toLowerCase().includes(term) ||
        contract.supplierName?.toLowerCase().includes(term) ||
        contract.clientName?.toLowerCase().includes(term) ||
        contract.category?.toLowerCase().includes(term)
      )
    }

    // Status filters
    if (selectedFilters.length > 0) {
      filtered = filtered.filter(contract => {
        if (selectedFilters.includes('high-risk') && contract.intelligence?.riskScore > 70) return true
        if (selectedFilters.includes('opportunities') && contract.intelligence?.opportunityScore > 50) return true
        if (selectedFilters.includes('critical') && contract.intelligence?.flags.includes('critical-risk')) return true
        if (selectedFilters.includes(contract.status)) return true
        return false
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (sortBy) {
        case 'uploadedAt':
          aVal = new Date(a.uploadedAt).getTime()
          bVal = new Date(b.uploadedAt).getTime()
          break
        case 'totalValue':
          aVal = a.totalValue || 0
          bVal = b.totalValue || 0
          break
        case 'riskScore':
          aVal = a.intelligence?.riskScore || 0
          bVal = b.intelligence?.riskScore || 0
          break
        case 'filename':
          aVal = a.filename.toLowerCase()
          bVal = b.filename.toLowerCase()
          break
        default:
          aVal = a.uploadedAt
          bVal = b.uploadedAt
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return filtered
  }, [data?.contracts, searchTerm, selectedFilters, sortBy, sortOrder])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchContracts()
  }

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'FAILED':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getRiskBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800 border-red-200'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (score >= 40) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <Zap className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Intelligence Dashboard
          </h3>
          <p className="text-gray-600">Analyzing contracts and generating insights...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Card className="max-w-md shadow-xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Dashboard
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={fetchContracts} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Link href="/contracts/upload">
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Contract
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Contract Intelligence
              </h1>
              <p className="text-gray-600 text-lg mt-1">
                AI-powered contract analysis and insights
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="shadow-sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Link href="/contracts/upload">
              <Button className="shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Upload className="w-4 h-4 mr-2" />
                Upload Contract
              </Button>
            </Link>
          </div>
        </div>

        {/* Intelligence Overview Cards */}
        {data?.intelligence && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total Patterns</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {data.intelligence.totalPatterns}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Detected by AI</p>
                  </div>
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-700">Insights Generated</p>
                    <p className="text-3xl font-bold text-green-900">
                      {data.intelligence.totalInsights}
                    </p>
                    <p className="text-xs text-green-600 mt-1">Actionable recommendations</p>
                  </div>
                  <Zap className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-red-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700">Critical Issues</p>
                    <p className="text-3xl font-bold text-red-900">
                      {data.intelligence.criticalIssues}
                    </p>
                    <p className="text-xs text-red-600 mt-1">Require attention</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Opportunities</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {data.intelligence.opportunities}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">Cost optimization</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio Analytics */}
        {data?.analytics && (
          <Card className="shadow-xl border-0">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Portfolio Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(data.analytics.portfolio.totalValue)}
                  </div>
                  <div className="text-sm text-gray-600">Total Portfolio Value</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {formatCurrency(data.analytics.portfolio.averageValue)}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {Math.round(data.analytics.portfolio.completionRate * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Completion Rate</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Processing efficiency
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {data.analytics.suppliers.total}
                  </div>
                  <div className="text-sm text-gray-600">Active Suppliers</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(data.analytics.suppliers.concentration * 100)}% concentration
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smart Recommendations */}
        {data?.recommendations && data.recommendations.length > 0 && (
          <Card className="shadow-xl border-0 border-l-4 border-l-amber-500">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Star className="w-6 h-6 text-amber-600" />
                Smart Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {data.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className={`p-2 rounded-lg ${
                      rec.priority === 'high' ? 'bg-red-100' :
                      rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}>
                      {rec.type === 'urgent' ? <AlertTriangle className="w-5 h-5 text-red-600" /> :
                       rec.type === 'review' ? <Eye className="w-5 h-5 text-yellow-600" /> :
                       <Target className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{rec.description}</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        {rec.action}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search contracts, suppliers, clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>
              
              <div className="flex items-center gap-2">
                {/* Quick Filters */}
                <Button
                  variant={selectedFilters.includes('high-risk') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('high-risk')}
                >
                  <Shield className="w-4 h-4 mr-1" />
                  High Risk
                </Button>
                <Button
                  variant={selectedFilters.includes('opportunities') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('opportunities')}
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Opportunities
                </Button>
                <Button
                  variant={selectedFilters.includes('FAILED') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('FAILED')}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Failed
                </Button>
              </div>

              {/* View Controls */}
              <div className="flex items-center gap-2 border-l pl-4">
                <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8"
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-8"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-')
                    setSortBy(field)
                    setSortOrder(order as 'asc' | 'desc')
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="uploadedAt-desc">Newest First</option>
                  <option value="uploadedAt-asc">Oldest First</option>
                  <option value="totalValue-desc">Highest Value</option>
                  <option value="totalValue-asc">Lowest Value</option>
                  <option value="riskScore-desc">Highest Risk</option>
                  <option value="riskScore-asc">Lowest Risk</option>
                  <option value="filename-asc">Name A-Z</option>
                  <option value="filename-desc">Name Z-A</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>   
     {/* Contracts Display */}
        <Card className="shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-white to-gray-50 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                {filteredContracts.length === data?.contracts.length
                  ? `All Contracts (${filteredContracts.length})`
                  : `Filtered Contracts (${filteredContracts.length}/${data?.contracts.length})`}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {data?.pagination.total} total
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {filteredContracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No contracts found
                </h3>
                <p className="text-gray-500 mb-6">
                  {data?.contracts.length === 0 
                    ? "Upload your first contract to get started with AI-powered analysis"
                    : "Try adjusting your search or filter criteria"
                  }
                </p>
                <Link href="/contracts/upload">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Contract
                  </Button>
                </Link>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredContracts.map((contract) => (
                  <EnhancedContractCard key={contract.id} contract={contract} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredContracts.map((contract) => (
                  <EnhancedContractListItem key={contract.id} contract={contract} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Enhanced Contract Card Component
interface ContractCardProps {
  contract: EnhancedContract
}

function EnhancedContractCard({ contract }: ContractCardProps) {
  const formatCurrency = (amount: number, currency = 'USD') => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'FAILED':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getRiskBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-red-100 text-red-800 border-red-200'
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (score >= 40) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  return (
    <div className="group relative bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Intelligence Indicators */}
      {contract.intelligence && (
        <div className="absolute top-4 right-4 flex gap-1">
          {contract.intelligence.flags.includes('critical-risk') && (
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" title="Critical Risk" />
          )}
          {contract.intelligence.flags.includes('cost-opportunity') && (
            <div className="w-3 h-3 bg-green-500 rounded-full" title="Cost Opportunity" />
          )}
          {contract.intelligence.patterns > 0 && (
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Patterns Detected" />
          )}
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {getStatusIcon(contract.status)}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {contract.filename}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(contract.uploadedAt).toLocaleDateString()} • {formatFileSize(contract.fileSize)}
            </p>
          </div>
        </div>

        {/* Intelligence Scores */}
        {contract.intelligence && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">
                {contract.intelligence.riskScore}
              </div>
              <div className="text-xs text-gray-600">Risk Score</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-900">
                {contract.intelligence.opportunityScore}
              </div>
              <div className="text-xs text-gray-600">Opportunity</div>
            </div>
          </div>
        )}

        {/* Contract Details */}
        <div className="space-y-2 mb-4">
          {contract.supplierName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span className="truncate">{contract.supplierName}</span>
            </div>
          )}
          
          {contract.totalValue && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DollarSign className="w-4 h-4" />
              <span>{formatCurrency(contract.totalValue, contract.currency)}</span>
            </div>
          )}

          {contract.category && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span className="truncate">{contract.category}</span>
            </div>
          )}
        </div>

        {/* Intelligence Badges */}
        {contract.intelligence && contract.intelligence.flags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {contract.intelligence.flags.map((flag, index) => (
              <Badge
                key={index}
                variant="outline"
                className={`text-xs ${
                  flag.includes('risk') ? 'border-red-200 text-red-700' :
                  flag.includes('opportunity') ? 'border-green-200 text-green-700' :
                  'border-blue-200 text-blue-700'
                }`}
              >
                {flag.replace('-', ' ')}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/contracts/${contract.id}`} className="flex-1">
            <Button size="sm" className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
          </Link>
          {contract.status === 'COMPLETED' && (
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Enhanced Contract List Item Component
function EnhancedContractListItem({ contract }: ContractCardProps) {
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'FAILED':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
      {/* Status */}
      <div className="flex-shrink-0">
        {getStatusIcon(contract.status)}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 truncate">
            {contract.filename}
          </h3>
          {contract.intelligence?.flags.includes('critical-risk') && (
            <Badge className="bg-red-100 text-red-800 text-xs">Critical</Badge>
          )}
          {contract.intelligence?.flags.includes('cost-opportunity') && (
            <Badge className="bg-green-100 text-green-800 text-xs">Opportunity</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
          <span>{new Date(contract.uploadedAt).toLocaleDateString()}</span>
          {contract.supplierName && <span>{contract.supplierName}</span>}
          {contract.category && <span>{contract.category}</span>}
        </div>
      </div>

      {/* Intelligence Scores */}
      {contract.intelligence && (
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium text-gray-900">{contract.intelligence.riskScore}</div>
            <div className="text-xs text-gray-500">Risk</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-gray-900">{contract.intelligence.opportunityScore}</div>
            <div className="text-xs text-gray-500">Opportunity</div>
          </div>
        </div>
      )}

      {/* Value */}
      {contract.totalValue && (
        <div className="text-right">
          <div className="font-medium text-gray-900">
            {formatCurrency(contract.totalValue, contract.currency)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href={`/contracts/${contract.id}`}>
          <Button size="sm" variant="outline">
            <Eye className="w-4 h-4" />
          </Button>
        </Link>
        {contract.status === 'COMPLETED' && (
          <Button size="sm" variant="outline">
            <Download className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
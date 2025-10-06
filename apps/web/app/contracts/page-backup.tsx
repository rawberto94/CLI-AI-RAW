'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Upload,
  Eye,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  Users,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react'
import Link from 'next/link'
import {
  getStatusDisplay,
  formatFileSize,
  formatCurrency,
  formatDateTime,
  getContractSummary,
  type Contract,
} from '@/lib/contracts/contracts-data-service'
import {
  ContractFiltersPanel,
  type FilterOptions,
} from '@/components/contracts/ContractFiltersPanel'
import {
  filterContracts,
  sortContracts,
  getDefaultFilters,
  extractPartiesFromContracts,
  type SortOption,
} from '@/lib/contracts/filter-utils'

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterOptions>(getDefaultFilters())
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [showFilters, setShowFilters] = useState(false)

  // Extract unique clients and suppliers
  const { clients: availableClients, suppliers: availableSuppliers } = useMemo(() => {
    return extractPartiesFromContracts(contracts)
  }, [contracts])

  // Filtered and sorted contracts
  const filteredContracts = useMemo(() => {
    const filtered = filterContracts(contracts, filters)
    return sortContracts(filtered, sortBy)
  }, [contracts, filters, sortBy])

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/contracts/list')

      if (!response.ok) {
        throw new Error(
          `Failed to fetch contracts: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      if (data.success) {
        setContracts(data.contracts || [])
      } else {
        throw new Error(data.error || 'Failed to load contracts')
      }
    } catch (err) {
      console.error('Error fetching contracts:', err)
      setError(err instanceof Error ? err.message : 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilters = () => {
    setFilters(getDefaultFilters())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900">
            Loading contracts...
          </h3>
          <p className="text-gray-600 mt-2">Please wait</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Contracts
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <FileText className="w-8 h-8 text-white" />
              </div>
              Contracts
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Manage and analyze your contract portfolio
            </p>
          </div>
          <Link href="/contracts/upload">
            <Button
              size="lg"
              className="shadow-lg bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Contract
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Contracts</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {contracts.length}
                  </p>
                  {filteredContracts.length !== contracts.length && (
                    <p className="text-xs text-gray-500 mt-1">
                      {filteredContracts.length} filtered
                    </p>
                  )}
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {contracts.filter((c) => c.status === 'completed').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Processing</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {contracts.filter((c) => c.status === 'processing').length}
                  </p>
                </div>
                <Loader2 className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-3xl font-bold text-red-600">
                    {contracts.filter((c) => c.status === 'failed').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <ContractFiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            onReset={handleResetFilters}
            availableClients={availableClients}
            availableSuppliers={availableSuppliers}
          />
        )}

        {/* Contracts List */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-2xl">
                {filteredContracts.length === contracts.length
                  ? 'All Contracts'
                  : `Filtered Contracts (${filteredContracts.length}/${contracts.length})`}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={showFilters ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </Button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="value-desc">Highest Value</option>
                  <option value="value-asc">Lowest Value</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="risk-desc">Highest Risk</option>
                  <option value="risk-asc">Lowest Risk</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {contracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No contracts yet
                </h3>
                <p className="text-gray-500 mb-6">
                  Upload your first contract to get started with AI-powered
                  analysis
                </p>
                <Link href="/contracts/upload">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Contract
                  </Button>
                </Link>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No contracts match your filters
                </h3>
                <p className="text-gray-500 mb-6">
                  Try adjusting your filter criteria
                </p>
                <Button onClick={handleResetFilters} variant="outline">
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredContracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Contract Card Component
function ContractCard({ contract }: { contract: Contract }) {
  const statusDisplay = getStatusDisplay(contract.status)
  const summary = getContractSummary(contract)

  const getStatusIcon = () => {
    switch (contract.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all bg-white">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Contract Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {getStatusIcon()}
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {contract.filename ||
                contract.originalName ||
                'Untitled Contract'}
            </h3>
            <Badge
              className={`
                ${statusDisplay.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                ${statusDisplay.color === 'blue' ? 'bg-blue-100 text-blue-800' : ''}
                ${statusDisplay.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                ${statusDisplay.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${statusDisplay.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
              `}
            >
              {statusDisplay.label}
            </Badge>
          </div>

          {/* Contract Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Upload Date */}
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{formatDateTime(contract.uploadDate)}</span>
            </div>

            {/* File Size */}
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4" />
              <span>{formatFileSize(contract.fileSize)}</span>
            </div>

            {/* Parties */}
            {summary.parties && summary.parties.length > 0 && (
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span className="truncate">{summary.parties.length} parties</span>
              </div>
            )}

            {/* Total Value */}
            {summary.totalValue && (
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span>
                  {formatCurrency(summary.totalValue, summary.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Additional Info */}
          {contract.status === 'completed' && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              {summary.riskScore !== undefined && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Risk:{' '}
                    <span
                      className={`font-medium ${
                        summary.riskScore >= 80
                          ? 'text-red-600'
                          : summary.riskScore >= 50
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {summary.riskScore}
                    </span>
                  </span>
                </div>
              )}
              {summary.complianceScore !== undefined && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">
                    Compliance:{' '}
                    <span
                      className={`font-medium ${
                        summary.complianceScore >= 90
                          ? 'text-green-600'
                          : summary.complianceScore >= 70
                          ? 'text-blue-600'
                          : summary.complianceScore >= 50
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {summary.complianceScore}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {contract.status === 'processing' && contract.processing && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>{contract.processing.currentStage}</span>
                <span>{contract.processing.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${contract.processing.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {contract.status === 'failed' && contract.error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
              {contract.error}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2">
          <Link href={`/contracts/${contract.id}`}>
            <Button size="sm" variant="outline" className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          </Link>
          {contract.status === 'completed' && (
            <Button size="sm" variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

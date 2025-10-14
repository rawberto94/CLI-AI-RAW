'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card'
import { LoadingState } from '@/components/ui/loading-states'
import {
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Database,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Eye
} from 'lucide-react'

interface RateCard {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  contract_id?: string;
  effective_date: string;
  currency: string;
  region: string;
  delivery_model: string;
  rate_count: number;
  avg_hourly_rate: number;
  min_hourly_rate: number;
  max_hourly_rate: number;
  roles?: string;
}

interface BulkUploadResult {
  success: boolean;
  totalRows: number;
  processedRows: number;
  createdRateCards: number;
  createdRates: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  warnings: Array<{
    row: number;
    warning: string;
    data?: any;
  }>;
  summary: {
    suppliers: string[];
    roles: string[];
    avgRate: number;
    dateRange: { from: string; to: string };
  };
}

export default function RateManagementPage() {
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResult | null>(null)
  const [uploadData, setUploadData] = useState('')

  useEffect(() => {
    loadRateCards()
  }, [])

  const loadRateCards = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ action: 'list' })
      if (selectedSupplier) params.set('supplierId', selectedSupplier)
      if (selectedRegion) params.set('region', selectedRegion)
      
      const response = await fetch(`/api/analytics/rate-management?${params}`)
      const data = await response.json()
      
      if (data.success && data.data.success) {
        setRateCards(data.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load rate cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/analytics/rate-management?action=template')
      const data = await response.json()
      
      if (data.success) {
        const template = data.data
        const csvContent = [
          template.headers.join(','),
          ...template.example.map((row: any) => 
            template.headers.map((header: string) => row[header] || '').join(',')
          )
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'rate_card_template.csv'
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const processBulkUpload = async () => {
    if (!uploadData.trim()) return

    try {
      setLoading(true)
      
      // Parse CSV data
      const lines = uploadData.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim())
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })

      const response = await fetch('/api/analytics/rate-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_upload',
          data
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setBulkUploadResult(result.data)
        if (result.data.success) {
          await loadRateCards()
        }
      }
    } catch (error) {
      console.error('Failed to process bulk upload:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteRateCard = async (rateCardId: string) => {
    if (!confirm('Are you sure you want to delete this rate card?')) return

    try {
      const response = await fetch(`/api/analytics/rate-management?rateCardId=${rateCardId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadRateCards()
      }
    } catch (error) {
      console.error('Failed to delete rate card:', error)
    }
  }

  const filteredRateCards = rateCards.filter(card => {
    const matchesSearch = !searchTerm || 
      card.supplier_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.supplier_name && card.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (card.roles && card.roles.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesSearch
  })

  const uniqueSuppliers = [...new Set(rateCards.map(card => card.supplier_id))]
  const uniqueRegions = [...new Set(rateCards.map(card => card.region))]

  if (loading && rateCards.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState message="Loading rate card management..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            Rate Card Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manually create, edit, and bulk upload rate card data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRateCards} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Rate Card
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="Total Rate Cards"
          value={rateCards.length}
          subtitle="Across all suppliers"
          icon={<FileSpreadsheet className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard
          title="Unique Suppliers"
          value={uniqueSuppliers.length}
          subtitle="Active suppliers"
          icon={<Users className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="Average Rate"
          value={`$${Math.round(rateCards.reduce((sum, card) => sum + (card.avg_hourly_rate || 0), 0) / rateCards.length || 0)}`}
          subtitle="Per hour across portfolio"
          icon={<DollarSign className="w-5 h-5" />}
          color="purple"
        />
        <MetricCard
          title="Total Rates"
          value={rateCards.reduce((sum, card) => sum + (card.rate_count || 0), 0)}
          subtitle="Individual rate entries"
          icon={<Briefcase className="w-5 h-5" />}
          color="orange"
        />
      </div>

      {/* Filters */}
      <EnhancedCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Search rate cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suppliers</option>
                {uniqueSuppliers.map(supplier => (
                  <option key={supplier} value={supplier}>{supplier}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div>
              <Button onClick={loadRateCards} className="w-full">
                <Search className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </EnhancedCard>

      {/* Rate Cards List */}
      <EnhancedCard>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Rate Cards ({filteredRateCards.length})</span>
            <Badge variant="secondary">
              {filteredRateCards.length} of {rateCards.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRateCards.map((card) => (
              <div key={card.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {card.supplier_name || card.supplier_id}
                      </h3>
                      <Badge variant="outline">
                        {card.delivery_model}
                      </Badge>
                      <Badge variant="secondary">
                        {card.currency}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{card.region}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(card.effective_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{card.rate_count} rates</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>${Math.round(card.avg_hourly_rate || 0)}/hr avg</span>
                      </div>
                    </div>

                    {card.roles && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Roles: </span>
                        <span className="text-xs text-gray-700">{card.roles}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteRateCard(card.id)}
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {filteredRateCards.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No rate cards found matching your criteria</p>
                <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rate Card
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </EnhancedCard>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Bulk Upload Rate Cards</h2>
              <Button variant="outline" onClick={() => setShowBulkUpload(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV Data (paste or type)
                </label>
                <textarea
                  value={uploadData}
                  onChange={(e) => setUploadData(e.target.value)}
                  placeholder="Paste CSV data here or download template first..."
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
                <Button onClick={processBulkUpload} disabled={!uploadData.trim() || loading}>
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Process Upload
                </Button>
              </div>

              {/* Upload Results */}
              {bulkUploadResult && (
                <div className="mt-6 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    {bulkUploadResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <h3 className="font-semibold">
                      Upload {bulkUploadResult.success ? 'Completed' : 'Failed'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-600">Total Rows:</span>
                      <div className="font-medium">{bulkUploadResult.totalRows}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Processed:</span>
                      <div className="font-medium">{bulkUploadResult.processedRows}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Rate Cards:</span>
                      <div className="font-medium">{bulkUploadResult.createdRateCards}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Rates:</span>
                      <div className="font-medium">{bulkUploadResult.createdRates}</div>
                    </div>
                  </div>

                  {bulkUploadResult.errors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-red-600 mb-2">Errors ({bulkUploadResult.errors.length})</h4>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {bulkUploadResult.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            Row {error.row}: {error.error}
                          </div>
                        ))}
                        {bulkUploadResult.errors.length > 5 && (
                          <div className="text-sm text-gray-500">
                            ... and {bulkUploadResult.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {bulkUploadResult.success && (
                    <div className="text-sm text-gray-600">
                      <p>Successfully created {bulkUploadResult.createdRateCards} rate cards with {bulkUploadResult.createdRates} rates</p>
                      <p>Suppliers: {bulkUploadResult.summary.suppliers.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
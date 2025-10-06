'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  FileText,
  Users,
  Shield,
  CheckCircle,
  SlidersHorizontal,
} from 'lucide-react'

export interface FilterOptions {
  search: string
  status: string[]
  dateRange: { from: string; to: string }
  valueRange: { min: number; max: number }
  contractType: string[]
  riskLevel: string[]
  complianceScore: { min: number; max: number }
  clients: string[]
  suppliers: string[]
}

interface ContractFiltersPanelProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  onReset: () => void
  availableClients: string[]
  availableSuppliers: string[]
}

export function ContractFiltersPanel({
  filters,
  onFiltersChange,
  onReset,
  availableClients,
  availableSuppliers,
}: ContractFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleStatus = (status: string) => {
    const current = filters.status || []
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    updateFilter('status', updated)
  }

  const toggleContractType = (type: string) => {
    const current = filters.contractType || []
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    updateFilter('contractType', updated)
  }

  const toggleRiskLevel = (level: string) => {
    const current = filters.riskLevel || []
    const updated = current.includes(level)
      ? current.filter(l => l !== level)
      : [...current, level]
    updateFilter('riskLevel', updated)
  }

  const toggleClient = (client: string) => {
    const current = filters.clients || []
    const updated = current.includes(client)
      ? current.filter(c => c !== client)
      : [...current, client]
    updateFilter('clients', updated)
  }

  const toggleSupplier = (supplier: string) => {
    const current = filters.suppliers || []
    const updated = current.includes(supplier)
      ? current.filter(s => s !== supplier)
      : [...current, supplier]
    updateFilter('suppliers', updated)
  }

  const activeFilterCount = [
    filters.search,
    filters.status?.length,
    filters.contractType?.length,
    filters.riskLevel?.length,
    filters.dateRange?.from || filters.dateRange?.to,
    filters.valueRange?.min || filters.valueRange?.max,
    filters.complianceScore?.min || filters.complianceScore?.max,
  ].filter(Boolean).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <Badge className="bg-blue-100 text-blue-800">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-600 hover:text-gray-900"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              {isExpanded ? 'Less' : 'More'}
            </Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search contracts by name, party, or ID..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Quick Filters */}
      <div className="p-4 space-y-4">
        {/* Status Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Status
          </label>
          <div className="flex flex-wrap gap-2">
            {['completed', 'processing', 'failed', 'pending'].map((status) => (
              <Badge
                key={status}
                onClick={() => toggleStatus(status)}
                className={`cursor-pointer transition-all ${
                  filters.status?.includes(status)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Contract Type Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Contract Type
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              'Statement of Work',
              'Master Service Agreement',
              'Purchase Order',
              'NDA',
              'License Agreement',
              'Other',
            ].map((type) => (
              <Badge
                key={type}
                onClick={() => toggleContractType(type)}
                className={`cursor-pointer transition-all ${
                  filters.contractType?.includes(type)
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Client Filter */}
        {availableClients.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Users className="w-4 h-4" />
              Client
            </label>
            <div className="flex flex-wrap gap-2">
              {availableClients.map((client) => (
                <Badge
                  key={client}
                  onClick={() => toggleClient(client)}
                  className={`cursor-pointer transition-all ${
                    filters.clients?.includes(client)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {client}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Supplier Filter */}
        {availableSuppliers.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Users className="w-4 h-4" />
              Supplier
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSuppliers.map((supplier) => (
                <Badge
                  key={supplier}
                  onClick={() => toggleSupplier(supplier)}
                  className={`cursor-pointer transition-all ${
                    filters.suppliers?.includes(supplier)
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {supplier}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-100 space-y-4 bg-gray-50">
          {/* Date Range */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upload Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.dateRange?.from || ''}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    from: e.target.value,
                  })
                }
                placeholder="From"
              />
              <Input
                type="date"
                value={filters.dateRange?.to || ''}
                onChange={(e) =>
                  updateFilter('dateRange', {
                    ...filters.dateRange,
                    to: e.target.value,
                  })
                }
                placeholder="To"
              />
            </div>
          </div>

          {/* Value Range */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Contract Value Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={filters.valueRange?.min || ''}
                onChange={(e) =>
                  updateFilter('valueRange', {
                    ...filters.valueRange,
                    min: Number(e.target.value),
                  })
                }
                placeholder="Min ($)"
              />
              <Input
                type="number"
                value={filters.valueRange?.max || ''}
                onChange={(e) =>
                  updateFilter('valueRange', {
                    ...filters.valueRange,
                    max: Number(e.target.value),
                  })
                }
                placeholder="Max ($)"
              />
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Risk Level
            </label>
            <div className="flex flex-wrap gap-2">
              {['Low', 'Medium', 'High', 'Critical'].map((level) => (
                <Badge
                  key={level}
                  onClick={() => toggleRiskLevel(level)}
                  className={`cursor-pointer transition-all ${
                    filters.riskLevel?.includes(level)
                      ? level === 'Low'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : level === 'Medium'
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : level === 'High'
                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </Badge>
              ))}
            </div>
          </div>

          {/* Compliance Score */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Compliance Score Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={filters.complianceScore?.min || ''}
                onChange={(e) =>
                  updateFilter('complianceScore', {
                    ...filters.complianceScore,
                    min: Number(e.target.value),
                  })
                }
                placeholder="Min (0-100)"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={filters.complianceScore?.max || ''}
                onChange={(e) =>
                  updateFilter('complianceScore', {
                    ...filters.complianceScore,
                    max: Number(e.target.value),
                  })
                }
                placeholder="Max (0-100)"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

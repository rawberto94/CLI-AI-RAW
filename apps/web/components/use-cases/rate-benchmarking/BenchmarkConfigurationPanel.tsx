'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Settings2,
  Search,
  Building2,
  Globe,
  Briefcase,
  Users,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  TrendingUp
} from 'lucide-react'
import {
  suppliers,
  type SupplierData,
  type ServiceLine,
  type Geography,
  type SeniorityLevel
} from '@/lib/use-cases/enhanced-rate-benchmarking-data'

export type ViewMode = 'supplier' | 'service-line' | 'seniority' | 'geography'

interface BenchmarkConfigurationPanelProps {
  selectedSupplier: string | null
  selectedServiceLine: ServiceLine | null
  selectedRoles: string[]
  selectedGeography: Geography
  viewMode: ViewMode
  onSupplierChange: (supplier: string | null) => void
  onServiceLineChange: (serviceLine: ServiceLine | null) => void
  onRolesChange: (roles: string[]) => void
  onGeographyChange: (geography: Geography) => void
  onViewModeChange: (mode: ViewMode) => void
}

export default function BenchmarkConfigurationPanel({
  selectedSupplier,
  selectedServiceLine,
  selectedRoles,
  selectedGeography,
  viewMode,
  onSupplierChange,
  onServiceLineChange,
  onRolesChange,
  onGeographyChange,
  onViewModeChange
}: BenchmarkConfigurationPanelProps) {
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase())
    )
  }, [supplierSearch])

  // Get available service lines based on selected supplier
  const availableServiceLines = useMemo(() => {
    if (!selectedSupplier) {
      // Return all unique service lines
      const allLines = new Set<ServiceLine>()
      suppliers.forEach(s => s.serviceLines.forEach(line => allLines.add(line)))
      return Array.from(allLines)
    }
    const supplier = suppliers.find(s => s.id === selectedSupplier)
    return supplier?.serviceLines || []
  }, [selectedSupplier])

  // Get available geographies based on selected supplier
  const availableGeographies = useMemo(() => {
    if (!selectedSupplier) {
      const allGeos = new Set<Geography>()
      suppliers.forEach(s => s.geographies.forEach(geo => allGeos.add(geo)))
      return Array.from(allGeos)
    }
    const supplier = suppliers.find(s => s.id === selectedSupplier)
    return supplier?.geographies || []
  }, [selectedSupplier])

  // Get selected supplier data
  const selectedSupplierData = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplier)
  }, [selectedSupplier])

  // Available roles based on service line
  const availableRoles = useMemo(() => {
    const roles = [
      'Senior Consultant',
      'Project Manager',
      'Business Analyst',
      'Software Developer',
      'QA Engineer',
      'Technical Architect',
      'Data Analyst',
      'DevOps Engineer',
      'Accountant',
      'Customer Service Representative'
    ]
    return roles
  }, [])

  const handleRoleToggle = (role: string) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter(r => r !== role))
    } else {
      onRolesChange([...selectedRoles, role])
    }
  }

  const handleSelectAllRoles = () => {
    if (selectedRoles.length === availableRoles.length) {
      onRolesChange([])
    } else {
      onRolesChange(availableRoles)
    }
  }

  return (
    <Card className="mb-6 shadow-lg border-2 border-blue-100 hover:shadow-xl transition-all duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-lg font-bold">Benchmark Configuration</div>
            <div className="text-sm font-normal text-gray-600">Customize your analysis parameters</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Supplier Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Supplier
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search suppliers..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
            <Button
              variant={selectedSupplier === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSupplierChange(null)}
              className="justify-start"
            >
              All Suppliers
            </Button>
            {filteredSuppliers.map(supplier => (
              <Button
                key={supplier.id}
                variant={selectedSupplier === supplier.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSupplierChange(supplier.id)}
                className={`justify-start transition-all duration-200 ${
                  selectedSupplier === supplier.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="truncate">{supplier.name}</span>
                  <Badge 
                    variant="secondary" 
                    className={`ml-auto text-xs ${
                      selectedSupplier === supplier.id
                        ? 'bg-white/20 text-white'
                        : ''
                    }`}
                  >
                    {supplier.tier}
                  </Badge>
                </div>
              </Button>
            ))}
          </div>
          {selectedSupplierData && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>
                {selectedSupplierData.dataQuality.sampleSize} contracts analyzed
              </span>
              <Badge variant="outline" className="ml-auto">
                {Math.round(selectedSupplierData.dataQuality.confidence * 100)}% confidence
              </Badge>
            </div>
          )}
        </div>

        {/* Service Line Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Service Line
          </label>
          <Select
            value={selectedServiceLine || 'all'}
            onValueChange={(value) => onServiceLineChange(value === 'all' ? null : value as ServiceLine)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select service line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Service Lines</SelectItem>
              {availableServiceLines.map(line => (
                <SelectItem key={line} value={line}>
                  {line}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Geography Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Geography
          </label>
          <Select
            value={selectedGeography}
            onValueChange={(value) => onGeographyChange(value as Geography)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableGeographies.map(geo => (
                <SelectItem key={geo} value={geo}>
                  {geo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Role Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Roles to Analyze
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAllRoles}
            >
              {selectedRoles.length === availableRoles.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-3 border rounded-lg bg-gray-50">
            {availableRoles.map(role => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={role}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => handleRoleToggle(role)}
                />
                <label
                  htmlFor={role}
                  className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {role}
                </label>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-600">
            {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* View Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Comparison View
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={viewMode === 'supplier' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('supplier')}
              className="justify-start"
            >
              <Building2 className="w-4 h-4 mr-2" />
              By Supplier
            </Button>
            <Button
              variant={viewMode === 'service-line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('service-line')}
              className="justify-start"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              By Service Line
            </Button>
            <Button
              variant={viewMode === 'seniority' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('seniority')}
              className="justify-start"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              By Seniority
            </Button>
            <Button
              variant={viewMode === 'geography' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('geography')}
              className="justify-start"
            >
              <Globe className="w-4 h-4 mr-2" />
              By Geography
            </Button>
          </div>
        </div>

        {/* Confidence Warning */}
        {selectedSupplierData && selectedSupplierData.dataQuality.confidence < 0.8 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-yellow-900">Limited Benchmark Data</div>
              <div className="text-yellow-700 mt-1">
                Only {selectedSupplierData.dataQuality.sampleSize} contracts available for this supplier.
                Consider selecting a broader geography or service line for more reliable benchmarks.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  GitCompare,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Calendar,
  User,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractVersion {
  id: string
  versionNumber: number
  uploadedBy: string
  uploadedAt: string
  changes?: Record<string, any>
  isActive: boolean
  summary?: string
}

interface VersionDiff {
  field: string
  label: string
  oldValue: any
  newValue: any
  changeType: 'added' | 'removed' | 'modified'
}

interface VersionComparisonProps {
  contractId: string
  onClose?: () => void
}

export function VersionComparison({ contractId, onClose }: VersionComparisonProps) {
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [selectedVersion1, setSelectedVersion1] = useState<string>('')
  const [selectedVersion2, setSelectedVersion2] = useState<string>('')
  const [differences, setDifferences] = useState<VersionDiff[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadVersions()
  }, [contractId])

  useEffect(() => {
    if (selectedVersion1 && selectedVersion2) {
      compareFinal()
    }
  }, [selectedVersion1, selectedVersion2])

  const loadVersions = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/versions`)
      if (!response.ok) throw new Error('Failed to load versions')
      const data = await response.json()
      const versionList = data.versions || []
      setVersions(versionList)

      // Auto-select current and previous version
      if (versionList.length >= 2) {
        setSelectedVersion1(versionList[versionList.length - 2].id)
        setSelectedVersion2(versionList[versionList.length - 1].id)
      }
    } catch (error) {
      console.error('Failed to load versions:', error)
    }
  }

  const compareVersions = async () => {
    if (!selectedVersion1 || !selectedVersion2) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/versions/compare?v1=${selectedVersion1}&v2=${selectedVersion2}`
      )
      if (!response.ok) throw new Error('Failed to compare versions')
      const data = await response.json()
      setDifferences(data.differences || [])
    } catch (error) {
      console.error('Failed to compare versions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleField = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Badge className="bg-green-500 text-white">Added</Badge>
      case 'removed':
        return <Badge className="bg-red-500 text-white">Removed</Badge>
      case 'modified':
        return <Badge className="bg-blue-500 text-white">Modified</Badge>
      default:
        return null
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return String(value)
  }

  const selectedV1 = versions.find((v) => v.id === selectedVersion1)
  const selectedV2 = versions.find((v) => v.id === selectedVersion2)

  // Mock comparison for demo purposes
  const compareFinal = () => {
    const mockDifferences: VersionDiff[] = [
      {
        field: 'totalValue',
        label: 'Contract Value',
        oldValue: '$500,000',
        newValue: '$550,000',
        changeType: 'modified',
      },
      {
        field: 'expirationDate',
        label: 'Expiration Date',
        oldValue: '2025-12-31',
        newValue: '2026-06-30',
        changeType: 'modified',
      },
      {
        field: 'paymentTerms',
        label: 'Payment Terms',
        oldValue: 'Net 30',
        newValue: 'Net 45',
        changeType: 'modified',
      },
      {
        field: 'autoRenewal',
        label: 'Auto Renewal',
        oldValue: undefined,
        newValue: 'Yes',
        changeType: 'added',
      },
      {
        field: 'penaltyClause',
        label: 'Penalty Clause',
        oldValue: '5% per month late fee',
        newValue: undefined,
        changeType: 'removed',
      },
    ]
    setDifferences(mockDifferences)
  }

  return (
    <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
              <GitCompare className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Version Comparison
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Compare changes between contract versions
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Version Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Original Version</label>
            <Select value={selectedVersion1} onValueChange={setSelectedVersion1}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">v{version.versionNumber}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(version.uploadedAt).toLocaleDateString()}
                      </span>
                      {version.isActive && (
                        <Badge className="bg-green-500 text-white text-xs">Current</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedV1 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  {new Date(selectedV1.uploadedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <User className="h-3 w-3" />
                  {selectedV1.uploadedBy || 'Unknown'}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Compare To</label>
            <Select value={selectedVersion2} onValueChange={setSelectedVersion2}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">v{version.versionNumber}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(version.uploadedAt).toLocaleDateString()}
                      </span>
                      {version.isActive && (
                        <Badge className="bg-green-500 text-white text-xs">Current</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedV2 && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  {new Date(selectedV2.uploadedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <User className="h-3 w-3" />
                  {selectedV2.uploadedBy || 'Unknown'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Summary */}
        {differences.length > 0 && (
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">
                {differences.length} Change{differences.length !== 1 ? 's' : ''} Detected
              </h3>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500 text-white">
                  {differences.filter((d) => d.changeType === 'added').length} Added
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500 text-white">
                  {differences.filter((d) => d.changeType === 'modified').length} Modified
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-500 text-white">
                  {differences.filter((d) => d.changeType === 'removed').length} Removed
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Differences List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Comparing versions...</p>
            </div>
          </div>
        ) : differences.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {selectedVersion1 && selectedVersion2
                ? 'No differences found between selected versions'
                : 'Select two versions to compare'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {differences.map((diff, index) => {
              const isExpanded = expandedFields.has(diff.field)
              return (
                <div
                  key={index}
                  className={cn(
                    'p-4 rounded-xl border transition-all duration-200',
                    diff.changeType === 'added' && 'bg-green-50 border-green-200',
                    diff.changeType === 'removed' && 'bg-red-50 border-red-200',
                    diff.changeType === 'modified' && 'bg-blue-50 border-blue-200'
                  )}
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleField(diff.field)}
                  >
                    <div className="flex items-center gap-3">
                      {getChangeIcon(diff.changeType)}
                      <h4 className="font-semibold text-gray-900">{diff.label}</h4>
                    </div>
                    <Button variant="ghost" size="sm">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                          <ArrowLeft className="h-3 w-3" />
                          Original
                        </div>
                        <div className={cn(
                          'p-3 rounded-lg font-mono text-sm',
                          diff.changeType === 'removed' ? 'bg-red-100 line-through' : 'bg-white border border-gray-200'
                        )}>
                          {formatValue(diff.oldValue)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                          <ArrowRight className="h-3 w-3" />
                          Updated
                        </div>
                        <div className={cn(
                          'p-3 rounded-lg font-mono text-sm',
                          diff.changeType === 'added' ? 'bg-green-100 font-semibold' : 'bg-white border border-gray-200'
                        )}>
                          {formatValue(diff.newValue)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Action Buttons */}
        {differences.length > 0 && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Accept All Changes
            </Button>
            <Button variant="outline" className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Reject All Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

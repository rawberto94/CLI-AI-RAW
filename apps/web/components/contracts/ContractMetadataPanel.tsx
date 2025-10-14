'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Save,
  Edit,
  Tag,
  Building2,
  Calendar,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface ContractMetadata {
  contractId: string
  tenantId: string
  tags: string[]
  systemFields: {
    contractTitle?: string
    contractType?: string
    clientName?: string
    supplierName?: string
    totalValue?: number
    currency?: string
    effectiveDate?: string
    expirationDate?: string
    department?: string
    priority?: string
  }
}

interface ContractMetadataPanelProps {
  contractId: string
  className?: string
}

export default function ContractMetadataPanel({ contractId, className = '' }: ContractMetadataPanelProps) {
  const [metadata, setMetadata] = useState<ContractMetadata | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMetadata()
  }, [contractId])

  const loadMetadata = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/contracts/${contractId}/metadata`)
      
      if (!response.ok) {
        throw new Error('Failed to load metadata')
      }
      
      const result = await response.json()
      if (result.success) {
        setMetadata(result.data)
      } else {
        throw new Error(result.error || 'Failed to load metadata')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata')
    } finally {
      setIsLoading(false)
    }
  }

  const saveMetadata = async () => {
    if (!metadata) return
    
    try {
      setIsSaving(true)
      const response = await fetch(`/api/contracts/${contractId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      })
      
      if (!response.ok) {
        throw new Error('Failed to save metadata')
      }
      
      const result = await response.json()
      if (result.success) {
        setMetadata(result.data)
        setIsEditing(false)
      } else {
        throw new Error(result.error || 'Failed to save metadata')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save metadata')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSystemField = (field: string, value: any) => {
    if (!metadata) return
    
    setMetadata(prev => ({
      ...prev!,
      systemFields: {
        ...prev!.systemFields,
        [field]: value
      }
    }))
  }

  const addTag = (tagName: string) => {
    if (!metadata || !tagName.trim() || metadata.tags.includes(tagName)) return
    
    setMetadata(prev => ({
      ...prev!,
      tags: [...prev!.tags, tagName.trim()]
    }))
  }

  const removeTag = (tagName: string) => {
    if (!metadata) return
    
    setMetadata(prev => ({
      ...prev!,
      tags: prev!.tags.filter(tag => tag !== tagName)
    }))
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading metadata...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <Button onClick={loadMetadata} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!metadata) return null

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Contract Metadata
          </CardTitle>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={saveMetadata}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractTitle">Contract Title</Label>
              {isEditing ? (
                <Input
                  id="contractTitle"
                  value={metadata.systemFields.contractTitle || ''}
                  onChange={(e) => updateSystemField('contractTitle', e.target.value)}
                  placeholder="Enter contract title"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.contractTitle || 'Not specified'}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="contractType">Contract Type</Label>
              {isEditing ? (
                <Select
                  value={metadata.systemFields.contractType || ''}
                  onValueChange={(val) => updateSystemField('contractType', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">Service Agreement</SelectItem>
                    <SelectItem value="PURCHASE">Purchase Order</SelectItem>
                    <SelectItem value="NDA">Non-Disclosure Agreement</SelectItem>
                    <SelectItem value="EMPLOYMENT">Employment Contract</SelectItem>
                    <SelectItem value="VENDOR">Vendor Agreement</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.contractType || 'Not specified'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parties */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Parties
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              {isEditing ? (
                <Input
                  id="clientName"
                  value={metadata.systemFields.clientName || ''}
                  onChange={(e) => updateSystemField('clientName', e.target.value)}
                  placeholder="Enter client name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.clientName || 'Not specified'}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="supplierName">Supplier Name</Label>
              {isEditing ? (
                <Input
                  id="supplierName"
                  value={metadata.systemFields.supplierName || ''}
                  onChange={(e) => updateSystemField('supplierName', e.target.value)}
                  placeholder="Enter supplier name"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.supplierName || 'Not specified'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="totalValue">Total Value</Label>
              {isEditing ? (
                <Input
                  id="totalValue"
                  type="number"
                  value={metadata.systemFields.totalValue || ''}
                  onChange={(e) => updateSystemField('totalValue', Number(e.target.value))}
                  placeholder="Enter total value"
                />
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.totalValue 
                    ? `${metadata.systemFields.currency || 'USD'} ${metadata.systemFields.totalValue.toLocaleString()}`
                    : 'Not specified'
                  }
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              {isEditing ? (
                <Select
                  value={metadata.systemFields.currency || 'USD'}
                  onValueChange={(val) => updateSystemField('currency', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1 text-sm text-gray-900">
                  {metadata.systemFields.currency || 'USD'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {metadata.tags.map(tag => (
              <Badge
                key={tag}
                variant="outline"
                className="flex items-center gap-1"
              >
                {tag}
                {isEditing && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:bg-red-100 rounded-full p-0.5"
                  >
                    ×
                  </button>
                )}
              </Badge>
            ))}
            {metadata.tags.length === 0 && (
              <span className="text-sm text-gray-500">No tags assigned</span>
            )}
          </div>
          
          {isEditing && (
            <div className="mt-3">
              <Input
                placeholder="Add tag and press Enter"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTag(e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
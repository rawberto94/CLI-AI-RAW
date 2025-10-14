'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EnhancedCard } from '@/components/ui/enhanced-card'
import { InfoCallout } from '@/components/ui/interactive-elements'
import {
  Save,
  Plus,
  X,
  Tag,
  Calendar,
  DollarSign,
  Users,
  Building2,
  FileText,
  Settings,
  Hash,
  Clock,
  AlertCircle,
  CheckCircle,
  Edit3,
  Trash2
} from 'lucide-react'

interface ContractMetadata {
  contractId: string
  tenantId: string
  categoryId?: string
  tags: string[]
  customFields: Record<string, any>
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
    owner?: string
    priority?: string
  }
}

interface MetadataField {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'boolean' | 'currency' | 'duration'
  required: boolean
  category: 'basic' | 'financial' | 'legal' | 'operational' | 'custom'
  validation?: {
    options?: Array<{ value: string; label: string }>
  }
}

interface TaxonomyTag {
  id: string
  name: string
  color: string
  type: 'system' | 'custom'
}

interface ContractMetadataEditorProps {
  contractId: string
  initialMetadata?: ContractMetadata
  onSave?: (metadata: ContractMetadata) => void
  onCancel?: () => void
  className?: string
}

export default function ContractMetadataEditor({
  contractId,
  initialMetadata,
  onSave,
  onCancel,
  className = ''
}: ContractMetadataEditorProps) {
  const [metadata, setMetadata] = useState<ContractMetadata>(
    initialMetadata || {
      contractId,
      tenantId: 'demo',
      tags: [],
      customFields: {},
      systemFields: {}
    }
  )
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([])
  const [availableTags, setAvailableTags] = useState<TaxonomyTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadMetadataFields()
    loadAvailableTags()
  }, [])

  const loadMetadataFields = async () => {
    try {
      // Mock data - in production, fetch from API
      const fields: MetadataField[] = [
        {
          id: 'department',
          name: 'department',
          label: 'Department',
          type: 'select',
          required: true,
          category: 'basic',
          validation: {
            options: [
              { value: 'legal', label: 'Legal' },
              { value: 'finance', label: 'Finance' },
              { value: 'operations', label: 'Operations' },
              { value: 'hr', label: 'Human Resources' },
              { value: 'it', label: 'Information Technology' }
            ]
          }
        },
        {
          id: 'priority',
          name: 'priority',
          label: 'Priority Level',
          type: 'select',
          required: false,
          category: 'basic',
          validation: {
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' }
            ]
          }
        }
      ]
      setMetadataFields(fields)
    } catch (error) {
      console.error('Failed to load metadata fields:', error)
    }
  }  con
st loadAvailableTags = async () => {
    try {
      // Mock data - in production, fetch from API
      const tags: TaxonomyTag[] = [
        { id: 'tag1', name: 'high-value', color: '#EF4444', type: 'system' },
        { id: 'tag2', name: 'recurring', color: '#10B981', type: 'system' },
        { id: 'tag3', name: 'urgent', color: '#F59E0B', type: 'system' },
        { id: 'tag4', name: 'compliance-required', color: '#8B5CF6', type: 'system' },
        { id: 'tag5', name: 'auto-renewal', color: '#3B82F6', type: 'system' },
        { id: 'tag6', name: 'confidential', color: '#6B7280', type: 'system' }
      ]
      setAvailableTags(tags)
    } catch (error) {
      console.error('Failed to load available tags:', error)
    }
  }

  const handleSystemFieldChange = (field: string, value: any) => {
    setMetadata(prev => ({
      ...prev,
      systemFields: {
        ...prev.systemFields,
        [field]: value
      }
    }))
    setHasChanges(true)
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleCustomFieldChange = (field: string, value: any) => {
    setMetadata(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [field]: value
      }
    }))
    setHasChanges(true)
  }

  const addTag = (tagName: string) => {
    if (!tagName.trim() || metadata.tags.includes(tagName)) return
    
    setMetadata(prev => ({
      ...prev,
      tags: [...prev.tags, tagName.trim()]
    }))
    setHasChanges(true)
  }

  const removeTag = (tagName: string) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagName)
    }))
    setHasChanges(true)
  }

  const createNewTag = () => {
    if (!newTagName.trim()) return
    
    addTag(newTagName)
    setNewTagName('')
    
    // Add to available tags as custom tag
    const newTag: TaxonomyTag = {
      id: `custom_${Date.now()}`,
      name: newTagName.trim(),
      color: generateTagColor(newTagName),
      type: 'custom'
    }
    setAvailableTags(prev => [...prev, newTag])
  }

  const generateTagColor = (name: string): string => {
    const colors = ['#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#14B8A6', '#F97316']
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Validate required system fields
    if (!metadata.systemFields.contractTitle?.trim()) {
      newErrors.contractTitle = 'Contract title is required'
    }
    
    if (!metadata.systemFields.contractType) {
      newErrors.contractType = 'Contract type is required'
    }

    // Validate required custom fields
    metadataFields.forEach(field => {
      if (field.required && !metadata.customFields[field.name]) {
        newErrors[field.name] = `${field.label} is required`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    
    setIsLoading(true)
    try {
      // Save metadata via API
      const response = await fetch(`/api/contracts/${contractId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      })
      
      if (!response.ok) throw new Error('Failed to save metadata')
      
      setHasChanges(false)
      onSave?.(metadata)
    } catch (error) {
      console.error('Failed to save metadata:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderField = (field: MetadataField) => {
    const value = metadata.customFields[field.name] || ''
    const error = errors[field.name]

    switch (field.type) {
      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.name} className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={value}
              onValueChange={(val) => handleCustomFieldChange(field.name, val)}
            >
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.validation?.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )

      case 'number':
      case 'currency':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.name} className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, Number(e.target.value))}
              className={error ? 'border-red-500' : ''}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.name} className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.name}
              type="date"
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )

      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.name} className="flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.name}
              value={value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
              className={error ? 'border-red-500' : ''}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )
    }
  }

  const fieldsByCategory = metadataFields.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = []
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, MetadataField[]>)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contract Metadata</h2>
          <p className="text-gray-600">
            Manage contract information, tags, and custom fields
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !hasChanges}
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Basic Info
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags & Categories
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Custom Fields
          </TabsTrigger>
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-6">
          <EnhancedCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Contract Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractTitle" className="flex items-center gap-2">
                    Contract Title
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contractTitle"
                    value={metadata.systemFields.contractTitle || ''}
                    onChange={(e) => handleSystemFieldChange('contractTitle', e.target.value)}
                    className={errors.contractTitle ? 'border-red-500' : ''}
                    placeholder="Enter contract title"
                  />
                  {errors.contractTitle && (
                    <p className="text-sm text-red-500">{errors.contractTitle}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractType" className="flex items-center gap-2">
                    Contract Type
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={metadata.systemFields.contractType || ''}
                    onValueChange={(val) => handleSystemFieldChange('contractType', val)}
                  >
                    <SelectTrigger className={errors.contractType ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE">Service Agreement</SelectItem>
                      <SelectItem value="PURCHASE">Purchase Order</SelectItem>
                      <SelectItem value="NDA">Non-Disclosure Agreement</SelectItem>
                      <SelectItem value="EMPLOYMENT">Employment Contract</SelectItem>
                      <SelectItem value="VENDOR">Vendor Agreement</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.contractType && (
                    <p className="text-sm text-red-500">{errors.contractType}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Client Name
                  </Label>
                  <Input
                    id="clientName"
                    value={metadata.systemFields.clientName || ''}
                    onChange={(e) => handleSystemFieldChange('clientName', e.target.value)}
                    placeholder="Enter client name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierName" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Supplier Name
                  </Label>
                  <Input
                    id="supplierName"
                    value={metadata.systemFields.supplierName || ''}
                    onChange={(e) => handleSystemFieldChange('supplierName', e.target.value)}
                    placeholder="Enter supplier name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effectiveDate" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Effective Date
                  </Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={metadata.systemFields.effectiveDate || ''}
                    onChange={(e) => handleSystemFieldChange('effectiveDate', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expirationDate" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Expiration Date
                  </Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={metadata.systemFields.expirationDate || ''}
                    onChange={(e) => handleSystemFieldChange('expirationDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </EnhancedCard>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <EnhancedCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalValue">Total Contract Value</Label>
                  <Input
                    id="totalValue"
                    type="number"
                    value={metadata.systemFields.totalValue || ''}
                    onChange={(e) => handleSystemFieldChange('totalValue', Number(e.target.value))}
                    placeholder="Enter total value"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={metadata.systemFields.currency || 'USD'}
                    onValueChange={(val) => handleSystemFieldChange('currency', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </EnhancedCard>
        </TabsContent>

        {/* Tags & Categories Tab */}
        <TabsContent value="tags" className="space-y-6">
          <EnhancedCard variant="gradient">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-600" />
                Tags & Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Tags */}
              <div>
                <Label className="text-base font-medium mb-3 block">Current Tags</Label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {metadata.tags.map(tag => {
                    const tagInfo = availableTags.find(t => t.name === tag)
                    return (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="flex items-center gap-1 px-3 py-1"
                        style={{ 
                          backgroundColor: tagInfo?.color + '20',
                          borderColor: tagInfo?.color,
                          color: tagInfo?.color 
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    )
                  })}
                  {metadata.tags.length === 0 && (
                    <p className="text-gray-500 text-sm">No tags assigned</p>
                  )}
                </div>
              </div>

              {/* Available Tags */}
              <div>
                <Label className="text-base font-medium mb-3 block">Available Tags</Label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {availableTags
                    .filter(tag => !metadata.tags.includes(tag.name))
                    .map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-gray-50 flex items-center gap-1"
                        onClick={() => addTag(tag.name)}
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        <Plus className="w-3 h-3" />
                        {tag.name}
                      </Badge>
                    ))}
                </div>
              </div>

              {/* Create New Tag */}
              <div>
                <Label className="text-base font-medium mb-3 block">Create New Tag</Label>
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter new tag name"
                    onKeyPress={(e) => e.key === 'Enter' && createNewTag()}
                  />
                  <Button onClick={createNewTag} disabled={!newTagName.trim()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Tag
                  </Button>
                </div>
              </div>
            </CardContent>
          </EnhancedCard>
        </TabsContent>

        {/* Custom Fields Tab */}
        <TabsContent value="custom" className="space-y-6">
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <EnhancedCard key={category} variant="gradient">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  <Hash className="w-5 h-5 text-indigo-600" />
                  {category} Fields
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map(renderField)}
                </div>
              </CardContent>
            </EnhancedCard>
          ))}
        </TabsContent>
      </Tabs>

      {/* Save Reminder */}
      {hasChanges && (
        <InfoCallout type="warning" title="Unsaved Changes">
          You have unsaved changes. Don't forget to save your modifications.
        </InfoCallout>
      )}
    </div>
  )
}
/**
 * Contract Metadata Editor with AI Confidence Scores
 * Enhanced editor with confidence visualization and field categorization
 */

'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2, Save, X, Check, AlertCircle, CheckCircle2, TrendingUp, Sparkles, AlertTriangle, Users, Calendar, DollarSign, FileText, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { logError, logUserAction } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface FieldMetadata {
  value: any;
  confidence?: number;
  lastUpdated?: string;
  updatedBy?: string;
}

interface ContractMetadataEditorProps {
  contractId: string;
  initialData: {
    contractTitle?: string | FieldMetadata;
    description?: string | FieldMetadata;
    clientName?: string | FieldMetadata;
    supplierName?: string | FieldMetadata;
    contractType?: string | FieldMetadata;
    category?: string | FieldMetadata;
    categoryL1?: string | FieldMetadata;
    categoryL2?: string | FieldMetadata;
    totalValue?: number | FieldMetadata;
    currency?: string | FieldMetadata;
    effectiveDate?: string | FieldMetadata;
    expirationDate?: string | FieldMetadata;
    startDate?: string | FieldMetadata;
    endDate?: string | FieldMetadata;
    jurisdiction?: string | FieldMetadata;
    status?: string | FieldMetadata;
    tags?: string[] | FieldMetadata;
    keywords?: string[] | FieldMetadata;
  };
  onUpdate?: (updatedData: any) => void;
}

export function ContractMetadataEditor({
  contractId,
  initialData,
  onUpdate,
}: ContractMetadataEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const toast = useToast();
  const { data: session } = useSession();
  
  // Extract values from FieldMetadata or use raw values
  const extractValue = (field: any) => {
    if (field && typeof field === 'object' && 'value' in field) {
      return field.value;
    }
    return field;
  };
  
  const extractConfidence = (field: any): number | undefined => {
    if (field && typeof field === 'object' && 'confidence' in field) {
      return field.confidence;
    }
    return undefined;
  };
  
  const [formData, setFormData] = useState(
    Object.fromEntries(
      Object.entries(initialData).map(([key, val]) => [key, extractValue(val)])
    )
  );

  // Field definitions with categories
  const metadataFields = [
    // Basic Information
    { key: 'contractTitle', label: 'Contract Title', type: 'text', icon: FileText, category: 'basic', editable: true, required: true },
    { key: 'contractType', label: 'Contract Type', type: 'select', icon: FileText, category: 'basic', editable: true, options: ['MSA', 'SOW', 'NDA', 'SLA', 'Purchase Order', 'Employment', 'Lease', 'License', 'Other'] },
    { key: 'description', label: 'Description', type: 'textarea', icon: FileText, category: 'basic', editable: true },
    { key: 'category', label: 'Category', type: 'text', icon: FileText, category: 'basic', editable: true },
    
    // Parties
    { key: 'clientName', label: 'Client/Buyer', type: 'text', icon: Users, category: 'parties', editable: true, required: true },
    { key: 'supplierName', label: 'Supplier/Vendor', type: 'text', icon: Users, category: 'parties', editable: true, required: true },
    
    // Dates
    { key: 'effectiveDate', label: 'Effective Date', type: 'date', icon: Calendar, category: 'dates', editable: true },
    { key: 'startDate', label: 'Start Date', type: 'date', icon: Calendar, category: 'dates', editable: true },
    { key: 'endDate', label: 'End Date', type: 'date', icon: Calendar, category: 'dates', editable: true },
    { key: 'expirationDate', label: 'Expiration Date', type: 'date', icon: Calendar, category: 'dates', editable: true },
    
    // Financial
    { key: 'totalValue', label: 'Contract Value', type: 'currency', icon: DollarSign, category: 'financial', editable: true },
    { key: 'currency', label: 'Currency', type: 'select', icon: DollarSign, category: 'financial', editable: true, options: ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'] },
    
    // Legal
    { key: 'jurisdiction', label: 'Jurisdiction', type: 'text', icon: Shield, category: 'legal', editable: true },
    { key: 'status', label: 'Status', type: 'select', icon: CheckCircle2, category: 'legal', editable: true, options: ['DRAFT', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'COMPLETED'] },
    
    // Other
    { key: 'tags', label: 'Tags', type: 'array', icon: Sparkles, category: 'other', editable: true },
    { key: 'keywords', label: 'Keywords', type: 'array', icon: Sparkles, category: 'other', editable: true },
  ];

  const categories = [
    { id: 'all', label: 'All Fields', icon: FileText },
    { id: 'basic', label: 'Basic', icon: FileText },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'dates', label: 'Dates', icon: Calendar },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'legal', label: 'Legal', icon: Shield },
    { id: 'other', label: 'Other', icon: Sparkles },
  ];

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400';
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    
    const color = confidence >= 0.9 ? 'bg-green-100 text-green-700 border-green-300' :
                  confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                  'bg-red-100 text-red-700 border-red-300';
    
    const label = confidence >= 0.9 ? 'High' :
                  confidence >= 0.7 ? 'Medium' :
                  'Low';
    
    return (
      <Badge className={`${color} text-xs px-2 py-0.5`}>
        <TrendingUp className="h-3 w-3 mr-1" />
        {label} ({Math.round(confidence * 100)}%)
      </Badge>
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const startTime = performance.now();
    
    try {
      logUserAction('contract-metadata-edit-start', undefined, { contractId });
      
      const response = await fetch(`/api/contracts/${contractId}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          updatedBy: session?.user?.id || session?.user?.name || 'anonymous'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }

      const result = await response.json();
      
      const duration = performance.now() - startTime;
      logUserAction('contract-metadata-edit-success', String(duration), { contractId });
      
      toast.success('Saved', 'Contract metadata updated successfully');
      setIsEditing(false);
      
      if (onUpdate) {
        onUpdate(result.data);
      }
      
    } catch (error) {
      logError('Contract metadata edit failed', error, { contractId });
      toast.error('Save Failed', 'Failed to update contract metadata');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(
      Object.fromEntries(
        Object.entries(initialData).map(([key, val]) => [key, extractValue(val)])
      )
    );
    setIsEditing(false);
  };

  const filteredFields = activeCategory === 'all' 
    ? metadataFields 
    : metadataFields.filter(f => f.category === activeCategory);

  const renderFieldValue = (field: any) => {
    const value = formData[field.key];
    
    if (field.type === 'array') {
      const arrayValue = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {arrayValue.length > 0 ? (
            arrayValue.map((item: any, idx: number) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </Badge>
            ))
          ) : (
            <span className="text-gray-400 text-sm">Not set</span>
          )}
        </div>
      );
    }
    
    if (field.type === 'date') {
      return (
        <p className="text-sm text-gray-900">
          {value ? new Date(value).toLocaleDateString() : <span className="text-gray-400">Not set</span>}
        </p>
      );
    }
    
    if (field.type === 'currency') {
      return (
        <p className="text-sm text-gray-900 font-semibold">
          {value ? `${formData.currency || 'USD'} ${Number(value).toLocaleString()}` : <span className="text-gray-400">Not set</span>}
        </p>
      );
    }
    
    return (
      <p className="text-sm text-gray-900">
        {value || <span className="text-gray-400">Not set</span>}
      </p>
    );
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Contract Metadata
          </h3>
          <Button
            variant="outline"
            size="sm"
            data-metadata-edit
            onClick={() => setIsEditing(true)}
            className="gap-2 hover:bg-blue-50 hover:border-blue-300"
          >
            <Edit2 className="h-4 w-4" />
            Edit Metadata
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 pb-4 border-b">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  activeCategory === cat.id &&
                    'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md'
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {cat.label}
              </Button>
            );
          })}
        </div>
        
        {/* Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFields.map((field) => {
            const Icon = field.icon || FileText;
            const confidence = extractConfidence(initialData[field.key as keyof typeof initialData]);
            const hasLowConfidence = confidence && confidence < 0.7;
            
            return (
              <div
                key={field.key}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all',
                  hasLowConfidence
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      hasLowConfidence ? 'bg-yellow-200' : 'bg-blue-100'
                    )}>
                      <Icon className={cn(
                        'h-4 w-4',
                        hasLowConfidence ? 'text-yellow-700' : 'text-blue-600'
                      )} />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">
                        {field.label}
                      </Label>
                      {confidence && (
                        <div className="mt-1">
                          {getConfidenceBadge(confidence)}
                        </div>
                      )}
                    </div>
                  </div>
                  {hasLowConfidence && (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                
                <div className="mt-2">
                  {renderFieldValue(field)}
                </div>
                
                {hasLowConfidence && (
                  <p className="mt-2 text-xs text-yellow-700 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Low confidence - please review
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Confidence Score Summary */}
        <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">AI Extraction Quality</h3>
              <p className="text-sm text-blue-700 mb-4">
                Fields with low confidence scores (below 70%) are highlighted and should be manually reviewed for accuracy.
              </p>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-gray-700">
                    <strong>
                      {Object.entries(initialData).filter(([key, val]) => {
                        const conf = extractConfidence(val);
                        return conf && conf >= 0.9;
                      }).length}
                    </strong> High Confidence
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-gray-700">
                    <strong>
                      {Object.entries(initialData).filter(([key, val]) => {
                        const conf = extractConfidence(val);
                        return conf && conf >= 0.7 && conf < 0.9;
                      }).length}
                    </strong> Medium Confidence
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-gray-700">
                    <strong>
                      {Object.entries(initialData).filter(([key, val]) => {
                        const conf = extractConfidence(val);
                        return conf && conf < 0.7;
                      }).length}
                    </strong> Needs Review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderFieldInput = (field: any) => {
    const currentValue = formData[field.key];

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={currentValue || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className="text-sm"
            rows={3}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
      
      case 'select':
        return (
          <Select
            value={currentValue || ''}
            onValueChange={(value) => setFormData({ ...formData, [field.key]: value })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case 'date':
        return (
          <Input
            type="date"
            value={currentValue ? new Date(currentValue).toISOString().split('T')[0] : ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className="text-sm"
          />
        );
      
      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={currentValue || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
            className="text-sm"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
      
      case 'array':
        return (
          <Input
            value={Array.isArray(currentValue) ? currentValue.join(', ') : ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value.split(',').map((s: string) => s.trim()) })}
            className="text-sm"
            placeholder="Comma-separated values"
          />
        );
      
      default:
        return (
          <Input
            value={currentValue || ''}
            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
            className="text-sm"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="space-y-6 border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Edit2 className="h-5 w-5 text-blue-600" />
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Editing Contract Metadata
          </span>
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
            className="hover:bg-gray-100"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 pb-4 border-b">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                activeCategory === cat.id &&
                  'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md'
              )}
            >
              <Icon className="h-4 w-4 mr-2" />
              {cat.label}
            </Button>
          );
        })}
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFields.map((field) => {
          const Icon = field.icon || FileText;
          const confidence = extractConfidence(initialData[field.key as keyof typeof initialData]);
          const hasLowConfidence = confidence && confidence < 0.7;
          
          return (
            <div
              key={field.key}
              className={cn(
                'p-4 rounded-xl border-2 transition-all',
                hasLowConfidence
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-blue-200 bg-white',
                'hover:border-blue-400 hover:shadow-md'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    hasLowConfidence ? 'bg-yellow-200' : 'bg-blue-100'
                  )}>
                    <Icon className={cn(
                      'h-4 w-4',
                      hasLowConfidence ? 'text-yellow-700' : 'text-blue-600'
                    )} />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    {confidence && (
                      <div className="mt-1">
                        {getConfidenceBadge(confidence)}
                      </div>
                    )}
                  </div>
                </div>
                {hasLowConfidence && (
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                )}
              </div>
              
              <div className="mt-2">
                {renderFieldInput(field)}
              </div>
              
              {hasLowConfidence && (
                <p className="mt-2 text-xs text-yellow-700 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Low confidence - please verify this value
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm text-blue-700 mt-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
        <Check className="h-4 w-4" />
        <span>Changes will be saved to the database and tracked in audit logs</span>
      </div>
    </div>
  );
}

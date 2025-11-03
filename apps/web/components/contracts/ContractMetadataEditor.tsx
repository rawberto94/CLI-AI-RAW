/**
 * Contract Metadata Inline Editor
 * Allows editing contract metadata fields with optimistic updates
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2, Save, X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { logError, logUserAction } from '@/lib/logger';

interface ContractMetadataEditorProps {
  contractId: string;
  initialData: {
    contractTitle?: string;
    description?: string;
    clientName?: string;
    supplierName?: string;
    contractType?: string;
    category?: string;
    categoryL1?: string;
    categoryL2?: string;
    totalValue?: number;
    currency?: string;
    effectiveDate?: string;
    expirationDate?: string;
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
  const toast = useToast();
  
  const [formData, setFormData] = useState(initialData);

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
          updatedBy: 'user' // TODO: Get from auth context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }

      const result = await response.json();
      
      const duration = performance.now() - startTime;
      logUserAction('contract-metadata-edit-success', duration, { contractId });
      
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
    setFormData(initialData);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Contract Information</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Title</p>
            <p className="font-medium">{initialData.contractTitle || 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium">{initialData.contractType || 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-500">Client</p>
            <p className="font-medium">{initialData.clientName || 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-500">Supplier</p>
            <p className="font-medium">{initialData.supplierName || 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Value</p>
            <p className="font-medium">
              {initialData.totalValue 
                ? `${initialData.currency || 'USD'} ${initialData.totalValue.toLocaleString()}`
                : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Category</p>
            <p className="font-medium">{initialData.category || 'Not set'}</p>
          </div>
        </div>
        
        {initialData.description && (
          <div>
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-sm mt-1">{initialData.description}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 border-2 border-blue-200 rounded-lg p-6 bg-blue-50/50">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Edit2 className="h-5 w-5 text-blue-600" />
          Editing Contract Information
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="contractTitle">Contract Title</Label>
          <Input
            id="contractTitle"
            value={formData.contractTitle || ''}
            onChange={(e) => setFormData({ ...formData, contractTitle: e.target.value })}
            placeholder="Enter contract title"
          />
        </div>

        <div>
          <Label htmlFor="clientName">Client Name</Label>
          <Input
            id="clientName"
            value={formData.clientName || ''}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            placeholder="Enter client name"
          />
        </div>

        <div>
          <Label htmlFor="supplierName">Supplier Name</Label>
          <Input
            id="supplierName"
            value={formData.supplierName || ''}
            onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
            placeholder="Enter supplier name"
          />
        </div>

        <div>
          <Label htmlFor="contractType">Contract Type</Label>
          <Select
            value={formData.contractType || ''}
            onValueChange={(value) => setFormData({ ...formData, contractType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MSA">Master Service Agreement</SelectItem>
              <SelectItem value="SOW">Statement of Work</SelectItem>
              <SelectItem value="NDA">Non-Disclosure Agreement</SelectItem>
              <SelectItem value="SLA">Service Level Agreement</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category || ''}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Enter category"
          />
        </div>

        <div>
          <Label htmlFor="totalValue">Total Value</Label>
          <Input
            id="totalValue"
            type="number"
            value={formData.totalValue || ''}
            onChange={(e) => setFormData({ ...formData, totalValue: parseFloat(e.target.value) || 0 })}
            placeholder="Enter total value"
          />
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={formData.currency || 'USD'}
            onValueChange={(value) => setFormData({ ...formData, currency: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="CHF">CHF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
            rows={3}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mt-4 p-3 bg-blue-100 rounded">
        <Check className="h-4 w-4" />
        <span>Changes will be saved to the database and tracked in audit logs</span>
      </div>
    </div>
  );
}

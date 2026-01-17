'use client'

import React, { useState } from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import {
  Upload,
  Download,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  AlertTriangle
} from 'lucide-react'

interface Contract {
  id: string
  name: string
  supplier: string
  value: number
  status: string
  selected: boolean
}

export function BulkOperations() {
  const { dataMode, isRealData } = useDataMode()
  const [contracts, setContracts] = useState<Contract[]>([
    { id: '1', name: 'Software Dev Agreement', supplier: 'TechCorp', value: 1250000, status: 'Active', selected: false },
    { id: '2', name: 'Consulting Services', supplier: 'ConsultPro', value: 850000, status: 'Active', selected: false },
    { id: '3', name: 'Cloud Infrastructure', supplier: 'CloudHost', value: 450000, status: 'Pending', selected: false },
    { id: '4', name: 'Marketing Services', supplier: 'AdAgency', value: 320000, status: 'Active', selected: false },
    { id: '5', name: 'Legal Services', supplier: 'LawFirm', value: 180000, status: 'Expired', selected: false }
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const selectedCount = contracts.filter(c => c.selected).length
  const selectedValue = contracts.filter(c => c.selected).reduce((sum, c) => sum + c.value, 0)

  const toggleSelect = (id: string) => {
    setContracts(prev => prev.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  const toggleSelectAll = () => {
    const allSelected = contracts.every(c => c.selected)
    setContracts(prev => prev.map(c => ({ ...c, selected: !allSelected })))
  }

  const performBulkOperation = async (op: 'export' | 'update' | 'delete') => {
    if (selectedCount === 0) return

    setIsProcessing(true)
    setOperation(op)

    try {
      if (isRealData) {
        const selectedIds = contracts.filter(c => c.selected).map(c => c.id)
        const response = await fetch('/api/contracts/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-data-mode': dataMode
          },
          body: JSON.stringify({
            operation: op,
            contractIds: selectedIds
          })
        })

        if (!response.ok) throw new Error('Operation failed')
      } else {
        // Mock operation
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Show success
      toast.success(`Successfully ${op}ed ${selectedCount} contracts`)

      // Clear selection
      setContracts(prev => prev.map(c => ({ ...c, selected: false })))
    } catch {
      toast.error('Operation failed. Please try again.')
    } finally {
      setIsProcessing(false)
      setOperation(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Operations</h2>
          <p className="text-gray-500 mt-1">
            Select and process multiple contracts at once
          </p>
        </div>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-4 py-2">
              {selectedCount} selected
            </Badge>
            <Badge className="text-base px-4 py-2">
              ${selectedValue.toLocaleString()}
            </Badge>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-blue-900">
                {selectedCount} contract{selectedCount > 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performBulkOperation('export')}
                  disabled={isProcessing}
                >
                  {isProcessing && operation === 'export' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performBulkOperation('update')}
                  disabled={isProcessing}
                >
                  {isProcessing && operation === 'update' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Edit className="h-4 w-4 mr-2" />
                  )}
                  Update
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isProcessing}
                >
                  {isProcessing && operation === 'delete' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>

                <ConfirmDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                  title="Delete Contracts"
                  description={`Are you sure you want to delete ${selectedCount} contracts? This action cannot be undone.`}
                  confirmLabel="Delete All"
                  variant="destructive"
                  isLoading={isProcessing && operation === 'delete'}
                  onConfirm={() => performBulkOperation('delete')}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contracts</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={contracts.every(c => c.selected)}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                  contract.selected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <Checkbox
                  checked={contract.selected}
                  onCheckedChange={() => toggleSelect(contract.id)}
                />
                <FileText className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <h4 className="font-medium">{contract.name}</h4>
                  <p className="text-sm text-gray-500">{contract.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${contract.value.toLocaleString()}</p>
                  <Badge
                    variant={
                      contract.status === 'Active' ? 'default' :
                      contract.status === 'Pending' ? 'secondary' :
                      'destructive'
                    }
                    className="mt-1"
                  >
                    {contract.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="font-medium mb-2">Upload multiple contracts</p>
            <p className="text-sm text-gray-500 mb-4">
              Drag & drop up to 50 files or click to browse
            </p>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Select Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Important</p>
              <p className="text-sm text-yellow-700 mt-1">
                Bulk operations cannot be undone. Please review your selection carefully before proceeding.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

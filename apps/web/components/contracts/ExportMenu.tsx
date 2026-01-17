'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileText, Table, Code, Loader2 } from 'lucide-react'
import { useDataMode } from '@/contexts/DataModeContext'
import { toast } from 'sonner'

interface ExportMenuProps {
  contractId: string
  contractName?: string
}

export function ExportMenu({ contractId, contractName }: ExportMenuProps) {
  const { dataMode } = useDataMode()
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState<string | null>(null)

  const handleExport = async (type: 'pdf' | 'excel' | 'json') => {
    setIsExporting(true)
    setExportType(type)

    try {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 2000))

      // In real mode, call actual API
      if (dataMode === 'real') {
        const response = await fetch(`/api/contracts/${contractId}/export?format=${type}`, {
          headers: {
            'x-data-mode': dataMode
          }
        })
        
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${contractName || contractId}.${type === 'excel' ? 'xlsx' : type}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } else {
        // Mock/AI mode - show success message
        toast.success(`Export to ${type.toUpperCase()} completed (${dataMode} mode)`)
      }
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
      setExportType(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          <div className="flex-1">
            <p className="font-medium">PDF Document</p>
            <p className="text-xs text-gray-500">Formatted report</p>
          </div>
          {exportType === 'pdf' && <Loader2 className="h-4 w-4 animate-spin" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <Table className="h-4 w-4 mr-2 text-green-600" />
          <div className="flex-1">
            <p className="font-medium">Excel Spreadsheet</p>
            <p className="text-xs text-gray-500">All data & artifacts</p>
          </div>
          {exportType === 'excel' && <Loader2 className="h-4 w-4 animate-spin" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport('json')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <Code className="h-4 w-4 mr-2 text-blue-600" />
          <div className="flex-1">
            <p className="font-medium">JSON Data</p>
            <p className="text-xs text-gray-500">API integration</p>
          </div>
          {exportType === 'json' && <Loader2 className="h-4 w-4 animate-spin" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-gray-500">
          Using {dataMode} data mode
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

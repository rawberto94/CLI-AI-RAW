'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, Table, FileSpreadsheet, Share2, Copy, CheckCircle } from 'lucide-react'
import type { RoleRate, Geography } from '@/lib/use-cases/enhanced-rate-benchmarking-data'
import {
  exportToCSV,
  exportToExcel,
  generatePDFContent,
  exportSummary,
  downloadCSV,
  downloadExcel,
  downloadPDF
} from '@/lib/use-cases/export-utils'

interface ExportDialogProps {
  roles: RoleRate[]
  geography: Geography
  supplierName?: string
  onClose?: () => void
}

export function ExportDialog({ roles, geography, supplierName, onClose }: ExportDialogProps) {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  const handleExportCSV = () => {
    setExporting(true)
    try {
      const csv = exportToCSV(roles, geography, supplierName)
      const filename = `chainiq-rate-benchmarking-${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(csv, filename)
    } finally {
      setExporting(false)
    }
  }
  
  const handleExportExcel = () => {
    setExporting(true)
    try {
      const excel = exportToExcel(roles, geography, supplierName)
      const filename = `chainiq-rate-benchmarking-${new Date().toISOString().split('T')[0]}.xlsx`
      downloadExcel(excel, filename)
    } finally {
      setExporting(false)
    }
  }
  
  const handleExportPDF = () => {
    setExporting(true)
    try {
      const pdf = generatePDFContent(roles, geography, supplierName)
      downloadPDF(pdf)
    } finally {
      setExporting(false)
    }
  }
  
  const handleCopySummary = async () => {
    const summary = exportSummary(roles, geography, supplierName)
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const totalSavings = roles.reduce((sum, r) => {
    const savings = (r.hourlyRate - r.chainIQBenchmark) * (r.fteCount || 1) * 2080
    return sum + savings
  }, 0)
  
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600" />
          Export ChainIQ Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600">Roles</div>
                <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Geography</div>
                <div className="text-lg font-bold text-gray-900">{geography.split(' - ')[0]}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Savings</div>
                <div className="text-2xl font-bold text-green-700">
                  ${(totalSavings / 1000).toFixed(0)}K
                </div>
              </div>
            </div>
          </div>
          
          {/* Export Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Choose Export Format:</h3>
            
            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Table className="w-5 h-5 text-green-700" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">CSV Export</div>
                  <div className="text-sm text-gray-600">
                    Spreadsheet format for data analysis
                  </div>
                </div>
              </div>
              <Badge variant="outline">Recommended</Badge>
            </button>
            
            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Excel Export</div>
                  <div className="text-sm text-gray-600">
                    Formatted spreadsheet with metadata
                  </div>
                </div>
              </div>
            </button>
            
            {/* PDF Export */}
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FileText className="w-5 h-5 text-red-700" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">PDF Report</div>
                  <div className="text-sm text-gray-600">
                    Professional report for stakeholders
                  </div>
                </div>
              </div>
              <Badge variant="outline">Executive</Badge>
            </button>
            
            {/* Copy Summary */}
            <button
              onClick={handleCopySummary}
              disabled={exporting}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  {copied ? (
                    <CheckCircle className="w-5 h-5 text-green-700" />
                  ) : (
                    <Copy className="w-5 h-5 text-purple-700" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">
                    {copied ? 'Copied!' : 'Copy Summary'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Quick text summary for emails
                  </div>
                </div>
              </div>
            </button>
          </div>
          
          {/* Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Share2 className="w-4 h-4 text-gray-600 mt-0.5" />
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Tip:</span> All exports include ChainIQ benchmarks, 
                percentiles, confidence scores, and savings calculations. Perfect for sharing with 
                procurement teams and executives.
              </div>
            </div>
          </div>
          
          {/* Actions */}
          {onClose && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

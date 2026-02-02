'use client'

import React, { memo, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  X,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Shield,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  Layers,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface ContractForComparison {
  id: string
  title?: string
  type?: string
  status: string
  parties?: {
    client?: string
    supplier?: string
  }
  value?: number
  effectiveDate?: string
  expirationDate?: string
  signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  riskScore?: number
  category?: { name: string }
  documentClassification?: string
  terms?: {
    paymentTerms?: string
    terminationClause?: boolean
    autoRenewal?: boolean
    confidentiality?: boolean
    liability?: string
    indemnification?: boolean
    governingLaw?: string
  }
  obligations?: Array<{ description: string; dueDate?: string; status?: string }>
}

interface ContractComparisonDialogProps {
  contracts: ContractForComparison[]
  isOpen: boolean
  onClose: () => void
  onViewContract?: (contractId: string) => void
  onDownloadComparison?: () => void
  formatCurrency?: (value?: number) => string
  formatDate?: (date?: string) => string
}

const ComparisonValue = memo(function ComparisonValue({
  value,
  isHighlight,
  isBest,
  isWorst,
  className,
}: {
  value: React.ReactNode
  isHighlight?: boolean
  isBest?: boolean
  isWorst?: boolean
  className?: string
}) {
  return (
    <div className={cn(
      "p-3 rounded-lg border text-center min-h-[60px] flex items-center justify-center",
      isHighlight && "bg-violet-50 border-violet-200",
      isBest && "bg-emerald-50 border-emerald-200",
      isWorst && "bg-red-50 border-red-200",
      !isHighlight && !isBest && !isWorst && "bg-slate-50 border-slate-100",
      className
    )}>
      {value}
    </div>
  )
})

const ComparisonRow = memo(function ComparisonRow({
  label,
  icon: Icon,
  values,
  compareMode = 'none', // 'higher-better' | 'lower-better' | 'equal' | 'none'
}: {
  label: string
  icon?: React.ElementType
  values: Array<{
    value: React.ReactNode
    raw?: number | string | boolean
  }>
  compareMode?: 'higher-better' | 'lower-better' | 'equal' | 'none'
}) {
  // Calculate best/worst for numeric comparisons
  const bestIndex = useMemo(() => {
    if (compareMode === 'none') return -1
    const numericValues = values.map(v => typeof v.raw === 'number' ? v.raw : null)
    if (numericValues.every(v => v === null)) return -1
    
    if (compareMode === 'higher-better') {
      const max = Math.max(...numericValues.filter((v): v is number => v !== null))
      return numericValues.findIndex(v => v === max)
    } else if (compareMode === 'lower-better') {
      const min = Math.min(...numericValues.filter((v): v is number => v !== null && v > 0))
      return numericValues.findIndex(v => v === min)
    }
    return -1
  }, [values, compareMode])

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `180px repeat(${values.length}, 1fr)` }}>
      <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-100">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {values.map((v, idx) => (
        <ComparisonValue
          key={idx}
          value={v.value}
          isBest={idx === bestIndex && compareMode !== 'none'}
        />
      ))}
    </div>
  )
})

export const ContractComparisonDialog = memo(function ContractComparisonDialog({
  contracts,
  isOpen,
  onClose,
  onViewContract,
  onDownloadComparison,
  formatCurrency = (v) => v !== undefined ? `$${v.toLocaleString()}` : '—',
  formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—',
}: ContractComparisonDialogProps) {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    financial: true,
    dates: true,
    status: true,
    terms: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Calculate derived values for comparison
  const derivedData = useMemo(() => {
    return contracts.map(c => {
      const now = new Date()
      const expDate = c.expirationDate ? new Date(c.expirationDate) : null
      const effectiveDate = c.effectiveDate ? new Date(c.effectiveDate) : null
      
      let daysRemaining: number | null = null
      if (expDate) {
        daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      }
      
      let durationMonths: number | null = null
      if (effectiveDate && expDate) {
        durationMonths = Math.round((expDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      }
      
      return {
        ...c,
        daysRemaining,
        durationMonths,
      }
    })
  }, [contracts])

  if (!isOpen || contracts.length < 2) return null

  const getSignatureStatusBadge = (status?: string) => {
    switch (status) {
      case 'signed':
        return <Badge className="text-xs bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Signed</Badge>
      case 'partially_signed':
        return <Badge className="text-xs bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Partial</Badge>
      case 'unsigned':
        return <Badge className="text-xs bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Unsigned</Badge>
      default:
        return <span className="text-slate-400">—</span>
    }
  }

  const getRiskBadge = (score?: number) => {
    if (score === undefined) return <span className="text-slate-400">—</span>
    if (score >= 70) return <Badge className="text-xs bg-red-100 text-red-700"><Shield className="h-3 w-3 mr-1" />High ({score})</Badge>
    if (score >= 40) return <Badge className="text-xs bg-amber-100 text-amber-700"><Shield className="h-3 w-3 mr-1" />Medium ({score})</Badge>
    return <Badge className="text-xs bg-emerald-100 text-emerald-700"><Shield className="h-3 w-3 mr-1" />Low ({score})</Badge>
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                    Contract Comparison
                  </h2>
                  <p className="text-sm text-slate-500">
                    Comparing {contracts.length} contracts
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onDownloadComparison && (
                  <Button size="sm" variant="outline" onClick={onDownloadComparison}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Export
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onClose} className="h-9 w-9 p-0">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <ScrollArea className="flex-1 p-4 sm:p-6">
            <div className="space-y-6">
              {/* Contract Headers */}
              <div className="grid gap-3" style={{ gridTemplateColumns: `180px repeat(${contracts.length}, 1fr)` }}>
                <div className="p-3" /> {/* Empty cell for row labels */}
                {contracts.map((contract, idx) => (
                  <Card key={contract.id} className={cn(
                    "border-2 transition-colors",
                    idx === 0 && "border-violet-200 bg-violet-50/30",
                    idx === 1 && "border-blue-200 bg-blue-50/30",
                    idx === 2 && "border-emerald-200 bg-emerald-50/30"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn(
                              "p-1.5 rounded-lg",
                              idx === 0 && "bg-violet-100",
                              idx === 1 && "bg-blue-100",
                              idx === 2 && "bg-emerald-100"
                            )}>
                              <FileText className={cn(
                                "h-4 w-4",
                                idx === 0 && "text-violet-600",
                                idx === 1 && "text-blue-600",
                                idx === 2 && "text-emerald-600"
                              )} />
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              Contract {idx + 1}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-slate-900 truncate text-sm">
                            {contract.title || 'Untitled'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {contract.type || 'Contract'}
                          </p>
                        </div>
                        {onViewContract && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewContract(contract.id)}
                            className="h-8 w-8 p-0 flex-shrink-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Basic Information */}
              <Collapsible open={expandedSections.basic} onOpenChange={() => toggleSection('basic')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-slate-50">
                    <span className="font-medium text-slate-900">Basic Information</span>
                    {expandedSections.basic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <ComparisonRow
                    label="Type"
                    icon={FileText}
                    values={contracts.map(c => ({
                      value: <span className="text-sm font-medium">{c.type || '—'}</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Category"
                    values={contracts.map(c => ({
                      value: c.category ? (
                        <Badge variant="secondary" className="text-xs">{c.category.name}</Badge>
                      ) : <span className="text-slate-400">—</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Client"
                    icon={Building2}
                    values={contracts.map(c => ({
                      value: <span className="text-sm">{c.parties?.client || '—'}</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Supplier"
                    icon={Building2}
                    values={contracts.map(c => ({
                      value: <span className="text-sm">{c.parties?.supplier || '—'}</span>
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
              
              {/* Financial */}
              <Collapsible open={expandedSections.financial} onOpenChange={() => toggleSection('financial')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-slate-50">
                    <span className="font-medium text-slate-900">Financial</span>
                    {expandedSections.financial ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <ComparisonRow
                    label="Contract Value"
                    icon={DollarSign}
                    compareMode="higher-better"
                    values={contracts.map(c => ({
                      value: <span className={cn(
                        "text-sm font-bold",
                        c.value ? "text-slate-900" : "text-slate-400"
                      )}>{formatCurrency(c.value)}</span>,
                      raw: c.value
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
              
              {/* Dates */}
              <Collapsible open={expandedSections.dates} onOpenChange={() => toggleSection('dates')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-slate-50">
                    <span className="font-medium text-slate-900">Dates & Duration</span>
                    {expandedSections.dates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <ComparisonRow
                    label="Effective Date"
                    icon={Calendar}
                    values={contracts.map(c => ({
                      value: <span className="text-sm">{formatDate(c.effectiveDate)}</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Expiration Date"
                    icon={Calendar}
                    values={derivedData.map(c => ({
                      value: (
                        <div className="text-center">
                          <span className={cn(
                            "text-sm",
                            c.daysRemaining !== null && c.daysRemaining < 0 && "text-red-600 font-medium",
                            c.daysRemaining !== null && c.daysRemaining > 0 && c.daysRemaining <= 30 && "text-amber-600"
                          )}>
                            {formatDate(c.expirationDate)}
                          </span>
                          {c.daysRemaining !== null && c.daysRemaining < 0 && (
                            <Badge className="text-[9px] bg-red-100 text-red-700 mt-1 block mx-auto w-fit">Expired</Badge>
                          )}
                        </div>
                      )
                    }))}
                  />
                  <ComparisonRow
                    label="Days Remaining"
                    icon={Clock}
                    compareMode="higher-better"
                    values={derivedData.map(c => ({
                      value: (
                        <span className={cn(
                          "text-sm font-medium",
                          c.daysRemaining === null && "text-slate-400",
                          c.daysRemaining !== null && c.daysRemaining < 0 && "text-red-600",
                          c.daysRemaining !== null && c.daysRemaining > 0 && c.daysRemaining <= 30 && "text-amber-600",
                          c.daysRemaining !== null && c.daysRemaining > 30 && "text-slate-900"
                        )}>
                          {c.daysRemaining !== null ? `${c.daysRemaining} days` : '—'}
                        </span>
                      ),
                      raw: c.daysRemaining ?? undefined
                    }))}
                  />
                  <ComparisonRow
                    label="Duration"
                    icon={Clock}
                    values={derivedData.map(c => ({
                      value: <span className="text-sm">{c.durationMonths ? `${c.durationMonths} months` : '—'}</span>
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
              
              {/* Status */}
              <Collapsible open={expandedSections.status} onOpenChange={() => toggleSection('status')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-slate-50">
                    <span className="font-medium text-slate-900">Status & Risk</span>
                    {expandedSections.status ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <ComparisonRow
                    label="Status"
                    values={contracts.map(c => ({
                      value: (
                        <Badge className={cn(
                          "text-xs",
                          c.status === 'active' && "bg-emerald-100 text-emerald-700",
                          c.status === 'draft' && "bg-slate-100 text-slate-600",
                          c.status === 'expired' && "bg-red-100 text-red-700"
                        )}>
                          {c.status?.charAt(0).toUpperCase() + c.status?.slice(1)}
                        </Badge>
                      )
                    }))}
                  />
                  <ComparisonRow
                    label="Signature"
                    icon={FileSignature}
                    values={contracts.map(c => ({
                      value: getSignatureStatusBadge(c.signatureStatus)
                    }))}
                  />
                  <ComparisonRow
                    label="Risk Level"
                    icon={Shield}
                    compareMode="lower-better"
                    values={contracts.map(c => ({
                      value: getRiskBadge(c.riskScore),
                      raw: c.riskScore
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
              
              {/* Contract Terms */}
              <Collapsible open={expandedSections.terms} onOpenChange={() => toggleSection('terms')}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-3 h-auto hover:bg-slate-50">
                    <span className="font-medium text-slate-900">Contract Terms</span>
                    {expandedSections.terms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <ComparisonRow
                    label="Auto Renewal"
                    values={contracts.map(c => ({
                      value: c.terms?.autoRenewal !== undefined ? (
                        c.terms.autoRenewal ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700">Yes</Badge>
                        ) : (
                          <Badge className="text-xs bg-slate-100 text-slate-600">No</Badge>
                        )
                      ) : <span className="text-slate-400">—</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Confidentiality"
                    values={contracts.map(c => ({
                      value: c.terms?.confidentiality !== undefined ? (
                        c.terms.confidentiality ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700">Yes</Badge>
                        ) : (
                          <Badge className="text-xs bg-slate-100 text-slate-600">No</Badge>
                        )
                      ) : <span className="text-slate-400">—</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Termination"
                    values={contracts.map(c => ({
                      value: c.terms?.terminationClause !== undefined ? (
                        c.terms.terminationClause ? (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700">Included</Badge>
                        ) : (
                          <Badge className="text-xs bg-amber-100 text-amber-700">Not Included</Badge>
                        )
                      ) : <span className="text-slate-400">—</span>
                    }))}
                  />
                  <ComparisonRow
                    label="Governing Law"
                    values={contracts.map(c => ({
                      value: <span className="text-sm">{c.terms?.governingLaw || '—'}</span>
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                <span className="text-emerald-600 font-medium">● Green</span> = Best value for comparison
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
})

export default ContractComparisonDialog

'use client'

/**
 * Quick Contract Compare
 * 
 * A floating widget for quick side-by-side contract comparison.
 * Supports drag-and-drop selection and keyboard shortcuts.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  GitCompare,
  X,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export interface CompareContract {
  id: string
  name: string
  supplier?: string
  type?: string
  status?: string
  value?: number
}

interface ContractCompareProps {
  contracts?: CompareContract[]
  onCompare?: (contractA: string, contractB: string) => void
  onClear?: () => void
  showKeyboardHint?: boolean
  className?: string
}

interface ComparisonSlotProps {
  contract?: CompareContract
  position: 'A' | 'B'
  onRemove: () => void
  onSelect: () => void
  isEmpty: boolean
}

// ============ HELPER FUNCTIONS ============

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ============ SUB-COMPONENTS ============

function ComparisonSlot({ contract, position, onRemove, onSelect, isEmpty }: ComparisonSlotProps) {
  return (
    <motion.div
      className={cn(
        "relative flex-1 min-w-0 rounded-lg border-2 border-dashed transition-all",
        isEmpty
          ? "border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer"
          : "border-slate-300 bg-white"
      )}
      onClick={isEmpty ? onSelect : undefined}
      whileHover={isEmpty ? { scale: 1.02 } : {}}
      whileTap={isEmpty ? { scale: 0.98 } : {}}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center p-4 text-slate-400">
          <Plus className="h-6 w-6 mb-1" />
          <span className="text-xs font-medium">Contract {position}</span>
          <span className="text-[10px]">Click to select</span>
        </div>
      ) : (
        <div className="p-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] mb-1",
                  position === 'A' ? "border-indigo-200 text-violet-600" : "border-violet-200 text-violet-600"
                )}
              >
                Contract {position}
              </Badge>
              <p className="text-sm font-medium text-slate-900 truncate">
                {contract?.name}
              </p>
              {contract?.supplier && (
                <p className="text-xs text-slate-500 truncate">{contract.supplier}</p>
              )}
              {contract?.value && (
                <p className="text-xs text-slate-500 mt-1">
                  {formatCurrency(contract.value)}
                </p>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ============ CONTRACT SELECTOR DIALOG ============

interface ContractSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (contract: CompareContract) => void
  availableContracts: CompareContract[]
  excludeId?: string
  position: 'A' | 'B'
}

function ContractSelector({ 
  open, 
  onClose, 
  onSelect, 
  availableContracts, 
  excludeId,
  position 
}: ContractSelectorProps) {
  const [search, setSearch] = useState('')
  
  const filteredContracts = availableContracts.filter(c => 
    c.id !== excludeId &&
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
     c.supplier?.toLowerCase().includes(search.toLowerCase()))
  )
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-500" />
            Select Contract {position}
          </DialogTitle>
          <DialogDescription>
            Choose a contract to compare
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {filteredContracts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No contracts found</p>
              </div>
            ) : (
              filteredContracts.map(contract => (
                <button
                  key={contract.id}
                  onClick={() => {
                    onSelect(contract)
                    onClose()
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-violet-50/50 transition-all"
                >
                  <p className="text-sm font-medium text-slate-900">{contract.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {contract.supplier && <span>{contract.supplier}</span>}
                    {contract.value && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>{formatCurrency(contract.value)}</span>
                      </>
                    )}
                    {contract.type && (
                      <>
                        <span className="text-slate-300">•</span>
                        <Badge variant="secondary" className="text-[10px]">{contract.type}</Badge>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ============ MAIN COMPONENT ============

export function ContractCompareWidget({
  contracts = [],
  onCompare,
  onClear,
  showKeyboardHint = true,
  className,
}: ContractCompareProps) {
  const [contractA, setContractA] = useState<CompareContract | undefined>()
  const [contractB, setContractB] = useState<CompareContract | undefined>()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectingFor, setSelectingFor] = useState<'A' | 'B'>('A')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  
  // Handle keyboard shortcut (Ctrl/Cmd + Shift + C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
        e.preventDefault()
        setIsExpanded(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Open selector
  const openSelector = useCallback((position: 'A' | 'B') => {
    setSelectingFor(position)
    setSelectorOpen(true)
  }, [])
  
  // Handle contract selection
  const handleSelect = useCallback((contract: CompareContract) => {
    if (selectingFor === 'A') {
      setContractA(contract)
    } else {
      setContractB(contract)
    }
  }, [selectingFor])
  
  // Swap contracts
  const swapContracts = useCallback(() => {
    setContractA(contractB)
    setContractB(contractA)
  }, [contractA, contractB])
  
  // Clear all
  const clearAll = useCallback(() => {
    setContractA(undefined)
    setContractB(undefined)
    onClear?.()
  }, [onClear])
  
  // Start comparison
  const handleCompare = useCallback(async () => {
    if (!contractA || !contractB) return
    
    setIsComparing(true)
    try {
      onCompare?.(contractA.id, contractB.id)
      // Navigation would happen via onCompare callback
    } finally {
      setIsComparing(false)
    }
  }, [contractA, contractB, onCompare])
  
  const canCompare = contractA && contractB
  
  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div key="ContractCompareWidget-ap-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn("fixed bottom-6 right-6 z-40", className)}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsExpanded(true)}
                    className="h-12 w-12 rounded-full shadow-lg bg-violet-600 hover:bg-violet-700"
                  >
                    <GitCompare className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Compare Contracts</p>
                  {showKeyboardHint && (
                    <p className="text-[10px] text-slate-400">⌘⇧C</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Badge if contracts selected */}
            {(contractA || contractB) && (
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-amber-500 rounded-full flex items-center justify-center text-xs text-white font-medium">
                {[contractA, contractB].filter(Boolean).length}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Expanded compare panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div key="expanded"
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                <span className="font-medium">Compare Contracts</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4">
              {/* Comparison slots */}
              <div className="flex gap-3 items-stretch">
                <ComparisonSlot
                  contract={contractA}
                  position="A"
                  isEmpty={!contractA}
                  onRemove={() => setContractA(undefined)}
                  onSelect={() => openSelector('A')}
                />
                
                {/* Swap button */}
                <div className="flex items-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={swapContracts}
                          disabled={!contractA && !contractB}
                          className="p-2 text-slate-400 hover:text-violet-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Swap contracts</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <ComparisonSlot
                  contract={contractB}
                  position="B"
                  isEmpty={!contractB}
                  onRemove={() => setContractB(undefined)}
                  onSelect={() => openSelector('B')}
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={!contractA && !contractB}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                
                <Button
                  size="sm"
                  onClick={handleCompare}
                  disabled={!canCompare || isComparing}
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                  asChild={canCompare && !isComparing}
                >
                  {canCompare && !isComparing ? (
                    <Link href={`/contracts/compare?a=${contractA?.id}&b=${contractB?.id}`}>
                      {isComparing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Compare
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  ) : (
                    <>
                      {isComparing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Compare
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
              
              {/* Keyboard hint */}
              {showKeyboardHint && (
                <p className="text-center text-[10px] text-slate-400 mt-3">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">⌘⇧C</kbd> to toggle
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Contract selector dialog */}
      <ContractSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelect}
        availableContracts={contracts}
        excludeId={selectingFor === 'A' ? contractB?.id : contractA?.id}
        position={selectingFor}
      />
    </>
  )
}

// ============ DEMO DATA ============

export function generateDemoContracts(count: number = 10): CompareContract[] {
  const contractTypes = ['SaaS', 'License', 'Service', 'Maintenance', 'Subscription']
  const statuses = ['Active', 'Pending', 'Expiring', 'Draft']
  
  const templates = [
    { name: 'Microsoft Enterprise Agreement', supplier: 'Microsoft', value: 250000 },
    { name: 'AWS Services Contract', supplier: 'Amazon Web Services', value: 180000 },
    { name: 'Salesforce CRM License', supplier: 'Salesforce', value: 120000 },
    { name: 'Google Cloud Platform', supplier: 'Google', value: 95000 },
    { name: 'Adobe Creative Cloud', supplier: 'Adobe', value: 45000 },
    { name: 'Slack Enterprise Grid', supplier: 'Slack', value: 35000 },
    { name: 'Zoom Business License', supplier: 'Zoom', value: 28000 },
    { name: 'Atlassian Suite', supplier: 'Atlassian', value: 42000 },
    { name: 'ServiceNow ITSM', supplier: 'ServiceNow', value: 85000 },
    { name: 'Workday HCM', supplier: 'Workday', value: 150000 },
  ]
  
  return templates.slice(0, count).map((t, i) => ({
    id: `compare-${i}`,
    name: t.name,
    supplier: t.supplier,
    value: t.value,
    type: contractTypes[i % contractTypes.length],
    status: statuses[i % statuses.length],
  }))
}

export default ContractCompareWidget

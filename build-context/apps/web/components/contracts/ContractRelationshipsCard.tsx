'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
  Unlink,
  GitBranch,
  ExternalLink,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Building,
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  Info,
  Shield,
  Brain,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/design-tokens'
import { toast } from 'sonner'

// ============ TYPES ============

interface ParentContract {
  id: string
  title: string
  type: string | null
  status: string
  clientName: string | null
  supplierName: string | null
  effectiveDate: string | null
  expirationDate: string | null
}

interface ChildContract {
  id: string
  title: string
  type: string | null
  status: string
  relationshipType: string | null
  clientName: string | null
  supplierName: string | null
  effectiveDate: string | null
  expirationDate: string | null
  totalValue: number | null
  createdAt: string | null
}

interface SuggestedParent {
  id: string
  title: string
  score: number
  reason: string
}

interface FamilyHealthData {
  healthScore: number
  completeness: number
  issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    message: string
    contractId?: string
    action?: string
  }>
  suggestedParents: SuggestedParent[]
  totalContracts: number
  totalValue: number
}

interface ContractRelationshipsCardProps {
  contractId: string
  contractTitle?: string
  parentContract?: ParentContract | null
  childContracts?: ChildContract[]
  parentContractId?: string | null
  relationshipType?: string | null
  relationshipNote?: string | null
  linkedAt?: string | null
  onLinkParent?: (parentId: string, relationshipType: string, note?: string) => Promise<void>
  onUnlinkParent?: () => Promise<void>
  isEditing?: boolean
  className?: string
}

// Relationship type options
const RELATIONSHIP_TYPES = [
  { value: 'SOW_UNDER_MSA', label: 'Statement of Work (under MSA)', description: 'A specific work scope under a master agreement' },
  { value: 'AMENDMENT', label: 'Amendment', description: 'Modification to an existing contract' },
  { value: 'ADDENDUM', label: 'Addendum', description: 'Additional terms added to a contract' },
  { value: 'RENEWAL', label: 'Renewal', description: 'Continuation of an expiring contract' },
  { value: 'CHANGE_ORDER', label: 'Change Order', description: 'Changes to scope, timeline, or cost' },
  { value: 'SUPPLEMENT', label: 'Supplement', description: 'Supplementary terms or conditions' },
  { value: 'EXTENSION', label: 'Extension', description: 'Time extension for existing contract' },
  { value: 'SCHEDULE', label: 'Schedule', description: 'Specific schedule under framework agreement' },
  { value: 'OTHER', label: 'Other Related Document', description: 'Other type of relationship' },
]

// ============ HELPER FUNCTIONS ============

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'active':
      return 'bg-green-500/10 text-green-700 border-green-200'
    case 'processing':
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
    case 'failed':
    case 'expired':
      return 'bg-red-500/10 text-red-700 border-red-200'
    default:
      return 'bg-violet-500/10 text-violet-700 border-violet-200'
  }
}

const getHealthColor = (score: number) => {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

const getHealthBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-500/10 border-green-200'
  if (score >= 60) return 'bg-amber-500/10 border-amber-200'
  return 'bg-red-500/10 border-red-200'
}

const getRelationshipLabel = (type: string | null) => {
  if (!type) return 'Related'
  return RELATIONSHIP_TYPES.find(r => r.value === type)?.label || type.replace(/_/g, ' ')
}

// ============ CONTRACT CARD COMPONENT ============

interface ContractLinkCardProps {
  contract: ParentContract | ChildContract
  direction: 'parent' | 'child'
  relationshipType?: string | null
  onUnlink?: () => void
  isUnlinking?: boolean
  canUnlink?: boolean
}

function ContractLinkCard({ 
  contract, 
  direction, 
  relationshipType, 
  onUnlink, 
  isUnlinking, 
  canUnlink 
}: ContractLinkCardProps) {
  const isChild = direction === 'child'
  const childContract = contract as ChildContract
  
  return (
    <div className="group relative flex items-center gap-3 p-4 rounded-xl border bg-gradient-to-r from-white to-slate-50 hover:shadow-md transition-all">
      {/* Direction indicator */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
        direction === 'parent' 
          ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white" 
          : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
      )}>
        {direction === 'parent' ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
      </div>
      
      {/* Contract info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link 
            href={`/contracts/${contract.id}`}
            className="font-semibold text-sm text-slate-900 hover:text-violet-600 transition-colors truncate"
          >
            {contract.title}
          </Link>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {contract.type && (
            <Badge variant="outline" className="text-xs font-medium">
              {contract.type}
            </Badge>
          )}
          {(isChild ? childContract.relationshipType : relationshipType) && (
            <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 border-violet-200">
              {getRelationshipLabel(isChild ? childContract.relationshipType : relationshipType)}
            </Badge>
          )}
          <Badge className={cn("text-xs", getStatusColor(contract.status))}>
            {contract.status}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          {(contract.clientName || contract.supplierName) && (
            <span className="flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              {contract.clientName || contract.supplierName}
            </span>
          )}
          {contract.effectiveDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(contract.effectiveDate)}
            </span>
          )}
          {isChild && childContract.totalValue && (
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <DollarSign className="h-3.5 w-3.5" />
              {formatCurrency(childContract.totalValue)}
            </span>
          )}
        </div>
      </div>
      
      {/* Unlink button */}
      {canUnlink && onUnlink && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="absolute top-2 right-2 h-7 w-7 p-0 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.preventDefault(); onUnlink(); }}
          disabled={isUnlinking}
        >
          {isUnlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
        </Button>
      )}
    </div>
  )
}

// ============ AI SUGGESTION CARD ============

interface AISuggestionCardProps {
  suggestion: SuggestedParent
  onLink: () => void
  isLinking?: boolean
}

function AISuggestionCard({ suggestion, onLink, isLinking }: AISuggestionCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-4 rounded-xl border-2 border-dashed border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 hover:border-violet-400 transition-all group"
    >
      <div className="absolute -top-2 -right-2">
        <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs px-2 py-0.5 shadow-sm">
          <Brain className="h-3 w-3 mr-1" />
          AI Suggestion
        </Badge>
      </div>
      
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <Link 
            href={`/contracts/${suggestion.id}`}
            className="font-semibold text-sm text-slate-900 hover:text-violet-600 transition-colors block truncate"
          >
            {suggestion.title}
          </Link>
          <p className="text-xs text-slate-600 mt-1">{suggestion.reason}</p>
          
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full"
                  style={{ width: `${suggestion.score}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-violet-600">{suggestion.score}% match</span>
            </div>
            
            <Button 
              size="sm" 
              onClick={onLink}
              disabled={isLinking}
              className="h-7 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-sm"
            >
              {isLinking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <LinkIcon className="h-3.5 w-3.5 mr-1" />
                  Link
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============ LINK PARENT DIALOG ============

interface LinkParentDialogProps {
  contractId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onLink: (parentId: string, relationshipType: string, note?: string) => Promise<void>
  suggestedParents?: SuggestedParent[]
}

function LinkParentDialog({ contractId, open, onOpenChange, onLink, suggestedParents = [] }: LinkParentDialogProps) {
  const [mode, setMode] = useState<'suggestions' | 'search'>('suggestions')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ParentContract[]>([])
  const [selectedParent, setSelectedParent] = useState<ParentContract | null>(null)
  const [relationshipType, setRelationshipType] = useState('SOW_UNDER_MSA')
  const [note, setNote] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const response = await fetch(`/api/contracts/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        const filtered = (data.contracts || data.results || [])
          .filter((c: any) => c.id !== contractId)
          .map((c: any) => ({
            id: c.id,
            title: c.contractTitle || c.title || c.fileName || 'Untitled',
            type: c.contractType || c.type,
            status: c.status,
            clientName: c.clientName,
            supplierName: c.supplierName,
            effectiveDate: c.effectiveDate,
            expirationDate: c.expirationDate,
          }))
        setSearchResults(filtered)
      }
    } catch {
      toast.error('Failed to search contracts')
    } finally {
      setIsSearching(false)
    }
  }
  
  const handleSelectSuggestion = (suggestion: SuggestedParent) => {
    setSelectedParent({
      id: suggestion.id,
      title: suggestion.title,
      type: null,
      status: 'active',
      clientName: null,
      supplierName: null,
      effectiveDate: null,
      expirationDate: null,
    })
    setMode('search')
  }
  
  const handleLink = async () => {
    if (!selectedParent) return
    
    setIsLinking(true)
    try {
      await onLink(selectedParent.id, relationshipType, note || undefined)
      onOpenChange(false)
      setSelectedParent(null)
      setSearchQuery('')
      setSearchResults([])
      setNote('')
    } finally {
      setIsLinking(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <LinkIcon className="h-5 w-5 text-violet-600" />
            Link to Parent Contract
          </DialogTitle>
          <DialogDescription>
            Establish a relationship between this contract and a parent agreement (e.g., link an SOW to its MSA)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Mode tabs */}
          {!selectedParent && suggestedParents.length > 0 && (
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <Button 
                variant={mode === 'suggestions' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setMode('suggestions')}
                className="flex-1"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                AI Suggestions ({suggestedParents.length})
              </Button>
              <Button 
                variant={mode === 'search' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setMode('search')}
                className="flex-1"
              >
                <Search className="h-4 w-4 mr-1.5" />
                Search
              </Button>
            </div>
          )}
          
          {/* AI Suggestions */}
          {mode === 'suggestions' && !selectedParent && suggestedParents.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Based on contract analysis, these appear to be potential parent agreements:
              </p>
              {suggestedParents.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left p-3 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{suggestion.title}</span>
                      <p className="text-xs text-slate-600 mt-0.5">{suggestion.reason}</p>
                    </div>
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">
                      {suggestion.score}% match
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Search mode or no suggestions */}
          {(mode === 'search' || suggestedParents.length === 0) && !selectedParent && (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Search contracts by title, client, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {searchResults.map((contract) => (
                    <button
                      key={contract.id}
                      className="w-full text-left p-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                      onClick={() => setSelectedParent(contract)}
                    >
                      <div className="font-medium text-sm">{contract.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {contract.type && <Badge variant="outline" className="text-xs">{contract.type}</Badge>}
                        <Badge className={cn("text-xs", getStatusColor(contract.status))}>{contract.status}</Badge>
                        {contract.clientName && <span>{contract.clientName}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          
          {/* Selected parent */}
          {selectedParent && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border-2 border-violet-200 bg-violet-50">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-violet-600 uppercase tracking-wider">Selected Parent</Label>
                    <div className="font-semibold text-slate-900 mt-1">{selectedParent.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {selectedParent.type && <Badge variant="outline" className="text-xs">{selectedParent.type}</Badge>}
                      <Badge className={cn("text-xs", getStatusColor(selectedParent.status))}>{selectedParent.status}</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedParent(null)}>
                    Change
                  </Button>
                </div>
              </div>
              
              {/* Relationship type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Relationship Type</Label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Note */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Note (optional)</Label>
                <Textarea
                  placeholder="Add context about this relationship..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="bg-white"
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedParent || isLinking}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {isLinking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Link Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ MAIN COMPONENT ============

export function ContractRelationshipsCard({
  contractId,
  parentContract,
  childContracts = [],
  relationshipType,
  relationshipNote,
  onLinkParent,
  onUnlinkParent,
  isEditing = false,
  className,
}: ContractRelationshipsCardProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [familyHealth, setFamilyHealth] = useState<FamilyHealthData | null>(null)
  const [isLoadingHealth, setIsLoadingHealth] = useState(true)
  const [showAllChildren, setShowAllChildren] = useState(false)
  const [linkingSuggestionId, setLinkingSuggestionId] = useState<string | null>(null)
  
  const hasParent = !!parentContract
  const hasChildren = childContracts.length > 0
  const hasHierarchy = hasParent || hasChildren
  
  // Fetch family health data
  const fetchFamilyHealth = useCallback(async () => {
    setIsLoadingHealth(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/family-health`)
      if (response.ok) {
        const data = await response.json()
        setFamilyHealth(data)
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingHealth(false)
    }
  }, [contractId])
  
  useEffect(() => {
    fetchFamilyHealth()
  }, [fetchFamilyHealth])
  
  const handleUnlink = async () => {
    if (!onUnlinkParent) return
    
    setIsUnlinking(true)
    try {
      await onUnlinkParent()
      toast.success('Parent contract unlinked')
      fetchFamilyHealth()
    } catch {
      toast.error('Failed to unlink parent contract')
    } finally {
      setIsUnlinking(false)
    }
  }
  
  const handleLink = async (parentId: string, relType: string, note?: string) => {
    if (!onLinkParent) return
    await onLinkParent(parentId, relType, note)
    toast.success('Parent contract linked successfully')
    fetchFamilyHealth()
  }
  
  const handleLinkSuggestion = async (suggestion: SuggestedParent) => {
    if (!onLinkParent) return
    setLinkingSuggestionId(suggestion.id)
    try {
      await onLinkParent(suggestion.id, 'SOW_UNDER_MSA', `AI suggested: ${suggestion.reason}`)
      toast.success('Parent contract linked successfully')
      fetchFamilyHealth()
    } finally {
      setLinkingSuggestionId(null)
    }
  }
  
  const hasSuggestions = (familyHealth?.suggestedParents?.length || 0) > 0
  const healthScore = familyHealth?.healthScore ?? 100
  const displayedChildren = showAllChildren ? childContracts : childContracts.slice(0, 3)
  
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-violet-600" />
              Contract Relationships
            </CardTitle>
            <CardDescription className="mt-1">
              {hasHierarchy 
                ? `${hasParent ? 'Linked to parent' : ''} ${hasParent && hasChildren ? '•' : ''} ${hasChildren ? `${childContracts.length} child contract${childContracts.length === 1 ? '' : 's'}` : ''}`
                : 'Establish parent/child relationships between contracts'}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Health Score Badge */}
            {!isLoadingHealth && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
                      getHealthBgColor(healthScore)
                    )}>
                      <Shield className={cn("h-4 w-4", getHealthColor(healthScore))} />
                      <span className={cn("text-sm font-bold", getHealthColor(healthScore))}>
                        {healthScore}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Family Health Score</p>
                    <p className="text-xs text-slate-400">Based on relationships and completeness</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Add Parent Button */}
            {!hasParent && onLinkParent && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowLinkDialog(true)}
                className="border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Link Parent
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* AI Suggestions - Show prominently if no parent */}
        {!hasParent && hasSuggestions && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
              <span className="text-xs font-medium text-violet-600 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                AI Suggested Parents
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-200 to-transparent" />
            </div>
            
            <AnimatePresence>
              {familyHealth?.suggestedParents?.slice(0, 2).map((suggestion) => (
                <AISuggestionCard 
                  key={suggestion.id}
                  suggestion={suggestion}
                  onLink={() => handleLinkSuggestion(suggestion)}
                  isLinking={linkingSuggestionId === suggestion.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {/* Parent Contract */}
        {hasParent && parentContract && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ArrowUp className="h-3.5 w-3.5 text-violet-500" />
                Parent Contract
              </Label>
            </div>
            <ContractLinkCard 
              contract={parentContract} 
              direction="parent" 
              relationshipType={relationshipType}
              onUnlink={handleUnlink}
              isUnlinking={isUnlinking}
              canUnlink={!!onUnlinkParent && isEditing}
            />
            {relationshipNote && (
              <p className="text-xs text-slate-500 italic ml-13 pl-1 border-l-2 border-slate-200">
                {relationshipNote}
              </p>
            )}
          </div>
        )}
        
        {/* Child Contracts */}
        {hasChildren && (
          <Collapsible open={showAllChildren} onOpenChange={setShowAllChildren}>
            <div className="space-y-2">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors py-1">
                  <span className="flex items-center gap-1.5">
                    <ArrowDown className="h-3.5 w-3.5 text-violet-500" />
                    Child Contracts ({childContracts.length})
                  </span>
                  {childContracts.length > 3 && (
                    <span className="flex items-center gap-1">
                      {showAllChildren ? 'Show less' : `+${childContracts.length - 3} more`}
                      {showAllChildren ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  )}
                </button>
              </CollapsibleTrigger>
              
              <div className="space-y-2">
                {displayedChildren.map((child) => (
                  <ContractLinkCard key={child.id} contract={child} direction="child" />
                ))}
              </div>
              
              <CollapsibleContent className="space-y-2">
                {childContracts.slice(3).map((child) => (
                  <ContractLinkCard key={child.id} contract={child} direction="child" />
                ))}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
        
        {/* Issues */}
        {familyHealth?.issues && familyHealth.issues.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Issues ({familyHealth.issues.length})
            </Label>
            <div className="space-y-1.5">
              {familyHealth.issues.slice(0, 3).map((issue, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 p-2.5 rounded-lg text-xs",
                    issue.severity === 'high' && 'bg-red-50 text-red-700 border border-red-200',
                    issue.severity === 'medium' && 'bg-amber-50 text-amber-700 border border-amber-200',
                    issue.severity === 'low' && 'bg-violet-50 text-violet-700 border border-violet-200'
                  )}
                >
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{issue.message}</p>
                    {issue.action && (
                      <p className="mt-1 opacity-75">Suggestion: {issue.action}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {!hasHierarchy && !hasSuggestions && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <GitBranch className="h-6 w-6" />
            </div>
            <h4 className="font-medium text-slate-700">No relationships yet</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Link this contract to a parent agreement to establish a hierarchy
            </p>
            {onLinkParent && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowLinkDialog(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Link to Parent Contract
              </Button>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Link Dialog */}
      {onLinkParent && (
        <LinkParentDialog
          contractId={contractId}
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          onLink={handleLink}
          suggestedParents={familyHealth?.suggestedParents}
        />
      )}
    </Card>
  )
}

export default ContractRelationshipsCard

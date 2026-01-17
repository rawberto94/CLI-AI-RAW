'use client'

import React, { useState } from 'react'
import Link from 'next/link'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
  Unlink,
  GitBranch,
  FileText,
  ExternalLink,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Building,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
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

interface ContractHierarchyProps {
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
}

// Relationship type options
const RELATIONSHIP_TYPES = [
  { value: 'SOW_UNDER_MSA', label: 'Statement of Work (under MSA)' },
  { value: 'AMENDMENT', label: 'Amendment' },
  { value: 'ADDENDUM', label: 'Addendum' },
  { value: 'RENEWAL', label: 'Renewal' },
  { value: 'CHANGE_ORDER', label: 'Change Order' },
  { value: 'VARIATION', label: 'Variation Agreement' },
  { value: 'SUPPLEMENT', label: 'Supplement' },
  { value: 'EXTENSION', label: 'Extension' },
  { value: 'SIDE_LETTER', label: 'Side Letter' },
  { value: 'SCHEDULE', label: 'Schedule' },
  { value: 'EXHIBIT', label: 'Exhibit' },
  { value: 'OTHER', label: 'Other Related Document' },
]

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'active':
      return 'bg-green-500/10 text-green-700 dark:text-green-400'
    case 'processing':
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    case 'failed':
    case 'expired':
      return 'bg-red-500/10 text-red-700 dark:text-red-400'
    case 'draft':
      return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    default:
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
  }
}

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'active':
      return <CheckCircle2 className="h-3 w-3" />
    case 'processing':
    case 'pending':
      return <Clock className="h-3 w-3" />
    case 'failed':
    case 'expired':
      return <AlertCircle className="h-3 w-3" />
    default:
      return null
  }
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
}

function ContractLinkCard({ contract, direction, relationshipType }: ContractLinkCardProps) {
  const isChild = direction === 'child'
  const childContract = contract as ChildContract
  
  return (
    <Link href={`/contracts/${contract.id}`}>
      <div className="group flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
        {/* Direction indicator */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          direction === 'parent' 
            ? "bg-purple-500/10 text-purple-600" 
            : "bg-blue-500/10 text-blue-600"
        )}>
          {direction === 'parent' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </div>
        
        {/* Contract info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {contract.title}
            </span>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {contract.type && (
              <Badge variant="outline" className="text-xs h-5">
                {contract.type}
              </Badge>
            )}
            {isChild && childContract.relationshipType && (
              <Badge variant="secondary" className="text-xs h-5">
                {getRelationshipLabel(childContract.relationshipType)}
              </Badge>
            )}
            {!isChild && relationshipType && (
              <Badge variant="secondary" className="text-xs h-5">
                {getRelationshipLabel(relationshipType)}
              </Badge>
            )}
            <Badge className={cn("text-xs h-5", getStatusColor(contract.status))}>
              {getStatusIcon(contract.status)}
              <span className="ml-1">{contract.status}</span>
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {(contract.clientName || contract.supplierName) && (
              <span className="flex items-center gap-1">
                <Building className="h-3 w-3" />
                {contract.clientName || contract.supplierName}
              </span>
            )}
            {contract.effectiveDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(contract.effectiveDate)}
              </span>
            )}
            {isChild && childContract.totalValue && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(childContract.totalValue)}
              </span>
            )}
          </div>
        </div>
        
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

// ============ LINK PARENT DIALOG ============

interface LinkParentDialogProps {
  contractId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onLink: (parentId: string, relationshipType: string, note?: string) => Promise<void>
}

function LinkParentDialog({ contractId, open, onOpenChange, onLink }: LinkParentDialogProps) {
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
        // Filter out the current contract
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
    } catch {
      // Link error - handled by caller
    } finally {
      setIsLinking(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link to Parent Contract
          </DialogTitle>
          <DialogDescription>
            Search for and link this contract to a parent agreement (e.g., link an SOW to its MSA)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Search input */}
          <div className="flex gap-2">
            <Input
              placeholder="Search contracts by title, client, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Search results */}
          {searchResults.length > 0 && !selectedParent && (
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
          
          {/* Selected parent */}
          {selectedParent && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border bg-accent/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Selected: {selectedParent.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {selectedParent.type && <Badge variant="outline" className="text-xs">{selectedParent.type}</Badge>}
                      <Badge className={cn("text-xs", getStatusColor(selectedParent.status))}>{selectedParent.status}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedParent(null)}>
                    Change
                  </Button>
                </div>
              </div>
              
              {/* Relationship type */}
              <div className="space-y-2">
                <Label>Relationship Type</Label>
                <Select value={relationshipType} onValueChange={setRelationshipType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Note */}
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Add a note about this relationship..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedParent || isLinking}>
            {isLinking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Link Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ MAIN COMPONENT ============

export function ContractHierarchy({
  contractId,
  contractTitle,
  parentContract,
  childContracts = [],
  parentContractId,
  relationshipType,
  relationshipNote,
  linkedAt,
  onLinkParent,
  onUnlinkParent,
  isEditing = false,
}: ContractHierarchyProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  
  const hasParent = !!parentContract
  const hasChildren = childContracts.length > 0
  const hasHierarchy = hasParent || hasChildren
  
  const handleUnlink = async () => {
    if (!onUnlinkParent) return
    
    setIsUnlinking(true)
    try {
      await onUnlinkParent()
      toast.success('Parent contract unlinked')
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
  }
  
  if (!hasHierarchy && !isEditing) {
    return null
  }
  
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Contract Hierarchy</CardTitle>
          </div>
          {isEditing && !hasParent && onLinkParent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Link Parent
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Link this contract to a parent agreement (e.g., MSA)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {(hasParent || hasChildren) && (
          <CardDescription>
            {hasParent && hasChildren 
              ? `Linked to parent contract with ${childContracts.length} child contract${childContracts.length === 1 ? '' : 's'}`
              : hasParent 
                ? 'This contract is linked to a parent agreement'
                : `${childContracts.length} linked child contract${childContracts.length === 1 ? '' : 's'}`}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Parent Contract */}
        {hasParent && parentContract && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Parent Contract
              </Label>
              {isEditing && onUnlinkParent && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                >
                  {isUnlinking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Unlink className="h-3 w-3 mr-1" />}
                  Unlink
                </Button>
              )}
            </div>
            <ContractLinkCard 
              contract={parentContract} 
              direction="parent" 
              relationshipType={relationshipType}
            />
            {relationshipNote && (
              <p className="text-xs text-muted-foreground italic pl-11">
                Note: {relationshipNote}
              </p>
            )}
            {linkedAt && (
              <p className="text-xs text-muted-foreground pl-11">
                Linked {formatDate(linkedAt)}
              </p>
            )}
          </div>
        )}
        
        {/* Child Contracts */}
        {hasChildren && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Child Contracts ({childContracts.length})
            </Label>
            <div className="space-y-2">
              {childContracts.map((child) => (
                <ContractLinkCard key={child.id} contract={child} direction="child" />
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state when editing */}
        {isEditing && !hasHierarchy && (
          <div className="text-center py-6 text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No linked contracts</p>
            <p className="text-xs mt-1">
              Link this contract to a parent agreement to establish a hierarchy
            </p>
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
        />
      )}
    </Card>
  )
}

export default ContractHierarchy

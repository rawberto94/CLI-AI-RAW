'use client'

/**
 * Favorite Contracts Widget
 * 
 * Quick access to bookmarked/starred contracts.
 * Supports drag-and-drop reordering and quick actions.
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import Link from 'next/link'
import {
  Star,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Eye,
  Edit,
  GitCompare,
  Share2,
  ChevronRight,
  GripVertical,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export interface FavoriteContract {
  id: string
  name: string
  supplier?: string
  status: 'active' | 'pending' | 'expiring' | 'expired' | 'draft'
  value?: number
  expirationDate?: Date
  lastViewed?: Date
  addedAt: Date
  notes?: string
}

interface FavoriteContractsWidgetProps {
  contracts?: FavoriteContract[]
  onRemove?: (id: string) => void
  onReorder?: (contracts: FavoriteContract[]) => void
  onAddFavorite?: () => void
  maxDisplay?: number
  showSearch?: boolean
  showQuickActions?: boolean
  className?: string
  variant?: 'card' | 'list' | 'compact'
}

// ============ HELPER FUNCTIONS ============

const getStatusConfig = (status: FavoriteContract['status']) => {
  switch (status) {
    case 'active':
      return { color: 'text-violet-500', bg: 'bg-violet-50', label: 'Active', icon: CheckCircle2 }
    case 'pending':
      return { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending', icon: Clock }
    case 'expiring':
      return { color: 'text-orange-500', bg: 'bg-orange-50', label: 'Expiring', icon: AlertTriangle }
    case 'expired':
      return { color: 'text-red-500', bg: 'bg-red-50', label: 'Expired', icon: AlertTriangle }
    case 'draft':
      return { color: 'text-slate-500', bg: 'bg-slate-50', label: 'Draft', icon: FileText }
    default:
      return { color: 'text-slate-500', bg: 'bg-slate-50', label: 'Unknown', icon: FileText }
  }
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getDaysUntilExpiration = (date?: Date): number | null => {
  if (!date) return null
  const diff = date.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ============ SUB-COMPONENTS ============

interface FavoriteItemProps {
  contract: FavoriteContract
  onRemove?: (id: string) => void
  showQuickActions?: boolean
  isDragging?: boolean
  variant?: 'card' | 'list' | 'compact'
}

function FavoriteItem({ contract, onRemove, showQuickActions, isDragging, variant = 'card' }: FavoriteItemProps) {
  const statusConfig = getStatusConfig(contract.status)
  const StatusIcon = statusConfig.icon
  const daysUntil = getDaysUntilExpiration(contract.expirationDate)
  const isExpiringSoon = daysUntil !== null && daysUntil > 0 && daysUntil <= 30
  
  const isCompact = variant === 'compact'
  
  return (
    <motion.div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border transition-all",
        isDragging 
          ? "shadow-lg border-indigo-300 bg-white z-50" 
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white",
        isCompact ? "p-2" : "p-3"
      )}
      layout
    >
      {/* Drag handle */}
      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400">
        <GripVertical className={cn(isCompact ? "h-3 w-3" : "h-4 w-4")} />
      </div>
      
      {/* Star icon */}
      <Star className={cn(
        "flex-shrink-0 fill-amber-400 text-amber-400",
        isCompact ? "h-3 w-3" : "h-4 w-4"
      )} />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link 
            href={`/contracts/${contract.id}`}
            className={cn(
              "font-medium text-slate-900 hover:text-violet-600 truncate",
              isCompact ? "text-xs" : "text-sm"
            )}
          >
            {contract.name}
          </Link>
          
          {isExpiringSoon && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 border-orange-200 text-orange-600 bg-orange-50"
            >
              {daysUntil}d
            </Badge>
          )}
        </div>
        
        {!isCompact && (
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            <span className={cn("flex items-center gap-1", statusConfig.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
            {contract.supplier && (
              <>
                <span className="text-slate-300">•</span>
                <span className="truncate">{contract.supplier}</span>
              </>
            )}
            {contract.value && (
              <>
                <span className="text-slate-300">•</span>
                <span>{formatCurrency(contract.value)}</span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Quick actions */}
      {showQuickActions && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${contract.id}`} className="flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${contract.id}/edit`} className="flex items-center">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onRemove?.(contract.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove from favorites
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
      {/* Quick view link */}
      <Link 
        href={`/contracts/${contract.id}`}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="h-4 w-4 text-slate-400 hover:text-violet-500" />
      </Link>
    </motion.div>
  )
}

// ============ MAIN COMPONENT ============

export function FavoriteContractsWidget({
  contracts = [],
  onRemove,
  onReorder,
  onAddFavorite,
  maxDisplay = 5,
  showSearch = true,
  showQuickActions = true,
  className,
  variant = 'card',
}: FavoriteContractsWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState(contracts)
  
  // Update items when contracts prop changes
  React.useEffect(() => {
    setItems(contracts)
  }, [contracts])
  
  // Filter contracts by search
  const filteredContracts = items.filter(contract => 
    contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.supplier?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, maxDisplay)
  
  // Handle reorder
  const handleReorder = useCallback((newOrder: FavoriteContract[]) => {
    setItems(newOrder)
    onReorder?.(newOrder)
  }, [onReorder])
  
  const hasMore = items.length > maxDisplay
  
  // List variant
  if (variant === 'list') {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            Favorites
          </h3>
          {onAddFavorite && (
            <Button variant="ghost" size="sm" onClick={onAddFavorite}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <Reorder.Group 
          axis="y" 
          values={filteredContracts} 
          onReorder={handleReorder}
          className="space-y-2"
        >
          {filteredContracts.map(contract => (
            <Reorder.Item key={contract.id} value={contract}>
              <FavoriteItem
                contract={contract}
                onRemove={onRemove}
                showQuickActions={showQuickActions}
                variant="compact"
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    )
  }
  
  // Card variant (default)
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <Star className="h-4 w-4 text-amber-600 fill-amber-600" />
            </div>
            Favorite Contracts
            <Badge variant="secondary" className="ml-2">
              {items.length}
            </Badge>
          </CardTitle>
          
          {onAddFavorite && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={onAddFavorite}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add favorite</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {showSearch && items.length > 3 && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Star className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No favorite contracts yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Star contracts to add them here for quick access
            </p>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No matches found</p>
          </div>
        ) : (
          <Reorder.Group 
            axis="y" 
            values={filteredContracts} 
            onReorder={handleReorder}
            className="space-y-2"
          >
            <AnimatePresence>
              {filteredContracts.map(contract => (
                <Reorder.Item key={contract.id} value={contract}>
                  <FavoriteItem
                    contract={contract}
                    onRemove={onRemove}
                    showQuickActions={showQuickActions}
                    variant="card"
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
        
        {hasMore && (
          <div className="mt-4 pt-4 border-t">
            <Link href="/contracts?favorites=true">
              <Button variant="ghost" className="w-full justify-center text-sm">
                View all {items.length} favorites
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default FavoriteContractsWidget

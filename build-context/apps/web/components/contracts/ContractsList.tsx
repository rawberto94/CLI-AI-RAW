/**
 * Contracts List Component
 * 
 * Renders the list of contracts in various view modes.
 * Handles selection, pagination, and view mode switching.
 */

'use client';

import React, { memo, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Download,
  Copy,
  Sparkles,
  ExternalLink,
  Clock,
  AlertTriangle,
  CalendarDays,
  ArrowRight,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CategoryBadge } from './CategoryComponents';

// ============================================================================
// Types
// ============================================================================

export interface Contract {
  id: string;
  title: string;
  vendor?: string;
  counterparty?: string;
  status: string;
  value?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  hasArtifacts?: boolean;
  riskScore?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type ViewMode = 'compact' | 'cards' | 'timeline' | 'kanban' | 'calendar';

export interface ContractsListProps {
  contracts: Contract[];
  viewMode: ViewMode;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onContractClick?: (contract: Contract) => void;
  onContractEdit?: (contract: Contract) => void;
  onContractDelete?: (contract: Contract) => void;
  onContractDownload?: (contract: Contract) => void;
  onGenerateArtifacts?: (contract: Contract) => void;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

const formatCurrency = (value?: number): string => {
  if (!value) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date?: string | Date): string => {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'MMM d, yyyy');
  } catch {
    return '-';
  }
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    processing: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
};

const getDaysUntilExpiration = (endDate?: string | Date): number | null => {
  if (!endDate) return null;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============================================================================
// Animation Variants
// ============================================================================

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20 },
};

// ============================================================================
// Sub-components
// ============================================================================

interface ContractActionsMenuProps {
  contract: Contract;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onGenerateArtifacts?: () => void;
}

const ContractActionsMenu = memo(function ContractActionsMenu({
  contract,
  onEdit,
  onDelete,
  onDownload,
  onGenerateArtifacts,
}: ContractActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={`/contracts/${contract.id}`} className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            View details
          </Link>
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onDownload && (
          <DropdownMenuItem onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}
        {onGenerateArtifacts && !contract.hasArtifacts && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onGenerateArtifacts} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate AI artifacts
            </DropdownMenuItem>
          </>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============================================================================
// Compact Row View
// ============================================================================

interface CompactRowProps {
  contract: Contract;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onGenerateArtifacts?: () => void;
}

const CompactRow = memo(function CompactRow({
  contract,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  onDownload,
  onGenerateArtifacts,
}: CompactRowProps) {
  const daysUntilExpiration = getDaysUntilExpiration(contract.endDate);
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0;

  return (
    <motion.div
      variants={itemVariants}
      layout
      className={cn(
        'group flex items-center gap-4 p-4 border rounded-lg bg-card',
        'hover:bg-muted/50 transition-colors cursor-pointer',
        isSelected && 'bg-primary/5 border-primary/30'
      )}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0" onClick={onClick}>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium truncate">{contract.title}</span>
          {contract.hasArtifacts && (
            <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {(contract.vendor || contract.counterparty) && (
            <span className="flex items-center gap-1 truncate">
              <Building2 className="h-3.5 w-3.5" />
              {contract.vendor || contract.counterparty}
            </span>
          )}
          {contract.endDate && (
            <span className={cn(
              'flex items-center gap-1',
              isExpiringSoon && 'text-yellow-600',
              isExpired && 'text-red-600'
            )}>
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(contract.endDate)}
              {isExpiringSoon && (
                <Clock className="h-3 w-3 ml-0.5" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Category Badge */}
      {contract.category && (
        <div className="flex-shrink-0 hidden sm:block">
          <CategoryBadge
            category={contract.category.name}
            color={contract.category.color}
            size="sm"
          />
        </div>
      )}

      {/* Status Badge */}
      <Badge className={cn('flex-shrink-0', getStatusColor(contract.status))}>
        {contract.status}
      </Badge>

      {/* Value */}
      {contract.value !== undefined && (
        <div className="hidden md:flex items-center gap-1 text-sm font-medium min-w-[80px] justify-end">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          {formatCurrency(contract.value).replace('$', '')}
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ContractActionsMenu
          contract={contract}
          onEdit={onEdit}
          onDelete={onDelete}
          onDownload={onDownload}
          onGenerateArtifacts={onGenerateArtifacts}
        />
      </div>
    </motion.div>
  );
});

// ============================================================================
// Card View
// ============================================================================

interface ContractCardProps {
  contract: Contract;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onGenerateArtifacts?: () => void;
}

const ContractCard = memo(function ContractCard({
  contract,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  onDownload,
  onGenerateArtifacts,
}: ContractCardProps) {
  const daysUntilExpiration = getDaysUntilExpiration(contract.endDate);
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration > 0;

  return (
    <motion.div variants={itemVariants} layout>
      <Card
        className={cn(
          'group cursor-pointer hover:shadow-md transition-all',
          isSelected && 'ring-2 ring-primary'
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                onClick={(e) => e.stopPropagation()}
              />
              <CardTitle
                className="text-base truncate cursor-pointer hover:text-primary"
                onClick={onClick}
              >
                {contract.title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {contract.hasArtifacts && (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              <ContractActionsMenu
                contract={contract}
                onEdit={onEdit}
                onDelete={onDelete}
                onDownload={onDownload}
                onGenerateArtifacts={onGenerateArtifacts}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent onClick={onClick}>
          <div className="space-y-3">
            {/* Vendor */}
            {(contract.vendor || contract.counterparty) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{contract.vendor || contract.counterparty}</span>
              </div>
            )}

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getStatusColor(contract.status)}>
                {contract.status}
              </Badge>
              {contract.category && (
                <CategoryBadge
                  category={contract.category.name}
                  color={contract.category.color}
                  size="sm"
                />
              )}
              {isExpiringSoon && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Expiring soon
                </Badge>
              )}
            </div>

            {/* Details */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(contract.endDate)}</span>
              </div>
              {contract.value !== undefined && (
                <div className="font-semibold text-sm">
                  {formatCurrency(contract.value)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ============================================================================
// Timeline View
// ============================================================================

interface TimelineItemProps {
  contract: Contract;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TimelineItem = memo(function TimelineItem({
  contract,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onDelete,
}: TimelineItemProps) {
  const daysUntilExpiration = getDaysUntilExpiration(contract.endDate);
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0;

  return (
    <motion.div
      variants={itemVariants}
      layout
      className="relative flex gap-4 pb-8 last:pb-0"
    >
      {/* Timeline line */}
      <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border last:hidden" />
      
      {/* Timeline dot */}
      <div className={cn(
        "relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        isExpired 
          ? "bg-red-100 text-red-600 dark:bg-red-900/30"
          : isExpiringSoon 
            ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
            : "bg-primary/10 text-primary"
      )}>
        <FileText className="h-4 w-4" />
      </div>
      
      {/* Content */}
      <div className={cn(
        "flex-1 bg-card border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "ring-2 ring-primary"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
            <div onClick={onClick}>
              <h4 className="font-medium text-sm hover:text-primary transition-colors">
                {contract.title}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {(contract.vendor || contract.counterparty) && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {contract.vendor || contract.counterparty}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', getStatusColor(contract.status))}>
              {contract.status}
            </Badge>
            {contract.value !== undefined && (
              <span className="text-sm font-medium">
                {formatCurrency(contract.value)}
              </span>
            )}
          </div>
        </div>
        
        {/* Timeline date */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {contract.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Start: {formatDate(contract.startDate)}
              </span>
            )}
            {contract.endDate && (
              <span className={cn(
                "flex items-center gap-1",
                isExpiringSoon && "text-yellow-600",
                isExpired && "text-red-600"
              )}>
                <ArrowRight className="h-3 w-3" />
                End: {formatDate(contract.endDate)}
              </span>
            )}
          </div>
          {contract.category && (
            <CategoryBadge
              category={contract.category.name}
              color={contract.category.color}
              size="sm"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
});

interface TimelineViewProps {
  contracts: Contract[];
  selectedIds: string[];
  onSelect: (contractId: string, checked: boolean) => void;
  onContractClick?: (contract: Contract) => void;
  onContractEdit?: (contract: Contract) => void;
  onContractDelete?: (contract: Contract) => void;
}

const TimelineView = memo(function TimelineView({
  contracts,
  selectedIds,
  onSelect,
  onContractClick,
  onContractEdit,
  onContractDelete,
}: TimelineViewProps) {
  // Group contracts by month/year
  const groupedContracts = React.useMemo(() => {
    const groups: Record<string, Contract[]> = {};
    
    contracts.forEach(contract => {
      const date = contract.endDate || contract.startDate || contract.createdAt;
      if (date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        const key = format(d, 'MMMM yyyy');
        if (!groups[key]) groups[key] = [];
        groups[key].push(contract);
      } else {
        if (!groups['No Date']) groups['No Date'] = [];
        groups['No Date'].push(contract);
      }
    });
    
    return groups;
  }, [contracts]);

  return (
    <div className="space-y-8">
      {Object.entries(groupedContracts).map(([monthYear, monthContracts]) => (
        <div key={monthYear}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{monthYear}</h3>
            <Badge variant="secondary">{monthContracts.length}</Badge>
          </div>
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {monthContracts.map(contract => (
              <TimelineItem
                key={contract.id}
                contract={contract}
                isSelected={selectedIds.includes(contract.id)}
                onSelect={(checked) => onSelect(contract.id, checked)}
                onClick={() => onContractClick?.(contract)}
                onEdit={onContractEdit ? () => onContractEdit(contract) : undefined}
                onDelete={onContractDelete ? () => onContractDelete(contract) : undefined}
              />
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Kanban View
// ============================================================================

interface KanbanColumnProps {
  title: string;
  status: string;
  contracts: Contract[];
  selectedIds: string[];
  onSelect: (contractId: string, checked: boolean) => void;
  onContractClick?: (contract: Contract) => void;
  color?: string;
}

const KanbanColumn = memo(function KanbanColumn({
  title,
  status,
  contracts,
  selectedIds,
  onSelect,
  onContractClick,
  color = "bg-gray-100",
}: KanbanColumnProps) {
  const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={cn(
        "rounded-t-lg px-4 py-3",
        color
      )}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary">{contracts.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Total: {formatCurrency(totalValue)}
        </p>
      </div>
      
      <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] max-h-[600px] overflow-y-auto">
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {contracts.map(contract => (
              <motion.div
                key={contract.id}
                variants={itemVariants}
                layout
                className={cn(
                  "bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all",
                  selectedIds.includes(contract.id) && "ring-2 ring-primary"
                )}
              >
                <div className="flex items-start gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(contract.id)}
                      onCheckedChange={(checked) => onSelect(contract.id, !!checked)}
                    />
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => onContractClick?.(contract)}>
                    <h4 className="font-medium text-sm truncate hover:text-primary">
                      {contract.title}
                    </h4>
                    {(contract.vendor || contract.counterparty) && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {contract.vendor || contract.counterparty}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(contract.endDate)}
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(contract.value)}
                      </span>
                    </div>
                    {contract.category && (
                      <div className="mt-2">
                        <CategoryBadge
                          category={contract.category.name}
                          color={contract.category.color}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        
        {contracts.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No contracts
          </div>
        )}
      </div>
    </div>
  );
});

const KANBAN_COLUMNS = [
  { status: 'draft', title: 'Draft', color: 'bg-gray-100 dark:bg-gray-800' },
  { status: 'pending', title: 'Pending', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { status: 'active', title: 'Active', color: 'bg-green-100 dark:bg-green-900/30' },
  { status: 'expired', title: 'Expired', color: 'bg-red-100 dark:bg-red-900/30' },
];

interface KanbanViewProps {
  contracts: Contract[];
  selectedIds: string[];
  onSelect: (contractId: string, checked: boolean) => void;
  onContractClick?: (contract: Contract) => void;
}

const KanbanView = memo(function KanbanView({
  contracts,
  selectedIds,
  onSelect,
  onContractClick,
}: KanbanViewProps) {
  // Group contracts by status
  const columnContracts = React.useMemo(() => {
    const grouped: Record<string, Contract[]> = {};
    KANBAN_COLUMNS.forEach(col => {
      grouped[col.status] = [];
    });
    
    contracts.forEach(contract => {
      const status = contract.status.toLowerCase();
      if (grouped[status]) {
        grouped[status].push(contract);
      } else {
        // Put unknown statuses in draft
        const draftGroup = grouped['draft'];
        if (draftGroup) {
          draftGroup.push(contract);
        }
      }
    });
    
    return grouped;
  }, [contracts]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map(column => (
        <KanbanColumn
          key={column.status}
          title={column.title}
          status={column.status}
          contracts={columnContracts[column.status] || []}
          selectedIds={selectedIds}
          onSelect={onSelect}
          onContractClick={onContractClick}
          color={column.color}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Calendar View
// ============================================================================

interface CalendarDayProps {
  date: Date;
  contracts: Contract[];
  isToday: boolean;
  isCurrentMonth: boolean;
  selectedIds: string[];
  onContractClick?: (contract: Contract) => void;
}

const CalendarDay = memo(function CalendarDay({
  date,
  contracts,
  isToday,
  isCurrentMonth,
  selectedIds,
  onContractClick,
}: CalendarDayProps) {
  const [expanded, setExpanded] = React.useState(false);
  const hasMore = contracts.length > 2;
  const displayContracts = expanded ? contracts : contracts.slice(0, 2);

  return (
    <div className={cn(
      "min-h-[100px] p-1 border-r border-b",
      !isCurrentMonth && "bg-muted/30",
      isToday && "bg-primary/5"
    )}>
      <div className={cn(
        "text-sm font-medium mb-1 p-1 rounded",
        isToday && "bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center",
        !isCurrentMonth && "text-muted-foreground"
      )}>
        {format(date, 'd')}
      </div>
      
      <div className="space-y-1">
        {displayContracts.map(contract => (
          <div
            key={contract.id}
            className={cn(
              "text-xs p-1 rounded cursor-pointer truncate",
              "hover:bg-primary/10 transition-colors",
              selectedIds.includes(contract.id) && "bg-primary/20",
              getStatusColor(contract.status)
            )}
            onClick={() => onContractClick?.(contract)}
            title={contract.title}
          >
            {contract.title}
          </div>
        ))}
        
        {hasMore && !expanded && (
          <button
            className="text-xs text-primary hover:underline w-full text-left px-1"
            onClick={() => setExpanded(true)}
          >
            +{contracts.length - 2} more
          </button>
        )}
        
        {hasMore && expanded && (
          <button
            className="text-xs text-muted-foreground hover:underline w-full text-left px-1"
            onClick={() => setExpanded(false)}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
});

interface CalendarViewProps {
  contracts: Contract[];
  selectedIds: string[];
  onContractClick?: (contract: Contract) => void;
}

const CalendarView = memo(function CalendarView({
  contracts,
  selectedIds,
  onContractClick,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Get calendar days for current month
  const calendarDays = React.useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const days: Date[] = [];
    const current = new Date(startDate);
    
    // Generate 6 weeks of days
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);
  
  // Group contracts by end date
  const contractsByDate = React.useMemo(() => {
    const map: Record<string, Contract[]> = {};
    
    contracts.forEach(contract => {
      const date = contract.endDate;
      if (date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        const key = format(d, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push(contract);
      }
    });
    
    return map;
  }, [contracts]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <ChevronDown className="h-4 w-4 rotate-90" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[180px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date, i) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayContracts = contractsByDate[dateKey] || [];
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
            
            return (
              <CalendarDay
                key={i}
                date={date}
                contracts={dayContracts}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                selectedIds={selectedIds}
                onContractClick={onContractClick}
              />
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-100 border" />
          Pending
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 border" />
          Expired
        </span>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const ContractsList = memo(function ContractsList({
  contracts,
  viewMode,
  selectedIds,
  onSelectionChange,
  onContractClick,
  onContractEdit,
  onContractDelete,
  onContractDownload,
  onGenerateArtifacts,
  isLoading,
  className,
}: ContractsListProps) {
  // Handle individual selection
  const handleSelect = useCallback((contractId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, contractId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== contractId));
    }
  }, [selectedIds, onSelectionChange]);

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      onSelectionChange(contracts.map(c => c.id));
    } else {
      onSelectionChange([]);
    }
  }, [contracts, onSelectionChange]);

  const allSelected = contracts.length > 0 && selectedIds.length === contracts.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < contracts.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (contracts.length === 0) {
    return null; // Let parent handle empty state
  }

  // Compact list view
  if (viewMode === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {/* Select All Header */}
        <div className="flex items-center gap-4 px-4 py-2 border-b">
          <Checkbox
            checked={allSelected}
            // indeterminate state handling would need custom component
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${contracts.length} contracts`}
          </span>
        </div>

        <LayoutGroup>
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            <AnimatePresence mode="popLayout">
              {contracts.map(contract => (
                <CompactRow
                  key={contract.id}
                  contract={contract}
                  isSelected={selectedIds.includes(contract.id)}
                  onSelect={(checked) => handleSelect(contract.id, checked)}
                  onClick={() => onContractClick?.(contract)}
                  onEdit={onContractEdit ? () => onContractEdit(contract) : undefined}
                  onDelete={onContractDelete ? () => onContractDelete(contract) : undefined}
                  onDownload={onContractDownload ? () => onContractDownload(contract) : undefined}
                  onGenerateArtifacts={onGenerateArtifacts ? () => onGenerateArtifacts(contract) : undefined}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    );
  }

  // Card grid view
  if (viewMode === 'cards') {
    return (
      <div className={className}>
        {/* Select All Header */}
        <div className="flex items-center gap-4 px-2 py-2 mb-4">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${contracts.length} contracts`}
          </span>
        </div>

        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {contracts.map(contract => (
            <ContractCard
              key={contract.id}
              contract={contract}
              isSelected={selectedIds.includes(contract.id)}
              onSelect={(checked) => handleSelect(contract.id, checked)}
              onClick={() => onContractClick?.(contract)}
              onEdit={onContractEdit ? () => onContractEdit(contract) : undefined}
              onDelete={onContractDelete ? () => onContractDelete(contract) : undefined}
              onDownload={onContractDownload ? () => onContractDownload(contract) : undefined}
              onGenerateArtifacts={onGenerateArtifacts ? () => onGenerateArtifacts(contract) : undefined}
            />
          ))}
        </motion.div>
      </div>
    );
  }

  // Timeline and Kanban views would use their own dedicated components
  if (viewMode === 'timeline') {
    return (
      <div className={className}>
        <TimelineView
          contracts={contracts}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onContractClick={onContractClick}
          onContractEdit={onContractEdit}
          onContractDelete={onContractDelete}
        />
      </div>
    );
  }

  if (viewMode === 'kanban') {
    return (
      <div className={className}>
        <KanbanView
          contracts={contracts}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onContractClick={onContractClick}
        />
      </div>
    );
  }

  if (viewMode === 'calendar') {
    return (
      <div className={className}>
        <CalendarView
          contracts={contracts}
          selectedIds={selectedIds}
          onContractClick={onContractClick}
        />
      </div>
    );
  }

  // Default: compact view fallback
  return (
    <div className={cn('space-y-2', className)}>
      <LayoutGroup>
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {contracts.map(contract => (
            <CompactRow
              key={contract.id}
              contract={contract}
              isSelected={selectedIds.includes(contract.id)}
              onSelect={(checked) => handleSelect(contract.id, checked)}
              onClick={() => onContractClick?.(contract)}
              onEdit={onContractEdit ? () => onContractEdit(contract) : undefined}
              onDelete={onContractDelete ? () => onContractDelete(contract) : undefined}
              onDownload={onContractDownload ? () => onContractDownload(contract) : undefined}
              onGenerateArtifacts={onGenerateArtifacts ? () => onGenerateArtifacts(contract) : undefined}
            />
          ))}
        </motion.div>
      </LayoutGroup>
    </div>
  );
});

export default ContractsList;

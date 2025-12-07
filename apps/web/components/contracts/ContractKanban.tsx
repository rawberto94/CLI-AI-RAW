'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Building2,
  Calendar,
  GripVertical,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Shield,
  Sparkles,
  Plus,
  Archive,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface KanbanContract {
  id: string;
  title: string;
  status: 'draft' | 'pending_review' | 'in_negotiation' | 'pending_approval' | 'active' | 'expiring' | 'expired' | 'archived';
  supplierName?: string;
  clientName?: string;
  totalValue?: number;
  currency?: string;
  expirationDate?: Date;
  riskLevel?: 'low' | 'medium' | 'high';
  assignees?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  progress?: number;
  daysUntilExpiry?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: KanbanContract['status'];
  color: string;
  icon: React.ReactNode;
  contracts: KanbanContract[];
}

interface ContractKanbanProps {
  contracts: KanbanContract[];
  onContractClick?: (contractId: string) => void;
  onStatusChange?: (contractId: string, newStatus: KanbanContract['status']) => void;
  onContractDelete?: (contractId: string) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatCurrency = (value: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getRiskBadge = (risk?: string) => {
  switch (risk) {
    case 'high':
      return <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5">High Risk</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1.5">Med Risk</Badge>;
    case 'low':
      return <Badge className="bg-green-100 text-green-700 border-0 text-[10px] px-1.5">Low Risk</Badge>;
    default:
      return null;
  }
};

// ============================================================================
// Kanban Card Component
// ============================================================================

interface KanbanCardProps {
  contract: KanbanContract;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
}

function KanbanCard({ contract, onView, onEdit, onDelete, isDragging }: KanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer",
        isDragging && "shadow-xl ring-2 ring-blue-500"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onView}
    >
      {/* Drag Handle */}
      <div className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      <div className="p-4 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-slate-900 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors pr-2">
            {contract.title}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
                  isHovered && "opacity-100"
                )}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                <Eye className="w-4 h-4 mr-2" />
                View
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Supplier */}
        {contract.supplierName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{contract.supplierName}</span>
          </div>
        )}

        {/* Tags Row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {contract.priority && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 capitalize", getPriorityColor(contract.priority))}>
              {contract.priority}
            </Badge>
          )}
          {getRiskBadge(contract.riskLevel)}
          {contract.tags?.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 bg-slate-50 text-slate-600">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Value & Expiry */}
        <div className="flex items-center justify-between text-xs">
          {contract.totalValue !== undefined && (
            <div className="flex items-center gap-1 text-emerald-600 font-semibold">
              <DollarSign className="w-3 h-3" />
              {formatCurrency(contract.totalValue, contract.currency)}
            </div>
          )}
          {contract.expirationDate && (
            <div className={cn(
              "flex items-center gap-1",
              contract.daysUntilExpiry && contract.daysUntilExpiry < 30 ? "text-amber-600" : "text-slate-500"
            )}>
              <Calendar className="w-3 h-3" />
              {contract.daysUntilExpiry !== undefined && contract.daysUntilExpiry > 0 
                ? `${contract.daysUntilExpiry}d left`
                : new Date(contract.expirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            </div>
          )}
        </div>

        {/* Progress Bar (if applicable) */}
        {contract.progress !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Progress</span>
              <span>{contract.progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${contract.progress}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Assignees */}
        {contract.assignees && contract.assignees.length > 0 && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
            <div className="flex -space-x-2">
              {contract.assignees.slice(0, 3).map((assignee, idx) => (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                      {assignee.charAt(0)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{assignee}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            {contract.assignees.length > 3 && (
              <span className="text-[10px] text-slate-500">+{contract.assignees.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Kanban Column Component
// ============================================================================

interface KanbanColumnProps {
  column: KanbanColumn;
  onContractClick?: (contractId: string) => void;
  onContractDelete?: (contractId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function KanbanColumnComponent({
  column,
  onContractClick,
  onContractDelete,
  isCollapsed,
  onToggleCollapse,
}: KanbanColumnProps) {
  const totalValue = useMemo(() => {
    return column.contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  }, [column.contracts]);

  return (
    <motion.div
      layout
      className={cn(
        "flex-shrink-0 flex flex-col bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/60",
        isCollapsed ? "w-14" : "w-80"
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-t-2xl cursor-pointer transition-colors",
          column.color
        )}
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="p-2 bg-white/30 rounded-lg">
              {column.icon}
            </div>
            <div className="writing-vertical-rl rotate-180 text-xs font-semibold text-white/90 whitespace-nowrap">
              {column.title}
            </div>
            <Badge className="bg-white/30 text-white border-0 text-xs">
              {column.contracts.length}
            </Badge>
          </div>
        ) : (
          <>
            <div className="p-2 bg-white/30 rounded-lg">
              {column.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">{column.title}</h3>
              <p className="text-xs text-white/70">
                {formatCurrency(totalValue)} total
              </p>
            </div>
            <Badge className="bg-white/30 text-white border-0">
              {column.contracts.length}
            </Badge>
            {isCollapsed !== undefined && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/20">
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Column Content */}
      {!isCollapsed && (
        <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)]">
          <AnimatePresence mode="popLayout">
            {column.contracts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No contracts</p>
                <p className="text-xs text-slate-400 mt-1">Drag contracts here</p>
              </motion.div>
            ) : (
              column.contracts.map((contract) => (
                <KanbanCard
                  key={contract.id}
                  contract={contract}
                  onView={() => onContractClick?.(contract.id)}
                  onDelete={() => onContractDelete?.(contract.id)}
                />
              ))
            )}
          </AnimatePresence>

          {/* Add Contract Button */}
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-slate-600 hover:bg-white/50 border-2 border-dashed border-slate-200 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add contract
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Kanban Board Component
// ============================================================================

export function ContractKanban({
  contracts,
  onContractClick,
  onStatusChange,
  onContractDelete,
  className,
}: ContractKanbanProps) {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());

  // Define columns
  const columns: KanbanColumn[] = useMemo(() => [
    {
      id: 'draft',
      title: 'Draft',
      status: 'draft' as const,
      color: 'bg-gradient-to-r from-slate-500 to-slate-600',
      icon: <FileText className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'draft'),
    },
    {
      id: 'pending_review',
      title: 'Pending Review',
      status: 'pending_review' as const,
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      icon: <Clock className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'pending_review'),
    },
    {
      id: 'in_negotiation',
      title: 'In Negotiation',
      status: 'in_negotiation' as const,
      color: 'bg-gradient-to-r from-purple-500 to-pink-600',
      icon: <Users className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'in_negotiation'),
    },
    {
      id: 'pending_approval',
      title: 'Pending Approval',
      status: 'pending_approval' as const,
      color: 'bg-gradient-to-r from-amber-500 to-orange-600',
      icon: <Shield className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'pending_approval'),
    },
    {
      id: 'active',
      title: 'Active',
      status: 'active' as const,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600',
      icon: <CheckCircle2 className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'active'),
    },
    {
      id: 'expiring',
      title: 'Expiring Soon',
      status: 'expiring' as const,
      color: 'bg-gradient-to-r from-orange-500 to-red-600',
      icon: <AlertTriangle className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'expiring'),
    },
    {
      id: 'archived',
      title: 'Archived',
      status: 'archived' as const,
      color: 'bg-gradient-to-r from-gray-500 to-gray-600',
      icon: <Archive className="w-4 h-4 text-white" />,
      contracts: contracts.filter(c => c.status === 'archived' || c.status === 'expired'),
    },
  ], [contracts]);

  const toggleColumnCollapse = (columnId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  // Stats
  const totalContracts = contracts.length;
  const totalValue = contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const expiringCount = contracts.filter(c => c.status === 'expiring').length;

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Header Stats */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-slate-600">
                <span className="text-xl font-bold text-slate-900">{totalContracts}</span> contracts
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-emerald-600">{formatCurrency(totalValue)}</span> total value
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-600 font-medium">{activeCount} active</span>
              {expiringCount > 0 && (
                <span className="text-amber-600 font-medium">{expiringCount} expiring</span>
              )}
            </div>
          </div>
          
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Contract
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {columns.map((column) => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              onContractClick={onContractClick}
              onContractDelete={onContractDelete}
              isCollapsed={collapsedColumns.has(column.id)}
              onToggleCollapse={() => toggleColumnCollapse(column.id)}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ContractKanban;

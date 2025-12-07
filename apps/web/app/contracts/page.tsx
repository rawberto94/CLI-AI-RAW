/**
 * Enhanced Contracts List Page
 * Integrated filters, bulk selection, cross-module actions
 */

"use client";

import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { NoContracts, NoResults } from "@/components/ui/empty-states";
import { AdvancedSearchModal, type AdvancedSearchFilters } from "@/components/contracts/AdvancedSearchModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  Eye,
  Upload,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Shield,
  RefreshCw,
  Filter,
  TrendingUp,
  ArrowUpRight,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Brain,
  GitCompare,
  Bell,
  ClipboardCheck,
  SlidersHorizontal,
  X,
  LayoutGrid,
  LayoutList,
  Building2,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CalendarDays,
  CalendarClock,
  Banknote,
  Tag,
  Zap,
  History,
  TimerOff,
  CircleDot,
  FileDown,
  FileSpreadsheet,
  ListFilter,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Bookmark,
  BookmarkCheck,
  PieChart,
  TrendingDown,
  Hash,
  FileBarChart,
  Truck,
  GanttChartSquare,
  Kanban,
  Target,
  Database,
  ArrowLeftRight,
} from "lucide-react";
import { ContractTimeline, type TimelineContract } from "@/components/contracts/ContractTimeline";
import { ContractKanban, type KanbanContract } from "@/components/contracts/ContractKanban";
import { ObligationWidget, type Obligation } from "@/components/contracts/ObligationTracker";
import { CategoryBadge } from "@/components/contracts/CategoryComponents";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDataMode } from "@/contexts/DataModeContext";
import { useContracts, useCrossModuleInvalidation, type Contract } from "@/hooks/use-queries";
import { toast } from "sonner";
import { ShareDialog } from "@/components/collaboration/ShareDialog";
import { SubmitForApprovalModal } from "@/components/collaboration/SubmitForApprovalModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AIReportModal } from "@/components/contracts/AIReportModal";
import { cn } from "@/lib/utils";

// ============ COMPACT ROW COMPONENT ============
interface CompactContractRowProps {
  contract: Contract;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onApproval: () => void;
  formatCurrency: (value?: number) => string;
  formatDate: (date?: string) => string;
}

const CompactContractRow = memo(function CompactContractRow({
  contract,
  index,
  isSelected,
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval,
  formatCurrency,
  formatDate,
}: CompactContractRowProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
      completed: { label: "Active", color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle },
      processing: { label: "Processing", color: "text-blue-700", bg: "bg-blue-50", icon: Loader2 },
      failed: { label: "Failed", color: "text-red-700", bg: "bg-red-50", icon: AlertTriangle },
      pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
    };
    return configs[status] || { label: status, color: "text-slate-700", bg: "bg-slate-100", icon: CircleDot };
  };

  const statusConfig = getStatusConfig(contract.status);
  const StatusIcon = statusConfig.icon;
  const isExpiringSoon = contract.expirationDate && 
    new Date(contract.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isNew = contract.createdAt && 
    new Date(contract.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const isExpired = contract.expirationDate && new Date(contract.expirationDate) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={cn(
        "grid grid-cols-[44px_1fr_140px_140px_140px_120px_130px_110px_50px] gap-4 px-5 py-3.5 items-center hover:bg-blue-50/50 cursor-pointer transition-colors group",
        isSelected && "bg-blue-50 hover:bg-blue-100/70",
        !isSelected && index % 2 === 1 && "bg-slate-50/50"
      )}
      onClick={onView}
    >
      {/* Checkbox */}
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${contract.title}`}
          className="border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        />
      </div>

      {/* Contract Title & Category */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-slate-100 rounded-md flex-shrink-0">
          <FileText className="h-4 w-4 text-slate-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 break-words line-clamp-1 group-hover:text-blue-600 transition-colors text-[13px] leading-tight" title={contract.title}>
              {contract.title || 'Untitled Contract'}
            </p>
            {isNew && (
              <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5 py-0 h-4 flex-shrink-0 font-medium">
                New
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400">{formatDate(contract.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="hidden lg:block min-w-0">
        {contract.category ? (
          <CategoryBadge 
            category={contract.category.name} 
            color={contract.category.color}
            icon={contract.category.icon}
            categoryPath={contract.category.path}
            size="sm"
          />
        ) : (
          <span className="text-xs text-slate-400 italic">Uncategorized</span>
        )}
      </div>

      {/* Contract Type */}
      <div className="hidden lg:block min-w-0">
        <span className="text-sm text-slate-600 truncate block" title={contract.type}>
          {contract.type || '—'}
        </span>
      </div>

      {/* Party */}
      <div className="hidden md:flex items-center gap-2 min-w-0">
        <span className="text-sm text-slate-600 truncate">
          {contract.parties?.supplier || contract.parties?.client || '—'}
        </span>
      </div>

      {/* Value */}
      <div className="hidden lg:block">
        <span className={cn(
          "text-sm font-semibold",
          contract.value ? "text-slate-900" : "text-slate-400"
        )}>
          {formatCurrency(contract.value)}
        </span>
      </div>

      {/* Expiration Date */}
      <div className="hidden md:block">
        {contract.expirationDate ? (
          <div className={cn(
            "flex items-center gap-1.5",
            isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-slate-600"
          )}>
            <span className="text-sm">
              {formatDate(contract.expirationDate)}
            </span>
            {isExpired && (
              <Badge className="bg-red-100 text-red-700 border-0 text-[10px] px-1.5 py-0 h-4 flex-shrink-0 font-medium">
                Expired
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
      </div>

      {/* Status */}
      <div>
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
          statusConfig.bg,
          statusConfig.color
        )}>
          <StatusIcon className={cn("h-3.5 w-3.5", contract.status === 'processing' && "animate-spin")} />
          {statusConfig.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-md hover:bg-slate-200"
            >
              <MoreHorizontal className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-lg rounded-lg">
            <DropdownMenuItem onClick={onView} className="cursor-pointer">
              <Eye className="h-4 w-4 mr-2 text-slate-500" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')} className="cursor-pointer">
              <Brain className="h-4 w-4 mr-2 text-slate-500" /> AI Analysis
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDownload} className="cursor-pointer">
              <Download className="h-4 w-4 mr-2 text-slate-500" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} className="cursor-pointer">
              <Share2 className="h-4 w-4 mr-2 text-slate-500" /> Share
            </DropdownMenuItem>
            {/* Request Approval - Hidden for now, will be enabled in future */}
            {/* <DropdownMenuItem onClick={onApproval} className="cursor-pointer">
              <ClipboardCheck className="h-4 w-4 mr-2 text-slate-500" /> Request Approval
            </DropdownMenuItem> */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600 cursor-pointer">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
});

// ============ CARD COMPONENT ============
interface ContractCardProps {
  contract: Contract;
  isSelected: boolean;
  onSelect: () => void;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onApproval: () => void;
  formatCurrency: (value?: number) => string;
  formatDate: (date?: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  getRiskBadge: (riskScore?: number) => React.ReactNode;
}

const ContractCard = memo(function ContractCard({
  contract,
  isSelected,
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval,
  formatCurrency,
  formatDate,
  getStatusBadge,
  getRiskBadge,
}: ContractCardProps) {
  const isExpiringSoon = contract.expirationDate && 
    new Date(contract.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = contract.expirationDate && new Date(contract.expirationDate) < new Date();
  const isNew = contract.createdAt && 
    new Date(contract.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-300 bg-white/80 backdrop-blur-sm border-white/50 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50",
        isSelected && "ring-2 ring-blue-500 border-blue-300 shadow-blue-200/50",
        isNew && "border-purple-200/50 shadow-purple-100/30"
      )}
      onClick={onView}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-0.5"
              />
            </div>
            <div className="relative p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
              <FileText className="h-5 w-5 text-white" />
              {isNew && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gradient-to-r from-purple-500 to-pink-500"></span>
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                  {contract.title || 'Untitled Contract'}
                </h3>
                {isNew && (
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-[10px] px-1.5 py-0 h-4 flex-shrink-0 shadow-sm">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    New
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500">
                  {contract.type || 'Contract'}
                </p>
                {contract.category && (
                  <CategoryBadge 
                    category={contract.category.name}
                    color={contract.category.color}
                    icon={contract.category.icon}
                    categoryPath={contract.category.path}
                    size="sm"
                  />
                )}
              </div>
            </div>
          </div>
          {getStatusBadge(contract.status)}
        </div>

        {/* Key Details */}
        <div className="space-y-3 mb-4">
          {contract.parties?.client && (
            <div className="flex items-center gap-2.5 text-sm">
              <div className="p-1.5 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-100/50">
                <Building2 className="h-3.5 w-3.5 text-cyan-600" />
              </div>
              <span className="text-slate-700 truncate font-medium">{contract.parties.client}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-100/50">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className={contract.value ? "font-bold text-slate-900" : "text-slate-400 italic"}>
                {formatCurrency(contract.value)}
              </span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className={cn(
                "text-sm font-medium",
                isExpired ? "text-red-600" : 
                isExpiringSoon ? "text-amber-600" : "text-slate-600"
              )}>
                {isExpired ? 'Expired' : formatDate(contract.expirationDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Risk & Progress */}
        <div className="flex items-center justify-between mb-4">
          {getRiskBadge(contract.riskScore)}
          {contract.status === 'processing' && contract.processing && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {contract.processing.progress}%
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div 
          className="flex items-center justify-between pt-3 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" 
                  onClick={onView}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-lg hover:bg-purple-50 transition-colors" 
                  onClick={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')}
                >
                  <Brain className="h-4 w-4 text-purple-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors" 
                  onClick={onShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-md border-slate-200/80 shadow-xl rounded-xl">
              <DropdownMenuItem onClick={onDownload} className="cursor-pointer hover:bg-green-50">
                <Download className="h-4 w-4 mr-2 text-green-600" /> Download
              </DropdownMenuItem>
              {/* Request Approval - Hidden for now, will be enabled in future */}
              {/* <DropdownMenuItem onClick={onApproval} className="cursor-pointer hover:bg-blue-50">
                <ClipboardCheck className="h-4 w-4 mr-2 text-blue-600" /> Request Approval
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600 cursor-pointer hover:bg-red-50">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
});

// ============ SORT OPTIONS ============
type SortField = 'title' | 'createdAt' | 'value' | 'expirationDate' | 'status';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'expirationDate', label: 'Expiration' },
  { value: 'status', label: 'Status' },
];

// Filter configuration
const CONTRACT_TYPES = [
  "Service Agreement",
  "NDA",
  "Employment",
  "Lease",
  "Vendor Agreement",
  "Consulting",
  "License",
  "Partnership",
];

const RISK_LEVELS = [
  { value: "low", label: "Low Risk", range: [0, 30] },
  { value: "medium", label: "Medium Risk", range: [30, 70] },
  { value: "high", label: "High Risk", range: [70, 100] },
];

// Approval statuses - Hidden for now, will be enabled in future
// const APPROVAL_STATUSES = [
//   { value: "pending", label: "Pending Approval", icon: Clock, color: "text-amber-600" },
//   { value: "approved", label: "Approved", icon: CheckCircle, color: "text-green-600" },
//   { value: "rejected", label: "Rejected", icon: AlertTriangle, color: "text-red-600" },
//   { value: "none", label: "No Approval", icon: FileText, color: "text-slate-500" },
// ];

// Value range presets
const VALUE_RANGES = [
  { value: 'under10k', label: 'Under $10K', min: 0, max: 10000 },
  { value: '10k-50k', label: '$10K - $50K', min: 10000, max: 50000 },
  { value: '50k-100k', label: '$50K - $100K', min: 50000, max: 100000 },
  { value: '100k-500k', label: '$100K - $500K', min: 100000, max: 500000 },
  { value: 'over500k', label: 'Over $500K', min: 500000, max: Infinity },
];

// Date range presets
const DATE_PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'week', label: 'This Week', days: 7 },
  { value: 'month', label: 'This Month', days: 30 },
  { value: 'quarter', label: 'This Quarter', days: 90 },
  { value: 'year', label: 'This Year', days: 365 },
];

// Expiration status options
const EXPIRATION_FILTERS = [
  { value: 'expired', label: 'Expired', icon: TimerOff, color: 'text-red-600' },
  { value: 'expiring-7', label: 'Expiring in 7 days', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'expiring-30', label: 'Expiring in 30 days', icon: CalendarClock, color: 'text-yellow-600' },
  { value: 'expiring-90', label: 'Expiring in 90 days', icon: Calendar, color: 'text-blue-600' },
  { value: 'no-expiry', label: 'No Expiration', icon: CircleDot, color: 'text-slate-500' },
];

// Pagination options
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Quick filter presets
const QUICK_PRESETS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  filters: {
    minValue?: number;
    expirationDays?: number;
    status?: string;
    risk?: string;
    createdDays?: number;
    approval?: string;
  };
}> = [
  { id: 'high-value-expiring', label: 'High Value Expiring Soon', icon: Zap, color: 'text-amber-600',
    filters: { minValue: 100000, expirationDays: 30 } },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle, color: 'text-red-600',
    filters: { status: 'failed', risk: 'high' } },
  { id: 'recent-high-risk', label: 'Recent High Risk', icon: Shield, color: 'text-orange-600',
    filters: { createdDays: 30, risk: 'high' } },
  // Pending Approval - Hidden for now, will be enabled in future
  // { id: 'pending-approval', label: 'Pending Approval', icon: Clock, color: 'text-blue-600',
  //   filters: { approval: 'pending' } },
];

export default function ContractsPage() {
  const router = useRouter();
  const { dataMode } = useDataMode();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [riskFilters, setRiskFilters] = useState<string[]>([]);
  const [approvalFilters, setApprovalFilters] = useState<string[]>([]);
  const [valueRangeFilter, setValueRangeFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(null);
  const [expirationFilters, setExpirationFilters] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{id: string; name: string; color: string; icon: string; contractCount?: number}>>([]);
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Saved filters
  const [savedFilters, setSavedFilters] = useState<Array<{id: string; name: string; filters: any}>>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [filterName, setFilterName] = useState('');
  
  // View mode: 'compact' for table-like rows, 'cards' for detailed cards, 'timeline' for Gantt view, 'kanban' for board view
  const [viewMode, setViewMode] = useState<'compact' | 'cards' | 'timeline' | 'kanban'>('compact');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Bulk selection state
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareContractId, setShareContractId] = useState<string | null>(null);
  const [shareContractTitle, setShareContractTitle] = useState<string>("");
  
  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalContractId, setApprovalContractId] = useState<string | null>(null);
  const [approvalContractTitle, setApprovalContractTitle] = useState<string>("");
  
  // AI Report modal state
  const [aiReportModalOpen, setAiReportModalOpen] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Use React Query for data fetching with caching
  const { 
    data: contractsData, 
    isLoading: loading, 
    refetch,
    error 
  } = useContracts({
    status: statusFilter === 'all' ? undefined : statusFilter,
    page: currentPage,
    limit: pageSize,
    sortBy: sortField,
    sortOrder: sortDirection,
    search: searchQuery || undefined,
  });
  
  const crossModule = useCrossModuleInvalidation();

  const contracts: Contract[] = contractsData?.contracts || [];
  
  // Fetch categories for filter
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/taxonomy', {
          headers: { 'x-tenant-id': 'demo' }
        });
        if (response.ok) {
          const data = await response.json();
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };
    fetchCategories();
  }, []);
  
  // Bulk categorize selected contracts
  const handleBulkCategorize = async () => {
    if (selectedContracts.size === 0) {
      toast.warning('No contracts selected');
      return;
    }
    
    setIsBulkCategorizing(true);
    try {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo'
        },
        body: JSON.stringify({
          contractIds: Array.from(selectedContracts),
          force: false
        })
      });
      
      if (!response.ok) throw new Error('Categorization failed');
      
      const data = await response.json();
      const successCount = data.data?.results?.filter((r: any) => r.success).length || 0;
      
      toast.success(`Categorized ${successCount} of ${selectedContracts.size} contracts`);
      refetch();
      setSelectedContracts(new Set());
    } catch (err) {
      console.error('Bulk categorize failed:', err);
      toast.error('Failed to categorize contracts');
    } finally {
      setIsBulkCategorizing(false);
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Escape - clear selection
      if (e.key === 'Escape') {
        setSelectedContracts(new Set());
        setSearchQuery('');
      }
      
      // Slash - focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const searchInput = document.querySelector('[data-testid="contract-search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      
      // R - refresh
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        refetch();
        toast.info('Refreshing contracts...');
      }
      
      // V - toggle view mode
      if (e.key === 'v' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setViewMode(prev => {
          if (prev === 'compact') return 'cards';
          if (prev === 'cards') return 'timeline';
          if (prev === 'timeline') return 'kanban';
          return 'compact';
        });
      }
      
      // N - new contract (go to upload)
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push('/upload');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refetch, router]);
  
  // Toggle selection for a single contract
  const toggleSelect = useCallback((contractId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  }, []);

  // Select/deselect all visible contracts
  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredContracts.map(c => c.id);
    setSelectedContracts(prev => {
      const allSelected = visibleIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(visibleIds);
      }
    });
  }, []);

  // Bulk operations
  const performBulkAction = async (action: 'export' | 'analyze' | 'delete' | 'share') => {
    if (selectedContracts.size === 0) return;
    
    setIsProcessingBulk(true);
    try {
      const response = await fetch('/api/contracts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': dataMode,
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          operation: action,
          contractIds: Array.from(selectedContracts),
        }),
      });

      if (!response.ok) throw new Error('Operation failed');
      
      const result = await response.json();
      toast.success(`Successfully ${action}ed ${selectedContracts.size} contracts`);
      
      if (action === 'delete') {
        refetch();
      }
      
      setSelectedContracts(new Set());
    } catch (error) {
      console.error('Bulk operation error:', error);
      toast.error(`Failed to ${action} contracts`);
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilters([]);
    setRiskFilters([]);
    setApprovalFilters([]);
    setValueRangeFilter(null);
    setDateRangeFilter(null);
    setExpirationFilters([]);
    setActivePreset(null);
    setAdvancedFilters({});
    setCategoryFilter(null);
  }, []);
  
  // Apply quick preset
  const applyPreset = useCallback((presetId: string) => {
    clearFilters();
    setActivePreset(presetId);
    const preset = QUICK_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    if (preset.filters.status) setStatusFilter(preset.filters.status);
    if (preset.filters.risk) setRiskFilters([preset.filters.risk]);
    if (preset.filters.approval) setApprovalFilters([preset.filters.approval]);
    if (preset.filters.minValue) {
      const range = VALUE_RANGES.find(r => r.min <= preset.filters.minValue! && r.max > preset.filters.minValue!);
      if (range) setValueRangeFilter(range.value);
    }
    if (preset.filters.expirationDays) {
      const exp = EXPIRATION_FILTERS.find(e => e.value === `expiring-${preset.filters.expirationDays}`);
      if (exp) setExpirationFilters([exp.value]);
    }
  }, [clearFilters]);

  // Contract action handlers
  const handleDownload = useCallback(async (contractId: string, format: 'json' | 'csv' | 'pdf' = 'pdf') => {
    try {
      toast.info('Preparing download...');
      const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`, {
        headers: { 'x-tenant-id': 'demo' },
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${contractId}.${format === 'pdf' ? 'html' : format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download contract');
    }
  }, []);

  const handleShare = useCallback((contractId: string, contractTitle: string) => {
    setShareContractId(contractId);
    setShareContractTitle(contractTitle);
    setShareDialogOpen(true);
  }, []);

  const handleRequestApproval = useCallback((contractId: string, contractTitle: string) => {
    setApprovalContractId(contractId);
    setApprovalContractTitle(contractTitle);
    setApprovalModalOpen(true);
  }, []);
  
  const handleApprovalSuccess = useCallback(() => {
    toast.success('Contract submitted for approval', {
      description: `${approvalContractTitle} has been sent for review`,
    });
    setApprovalModalOpen(false);
    setApprovalContractId(null);
    setApprovalContractTitle("");
    refetch();
  }, [approvalContractTitle, refetch]);

  // Open delete confirmation dialog
  const handleDeleteClick = useCallback((contractId: string, contractTitle: string) => {
    setContractToDelete({ id: contractId, title: contractTitle });
    setDeleteDialogOpen(true);
  }, []);

  // Confirm single delete
  const handleConfirmDelete = useCallback(async () => {
    if (!contractToDelete) return;
    
    try {
      toast.info('Deleting contract...');
      const response = await fetch(`/api/contracts/${contractToDelete.id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': 'demo' },
      });

      if (!response.ok) throw new Error('Delete failed');
      
      // Invalidate related caches
      crossModule.onContractChange(contractToDelete.id);
      
      toast.success('Contract deleted successfully');
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete contract');
    } finally {
      setContractToDelete(null);
    }
  }, [contractToDelete, crossModule, refetch]);

  // Bulk delete handler
  const handleBulkDeleteClick = useCallback(() => {
    if (selectedContracts.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedContracts.size]);

  const handleConfirmBulkDelete = useCallback(async () => {
    if (selectedContracts.size === 0) return;
    
    setIsProcessingBulk(true);
    try {
      const deletePromises = Array.from(selectedContracts).map(id =>
        fetch(`/api/contracts/${id}`, {
          method: 'DELETE',
          headers: { 'x-tenant-id': 'demo' },
        })
      );
      
      await Promise.all(deletePromises);
      
      // Invalidate all related caches
      crossModule.onContractChange();
      
      toast.success(`Deleted ${selectedContracts.size} contracts`);
      setSelectedContracts(new Set());
      refetch();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some contracts');
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedContracts, crossModule, refetch]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilters.length > 0 || riskFilters.length > 0 || approvalFilters.length > 0 || valueRangeFilter || dateRangeFilter || expirationFilters.length > 0 || activePreset || Object.keys(advancedFilters).length > 0 || categoryFilter;
  
  // Count active filters for badge
  const activeFilterCount = [
    searchQuery ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    typeFilters.length,
    riskFilters.length,
    approvalFilters.length,
    valueRangeFilter ? 1 : 0,
    dateRangeFilter ? 1 : 0,
    expirationFilters.length,
    categoryFilter ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  
  // Category stats
  const uncategorizedCount = contracts.filter(c => !c.category).length;
  const categorizedCount = contracts.length - uncategorizedCount;

  const filteredContracts = useMemo(() => {
    if (!Array.isArray(contracts)) return [];
    
    const now = new Date();
    
    return contracts.filter((contract) => {
      // Text search - search across multiple fields
      const matchesSearch =
        searchQuery === "" ||
        contract.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.parties?.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.type?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" || contract.status === statusFilter;

      // Contract type filter
      const matchesType = typeFilters.length === 0 || 
        (contract.type && typeFilters.includes(contract.type));

      // Risk level filter
      const matchesRisk = riskFilters.length === 0 || riskFilters.some(risk => {
        const level = RISK_LEVELS.find(l => l.value === risk);
        if (!level?.range || contract.riskScore === undefined || contract.riskScore === null) return false;
        return contract.riskScore >= (level.range[0] ?? 0) && contract.riskScore < (level.range[1] ?? 100);
      });

      // Approval status filter  
      const matchesApproval = approvalFilters.length === 0 || approvalFilters.some(approval => {
        const contractApprovalStatus = (contract as any).approvalStatus || 'none';
        return contractApprovalStatus === approval;
      });
      
      // Value range filter
      const matchesValueRange = !valueRangeFilter || (() => {
        const range = VALUE_RANGES.find(r => r.value === valueRangeFilter);
        if (!range || !contract.value) return false;
        return contract.value >= range.min && contract.value < range.max;
      })();
      
      // Date range filter (created date)
      const matchesDateRange = !dateRangeFilter || (() => {
        const preset = DATE_PRESETS.find(p => p.value === dateRangeFilter);
        if (!preset || !contract.createdAt) return false;
        const createdDate = new Date(contract.createdAt);
        const cutoffDate = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
        return createdDate >= cutoffDate;
      })();
      
      // Expiration filter
      const matchesExpiration = expirationFilters.length === 0 || expirationFilters.some(exp => {
        if (!contract.expirationDate && exp === 'no-expiry') return true;
        if (!contract.expirationDate) return false;
        
        const expirationDate = new Date(contract.expirationDate);
        const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (exp) {
          case 'expired': return daysUntilExpiry < 0;
          case 'expiring-7': return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
          case 'expiring-30': return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
          case 'expiring-90': return daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
          default: return true;
        }
      });

      // Advanced filters
      const matchesAdvanced = 
        (!advancedFilters.clientName || contract.parties?.client?.toLowerCase().includes(advancedFilters.clientName.toLowerCase())) &&
        (!advancedFilters.supplierName || contract.parties?.supplier?.toLowerCase().includes(advancedFilters.supplierName.toLowerCase())) &&
        (!advancedFilters.minValue || (contract.value && contract.value >= advancedFilters.minValue)) &&
        (!advancedFilters.maxValue || (contract.value && contract.value <= advancedFilters.maxValue));

      // Category filter
      const matchesCategory = !categoryFilter || 
        (categoryFilter === 'uncategorized' ? !contract.category : contract.category?.id === categoryFilter);

      return matchesSearch && matchesStatus && matchesType && matchesRisk && matchesApproval && matchesValueRange && matchesDateRange && matchesExpiration && matchesAdvanced && matchesCategory;
    });
  }, [contracts, searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters, advancedFilters, categoryFilter]);

  // Sort filtered contracts
  const sortedContracts = useMemo(() => {
    return [...filteredContracts].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'value':
          comparison = (a.value || 0) - (b.value || 0);
          break;
        case 'expirationDate':
          comparison = new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime();
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredContracts, sortField, sortDirection]);

  // Pagination - use server-side total
  const totalPages = Math.ceil((contractsData?.total ?? 0) / pageSize);
  // With server-side pagination, contracts are already the current page
  const paginatedContracts = sortedContracts;
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters]);

  // Inline stats for filtered results
  const filteredStats = useMemo(() => {
    const totalValue = sortedContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const avgValue = sortedContracts.length > 0 ? totalValue / sortedContracts.length : 0;
    const highRiskCount = sortedContracts.filter(c => (c.riskScore || 0) >= 70).length;
    const expiringCount = sortedContracts.filter(c => {
      if (!c.expirationDate) return false;
      const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    return { totalValue, avgValue, highRiskCount, expiringCount };
  }, [sortedContracts]);

  // Export filtered results
  const handleExportFiltered = useCallback(async (format: 'csv' | 'json') => {
    try {
      toast.info(`Exporting ${sortedContracts.length} contracts...`);
      
      if (format === 'json') {
        const data = JSON.stringify(sortedContracts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV export
        const headers = ['Title', 'Status', 'Client', 'Supplier', 'Value', 'Created', 'Expiration', 'Risk Score'];
        const rows = sortedContracts.map(c => [
          c.title || '',
          c.status || '',
          c.parties?.client || '',
          c.parties?.supplier || '',
          c.value?.toString() || '',
          c.createdAt || '',
          c.expirationDate || '',
          c.riskScore?.toString() || ''
        ]);
        const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      toast.success(`Exported ${sortedContracts.length} contracts`);
    } catch (error) {
      toast.error('Export failed');
    }
  }, [sortedContracts]);
  
  // Save current filters
  const handleSaveFilter = useCallback(() => {
    if (!filterName.trim()) return;
    const newFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: {
        statusFilter,
        typeFilters,
        riskFilters,
        approvalFilters,
        valueRangeFilter,
        dateRangeFilter,
        expirationFilters,
      }
    };
    setSavedFilters(prev => [...prev, newFilter]);
    setFilterName('');
    setShowSaveFilterModal(false);
    toast.success(`Filter "${filterName}" saved`);
  }, [filterName, statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters]);
  
  // Load saved filter
  const handleLoadFilter = useCallback((filter: typeof savedFilters[0]) => {
    clearFilters();
    if (filter.filters.statusFilter) setStatusFilter(filter.filters.statusFilter);
    if (filter.filters.typeFilters) setTypeFilters(filter.filters.typeFilters);
    if (filter.filters.riskFilters) setRiskFilters(filter.filters.riskFilters);
    if (filter.filters.approvalFilters) setApprovalFilters(filter.filters.approvalFilters);
    if (filter.filters.valueRangeFilter) setValueRangeFilter(filter.filters.valueRangeFilter);
    if (filter.filters.dateRangeFilter) setDateRangeFilter(filter.filters.dateRangeFilter);
    if (filter.filters.expirationFilters) setExpirationFilters(filter.filters.expirationFilters);
    toast.success(`Loaded filter "${filter.name}"`);
  }, [clearFilters]);

  // After sortedContracts is computed, we need to fix toggleSelectAll
  const allVisibleSelected = useMemo(() => {
    if (paginatedContracts.length === 0) return false;
    return paginatedContracts.every(c => selectedContracts.has(c.id));
  }, [paginatedContracts, selectedContracts]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: "Active", color: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700", icon: CheckCircle },
      processing: { label: "Processing", color: "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700", icon: Loader2 },
      failed: { label: "Failed", color: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700", icon: AlertTriangle },
      pending: { label: "Pending", color: "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700", icon: Clock },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      color: "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700",
      icon: CircleDot,
    };

    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0 gap-1.5 px-2.5 py-0.5 rounded-full shadow-sm font-medium`}>
        <Icon className={cn("h-3 w-3", status === 'processing' && "animate-spin")} />
        {config.label}
      </Badge>
    );
  };

  const getRiskBadge = (riskScore?: number) => {
    if (!riskScore) return null;

    if (riskScore < 30) {
      return (
        <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-0 gap-1.5 px-2.5 py-0.5 rounded-full shadow-sm font-medium">
          <Shield className="h-3 w-3" />
          Low Risk
        </Badge>
      );
    } else if (riskScore < 70) {
      return (
        <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border-0 gap-1.5 px-2.5 py-0.5 rounded-full shadow-sm font-medium">
          <Shield className="h-3 w-3" />
          Medium Risk
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border-0 gap-1.5 px-2.5 py-0.5 rounded-full shadow-sm font-medium">
          <AlertTriangle className="h-3 w-3" />
          High Risk
        </Badge>
      );
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-12">
          <div className="flex flex-col items-center justify-center h-96 gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-20 animate-pulse" />
              <motion.div
                className="relative bg-white rounded-full p-6 shadow-xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-10 w-10 text-blue-600" />
              </motion.div>
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-medium">Loading contracts...</p>
              <p className="text-slate-400 text-sm mt-1">Fetching your contract portfolio</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6">
          <PageBreadcrumb />
          
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <FileText className="h-6 w-6 text-slate-700" />
                <h1 className="text-2xl font-semibold text-slate-900">Contracts</h1>
              </div>
              <p className="text-slate-500 text-sm">
                Manage your contract portfolio with AI-powered insights
              </p>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetch()}
                    className="h-9"
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Refresh
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    Refresh list
                    <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">R</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAdvancedSearch(true)}
                className="h-9"
              >
                <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                Advanced
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="h-9"
              >
                <Link href="/settings/taxonomy">
                  <Tag className="h-4 w-4 mr-1.5" />
                  Taxonomy
                </Link>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                    <Link href="/upload">
                      <Upload className="h-4 w-4 mr-1.5" />
                      Upload Contract
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    Upload new contract
                    <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">N</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" size="sm" className="h-9">
                    <Link href="/import/external-database">
                      <Database className="h-4 w-4 mr-1.5" />
                      Import from DB
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Import contracts from external database
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6 space-y-5">

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedContracts.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-white text-slate-800 font-semibold px-2.5 py-1">
                        {selectedContracts.size}
                      </Badge>
                      <span className="font-medium text-white text-sm">
                        contract{selectedContracts.size !== 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white hover:bg-slate-700 h-7"
                        onClick={() => setSelectedContracts(new Set())}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-white border-0 h-8"
                            onClick={() => performBulkAction('export')}
                            disabled={isProcessingBulk}
                          >
                            {isProcessingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="hidden sm:inline ml-1.5">Export</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-white border-0 h-8"
                            onClick={() => performBulkAction('analyze')}
                            disabled={isProcessingBulk}
                          >
                            <Brain className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">Analyze</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Run AI analysis on selected</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700 text-white border-0 h-8"
                            onClick={() => setAiReportModalOpen(true)}
                            disabled={isProcessingBulk}
                          >
                            <FileBarChart className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">Report</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generate comprehensive AI report for selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 h-8"
                            onClick={handleBulkCategorize}
                            disabled={isProcessingBulk || isBulkCategorizing}
                          >
                            {isBulkCategorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                            <span className="hidden sm:inline ml-1.5">Categorize</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Auto-categorize selected contracts with AI</TooltipContent>
                      </Tooltip>
                      
                      {selectedContracts.size === 2 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white border-0 h-8"
                              onClick={() => {
                                const ids = Array.from(selectedContracts);
                                router.push(`/compare?contract1=${ids[0]}&contract2=${ids[1]}`);
                              }}
                              disabled={isProcessingBulk}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                              <span className="hidden sm:inline ml-1.5">Compare</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Compare selected contracts side-by-side</TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-white border-0 h-8"
                            onClick={() => performBulkAction('share')}
                            disabled={isProcessingBulk}
                          >
                            <Share2 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">Share</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white border-0 h-8"
                            onClick={handleBulkDeleteClick}
                            disabled={isProcessingBulk}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1.5">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete selected contracts</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats - Click to filter */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card 
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white border-slate-200",
                statusFilter === 'all' && "ring-2 ring-blue-500 border-blue-300"
              )}
              onClick={() => setStatusFilter('all')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">
                      {contractsData?.total ?? 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">contracts</p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card 
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white border-slate-200",
                statusFilter === 'completed' && "ring-2 ring-emerald-500 border-emerald-300"
              )}
              onClick={() => setStatusFilter('completed')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">
                      {Array.isArray(contracts) ? contracts.filter((c) => c.status === "completed").length : 0}
                    </p>
                    <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      ready
                    </p>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card 
              data-testid="stat-processing" 
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white border-slate-200",
                statusFilter === 'processing' && "ring-2 ring-blue-500 border-blue-300"
              )}
              onClick={() => setStatusFilter('processing')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Processing</p>
                    <p className="text-2xl font-bold text-blue-600 mt-0.5">
                      {Array.isArray(contracts) ? contracts.filter((c) => c.status === "processing").length : 0}
                    </p>
                    <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      analyzing
                    </p>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Brain className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card 
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white border-slate-200",
                sortField === 'value' && sortDirection === 'desc' && "ring-2 ring-violet-500 border-violet-300"
              )}
              onClick={() => {
                setSortField('value');
                setSortDirection('desc');
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Value</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">
                      {formatCurrency(
                        Array.isArray(contracts) ? contracts.reduce((sum, c) => sum + (c.value || 0), 0) : 0
                      )}
                    </p>
                    <p className="text-xs text-violet-500 mt-0.5">portfolio total</p>
                  </div>
                  <div className="p-2.5 bg-violet-50 rounded-lg group-hover:bg-violet-100 transition-colors">
                    <DollarSign className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card 
              className={cn(
                "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-white border-slate-200",
                categoryFilter === 'uncategorized' && "ring-2 ring-amber-500 border-amber-300"
              )}
              onClick={() => setCategoryFilter(categoryFilter === 'uncategorized' ? null : 'uncategorized')}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Categorized</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">
                      {categorizedCount}<span className="text-base text-slate-400">/{contracts.length}</span>
                    </p>
                    <p className={cn(
                      "text-xs mt-0.5 flex items-center gap-1",
                      uncategorizedCount > 0 ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {uncategorizedCount > 0 ? (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          {uncategorizedCount} pending
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          complete
                        </>
                      )}
                    </p>
                  </div>
                  <div className="p-2.5 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <Tag className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Quick Presets Row */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500 mr-1">Quick:</span>
              {QUICK_PRESETS.map((preset) => {
                const PresetIcon = preset.icon;
                return (
                  <Button
                    key={preset.id}
                    variant={activePreset === preset.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => activePreset === preset.id ? clearFilters() : applyPreset(preset.id)}
                    className={cn(
                      "gap-1.5 text-xs h-7",
                      activePreset === preset.id 
                        ? "bg-slate-800 hover:bg-slate-900" 
                        : "hover:border-slate-300 hover:bg-white"
                    )}
                  >
                    <PresetIcon className={cn("h-3 w-3", activePreset !== preset.id && preset.color)} />
                    {preset.label}
                  </Button>
                );
              })}
            </div>
            
            {/* Search Row */}
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search contracts by name, client, supplier, or type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white"
                    data-testid="contract-search"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "gap-1.5 h-10 px-3",
                    showFilters 
                      ? "bg-blue-50 border-blue-200 text-blue-700" 
                      : ""
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="bg-blue-600 text-white h-5 px-1.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>
              
              {/* Collapsible Filters Row */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-slate-100">
                      {/* Status Filters */}
                      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg" data-testid="status-filters">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatusFilter("all")}
                          data-testid="filter-all"
                          className={cn(
                            "h-8 px-3 rounded-md transition-all",
                            statusFilter === "all" 
                              ? "bg-white shadow-sm text-blue-700 font-medium" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatusFilter("completed")}
                          data-testid="filter-active"
                          className={cn(
                            "h-8 px-3 rounded-md transition-all",
                            statusFilter === "completed" 
                              ? "bg-white shadow-sm text-emerald-700 font-medium" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                          Active
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatusFilter("processing")}
                          data-testid="filter-processing"
                          className={cn(
                            "h-8 px-3 rounded-md transition-all",
                            statusFilter === "processing" 
                              ? "bg-white shadow-sm text-blue-700 font-medium" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Loader2 className={cn("h-3.5 w-3.5 mr-1.5", statusFilter === "processing" && "animate-spin")} />
                          Processing
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setStatusFilter("failed")}
                          data-testid="filter-failed"
                          className={cn(
                            "h-8 px-3 rounded-md transition-all",
                            statusFilter === "failed" 
                              ? "bg-white shadow-sm text-red-700 font-medium" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                          Failed
                        </Button>
                      </div>

                      <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                      {/* Risk Level Filters */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2 h-8 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
                            <Shield className="h-4 w-4 text-slate-500" />
                            Risk
                            {riskFilters.length > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 h-5 px-1.5 text-xs border-0">
                                {riskFilters.length}
                              </Badge>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {RISK_LEVELS.map((level) => (
                            <DropdownMenuItem
                              key={level.value}
                              onClick={() => {
                          setRiskFilters(prev => 
                            prev.includes(level.value) 
                              ? prev.filter(r => r !== level.value)
                              : [...prev, level.value]
                          );
                        }}
                      >
                        <Checkbox
                          checked={riskFilters.includes(level.value)}
                          className="mr-2"
                        />
                        {level.label}
                      </DropdownMenuItem>
                    ))}
                    {riskFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setRiskFilters([])}>
                          Clear risk filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Approval Status Filters - Hidden for now, will be enabled in future */}
                {/* <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Approval
                      {approvalFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {approvalFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {APPROVAL_STATUSES.map((status) => {
                      const StatusIcon = status.icon;
                      return (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => {
                            setApprovalFilters(prev => 
                              prev.includes(status.value) 
                                ? prev.filter(a => a !== status.value)
                                : [...prev, status.value]
                            );
                          }}
                        >
                          <Checkbox
                            checked={approvalFilters.includes(status.value)}
                            className="mr-2"
                          />
                          <StatusIcon className={`h-4 w-4 mr-2 ${status.color}`} />
                          {status.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {approvalFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setApprovalFilters([])}>
                          Clear approval filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu> */}

                <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

                {/* Contract Type Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Tag className="h-4 w-4" />
                      Type
                      {typeFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {typeFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {CONTRACT_TYPES.map((type) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          setTypeFilters(prev => 
                            prev.includes(type) 
                              ? prev.filter(t => t !== type)
                              : [...prev, type]
                          );
                        }}
                      >
                        <Checkbox
                          checked={typeFilters.includes(type)}
                          className="mr-2"
                        />
                        {type}
                      </DropdownMenuItem>
                    ))}
                    {typeFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTypeFilters([])}>
                          Clear type filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Category Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Hash className="h-4 w-4" />
                      Category
                      {categoryFilter && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          1
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem
                      onClick={() => setCategoryFilter(null)}
                      className={!categoryFilter ? "bg-blue-50" : ""}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        !categoryFilter ? "bg-blue-600" : "bg-slate-200"
                      )} />
                      All Categories
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCategoryFilter('uncategorized')}
                      className={categoryFilter === 'uncategorized' ? "bg-amber-50" : ""}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        categoryFilter === 'uncategorized' ? "bg-amber-600" : "bg-slate-200"
                      )} />
                      Uncategorized
                      <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                        {uncategorizedCount}
                      </Badge>
                    </DropdownMenuItem>
                    {categories.length > 0 && <DropdownMenuSeparator />}
                    {categories.map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={categoryFilter === cat.id ? "bg-blue-50" : ""}
                      >
                        <div 
                          className="w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: categoryFilter === cat.id ? cat.color : '#e2e8f0' }}
                        />
                        <span className="truncate">{cat.name}</span>
                        {cat.contractCount !== undefined && (
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                            {cat.contractCount}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                    {categoryFilter && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
                          Clear category filter
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Value Range Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Banknote className="h-4 w-4" />
                      Value
                      {valueRangeFilter && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          1
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {VALUE_RANGES.map((range) => (
                      <DropdownMenuItem
                        key={range.value}
                        onClick={() => setValueRangeFilter(valueRangeFilter === range.value ? null : range.value)}
                        className={valueRangeFilter === range.value ? "bg-blue-50" : ""}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mr-2",
                          valueRangeFilter === range.value ? "bg-blue-600" : "bg-slate-200"
                        )} />
                        {range.label}
                      </DropdownMenuItem>
                    ))}
                    {valueRangeFilter && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setValueRangeFilter(null)}>
                          Clear value filter
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Date Range Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Created
                      {dateRangeFilter && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          1
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {DATE_PRESETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.value}
                        onClick={() => setDateRangeFilter(dateRangeFilter === preset.value ? null : preset.value)}
                        className={dateRangeFilter === preset.value ? "bg-blue-50" : ""}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mr-2",
                          dateRangeFilter === preset.value ? "bg-blue-600" : "bg-slate-200"
                        )} />
                        {preset.label}
                      </DropdownMenuItem>
                    ))}
                    {dateRangeFilter && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDateRangeFilter(null)}>
                          Clear date filter
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Expiration Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Expiration
                      {expirationFilters.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {expirationFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {EXPIRATION_FILTERS.map((exp) => {
                      const ExpIcon = exp.icon;
                      return (
                        <DropdownMenuItem
                          key={exp.value}
                          onClick={() => {
                            setExpirationFilters(prev => 
                              prev.includes(exp.value) 
                                ? prev.filter(e => e !== exp.value)
                                : [...prev, exp.value]
                            );
                          }}
                        >
                          <Checkbox
                            checked={expirationFilters.includes(exp.value)}
                            className="mr-2"
                          />
                          <ExpIcon className={cn("h-4 w-4 mr-2", exp.color)} />
                          {exp.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {expirationFilters.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setExpirationFilters([])}>
                          Clear expiration filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-slate-100"
                >
                  {activePreset && (
                    <Badge className="bg-slate-800 text-white gap-1 pr-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      {QUICK_PRESETS.find(p => p.id === activePreset)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-slate-700 rounded-full"
                        onClick={() => setActivePreset(null)}
                      >
                        <X className="h-3 w-3 text-white" />
                      </Button>
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge className="bg-blue-100 text-blue-800 gap-1 pr-1 border-0">
                      <CheckCircle className="h-3 w-3" />
                      Status: {statusFilter}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-blue-200 rounded-full"
                        onClick={() => setStatusFilter('all')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge className="bg-purple-100 text-purple-800 gap-1 pr-1 border-0">
                      <Search className="h-3 w-3" />
                      "{searchQuery}"
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-purple-200 rounded-full"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {typeFilters.map(type => (
                    <Badge key={type} className="bg-indigo-100 text-indigo-800 gap-1 pr-1 border-0">
                      <Tag className="h-3 w-3" />
                      {type}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-indigo-200 rounded-full"
                        onClick={() => setTypeFilters(prev => prev.filter(t => t !== type))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {riskFilters.map(risk => (
                    <Badge key={risk} className="bg-orange-100 text-orange-800 gap-1 pr-1 border-0">
                      <Shield className="h-3 w-3" />
                      {RISK_LEVELS.find(l => l.value === risk)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-orange-200 rounded-full"
                        onClick={() => setRiskFilters(prev => prev.filter(r => r !== risk))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {/* Approval filter badges - Hidden for now, will be enabled in future */}
                  {/* {approvalFilters.map(approval => (
                    <Badge key={approval} className="bg-cyan-100 text-cyan-800 gap-1 pr-1 border-0">
                      <ClipboardCheck className="h-3 w-3" />
                      {APPROVAL_STATUSES.find(s => s.value === approval)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-cyan-200 rounded-full"
                        onClick={() => setApprovalFilters(prev => prev.filter(a => a !== approval))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))} */}
                  {valueRangeFilter && (
                    <Badge className="bg-emerald-100 text-emerald-800 gap-1 pr-1 border-0">
                      <Banknote className="h-3 w-3" />
                      {VALUE_RANGES.find(r => r.value === valueRangeFilter)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-emerald-200 rounded-full"
                        onClick={() => setValueRangeFilter(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {dateRangeFilter && (
                    <Badge className="bg-pink-100 text-pink-800 gap-1 pr-1 border-0">
                      <CalendarDays className="h-3 w-3" />
                      {DATE_PRESETS.find(p => p.value === dateRangeFilter)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-pink-200 rounded-full"
                        onClick={() => setDateRangeFilter(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {expirationFilters.map(exp => (
                    <Badge key={exp} className="bg-orange-100 text-orange-800 gap-1 pr-1 border-0">
                      <CalendarClock className="h-3 w-3" />
                      {EXPIRATION_FILTERS.find(e => e.value === exp)?.label}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-orange-200 rounded-full"
                        onClick={() => setExpirationFilters(prev => prev.filter(e => e !== exp))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {advancedFilters.clientName && (
                    <Badge className="bg-cyan-100 text-cyan-800 gap-1 pr-1 border-0">
                      <Building2 className="h-3 w-3" />
                      Client: {advancedFilters.clientName}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-cyan-200 rounded-full"
                        onClick={() => setAdvancedFilters(prev => ({ ...prev, clientName: undefined }))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                  {advancedFilters.supplierName && (
                    <Badge className="bg-teal-100 text-teal-800 gap-1 pr-1 border-0">
                      <Truck className="h-3 w-3" />
                      Supplier: {advancedFilters.supplierName}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1 hover:bg-teal-200 rounded-full"
                        onClick={() => setAdvancedFilters(prev => ({ ...prev, supplierName: undefined }))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  )}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inline Stats Summary (when filtered) */}
        {hasActiveFilters && sortedContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-4 sm:gap-5 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-slate-500" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900">{sortedContracts.length}</span>
                <span className="text-slate-500"> results</span>
              </span>
            </div>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-500" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900">{formatCurrency(filteredStats.totalValue)}</span>
                <span className="text-slate-500"> total</span>
              </span>
            </div>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-slate-500" />
              <span className="text-sm">
                <span className="font-semibold text-slate-900">{formatCurrency(filteredStats.avgValue)}</span>
                <span className="text-slate-500"> avg</span>
              </span>
            </div>
            {filteredStats.highRiskCount > 0 && (
              <>
                <div className="h-4 w-px bg-slate-300 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  <span className="text-sm">
                    <span className="font-semibold text-red-600">{filteredStats.highRiskCount}</span>
                    <span className="text-slate-500"> high risk</span>
                  </span>
                </div>
              </>
            )}
            {filteredStats.expiringCount > 0 && (
              <>
                <div className="h-4 w-px bg-slate-300 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">
                    <span className="font-semibold text-amber-600">{filteredStats.expiringCount}</span>
                    <span className="text-slate-500"> expiring soon</span>
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Uncategorized Contracts Banner */}
        {uncategorizedCount > 0 && uncategorizedCount <= 20 && !categoryFilter && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {uncategorizedCount} contract{uncategorizedCount !== 1 ? 's' : ''} need{uncategorizedCount === 1 ? 's' : ''} categorization
                </p>
                <p className="text-xs text-amber-600">
                  AI can automatically categorize them based on content
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCategoryFilter('uncategorized')}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 h-8"
              >
                View All
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const uncategorizedIds = contracts.filter(c => !c.category).map(c => c.id);
                  if (uncategorizedIds.length === 0) return;
                  
                  // Directly trigger categorization for all uncategorized contracts
                  setIsBulkCategorizing(true);
                  try {
                    const response = await fetch('/api/contracts/categorize', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'x-tenant-id': 'demo'
                      },
                      body: JSON.stringify({
                        contractIds: uncategorizedIds,
                        force: false
                      })
                    });
                    
                    if (!response.ok) throw new Error('Categorization failed');
                    
                    const data = await response.json();
                    const successCount = data.data?.results?.filter((r: { success: boolean }) => r.success).length || 0;
                    
                    toast.success(`Categorized ${successCount} of ${uncategorizedIds.length} contracts`);
                    refetch();
                  } catch (err) {
                    console.error('Auto-categorize failed:', err);
                    toast.error('Failed to categorize contracts');
                  } finally {
                    setIsBulkCategorizing(false);
                  }
                }}
                disabled={isBulkCategorizing}
                className="bg-amber-600 hover:bg-amber-700 text-white h-8"
              >
                {isBulkCategorizing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                Select & Categorize
              </Button>
            </div>
          </motion.div>
        )}

        {/* View Mode Toggle, Sort, Export & Results Count */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{contractsData?.total ?? 0}</span>
              contract{(contractsData?.total ?? 0) !== 1 ? 's' : ''}
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">filtered</Badge>
              )}
            </div>
            
            {/* Save Filter */}
            {hasActiveFilters && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1.5 text-slate-600 hover:text-blue-600 h-8"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="text-sm">Save</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <div className="p-2">
                    <Input
                      placeholder="Filter name..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
                    />
                  </div>
                  <DropdownMenuItem 
                    onClick={handleSaveFilter} 
                    disabled={!filterName.trim()}
                  >
                    <BookmarkCheck className="h-4 w-4 mr-2 text-blue-600" />
                    Save current filter
                  </DropdownMenuItem>
                  {savedFilters.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1 text-xs font-medium text-slate-500">Saved Filters</div>
                      {savedFilters.map(filter => (
                        <DropdownMenuItem key={filter.id} onClick={() => handleLoadFilter(filter)}>
                          <ListFilter className="h-4 w-4 mr-2" />
                          {filter.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 h-8"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportFiltered('csv')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFiltered('json')}>
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5 h-8"
                >
                  {sortDirection === 'asc' ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {SORT_OPTIONS.find(o => o.value === sortField)?.label || 'Sort'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => {
                      if (sortField === option.value) {
                        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(option.value);
                        setSortDirection('desc');
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between",
                      sortField === option.value && "bg-blue-50"
                    )}
                  >
                    <span>{option.label}</span>
                    {sortField === option.value && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                      )
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* View Toggle */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('compact')}
                    className={cn(
                      "h-7 w-7 p-0 rounded",
                      viewMode === 'compact' 
                        ? "bg-white shadow-sm text-blue-600" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('cards')}
                    className={cn(
                      "h-7 w-7 p-0 rounded",
                      viewMode === 'cards' 
                        ? "bg-white shadow-sm text-blue-600" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Card View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('timeline')}
                    className={cn(
                      "h-7 w-7 p-0 rounded",
                      viewMode === 'timeline' 
                        ? "bg-white shadow-sm text-emerald-600" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <GanttChartSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Timeline View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                    className={cn(
                      "h-7 w-7 p-0 rounded",
                      viewMode === 'kanban' 
                        ? "bg-white shadow-sm text-violet-600" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Kanban className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Kanban View</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Contracts List */}
        <AnimatePresence mode="wait">
          {sortedContracts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-white border-slate-200">
                <CardContent className="p-0">
                  {(searchQuery || statusFilter !== "all" || hasActiveFilters) ? (
                    <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                        <Search className="h-7 w-7 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No matching contracts</h3>
                      <p className="text-slate-500 text-sm mb-5 max-w-md">
                        No contracts found matching your current filters.
                      </p>
                      <Button
                        onClick={clearFilters}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-1.5" />
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
                      <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                        <FileText className="h-7 w-7 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">No contracts yet</h3>
                      <p className="text-slate-500 text-sm mb-5 max-w-md">
                        Upload your first contract to get started.
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Link href="/upload">
                          <Upload className="h-4 w-4 mr-1.5" />
                          Upload contract
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : viewMode === 'compact' ? (
            /* ============ COMPACT LIST VIEW ============ */
            <motion.div 
              key="compact-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="overflow-hidden bg-white border-slate-200 shadow-sm">
                {/* Table Header - Sticky */}
                <div className="grid grid-cols-[44px_1fr_140px_140px_140px_120px_130px_110px_50px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                  <div className="flex items-center">
                    <Checkbox
                      checked={allVisibleSelected && paginatedContracts.length > 0}
                      onCheckedChange={() => {
                        const visibleIds = paginatedContracts.map(c => c.id);
                        setSelectedContracts(prev => {
                          if (allVisibleSelected) return new Set();
                          return new Set(visibleIds);
                        });
                      }}
                      aria-label="Select all on this page"
                    />
                  </div>
                  <div>Contract</div>
                  <div className="hidden lg:block">Category</div>
                  <div className="hidden lg:block">Type</div>
                  <div className="hidden md:block">Party</div>
                  <div className="hidden lg:block">Value</div>
                  <div className="hidden md:block">Expires</div>
                  <div>Status</div>
                  <div></div>
                </div>
                
                {/* Table Body */}
                <div data-testid="contracts-list">
                  {paginatedContracts.map((contract, index) => (
                    <CompactContractRow
                      key={contract.id}
                      contract={contract}
                      index={index}
                      isSelected={selectedContracts.has(contract.id)}
                      onSelect={() => toggleSelect(contract.id)}
                      onView={() => router.push(`/contracts/${contract.id}`)}
                      onShare={() => handleShare(contract.id, contract.title || 'Contract')}
                      onDelete={() => handleDeleteClick(contract.id, contract.title || 'Contract')}
                      onDownload={() => handleDownload(contract.id)}
                      onApproval={() => handleRequestApproval(contract.id, contract.title || 'Contract')}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : viewMode === 'cards' ? (
            /* ============ CARD VIEW ============ */
            <motion.div 
              key="card-list"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" 
              data-testid="contracts-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {paginatedContracts.map((contract, index) => (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <ContractCard
                    contract={contract}
                    isSelected={selectedContracts.has(contract.id)}
                    onSelect={() => toggleSelect(contract.id)}
                    onView={() => router.push(`/contracts/${contract.id}`)}
                    onShare={() => handleShare(contract.id, contract.title || 'Contract')}
                    onDelete={() => handleDeleteClick(contract.id, contract.title || 'Contract')}
                    onDownload={() => handleDownload(contract.id)}
                    onApproval={() => handleRequestApproval(contract.id, contract.title || 'Contract')}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    getRiskBadge={getRiskBadge}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : viewMode === 'timeline' ? (
            /* ============ TIMELINE VIEW ============ */
            <motion.div
              key="timeline-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ContractTimeline
                contracts={paginatedContracts.map(contract => ({
                  id: contract.id,
                  title: contract.title || 'Untitled Contract',
                  startDate: contract.effectiveDate ? new Date(contract.effectiveDate) : new Date(contract.createdAt || Date.now()),
                  endDate: contract.expirationDate ? new Date(contract.expirationDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                  status: (contract.status || 'draft') as 'draft' | 'active' | 'pending' | 'expired' | 'expiring',
                  supplierName: contract.parties?.supplier || 'Unknown Party',
                  value: contract.value ?? undefined,
                  events: contract.expirationDate ? [
                    {
                      id: `${contract.id}-renewal`,
                      contractId: contract.id,
                      contractTitle: contract.title || 'Untitled Contract',
                      date: new Date(new Date(contract.expirationDate).setMonth(new Date(contract.expirationDate).getMonth() - 1)),
                      type: 'renewal' as const,
                      description: 'Renewal Decision',
                      status: 'upcoming' as const,
                    }
                  ] : [],
                }))}
                onContractClick={(contractId) => router.push(`/contracts/${contractId}`)}
              />
            </motion.div>
          ) : (
            /* ============ KANBAN VIEW ============ */
            <motion.div
              key="kanban-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ContractKanban
                contracts={paginatedContracts.map(contract => ({
                  id: contract.id,
                  title: contract.title || 'Untitled Contract',
                  supplierName: contract.parties?.supplier || 'Unknown Party',
                  totalValue: contract.value ?? undefined,
                  currency: 'USD',
                  status: (contract.status || 'draft') as 'draft' | 'pending_review' | 'in_negotiation' | 'pending_approval' | 'active' | 'expiring' | 'expired' | 'archived',
                  expirationDate: contract.expirationDate ? new Date(contract.expirationDate) : undefined,
                  priority: 'medium' as const,
                  tags: [contract.parties?.supplier || 'Contract'].slice(0, 2),
                }))}
                onContractClick={(contractId) => router.push(`/contracts/${contractId}`)}
                onStatusChange={(contractId, newStatus) => {
                  toast.success(`Contract moved to ${newStatus.replace('_', ' ')}`);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Pagination Controls */}
        {sortedContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Show</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-slate-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-slate-300"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Page Info */}
                  <div className="text-sm text-slate-600">
                    <span className="font-medium">{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, contractsData?.total ?? 0)}</span>
                    <span className="text-slate-400"> of </span>
                    <span className="font-medium">{contractsData?.total ?? 0}</span>
                  </div>
                  
                  {/* Page Navigation */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-md border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      title="First page"
                    >
                      <ChevronsLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-md border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              "min-w-[32px] h-8 text-sm font-medium rounded-md transition-colors",
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-md border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-md border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      title="Last page"
                    >
                      <ChevronsRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
      
      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={showAdvancedSearch}
        onOpenChange={setShowAdvancedSearch}
        onSearch={(filters) => {
          setAdvancedFilters(filters);
          if (filters.query) {
            setSearchQuery(filters.query);
          }
        }}
        initialFilters={advancedFilters}
      />
      
      {/* Share Dialog */}
      {shareContractId && (
        <ShareDialog
          isOpen={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setShareContractId(null);
          }}
          documentId={shareContractId}
          documentType="contract"
          documentTitle={shareContractTitle}
        />
      )}
      
      {/* Submit for Approval Modal - Hidden for now, will be enabled in future */}
      {/* {approvalContractId && (
        <SubmitForApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => {
            setApprovalModalOpen(false);
            setApprovalContractId(null);
            setApprovalContractTitle("");
          }}
          contractId={approvalContractId}
          contractTitle={approvalContractTitle}
          onSuccess={handleApprovalSuccess}
        />
      )} */}
      
      {/* AI Report Modal */}
      <AIReportModal
        isOpen={aiReportModalOpen}
        onClose={() => setAiReportModalOpen(false)}
        contractIds={Array.from(selectedContracts)}
        contractNames={contracts
          .filter(c => selectedContracts.has(c.id))
          .map(c => c.title || c.filename || 'Untitled')
        }
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Contract"
        description={`Are you sure you want to delete "${contractToDelete?.title}"? This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
      
      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title="Delete Multiple Contracts"
        description={`Are you sure you want to delete ${selectedContracts.size} contracts? This action cannot be undone.`}
        variant="destructive"
        confirmLabel="Delete All"
        onConfirm={handleConfirmBulkDelete}
        isLoading={isProcessingBulk}
      />
    </div>
    </TooltipProvider>
  );
}

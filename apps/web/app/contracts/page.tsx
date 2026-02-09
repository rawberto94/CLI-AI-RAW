/**
 * Enhanced Contracts List Page v2.0
 * Premium UI/UX with Hero Dashboard, Smart Filters, Preview Panel
 * Integrated filters, bulk selection, cross-module actions
 * Preserves RAG and chatbot data flows
 * 
 * v2.1 - Live Updates & Enhanced UI
 * - Real-time auto-refresh with configurable intervals
 * - Visual pulse indicators for live data
 * - Animated stat counters
 * - Skeleton loading states
 * - Processing contracts live progress tracking
 * 
 * Note: This file contains features in active development. Some variables
 * are defined for future use and are intentionally preserved.
 */



"use client";

import { useState, useMemo, useCallback, memo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBoundary } from "@/components/error-boundary/ErrorBoundary";
import { AdvancedSearchModal, type AdvancedSearchFilters } from "@/components/contracts/AdvancedSearchModal";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { AdvancedFilterPanel, type FilterState } from "@/components/contracts/AdvancedFilterPanel";
import { DragDropFilterBuilder } from "@/components/contracts/DragDropFilterBuilder";
import { ActiveFilterChips } from "@/components/contracts/ActiveFilterChips";
import { SavedSearchPresets, type SavedSearch } from "@/components/contracts/SavedSearchPresets";
import { HighlightText } from "@/components/contracts/HighlightText";
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
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Calendar,
  Banknote,
  Shield,
  RefreshCw,
  Filter,
  MoreHorizontal,
  Download,
  Trash2,
  Share2,
  Brain,
  X,
  LayoutGrid,
  LayoutList,
  Building2,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  CalendarClock,
  Tag,
  TimerOff,
  CircleDot,
  FileDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  FileBarChart,
  Database,
  ArrowLeftRight,
  Activity,
  Wand2,
  Scale,
  Edit3,
  GitBranch,
  CheckCircle2,
  XCircle,
  FileWarning,
  Zap,
  CalendarOff,
  User,
} from "lucide-react";
// ObligationWidget and Obligation type available if needed from @/components/contracts/ObligationTracker
import { CategoryBadge } from "@/components/contracts/CategoryComponents";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDataMode } from "@/contexts/DataModeContext";
import { useContracts, useContractStats, useCrossModuleInvalidation, queryKeys, type Contract } from "@/hooks/use-queries";
import { toast } from "sonner";
import type { SignatureStatus, DocumentClassification } from "@/lib/types/contract-metadata-schema";

// Lazy load heavy components for better performance
import { LazyContractPreviewPanel } from "@/components/lazy";

// Enhanced UI Components
import { ContractsHeroDashboard, type ContractStats } from "@/components/contracts/ContractsHeroDashboard";
import { EnhancedContractCard, type EnhancedContract } from "@/components/contracts/EnhancedContractCard";
import { type ExtendedContract } from "@/components/contracts/ContractPreviewPanel";
import { type ContractFilters } from "@/components/contracts/SmartFilters";
import { MobileFiltersSheet } from "@/components/contracts/MobileContractViews";
import { NoContracts, NoResults } from "@/components/contracts/EmptyStates";
import { ShareDialog } from "@/components/collaboration/ShareDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AIReportModal } from "@/components/contracts/AIReportModal";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { ContractHoverPreview } from "@/components/contracts/ContractHoverPreview";
import { StateOfTheArtSearch } from "@/components/contracts/StateOfTheArtSearch";
import { CommandPaletteSearch } from "@/components/contracts/CommandPaletteSearch";
import { ScrollToTopButton } from "@/components/fab";
import { cn } from "@/lib/utils";
import { getTenantId } from "@/lib/tenant";

// ============ SIGNATURE STATUS BADGE COMPONENT ============
interface SignatureStatusBadgeProps {
  status?: SignatureStatus;
}

const SignatureStatusBadge = memo(function SignatureStatusBadge({ status }: SignatureStatusBadgeProps) {
  if (!status || status === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
        Pending
      </span>
    );
  }
  
  const config: Record<Exclude<SignatureStatus, 'unknown'>, { label: string; bgClass: string; textClass: string; borderClass: string; Icon: typeof CheckCircle2 }> = {
    signed: {
      label: 'Signed',
      bgClass: 'bg-green-50 dark:bg-green-950/30',
      textClass: 'text-green-700 dark:text-green-400',
      borderClass: 'border-green-200 dark:border-green-800',
      Icon: CheckCircle2,
    },
    partially_signed: {
      label: 'Partial',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30',
      textClass: 'text-amber-700 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-800',
      Icon: AlertCircle,
    },
    unsigned: {
      label: 'Unsigned',
      bgClass: 'bg-red-50 dark:bg-red-950/30',
      textClass: 'text-red-600 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-800',
      Icon: XCircle,
    },
  };
  
  const { label, bgClass, textClass, borderClass, Icon } = config[status];
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border",
      bgClass,
      textClass,
      borderClass
    )}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
});

// ============ DOCUMENT TYPE BADGE COMPONENT ============
interface DocumentTypeBadgeProps {
  classification?: DocumentClassification;
  showWarning?: boolean;
}

const DocumentTypeBadge = memo(function DocumentTypeBadge({ classification, showWarning }: DocumentTypeBadgeProps) {
  // Only show badge for non-contract documents
  if (!classification || classification === 'contract') {
    return null;
  }
  
  const config: Record<Exclude<DocumentClassification, 'contract'>, { label: string; bgClass: string; textClass: string }> = {
    purchase_order: {
      label: 'PO',
      bgClass: 'bg-orange-50 dark:bg-orange-950/30',
      textClass: 'text-orange-700 dark:text-orange-400',
    },
    invoice: {
      label: 'Invoice',
      bgClass: 'bg-sky-50 dark:bg-sky-950/30',
      textClass: 'text-sky-700 dark:text-sky-400',
    },
    quote: {
      label: 'Quote',
      bgClass: 'bg-teal-50 dark:bg-teal-950/30',
      textClass: 'text-teal-700 dark:text-teal-400',
    },
    proposal: {
      label: 'Proposal',
      bgClass: 'bg-cyan-50 dark:bg-cyan-950/30',
      textClass: 'text-cyan-700 dark:text-cyan-400',
    },
    work_order: {
      label: 'Work Order',
      bgClass: 'bg-pink-50 dark:bg-pink-950/30',
      textClass: 'text-pink-700 dark:text-pink-400',
    },
    letter_of_intent: {
      label: 'LOI',
      bgClass: 'bg-yellow-50 dark:bg-yellow-950/30',
      textClass: 'text-yellow-700 dark:text-yellow-400',
    },
    memorandum: {
      label: 'Memo',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-700 dark:text-slate-300',
    },
    amendment: {
      label: 'Amendment',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-700 dark:text-slate-300',
    },
    addendum: {
      label: 'Addendum',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-700 dark:text-slate-300',
    },
    unknown: {
      label: 'Unknown',
      bgClass: 'bg-slate-100 dark:bg-slate-800',
      textClass: 'text-slate-600 dark:text-slate-400',
    },
  };
  
  const { label, bgClass, textClass } = config[classification];
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
      bgClass,
      textClass,
      showWarning && "ring-1 ring-orange-300"
    )}>
      {showWarning && <FileWarning className="h-3 w-3" />}
      {label}
    </span>
  );
});

// ============ ANIMATED COUNTER COMPONENT ============
interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

const AnimatedCounter = memo(function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  duration = 500
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  
  useEffect(() => {
    if (previousValue.current === value) return;
    
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startValue + (endValue - startValue) * easeOutQuart);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
    previousValue.current = value;
  }, [value, duration]);
  
  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
});

// ============ SKELETON LOADING COMPONENT ============
const ContractRowSkeleton = memo(function ContractRowSkeleton({ index }: { index: number }) {
  return (
    <div 
      className="grid grid-cols-[44px_1fr_140px_140px_140px_120px_130px_110px_50px] gap-4 px-5 py-4 items-center border-b border-slate-100/80 bg-white"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-4 w-4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded motion-safe:animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-xl motion-safe:animate-pulse shadow-sm" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-3/4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-md motion-safe:animate-pulse" />
          <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-md motion-safe:animate-pulse" />
      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-6 w-16 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full motion-safe:animate-pulse shadow-sm" />
      <div className="h-7 w-7 bg-slate-100 dark:bg-slate-700 rounded-lg motion-safe:animate-pulse" />
    </div>
  );
});

// ContractCardSkeleton is available from @/components/ui/animated-skeletons if needed

// ============ PROCESSING CONTRACT TRACKER ============
interface ProcessingContractTrackerProps {
  contracts: Contract[];
  onContractComplete?: (contractId: string) => void; // optional callback for future use
}

const ProcessingContractTracker = memo(function ProcessingContractTracker({
  contracts,
  onContractComplete: _onContractComplete
}: ProcessingContractTrackerProps) {
  const processingContracts = contracts.filter(c => c.status === 'processing');
  
  if (processingContracts.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4"
    >
      <Card className="bg-slate-50 border-slate-200 shadow-sm overflow-hidden relative">
        <CardContent className="py-5 px-6 relative">
          <div className="flex items-center gap-4 mb-5">
            <div 
              className="relative w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center"
            >
              <Activity className="h-5 w-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-600 border-2 border-white"></span>
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-900 text-sm">
                Processing {processingContracts.length} contract{processingContracts.length > 1 ? 's' : ''}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">AI is analyzing your documents...</p>
            </div>
          </div>
          <div className="space-y-2">
            {processingContracts.slice(0, 3).map((contract) => (
              <div key={contract.id} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 truncate font-medium">{contract.title}</p>
                  <p className="text-xs text-slate-500">
                    {contract.processing?.currentStage || 'Initializing...'}
                  </p>
                </div>
                <div className="w-24">
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-slate-700 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${contract.processing?.progress || 0}%` }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-right mt-0.5">
                    {contract.processing?.progress || 0}%
                  </p>
                </div>
              </div>
            ))}
            {processingContracts.length > 3 && (
              <p className="text-xs text-slate-500 text-center">
                +{processingContracts.length - 3} more processing
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// ============ COMPACT ROW COMPONENT ============
interface CompactContractRowProps {
  contract: Contract;
  index: number;
  isSelected: boolean;
  searchQuery?: string;
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
  searchQuery = "",
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval: _onApproval,
  formatCurrency,
  formatDate,
}: CompactContractRowProps) {
  const router = useRouter();
  const isExpiringSoon = contract.expirationDate && 
    new Date(contract.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isNew = contract.createdAt && 
    new Date(contract.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const isExpired = contract.expirationDate && new Date(contract.expirationDate) < new Date();

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    // Only activate when the row itself is focused (not a child control like checkbox/buttons/menus)
    if (e.currentTarget !== e.target) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onView();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.015 }}
      className={cn(
        "flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors duration-150 group border-b border-slate-100 dark:border-slate-700 relative",
        isSelected 
          ? "bg-slate-50 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600" 
          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
        // Zebra striping for unselected rows
        !isSelected && index % 2 === 0 && "bg-white dark:bg-slate-900",
        !isSelected && index % 2 === 1 && "bg-slate-50/30 dark:bg-slate-800/30",
        isExpiringSoon && !isSelected && "border-l-2 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/30",
        isExpired && !isSelected && "border-l-2 border-l-red-400 bg-red-50/20 dark:bg-red-950/20"
      )}
      onClick={onView}
      role="link"
      tabIndex={0}
      aria-label={`View contract ${contract.title || 'Untitled Contract'}`}
      onKeyDown={handleRowKeyDown}
    >
      {/* Selection indicator line */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-800" />
      )}
      {/* Checkbox */}
      <div
        className="w-10 flex-shrink-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${contract.title}`}
          className="border-slate-300 h-4 w-4 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
        />
      </div>

      {/* Contract Title with Hover Preview */}
      <ContractHoverPreview
        contract={contract}
        onView={onView}
        onAnalyze={() => window.dispatchEvent(new CustomEvent('openAIChatbot', {
          detail: { autoMessage: `Analyze contract: ${contract.title}`, contractId: contract.id }
        }))}
        side="right"
        delay={500}
      >
        <div className="flex items-center gap-3">
          <div 
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isExpired 
                ? "bg-red-50 dark:bg-red-950/30"
                : isExpiringSoon
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            <FileText className={cn(
              "h-4 w-4",
              isExpired 
                ? "text-red-500 dark:text-red-400" 
                : isExpiringSoon 
                  ? "text-amber-500 dark:text-amber-400" 
                  : "text-slate-400 dark:text-slate-500"
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-800 truncate group-hover:text-slate-900 transition-colors text-sm" title={contract.title}>
                <HighlightText text={contract.title || 'Untitled Contract'} query={searchQuery} />
              </p>
              {isNew && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-white flex-shrink-0">
                  New
                </span>
              )}
              <DocumentTypeBadge 
                classification={contract.documentClassification as DocumentClassification} 
                showWarning={!!contract.documentClassificationWarning}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatDate(contract.createdAt)}
            </p>
          </div>
        </div>
      </ContractHoverPreview>

      {/* Category */}
      <div className="hidden lg:block w-[100px] truncate">
        {contract.category ? (
          <CategoryBadge 
            category={contract.category.name} 
            color={contract.category.color}
            icon={contract.category.icon}
            categoryPath={contract.category.path}
            size="sm"
          />
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <Tag className="h-3 w-3" />
            Uncategorized
          </span>
        )}
      </div>

      {/* Contract Type */}
      <div className="hidden lg:block w-[80px]">
        {contract.type && contract.type !== 'OTHER' ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate" title={contract.type}>
            {contract.type}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            General
          </span>
        )}
      </div>

      {/* Party */}
      <div className="hidden md:block w-[120px]">
        {(contract.parties?.supplier || contract.parties?.client) ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-3 w-3 text-slate-500" />
            </div>
            <span className="text-[13px] text-slate-600 truncate" title={contract.parties?.supplier || contract.parties?.client}>
              {contract.parties?.supplier || contract.parties?.client}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <User className="h-3 w-3" />
            Add party
          </span>
        )}
      </div>

      {/* Value */}
      <div className="hidden lg:block w-[90px] text-right">
        {contract.value ? (
          <span className="text-[13px] font-medium tabular-nums text-slate-800">
            {formatCurrency(contract.value)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        )}
      </div>

      {/* Expiration Date */}
      <div className="hidden md:block w-[90px]">
        {contract.expirationDate ? (
          <div className="flex flex-col">
            <span className={cn(
              "text-[13px] tabular-nums",
              isExpired ? "text-red-600 dark:text-red-400 font-medium" : isExpiringSoon ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-600 dark:text-slate-400"
            )}>
              {formatDate(contract.expirationDate)}
            </span>
            {isExpired && (
              <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" /> Expired
              </span>
            )}
            {!isExpired && isExpiringSoon && (
              <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 mt-0.5 flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> Soon
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700">
            <CalendarOff className="h-3 w-3" />
            No expiry
          </span>
        )}
      </div>

      {/* Signature Status */}
      <div className="hidden lg:block w-[70px]">
        <SignatureStatusBadge status={contract.signatureStatus} />
      </div>

      {/* Status */}
      <div className="w-[90px]">
        <ContractStatusBadge 
          status={contract.status} 
          documentRole={contract.documentRole}
          size="sm"
        />
      </div>

      {/* Actions */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 opacity-40 group-hover:opacity-100 focus:opacity-100 transition-colors"
              onClick={() => {}}
            >
              <MoreHorizontal className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-lg border-slate-200 rounded-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onSelect={onView} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Eye className="h-4 w-4 mr-2.5 text-slate-500" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Brain className="h-4 w-4 mr-2.5 text-slate-500" /> AI Analysis
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}/legal-review`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Scale className="h-4 w-4 mr-2.5 text-slate-500" /> Legal Review
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/contracts/${contract.id}/redline`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Edit3 className="h-4 w-4 mr-2.5 text-slate-500" /> Redline Editor
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={() => router.push(`/generate?create=renewal&from=${contract.id}`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <RefreshCw className="h-4 w-4 mr-2.5 text-slate-500" /> Start Renewal
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/generate?create=amendment&from=${contract.id}`)} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <GitBranch className="h-4 w-4 mr-2.5 text-slate-500" /> Create Amendment
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={onDownload} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Download className="h-4 w-4 mr-2.5 text-slate-500" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShare} className="text-sm rounded-md cursor-pointer hover:bg-slate-50 focus:bg-slate-50">
              <Share2 className="h-4 w-4 mr-2.5 text-slate-500" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem 
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="text-sm rounded-md cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 focus:bg-red-50 dark:focus:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4 mr-2.5" /> Delete Contract
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
  searchQuery?: string;
  onSelect: () => void;
  onView: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onApproval: () => void;
  formatCurrency: (value?: number) => string;
  formatDate: (date?: string) => string;
  getRiskBadge: (riskScore?: number) => React.ReactNode;
}

const ContractCard = memo(function ContractCard({
  contract,
  isSelected,
  searchQuery = "",
  onSelect,
  onView,
  onShare,
  onDelete,
  onDownload,
  onApproval: _onApproval,
  formatCurrency,
  formatDate,
  getRiskBadge,
}: ContractCardProps) {
  const router = useRouter();
  const isExpiringSoon = contract.expirationDate && 
    new Date(contract.expirationDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = contract.expirationDate && new Date(contract.expirationDate) < new Date();
  const isNew = contract.createdAt && 
    new Date(contract.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-colors bg-white border-slate-200 shadow-sm hover:shadow-md rounded-xl overflow-hidden",
        isSelected && "ring-1 ring-slate-800 border-slate-300",
        isNew && "border-slate-300"
      )}
      onClick={onView}
    >
      {/* Top bar */}
      <div className="h-0.5 w-full bg-slate-200" />
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-0.5 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
              />
            </div>
            <div className="relative p-2.5 bg-slate-100 rounded-lg">
              <FileText className="h-5 w-5 text-slate-600" />
              {isNew && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-slate-600 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate group-hover:text-slate-800 transition-colors">
                  <HighlightText text={contract.title || 'Untitled Contract'} query={searchQuery} />
                </h3>
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
          <ContractStatusBadge 
            status={contract.status} 
            documentRole={contract.documentRole}
            size="md"
          />
        </div>

        {/* Key Details */}
        <div className="space-y-3 mb-4">
          {contract.parties?.client && (
            <div className="flex items-center gap-3 text-sm p-2.5 bg-slate-50/80 rounded-lg border border-slate-100">
              <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <Building2 className="h-4 w-4 text-slate-600" />
              </div>
              <span className="text-slate-700 truncate font-medium">{contract.parties.client}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="p-1.5 bg-slate-100 rounded-lg border border-slate-200">
                <Banknote className="h-4 w-4 text-slate-600" />
              </div>
              <span className={contract.value ? "font-bold text-slate-800" : "text-slate-400 italic"}>
                {formatCurrency(contract.value)}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className={cn(
                "text-sm font-medium",
                isExpired ? "text-red-600 dark:text-red-400" : 
                isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
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
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              {contract.processing.progress}%
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div 
          className="flex items-center justify-between pt-4 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
                  onClick={onView}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
                  onClick={() => window.open(`/contracts/${contract.id}?tab=ai`, '_blank')}
                >
                  <Brain className="h-4 w-4 text-slate-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Analysis</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-9 w-9 p-0 rounded-lg hover:bg-slate-50 transition-colors" 
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
            <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-lg rounded-lg">
              <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}/legal-review`)} className="cursor-pointer text-sm">
                <Scale className="h-4 w-4 mr-2 text-slate-500" /> Legal Review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/contracts/${contract.id}/redline`)} className="cursor-pointer text-sm">
                <Edit3 className="h-4 w-4 mr-2 text-slate-500" /> Redline Editor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/generate?create=renewal&from=${contract.id}`)} className="cursor-pointer text-sm">
                <RefreshCw className="h-4 w-4 mr-2 text-slate-500" /> Start Renewal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/generate?create=amendment&from=${contract.id}`)} className="cursor-pointer text-sm">
                <GitBranch className="h-4 w-4 mr-2 text-slate-500" /> Create Amendment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDownload} className="cursor-pointer text-sm">
                <Download className="h-4 w-4 mr-2 text-slate-500" /> Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={(e) => {
                  e.preventDefault();
                  onDelete();
                }} 
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer text-sm"
              >
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
  { value: 'expired', label: 'Expired', icon: TimerOff, color: 'text-red-600 dark:text-red-400' },
  { value: 'expiring-7', label: 'Expiring in 7 days', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'expiring-30', label: 'Expiring in 30 days', icon: CalendarClock, color: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'expiring-90', label: 'Expiring in 90 days', icon: Calendar, color: 'text-slate-600 dark:text-slate-400' },
  { value: 'no-expiry', label: 'No Expiration', icon: CircleDot, color: 'text-slate-500 dark:text-slate-400' },
];

// Signature status filter options
const SIGNATURE_FILTERS = [
  { value: 'signed', label: 'Signed', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  { value: 'partially_signed', label: 'Partially Signed', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  { value: 'unsigned', label: 'Unsigned', icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  { value: 'unknown', label: 'Unknown', icon: CircleDot, color: 'text-slate-500 dark:text-slate-400' },
];

// Document type filter options
const DOCUMENT_TYPE_FILTERS = [
  { value: 'contract', label: 'Contract', icon: FileText, color: 'text-slate-700' },
  { value: 'purchase_order', label: 'Purchase Order', icon: FileText, color: 'text-orange-600 dark:text-orange-400' },
  { value: 'invoice', label: 'Invoice', icon: FileText, color: 'text-sky-600 dark:text-sky-400' },
  { value: 'quote', label: 'Quote', icon: FileText, color: 'text-teal-600 dark:text-teal-400' },
  { value: 'proposal', label: 'Proposal', icon: FileText, color: 'text-cyan-600 dark:text-cyan-400' },
  { value: 'amendment', label: 'Amendment', icon: FileText, color: 'text-slate-600 dark:text-slate-400' },
  { value: 'addendum', label: 'Addendum', icon: FileText, color: 'text-slate-600 dark:text-slate-400' },
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
  { id: 'high-value-expiring', label: 'High Value Expiring Soon', icon: Zap, color: 'text-amber-600 dark:text-amber-400',
    filters: { minValue: 100000, expirationDays: 30 } },
  { id: 'needs-attention', label: 'Needs Attention', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400',
    filters: { status: 'failed', risk: 'high' } },
  { id: 'recent-high-risk', label: 'Recent High Risk', icon: Shield, color: 'text-orange-600 dark:text-orange-400',
    filters: { createdDays: 30, risk: 'high' } },
  // Pending Approval - Hidden for now, will be enabled in future
  // { id: 'pending-approval', label: 'Pending Approval', icon: Clock, color: 'text-violet-600',
  //   filters: { approval: 'pending' } },
];

// Stable utility functions — defined outside the component to avoid
// re-creating references on every render (which would break memo() on child rows)
function formatCurrency(value?: number) {
  if (!value) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ContractsPage() {
  const router = useRouter();
  const { dataMode } = useDataMode();
  
  // Get tenant/user context for API calls
  const tenantId = getTenantId();
  const userId = 'system'; // Default user for bulk operations

  // Preserve list scroll position when navigating to contract details and back
  useEffect(() => {
    try {
      const shouldRestore = sessionStorage.getItem('contracts:list:restore');
      if (shouldRestore !== '1') return;
      const y = sessionStorage.getItem('contracts:list:scrollY');
      const yNum = y ? Number.parseInt(y, 10) : NaN;
      if (!Number.isFinite(yNum)) return;
      sessionStorage.removeItem('contracts:list:restore');
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, yNum)));
    } catch {
      // ignore storage/scroll errors
    }
  }, []);

  const pushToContract = (id: string) => {
    try {
      sessionStorage.setItem('contracts:list:scrollY', String(window.scrollY));
      sessionStorage.setItem('contracts:list:restore', '1');
    } catch {
      // ignore
    }
    router.push(`/contracts/${id}`, { scroll: true });
  };
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [riskFilters, setRiskFilters] = useState<string[]>([]);
  const [approvalFilters, setApprovalFilters] = useState<string[]>([]);
  const [valueRangeFilter, setValueRangeFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<string | null>(null);
  const [expirationFilters, setExpirationFilters] = useState<string[]>([]);
  const [supplierFilters, setSupplierFilters] = useState<string[]>([]);
  const [signatureFilters, setSignatureFilters] = useState<string[]>([]);
  const [documentTypeFilters, setDocumentTypeFilters] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilters>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  
  // New Advanced Filter State
  const [filterState, setFilterState] = useState<FilterState>({
    statuses: [],
    documentRoles: [],
    dateRange: {},
    valueRange: { min: 0, max: 1000000 },
    categories: [],
    hasDeadline: null,
    isExpiring: null,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  
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
  
  // View mode: 'compact' for table-like rows, 'cards' for detailed cards
  const [viewMode, setViewMode] = useState<'compact' | 'cards'>('compact');
  
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
  
  // Bulk action confirmation dialogs
  const [bulkExportDialogOpen, setBulkExportDialogOpen] = useState(false);
  const [bulkAnalyzeDialogOpen, setBulkAnalyzeDialogOpen] = useState(false);
  const [bulkShareDialogOpen, setBulkShareDialogOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<'export' | 'analyze' | 'share' | null>(null);

  // Enhanced UI state
  const [previewContract, setPreviewContract] = useState<ExtendedContract | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [favoriteContracts, setFavoriteContracts] = useState<Set<string>>(new Set());
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [useEnhancedUI, setUseEnhancedUI] = useState(true); // Toggle between enhanced and legacy UI
  const listContainerRef = useRef<HTMLDivElement>(null);
  
  // Live update state
  const [isLiveUpdatesEnabled, setIsLiveUpdatesEnabled] = useState(false);
  const [newContractsCount, setNewContractsCount] = useState(0);

  // Use React Query for data fetching with caching and live updates
  const { 
    data: contractsData, 
    isLoading: loading, 
    isFetching: isRefetching,
    refetch,
    error,
    lastUpdated,
    isPolling 
  } = useContracts({
    status: statusFilter === 'all' ? undefined : statusFilter,
    page: currentPage,
    limit: pageSize,
    sortBy: sortField,
    sortOrder: sortDirection,
    search: searchQuery || undefined,
  }, {
    pollingEnabled: isLiveUpdatesEnabled,
    pollingInterval: 15000, // 15 seconds
    onNewContract: (count) => {
      setNewContractsCount(prev => prev + count);
      toast.success(`${count} new contract${count > 1 ? 's' : ''} added`, {
        icon: <Sparkles className="h-4 w-4 text-slate-600" />,
        action: {
          label: 'View',
          onClick: () => {
            setSortField('createdAt');
            setSortDirection('desc');
            setCurrentPage(1);
          }
        }
      });
    },
    onUpdate: () => {
      // Subtle indication that data was refreshed
      setNewContractsCount(0);
    }
  });
  
  // Fetch real-time stats from the database (always accurate)
  const { data: dbStats, refetch: refetchStats } = useContractStats();
  
  const crossModule = useCrossModuleInvalidation();
  const queryClient = useQueryClient();

  
  const contracts: Contract[] = contractsData?.contracts || [];
  
  // Fetch categories for filter
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/taxonomy', {
          headers: { 'x-tenant-id': getTenantId() }
        });
        if (response.ok) {
          const data = await response.json();
          setCategories(data.data || []);
        }
      } catch {
        // Error handled silently
      }
    };
    fetchCategories();
  }, []);

  // Command palette keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
          'x-tenant-id': getTenantId()
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
    } catch {
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
        setViewMode(prev => prev === 'compact' ? 'cards' : 'compact');
      }
      
      // N - new contract (go to upload)
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push('/contracts/new');
      }
      
      // U - quick upload
      if (e.key === 'u' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // Trigger header quick upload via custom event
        window.dispatchEvent(new CustomEvent('openQuickUpload'));
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
  const performBulkAction = useCallback(async (action: 'export' | 'analyze' | 'delete' | 'share') => {
    if (selectedContracts.size === 0) return;
    
    setIsProcessingBulk(true);
    try {
      const response = await fetch('/api/contracts/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-data-mode': dataMode,
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          operation: action,
          contractIds: Array.from(selectedContracts),
        }),
      });

      if (!response.ok) throw new Error('Operation failed');
      
      await response.json();
      toast.success(`Successfully ${action}ed ${selectedContracts.size} contracts`);
      
      if (action === 'delete') {
        refetch();
      }
      
      setSelectedContracts(new Set());
    } catch {
      toast.error(`Failed to ${action} contracts`);
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedContracts, dataMode, refetch]);

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
    setSupplierFilters([]);
    setSignatureFilters([]);
    setDocumentTypeFilters([]);
    setActivePreset(null);
    setAdvancedFilters({});
    setCategoryFilter(null);
    setFilterState({
      statuses: [],
      documentRoles: [],
      dateRange: {},
      valueRange: { min: 0, max: 1000000 },
      categories: [],
      hasDeadline: null,
      isExpiring: null,
    });
  }, []);

  // Advanced filter handlers
  const handleClearFilter = useCallback((filterKey: keyof FilterState) => {
    setFilterState(prev => {
      switch (filterKey) {
        case 'statuses':
        case 'documentRoles':
        case 'categories':
          return { ...prev, [filterKey]: [] };
        case 'dateRange':
          return { ...prev, dateRange: {} };
        case 'valueRange':
          return { ...prev, valueRange: { min: 0, max: 1000000 } };
        case 'hasDeadline':
        case 'isExpiring':
          return { ...prev, [filterKey]: null };
        default:
          return prev;
      }
    });
  }, []);

  const handleLoadPreset = useCallback((search: SavedSearch) => {
    setSearchQuery(search.query);
    setFilterState(search.filters);
  }, []);
  
  // Handle visual builder apply
  const handleVisualBuilderApply = useCallback((groups: Array<{
    id: string;
    logic: 'AND' | 'OR';
    filters: Array<{
      type: 'status' | 'date' | 'value' | 'risk' | 'category' | 'role' | 'expiration' | 'supplier' | 'client' | 'jurisdiction' | 'payment' | 'contractType' | 'currency';
      operator: string;
      value: any;
    }>;
  }>) => {
    // Convert visual builder format to FilterState
    const newFilterState: FilterState = {
      statuses: [],
      documentRoles: [],
      dateRange: {},
      valueRange: { min: 0, max: 1000000 },
      categories: [],
      hasDeadline: null,
      isExpiring: null,
    };
    
    // Track additional filters (these would need to be added to FilterState interface)
    let supplierFilter: string | null = null;
    let clientFilter: string | null = null;
    let jurisdictionFilter: string | null = null;
    let paymentTermsFilter: string | null = null;
    let contractTypeFilter: string | null = null;
    let currencyFilter: string | null = null;
    
    // Process all filter groups (currently just merging all filters)
    // In a more sophisticated implementation, you'd preserve AND/OR logic
    groups.forEach(group => {
      group.filters.forEach(filter => {
        switch (filter.type) {
          case 'status':
            if (filter.value && !newFilterState.statuses.includes(filter.value)) {
              newFilterState.statuses.push(filter.value);
            }
            break;
          case 'role':
            if (filter.value && !newFilterState.documentRoles.includes(filter.value)) {
              newFilterState.documentRoles.push(filter.value);
            }
            break;
          case 'category':
            if (filter.value && !newFilterState.categories.includes(filter.value)) {
              newFilterState.categories.push(filter.value);
            }
            break;
          case 'date':
            if (filter.operator === 'between' && Array.isArray(filter.value) && filter.value.length === 2) {
              newFilterState.dateRange = {
                from: filter.value[0],
                to: filter.value[1],
              };
            }
            break;
          case 'value':
            if (filter.operator === 'between' && Array.isArray(filter.value) && filter.value.length === 2) {
              newFilterState.valueRange = {
                min: filter.value[0],
                max: filter.value[1],
              };
            } else if (filter.operator === 'greater' && typeof filter.value === 'number') {
              newFilterState.valueRange.min = filter.value;
            } else if (filter.operator === 'less' && typeof filter.value === 'number') {
              newFilterState.valueRange.max = filter.value;
            }
            break;
          case 'expiration':
            newFilterState.isExpiring = true;
            break;
          case 'supplier':
            supplierFilter = filter.value;
            break;
          case 'client':
            clientFilter = filter.value;
            break;
          case 'jurisdiction':
            jurisdictionFilter = filter.value;
            break;
          case 'payment':
            paymentTermsFilter = filter.value;
            break;
          case 'contractType':
            contractTypeFilter = filter.value;
            break;
          case 'currency':
            currencyFilter = filter.value;
            break;
          case 'risk':
            // Risk would need additional state handling
            break;
        }
      });
    });
    
    setFilterState(newFilterState);
    setShowVisualBuilder(false);
    
    const filterCount = groups.reduce((acc, g) => acc + g.filters.length, 0);
    const message = `Applied ${filterCount} filter${filterCount === 1 ? '' : 's'}`;
    
    // Show info about additional filters that aren't in FilterState
    const additionalFilters = [];
    if (supplierFilter) additionalFilters.push(`Supplier: ${supplierFilter}`);
    if (clientFilter) additionalFilters.push(`Client: ${clientFilter}`);
    if (jurisdictionFilter) additionalFilters.push(`Jurisdiction: ${jurisdictionFilter}`);
    if (paymentTermsFilter) additionalFilters.push(`Payment: ${paymentTermsFilter}`);
    if (contractTypeFilter) additionalFilters.push(`Type: ${contractTypeFilter}`);
    if (currencyFilter) additionalFilters.push(`Currency: ${currencyFilter}`);
    
    if (additionalFilters.length > 0) {
      toast.info(`${message}. Note: ${additionalFilters.join(', ')} would require backend support.`);
    } else {
      toast.success(message);
    }
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
        headers: { 'x-tenant-id': getTenantId() },
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
    } catch {
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
    
    const contractId = contractToDelete.id;
    
    try {
      toast.info('Deleting contract...');
      
      // Remove from selected contracts
      setSelectedContracts(prev => {
        const updated = new Set(prev);
        updated.delete(contractId);
        return updated;
      });
      
      // Perform the actual delete with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data?.error || data?.details || 'Delete failed');
      }
      
      // Force refetch to get fresh data from server
      await refetch();
      
      // Also refetch stats
      await refetchStats();
      
      // Invalidate related caches across modules (non-blocking)
      crossModule.onContractChange(contractId);
      
      toast.success('Contract deleted successfully');
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toast.error('Delete request timed out. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to delete contract');
      }
    } finally {
      setContractToDelete(null);
      setDeleteDialogOpen(false);
    }
  }, [contractToDelete, crossModule, refetch, refetchStats]);

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
          headers: { 'x-tenant-id': getTenantId() },
        })
      );
      
      await Promise.all(deletePromises);
      
      // Force immediate refresh - invalidate cache AND refetch
      await queryClient.invalidateQueries({ 
        queryKey: queryKeys.contracts.all,
        refetchType: 'all'
      });
      
      // Also refresh stats
      await refetchStats();
      
      // Force refetch the main contracts list
      await refetch();
      
      // Also invalidate related caches across modules
      crossModule.onContractChange();
      
      toast.success(`Deleted ${selectedContracts.size} contracts`);
      setSelectedContracts(new Set());
    } catch {
      toast.error('Failed to delete some contracts');
    } finally {
      setIsProcessingBulk(false);
    }
  }, [selectedContracts, crossModule, queryClient, refetch, refetchStats]);

  // Bulk action with confirmation handlers
  const handleBulkActionWithConfirmation = useCallback((action: 'export' | 'analyze' | 'share') => {
    if (selectedContracts.size === 0) return;
    setPendingBulkAction(action);
    switch (action) {
      case 'export':
        setBulkExportDialogOpen(true);
        break;
      case 'analyze':
        setBulkAnalyzeDialogOpen(true);
        break;
      case 'share':
        setBulkShareDialogOpen(true);
        break;
    }
  }, [selectedContracts.size]);

  const handleConfirmBulkAction = useCallback(async () => {
    if (!pendingBulkAction) return;
    await performBulkAction(pendingBulkAction);
    setBulkExportDialogOpen(false);
    setBulkAnalyzeDialogOpen(false);
    setBulkShareDialogOpen(false);
    setPendingBulkAction(null);
  }, [pendingBulkAction, performBulkAction]);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilters.length > 0 || riskFilters.length > 0 || approvalFilters.length > 0 || valueRangeFilter || dateRangeFilter || expirationFilters.length > 0 || supplierFilters.length > 0 || signatureFilters.length > 0 || documentTypeFilters.length > 0 || activePreset || Object.keys(advancedFilters).length > 0 || categoryFilter;
  
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
    supplierFilters.length,
    signatureFilters.length,
    documentTypeFilters.length,
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

      // Status filter (combines old statusFilter + new filterState.statuses)
      const matchesStatus =
        (statusFilter === "all" || contract.status === statusFilter) &&
        (filterState.statuses.length === 0 || filterState.statuses.includes(contract.status || ''));

      // Document role filter (new from filterState)
      const matchesDocumentRole = filterState.documentRoles.length === 0 || 
        filterState.documentRoles.includes(contract.documentRole || '');

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
      
      // Value range filter (combines old valueRangeFilter + new filterState.valueRange)
      const matchesValueRange = (!valueRangeFilter || (() => {
        const range = VALUE_RANGES.find(r => r.value === valueRangeFilter);
        if (!range || !contract.value) return false;
        return contract.value >= range.min && contract.value < range.max;
      })()) && (!contract.value || (contract.value >= filterState.valueRange.min && contract.value <= filterState.valueRange.max));
      
      // Date range filter (combines old dateRangeFilter + new filterState.dateRange)
      const matchesDateRange = (!dateRangeFilter || (() => {
        const preset = DATE_PRESETS.find(p => p.value === dateRangeFilter);
        if (!preset || !contract.createdAt) return false;
        const createdDate = new Date(contract.createdAt);
        const cutoffDate = new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000);
        return createdDate >= cutoffDate;
      })()) && (!filterState.dateRange.from || !contract.createdAt || new Date(contract.createdAt) >= filterState.dateRange.from) &&
        (!filterState.dateRange.to || !contract.createdAt || new Date(contract.createdAt) <= filterState.dateRange.to);
      
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

      // Has deadline filter (new from filterState)
      const matchesHasDeadline = filterState.hasDeadline === null || 
        (filterState.hasDeadline ? !!contract.expirationDate : !contract.expirationDate);

      // Is expiring filter (new from filterState)
      const matchesIsExpiring = filterState.isExpiring === null || (() => {
        if (!filterState.isExpiring) return true;
        if (!contract.expirationDate) return false;
        const expirationDate = new Date(contract.expirationDate);
        const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30; // Expiring within 30 days
      })();

      // Supplier filter
      const matchesSupplier = supplierFilters.length === 0 || 
        (contract.parties?.supplier && supplierFilters.includes(contract.parties.supplier));

      // Signature status filter
      const matchesSignature = signatureFilters.length === 0 || 
        signatureFilters.includes(contract.signatureStatus || 'unknown');

      // Document type/classification filter
      const matchesDocumentType = documentTypeFilters.length === 0 || 
        documentTypeFilters.includes(contract.documentClassification || 'contract');

      // Advanced filters
      const matchesAdvanced = 
        (!advancedFilters.clientName || contract.parties?.client?.toLowerCase().includes(advancedFilters.clientName.toLowerCase())) &&
        (!advancedFilters.supplierName || contract.parties?.supplier?.toLowerCase().includes(advancedFilters.supplierName.toLowerCase())) &&
        (!advancedFilters.minValue || (contract.value && contract.value >= advancedFilters.minValue)) &&
        (!advancedFilters.maxValue || (contract.value && contract.value <= advancedFilters.maxValue));

      // Category filter (combines old categoryFilter + new filterState.categories)
      const matchesCategory = (!categoryFilter || 
        (categoryFilter === 'uncategorized' ? !contract.category : contract.category?.id === categoryFilter)) &&
        (filterState.categories.length === 0 || (contract.category && filterState.categories.includes(contract.category.id)));

      return matchesSearch && matchesStatus && matchesDocumentRole && matchesType && matchesRisk && matchesApproval && matchesValueRange && matchesDateRange && matchesExpiration && matchesHasDeadline && matchesIsExpiring && matchesSupplier && matchesSignature && matchesDocumentType && matchesAdvanced && matchesCategory;
    });
     
  }, [contracts, searchQuery, statusFilter, typeFilters, riskFilters, approvalFilters, valueRangeFilter, dateRangeFilter, expirationFilters, supplierFilters, signatureFilters, documentTypeFilters, advancedFilters, categoryFilter, filterState]);

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

  // Hero Dashboard Stats - Use real database stats when available, fallback to client-side calculation
  const heroStats: ContractStats = useMemo(() => {
    const now = Date.now();
    
    // If we have real database stats, use them (always accurate)
    if (dbStats) {
      return {
        totalContracts: dbStats.overview.total,
        activeContracts: dbStats.overview.processed,
        totalValue: dbStats.financial.totalValue,
        monthlyChange: 0, // Could be computed on backend
        expiringSoon: dbStats.timeline.expiringNext30Days,
        expiringThisWeek: dbStats.timeline.expiringThisMonth, // Approximation
        highRiskContracts: 0, // Not tracked yet
        riskTrend: 'stable',
        processingCount: dbStats.overview.byStatus?.processing || 0,
        pendingReview: dbStats.overview.pending,
        recentlyAdded: dbStats.timeline.recentlyUploaded,
        // Calculate sparkline from client data for visualization
        trendData: (() => {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            
            const dayContracts = contracts.filter(c => {
              if (!c.createdAt) return false;
              const created = new Date(c.createdAt);
              return created >= dayStart && created < dayEnd;
            });
            
            return {
              date: days[date.getDay()],
              contracts: dayContracts.length,
              value: dayContracts.reduce((sum, c) => sum + (c.value || 0), 0)
            };
          });
          return last7Days;
        })(),
      };
    }
    
    // Fallback: Calculate from client-side contracts (may be paginated/incomplete)
    const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const expiringSoon = contracts.filter(c => {
      if (!c.expirationDate) return false;
      const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    const highRisk = contracts.filter(c => (c.riskScore || 0) >= 70).length;
    const processing = contracts.filter(c => c.status === 'processing').length;
    
    // Calculate real month-over-month change
    const thisMonth = contracts.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      return created >= monthAgo;
    }).length;
    const previousMonth = contracts.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
      return created >= twoMonthsAgo && created < monthAgo;
    }).length;
    const monthlyChange = previousMonth > 0 
      ? Math.round(((thisMonth - previousMonth) / previousMonth) * 100 * 10) / 10 
      : thisMonth > 0 ? 100 : 0;
    
    return {
      totalContracts: contractsData?.total ?? contracts.length,
      activeContracts: contracts.filter(c => c.status === 'completed').length,
      totalValue,
      monthlyChange,
      expiringSoon,
      expiringThisWeek: contracts.filter(c => {
        if (!c.expirationDate) return false;
        const daysUntil = Math.ceil((new Date(c.expirationDate).getTime() - now) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7;
      }).length,
      highRiskContracts: highRisk,
      riskTrend: highRisk > 3 ? 'up' : 'down',
      processingCount: processing,
      pendingReview: contracts.filter(c => c.status === 'pending').length,
      recentlyAdded: contracts.filter(c => {
        if (!c.createdAt) return false;
        return new Date(c.createdAt).getTime() > now - 7 * 24 * 60 * 60 * 1000;
      }).length,
      trendData: (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          
          const dayContracts = contracts.filter(c => {
            if (!c.createdAt) return false;
            const created = new Date(c.createdAt);
            return created >= dayStart && created < dayEnd;
          });
          
          return {
            date: days[date.getDay()],
            contracts: dayContracts.length,
            value: dayContracts.reduce((sum, c) => sum + (c.value || 0), 0)
          };
        });
        return last7Days;
      })(),
    };
     
  }, [contracts, contractsData?.total, dbStats]);

  // Convert Contract to EnhancedContract for enhanced cards
  const enhancedContracts = useMemo(() => {
    return paginatedContracts.map(contract => ({
      id: contract.id,
      title: contract.title || 'Untitled Contract',
      type: contract.type || 'Contract',
      filename: contract.filename,
      status: (contract.status || 'draft') as EnhancedContract['status'],
      value: contract.value,
      expirationDate: contract.expirationDate,
      effectiveDate: contract.effectiveDate,
      createdAt: contract.createdAt,
      riskScore: contract.riskScore,
      health: {
        score: Math.max(20, 100 - (contract.riskScore || 0)),
        issues: contract.riskScore && contract.riskScore >= 70 ? ['High risk score detected'] : [],
        lastChecked: new Date(),
      },
      parties: contract.parties ? [
        ...(contract.parties.client ? [{ name: contract.parties.client, role: 'client' as const }] : []),
        ...(contract.parties.supplier ? [{ name: contract.parties.supplier, role: 'vendor' as const }] : []),
      ] : [],
      isFavorite: favoriteContracts.has(contract.id),
      isPinned: false,
      completeness: contract.status === 'completed' ? 100 : contract.status === 'processing' ? (contract.processing?.progress || 50) : 0,
      keyTerms: [],
      tags: [],
      // Include hierarchy info
      parentContractId: contract.parentContractId,
      parentContract: contract.parentContract,
      childContracts: contract.childContracts,
      hasHierarchy: contract.hasHierarchy,
    } satisfies EnhancedContract));
  }, [paginatedContracts, favoriteContracts]);

  // Convert to ExtendedContract for preview panel
  const convertToExtendedContract = useCallback((contract: Contract): ExtendedContract => ({
    id: contract.id,
    title: contract.title || 'Untitled Contract',
    type: contract.type || 'Contract',
    filename: contract.filename,
    status: (contract.status || 'draft') as ExtendedContract['status'],
    value: contract.value,
    expirationDate: contract.expirationDate,
    effectiveDate: contract.effectiveDate,
    createdAt: contract.createdAt,
    riskScore: contract.riskScore,
    parties: contract.parties ? [
      ...(contract.parties.client ? [{ 
        id: 'client-1',
        name: contract.parties.client, 
        role: 'client' as const, 
        email: '',
        phone: '',
      }] : []),
      ...(contract.parties.supplier ? [{ 
        id: 'vendor-1',
        name: contract.parties.supplier, 
        role: 'vendor' as const, 
        email: '',
        phone: '',
      }] : []),
    ] : [],
    clauses: [],
    attachments: [],
    activities: [],
    summary: 'Contract summary will be available after processing.',
  }), []);

  // Handle preview
  const handlePreview = useCallback((contract: Contract) => {
    setPreviewContract(convertToExtendedContract(contract));
    setPreviewOpen(true);
  }, [convertToExtendedContract]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback((contractId: string) => {
    setFavoriteContracts(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
        toast.success('Removed from favorites');
      } else {
        next.add(contractId);
        toast.success('Added to favorites');
      }
      return next;
    });
  }, []);

  // Smart filters change handler
  const handleSmartFiltersChange = useCallback((filters: ContractFilters) => {
    setSearchQuery(filters.search || '');
    if (filters.status?.length && filters.status[0]) {
      setStatusFilter(filters.status[0]);
    } else {
      setStatusFilter('all');
    }
    if (filters.riskLevel?.length) {
      setRiskFilters(filters.riskLevel);
    } else {
      setRiskFilters([]);
    }
    if (filters.contractType?.length) {
      setTypeFilters(filters.contractType);
    } else {
      setTypeFilters([]);
    }
    // Date range handling
    if (filters.dateRange?.from) {
      const daysDiff = Math.ceil((Date.now() - new Date(filters.dateRange.from).getTime()) / (1000 * 60 * 60 * 24));
      const preset = DATE_PRESETS.find(p => p.days >= daysDiff);
      setDateRangeFilter(preset?.value || null);
    } else {
      setDateRangeFilter(null);
    }
  }, []);

  // Navigate between contracts in preview
  const handlePreviewNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!previewContract) return;
    const currentIndex = paginatedContracts.findIndex(c => c.id === previewContract.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    const nextContract = paginatedContracts[newIndex];
    if (newIndex >= 0 && newIndex < paginatedContracts.length && nextContract) {
      setPreviewContract(convertToExtendedContract(nextContract));
    }
  }, [previewContract, paginatedContracts, convertToExtendedContract]);

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
      completed: { label: "Active", color: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400", icon: CheckCircle },
      processing: { label: "Processing", color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300", icon: Loader2 },
      failed: { label: "Failed", color: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400", icon: AlertTriangle },
      pending: { label: "Pending", color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400", icon: Clock },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
      icon: CircleDot,
    };

    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0 gap-1.5 px-3 py-1 rounded-full shadow-sm font-medium`}>
        <Icon className={cn("h-3.5 w-3.5", status === 'processing' && "animate-spin")} />
        {config.label}
      </Badge>
    );
  };

  const getRiskBadge = (riskScore?: number) => {
    if (!riskScore) return null;

    if (riskScore < 30) {
      return (
        <Badge className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-0 gap-1.5 px-3 py-1 rounded-full font-medium">
          <Shield className="h-3.5 w-3.5" />
          Low Risk
        </Badge>
      );
    } else if (riskScore < 70) {
      return (
        <Badge className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-0 gap-1.5 px-3 py-1 rounded-full font-medium">
          <Shield className="h-3.5 w-3.5" />
          Medium Risk
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-0 gap-1.5 px-3 py-1 rounded-full font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          High Risk
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <TooltipProvider>
        <div className="min-h-screen bg-slate-50">
          <ContractsPageHeader
            onRefresh={() => refetch()}
            onAdvancedSearch={() => setShowAdvancedSearch(true)}
            isRefreshing={true}
          />
          <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6 space-y-5">
            {/* Skeleton Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <div className="animate-pulse space-y-3">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-8 w-24 bg-slate-200 rounded" />
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Skeleton Search Bar */}
            <Card className="bg-white border-slate-200">
              <CardContent className="p-5">
                <div className="animate-pulse flex gap-4">
                  <div className="h-10 flex-1 bg-slate-200 rounded" />
                  <div className="h-10 w-24 bg-slate-200 rounded" />
                </div>
              </CardContent>
            </Card>
            
            {/* Skeleton List Header */}
            <div className="flex items-center justify-between">
              <div className="animate-pulse flex items-center gap-3">
                <div className="h-5 w-24 bg-slate-200 rounded" />
                <div className="h-6 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="animate-pulse flex gap-2">
                <div className="h-8 w-20 bg-slate-200 rounded" />
                <div className="h-8 w-20 bg-slate-200 rounded" />
                <div className="h-8 w-28 bg-slate-200 rounded" />
              </div>
            </div>
            
            {/* Skeleton Contract Rows */}
            <Card className="bg-white border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {[...Array(8)].map((_, i) => (
                  <ContractRowSkeleton key={i} index={i} />
                ))}
              </div>
            </Card>
            
            {/* Loading indicator overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed bottom-6 right-6 bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-3 border border-slate-200"
            >
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
              <span className="text-sm text-slate-600">Loading contracts...</span>
            </motion.div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
    {/* Command Palette for Quick Search (⌘K) */}
    <CommandPaletteSearch
      isOpen={showCommandPalette}
      onClose={() => setShowCommandPalette(false)}
      onSearch={(query) => {
        setSearchQuery(query);
        setShowCommandPalette(false);
      }}
      onAISearch={(query) => {
        window.dispatchEvent(new CustomEvent('openAIChatbot', {
          detail: { autoMessage: query ? `Search for contracts matching: ${query}` : 'Help me find contracts' }
        }));
        setShowCommandPalette(false);
      }}
      onFilterChange={(filter, value) => {
        if (filter === 'risk') setRiskFilters([value]);
        if (filter === 'status') setStatusFilter(value);
        if (filter === 'expiration') setExpirationFilters([value]);
      }}
      onNavigate={(contractId) => pushToContract(contractId)}
      recentContracts={contracts.slice(0, 5).map(c => ({ id: c.id, title: c.filename || c.title || 'Untitled' }))}
      onUploadClick={() => router.push('/upload')}
      onExportClick={() => handleExportFiltered('csv')}
    />
    
    <div className="min-h-screen bg-slate-50">
      <ContractsPageHeader
        onRefresh={() => refetch()}
        onAdvancedSearch={() => setShowAdvancedSearch(true)}
        isRefreshing={isRefetching && !loading}
        onQuickUploadComplete={(contractIds) => {
          refetch();
          toast.success(`${contractIds.length} contract${contractIds.length > 1 ? 's' : ''} uploaded`);
        }}
        extraActions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
                <Link href="/import/external-database">
                  <Database className="h-4 w-4 mr-2" />
                  Import from DB
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import contracts from external database</TooltipContent>
          </Tooltip>
        }
      />
      
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-3 space-y-2.5">

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectedContracts.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="bg-slate-900 border-slate-700/50 shadow-lg rounded-xl overflow-hidden">
                <div className="h-px w-full bg-slate-700" />
                <CardContent className="py-3 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-white/15 text-white font-semibold px-3 py-1.5 text-sm rounded-lg border border-white/10">
                          {selectedContracts.size}
                        </Badge>
                        <span className="text-sm text-slate-300">
                          contract{selectedContracts.size !== 1 ? 's' : ''} selected
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 h-8 rounded-lg transition-colors"
                        onClick={() => setSelectedContracts(new Set())}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Standard actions */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={() => performBulkAction('export')}
                            disabled={isProcessingBulk}
                          >
                            {isProcessingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Export</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export selected contracts</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={() => performBulkAction('analyze')}
                            disabled={isProcessingBulk}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Analyze</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Run AI analysis on selected</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-slate-800 hover:bg-slate-700 text-white border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={() => setAiReportModalOpen(true)}
                            disabled={isProcessingBulk}
                          >
                            <FileBarChart className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Report</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generate AI report</TooltipContent>
                      </Tooltip>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={handleBulkCategorize}
                            disabled={isProcessingBulk || isBulkCategorizing}
                          >
                            {isBulkCategorizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Categorize</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Auto-categorize with AI</TooltipContent>
                      </Tooltip>
                      
                      {selectedContracts.size === 2 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                              onClick={() => {
                                const ids = Array.from(selectedContracts);
                                router.push(`/compare?contract1=${ids[0]}&contract2=${ids[1]}`);
                              }}
                              disabled={isProcessingBulk}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline ml-1.5 text-xs font-medium">Compare</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Compare side-by-side</TooltipContent>
                        </Tooltip>
                      )}
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={() => performBulkAction('share')}
                            disabled={isProcessingBulk}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Share</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share selected</TooltipContent>
                      </Tooltip>
                      
                      <div className="w-px h-5 bg-slate-700 mx-0.5 hidden sm:block" />
                      
                      {/* Destructive action */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-500 text-white border-0 h-8 px-3 rounded-lg transition-colors"
                            onClick={handleBulkDeleteClick}
                            disabled={isProcessingBulk}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline ml-1.5 text-xs font-medium">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete selected</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Hero Dashboard */}
        <ContractsHeroDashboard
          stats={heroStats}
          onUploadClick={() => router.push('/upload')}
          onGenerateClick={() => router.push('/generate')}
          onCompareClick={() => {
            if (selectedContracts.size === 2) {
              const ids = Array.from(selectedContracts);
              router.push(`/compare?contract1=${ids[0]}&contract2=${ids[1]}`);
            } else {
              toast.info('Select exactly 2 contracts to compare');
            }
          }}
          onAskAIClick={() => window.dispatchEvent(new CustomEvent('openAIChatbot', {
            detail: { autoMessage: 'Help me find and analyze my contracts' }
          }))}
        />

        {/* State of the Art Search & Filters */}
        <div data-tour="smart-search">
          <StateOfTheArtSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            riskFilters={riskFilters}
            onRiskFiltersChange={setRiskFilters}
            typeFilters={typeFilters}
            onTypeFiltersChange={setTypeFilters}
            expirationFilters={expirationFilters}
            onExpirationFiltersChange={setExpirationFilters}
            supplierFilters={supplierFilters}
            onSupplierFiltersChange={setSupplierFilters}
            categoryFilter={null}
            onCategoryFilterChange={() => {}}
            valueRangeFilter={null}
            onValueRangeFilterChange={() => {}}
            dateRangeFilter={dateRangeFilter}
            onDateRangeFilterChange={setDateRangeFilter}
            suppliers={Array.from(new Set(contracts?.map(c => c.parties?.supplier).filter(Boolean) || [])).sort() as string[]}
            categories={[]}
            onClearFilters={clearFilters}
            onAISearchClick={(query) => window.dispatchEvent(new CustomEvent('openAIChatbot', {
              detail: { autoMessage: query ? `Search for contracts matching: ${query}` : 'Help me find contracts' }
            }))}
            activeFilterCount={activeFilterCount}
            totalResults={contractsData?.total ?? 0}
            isLoading={isRefetching}
          />
        </div>

        {/* Processing Contracts Live Tracker */}
        <AnimatePresence>
          <ProcessingContractTracker 
            contracts={contracts} 
            onContractComplete={(id) => {
              toast.success('Contract processing completed!', {
                icon: <CheckCircle className="h-4 w-4 text-green-500" />,
              });
              refetch();
            }}
          />
        </AnimatePresence>

        {/* Advanced Filter Panel - Inline & Collapsible */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <AdvancedFilterPanel
                filters={filterState}
                onChange={setFilterState}
                onClose={() => setShowAdvancedFilters(false)}
                availableCategories={categories.map(cat => cat.name)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Visual Filter Builder Modal */}
        {showVisualBuilder && (
          <DragDropFilterBuilder
            onApply={handleVisualBuilderApply}
            onClose={() => setShowVisualBuilder(false)}
            initialGroups={[]}
          />
        )}

        {/* Advanced Filter Controls */}
        <div className="flex items-center justify-end gap-2">
          {/* Active Filter Chips - only shows when filters are active */}
          <ActiveFilterChips
            filters={filterState}
            searchQuery={searchQuery}
            onClearFilter={handleClearFilter}
            onClearSearch={() => setSearchQuery('')}
            onClearAll={() => {
              clearFilters();
            }}
          />
          
          {/* Saved Search Presets */}
          <SavedSearchPresets
            currentFilters={filterState}
            currentQuery={searchQuery}
            onLoadPreset={handleLoadPreset}
          />
          
          {/* Visual Filter Builder Button */}
          <Button
              variant={showVisualBuilder ? "default" : "outline"}
              size="sm"
              onClick={() => setShowVisualBuilder(true)}
              className={cn(
                "transition-all duration-200 h-8 text-xs font-medium",
                showVisualBuilder 
                  ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-800" 
                  : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Visual Builder</span>
              <span className="sm:hidden">Builder</span>
            </Button>
          
          {/* Advanced Filter Button */}
          <Button
              variant={showAdvancedFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={cn(
                "transition-all duration-200 h-8 text-xs font-medium",
                showAdvancedFilters 
                  ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-800" 
                  : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              {showAdvancedFilters ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Filter className="h-3.5 w-3.5 mr-1.5" />}
              <span className="hidden sm:inline">Advanced Filters</span>
              <span className="sm:hidden">Filters</span>
              {(filterState.statuses.length > 0 || filterState.documentRoles.length > 0 || 
                filterState.categories.length > 0 || filterState.hasDeadline !== null || 
                filterState.isExpiring !== null) && (
                <Badge className={cn(
                  "ml-1.5",
                  showAdvancedFilters ? "bg-white text-slate-800" : "bg-slate-800 text-white"
                )} variant="secondary">
                  {filterState.statuses.length + filterState.documentRoles.length + 
                   filterState.categories.length + (filterState.hasDeadline !== null ? 1 : 0) + 
                   (filterState.isExpiring !== null ? 1 : 0)}
                </Badge>
              )}
            </Button>
        </div>

        {/* View Mode Toggle, Sort & Results Count */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                <AnimatedCounter value={contractsData?.total ?? 0} />
              </span>
              <span className="text-sm text-slate-500 font-medium">contracts</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-700 border-0 font-semibold">
                  filtered
                </Badge>
              )}
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors bg-white"
                >
                  <div className="p-1 rounded-md bg-slate-100">
                    <ArrowUp className={cn("h-3 w-3 text-slate-600 transition-transform", sortDirection === 'desc' && "rotate-180")} />
                  </div>
                  <span className="text-slate-700 font-medium">
                    {{
                      createdAt: 'Date',
                      title: 'Name',
                      value: 'Value',
                      expirationDate: 'Expires',
                      status: 'Status',
                    }[sortField as string] || 'Sort'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white shadow-lg border-slate-200 p-1">
                {[
                  { field: 'createdAt' as SortField, label: 'Date Created' },
                  { field: 'title' as SortField, label: 'Name' },
                  { field: 'value' as SortField, label: 'Value' },
                  { field: 'expirationDate' as SortField, label: 'Expiration' },
                  { field: 'status' as SortField, label: 'Status' },
                ].map((option) => (
                  <DropdownMenuItem
                    key={option.field}
                    onClick={() => {
                      if (sortField === option.field) {
                        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField(option.field);
                        setSortDirection('desc');
                      }
                    }}
                    className={cn(
                      "text-sm rounded-lg cursor-pointer transition-colors",
                      sortField === option.field && "bg-gradient-to-r from-slate-100 to-slate-50 font-medium"
                    )}
                  >
                    {sortField === option.field && (
                      sortDirection === 'asc' 
                        ? <ArrowUp className="h-3.5 w-3.5 mr-2 text-slate-700" /> 
                        : <ArrowDown className="h-3.5 w-3.5 mr-2 text-slate-700" />
                    )}
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode */}
            <div data-tour="view-modes" className="flex items-center border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              {[
                { mode: 'compact' as const, icon: LayoutList, label: 'List' },
                { mode: 'cards' as const, icon: LayoutGrid, label: 'Cards' },
              ].map((view, idx) => (
                <Tooltip key={view.mode}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setViewMode(view.mode)}
                      className={cn(
                        "h-9 w-11 flex items-center justify-center transition-colors relative",
                        idx > 0 && "border-l border-slate-200",
                        viewMode === view.mode 
                          ? "bg-slate-800 text-white" 
                          : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      )}
                    >
                      <view.icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">{view.label} view</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700 font-medium bg-white"
                >
                  <div className="p-1 rounded-md bg-slate-100">
                    <Download className="h-3 w-3 text-slate-600" />
                  </div>
                  <span className="hidden sm:inline">Export</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white shadow-lg border-slate-200 p-1">
                <DropdownMenuItem onClick={() => handleExportFiltered('csv')} className="text-sm rounded-lg cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" /> Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportFiltered('json')} className="text-sm rounded-lg cursor-pointer">
                  <FileDown className="h-4 w-4 mr-2 text-slate-600" /> Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Keyboard Shortcuts Hint */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    // Dispatch keyboard shortcut help event
                    window.dispatchEvent(new CustomEvent('openKeyboardShortcuts'));
                  }}
                  className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-400 hover:text-slate-600"
                >
                  <kbd className="text-[10px] font-mono font-bold">?</kbd>
                </button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Selection Count & Quick Pagination Bar */}
        {(selectedContracts.size > 0 || totalPages > 1) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-white border border-slate-200/80 rounded-xl px-5 py-3 shadow-sm"
          >
            {/* Selection info */}
            <div className="flex items-center gap-3">
              {selectedContracts.size > 0 ? (
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-bold">{selectedContracts.size}</span>
                    <span className="text-xs font-medium">selected</span>
                  </motion.div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContracts(new Set())}
                    className="h-8 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium">Page {currentPage}</span>
                  <span className="text-slate-400">of</span>
                  <span className="font-medium">{totalPages}</span>
                </div>
              )}
            </div>
            
            {/* Quick pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-3 py-1 bg-slate-100 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 tabular-nums">
                    {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, contractsData?.total ?? 0)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Contracts List */}
        <div data-tour="contracts">
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
                    <NoResults
                      searchTerm={searchQuery || undefined}
                      hasFilters={statusFilter !== 'all' || Boolean(hasActiveFilters)}
                      onClearSearch={searchQuery ? () => setSearchQuery('') : undefined}
                      onClearFilters={clearFilters}
                    />
                  ) : (
                    <NoContracts
                      onUpload={() => router.push('/upload')}
                      additionalActions={(
                        <Button variant="outline" asChild className="gap-2">
                          <Link href="/import/external-database" className="gap-2">
                            <Database className="h-4 w-4" />
                            Import from DB
                          </Link>
                        </Button>
                      )}
                    />
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
              <Card className="overflow-hidden bg-white border-slate-200 shadow-sm rounded-xl" role="table" aria-label="Contracts list">
                {/* Table Header */}
                <div role="row" className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-16 lg:top-0 z-10">
                  <div role="columnheader" className="w-10 flex-shrink-0 flex items-center justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
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
                            className="border-slate-300 h-4 w-4 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800 transition-colors"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Select all on this page</TooltipContent>
                    </Tooltip>
                  </div>
                  <div role="columnheader" className="flex-1 min-w-[200px]">Contract</div>
                  <div role="columnheader" className="hidden lg:block w-[100px]">Category</div>
                  <div role="columnheader" className="hidden lg:block w-[80px]">Type</div>
                  <div role="columnheader" className="hidden md:block w-[120px]">Party</div>
                  <div role="columnheader" className="hidden lg:block w-[90px] text-right">Value</div>
                  <div role="columnheader" className="hidden md:block w-[90px]">Expires</div>
                  <div role="columnheader" className="hidden lg:block w-[70px]">Signed</div>
                  <div role="columnheader" className="w-[90px]">Status</div>
                  <div role="columnheader" className="w-10 flex-shrink-0"></div>
                </div>
                
                {/* Table Body */}
                <div role="rowgroup" data-testid="contracts-list">
                  {paginatedContracts.map((contract, index) => (
                    <ErrorBoundary
                      key={`eb-${contract.id}`}
                      fallback={
                        <div role="row" className="px-4 py-3 text-sm text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-800">
                          Failed to render contract row
                        </div>
                      }
                    >
                      <CompactContractRow
                        key={contract.id}
                        contract={contract}
                        index={index}
                        isSelected={selectedContracts.has(contract.id)}
                        searchQuery={searchQuery}
                        onSelect={() => toggleSelect(contract.id)}
                        onView={() => pushToContract(contract.id)}
                        onShare={() => handleShare(contract.id, contract.title || 'Contract')}
                        onDelete={() => handleDeleteClick(contract.id, contract.title || 'Contract')}
                        onDownload={() => handleDownload(contract.id)}
                        onApproval={() => handleRequestApproval(contract.id, contract.title || 'Contract')}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              </Card>
            </motion.div>
          ) : (
            /* ============ ENHANCED CARD VIEW ============ */
            <motion.div 
              key="card-list"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
              data-testid="contracts-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
            {enhancedContracts.map((contract, index) => {
                const originalContract = paginatedContracts[index];
                if (!originalContract) return null;
                return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="transform-gpu"
                >
                  <EnhancedContractCard
                    contract={contract}
                    isSelected={selectedContracts.has(contract.id)}
                    onSelect={() => toggleSelect(contract.id)}
                    onClick={() => handlePreview(originalContract)}
                    onQuickAction={(action) => {
                      switch (action) {
                        case 'ai':
                          window.dispatchEvent(new CustomEvent('openAIChatbot', {
                            detail: { 
                              autoMessage: `Tell me about this contract: ${contract.title || 'Unknown'} - ${(contract as any).supplierName || 'Unknown supplier'}`,
                              contractId: contract.id
                            }
                          }));
                          break;
                        case 'preview':
                          handlePreview(originalContract);
                          break;
                        case 'share':
                          handleShare(contract.id, contract.title || 'Contract');
                          break;
                        case 'favorite':
                          handleToggleFavorite(contract.id);
                          break;
                      }
                    }}
                    onDoubleClick={() => pushToContract(contract.id)}
                    showHealthIndicator
                    showPartyAvatars
                    enableHoverPreview
                  />
                </motion.div>
              );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        
        {/* Pagination Controls */}
        {sortedContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="py-4 px-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500 font-medium">Show</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label="Contracts per page"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 cursor-pointer hover:border-slate-300 transition-colors font-medium"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size} per page</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Page Info */}
                  <div className="text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-800 tabular-nums">{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, contractsData?.total ?? 0)}</span>
                    <span className="text-slate-400 mx-1.5"> of </span>
                    <span className="font-semibold text-slate-800 tabular-nums">{contractsData?.total ?? 0}</span>
                    <span className="text-slate-500 ml-1"> contracts</span>
                  </div>
                  
                  {/* Page Navigation */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="First page"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1.5 px-1">
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
                              "min-w-[34px] h-8 text-sm font-medium rounded-lg transition-colors",
                              currentPage === pageNum
                                ? 'bg-slate-800 text-white'
                                : 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                            )}
                            aria-label={`Page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      aria-label="Last page"
                    >
                      <ChevronsRight className="w-4 h-4" />
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
      
      {/* Bulk Export Confirmation Dialog */}
      <ConfirmDialog
        open={bulkExportDialogOpen}
        onOpenChange={setBulkExportDialogOpen}
        title="Export Multiple Contracts"
        description={`You are about to export ${selectedContracts.size} contracts. This will generate a downloadable file containing the selected contracts.`}
        variant="default"
        confirmLabel="Export"
        onConfirm={handleConfirmBulkAction}
        isLoading={isProcessingBulk}
      />
      
      {/* Bulk Analyze Confirmation Dialog */}
      <ConfirmDialog
        open={bulkAnalyzeDialogOpen}
        onOpenChange={setBulkAnalyzeDialogOpen}
        title="Analyze Multiple Contracts with AI"
        description={`You are about to send ${selectedContracts.size} contracts for AI analysis. This may take a few minutes depending on the contract complexity. Continue?`}
        variant="default"
        confirmLabel="Start Analysis"
        onConfirm={handleConfirmBulkAction}
        isLoading={isProcessingBulk}
      />
      
      {/* Bulk Share Confirmation Dialog */}
      <ConfirmDialog
        open={bulkShareDialogOpen}
        onOpenChange={setBulkShareDialogOpen}
        title="Share Multiple Contracts"
        description={`You are about to share ${selectedContracts.size} contracts. This will generate shareable links for all selected contracts.`}
        variant="default"
        confirmLabel="Generate Links"
        onConfirm={handleConfirmBulkAction}
        isLoading={isProcessingBulk}
      />

      {/* Contract Preview Panel */}
      <LazyContractPreviewPanel
        contract={previewContract}
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewContract(null);
        }}
        onNavigate={handlePreviewNavigate}
        onEdit={(id) => pushToContract(id)}
        onShare={(id) => {
          const contract = contracts.find(c => c.id === id);
          if (contract) handleShare(id, contract.title || 'Contract');
        }}
        onDownload={handleDownload}
        onDelete={(id) => {
          const contract = contracts.find(c => c.id === id);
          if (contract) handleDeleteClick(id, contract.title || 'Contract');
        }}
        onAskAI={() => window.dispatchEvent(new CustomEvent('openAIChatbot', {
          detail: {
            autoMessage: previewContract ? `Tell me about this contract: ${previewContract.filename || 'Unknown'}` : 'Help me analyze contracts',
            contractId: previewContract?.id
          }
        }))}
      />

      {/* Mobile Filters Sheet */}
      <MobileFiltersSheet
        isOpen={showMobileFilters}
        onOpenChange={setShowMobileFilters}
        filters={{
          search: searchQuery,
          status: statusFilter !== 'all' ? [statusFilter] : [],
          riskLevel: riskFilters,
          contractType: typeFilters,
        }}
        onFiltersChange={(filters) => {
          if (filters.search !== undefined) setSearchQuery(filters.search);
          if (filters.status) {
            setStatusFilter(filters.status.length > 0 ? filters.status[0] : 'all');
          }
          if (filters.riskLevel) setRiskFilters(filters.riskLevel);
          if (filters.contractType) setTypeFilters(filters.contractType);
        }}
        onApply={() => setShowMobileFilters(false)}
        onReset={clearFilters}
      />

      {/* Scroll to Top Button */}
      <ScrollToTopButton threshold={600} />
    </div>
    </TooltipProvider>
  );
}

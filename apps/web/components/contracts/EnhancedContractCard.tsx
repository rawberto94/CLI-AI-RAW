"use client";

import React, { useState, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  Star,
  Pin,
  Eye,
  MoreHorizontal,
  ChevronRight,
  Building2,
  User,
  Shield,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit,
  Download,
  Trash2,
  Copy,
  ExternalLink,
  Sparkles,
  Target,
  Scale,
  Heart,
  Link2,
  GitBranch,
  FileSignature,
  PenTool,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInDays, format, isValid, parseISO } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface ContractParty {
  id?: string;
  name: string;
  role: "client" | "vendor" | "partner" | "other";
  logo?: string;
  initials?: string;
  email?: string;
  phone?: string;
}

export interface ContractHealth {
  score: number; // 0-100
  riskLevel?: "low" | "medium" | "high" | "critical";
  issues?: string[];
  lastAssessed?: string;
  lastChecked?: Date;
}

export interface ContractHierarchyInfo {
  parentContract?: {
    id: string;
    fileName: string;
    contractType?: string;
  };
  childContracts?: Array<{
    id: string;
    fileName: string;
    contractType?: string;
    relationshipType?: string;
  }>;
  parentContractId?: string;
  relationshipType?: string;
  childCount?: number;
  hasHierarchy?: boolean;
}

export interface EnhancedContract {
  id: string;
  title?: string;
  type?: string;
  filename?: string;
  status?: "draft" | "pending" | "active" | "expired" | "terminated" | "renewal" | "completed" | "processing" | "failed";
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  expirationDate?: string;
  effectiveDate?: string;
  renewalDate?: string;
  parties?: ContractParty[] | { client?: string; supplier?: string };
  health?: ContractHealth;
  isPinned?: boolean;
  isFavorite?: boolean;
  lastModified?: string;
  createdAt?: string;
  tags?: string[];
  completeness?: number; // 0-100 percentage
  hasAttachments?: boolean;
  attachmentCount?: number;
  description?: string;
  riskScore?: number;
  keyTerms?: string[];
  category?: { id: string; name: string; color: string; icon?: string };
  processing?: { progress: number; currentStage?: string };
  // Signature status
  signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown';
  signatureRequiredFlag?: boolean;
  // Contract hierarchy
  hierarchy?: ContractHierarchyInfo;
  parentContractId?: string;
  parentContract?: { id: string; fileName: string; contractType?: string };
  childContracts?: Array<{ id: string; fileName: string; contractType?: string; relationshipType?: string }>;
  hasHierarchy?: boolean;
}

export interface EnhancedContractCardProps {
  contract: EnhancedContract;
  isSelected?: boolean;
  onSelect?: (id?: string, selected?: boolean) => void;
  onClick?: (id?: string) => void;
  onPin?: (id: string) => void;
  onFavorite?: (id: string) => void;
  onPreview?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onQuickAction?: (action: 'ai' | 'preview' | 'share' | 'favorite') => void;
  onDoubleClick?: () => void;
  variant?: "default" | "compact" | "detailed";
  showPreviewOnHover?: boolean;
  showHealthIndicator?: boolean;
  showPartyAvatars?: boolean;
  enableHoverPreview?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = "CHF"): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

function getDaysUntilExpiry(endDate?: string): number | null {
  if (!endDate) return null;
  try {
    const date = parseISO(endDate);
    if (!isValid(date)) return null;
    return differenceInDays(date, new Date());
  } catch {
    return null;
  }
}

type StatusConfig = { color: string; icon: typeof FileText; label: string; dotColor: string };

function getStatusConfig(status?: EnhancedContract["status"]): StatusConfig {
  const defaultConfig: StatusConfig = {
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: FileText,
    label: "Draft",
    dotColor: "bg-slate-400",
  };
  
  const configs: Record<string, StatusConfig> = {
    draft: defaultConfig,
    pending: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
      label: "Pending Review",
      dotColor: "bg-amber-400",
    },
    active: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      label: "Active",
      dotColor: "bg-emerald-400",
    },
    expired: {
      color: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
      label: "Expired",
      dotColor: "bg-red-400",
    },
    terminated: {
      color: "bg-slate-100 text-slate-700 border-slate-200",
      icon: XCircle,
      label: "Terminated",
      dotColor: "bg-slate-400",
    },
    renewal: {
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: AlertCircle,
      label: "Up for Renewal",
      dotColor: "bg-blue-400",
    },
    processing: {
      color: "bg-cyan-50 text-cyan-700 border-cyan-200",
      icon: Clock,
      label: "Processing",
      dotColor: "bg-cyan-400",
    },
    completed: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      label: "Completed",
      dotColor: "bg-emerald-400",
    },
    failed: {
      color: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
      label: "Failed",
      dotColor: "bg-red-400",
    },
  };
  
  if (status && configs[status]) {
    return configs[status];
  }
  return defaultConfig;
}

function getRiskConfig(riskLevel?: ContractHealth["riskLevel"]) {
  const configs = {
    low: { color: "text-violet-500", bg: "bg-violet-100", label: "Low Risk" },
    medium: { color: "text-amber-500", bg: "bg-amber-100", label: "Medium Risk" },
    high: { color: "text-orange-500", bg: "bg-orange-100", label: "High Risk" },
    critical: { color: "text-red-500", bg: "bg-red-100", label: "Critical Risk" },
  };
  return riskLevel ? configs[riskLevel] : null;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PartyAvatarProps {
  party: ContractParty;
  size?: "sm" | "md" | "lg";
}

const PartyAvatar = memo(function PartyAvatar({ party, size = "md" }: PartyAvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const roleColors = {
    client: "bg-blue-100 text-blue-700 ring-blue-200",
    vendor: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    partner: "bg-amber-100 text-amber-700 ring-amber-200",
    other: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  if (party.logo) {
    return (
      
      <img
        src={party.logo}
        alt={party.name}
        className={cn(sizeClasses[size], "rounded-full object-cover ring-2 ring-white")}
      />
    );
  }

  const initials =
    party.initials ||
    party.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div
      className={cn(
        sizeClasses[size],
        roleColors[party.role],
        "rounded-full flex items-center justify-center font-medium ring-2 ring-white"
      )}
    >
      {initials}
    </div>
  );
});

export interface HealthIndicatorProps {
  health?: ContractHealth;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const HealthIndicator = memo(function HealthIndicator({
  health,
  showDetails = false,
  size = 'md',
  showLabel = false,
}: HealthIndicatorProps) {
  if (!health) return null;

  const riskConfig = getRiskConfig(health.riskLevel);
  if (!riskConfig) return null;

  // Size configurations
  const sizeConfig = {
    sm: { svg: 'w-6 h-6', radius: 10, stroke: 2, font: 'text-[8px]' },
    md: { svg: 'w-8 h-8', radius: 12, stroke: 3, font: 'text-[10px]' },
    lg: { svg: 'w-16 h-16', radius: 24, stroke: 4, font: 'text-sm' },
  };

  const cfg = sizeConfig[size];
  const circumference = 2 * Math.PI * cfg.radius;
  const strokeDashoffset = circumference - (health.score / 100) * circumference;
  const viewBox = size === 'lg' ? '0 0 64 64' : '0 0 32 32';
  const center = size === 'lg' ? 32 : 16;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1">
            <div className="relative inline-flex items-center justify-center">
              <svg className={cn(cfg.svg, "transform -rotate-90")} viewBox={viewBox}>
                {/* Background circle */}
                <circle
                  cx={center}
                  cy={center}
                  r={cfg.radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.stroke}
                  className="text-slate-200"
                />
                {/* Progress circle */}
                <circle
                  cx={center}
                  cy={center}
                  r={cfg.radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={riskConfig.color}
                />
              </svg>
              <span className={cn("absolute font-bold", cfg.font, riskConfig.color)}>
                {health.score}
              </span>
            </div>
            {showLabel && (
              <span className="text-xs font-medium text-slate-600">{riskConfig.label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-semibold">{riskConfig.label}</p>
          <p className="text-xs text-muted-foreground">Health Score: {health.score}/100</p>
          {health.issues && health.issues.length > 0 && (
            <ul className="mt-1 text-xs space-y-0.5">
              {health.issues.slice(0, 3).map((issue, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-current" />
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

interface ExpiryBadgeProps {
  endDate?: string;
  status: EnhancedContract["status"];
}

const ExpiryBadge = memo(function ExpiryBadge({ endDate, status }: ExpiryBadgeProps) {
  const daysUntil = getDaysUntilExpiry(endDate);

  if (daysUntil === null || status === "expired" || status === "terminated") return null;

  let variant: "default" | "warning" | "danger" | "success" = "default";
  let label = "";

  if (daysUntil < 0) {
    variant = "danger";
    label = "Expired";
  } else if (daysUntil <= 7) {
    variant = "danger";
    label = daysUntil === 0 ? "Expires today" : `${daysUntil}d left`;
  } else if (daysUntil <= 30) {
    variant = "warning";
    label = `${daysUntil}d left`;
  } else if (daysUntil <= 90) {
    variant = "success";
    label = `${Math.floor(daysUntil / 30)}mo left`;
  } else {
    return null;
  }

  const colors = {
    default: "bg-slate-100 text-slate-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700 ring-1 ring-red-300",
    success: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
        colors[variant]
      )}
    >
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
});

// ============================================================================
// SignatureBadge Component - Shows signature status
// ============================================================================

interface SignatureBadgeProps {
  signatureStatus?: EnhancedContract["signatureStatus"];
  signatureRequiredFlag?: boolean;
}

const SignatureBadge = memo(function SignatureBadge({ signatureStatus, signatureRequiredFlag }: SignatureBadgeProps) {
  if (!signatureStatus || signatureStatus === 'unknown') return null;

  const configs = {
    signed: {
      color: "bg-emerald-100 text-emerald-700",
      icon: CheckCircle2,
      label: "Signed",
    },
    partially_signed: {
      color: "bg-amber-100 text-amber-700",
      icon: PenTool,
      label: "Partial",
    },
    unsigned: {
      color: signatureRequiredFlag ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-red-100 text-red-700",
      icon: FileSignature,
      label: "Unsigned",
    },
  };

  const config = configs[signatureStatus];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
              config.color
            )}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {signatureStatus === 'signed' && 'Contract has been fully signed'}
            {signatureStatus === 'partially_signed' && 'Contract is partially signed - awaiting additional signatures'}
            {signatureStatus === 'unsigned' && (signatureRequiredFlag 
              ? '⚠️ Contract needs signature attention' 
              : 'Contract has not been signed yet')}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// ============================================================================
// HierarchyBadge Component - Shows parent/child contract relationships
// ============================================================================

interface HierarchyBadgeProps {
  contract: EnhancedContract;
}

const HierarchyBadge = memo(function HierarchyBadge({ contract }: HierarchyBadgeProps) {
  const hasParent = contract.parentContractId || contract.parentContract || contract.hierarchy?.parentContract;
  const childCount = contract.childContracts?.length || contract.hierarchy?.childContracts?.length || contract.hierarchy?.childCount || 0;
  const hasHierarchy = hasParent || childCount > 0 || contract.hasHierarchy;
  
  if (!hasHierarchy) return null;

  const parentName = contract.parentContract?.fileName || contract.hierarchy?.parentContract?.fileName;
  const relationshipType = contract.hierarchy?.relationshipType;
  
  // Format relationship type for display
  const formatRelationship = (type?: string) => {
    if (!type) return "";
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
              hasParent ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"
            )}
          >
            {hasParent ? (
              <>
                <Link2 className="w-3 h-3" />
                <span>Linked</span>
              </>
            ) : (
              <>
                <GitBranch className="w-3 h-3" />
                <span>{childCount} child{childCount !== 1 ? "ren" : ""}</span>
              </>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            {hasParent && (
              <div>
                <span className="font-medium">Parent: </span>
                <span className="text-muted-foreground">{parentName || "Linked contract"}</span>
                {relationshipType && (
                  <span className="text-muted-foreground"> ({formatRelationship(relationshipType)})</span>
                )}
              </div>
            )}
            {childCount > 0 && (
              <div>
                <span className="font-medium">Children: </span>
                <span className="text-muted-foreground">{childCount} linked contract{childCount !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

interface CompletenessBarProps {
  percentage?: number;
}

const CompletenessBar = memo(function CompletenessBar({ percentage }: CompletenessBarProps) {
  if (percentage === undefined) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">Completeness</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            percentage >= 80
              ? "bg-emerald-500"
              : percentage >= 50
              ? "bg-amber-500"
              : "bg-red-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
});

// ============================================================================
// Quick Preview Tooltip (shows on hover)
// ============================================================================

interface QuickPreviewProps {
  contract: EnhancedContract;
}

const QuickPreview = memo(function QuickPreview({ contract }: QuickPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="absolute left-full top-0 ml-3 z-50 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 p-5 pointer-events-none overflow-hidden"
    >
      {/* Decorative gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-violet-500 to-purple-500" />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-base text-slate-900 line-clamp-1">{contract.title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{contract.type}</p>
        </div>
        {contract.health && (
          <div className="ml-3">
            <HealthIndicator health={contract.health} size="md" />
          </div>
        )}
      </div>

      {/* Description */}
      {contract.description && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">{contract.description}</p>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {contract.value !== undefined && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50 border border-violet-100">
            <div className="p-1.5 rounded-lg bg-violet-500 shadow-sm">
              <DollarSign className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm text-violet-700">
              {formatCurrency(contract.value, contract.currency)}
            </span>
          </div>
        )}
        {contract.endDate && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50 border border-violet-100">
            <div className="p-1.5 rounded-lg bg-violet-500 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm text-violet-700 font-medium">{format(parseISO(contract.endDate), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Parties */}
      {contract.parties && Array.isArray(contract.parties) && contract.parties.length > 0 && (
      <div className="border-t border-slate-100 pt-4">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Parties</p>
        <div className="space-y-2">
          {contract.parties.slice(0, 3).map((party: ContractParty) => (
            <div key={party.id || party.name} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <PartyAvatar party={party} size="sm" />
              <span className="text-sm font-medium text-slate-700 truncate flex-1">{party.name}</span>
              <span className="text-[10px] text-slate-400 capitalize px-2 py-0.5 bg-white rounded-full border border-slate-200">{party.role}</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Tags */}
      {contract.tags && contract.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-100">
          {contract.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 border-0">
              {tag}
            </Badge>
          ))}
          {contract.tags.length > 4 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-slate-200">
              +{contract.tags.length - 4}
            </Badge>
          )}
        </div>
      )}
    </motion.div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const EnhancedContractCard = memo(function EnhancedContractCard({
  contract,
  isSelected = false,
  onSelect,
  onClick,
  onPin,
  onFavorite,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onAnalyze,
  variant = "default",
  showPreviewOnHover = false,
  className,
}: EnhancedContractCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const statusConfig = useMemo(() => getStatusConfig(contract.status), [contract.status]);
  const StatusIcon = statusConfig.icon;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    if ((e.target as HTMLElement).closest("button, a, [role='button']")) {
      return;
    }
    onClick?.(contract.id);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(contract.id, e.target.checked);
  };

  // Determine if contract needs attention (expiring soon, etc.)
  const daysUntil = getDaysUntilExpiry(contract.endDate);
  const needsAttention = daysUntil !== null && daysUntil <= 30 && daysUntil >= 0;
  const isExpired = daysUntil !== null && daysUntil < 0;
  const isHighValue = (contract.value || 0) >= 100000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      data-testid="contract-card"
      className={cn(
        "group relative bg-white rounded-xl border shadow-sm transition-all duration-300 overflow-hidden",
        isSelected && "ring-2 ring-slate-300 border-slate-300 shadow-lg shadow-slate-200/20",
        isHovered && "shadow-xl border-slate-300",
        contract.isPinned && "border-l-4 border-l-amber-400",
        needsAttention && !isExpired && "border-l-4 border-l-amber-500",
        isExpired && "border-l-4 border-l-red-500",
        variant === "compact" ? "p-3" : "p-4",
        className
      )}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowQuickActions(false);
      }}
    >
      {/* Premium Gradient Overlay on Hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] via-transparent to-violet-500/[0.02] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      
      {/* High-value indicator moved to status area for cleaner design */}
      
      {/* Selection Checkbox (absolute positioned) */}
      <motion.div
        className="absolute left-3 top-3 z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: isHovered || isSelected ? 1 : 0,
          scale: isHovered || isSelected ? 1 : 0.8
        }}
        transition={{ duration: 0.2 }}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect?.(contract.id, !!checked)}
          className="border-slate-300 h-4 w-4 data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
          aria-label={`Select ${contract.title || contract.filename || 'contract'}`}
        />
      </motion.div>

      {/* Pin & Favorite Indicators (top right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        <AnimatePresence>
          {contract.isFavorite && (
            <motion.div key="EnhancedContractCard-ap-1"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-sm" />
            </motion.div>
          )}
          {contract.isPinned && (
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Pin className="w-4 h-4 text-amber-500 fill-amber-500 drop-shadow-sm" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      <div className="space-y-3 pl-6">
        {/* Header Row: Title + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors duration-200">
              {contract.title}
            </h3>
            <p className="text-sm text-muted-foreground">{contract.type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs border shrink-0 shadow-sm transition-all duration-200",
                statusConfig.color,
                isHovered && "shadow-md"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusConfig.dotColor)} />
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* Parties Row */}
        {contract.parties && Array.isArray(contract.parties) && contract.parties.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {contract.parties.slice(0, 3).map((party: ContractParty, index: number) => (
                <motion.div
                  key={party.id || party.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PartyAvatar party={party} size="sm" />
                </motion.div>
              ))}
              {contract.parties.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 text-[10px] flex items-center justify-center ring-2 ring-white font-medium">
                  +{contract.parties.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {contract.parties.map((p: ContractParty) => p.name).join(", ")}
            </span>
          </div>
        )}

        {/* Info Row: Value, Date, Expiry, Hierarchy, Signature */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm">
          {contract.value !== undefined && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <div className="p-1 rounded-md bg-violet-50">
                <DollarSign className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <span className="font-semibold text-violet-700">
                {formatCurrency(contract.value, contract.currency)}
              </span>
            </div>
          )}
          {contract.endDate && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <div className="p-1 rounded-md bg-violet-50">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <span>{format(parseISO(contract.endDate), "MMM d, yyyy")}</span>
            </div>
          )}
          <ExpiryBadge endDate={contract.endDate} status={contract.status} />
          <SignatureBadge signatureStatus={contract.signatureStatus} signatureRequiredFlag={contract.signatureRequiredFlag} />
          <HierarchyBadge contract={contract} />
        </div>

        {/* Health & Completeness Row */}
        {(contract.health || contract.completeness !== undefined) && (
          <div className="flex items-center gap-4">
            {contract.health && <HealthIndicator health={contract.health} />}
            {contract.completeness !== undefined && variant !== "compact" && (
              <div className="flex-1 max-w-[150px]">
                <CompletenessBar percentage={contract.completeness} />
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {contract.tags && contract.tags.length > 0 && variant !== "compact" && (
          <div className="flex flex-wrap gap-1">
            {contract.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-2 py-0 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {tag}
              </Badge>
            ))}

            {contract.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                +{contract.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Footer: Last Modified + Attachments */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            {contract.lastModified && (
              <>
                <Clock className="w-3 h-3" />
                <span>
                  Updated{" "}
                  {formatDistanceToNow(parseISO(contract.lastModified), { addSuffix: true })}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {contract.hasAttachments && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {contract.attachmentCount || 0}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Bar (appears on hover) - Premium Glassmorphism */}
      <AnimatePresence>
        {isHovered && (
          <motion.div key="hovered"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-white/90 border-t border-slate-200/50 pt-3 pb-3 px-4 flex items-center justify-between rounded-b-xl shadow-lg"
          >
            <div className="flex items-center gap-0.5">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-violet-100 hover:text-violet-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview?.(contract.id);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">Preview</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 transition-colors",
                          contract.isPinned 
                            ? "text-amber-500 bg-amber-50 hover:bg-amber-100" 
                            : "hover:bg-amber-50 hover:text-amber-600"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPin?.(contract.id);
                        }}
                      >
                        <Pin className={cn("w-4 h-4", contract.isPinned && "fill-current")} />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">{contract.isPinned ? "Unpin" : "Pin"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 w-8 p-0 transition-colors",
                          contract.isFavorite 
                            ? "text-red-500 bg-red-50 hover:bg-red-100" 
                            : "hover:bg-red-50 hover:text-red-600"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFavorite?.(contract.id);
                        }}
                      >
                        <Heart className={cn("w-4 h-4", contract.isFavorite && "fill-current")} />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">{contract.isFavorite ? "Unfavorite" : "Favorite"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-violet-100 hover:text-violet-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAnalyze?.(contract.id);
                        }}
                      >
                        <Sparkles className="w-4 h-4 text-violet-600" />
                      </Button>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-0">AI Analyze</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="sm"
                  className="h-8 px-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white shadow-md shadow-violet-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.(contract.id);
                  }}
                >
                  Open
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100" aria-label="Contract actions">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-sm">
                  <DropdownMenuItem onClick={() => onEdit?.(contract.id)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate?.(contract.id)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExport?.(contract.id)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete?.(contract.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Preview Tooltip */}
      <AnimatePresence>
        {showPreviewOnHover && isHovered && <QuickPreview contract={contract} />}
      </AnimatePresence>
    </motion.div>
  );
});

// ============================================================================
// Compact Row Variant for List View
// ============================================================================

export type EnhancedContractRowProps = Omit<EnhancedContractCardProps, "variant">;

export const EnhancedContractRow = memo(function EnhancedContractRow({
  contract,
  isSelected = false,
  onSelect,
  onClick,
  onPin,
  onFavorite,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onAnalyze,
  className,
}: EnhancedContractRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const statusConfig = useMemo(() => getStatusConfig(contract.status), [contract.status]);
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ backgroundColor: "rgba(249, 250, 251, 1)" }}
      className={cn(
        "group relative flex items-center gap-4 px-4 py-3.5 bg-white border-b border-slate-100 transition-all duration-200 cursor-pointer",
        isSelected && "bg-gradient-to-r from-primary/5 to-violet-500/5 border-l-[3px] border-l-primary shadow-sm",
        isHovered && !isSelected && "bg-slate-50/80",
        className
      )}
      onClick={() => onClick?.(contract.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Selection indicator glow */}
      {isSelected && (
        <motion.div
          layoutId={`row-glow-${contract.id}`}
          className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-violet-500 to-purple-500 rounded-r"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect?.(contract.id, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0 shrink-0 accent-primary cursor-pointer"
      />

      {/* Pin/Favorite indicators */}
      <div className="w-8 flex items-center gap-0.5 shrink-0">
        {contract.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
        {contract.isFavorite && <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />}
      </div>

      {/* Title & Type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-slate-900 truncate group-hover:text-primary transition-colors duration-200">
            {contract.title}
          </h4>
          <ExpiryBadge endDate={contract.endDate} status={contract.status} />
          <SignatureBadge signatureStatus={contract.signatureStatus} signatureRequiredFlag={contract.signatureRequiredFlag} />
          <HierarchyBadge contract={contract} />
        </div>
        <p className="text-sm text-slate-500 truncate mt-0.5">{contract.type}</p>
      </div>

      {/* Parties */}
      <div className="hidden lg:flex items-center gap-2 w-40 shrink-0">
        <div className="flex -space-x-2">
          {contract.parties && Array.isArray(contract.parties) && contract.parties.slice(0, 2).map((party: ContractParty) => (
            <PartyAvatar key={party.id || party.name} party={party} size="sm" />
          ))}
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {contract.parties && Array.isArray(contract.parties) && contract.parties.length > 0 && contract.parties[0] ? contract.parties[0].name : "-"}
        </span>
      </div>

      {/* Value */}
      <div className="hidden md:flex items-center gap-1.5 w-28 shrink-0">
        <div className="p-1 rounded-md bg-violet-50">
          <DollarSign className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <span className="font-semibold text-sm text-violet-700">
          {contract.value !== undefined
            ? formatCurrency(contract.value, contract.currency)
            : "-"}
        </span>
      </div>

      {/* Date */}
      <div className="hidden md:block w-24 text-sm text-slate-600 shrink-0">
        {contract.endDate ? format(parseISO(contract.endDate), "MMM d, yyyy") : "-"}
      </div>

      {/* Status */}
      <div className="w-32 shrink-0">
        <Badge variant="outline" className={cn("text-xs border shadow-sm transition-shadow hover:shadow-md", statusConfig.color)}>
          <span className={cn("w-2 h-2 rounded-full mr-1.5", statusConfig.dotColor)} />
          {statusConfig.label}
        </Badge>
      </div>

      {/* Health */}
      <div className="w-10 shrink-0">
        <HealthIndicator health={contract.health} />
      </div>

      {/* Actions */}
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 10 }}
        transition={{ duration: 0.2 }}
      >
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview?.(contract.id);
                }}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-0">Preview</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-slate-100 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-white/95 backdrop-blur-sm shadow-xl border-slate-200">
            <DropdownMenuItem onClick={() => onPin?.(contract.id)} className="gap-2 cursor-pointer">
              <Pin className="w-4 h-4 text-amber-500" />
              {contract.isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFavorite?.(contract.id)} className="gap-2 cursor-pointer">
              <Heart className="w-4 h-4 text-red-500" />
              {contract.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAnalyze?.(contract.id)} className="gap-2 cursor-pointer">
              <Sparkles className="w-4 h-4 text-violet-500" />
              AI Analyze
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => onEdit?.(contract.id)} className="gap-2 cursor-pointer">
              <Edit className="w-4 h-4 text-slate-500" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate?.(contract.id)} className="gap-2 cursor-pointer">
              <Copy className="w-4 h-4 text-slate-500" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.(contract.id)} className="gap-2 cursor-pointer">
              <Download className="w-4 h-4 text-slate-500" />
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem
              onClick={() => onDelete?.(contract.id)}
              className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </motion.div>
);
});

// ============================================================================
// Export all (HealthIndicator already exported with its declaration)
// ============================================================================

export { PartyAvatar, ExpiryBadge, HierarchyBadge, CompletenessBar, QuickPreview };

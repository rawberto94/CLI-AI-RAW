"use client";

import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  Building2,
  User,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Edit,
  Download,
  Trash2,
  Copy,
  Share2,
  Sparkles,
  Tag,
  Paperclip,
  MessageSquare,
  History,
  MoreHorizontal,
  Eye,
  Lock,
  Unlock,
  RefreshCw,
  Scale,
  Target,
  Bookmark,
  Heart,
  Pin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, formatDistanceToNow, differenceInDays } from "date-fns";
import type { EnhancedContract, ContractParty, ContractHealth } from "./EnhancedContractCard";

// ============================================================================
// Types
// ============================================================================

export interface ContractActivity {
  id: string;
  type: "created" | "updated" | "status_changed" | "comment" | "attachment" | "ai_analysis";
  description: string;
  user?: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
  details?: Record<string, any>;
}

export interface ContractClause {
  id: string;
  title: string;
  section: string;
  riskLevel?: "low" | "medium" | "high";
  summary?: string;
  flags?: string[];
}

export interface ContractAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
}

// Override keyTerms to support both simple strings and label/value pairs
export interface ExtendedContract extends Omit<EnhancedContract, 'keyTerms'> {
  clauses?: ContractClause[];
  activities?: ContractActivity[];
  attachments?: ContractAttachment[];
  notes?: string;
  keyTerms?: Array<{ label: string; value: string }> | string[];
  obligations?: Array<{
    id: string;
    description: string;
    dueDate?: string;
    status: "pending" | "completed" | "overdue";
    assignee?: string;
  }>;
  summary?: string;
}

export interface ContractPreviewPanelProps {
  contract: ExtendedContract | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  onOpenFull?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string) => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onAskAI?: () => void;
  onPin?: (id: string) => void;
  onFavorite?: (id: string) => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  position?: "right" | "bottom";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusConfig(status?: EnhancedContract["status"]) {
  const configs: Record<string, { color: string; icon: typeof FileText; label: string }> = {
    draft: { color: "bg-slate-100 text-slate-700", icon: FileText, label: "Draft" },
    pending: { color: "bg-amber-50 text-amber-700", icon: Clock, label: "Pending Review" },
    active: { color: "bg-violet-50 text-violet-700", icon: CheckCircle2, label: "Active" },
    expired: { color: "bg-red-50 text-red-700", icon: AlertTriangle, label: "Expired" },
    terminated: { color: "bg-gray-100 text-gray-700", icon: X, label: "Terminated" },
    renewal: { color: "bg-violet-50 text-violet-700", icon: RefreshCw, label: "Up for Renewal" },
    processing: { color: "bg-violet-50 text-violet-700", icon: RefreshCw, label: "Processing" },
    completed: { color: "bg-violet-50 text-violet-700", icon: CheckCircle2, label: "Completed" },
    failed: { color: "bg-red-50 text-red-700", icon: AlertTriangle, label: "Failed" },
  };
  return status && configs[status] ? configs[status] : configs.draft;
}

function getRiskBadge(riskLevel?: "low" | "medium" | "high" | "critical") {
  const configs = {
    low: { color: "bg-violet-100 text-violet-700", label: "Low Risk" },
    medium: { color: "bg-amber-100 text-amber-700", label: "Medium Risk" },
    high: { color: "bg-red-100 text-red-700", label: "High Risk" },
    critical: { color: "bg-red-200 text-red-800", label: "Critical Risk" },
  };
  return riskLevel ? configs[riskLevel] : null;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface OverviewTabProps {
  contract: ExtendedContract;
}

const OverviewTab = memo(function OverviewTab({ contract }: OverviewTabProps) {
  const statusConfig = getStatusConfig(contract.status) || { icon: FileText, label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
  const StatusIcon = statusConfig.icon;

  const daysUntilExpiry = contract.endDate
    ? differenceInDays(parseISO(contract.endDate), new Date())
    : null;

  return (
    <div className="space-y-6 p-4">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <div className="flex items-center gap-2">
            <StatusIcon className="w-4 h-4" />
            <span className="font-medium text-sm">{statusConfig.label}</span>
          </div>
        </div>

        {/* Value */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Value</p>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-sm">
              {contract.value !== undefined
                ? formatCurrency(contract.value, contract.currency)
                : "—"}
            </span>
          </div>
        </div>

        {/* Start Date */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Start Date</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" />
            <span className="font-medium text-sm">
              {contract.startDate
                ? format(parseISO(contract.startDate), "MMM d, yyyy")
                : "—"}
            </span>
          </div>
        </div>

        {/* End Date */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">End Date</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-sm">
              {contract.endDate
                ? format(parseISO(contract.endDate), "MMM d, yyyy")
                : "—"}
            </span>
          </div>
          {daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30 && (
            <p className="text-xs text-orange-600 mt-1">
              {daysUntilExpiry === 0 ? "Expires today!" : `${daysUntilExpiry} days left`}
            </p>
          )}
        </div>
      </div>

      {/* Health Score */}
      {contract.health && (
        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Contract Health</span>
            <Badge
              className={cn(
                "text-xs",
                contract.health.riskLevel === "low" && "bg-violet-100 text-violet-700",
                contract.health.riskLevel === "medium" && "bg-amber-100 text-amber-700",
                contract.health.riskLevel === "high" && "bg-orange-100 text-orange-700",
                contract.health.riskLevel === "critical" && "bg-red-100 text-red-700"
              )}
            >
              {contract.health.riskLevel ? (
                contract.health.riskLevel.charAt(0).toUpperCase() +
                contract.health.riskLevel.slice(1)
              ) : 'Unknown'}{" "}
              Risk
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  contract.health.score >= 80 && "bg-violet-500",
                  contract.health.score >= 50 && contract.health.score < 80 && "bg-amber-500",
                  contract.health.score < 50 && "bg-red-500"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${contract.health.score}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-lg font-bold">{contract.health.score}</span>
          </div>
          {contract.health.issues && contract.health.issues.length > 0 && (
            <div className="mt-3 space-y-1">
              {contract.health.issues.slice(0, 3).map((issue, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parties */}
      {contract.parties && Array.isArray(contract.parties) && contract.parties.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Parties Involved
          </h4>
          <div className="space-y-2">
            {contract.parties.map((party: ContractParty) => (
              <div
                key={party.id || party.name}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                {party.logo ? (
                  
                  <img
                    src={party.logo}
                    alt={party.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center text-violet-700 font-semibold">
                    {party.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{party.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{party.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Terms */}
      {contract.keyTerms && contract.keyTerms.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Key Terms
          </h4>
          <div className="space-y-2">
            {contract.keyTerms.map((term, i) => {
              // Handle both string[] and { label, value }[] formats
              if (typeof term === 'string') {
                return (
                  <div key={i} className="flex items-center py-2 border-b last:border-0">
                    <span className="text-sm font-medium">{term}</span>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{term.label}</span>
                  <span className="text-sm font-medium">{term.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {contract.tags && contract.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {contract.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {contract.notes && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Notes
          </h4>
          <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
            {contract.notes}
          </p>
        </div>
      )}
    </div>
  );
});

interface ClausesTabProps {
  clauses?: ContractClause[];
}

const ClausesTab = memo(function ClausesTab({ clauses }: ClausesTabProps) {
  if (!clauses || clauses.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-muted-foreground">No clauses analyzed yet</p>
        <Button variant="outline" size="sm" className="mt-3">
          <Sparkles className="w-4 h-4 mr-2" />
          Run AI Analysis
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {clauses.map((clause) => {
        const riskBadge = getRiskBadge(clause.riskLevel);
        return (
          <div
            key={clause.id}
            className={cn(
              "p-3 rounded-lg border",
              clause.riskLevel === "high" && "border-red-200 bg-red-50/50",
              clause.riskLevel === "medium" && "border-amber-200 bg-amber-50/50",
              (!clause.riskLevel || clause.riskLevel === "low") && "border-gray-200 bg-gray-50/50"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium text-sm">{clause.title}</p>
                <p className="text-xs text-muted-foreground">{clause.section}</p>
              </div>
              {riskBadge && (
                <Badge className={cn("text-xs shrink-0", riskBadge.color)}>
                  {riskBadge.label}
                </Badge>
              )}
            </div>
            {clause.summary && (
              <p className="text-xs text-muted-foreground">{clause.summary}</p>
            )}
            {clause.flags && clause.flags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clause.flags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

interface ObligationsTabProps {
  obligations?: ExtendedContract["obligations"];
}

const ObligationsTab = memo(function ObligationsTab({ obligations }: ObligationsTabProps) {
  if (!obligations || obligations.length === 0) {
    return (
      <div className="p-8 text-center">
        <Target className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-muted-foreground">No obligations tracked</p>
        <Button variant="outline" size="sm" className="mt-3">
          Add Obligation
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {obligations.map((obligation) => (
        <div
          key={obligation.id}
          className={cn(
            "p-3 rounded-lg border",
            obligation.status === "overdue" && "border-red-200 bg-red-50/50",
            obligation.status === "pending" && "border-gray-200 bg-gray-50/50",
            obligation.status === "completed" && "border-violet-200 bg-violet-50/50"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                obligation.status === "completed" && "bg-violet-500 text-white",
                obligation.status === "pending" && "border-2 border-gray-300",
                obligation.status === "overdue" && "bg-red-500 text-white"
              )}
            >
              {obligation.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
              {obligation.status === "overdue" && <AlertTriangle className="w-3 h-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{obligation.description}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {obligation.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(parseISO(obligation.dueDate), "MMM d, yyyy")}
                  </span>
                )}
                {obligation.assignee && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {obligation.assignee}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

interface AttachmentsTabProps {
  attachments?: ContractAttachment[];
}

const AttachmentsTab = memo(function AttachmentsTab({ attachments }: AttachmentsTabProps) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="p-8 text-center">
        <Paperclip className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-muted-foreground">No attachments</p>
        <Button variant="outline" size="sm" className="mt-3">
          Upload File
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{attachment.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)} •{" "}
              {format(parseISO(attachment.uploadedAt), "MMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
});

interface ActivityTabProps {
  activities?: ContractActivity[];
}

const ActivityTab = memo(function ActivityTab({ activities }: ActivityTabProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="p-8 text-center">
        <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-muted-foreground">No activity recorded</p>
      </div>
    );
  }

  const activityIcons = {
    created: FileText,
    updated: Edit,
    status_changed: RefreshCw,
    comment: MessageSquare,
    attachment: Paperclip,
    ai_analysis: Sparkles,
  };

  return (
    <div className="p-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-4">
          {activities.map((activity, i) => {
            const Icon = activityIcons[activity.type] || History;
            return (
              <div key={activity.id} className="relative flex gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center z-10",
                    activity.type === "ai_analysis" && "bg-violet-100 text-violet-600",
                    activity.type === "created" && "bg-violet-100 text-violet-600",
                    activity.type === "updated" && "bg-violet-100 text-violet-600",
                    activity.type === "status_changed" && "bg-amber-100 text-amber-600",
                    activity.type === "comment" && "bg-gray-100 text-gray-600",
                    activity.type === "attachment" && "bg-violet-100 text-violet-600"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {activity.user && <span>{activity.user.name}</span>}
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const ContractPreviewPanel = memo(function ContractPreviewPanel({
  contract,
  isOpen,
  onClose,
  onNavigate,
  onOpenFull,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onAnalyze,
  onPin,
  onFavorite,
  hasNext = false,
  hasPrev = false,
  position = "right",
  className,
}: ContractPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isExpanded, setIsExpanded] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        if (hasPrev) onNavigate?.("prev");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        if (hasNext) onNavigate?.("next");
      } else if (e.key === "Enter" && contract) {
        onOpenFull?.(contract.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasNext, hasPrev, contract, onClose, onNavigate, onOpenFull]);

  if (!contract) return null;

  const statusConfig = getStatusConfig(contract.status) || { icon: FileText, label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
  const StatusIcon = statusConfig.icon;

  const panelVariants = {
    right: {
      initial: { x: "100%", opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: "100%", opacity: 0 },
    },
    bottom: {
      initial: { y: "100%", opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: "100%", opacity: 0 },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="contents">
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black lg:hidden z-40"
            onClick={onClose}
          />

          <motion.div
            initial={panelVariants[position].initial}
            animate={panelVariants[position].animate}
            exit={panelVariants[position].exit}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50 bg-white shadow-2xl flex flex-col",
              position === "right" && [
                "right-0 top-0 bottom-0",
                isExpanded ? "w-[600px]" : "w-[400px]",
                "border-l",
              ],
              position === "bottom" && [
                "left-0 right-0 bottom-0",
                isExpanded ? "h-[80vh]" : "h-[50vh]",
                "border-t rounded-t-2xl",
              ],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3 min-w-0">
                {/* Navigation buttons */}
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={!hasPrev}
                          onClick={() => onNavigate?.("prev")}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous (↑ or k)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={!hasNext}
                          onClick={() => onNavigate?.("next")}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next (↓ or j)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{contract.title}</h3>
                  <p className="text-sm text-muted-foreground">{contract.type}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 w-8 p-0", contract.isPinned && "text-amber-500")}
                        onClick={() => onPin?.(contract.id)}
                      >
                        <Pin className={cn("w-4 h-4", contract.isPinned && "fill-current")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{contract.isPinned ? "Unpin" : "Pin"}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-8 w-8 p-0", contract.isFavorite && "text-red-500")}
                        onClick={() => onFavorite?.(contract.id)}
                      >
                        <Heart className={cn("w-4 h-4", contract.isFavorite && "fill-current")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {contract.isFavorite ? "Unfavorite" : "Favorite"}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                      >
                        {isExpanded ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isExpanded ? "Collapse" : "Expand"}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onClose}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close (Esc)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b">
              <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-violet-600"
                  onClick={() => onAnalyze?.(contract.id)}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  AI Analyze
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start px-4 py-2 bg-transparent border-b rounded-none h-auto gap-1">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-gray-100 rounded-md px-3 py-1.5 text-xs"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="clauses"
                  className="data-[state=active]:bg-gray-100 rounded-md px-3 py-1.5 text-xs"
                >
                  Clauses
                </TabsTrigger>
                <TabsTrigger
                  value="obligations"
                  className="data-[state=active]:bg-gray-100 rounded-md px-3 py-1.5 text-xs"
                >
                  Obligations
                </TabsTrigger>
                <TabsTrigger
                  value="attachments"
                  className="data-[state=active]:bg-gray-100 rounded-md px-3 py-1.5 text-xs"
                >
                  Files
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:bg-gray-100 rounded-md px-3 py-1.5 text-xs"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                <TabsContent value="overview" className="m-0">
                  <OverviewTab contract={contract} />
                </TabsContent>
                <TabsContent value="clauses" className="m-0">
                  <ClausesTab clauses={contract.clauses} />
                </TabsContent>
                <TabsContent value="obligations" className="m-0">
                  <ObligationsTab obligations={contract.obligations} />
                </TabsContent>
                <TabsContent value="attachments" className="m-0">
                  <AttachmentsTab attachments={contract.attachments} />
                </TabsContent>
                <TabsContent value="activity" className="m-0">
                  <ActivityTab activities={contract.activities} />
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Footer Actions */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit?.(contract.id)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExport?.(contract.id)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
                <Button onClick={() => onOpenFull?.(contract.id)}>
                  Open Full View
                  <ExternalLink className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

export default ContractPreviewPanel;

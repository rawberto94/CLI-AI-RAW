"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { fadeIn, expandCollapse } from "@/lib/contracts/animations";
import { cn } from "@/lib/utils";

// Types
export interface ApprovalStatus {
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'none';
  currentStep?: number;
  totalSteps?: number;
  currentApprover?: string;
  dueDate?: Date;
}

export interface Contract {
  id: string;
  filename: string;
  originalName: string;
  status: "uploaded" | "processing" | "completed" | "failed" | "pending" | "PENDING_APPROVAL";
  uploadedAt: Date;
  processedAt?: Date;
  fileSize: number;
  mimeType: string;
  contractType?: string;
  parties?: Array<{ name: string; role: string }>;
  effectiveDate?: Date;
  expirationDate?: Date;
  totalValue?: number;
  currency?: string;
  riskScore?: number;
  complianceScore?: number;
  tags?: string[];
  approvalStatus?: ApprovalStatus;
}

export interface ContractCardProps {
  contract: Contract;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onAction?: (action: string, id: string) => void;
  variant?: "compact" | "detailed";
}

// Status icon mapping
const statusIcons: Record<string, any> = {
  uploaded: Clock,
  processing: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  pending: AlertCircle,
  PENDING_APPROVAL: Send,
};

// Status color mapping
const statusColors: Record<string, string> = {
  uploaded: "text-blue-600 bg-blue-50",
  processing: "text-yellow-600 bg-yellow-50",
  completed: "text-green-600 bg-green-50",
  failed: "text-red-600 bg-red-50",
  pending: "text-gray-600 bg-gray-50",
  PENDING_APPROVAL: "text-amber-600 bg-amber-50",
};

export function ContractCard({
  contract,
  selected = false,
  onSelect,
  onAction,
  variant = "detailed",
}: ContractCardProps) {
  // Framer Motion typing workaround for React 19
  const MotionDiv = motion.div as any;
  const [showActions, setShowActions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const StatusIcon = statusIcons[contract.status];

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.(action, contract.id);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(contract.id);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatCurrency = (value: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return (
    <MotionDiv
      variants={fadeIn}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      onHoverStart={() => setShowActions(true)}
      onHoverEnd={() => setShowActions(false)}
      className={cn(
        "relative bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1",
        "touch-manipulation", // Better touch interactions on mobile
        selected && "ring-2 ring-blue-500 border-blue-500"
      )}
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleSelect}
            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            aria-label={`Select ${contract.originalName}`}
          />
        </div>
      )}

      {/* Quick Actions Menu - Hidden on mobile, shown on hover on desktop */}
      {showActions && onAction && (
        <MotionDiv
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden sm:flex absolute top-4 right-4 z-10 gap-2"
        >
          <button
            onClick={(e) => handleAction("view", e)}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            aria-label="View contract"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={(e) => handleAction("download", e)}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            aria-label="Download contract"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={(e) => handleAction("delete", e)}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-red-50 transition-colors"
            aria-label="Delete contract"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </MotionDiv>
      )}

      {/* Mobile Actions - Always visible on mobile */}
      {onAction && (
        <div className="sm:hidden absolute top-4 right-4 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            aria-label="More actions"
          >
            <MoreVertical className="w-4 h-4 text-gray-600" />
          </button>

          {showActions && (
            <MotionDiv
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]"
            >
              <button
                onClick={(e) => handleAction("view", e)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View
              </button>
              <button
                onClick={(e) => handleAction("download", e)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={(e) => handleAction("delete", e)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </MotionDiv>
          )}
        </div>
      )}

      {/* Card Content */}
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate mb-1">
              {contract.originalName}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500">
              {formatFileSize(contract.fileSize)} •{" "}
              {formatDate(contract.uploadedAt)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium",
              statusColors[contract.status === "PENDING_APPROVAL" ? "pending" : contract.status]
            )}
          >
            <StatusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="capitalize">
              {contract.status === "PENDING_APPROVAL" ? "Pending Approval" : contract.status}
            </span>
          </div>

          {contract.contractType && (
            <span className="px-2.5 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm font-medium">
              {contract.contractType.toUpperCase()}
            </span>
          )}
        </div>

        {/* Approval Progress Indicator */}
        {contract.approvalStatus && contract.approvalStatus.status !== 'none' && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {contract.approvalStatus.status === 'pending' && (
                  <Clock className="w-4 h-4 text-amber-600" />
                )}
                {contract.approvalStatus.status === 'in_progress' && (
                  <Send className="w-4 h-4 text-blue-600" />
                )}
                {contract.approvalStatus.status === 'approved' && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
                {contract.approvalStatus.status === 'rejected' && (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  contract.approvalStatus.status === 'pending' && "text-amber-700",
                  contract.approvalStatus.status === 'in_progress' && "text-blue-700",
                  contract.approvalStatus.status === 'approved' && "text-green-700",
                  contract.approvalStatus.status === 'rejected' && "text-red-700"
                )}>
                  {contract.approvalStatus.status === 'in_progress' ? 'In Progress' : contract.approvalStatus.status}
                </span>
              </div>
              {contract.approvalStatus.currentStep && contract.approvalStatus.totalSteps && (
                <span className="text-xs text-gray-600">
                  Step {contract.approvalStatus.currentStep} of {contract.approvalStatus.totalSteps}
                </span>
              )}
            </div>
            
            {/* Progress Bar */}
            {contract.approvalStatus.currentStep && contract.approvalStatus.totalSteps && (
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    contract.approvalStatus.status === 'approved' && "bg-green-500",
                    contract.approvalStatus.status === 'rejected' && "bg-red-500",
                    (contract.approvalStatus.status === 'pending' || contract.approvalStatus.status === 'in_progress') && "bg-amber-500"
                  )}
                  style={{ 
                    width: `${(contract.approvalStatus.currentStep / contract.approvalStatus.totalSteps) * 100}%` 
                  }}
                />
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs text-gray-600">
              {contract.approvalStatus.currentApprover && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>Awaiting: {contract.approvalStatus.currentApprover}</span>
                </div>
              )}
              {contract.approvalStatus.dueDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Due: {formatDate(contract.approvalStatus.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details (Detailed Variant) */}
        {variant === "detailed" && (
          <div className="space-y-3">
            {/* Parties */}
            {contract.parties && contract.parties.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 min-w-[80px]">
                  Parties:
                </span>
                <span className="text-sm text-gray-900">
                  {contract.parties.map((p) => p.name).join(", ")}
                </span>
              </div>
            )}

            {/* Dates */}
            {(contract.effectiveDate || contract.expirationDate) && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {contract.effectiveDate && formatDate(contract.effectiveDate)}
                  {contract.effectiveDate && contract.expirationDate && " - "}
                  {contract.expirationDate &&
                    formatDate(contract.expirationDate)}
                </span>
              </div>
            )}

            {/* Value */}
            {contract.totalValue && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(contract.totalValue, contract.currency)}
                </span>
              </div>
            )}

            {/* Risk & Compliance Scores */}
            {(contract.riskScore !== undefined ||
              contract.complianceScore !== undefined) && (
              <div className="flex gap-4 pt-2">
                {contract.riskScore !== undefined && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Risk</span>
                      <span className="text-xs font-medium text-gray-900">
                        {contract.riskScore}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          contract.riskScore < 30
                            ? "bg-green-500"
                            : contract.riskScore < 70
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${contract.riskScore}%` }}
                      />
                    </div>
                  </div>
                )}

                {contract.complianceScore !== undefined && (
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Compliance</span>
                      <span className="text-xs font-medium text-gray-900">
                        {contract.complianceScore}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${contract.complianceScore}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {contract.tags && contract.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {contract.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Expandable Additional Details */}
            {contract.processedAt && (
              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span>Additional Details</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <MotionDiv
                      variants={expandCollapse}
                      initial="collapsed"
                      animate="expanded"
                      exit="collapsed"
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Processed:</span>
                          <span className="text-gray-900">
                            {formatDate(contract.processedAt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">File ID:</span>
                          <span className="text-gray-900 font-mono text-xs">
                            {contract.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Format:</span>
                          <span className="text-gray-900">
                            {contract.mimeType}
                          </span>
                        </div>
                      </div>
                    </MotionDiv>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Compact Variant */}
        {variant === "compact" && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{contract.contractType || "Contract"}</span>
            {contract.totalValue && (
              <span className="font-medium">
                {formatCurrency(contract.totalValue, contract.currency)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Processing Indicator */}
      {contract.status === "processing" && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 overflow-hidden">
          <MotionDiv
            className="h-full bg-blue-500"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear",
            }}
          />
        </div>
      )}
    </MotionDiv>
  );
}

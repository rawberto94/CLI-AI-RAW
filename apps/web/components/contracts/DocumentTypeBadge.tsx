"use client";

import { memo } from "react";
import { FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentClassification } from "@/lib/types/contract-metadata-schema";

interface DocumentTypeBadgeProps {
  classification?: DocumentClassification;
  showWarning?: boolean;
}

export const DocumentTypeBadge = memo(function DocumentTypeBadge({ classification, showWarning }: DocumentTypeBadgeProps) {
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

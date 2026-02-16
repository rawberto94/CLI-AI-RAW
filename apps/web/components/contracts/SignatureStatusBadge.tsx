"use client";

import { memo } from "react";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignatureStatus } from "@/lib/types/contract-metadata-schema";

interface SignatureStatusBadgeProps {
  status?: SignatureStatus;
}

export const SignatureStatusBadge = memo(function SignatureStatusBadge({ status }: SignatureStatusBadgeProps) {
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

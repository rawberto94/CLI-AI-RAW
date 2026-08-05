'use client';

/**
 * Inline trust indicator for critical contract fields (TCV, parties, dates, …).
 * Uses shared FieldTrust vocabulary from @repo/utils.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { FieldTrust } from '@repo/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  XCircle,
  Sparkles,
  GitCompare,
} from 'lucide-react';

const TRUST_UI: Record<
  FieldTrust,
  { label: string; className: string; icon: React.ReactNode; description: string }
> = {
  canonical_verified: {
    label: 'Verified',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: <CheckCircle2 className="h-3 w-3" />,
    description: 'Confirmed by a human or audit gate',
  },
  ai_high: {
    label: 'AI high',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: <Sparkles className="h-3 w-3" />,
    description: 'High-confidence AI extraction (≥ 85%)',
  },
  ai_review: {
    label: 'Review',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: <AlertTriangle className="h-3 w-3" />,
    description: 'Medium confidence — verify against the document',
  },
  ai_low: {
    label: 'Low conf.',
    className: 'bg-orange-50 text-orange-900 border-orange-200',
    icon: <HelpCircle className="h-3 w-3" />,
    description: 'Low confidence — do not treat as authoritative',
  },
  conflict: {
    label: 'Conflict',
    className: 'bg-red-50 text-red-800 border-red-200',
    icon: <GitCompare className="h-3 w-3" />,
    description: 'Canonical value disagrees with artifact/derived mirror',
  },
  missing: {
    label: 'Missing',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    icon: <XCircle className="h-3 w-3" />,
    description: 'No value extracted yet',
  },
  pending_agent: {
    label: 'Pending',
    className: 'bg-violet-50 text-violet-800 border-violet-200',
    icon: <Clock className="h-3 w-3" />,
    description: 'Agent proposal awaiting human approval',
  },
};

export interface FieldTrustChipProps {
  trust: FieldTrust;
  confidence?: number | null;
  className?: string;
  /** compact = icon only with tooltip */
  compact?: boolean;
}

export function FieldTrustChip({
  trust,
  confidence,
  className,
  compact = false,
}: FieldTrustChipProps) {
  const ui = TRUST_UI[trust] ?? TRUST_UI.missing;
  const confLabel =
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? ` · ${Math.round(confidence * 100)}%`
      : '';

  const chip = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
        ui.className,
        className,
      )}
      data-trust={trust}
    >
      {ui.icon}
      {!compact && (
        <span>
          {ui.label}
          {confLabel}
        </span>
      )}
    </span>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex align-middle focus:outline-none">
            {chip}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-medium">{ui.label}</p>
          <p className="text-muted-foreground mt-0.5">{ui.description}</p>
          {typeof confidence === 'number' && (
            <p className="mt-1">Confidence: {Math.round(confidence * 100)}%</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FieldTrustChip;

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  RefreshCw,
  Eye,
  X,
  Copy,
  Layers,
  Sparkles,
  ExternalLink,
  Info,
} from 'lucide-react';
import { cn, formatFileSize, formatDuration, humanizeUploadError } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

interface ContractStatusResponse {
  contractId: string;
  status: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName: string;
  fileSize: number;
  mimeType: string;
  currentStep: 'upload' | 'queued' | 'ocr' | 'artifacts' | 'storage' | 'complete';
  currentStepName: string;
  progress: number;
  stageProgress: number;
  timing: {
    elapsedMs: number;
    elapsedFormatted: string;
    estimatedRemainingMs: number;
    estimatedRemainingFormatted: string;
    processingDurationMs: number;
    processingDurationFormatted: string;
  };
  artifactsGenerated: number;
  totalArtifacts: number;
  artifactTypes: string[];
  hasOverview: boolean;
  hasFinancial: boolean;
  hasRisk: boolean;
  hasCompliance: boolean;
  hasClauses: boolean;
  processingJob: {
    id: string;
    status: string;
    queueId: string | null;
    priority: number;
    retryCount: number;
    maxRetries: number;
    error: string | null;
  } | null;
  error: string | null;
}

export interface UploadCompletionSummary {
  artifactsGenerated: number;
  totalArtifacts: number;
  missingArtifactLabels: string[];
}

export interface UploadProgressProps {
  fileId: string;
  fileName: string;
  fileSize: number;
  contractId?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  /** Real byte-level upload percentage (0-100) from the XHR progress event. */
  uploadProgress?: number | null;
  isDuplicate?: boolean;
  existingContractId?: string;
  versionNumber?: number;
  onRetry?: () => void;
  onRemove?: () => void;
  onViewContract?: (contractId: string) => void;
  onContractNotFound?: () => void;  // Called when contract returns 404
  onComplete?: (contractId: string, summary: UploadCompletionSummary) => void;  // Called when processing completes
  onFailed?: (error: string) => void;  // Called when the status API reports FAILED
  tenantId?: string;
  autoNavigate?: boolean;  // Auto-navigate to contract on completion
  /** @deprecated Kept for API compatibility — the row renders the same in both modes. */
  minimal?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Artifact types the pipeline generates by default
 * (mirrors DEFAULT_ARTIFACT_TYPES in packages/data-orchestration).
 * Ids are lowercase because the status API lowercases artifactTypes.
 */
const EXPECTED_ARTIFACTS: Array<{ id: string; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'clauses', label: 'Key Clauses' },
  { id: 'financial', label: 'Financial Analysis' },
  { id: 'risk', label: 'Risk Assessment' },
  { id: 'compliance', label: 'Compliance Check' },
  { id: 'obligations', label: 'Obligations' },
  { id: 'renewal', label: 'Renewal Terms' },
  { id: 'negotiation_points', label: 'Negotiation Points' },
  { id: 'amendments', label: 'Amendments' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'rates', label: 'Rate Cards' },
];

const MAX_PROCESSING_MS = 300_000; // 5 minutes — after this we show a "still working" note

/**
 * Adaptive polling interval based on processing stage.
 * - Active processing (ocr/artifacts): fast polling for responsive UX
 * - Queued/upload: slower polling since nothing is changing yet
 * - Storage/indexing: medium polling (fast stage)
 */
function getPollInterval(apiStep?: string, statusStr?: string): number {
  if (statusStr === 'QUEUED' || statusStr === 'UPLOADED') return 4000;  // Waiting in queue — slow poll
  switch (apiStep) {
    case 'upload':
    case 'queued':
      return 3000;   // Waiting stages
    case 'ocr':
    case 'artifacts':
      return 1500;   // Active processing — fast poll
    case 'storage':
    case 'complete':
      return 2000;   // Wrapping up
    default:
      return 2000;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getFileExtensionLabel(fileName: string): string {
  const extension = fileName.split('.').pop()?.trim();
  if (!extension) return 'FILE';
  return extension.length > 4 ? extension.slice(0, 4).toUpperCase() : extension.toUpperCase();
}

function getProcessingMessage(apiStatus: ContractStatusResponse | null, hasContract: boolean): string {
  if (!hasContract) return 'Uploading securely…';
  if (!apiStatus) return 'Preparing analysis…';
  if (apiStatus.status === 'QUEUED') {
    return 'Queued for analysis — we will start as soon as a worker is free.';
  }
  switch (apiStatus.currentStep) {
    case 'queued':
      return 'Queued for analysis…';
    case 'ocr':
      return 'Reading document text…';
    case 'artifacts':
      return apiStatus.totalArtifacts > 0
        ? `Generating AI analysis — ${apiStatus.artifactsGenerated} of ${apiStatus.totalArtifacts} insights ready`
        : 'Generating AI analysis…';
    case 'storage':
      return 'Saving results and search index…';
    case 'complete':
      return 'Finishing up…';
    default:
      return 'Processing document…';
  }
}

function getMissingArtifactLabels(apiStatus: ContractStatusResponse | null): string[] {
  if (!apiStatus) return [];
  const generated = new Set((apiStatus.artifactTypes ?? []).map(t => t.toLowerCase()));
  return EXPECTED_ARTIFACTS.filter(a => !generated.has(a.id)).map(a => a.label);
}

// ============================================================================
// Main Component
// ============================================================================

export function EnhancedUploadProgress({
  fileId: _fileId,
  fileName,
  fileSize,
  contractId,
  status,
  error,
  uploadProgress,
  isDuplicate,
  existingContractId,
  versionNumber,
  onRetry,
  onRemove,
  onViewContract: _onViewContract,
  onContractNotFound,
  onComplete,
  onFailed,
  tenantId = 'demo',
  autoNavigate = false,
}: UploadProgressProps) {
  const router = useRouter();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [apiStatus, setApiStatus] = useState<ContractStatusResponse | null>(null);
  const [isLongRunning, setIsLongRunning] = useState(false);
  const [longRunningDismissed, setLongRunningDismissed] = useState(false);

  const [isCompleted, setIsCompleted] = useState(false);
  const hasCompletedRef = useRef(false);
  const hasFailedRef = useRef(false);

  const isDone = status === 'completed' || isCompleted;
  const isFailed = status === 'error';

  // Update elapsed time — stop counting once settled
  useEffect(() => {
    if ((status === 'uploading' || status === 'processing') && !isCompleted) {
      const interval = setInterval(() => setElapsedTime(Date.now() - startTime), 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime, isCompleted]);

  // Handle completion with optional auto-navigation
  const handleCompletion = useCallback((finalContractId: string, data: ContractStatusResponse) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    setIsCompleted(true);
    if (onComplete) {
      onComplete(finalContractId, {
        artifactsGenerated: data.artifactsGenerated,
        totalArtifacts: data.totalArtifacts,
        missingArtifactLabels: getMissingArtifactLabels(data),
      });
    }

    if (autoNavigate) {
      setTimeout(() => router.push(`/contracts/${finalContractId}`), 1500);
    }
  }, [autoNavigate, onComplete, router]);

  // Handle authoritative FAILED status from the status API
  const handleFailure = useCallback((rawError: string | null) => {
    if (hasFailedRef.current || hasCompletedRef.current) return;
    hasFailedRef.current = true;
    if (onFailed) onFailed(rawError || 'Processing failed');
  }, [onFailed]);

  // Poll contract status with adaptive interval
  useEffect(() => {
    if (!contractId || (status !== 'processing' && status !== 'uploading')) return;

    let notFoundCount = 0;
    let pollCount = 0;
    let consecutiveErrors = 0;
    const MAX_NOT_FOUND = 5;
    const INITIAL_GRACE_POLLS = 5; // Grace period for DB commit delay
    let timeoutId: NodeJS.Timeout | null = null;
    const pollStartTime = Date.now();

    const schedulePoll = (intervalMs: number) => {
      timeoutId = setTimeout(poll, intervalMs);
    };

    const poll = async () => {
      pollCount++;

      // ── Long-running threshold ──
      // Keep waiting for the authoritative terminal status (completing here
      // could surface metadata review before artifact mirroring finishes), but
      // tell the user what is going on instead of polling silently forever.
      if (Date.now() - pollStartTime > MAX_PROCESSING_MS) {
        setIsLongRunning(true);
        schedulePoll(15_000);
        return;
      }

      try {
        const res = await fetch(`/api/contracts/${contractId}/status`, {
          headers: { 'x-tenant-id': tenantId },
        });

        // Handle 404 - contract doesn't exist anymore
        if (res.status === 404) {
          // During initial grace period, don't count 404s (database may not have committed yet)
          if (pollCount <= INITIAL_GRACE_POLLS) {
            schedulePoll(2000);
            return;
          }
          notFoundCount++;
          if (notFoundCount >= MAX_NOT_FOUND) {
            // Exhausted retries — notify parent
            if (onContractNotFound) onContractNotFound();
            return; // Stop polling
          }
          schedulePoll(3000);
          return;
        }

        if (!res.ok) {
          schedulePoll(3000);
          return;
        }

        // Reset counters on success
        notFoundCount = 0;
        consecutiveErrors = 0;

        // API wraps response in { success, data } envelope
        const json = await res.json();
        const data: ContractStatusResponse = json.data ?? json;
        // Normalize status to uppercase (API may return lowercase)
        if (data.status) data.status = data.status.toUpperCase() as ContractStatusResponse['status'];
        // Defensive: never trust the envelope shape — a missing array would
        // crash the render via getMissingArtifactLabels().
        if (!Array.isArray(data.artifactTypes)) data.artifactTypes = [];
        setApiStatus(data);

        if (data.status === 'COMPLETED') {
          handleCompletion(contractId, data);
          return; // Stop polling
        } else if (data.status === 'FAILED') {
          handleFailure(data.processingJob?.error || data.error || null);
          return; // Stop polling
        }

        // Schedule next poll with adaptive interval
        const nextInterval = getPollInterval(data.currentStep, data.status);
        schedulePoll(nextInterval);
      } catch {
        // On error, retry with exponential backoff (3s, 6s, 12s, capped at 15s)
        consecutiveErrors++;
        const backoff = Math.min(15_000, 3000 * Math.pow(2, consecutiveErrors - 1));
        schedulePoll(backoff);
      }
    };

    // Add small delay before first poll to allow database transaction to commit
    const initialDelay = setTimeout(() => {
      poll();
    }, 1000); // Wait 1 second before first poll

    return () => {
      clearTimeout(initialDelay);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [contractId, status, tenantId, onContractNotFound, handleCompletion, handleFailure]);

  // ── Derived display state ─────────────────────────────────────────────
  const displayTime = elapsedTime;
  const artifactCount = apiStatus?.artifactsGenerated ?? 0;
  const totalArtifacts = apiStatus?.totalArtifacts ?? 0;
  const estimatedRemaining = apiStatus?.timing?.estimatedRemainingMs;
  const missingArtifactLabels = isDone ? getMissingArtifactLabels(apiStatus) : [];
  // Partial completion: fewer insights than the pipeline was expected to generate
  const isPartial = isDone && totalArtifacts > 0 && artifactCount < totalArtifacts;
  const processingMessage = getProcessingMessage(apiStatus, !!contractId);
  const fileExtensionLabel = getFileExtensionLabel(fileName);

  // Real progress only — never simulated. Until the API reports a number we
  // show the stage label without a bar; a fake percentage is worse than none.
  const realProgress: number | null = (() => {
    if (isDone) return 100;
    if (isFailed || status === 'pending') return null;
    if (status === 'uploading' && !contractId) {
      return typeof uploadProgress === 'number' ? uploadProgress : null;
    }
    return typeof apiStatus?.progress === 'number' ? apiStatus.progress : null;
  })();

  const statusBadge = (() => {
    if (isFailed) {
      return {
        label: 'Needs attention',
        icon: <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />,
        className: 'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200',
      };
    }
    if (isDone && isPartial) {
      return {
        label: 'Completed with warnings',
        icon: <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />,
        className: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      };
    }
    if (isDone) {
      return {
        label: 'Analysis ready',
        icon: <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />,
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      };
    }
    if (status === 'pending') {
      return {
        label: 'Queued',
        icon: <Clock className="mr-1 h-3 w-3" aria-hidden="true" />,
        className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    }
    if (apiStatus?.status === 'QUEUED') {
      return {
        label: 'Awaiting worker',
        icon: <Clock className="mr-1 h-3 w-3" aria-hidden="true" />,
        className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      };
    }
    return {
      label: apiStatus?.currentStepName || 'Processing',
      icon: <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />,
      className: 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    };
  })();

  const progressVariant = isFailed
    ? 'error'
    : isDone
      ? (isPartial ? 'warning' : 'success')
      : 'default';

  const humanizedError = isFailed ? humanizeUploadError(error) : null;

  // Handle duplicate
  if (isDuplicate && existingContractId) {
    if (versionNumber) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/60">
            <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-emerald-950 dark:text-emerald-100 truncate">{fileName}</p>
              <Badge className="border-emerald-200 bg-white/80 text-emerald-700 hover:bg-white/80 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">{fileExtensionLabel}</Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">v{versionNumber}</Badge>
            </div>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Duplicate detected and registered as version {versionNumber}.
            </p>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              The existing contract version history was updated.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-emerald-300 dark:border-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-800"
              onClick={() => router.push(`/contracts/${existingContractId}`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              View Contract
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove} aria-label="Remove file">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/60">
          <Copy className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-amber-950 dark:text-amber-100 truncate">{fileName}</p>
            <Badge className="border-amber-200 bg-white/80 text-amber-700 hover:bg-white/80 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{fileExtensionLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Duplicate detected — no new copy was created.
          </p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
            Open the existing contract or re-process to create a fresh analysis run.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800"
            onClick={() => router.push(`/contracts/${existingContractId}`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            View Original
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Re-process Anyway
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove} aria-label="Remove file">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-colors sm:p-5 dark:bg-slate-900',
        isFailed && 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20',
        isDone && isPartial && 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20',
        isDone && !isPartial && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20',
        !isFailed && !isDone && 'border-slate-200 dark:border-slate-700'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Status icon — spinner conveys activity; no idle pulsing */}
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
          isDone && !isPartial && 'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30',
          isDone && isPartial && 'border-amber-200 bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30',
          isFailed && 'border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-900/30',
          !isDone && !isFailed && (status === 'processing' || status === 'uploading') && 'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-900/30',
          !isDone && !isFailed && status === 'pending' && 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'
        )}>
          {isDone && !isPartial ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : isDone && isPartial ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          ) : isFailed ? (
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
          ) : status === 'processing' || status === 'uploading' ? (
            <Loader2 className="h-4 w-4 text-violet-600 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{fileName}</p>
            <Badge className="border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{fileExtensionLabel}</Badge>
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{formatFileSize(fileSize)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={cn('border font-medium hover:bg-transparent', statusBadge.className)}>
              {statusBadge.icon}
              {statusBadge.label}
            </Badge>
            {artifactCount > 0 && !isFailed && (
              <Badge className="border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                {isDone && totalArtifacts > 0
                  ? `${artifactCount} of ${totalArtifacts} insights`
                  : `${artifactCount} insight${artifactCount === 1 ? '' : 's'}`}
              </Badge>
            )}
          </div>

          {/* Status Line — announced politely on change */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
            {status === 'pending' && !isDone && (
              <span className="text-sm text-slate-500 dark:text-slate-400">Waiting to upload…</span>
            )}
            {(status === 'uploading' || status === 'processing') && !isDone && (
              <>
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  {status === 'uploading' && !contractId && typeof uploadProgress === 'number'
                    ? `Uploading… ${uploadProgress}%`
                    : processingMessage}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatDuration(displayTime)}
                </span>
                {estimatedRemaining && estimatedRemaining > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    ~{formatDuration(estimatedRemaining)} left
                  </span>
                )}
              </>
            )}
            {isDone && isPartial && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                Completed with warnings — {artifactCount} of {totalArtifacts} insights ready
                {missingArtifactLabels.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                          aria-label={`Missing insights: ${missingArtifactLabels.join(', ')}`}
                        >
                          <Info className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium">Not generated:</p>
                        <p>{missingArtifactLabels.join(', ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            )}
            {isDone && !isPartial && (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Contract analysis complete
              </span>
            )}
            {isFailed && humanizedError && (
              <span className="text-sm">
                <span className="font-medium text-red-600 dark:text-red-300">
                  {humanizedError.message}
                </span>
                {humanizedError.detail && humanizedError.detail !== humanizedError.message && (
                  <details className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300">
                      Details
                    </summary>
                    <p className="mt-1 break-words font-mono">{humanizedError.detail}</p>
                  </details>
                )}
              </span>
            )}
          </div>

          {/* Long-running note — replaces silent forever-polling */}
          {isLongRunning && !longRunningDismissed && !isDone && !isFailed && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Taking longer than usual — still working ({formatDuration(displayTime)} elapsed). You can keep waiting or check the contract page.
              </span>
              <span className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="font-medium underline-offset-2 hover:underline"
                  onClick={() => setLongRunningDismissed(true)}
                >
                  Keep waiting
                </button>
                {contractId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
                    onClick={() => router.push(`/contracts/${contractId}`)}
                  >
                    View contract
                  </Button>
                )}
              </span>
            </div>
          )}

          {/* Real progress bar — only when we have an authoritative number */}
          {realProgress !== null && !isDone && !isFailed && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {status === 'uploading' && !contractId ? 'Upload progress' : 'Pipeline progress'}
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(realProgress)}%
                </span>
              </div>
              <Progress
                value={realProgress}
                variant={progressVariant}
                className="h-2.5"
                aria-label={`${fileName} ${status === 'uploading' && !contractId ? 'upload' : 'processing'} progress`}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-start gap-1.5">
          {isDone && contractId && (
            <Button
              size="sm"
              className="h-9 px-3 text-xs font-medium"
              onClick={() => router.push(`/contracts/${contractId}`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              View Contract
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" aria-hidden="true" />
            </Button>
          )}

          {isFailed && (
            <Button size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Retry
            </Button>
          )}

          {(status === 'pending' || isFailed || isDone) && (
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onRemove} aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EnhancedUploadProgress;

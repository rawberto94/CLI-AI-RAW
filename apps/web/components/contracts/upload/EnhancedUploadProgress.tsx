'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  RefreshCw,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers,
  Check,
  Sparkles,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

export interface ProcessingStage {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

export interface UploadProgressProps {
  fileId: string;
  fileName: string;
  fileSize: number;
  contractId?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  isDuplicate?: boolean;
  existingContractId?: string;
  onRetry?: () => void;
  onRemove?: () => void;
  onViewContract?: (contractId: string) => void;
  onContractNotFound?: () => void;  // Called when contract returns 404
  onComplete?: (contractId: string) => void;  // Called when processing completes
  tenantId?: string;
  autoNavigate?: boolean;  // Auto-navigate to contract on completion
}

// ============================================================================
// Constants
// ============================================================================

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

const API_STEP_TO_STAGE: Record<string, string> = {
  'upload': 'upload',
  'queued': 'upload',   // Queued stays in upload stage (waiting for worker pickup)
  'ocr': 'extract',
  'artifacts': 'analyze',
  'storage': 'index',
  'complete': 'index',
};

const STAGES = [
  { id: 'upload', name: 'Upload', shortName: 'Upload', icon: <Upload className="h-3.5 w-3.5" /> },
  { id: 'extract', name: 'Text Extraction', shortName: 'Extract', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'analyze', name: 'AI Analysis', shortName: 'Analyze', icon: <Brain className="h-3.5 w-3.5" /> },
  { id: 'index', name: 'Indexing', shortName: 'Index', icon: <Layers className="h-3.5 w-3.5" /> },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getFileExtensionLabel(fileName: string): string {
  const extension = fileName.split('.').pop()?.trim();
  if (!extension) return 'FILE';
  return extension.length > 4 ? extension.slice(0, 4).toUpperCase() : extension.toUpperCase();
}

function getProcessingMessage(stage: string, artifactCount: number, apiStatus?: ContractStatusResponse | null): string {
  // Show queue-specific message when status is QUEUED
  if (apiStatus?.status === 'QUEUED') {
    return 'Waiting in queue...';
  }
  switch (stage) {
    case 'upload': return 'Preparing document...';
    case 'extract': return 'Extracting text from document...';
    case 'analyze': return artifactCount > 0 
      ? `Analyzing with AI (${artifactCount} insights)...`
      : 'Analyzing with AI...';
    case 'index': return 'Saving and indexing...';
    default: return 'Processing...';
  }
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
  isDuplicate,
  existingContractId,
  onRetry,
  onRemove,
  onViewContract: _onViewContract,
  onContractNotFound,
  onComplete,
  tenantId = 'demo',
  autoNavigate = false,
}: UploadProgressProps) {
  const router = useRouter();
  const [stages, setStages] = useState<ProcessingStage[]>(() => 
    STAGES.map(s => ({ ...s, status: 'pending' as const }))
  );
  const [expanded, setExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [apiStatus, setApiStatus] = useState<ContractStatusResponse | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);  // Track internal completion state
  const hasCompletedRef = useRef(false);

  // Update elapsed time — stop counting once completed
  useEffect(() => {
    if ((status === 'uploading' || status === 'processing') && !isCompleted) {
      const interval = setInterval(() => setElapsedTime(Date.now() - startTime), 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime, isCompleted]);

  // Auto-expand on error
  useEffect(() => {
    if (status === 'error') {
      setExpanded(true);
    }
  }, [status]);

  // Handle completion with animation and optional auto-navigation
  const handleCompletion = useCallback((finalContractId: string) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    setShowSuccess(true);
    setIsCompleted(true);
    // All stages complete
    setStages(STAGES.map(s => ({ ...s, status: 'completed' as const })));
    if (onComplete) onComplete(finalContractId);
    
    // Auto-dismiss success overlay after 3 seconds
    setTimeout(() => setShowSuccess(false), 3000);
    
    if (autoNavigate) {
      setTimeout(() => router.push(`/contracts/${finalContractId}`), 1500);
    }
  }, [autoNavigate, onComplete, router]);

  // Poll contract status with adaptive interval
  useEffect(() => {
    if (!contractId || (status !== 'processing' && status !== 'uploading')) return;

    let notFoundCount = 0;
    let pollCount = 0;
    let consecutiveErrors = 0;
    const MAX_NOT_FOUND = 5;
    const INITIAL_GRACE_POLLS = 5; // Increased grace period for DB commit delay
    const MAX_PROCESSING_MS = 300_000; // 5 minutes — large contracts with many artifacts can take a while
    let timeoutId: NodeJS.Timeout | null = null;
    const pollStartTime = Date.now();

    const schedulePoll = (intervalMs: number) => {
      timeoutId = setTimeout(poll, intervalMs);
    };

    const poll = async () => {
      pollCount++;

      // ── Processing timeout ──
      // If we've been polling for too long without a terminal status,
      // mark as completed so the user can view the contract.
      // The contract page will reflect the actual processing state.
      if (Date.now() - pollStartTime > MAX_PROCESSING_MS) {
        handleCompletion(contractId);
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
        setApiStatus(data);

        // Update stages
        const currentApiStep = data.currentStep;
        const currentStageId = API_STEP_TO_STAGE[currentApiStep] || 'upload';
        let stageIndex = STAGES.findIndex(s => s.id === currentStageId);
        // If API says 'upload'/'queued' but we have a contractId, upload is done — show extract
        if (stageIndex === 0 && contractId) stageIndex = 1;

        setStages(STAGES.map((s, i) => ({
          ...s,
          status: i < stageIndex ? 'completed' as const :
                  i === stageIndex ? (data.status === 'FAILED' ? 'error' as const : 'in-progress' as const) :
                  'pending' as const
        })));

        if (data.status === 'COMPLETED') {
          handleCompletion(contractId);
          return; // Stop polling
        } else if (data.status === 'FAILED') {
          setExpanded(true);
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
  }, [contractId, status, tenantId, onContractNotFound, handleCompletion]);

  // Update stages for completed/error status
  useEffect(() => {
    if (status === 'completed') {
      setStages(STAGES.map(s => ({ ...s, status: 'completed' as const })));
    } else if (status === 'error') {
      setStages(prev => {
        const inProgress = prev.findIndex(s => s.status === 'in-progress');
        return prev.map((s, i) => ({
          ...s,
          status: i === inProgress || (inProgress === -1 && i === 0) ? 'error' as const : s.status
        }));
      });
    } else if (status === 'uploading' && !contractId) {
      setStages(STAGES.map((s, i) => ({
        ...s,
        status: i === 0 ? 'in-progress' as const : 'pending' as const
      })));
    } else if (contractId && (status === 'uploading' || status === 'processing')) {
      // Upload succeeded (contractId assigned) — mark upload completed, show extract starting
      setStages(prev => {
        // Only advance if polling hasn't already moved us beyond upload
        const hasAdvanced = prev.findIndex(s => s.status === 'completed') > 0;
        if (hasAdvanced) return prev;
        return STAGES.map((s, i) => ({
          ...s,
          status: i === 0 ? 'completed' as const : i === 1 ? 'in-progress' as const : 'pending' as const
        }));
      });
    }
  }, [status, contractId]);

  // Simulated progress when API hasn't responded yet
  const simulatedProgress = (() => {
    if (isCompleted || status === 'completed') return 100;
    if (status === 'error') return 0;
    if (status === 'pending') return 0;
    // Simulate progress over time: 15% → 95% over 300s (matches MAX_PROCESSING_MS)
    const elapsed = elapsedTime / 1000;
    if (elapsed < 2) return 15;
    if (elapsed < 15) return 15 + (elapsed / 15) * 25;           // 15% → 40%
    if (elapsed < 60) return 40 + ((elapsed - 15) / 45) * 20;    // 40% → 60%
    if (elapsed < 120) return 60 + ((elapsed - 60) / 60) * 15;   // 60% → 75%
    if (elapsed < 200) return 75 + ((elapsed - 120) / 80) * 10;  // 75% → 85%
    if (elapsed < 300) return 85 + ((elapsed - 200) / 100) * 10; // 85% → 95%
    return 95 + Math.min(3, (elapsed - 300) / 120);              // Slowly creep to 98%
  })();
  const progress = apiStatus?.progress ?? simulatedProgress;
  const displayTime = apiStatus?.timing?.elapsedMs ?? elapsedTime;
  const artifactCount = apiStatus?.artifactsGenerated ?? 0;
  const estimatedRemaining = apiStatus?.timing?.estimatedRemainingMs;
  const currentStage = stages.find(s => s.status === 'in-progress');
  const activeStageId = currentStage?.id || (contractId ? 'extract' : 'upload');
  const processingMessage = getProcessingMessage(activeStageId, artifactCount, apiStatus);
  const fileExtensionLabel = getFileExtensionLabel(fileName);
  const statusBadge = (() => {
    if (status === 'error' && !isCompleted) {
      return { label: 'Needs attention', className: 'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200' };
    }
    if (status === 'completed' || isCompleted) {
      return { label: 'Ready', className: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' };
    }
    if (status === 'pending') {
      return { label: 'Queued', className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
    if (apiStatus?.status === 'QUEUED') {
      return { label: 'Awaiting worker', className: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
    }
    return { label: apiStatus?.currentStepName || currentStage?.name || 'Processing', className: 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200' };
  })();
  const progressVariant = status === 'error'
    ? 'error'
    : (status === 'completed' || isCompleted)
      ? 'success'
      : 'default';

  // Handle duplicate
  if (isDuplicate && existingContractId) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-4 shadow-[0_18px_40px_-28px_rgba(217,119,6,0.45)] dark:border-amber-700 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.35),rgba(30,41,59,0.95))]">
        <div className="rounded-2xl bg-amber-100 p-3 dark:bg-amber-900/60">
          <Copy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-amber-950 dark:text-amber-100 truncate">{fileName}</p>
            <Badge className="border-amber-200 bg-white/80 text-amber-700 hover:bg-white/80 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{fileExtensionLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Already uploaded recently
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800"
            onClick={() => router.push(`/contracts/${existingContractId}`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            View Original
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Re-process Anyway
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove} aria-label="Remove file">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Get current stage info - already declared above
  const completedStages = stages.filter(s => s.status === 'completed').length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.38)] backdrop-blur transition-all dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.9))]',
        status === 'error' && 'border-red-200/80 bg-[linear-gradient(180deg,rgba(254,242,242,0.96),rgba(255,255,255,0.98))] dark:border-red-700 dark:bg-[linear-gradient(180deg,rgba(127,29,29,0.4),rgba(15,23,42,0.92))]',
        (status === 'completed' || isCompleted) && 'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] dark:border-emerald-700 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.35),rgba(15,23,42,0.92))]',
        showSuccess && 'ring-2 ring-green-400 ring-offset-2'
      )}
    >
      {/* Main Row */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
        {/* Icon with pulse animation */}
        <div className={cn(
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm',
          (status === 'completed' || isCompleted) ? 'border-emerald-200 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30' :
          status === 'error' ? 'border-red-200 bg-red-100 dark:border-red-800 dark:bg-red-900/30' :
          status === 'processing' || status === 'uploading' ? 'border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-900/30' :
          'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800'
        )}>
          {(status === 'processing' || status === 'uploading') && !isCompleted && (
            <motion.div
              className="absolute inset-0 rounded-2xl bg-violet-400"
              animate={{ opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {(status === 'completed' || isCompleted) ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </motion.div>
          ) : status === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : status === 'processing' || status === 'uploading' ? (
            <Loader2 className="h-4 w-4 text-violet-600 animate-spin relative z-10" />
          ) : (
            <FileText className="h-4 w-4 text-gray-500" />
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
            <Badge className={cn('border font-medium hover:bg-transparent', statusBadge.className)}>{statusBadge.label}</Badge>
            {artifactCount > 0 && (
              <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                <Sparkles className="mr-1 h-3 w-3" />
                {artifactCount} insight{artifactCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
          
          {/* Status Line */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            {status === 'pending' && !isCompleted && (
              <span className="text-sm text-slate-500 dark:text-slate-400">Waiting to upload...</span>
            )}
            {(status === 'uploading' || status === 'processing') && !isCompleted && (
              <>
                <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  {processingMessage}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Clock className="h-3 w-3" />
                  {formatDuration(displayTime)}
                </span>
                {estimatedRemaining && estimatedRemaining > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    ~{formatDuration(estimatedRemaining)} left
                  </span>
                )}
              </>
            )}
            {(status === 'completed' || isCompleted) && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Zap className="h-3 w-3" />
                Contract analysis complete
              </motion.span>
            )}
            {status === 'error' && !isCompleted && (
              <span className="text-sm font-medium text-red-600 dark:text-red-300">
                {error || 'Processing failed'}
              </span>
            )}
          </div>

          {(status === 'uploading' || status === 'processing') && !isCompleted && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Pipeline progress
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} variant={progressVariant} className="h-2.5 bg-slate-100/90 dark:bg-slate-800" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-start gap-1.5">
          {(status === 'completed' || isCompleted) && contractId && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
              <Button 
                size="sm" 
                className="h-9 rounded-full bg-emerald-600 px-3 text-xs font-medium hover:bg-emerald-700"
                onClick={() => router.push(`/contracts/${contractId}`)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                View Contract
                <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
              </Button>
            </motion.div>
          )}
          
          {status === 'error' && (
            <Button size="sm" variant="outline" className="h-9 rounded-full border-red-200 px-3 text-xs hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 w-9 rounded-full border border-slate-200/70 bg-white/70 p-0 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}

          {(status === 'pending' || status === 'error' || status === 'completed' || isCompleted) && (
            <Button size="sm" variant="ghost" className="h-9 w-9 rounded-full p-0 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={onRemove} aria-label="Remove file">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Progress Bar */}
      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (status === 'uploading' || status === 'processing' || status === 'error') && (
          <motion.div key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-200/80 dark:border-slate-700"
          >
            <div className={cn("p-4", status === 'error' ? 'bg-red-50/70 dark:bg-red-900/20' : 'bg-slate-50/80 dark:bg-slate-900/40')}>
              {/* Error Details */}
              {status === 'error' && error && (
                <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Please try again or contact support if the issue persists.</p>
                </div>
              )}

              {/* Stage Progress */}
              <div className="flex items-center justify-between max-w-sm mx-auto" role="progressbar" aria-label="Processing stages">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-center">
                    {/* Stage Circle */}
                    <div className="flex flex-col items-center">
                      <motion.div 
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all',
                          stage.status === 'completed' && 'bg-green-500 border-green-500 text-white',
                          stage.status === 'in-progress' && 'bg-violet-500 border-violet-500 text-white',
                          stage.status === 'error' && 'bg-red-500 border-red-500 text-white',
                          stage.status === 'pending' && 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400'
                        )}
                        animate={stage.status === 'in-progress' ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {stage.status === 'completed' ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                            <Check className="h-4 w-4" />
                          </motion.div>
                        ) : stage.status === 'in-progress' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : stage.status === 'error' ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">{i + 1}</span>
                        )}
                      </motion.div>
                      <span className={cn(
                        'text-[10px] mt-1.5 font-medium',
                        stage.status === 'completed' && 'text-green-600',
                        stage.status === 'in-progress' && 'text-violet-600',
                        stage.status === 'error' && 'text-red-600',
                        stage.status === 'pending' && 'text-gray-400 dark:text-slate-500'
                      )}>
                        {stage.shortName}
                      </span>
                    </div>
                    
                    {/* Connector Line */}
                    {i < stages.length - 1 && (
                      <div className={cn(
                        'w-10 h-0.5 mx-2 -mt-4 transition-colors',
                        stage.status === 'completed' ? 'bg-green-400' :
                        stage.status === 'in-progress' ? 'bg-violet-200 dark:bg-violet-700' :
                        'bg-gray-200 dark:bg-slate-600'
                      )} />
                    )}
                  </div>
                ))}
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDuration(displayTime)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{completedStages}/{stages.length} stages</span>
                </div>
                {artifactCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5" />
                    <span>{artifactCount} insights</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-50/90 dark:bg-green-900/80 flex items-center justify-center pointer-events-none rounded-lg"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EnhancedUploadProgress;

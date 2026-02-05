'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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

const API_STEP_TO_STAGE: Record<string, string> = {
  'upload': 'upload',
  'queued': 'extract',
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

function getProcessingMessage(stage: string, artifactCount: number): string {
  switch (stage) {
    case 'upload': return 'Uploading file...';
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
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  // Update elapsed time
  useEffect(() => {
    if (status === 'uploading' || status === 'processing') {
      const interval = setInterval(() => setElapsedTime(Date.now() - startTime), 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

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
    if (onComplete) onComplete(finalContractId);
    
    if (autoNavigate) {
      setTimeout(() => router.push(`/contracts/${finalContractId}`), 1500);
    }
  }, [autoNavigate, onComplete, router]);

  // Poll contract status
  useEffect(() => {
    if (!contractId || (status !== 'processing' && status !== 'uploading')) return;

    let notFoundCount = 0;
    let pollCount = 0;
    const MAX_NOT_FOUND = 5;
    const INITIAL_GRACE_POLLS = 3;

    const poll = async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/contracts/${contractId}/status`, {
          headers: { 'x-tenant-id': tenantId },
        });
        
        // Handle 404 - contract doesn't exist anymore
        if (res.status === 404) {
          // During initial grace period, don't count 404s (database may not have committed yet)
          if (pollCount <= INITIAL_GRACE_POLLS) {
            return;
          }
          notFoundCount++;
          if (notFoundCount >= MAX_NOT_FOUND && onContractNotFound) {
            if (pollRef.current) clearInterval(pollRef.current);
            // Also remove from valid contracts
            sessionStorage.removeItem(`valid-contract-${contractId}`);
            onContractNotFound();
          }
          return;
        }
        
        if (!res.ok) return;
        
        // Reset not found counter on success
        notFoundCount = 0;
        
        const data: ContractStatusResponse = await res.json();
        setApiStatus(data);

        // Update stages
        const currentApiStep = data.currentStep;
        const currentStageId = API_STEP_TO_STAGE[currentApiStep] || 'upload';
        const stageIndex = STAGES.findIndex(s => s.id === currentStageId);

        setStages(STAGES.map((s, i) => ({
          ...s,
          status: i < stageIndex ? 'completed' as const :
                  i === stageIndex ? (data.status === 'FAILED' ? 'error' as const : 'in-progress' as const) :
                  'pending' as const
        })));

        if (data.status === 'COMPLETED') {
          if (pollRef.current) clearInterval(pollRef.current);
          handleCompletion(contractId);
        } else if (data.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setExpanded(true);
        }
      } catch {
        // Ignore errors
      }
    };

    // Add small delay before first poll to allow database transaction to commit
    const initialDelay = setTimeout(() => {
      poll();
      pollRef.current = setInterval(poll, 1500);  // Faster polling for better UX
    }, 500);
    
    return () => { 
      clearTimeout(initialDelay);
      if (pollRef.current) clearInterval(pollRef.current); 
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
    }
  }, [status, contractId]);

  const progress = apiStatus?.progress ?? (status === 'completed' ? 100 : status === 'uploading' ? 15 : 0);
  const displayTime = apiStatus?.timing?.elapsedMs ?? elapsedTime;
  const artifactCount = apiStatus?.artifactsGenerated ?? 0;
  const estimatedRemaining = apiStatus?.timing?.estimatedRemainingMs;
  const currentStage = stages.find(s => s.status === 'in-progress');
  const processingMessage = getProcessingMessage(currentStage?.id || 'upload', artifactCount);

  // Handle duplicate
  if (isDuplicate && existingContractId) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
        <div className="p-2 rounded-lg bg-amber-100">
          <Copy className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 truncate">{fileName}</p>
          <p className="text-xs text-amber-600">Already uploaded recently</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.push(`/contracts/${existingContractId}`)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            View
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Re-upload
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove}>
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
        'rounded-lg border bg-white overflow-hidden transition-all relative',
        status === 'error' && 'border-red-200 bg-red-50',
        status === 'completed' && 'border-green-200 bg-green-50',
        showSuccess && 'ring-2 ring-green-400 ring-offset-2'
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3">
        {/* Icon with pulse animation */}
        <div className={cn(
          'p-2 rounded-lg shrink-0 relative',
          status === 'completed' ? 'bg-green-100' :
          status === 'error' ? 'bg-red-100' :
          status === 'processing' || status === 'uploading' ? 'bg-violet-100' :
          'bg-gray-100'
        )}>
          {(status === 'processing' || status === 'uploading') && (
            <motion.div
              className="absolute inset-0 rounded-lg bg-violet-400"
              animate={{ opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          {status === 'completed' ? (
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(fileSize)}</span>
          </div>
          
          {/* Status Line */}
          <div className="flex items-center gap-2 mt-0.5">
            {status === 'pending' && (
              <span className="text-xs text-gray-500">Waiting to upload...</span>
            )}
            {(status === 'uploading' || status === 'processing') && (
              <>
                <span className="text-xs text-violet-600 font-medium">
                  {processingMessage}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{formatDuration(displayTime)}</span>
                {estimatedRemaining && estimatedRemaining > 0 && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-400">~{formatDuration(estimatedRemaining)} left</span>
                  </>
                )}
              </>
            )}
            {status === 'completed' && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Complete • {artifactCount} insights extracted
              </motion.span>
            )}
            {status === 'error' && (
              <span className="text-xs text-red-600 font-medium">
                {error || 'Processing failed'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === 'completed' && contractId && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
              <Button 
                size="sm" 
                className="h-8 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => router.push(`/contracts/${contractId}`)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                View Contract
                <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
              </Button>
            </motion.div>
          )}
          
          {status === 'error' && (
            <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 hover:bg-red-50" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry
            </Button>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}

          {(status === 'pending' || status === 'error' || status === 'completed') && (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="px-3 pb-3">
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (status === 'uploading' || status === 'processing' || status === 'error') && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className={cn("p-4", status === 'error' ? 'bg-red-50' : 'bg-gray-50')}>
              {/* Error Details */}
              {status === 'error' && error && (
                <div className="mb-4 p-3 rounded-lg bg-red-100 border border-red-200">
                  <p className="text-sm text-red-800">{error}</p>
                  <p className="text-xs text-red-600 mt-1">Please try again or contact support if the issue persists.</p>
                </div>
              )}

              {/* Stage Progress */}
              <div className="flex items-center justify-between max-w-sm mx-auto">
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
                          stage.status === 'pending' && 'bg-white border-gray-200 text-gray-400'
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
                        stage.status === 'pending' && 'text-gray-400'
                      )}>
                        {stage.shortName}
                      </span>
                    </div>
                    
                    {/* Connector Line */}
                    {i < stages.length - 1 && (
                      <div className={cn(
                        'w-10 h-0.5 mx-2 -mt-4 transition-colors',
                        stage.status === 'completed' ? 'bg-green-400' :
                        stage.status === 'in-progress' ? 'bg-violet-200' :
                        'bg-gray-200'
                      )} />
                    )}
                  </div>
                ))}
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-50/90 flex items-center justify-center pointer-events-none rounded-lg"
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

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { unwrapApiResponseData } from '@/lib/api-fetch';
import { useArtifactStream, type ArtifactUpdate } from '@/hooks/useArtifactStream';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  DollarSign, 
  FileCheck, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  RefreshCw,
  Eye,
  Lock,
  ClipboardList,
  Scale
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealtimeArtifactViewerProps {
  contractId: string;
  tenantId?: string; // Deprecated: server uses session tenant from middleware
  onComplete?: () => void;
  onContractNotFound?: () => void;  // Called when contract returns 404
}

interface ArtifactFailureState {
  partialFailure: boolean;
  failedArtifactTypes: string[];
}

// Helper to normalize artifact types to uppercase
const normalizeType = (type: string): string => type.toUpperCase().replace('KEY_CLAUSES', 'CLAUSES').replace('FINANCIAL_ANALYSIS', 'FINANCIAL').replace('RISK_ASSESSMENT', 'RISK').replace('COMPLIANCE_CHECK', 'COMPLIANCE');

const artifactIcons: Record<string, React.ReactNode> = {
  OVERVIEW: <FileText className="h-5 w-5" />,
  FINANCIAL: <DollarSign className="h-5 w-5" />,
  CLAUSES: <FileCheck className="h-5 w-5" />,
  RISK: <AlertTriangle className="h-5 w-5" />,
  COMPLIANCE: <Shield className="h-5 w-5" />,
  OBLIGATIONS: <FileCheck className="h-5 w-5" />,
  RENEWAL: <Clock className="h-5 w-5" />,
  NEGOTIATION_POINTS: <TrendingUp className="h-5 w-5" />,
  AMENDMENTS: <FileText className="h-5 w-5" />,
  CONTACTS: <FileText className="h-5 w-5" />,
  PARTIES: <FileText className="h-5 w-5" />,
  TIMELINE: <Clock className="h-5 w-5" />,
  DELIVERABLES: <FileCheck className="h-5 w-5" />,
  EXECUTIVE_SUMMARY: <FileText className="h-5 w-5" />,
  RATES: <TrendingUp className="h-5 w-5" />,
  PROACTIVE_RISKS: <AlertTriangle className="h-5 w-5" />,
  PRICING: <DollarSign className="h-5 w-5" />,
  INTELLECTUAL_PROPERTY: <Scale className="h-5 w-5" />,
  DATA_PRIVACY: <Lock className="h-5 w-5" />,
  AUDIT_TRAIL: <Eye className="h-5 w-5" />,
  ACTION_ITEMS: <ClipboardList className="h-5 w-5" />,
};

const artifactLabels: Record<string, string> = {
  OVERVIEW: 'Overview',
  FINANCIAL: 'Financial Analysis',
  CLAUSES: 'Key Clauses',
  RISK: 'Risk Assessment',
  COMPLIANCE: 'Compliance Check',
  OBLIGATIONS: 'Obligations',
  RENEWAL: 'Renewal Terms',
  NEGOTIATION_POINTS: 'Negotiation Points',
  AMENDMENTS: 'Amendments',
  CONTACTS: 'Contacts & Signatories',
  PARTIES: 'Contract Parties',
  TIMELINE: 'Timeline & Milestones',
  DELIVERABLES: 'Deliverables',
  EXECUTIVE_SUMMARY: 'Executive Summary',
  RATES: 'Rate Cards',
  PROACTIVE_RISKS: 'Proactive Risk Detection',
  PRICING: 'Pricing Analysis',
  INTELLECTUAL_PROPERTY: 'Intellectual Property',
  DATA_PRIVACY: 'Data Privacy',
  AUDIT_TRAIL: 'Audit Trail',
  ACTION_ITEMS: 'Action Items',
};

const artifactOrder = ['OVERVIEW', 'EXECUTIVE_SUMMARY', 'CLAUSES', 'FINANCIAL', 'RISK', 'PROACTIVE_RISKS', 'COMPLIANCE', 'OBLIGATIONS', 'PARTIES', 'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS', 'TIMELINE', 'DELIVERABLES', 'RATES', 'PRICING', 'INTELLECTUAL_PROPERTY', 'DATA_PRIVACY', 'AUDIT_TRAIL', 'ACTION_ITEMS'];

const stageLabels: Record<string, string> = {
  'TEXT_EXTRACTION': 'Extracting text from document...',
  'RAG_INDEXING': 'Generating semantic embeddings...',
  'ARTIFACT_GENERATION': 'Generating AI artifacts...',
  'METADATA_EXTRACTION': 'Extracting contract metadata...',
  'CATEGORIZATION': 'Classifying contract type and risk...',
  'RATE_CARD_EXTRACTION': 'Extracting rate cards...',
  'METADATA_INITIALIZATION': 'Initializing metadata...',
  'COMPLETED': 'Processing complete!'
};

function mapArtifactListToUpdates(artifactList: Array<Record<string, unknown>>): ArtifactUpdate[] {
  return artifactList.map((artifact) => {
    const artifactData = (artifact.data as Record<string, unknown> | null) || {};
    return {
      id: String(artifact.id || ''),
      type: String(artifact.type || ''),
      status: 'COMPLETED',
      hasContent: Object.keys(artifactData).length > 0,
      contentLength: JSON.stringify(artifactData).length,
      qualityScore: null,
      completenessScore: typeof artifact.completeness === 'number' ? artifact.completeness : null,
      confidence: typeof artifact.confidence === 'number' ? artifact.confidence : null,
      metadata: {
        confidence: artifact.confidence,
      },
      createdAt: String(artifact.createdAt || new Date().toISOString()),
      updatedAt: String(artifact.updatedAt || new Date().toISOString()),
    };
  });
}

export function RealtimeArtifactViewer({ 
  contractId, 
  tenantId: _tenantId, // Deprecated: server uses session tenant from middleware
  onComplete,
  onContractNotFound
}: RealtimeArtifactViewerProps) {
  const {
    artifacts: streamArtifacts,
    isConnected,
    isComplete: streamIsComplete,
    contractStatus,
    processingStage,
    error,
    contractNotFound,
    disconnect: _disconnect,
    reconnect
  } = useArtifactStream({
    contractId,
    // tenantId not passed — server uses session tenant from middleware
    onComplete: () => {
      if (onComplete) onComplete();
    },
    onError: (errorMsg) => {
      // Log the error but don't trigger onContractNotFound here
      // The contractNotFound state will handle that via the useEffect below
      console.warn('[RealtimeArtifactViewer] Error:', errorMsg);
    },
    enabled: true
  });

  // Notify parent if contract not found (only after retries exhausted)
  useEffect(() => {
    if (contractNotFound && onContractNotFound) {
      onContractNotFound();
    }
  }, [contractNotFound, onContractNotFound]);

  const [polledArtifacts, setArtifacts] = useState<ArtifactUpdate[]>([]);
  const [polledIsComplete, setIsComplete] = useState(false);

  // Merge: prefer polled data when available (SSE failed), otherwise use stream data
  const artifacts = polledArtifacts.length > 0 ? polledArtifacts : streamArtifacts;
  const isComplete = polledIsComplete || streamIsComplete;

  const [animatingArtifacts, setAnimatingArtifacts] = useState<Set<string>>(new Set());
  const [retryingArtifacts, setRetryingArtifacts] = useState<Set<string>>(new Set());
  const [retryingFailedTypes, setRetryingFailedTypes] = useState<Set<string>>(new Set());
  const [isRetryingAllFailedTypes, setIsRetryingAllFailedTypes] = useState(false);
  const [artifactFailureState, setArtifactFailureState] = useState<ArtifactFailureState>({
    partialFailure: false,
    failedArtifactTypes: [],
  });
  const [_localError, setError] = useState<string | null>(null);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const refreshArtifacts = useCallback(async () => {
    const response = await fetch(`/api/contracts/${contractId}/artifacts`);
    if (!response.ok) {
      throw new Error('Failed to refresh artifacts');
    }

    const payload = unwrapApiResponseData<{ artifacts?: Array<Record<string, unknown>> }>(await response.json());
    const artifactList = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    const nextArtifacts = mapArtifactListToUpdates(artifactList);
    setArtifacts(nextArtifacts);
    if (nextArtifacts.length > 0) {
      setIsComplete(nextArtifacts.every((artifact) => artifact.status === 'COMPLETED'));
    }
    return nextArtifacts;
  }, [contractId]);

  const refreshArtifactFailureState = useCallback(async () => {
    const response = await fetch(`/api/contracts/${contractId}/metadata`);
    if (!response.ok) {
      throw new Error('Failed to load artifact run metadata');
    }

    const payload = unwrapApiResponseData<{ metadata?: Record<string, unknown>; data?: { metadata?: Record<string, unknown> } }>(await response.json());
    const rawMetadata = (payload.metadata as Record<string, unknown> | undefined)
      ?? (payload.data?.metadata as Record<string, unknown> | undefined)
      ?? {};
    const failedArtifactTypes = Array.isArray(rawMetadata.failedArtifactTypes)
      ? rawMetadata.failedArtifactTypes
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeType(value))
      : [];

    setArtifactFailureState({
      partialFailure: Boolean(rawMetadata.partialFailure) || failedArtifactTypes.length > 0,
      failedArtifactTypes,
    });
  }, [contractId]);

  // Compute completedCount and isEffectivelyComplete early (before callbacks that need them)
  const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
  // Complete when the stream says so, or when all received artifacts are done
  const isEffectivelyComplete = isComplete || (artifacts.length > 0 && completedCount >= artifacts.length);

  // Animate new artifacts
  useEffect(() => {
    artifacts.forEach(artifact => {
      if (artifact.status === 'COMPLETED' && !animatingArtifacts.has(artifact.id)) {
        setAnimatingArtifacts(prev => new Set(prev).add(artifact.id));
        setTimeout(() => {
          setAnimatingArtifacts(prev => {
            const next = new Set(prev);
            next.delete(artifact.id);
            return next;
          });
        }, 1000);
      }
    });
    
  }, [artifacts]);

  useEffect(() => {
    setArtifactFailureState({ partialFailure: false, failedArtifactTypes: [] });
    setRetryingFailedTypes(new Set());
    setIsRetryingAllFailedTypes(false);
  }, [contractId]);

  useEffect(() => {
    if (!isEffectivelyComplete) {
      return;
    }

    void refreshArtifactFailureState().catch(() => {
      setArtifactFailureState({ partialFailure: false, failedArtifactTypes: [] });
    });
  }, [isEffectivelyComplete, refreshArtifactFailureState]);

  // Polling fallback when SSE fails
  const startPollingFallback = useCallback(async () => {
    if (isEffectivelyComplete || isConnected) return;
    
    setIsPollingFallback(true);
    
    const poll = async () => {
      try {
        const nextArtifacts = await refreshArtifacts();
        if (nextArtifacts.length > 0) {
          const completed = nextArtifacts.filter((artifact) => artifact.hasContent).length;
          if (completed >= nextArtifacts.length) {
            setIsPollingFallback(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            setIsComplete(true);
            await refreshArtifactFailureState().catch(() => {
              setArtifactFailureState({ partialFailure: false, failedArtifactTypes: [] });
            });
          }
        }
      } catch {
        // Polling fallback error - silently continue
      }
    };
    
    pollingIntervalRef.current = setInterval(poll, 3000);
    poll(); // Immediate first poll
  }, [contractId, isConnected, isEffectivelyComplete]);

  // Start polling fallback if connection doesn't establish within 10s
  useEffect(() => {
    if (!isConnected && !isEffectivelyComplete && !error) {
      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected && !isEffectivelyComplete) {
          startPollingFallback();
        }
      }, 10000);
    }
    
    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [isConnected, isEffectivelyComplete, error, startPollingFallback]);

  // Cleanup polling on unmount or when complete
  useEffect(() => {
    if (isEffectivelyComplete && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      setIsPollingFallback(false);
    }
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isEffectivelyComplete]);

  const handleRetry = async (artifactId: string) => {
    setRetryingArtifacts(prev => new Set(prev).add(artifactId));
    
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/regenerate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Regeneration failed');
      }

      // Artifact will update via SSE stream
    } catch {
      // Failed to retry artifact - silently handle
    } finally {
      setTimeout(() => {
        setRetryingArtifacts(prev => {
          const next = new Set(prev);
          next.delete(artifactId);
          return next;
        });
      }, 2000);
    }
  };

  const retryFailedArtifactType = useCallback(async (artifactType: string, shouldRefresh: boolean) => {
    const normalizedType = normalizeType(artifactType);
    setRetryingFailedTypes((prev) => new Set(prev).add(normalizedType));

    try {
      const response = await fetch(`/api/contracts/${contractId}/artifacts/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artifactType: normalizedType }),
      });

      if (!response.ok) {
        throw new Error('Regeneration failed');
      }

      if (shouldRefresh) {
        await Promise.all([
          refreshArtifacts().catch(() => undefined),
          refreshArtifactFailureState().catch(() => undefined),
        ]);
      }
    } catch {
      // Failed to retry artifact type - silently handle
    } finally {
      setRetryingFailedTypes((prev) => {
        const next = new Set(prev);
        next.delete(normalizedType);
        return next;
      });
    }
  }, [contractId, refreshArtifactFailureState, refreshArtifacts]);

  const handleRetryFailedType = useCallback(async (artifactType: string) => {
    await retryFailedArtifactType(artifactType, true);
  }, [retryFailedArtifactType]);

  const handleRetryAllFailedTypes = useCallback(async () => {
    const failedTypes = [...artifactFailureState.failedArtifactTypes];
    if (failedTypes.length === 0) {
      return;
    }

    setIsRetryingAllFailedTypes(true);
    try {
      for (const artifactType of failedTypes) {
        await retryFailedArtifactType(artifactType, false);
      }

      await Promise.all([
        refreshArtifacts().catch(() => undefined),
        refreshArtifactFailureState().catch(() => undefined),
      ]);
    } finally {
      setIsRetryingAllFailedTypes(false);
    }
  }, [artifactFailureState.failedArtifactTypes, refreshArtifactFailureState, refreshArtifacts, retryFailedArtifactType]);

  // Normalize artifact types for consistent display
  const normalizedArtifacts = artifacts.map(a => ({
    ...a,
    normalizedType: normalizeType(a.type)
  }));

  const sortedArtifacts = [...normalizedArtifacts].sort((a, b) => {
    const aIndex = artifactOrder.indexOf(a.normalizedType);
    const bIndex = artifactOrder.indexOf(b.normalizedType);
    return aIndex - bIndex;
  });

  // Use actual artifact count from the stream (varies by contract type)
  const totalCount = artifacts.length;
  const hasArtifacts = totalCount > 0;
  const progressPercent = hasArtifacts ? Math.min(100, (completedCount / totalCount) * 100) : 0;
  const stripProgress = hasArtifacts ? progressPercent : 10;
  const hasPartialFailures = artifactFailureState.partialFailure && artifactFailureState.failedArtifactTypes.length > 0;

  // Early return if contract not found - don't render anything
  if (contractNotFound) {
    return null;
  }

  // While we're still queued and have no artifacts yet, the parent
  // upload row already shows the file-level "Waiting in queue …"
  // status. Suppress the entire inner viewer until either real work
  // starts or there's an error to show — prevents three duplicate
  // "queued / waiting / connecting" labels stacked on top of each
  // other.
  const stageStarted = !!processingStage && processingStage !== 'queued';
  const isQueuedSilent =
    !error &&
    !isEffectivelyComplete &&
    !hasArtifacts &&
    !stageStarted;
  if (isQueuedSilent) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Compact status strip — connection state + progress in one line */}
      {!isEffectivelyComplete && !error && (
        <div className="rounded-2xl border border-violet-200/70 bg-[linear-gradient(135deg,rgba(245,243,255,0.96),rgba(255,255,255,0.98))] px-4 py-3 shadow-[0_18px_40px_-32px_rgba(79,70,229,0.45)] dark:border-violet-900/60 dark:bg-[linear-gradient(135deg,rgba(49,46,129,0.28),rgba(15,23,42,0.96))]">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm',
              isPollingFallback
                ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                : 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
            )}>
              {isConnected ? (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              ) : isPollingFallback ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600/80 dark:text-violet-300/80">
                  Artifact pipeline
                </span>
                <Badge className={cn(
                  'border font-medium hover:bg-transparent',
                  isPollingFallback
                    ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    : 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                )}>
                  {isPollingFallback ? 'Polling fallback' : isConnected ? 'Live stream' : 'Connecting'}
                </Badge>
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {processingStage ? stageLabels[processingStage] : 'AI analysis in progress'}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {hasArtifacts ? `${completedCount} / ${totalCount} ready` : 'Starting…'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Progress value={stripProgress} variant={isPollingFallback ? 'warning' : 'default'} className="h-2 bg-white/80 dark:bg-slate-800" />
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {Math.round(stripProgress)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection-error banner (only when actually broken) */}
      {error && !error.includes('not found') && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
            <span className="text-[13px] text-red-700 dark:text-red-300 truncate">Live updates lost — retrying…</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setIsPollingFallback(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }
              reconnect();
            }}
            className="h-7 px-2 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {/* Completion strip */}
      {isEffectivelyComplete && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span className="text-[13px] font-medium text-emerald-800 dark:text-emerald-200">Analysis complete</span>
        </div>
      )}

      {hasPartialFailures && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                <span className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
                  Analysis finished with partial artifact failures
                </span>
              </div>
              <p className="mt-1 text-[13px] text-amber-800 dark:text-amber-200">
                {artifactFailureState.failedArtifactTypes.length} artifact{artifactFailureState.failedArtifactTypes.length === 1 ? '' : 's'} still need regeneration.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRetryAllFailedTypes()}
              disabled={isRetryingAllFailedTypes || retryingFailedTypes.size > 0}
              className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
            >
              {isRetryingAllFailedTypes ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              )}
              Retry all failed artifacts
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {artifactFailureState.failedArtifactTypes.map((artifactType) => {
              const normalizedType = normalizeType(artifactType);
              const isRetrying = retryingFailedTypes.has(normalizedType);
              return (
                <Button
                  key={normalizedType}
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRetryFailedType(normalizedType)}
                  disabled={isRetryingAllFailedTypes || isRetrying}
                  className="h-8 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
                >
                  {isRetrying ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                  )}
                  Retry {artifactLabels[normalizedType] || normalizedType}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hard error (contract not found, etc.) */}
      {error && error.includes('not found') && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/60 dark:bg-red-950/30">
          <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
          <span className="text-[13px] text-red-700 dark:text-red-300">Contract not found</span>
        </div>
      )}

      {/* Artifacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedArtifacts.map((artifact) => {
          const displayType = artifact.normalizedType;
          const isAnimating = animatingArtifacts.has(artifact.id);
          const isRetrying = retryingArtifacts.has(artifact.id);
          const isCompleted = artifact.status === 'COMPLETED';
          const isProcessing = artifact.status === 'PROCESSING' || isRetrying;
          const isFailed = artifact.status === 'FAILED';

          return (
            <Card 
              key={artifact.id}
              className={cn(
                "transition-all duration-500",
                isAnimating && "scale-105 shadow-lg border-violet-500",
                isCompleted && "hover:shadow-md",
                isFailed && "border-red-300 bg-red-50"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isCompleted && "bg-green-100 text-green-700",
                      isProcessing && "bg-violet-100 text-violet-700 animate-pulse",
                      isFailed && "bg-red-100 text-red-700",
                      !isCompleted && !isProcessing && !isFailed && "bg-gray-100 text-gray-400"
                    )}>
                      {artifactIcons[displayType]}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        {artifactLabels[displayType] || artifact.type}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {artifact.metadata?.description || 'AI-generated insights'}
                      </CardDescription>
                    </div>
                  </div>
                  
                  {isAnimating && (
                    <Sparkles className="h-4 w-4 text-violet-600 animate-pulse" />
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={
                        isCompleted ? "default" : 
                        isProcessing ? "secondary" : 
                        isFailed ? "destructive" : 
                        "outline"
                      }
                      className={cn(
                        "text-xs",
                        isProcessing && "animate-pulse"
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {isFailed && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {artifact.status}
                    </Badge>
                    
                    {isCompleted && artifact.contentLength > 0 && (
                      <span className="text-xs text-gray-500">
                        {(artifact.contentLength / 1024).toFixed(1)}KB
                      </span>
                    )}
                  </div>

                  {/* Content Preview */}
                  {isCompleted && artifact.hasContent && (
                    <div className="space-y-2">
                      <div className="h-20 bg-gray-50 rounded-md p-2 overflow-hidden">
                        <p className="text-xs text-gray-600 line-clamp-4">
                          {artifact.metadata?.preview || 'Content ready to view'}
                        </p>
                      </div>
                      <button 
                        className="text-xs text-violet-600 hover:underline font-medium"
                        onClick={() => {
                          // Navigate to AI tab on the contract detail page
                          window.location.href = `/contracts/${contractId}?tab=ai`;
                        }}
                      >
                        View Details →
                      </button>
                    </div>
                  )}

                  {/* Processing State */}
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Generating with AI...</span>
                    </div>
                  )}

                  {/* Waiting State */}
                  {!isCompleted && !isProcessing && !isFailed && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>Waiting in queue...</span>
                    </div>
                  )}

                  {/* Failed State */}
                  {isFailed && !isRetrying && (
                    <div className="space-y-2">
                      <div className="text-xs text-red-600">
                        <p>Generation failed. Please retry.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(artifact.id)}
                        className="w-full text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry Generation
                      </Button>
                    </div>
                  )}

                  {/* Metadata Info */}
                  {artifact.metadata && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      {artifact.metadata.confidence && (
                        <div>
                          <span className="text-gray-500">Confidence:</span>
                          <span className="ml-1 font-medium">
                            {Math.round(artifact.metadata.confidence * 100)}%
                          </span>
                        </div>
                      )}
                      {artifact.metadata.processingTime && (
                        <div>
                          <span className="text-gray-500">Time:</span>
                          <span className="ml-1 font-medium">
                            {(artifact.metadata.processingTime / 1000).toFixed(1)}s
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion Summary */}
      {isEffectivelyComplete && (
        <Card className={cn(
          hasPartialFailures
            ? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30'
            : completedCount > 0
            ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/30'
            : 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
        )}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className={cn(
                'h-6 w-6',
                hasPartialFailures
                  ? 'text-amber-600'
                  : completedCount > 0
                    ? 'text-green-600'
                    : 'text-blue-600',
              )} />
              <div>
                <p className={cn(
                  'font-semibold',
                  hasPartialFailures
                    ? 'text-amber-900 dark:text-amber-100'
                    : completedCount > 0
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-blue-900 dark:text-blue-100',
                )}>
                  {hasPartialFailures
                    ? 'Processing completed with a few missing artifacts'
                    : completedCount > 0
                      ? 'All artifacts generated successfully!'
                      : 'Processing complete'}
                </p>
                <p className={cn(
                  'text-sm',
                  hasPartialFailures
                    ? 'text-amber-700 dark:text-amber-300'
                    : completedCount > 0
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-blue-700 dark:text-blue-300',
                )}>
                  {hasPartialFailures
                    ? `${completedCount} artifact${completedCount !== 1 ? 's are' : ' is'} ready. Retry the remaining ${artifactFailureState.failedArtifactTypes.length} above.`
                    : completedCount > 0
                      ? `${completedCount} artifact${completedCount !== 1 ? 's' : ''} ready to view`
                      : 'View the contract for full details'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

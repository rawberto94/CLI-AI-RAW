'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useArtifactStream } from '@/hooks/useArtifactStream';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Wifi,
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
  tenantId?: string;
  onComplete?: () => void;
  onContractNotFound?: () => void;  // Called when contract returns 404
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

export function RealtimeArtifactViewer({ 
  contractId, 
  tenantId = 'demo',
  onComplete,
  onContractNotFound
}: RealtimeArtifactViewerProps) {
  const {
    artifacts,
    isConnected,
    isComplete,
    contractStatus,
    processingStage,
    error,
    contractNotFound,
    disconnect: _disconnect,
    reconnect
  } = useArtifactStream({
    contractId,
    tenantId,
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
      console.log('[RealtimeArtifactViewer] Contract not found, notifying parent');
      onContractNotFound();
    }
  }, [contractNotFound, onContractNotFound]);

  const [animatingArtifacts, setAnimatingArtifacts] = useState<Set<string>>(new Set());
  const [retryingArtifacts, setRetryingArtifacts] = useState<Set<string>>(new Set());
  const [_localError, setError] = useState<string | null>(null);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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

  // Polling fallback when SSE fails
  const startPollingFallback = useCallback(async () => {
    if (isEffectivelyComplete || isConnected) return;
    
    setIsPollingFallback(true);
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/artifacts`, {
          headers: { 'x-tenant-id': tenantId }
        });
        if (response.ok) {
          const data = await response.json();
          // Check if all artifacts are complete - response is { success, data: [...] }
          const artifactList = data.data || data.artifacts || [];
          if (artifactList.length > 0) {
            // Count items with actual content
            const completed = artifactList.filter((a: any) => 
              a.data && Object.keys(a.data || {}).length > 0
            ).length;
            if (completed >= artifactList.length) {
              // All artifacts complete — update state instead of full page reload
              setIsPollingFallback(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }
              setArtifacts(artifactList.map((a: any) => ({
                id: a.id,
                type: a.type,
                status: 'COMPLETED',
                hasContent: true,
                contentLength: JSON.stringify(a.data).length,
                metadata: {},
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
              })));
              setIsComplete(true);
            }
          }
        }
      } catch {
        // Polling fallback error - silently continue
      }
    };
    
    pollingIntervalRef.current = setInterval(poll, 3000);
    poll(); // Immediate first poll
  }, [contractId, tenantId, isConnected, isEffectivelyComplete]);

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
            'x-tenant-id': tenantId,
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
  const totalCount = Math.max(artifacts.length, 1);
  const progressPercent = totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;

  // Early return if contract not found - don't render anything
  if (contractNotFound) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="h-4 w-4 text-green-600 animate-pulse" />
              <span className="text-sm text-green-600 font-medium">Live Updates Connected</span>
            </>
          ) : isEffectivelyComplete ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
              <span className="text-sm text-violet-600 font-medium">Processing Complete</span>
            </>
          ) : error ? (
            <>
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-500">
                {error.includes('not found') ? 'Contract not found' : 'Connection Error'}
              </span>
              {!error.includes('not found') && (
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
                  className="ml-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : isPollingFallback ? (
            <>
              <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
              <span className="text-sm text-yellow-600">Checking status...</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
              <span className="text-sm text-violet-500">Connecting to live updates...</span>
            </>
          )}
        </div>
        
        {!isEffectivelyComplete && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{completedCount} of {totalCount} artifacts</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {!isEffectivelyComplete && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {processingStage ? stageLabels[processingStage] : 'Processing contract...'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contractStatus === 'PROCESSING' ? 'Analyzing document with AI' : contractStatus}
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-gray-500 text-right">
                {Math.round(progressPercent)}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Processing Error</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  reconnect();
                }}
                className="mt-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry Connection
              </Button>
            </div>
          </AlertDescription>
        </Alert>
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
                          // Navigate to detailed view
                          window.location.href = `/contracts/${contractId}?artifact=${artifact.type}`;
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
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">All artifacts generated successfully!</p>
                <p className="text-sm text-green-700">
                  {completedCount} artifacts are ready to view
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

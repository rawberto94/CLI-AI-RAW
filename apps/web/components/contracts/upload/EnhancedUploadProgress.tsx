'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileText,
  Brain,
  Sparkles,
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
  Timer,
  Layers,
  Shield,
  DollarSign,
  FileCheck,
  TrendingUp,
  AlertCircle,
  Calendar,
  FileEdit,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// ============================================================================
// API Status Types (from /api/contracts/[id]/status)
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

// ============================================================================
// Types
// ============================================================================

export interface ProcessingStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
  progress?: number;
  error?: string;
  apiStep?: string; // Maps to API currentStep
}

export interface ArtifactProgress {
  type: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  progress?: number;
  startTime?: number;
  endTime?: number;
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
  tenantId?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Map UI stages to API steps
const API_STEP_TO_STAGE: Record<string, string> = {
  'upload': 'upload',
  'queued': 'text-extraction',
  'ocr': 'text-extraction',
  'artifacts': 'artifact-generation',
  'storage': 'indexing',
  'complete': 'indexing',
};

// ============================================================================
// Constants
// ============================================================================

const PROCESSING_STAGES: Omit<ProcessingStage, 'status' | 'startTime' | 'endTime'>[] = [
  {
    id: 'upload',
    name: 'Upload',
    description: 'Securely uploading file',
    icon: <Upload className="h-4 w-4" />,
  },
  {
    id: 'text-extraction',
    name: 'Text Extraction',
    description: 'OCR and text parsing',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'ai-analysis',
    name: 'AI Analysis',
    description: 'Deep contract understanding',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: 'artifact-generation',
    name: 'Artifact Generation',
    description: 'Creating insights & reports',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'indexing',
    name: 'Indexing',
    description: 'Making contract searchable',
    icon: <Layers className="h-4 w-4" />,
  },
];

const ARTIFACT_TYPES = [
  { type: 'OVERVIEW', name: 'Overview', icon: <FileText className="h-3.5 w-3.5" /> },
  { type: 'CLAUSES', name: 'Key Clauses', icon: <FileCheck className="h-3.5 w-3.5" /> },
  { type: 'FINANCIAL', name: 'Financial', icon: <DollarSign className="h-3.5 w-3.5" /> },
  { type: 'RISK', name: 'Risk Assessment', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { type: 'COMPLIANCE', name: 'Compliance', icon: <Shield className="h-3.5 w-3.5" /> },
  { type: 'OBLIGATIONS', name: 'Obligations', icon: <FileEdit className="h-3.5 w-3.5" /> },
  { type: 'RENEWAL', name: 'Renewal Terms', icon: <Calendar className="h-3.5 w-3.5" /> },
  { type: 'NEGOTIATION_POINTS', name: 'Negotiation Points', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { type: 'AMENDMENTS', name: 'Amendments', icon: <FileEdit className="h-3.5 w-3.5" /> },
  { type: 'CONTACTS', name: 'Contacts', icon: <Phone className="h-3.5 w-3.5" /> },
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
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StageIndicatorProps {
  stage: ProcessingStage;
  isActive: boolean;
  isLast: boolean;
}

function StageIndicator({ stage, isActive, isLast }: StageIndicatorProps) {
  const getStatusColor = () => {
    switch (stage.status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500';
      case 'in-progress':
        return 'bg-violet-500 text-white border-violet-500';
      case 'error':
        return 'bg-red-500 text-white border-red-500';
      default:
        return 'bg-gray-100 text-gray-400 border-gray-200';
    }
  };

  const getLineColor = () => {
    if (stage.status === 'completed') return 'bg-green-500';
    if (stage.status === 'in-progress') return 'bg-violet-200';
    return 'bg-gray-200';
  };

  return (
    <div className="flex items-center">
      <motion.div
        className={cn(
          'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
          getStatusColor()
        )}
        animate={isActive ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        {stage.status === 'in-progress' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : stage.status === 'completed' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : stage.status === 'error' ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          stage.icon
        )}
      </motion.div>
      {!isLast && (
        <div className={cn('w-8 h-0.5 mx-1', getLineColor())} />
      )}
    </div>
  );
}

interface ArtifactChipProps {
  artifact: ArtifactProgress;
  artifactInfo: typeof ARTIFACT_TYPES[0];
}

function ArtifactChip({ artifact, artifactInfo }: ArtifactChipProps) {
  const getStatusStyles = () => {
    switch (artifact.status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'generating':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        getStatusStyles()
      )}
    >
      {artifact.status === 'generating' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : artifact.status === 'completed' ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : artifact.status === 'error' ? (
        <AlertCircle className="h-3 w-3" />
      ) : (
        artifactInfo.icon
      )}
      <span>{artifactInfo.name}</span>
    </motion.div>
  );
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
  tenantId = 'demo',
}: UploadProgressProps) {
  const router = useRouter();
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactProgress[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Initialize stages
  useEffect(() => {
    setStages(PROCESSING_STAGES.map(s => ({ ...s, status: 'pending' as const })));
    setArtifacts(ARTIFACT_TYPES.map(a => ({ type: a.type, status: 'pending' as const })));
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (status === 'uploading' || status === 'processing') {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [status, startTime]);

  // Real-time status polling from API
  const pollStatusRef = useRef<NodeJS.Timeout | null>(null);
  const [apiStatus, setApiStatus] = useState<ContractStatusResponse | null>(null);
  const [lastPollError, setLastPollError] = useState<string | null>(null);

  // Poll the contract status API for real progress
  useEffect(() => {
    // Only poll when we have a contractId and are processing
    if (!contractId || (status !== 'processing' && status !== 'uploading')) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/status`, {
          headers: {
            'x-tenant-id': tenantId,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLastPollError('Contract not found');
            return;
          }
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data: ContractStatusResponse = await response.json();
        setApiStatus(data);
        setLastPollError(null);

        // Update stages based on real API status
        const currentApiStep = data.currentStep;
        const currentUiStage = API_STEP_TO_STAGE[currentApiStep] || 'upload';
        const stageIndex = PROCESSING_STAGES.findIndex(s => s.id === currentUiStage);

        setStages(prev => prev.map((s, i) => {
          if (i < stageIndex) {
            // Stages before current are completed
            return { ...s, status: 'completed' as const, endTime: s.endTime || Date.now() };
          } else if (i === stageIndex) {
            // Current stage is in-progress
            return { 
              ...s, 
              status: data.status === 'FAILED' ? 'error' as const : 'in-progress' as const, 
              startTime: s.startTime || Date.now(),
              progress: data.stageProgress,
              error: data.error || undefined,
            };
          } else {
            // Future stages are pending
            return { ...s, status: 'pending' as const };
          }
        }));

        // Update artifacts based on real artifact types generated
        const generatedTypes = new Set(data.artifactTypes.map(t => t.toUpperCase()));
        setArtifacts(prev => prev.map((a, index) => {
          const isGenerated = generatedTypes.has(a.type);
          const isGenerating = currentApiStep === 'artifacts' && 
            !isGenerated && 
            index <= data.artifactsGenerated;
          
          if (isGenerated) {
            return { ...a, status: 'completed' as const, endTime: a.endTime || Date.now() };
          } else if (isGenerating) {
            return { ...a, status: 'generating' as const, startTime: a.startTime || Date.now() };
          } else {
            return { ...a, status: 'pending' as const };
          }
        }));

        // Stop polling if complete or failed
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          if (pollStatusRef.current) {
            clearInterval(pollStatusRef.current);
            pollStatusRef.current = null;
          }
        }
      } catch (err) {
        console.error('Error polling contract status:', err);
        setLastPollError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 1.5 seconds
    pollStatusRef.current = setInterval(pollStatus, 1500);

    return () => {
      if (pollStatusRef.current) {
        clearInterval(pollStatusRef.current);
        pollStatusRef.current = null;
      }
    };
  }, [contractId, status, tenantId]);

  // Update stages based on simple status changes (fallback when no contractId yet)
  useEffect(() => {
    if (contractId) return; // Skip if we have contractId - API polling handles it

    if (status === 'uploading') {
      setStages(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'in-progress', startTime: Date.now() } : s
      ));
    } else if (status === 'completed') {
      setStages(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
      setArtifacts(prev => prev.map(a => ({ ...a, status: 'completed' as const })));
    } else if (status === 'error') {
      setStages(prev => {
        const currentStage = prev.findIndex(s => s.status === 'in-progress');
        return prev.map((s, i) => 
          i === currentStage || (currentStage === -1 && i === 0) 
            ? { ...s, status: 'error' as const, error } 
            : s
        );
      });
    }
  }, [status, error, contractId]);

  // Calculate overall progress - prefer real API data when available
  const overallProgress = useMemo(() => {
    // Use real API progress if available
    if (apiStatus?.progress !== undefined) {
      return apiStatus.progress;
    }

    // Fallback to local calculation
    const stageWeight = 60; // 60% for stages
    const artifactWeight = 40; // 40% for artifacts
    
    const completedStages = stages.filter(s => s.status === 'completed').length;
    const inProgressStages = stages.filter(s => s.status === 'in-progress').length;
    const stageProgress = ((completedStages + (inProgressStages * 0.5)) / stages.length) * stageWeight;
    
    const completedArtifacts = artifacts.filter(a => a.status === 'completed').length;
    const generatingArtifacts = artifacts.filter(a => a.status === 'generating').length;
    const artifactProgress = ((completedArtifacts + (generatingArtifacts * 0.5)) / artifacts.length) * artifactWeight;
    
    return Math.round(stageProgress + artifactProgress);
  }, [stages, artifacts, apiStatus]);

  // Get real timing from API if available
  const displayElapsedTime = useMemo(() => {
    if (apiStatus?.timing?.elapsedMs !== undefined) {
      return apiStatus.timing.elapsedMs;
    }
    return elapsedTime;
  }, [apiStatus, elapsedTime]);

  const estimatedTimeRemaining = useMemo(() => {
    if (apiStatus?.timing?.estimatedRemainingFormatted) {
      return apiStatus.timing.estimatedRemainingFormatted;
    }
    return null;
  }, [apiStatus]);

  const currentStage = stages.find(s => s.status === 'in-progress');
  const completedArtifacts = artifacts.filter(a => a.status === 'completed').length;
  const totalArtifactsCount = apiStatus?.totalArtifacts || artifacts.length;
  const artifactsGeneratedCount = apiStatus?.artifactsGenerated ?? completedArtifacts;

  // Handle duplicate contract
  if (isDuplicate && existingContractId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-200 bg-amber-50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Copy className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-amber-900">Duplicate Detected</h4>
            <p className="text-sm text-amber-700 mt-1">
              This file has already been processed. Would you like to view the existing contract?
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => router.push(`/contracts/${existingContractId}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Existing
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-process
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-white shadow-sm overflow-hidden',
        status === 'error' && 'border-red-200 bg-red-50',
        status === 'completed' && 'border-green-200'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-lg',
              status === 'completed' ? 'bg-green-100' :
              status === 'error' ? 'bg-red-100' :
              'bg-violet-100'
            )}>
              {status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <FileText className="h-5 w-5 text-violet-600" />
              )}
            </div>
            <div>
              <h4 className="font-medium text-gray-900 truncate max-w-[200px]">
                {fileName}
              </h4>
              <p className="text-xs text-gray-500">
                {formatFileSize(fileSize)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(status === 'uploading' || status === 'processing') && (
              <>
                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                  <Timer className="h-3 w-3 mr-1" />
                  {formatDuration(displayElapsedTime)}
                </Badge>
                {estimatedTimeRemaining && (
                  <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                    <Clock className="h-3 w-3 mr-1" />
                    ~{estimatedTimeRemaining}
                  </Badge>
                )}
              </>
            )}
            
            {status === 'completed' && contractId && (
              <Button
                size="sm"
                onClick={() => router.push(`/contracts/${contractId}`)}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            )}
            
            {status === 'error' && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            
            {(status === 'pending' || status === 'error') && (
              <Button size="sm" variant="ghost" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        {status !== 'pending' && status !== 'completed' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{currentStage?.name || 'Processing...'}</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}
      </div>
      
      {/* Stage Timeline */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              {/* Processing Stages */}
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Processing Stages
                </h5>
                <div className="flex items-center justify-center">
                  {stages.map((stage, index) => (
                    <StageIndicator
                      key={stage.id}
                      stage={stage}
                      isActive={stage.status === 'in-progress'}
                      isLast={index === stages.length - 1}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 px-2">
                  {stages.map(stage => (
                    <span key={stage.id} className="text-[10px] text-gray-500 text-center w-16">
                      {stage.name}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Artifact Generation */}
              {status === 'processing' && (
                <div>
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    AI Artifacts ({artifactsGeneratedCount}/{totalArtifactsCount})
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {artifacts.map(artifact => {
                      const info = ARTIFACT_TYPES.find(a => a.type === artifact.type);
                      if (!info) return null;
                      return (
                        <ArtifactChip
                          key={artifact.type}
                          artifact={artifact}
                          artifactInfo={info}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Error Details */}
              {status === 'error' && (error || apiStatus?.error || lastPollError) && (
                <div className="mt-4 p-3 bg-red-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Processing Failed</p>
                      <p className="text-xs text-red-600 mt-1">
                        {error || apiStatus?.error || lastPollError}
                      </p>
                      {apiStatus?.processingJob?.retryCount !== undefined && 
                       apiStatus.processingJob.retryCount > 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          Retry attempt {apiStatus.processingJob.retryCount} of {apiStatus.processingJob.maxRetries}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Completion Summary */}
              {status === 'completed' && (
                <div className="p-3 bg-green-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Processing Complete</p>
                      <p className="text-xs text-green-600 mt-0.5">
                        {artifactsGeneratedCount} AI artifacts generated in {
                          apiStatus?.timing?.processingDurationFormatted || formatDuration(displayElapsedTime)
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EnhancedUploadProgress;

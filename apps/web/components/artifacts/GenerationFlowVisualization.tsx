'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  FileText,
  DollarSign,
  Shield,
  AlertTriangle,
  FileCheck,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Database,
  Search,
  Zap,
  ArrowRight,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============ TYPES ============

type ProcessingStage = 
  | 'UPLOADING'
  | 'TEXT_EXTRACTION'
  | 'RAG_INDEXING'
  | 'ARTIFACT_GENERATION'
  | 'METADATA_EXTRACTION'
  | 'CATEGORIZATION'
  | 'OVERVIEW'
  | 'CLAUSES'
  | 'FINANCIAL'
  | 'RISK'
  | 'COMPLIANCE'
  | 'COMPLETED'
  | 'ERROR';

type ArtifactStatus = 'pending' | 'generating' | 'completed' | 'error';

interface ArtifactProgress {
  id: string
  type: string
  status: ArtifactStatus
  progress: number
  error?: string
}

interface GenerationFlowProps {
  contractId: string
  isConnected: boolean
  currentStage: ProcessingStage
  progress: number
  artifacts: ArtifactProgress[]
  error?: string
  onRetry?: () => void
  className?: string
}

// ============ STAGE CONFIGURATION ============

const PIPELINE_STAGES = [
  {
    id: 'TEXT_EXTRACTION',
    label: 'Extracting Text',
    description: 'Reading and parsing document content',
    icon: FileText,
    color: 'blue'
  },
  {
    id: 'RAG_INDEXING',
    label: 'Indexing',
    description: 'Creating semantic embeddings',
    icon: Database,
    color: 'indigo'
  },
  {
    id: 'ARTIFACT_GENERATION',
    label: 'AI Analysis',
    description: 'Generating intelligent artifacts',
    icon: Brain,
    color: 'purple'
  },
  {
    id: 'METADATA_EXTRACTION',
    label: 'Metadata',
    description: 'Extracting contract fields',
    icon: Sparkles,
    color: 'amber'
  },
  {
    id: 'CATEGORIZATION',
    label: 'Categorizing',
    description: 'AI contract classification',
    icon: Search,
    color: 'cyan'
  }
] as const;

const ARTIFACT_TYPES = [
  { id: 'OVERVIEW', label: 'Overview', icon: FileText, color: 'blue' },
  { id: 'CLAUSES', label: 'Clauses', icon: FileCheck, color: 'indigo' },
  { id: 'FINANCIAL', label: 'Financial', icon: DollarSign, color: 'emerald' },
  { id: 'RISK', label: 'Risk', icon: AlertTriangle, color: 'amber' },
  { id: 'COMPLIANCE', label: 'Compliance', icon: Shield, color: 'violet' }
] as const;

// ============ HELPER COMPONENTS ============

function StageIndicator({ 
  stage, 
  currentStage, 
  isComplete,
  isActive,
  isError 
}: { 
  stage: typeof PIPELINE_STAGES[number]
  currentStage: ProcessingStage
  isComplete: boolean
  isActive: boolean
  isError: boolean
}) {
  const Icon = stage.icon;
  
  const getColors = () => {
    if (isError) return {
      bg: 'bg-rose-100',
      icon: 'text-rose-600',
      ring: 'ring-rose-200'
    };
    if (isComplete) return {
      bg: 'bg-emerald-100',
      icon: 'text-emerald-600',
      ring: 'ring-emerald-200'
    };
    if (isActive) return {
      bg: 'bg-indigo-100',
      icon: 'text-indigo-600',
      ring: 'ring-indigo-300 ring-2'
    };
    return {
      bg: 'bg-slate-100',
      icon: 'text-slate-400',
      ring: ''
    };
  };
  
  const colors = getColors();
  
  return (
    <div className="flex items-center gap-4">
      <motion.div 
        className={cn(
          "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
          colors.bg,
          colors.ring
        )}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
      >
        {isComplete ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        ) : isError ? (
          <XCircle className="h-6 w-6 text-rose-600" />
        ) : isActive ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className={cn("h-6 w-6", colors.icon)} />
          </motion.div>
        ) : (
          <Icon className={cn("h-6 w-6", colors.icon)} />
        )}
        
        {/* Pulse effect for active */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-indigo-400"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>
      
      <div className="flex-1">
        <p className={cn(
          "font-medium",
          isActive ? "text-slate-900" : isComplete ? "text-emerald-700" : "text-slate-500"
        )}>
          {stage.label}
        </p>
        <p className="text-sm text-slate-500">{stage.description}</p>
      </div>
    </div>
  );
}

function ArtifactBubble({ 
  artifact, 
  config 
}: { 
  artifact: ArtifactProgress
  config: typeof ARTIFACT_TYPES[number]
}) {
  const Icon = config.icon;
  
  const getStatusColors = () => {
    switch (artifact.status) {
      case 'completed':
        return {
          bg: 'bg-gradient-to-br from-emerald-500 to-green-600',
          ring: 'ring-emerald-200',
          text: 'text-white'
        };
      case 'generating':
        return {
          bg: 'bg-gradient-to-br from-indigo-500 to-purple-600',
          ring: 'ring-indigo-300 ring-2',
          text: 'text-white'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-br from-rose-500 to-red-600',
          ring: 'ring-rose-200',
          text: 'text-white'
        };
      default:
        return {
          bg: 'bg-slate-100',
          ring: '',
          text: 'text-slate-400'
        };
    }
  };
  
  const colors = getStatusColors();
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2"
    >
      <motion.div
        className={cn(
          "relative w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
          colors.bg,
          colors.ring
        )}
        animate={artifact.status === 'generating' ? { 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        } : {}}
        transition={{ duration: 1, repeat: artifact.status === 'generating' ? Infinity : 0 }}
      >
        {artifact.status === 'generating' ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className={cn("h-5 w-5", colors.text)} />
          </motion.div>
        ) : artifact.status === 'completed' ? (
          <CheckCircle2 className={cn("h-5 w-5", colors.text)} />
        ) : artifact.status === 'error' ? (
          <XCircle className={cn("h-5 w-5", colors.text)} />
        ) : (
          <Icon className={cn("h-5 w-5", colors.text)} />
        )}
        
        {/* Progress ring */}
        {artifact.status === 'generating' && (
          <svg className="absolute inset-0 w-12 h-12 -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={125.6}
              strokeDashoffset={125.6 * (1 - artifact.progress / 100)}
              className="transition-all duration-300"
            />
          </svg>
        )}
      </motion.div>
      
      <span className={cn(
        "text-xs font-medium",
        artifact.status === 'completed' ? "text-emerald-600" :
        artifact.status === 'generating' ? "text-indigo-600" :
        artifact.status === 'error' ? "text-rose-600" :
        "text-slate-400"
      )}>
        {config.label}
      </span>
    </motion.div>
  );
}

// ============ MAIN COMPONENT ============

export function GenerationFlowVisualization({
  contractId,
  isConnected,
  currentStage,
  progress,
  artifacts,
  error,
  onRetry,
  className
}: GenerationFlowProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  
  // Update elapsed time
  useEffect(() => {
    if (currentStage === 'COMPLETED' || currentStage === 'ERROR') return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentStage, startTime]);
  
  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };
  
  // Determine stage states
  const getStageState = (stageId: string) => {
    const stageOrder = PIPELINE_STAGES.map(s => s.id) as string[];
    const currentIndex = stageOrder.indexOf(currentStage as string);
    const stageIndex = stageOrder.indexOf(stageId as string);
    
    if (currentStage === 'ERROR') {
      return { isComplete: false, isActive: false, isError: stageIndex === currentIndex };
    }
    if (currentStage === 'COMPLETED') {
      return { isComplete: true, isActive: false, isError: false };
    }
    
    return {
      isComplete: stageIndex < currentIndex,
      isActive: stageIndex === currentIndex,
      isError: false
    };
  };
  
  // Completed artifacts count
  const completedArtifacts = artifacts.filter(a => a.status === 'completed').length;
  const totalArtifacts = ARTIFACT_TYPES.length;
  const isComplete = currentStage === 'COMPLETED';
  const isError = currentStage === 'ERROR';
  
  return (
    <Card className={cn("overflow-hidden border-slate-200/80", className)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl shadow-sm",
                isComplete 
                  ? "bg-gradient-to-br from-emerald-500 to-green-600"
                  : isError
                  ? "bg-gradient-to-br from-rose-500 to-red-600"
                  : "bg-gradient-to-br from-indigo-500 to-purple-600"
              )}>
                {isComplete ? (
                  <CheckCircle2 className="h-6 w-6 text-white" />
                ) : isError ? (
                  <XCircle className="h-6 w-6 text-white" />
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Brain className="h-6 w-6 text-white" />
                  </motion.div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {isComplete 
                    ? 'Processing Complete' 
                    : isError 
                    ? 'Processing Failed'
                    : 'AI Processing'}
                </h3>
                <p className="text-sm text-slate-500">
                  {isComplete 
                    ? `Generated ${completedArtifacts} artifacts in ${formatTime(elapsedTime)}`
                    : isError
                    ? error || 'An error occurred during processing'
                    : `Analyzing contract documents...`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-500">Offline</span>
                  </>
                )}
              </div>
              
              {/* Time */}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                {formatTime(elapsedTime)}
              </div>
              
              {/* Retry Button */}
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              )}
            </div>
          </div>
          
          {/* Overall Progress */}
          {!isComplete && !isError && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600">Overall Progress</span>
                <span className="font-medium text-slate-900">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Pipeline Stages */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            {PIPELINE_STAGES.map((stage, i) => {
              const { isComplete, isActive, isError } = getStageState(stage.id);
              
              return (
                <div key={stage.id} className="relative">
                  <StageIndicator
                    stage={stage}
                    currentStage={currentStage}
                    isComplete={isComplete}
                    isActive={isActive}
                    isError={isError}
                  />
                  
                  {/* Connector line */}
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="absolute left-7 top-14 w-0.5 h-6">
                      <div className={cn(
                        "w-full h-full rounded-full",
                        isComplete ? "bg-emerald-300" : "bg-slate-200"
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Artifact Generation */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-900">Artifacts</h4>
              <Badge variant="secondary" className="bg-slate-100">
                {completedArtifacts} / {totalArtifacts}
              </Badge>
            </div>
            
            <div className="flex items-center justify-around gap-4">
              {ARTIFACT_TYPES.map((config) => {
                const artifact = artifacts.find(a => 
                  a.type.toUpperCase() === config.id
                ) || {
                  id: config.id,
                  type: config.id,
                  status: 'pending' as ArtifactStatus,
                  progress: 0
                };
                
                return (
                  <ArtifactBubble 
                    key={config.id} 
                    artifact={artifact}
                    config={config}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ COMPACT VERSION ============

interface CompactGenerationFlowProps {
  currentStage: ProcessingStage
  progress: number
  completedArtifacts: number
  totalArtifacts: number
  className?: string
}

export function CompactGenerationFlow({
  currentStage,
  progress,
  completedArtifacts,
  totalArtifacts,
  className
}: CompactGenerationFlowProps) {
  const isComplete = currentStage === 'COMPLETED';
  const isError = currentStage === 'ERROR';
  
  const getStageLabel = () => {
    switch (currentStage) {
      case 'UPLOADING': return 'Uploading...';
      case 'TEXT_EXTRACTION': return 'Extracting text...';
      case 'RAG_INDEXING': return 'Indexing...';
      case 'ARTIFACT_GENERATION': return 'Generating artifacts...';
      case 'COMPLETED': return 'Complete!';
      case 'ERROR': return 'Error';
      default: return 'Processing...';
    }
  };
  
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        isComplete 
          ? "bg-emerald-100"
          : isError
          ? "bg-rose-100"
          : "bg-indigo-100"
      )}>
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : isError ? (
          <XCircle className="h-5 w-5 text-rose-600" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-5 w-5 text-indigo-600" />
          </motion.div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-900">
            {getStageLabel()}
          </span>
          <span className="text-sm text-slate-500">
            {completedArtifacts}/{totalArtifacts} artifacts
          </span>
        </div>
        
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isComplete 
                ? "bg-emerald-500"
                : isError
                ? "bg-rose-500"
                : "bg-indigo-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default GenerationFlowVisualization;

'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Minimize2,
  RefreshCw
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useJobProgress } from '@/lib/websocket/use-socket'

// ============================================================================
// TYPES
// ============================================================================

export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'failed'

export interface ProgressStage {
  id: string
  name: string
  status: StageStatus
  progress: number
  estimatedTime?: number
  details?: string
  error?: string
  substages?: ProgressStage[]
}

interface MultiStageProgressProps {
  stages?: ProgressStage[]
  title?: string
  allowBackground?: boolean
  onBackground?: () => void
  onCancel?: () => void
  showDetails?: boolean
  jobId?: string | null
  realtime?: boolean
  onComplete?: (result: any) => void
  onError?: (error: string) => void
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

const getOverallProgress = (stages: ProgressStage[]): number => {
  const totalProgress = stages.reduce((sum, stage) => sum + stage.progress, 0)
  return Math.round(totalProgress / stages.length)
}

const getCurrentStage = (stages: ProgressStage[]): ProgressStage | null => {
  return stages.find(s => s.status === 'in-progress') || null
}

const getTotalEstimatedTime = (stages: ProgressStage[]): number => {
  return stages
    .filter(s => s.status === 'pending' || s.status === 'in-progress')
    .reduce((sum, stage) => sum + (stage.estimatedTime || 0), 0)
}

// ============================================================================
// STAGE ICON COMPONENT
// ============================================================================

const StageIcon: React.FC<{ status: StageStatus; progress: number }> = ({ 
  status, 
  progress 
}) => {
  switch (status) {
    case 'completed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </motion.div>
      )
    
    case 'in-progress':
      return (
        <div className="relative">
          <svg className="w-6 h-6 -rotate-90">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-gray-200"
            />
            <motion.circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-blue-600"
              strokeDasharray={`${2 * Math.PI * 10}`}
              strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress / 100)}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 10 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 10 * (1 - progress / 100) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
          </div>
        </div>
      )
    
    case 'failed':
      return <AlertCircle className="w-6 h-6 text-red-600" />
    
    default:
      return <Circle className="w-6 h-6 text-gray-300" />
  }
}

// ============================================================================
// STAGE ITEM COMPONENT
// ============================================================================

const StageItem: React.FC<{
  stage: ProgressStage
  isLast: boolean
  showDetails: boolean
}> = ({ stage, isLast, showDetails }) => {
  const [expanded, setExpanded] = useState(false)
  const hasSubstages = stage.substages && stage.substages.length > 0

  return (
    <div className="relative">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Stage Content */}
      <div className="flex items-start gap-4 pb-6">
        {/* Icon */}
        <div className="relative z-10 bg-white">
          <StageIcon status={stage.status} progress={stage.progress} />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className={`font-medium ${
                stage.status === 'completed' ? 'text-gray-900' :
                stage.status === 'in-progress' ? 'text-blue-600' :
                stage.status === 'failed' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {stage.name}
              </h4>
              
              {stage.details && (
                <p className="text-sm text-gray-600 mt-1">
                  {stage.details}
                </p>
              )}
              
              {stage.error && (
                <p className="text-sm text-red-600 mt-1">
                  {stage.error}
                </p>
              )}
            </div>

            {/* Time Estimate */}
            {stage.status === 'in-progress' && stage.estimatedTime && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span>{formatTime(stage.estimatedTime)}</span>
              </div>
            )}

            {/* Expand Button */}
            {hasSubstages && showDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="flex-shrink-0"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>

          {/* Progress Bar for In-Progress Stage */}
          {stage.status === 'in-progress' && stage.progress > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                <span>Progress</span>
                <span>{stage.progress}%</span>
              </div>
              <Progress value={stage.progress} className="h-1.5" />
            </div>
          )}

          {/* Substages */}
          {hasSubstages && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pl-4 border-l-2 border-gray-200 space-y-3"
            >
              {stage.substages!.map((substage, index) => (
                <div key={substage.id} className="flex items-start gap-3">
                  <StageIcon status={substage.status} progress={substage.progress} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">
                      {substage.name}
                    </p>
                    {substage.details && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {substage.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MultiStageProgress: React.FC<MultiStageProgressProps> = ({
  stages: initialStages,
  title = 'Processing',
  allowBackground = true,
  onBackground,
  onCancel,
  showDetails = true,
  jobId = null,
  realtime = false,
  onComplete,
  onError
}) => {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [localStages, setLocalStages] = useState<ProgressStage[]>(initialStages || [])
  const [retryCount, setRetryCount] = useState(0)
  
  // Use WebSocket for real-time updates if jobId is provided
  const { 
    progress: wsProgress, 
    isComplete: wsComplete, 
    error: wsError 
  } = useJobProgress(realtime && jobId ? jobId : null)
  
  const [showConnectionStatus, setShowConnectionStatus] = useState(false)

  // Update stages from WebSocket progress
  useEffect(() => {
    if (!wsProgress || !realtime) return

    // Map WebSocket progress to stage format
    const updatedStages = localStages.map(stage => {
      if (stage.name.toLowerCase() === wsProgress.stage.toLowerCase()) {
        return {
          ...stage,
          status: 'in-progress' as StageStatus,
          progress: wsProgress.metadata?.stageProgress || wsProgress.progress,
          details: wsProgress.message
        }
      }
      // Mark previous stages as completed
      const stageIndex = localStages.findIndex(s => s.name.toLowerCase() === wsProgress.stage.toLowerCase())
      const currentIndex = localStages.findIndex(s => s.id === stage.id)
      if (currentIndex < stageIndex) {
        return {
          ...stage,
          status: 'completed' as StageStatus,
          progress: 100
        }
      }
      return stage
    })

    setLocalStages(updatedStages)
  }, [wsProgress, realtime])

  // Handle completion
  useEffect(() => {
    if (wsComplete && realtime) {
      const completedStages = localStages.map(stage => ({
        ...stage,
        status: 'completed' as StageStatus,
        progress: 100
      }))
      setLocalStages(completedStages)
      onComplete?.(wsProgress)
    }
  }, [wsComplete, realtime, onComplete])

  // Handle errors
  useEffect(() => {
    if (wsError && realtime) {
      const failedStages = localStages.map(stage => {
        if (stage.status === 'in-progress') {
          return {
            ...stage,
            status: 'failed' as StageStatus,
            error: wsError
          }
        }
        return stage
      })
      setLocalStages(failedStages)
      onError?.(wsError)
    }
  }, [wsError, realtime, onError])

  // Use local stages or initial stages
  const stages = realtime ? localStages : (initialStages || [])
  
  const overallProgress = getOverallProgress(stages)
  const currentStage = getCurrentStage(stages)
  const estimatedTimeRemaining = getTotalEstimatedTime(stages)
  const isComplete = stages.every(s => s.status === 'completed')
  const hasFailed = stages.some(s => s.status === 'failed')

  // Track elapsed time
  useEffect(() => {
    if (isComplete || hasFailed) return

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isComplete, hasFailed])

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                {realtime && jobId && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-blue-700">
                      Live
                    </span>
                  </div>
                )}
              </div>
              {currentStage && (
                <p className="text-sm text-gray-600 mt-1">
                  {currentStage.details || `${currentStage.name}...`}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {allowBackground && !isComplete && !hasFailed && onBackground && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackground}
                  className="flex items-center gap-1.5"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  Continue in Background
                </Button>
              )}
              
              {onCancel && !isComplete && !hasFailed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-gray-600"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall Progress</span>
              <div className="flex items-center gap-4">
                {!isComplete && !hasFailed && estimatedTimeRemaining > 0 && (
                  <span className="text-gray-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatTime(estimatedTimeRemaining)} remaining
                  </span>
                )}
                <span className="font-medium text-gray-900">
                  {overallProgress}%
                </span>
              </div>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Status Message */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Processing complete!
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  Completed in {formatTime(elapsedTime)}
                </p>
              </div>
            </motion.div>
          )}

          {hasFailed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    Processing failed
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {wsError || 'An error occurred during processing'}
                  </p>
                  
                  {/* Recovery Guidance */}
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-red-900">
                      What you can do:
                    </p>
                    <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                      <li>Check your file format and try again</li>
                      <li>Ensure the file is not corrupted</li>
                      <li>Try uploading a smaller file</li>
                      <li>Contact support if the issue persists</li>
                    </ul>
                  </div>

                  {/* Retry Button */}
                  {onCancel && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRetryCount(prev => prev + 1)
                          // Reset stages
                          setLocalStages(initialStages || [])
                          onCancel()
                        }}
                        className="text-red-700 border-red-300 hover:bg-red-100"
                      >
                        <RefreshCw className="w-3 h-3 mr-1.5" />
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Stages List */}
        <div className="space-y-0">
          {stages.map((stage, index) => (
            <StageItem
              key={stage.id}
              stage={stage}
              isLast={index === stages.length - 1}
              showDetails={showDetails}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default MultiStageProgress

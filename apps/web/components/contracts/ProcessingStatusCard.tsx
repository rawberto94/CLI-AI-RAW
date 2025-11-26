'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  FileText,
  Sparkles,
  Zap,
  Server
} from 'lucide-react'

interface ProcessingStatusCardProps {
  contractId: string
  onComplete?: () => void
  onError?: (error: string) => void
  pollInterval?: number
}

interface ProcessingStatus {
  contractId: string
  status: string
  currentStep: string
  currentStepName: string
  progress: number
  stageProgress: number
  timing: {
    elapsedMs: number
    elapsedFormatted: string
    estimatedRemainingMs: number
    estimatedRemainingFormatted: string
    processingDurationMs: number
    processingDurationFormatted: string
  }
  artifactsGenerated: number
  totalArtifacts: number
  artifactTypes: string[]
  hasOverview: boolean
  hasFinancial: boolean
  hasRisk: boolean
  hasCompliance: boolean
  hasClauses: boolean
  processingJob?: {
    id: string
    status: string
    queueId: string | null
    priority: number
    retryCount: number
    maxRetries: number
    lastError: string | null
  } | null
  error: string | null
}

const STAGES = [
  { key: 'upload', label: 'Upload', icon: FileText },
  { key: 'queued', label: 'Queued', icon: Server },
  { key: 'ocr', label: 'OCR', icon: FileText },
  { key: 'artifacts', label: 'AI Analysis', icon: Sparkles },
  { key: 'storage', label: 'Saving', icon: Zap },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
]

export function ProcessingStatusCard({
  contractId,
  onComplete,
  onError,
  pollInterval = 2000,
}: ProcessingStatusCardProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/status`)
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setStatus(data)
      setError(null)

      // Trigger callbacks
      if (data.status === 'COMPLETED' && onComplete) {
        onComplete()
      }
      if (data.status === 'FAILED' && onError && data.error) {
        onError(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Only poll if not complete or failed
    const interval = setInterval(() => {
      if (status?.status !== 'COMPLETED' && status?.status !== 'FAILED') {
        fetchStatus()
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [contractId, pollInterval, status?.status])

  if (loading && !status) {
    return (
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    )
  }

  if (error && !status) {
    return (
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm border-l-4 border-l-red-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="font-semibold text-gray-900">Failed to load status</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStatus} className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const isComplete = status.status === 'COMPLETED'
  const isFailed = status.status === 'FAILED'
  const isProcessing = status.status === 'PROCESSING' || status.status === 'UPLOADED'

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(s => s.key === status.currentStep)
  }

  const getStageStatus = (stageKey: string) => {
    const currentIndex = getCurrentStageIndex()
    const stageIndex = STAGES.findIndex(s => s.key === stageKey)
    
    if (isFailed) return 'error'
    if (stageIndex < currentIndex) return 'complete'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <Card className={`shadow-lg border-0 bg-white/80 backdrop-blur-sm border-l-4 ${
      isComplete ? 'border-l-green-500' :
      isFailed ? 'border-l-red-500' :
      'border-l-blue-500'
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {isFailed && <AlertCircle className="h-5 w-5 text-red-500" />}
            {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
            Processing Status
          </CardTitle>
          <div className="flex items-center gap-2">
            {isProcessing && status.timing && (
              <Badge variant="outline" className="font-mono text-xs">
                <Clock className="h-3 w-3 mr-1" />
                ~{status.timing.estimatedRemainingFormatted} remaining
              </Badge>
            )}
            <Badge className={
              isComplete ? 'bg-green-100 text-green-700' :
              isFailed ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            }>
              {status.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">{status.currentStepName}</span>
            <span className="text-gray-500">{status.progress}%</span>
          </div>
          <Progress value={status.progress} className="h-2" />
        </div>

        {/* Processing Stages */}
        <div className="flex items-center justify-between py-4">
          {STAGES.map((stage, index) => {
            const stageStatus = getStageStatus(stage.key)
            const Icon = stage.icon
            
            return (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`p-2 rounded-full transition-all ${
                    stageStatus === 'complete' ? 'bg-green-100' :
                    stageStatus === 'active' ? 'bg-blue-100 ring-2 ring-blue-400 ring-offset-2' :
                    stageStatus === 'error' ? 'bg-red-100' :
                    'bg-gray-100'
                  }`}>
                    {stageStatus === 'complete' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : stageStatus === 'active' ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : stageStatus === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Icon className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${
                    stageStatus === 'complete' ? 'text-green-700' :
                    stageStatus === 'active' ? 'text-blue-700' :
                    stageStatus === 'error' ? 'text-red-700' :
                    'text-gray-400'
                  }`}>
                    {stage.label}
                  </span>
                </div>
                
                {index < STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    getStageStatus(STAGES[index + 1]?.key ?? '') === 'pending' 
                      ? 'bg-gray-200' 
                      : 'bg-green-400'
                  }`} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Artifact Generation Progress */}
        {(status.currentStep === 'artifacts' || isComplete) && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">AI Artifacts</span>
              <span className="text-sm text-gray-500">
                {status.artifactsGenerated}/{status.totalArtifacts}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: 'overview', label: 'Overview', has: status.hasOverview },
                { key: 'financial', label: 'Financial', has: status.hasFinancial },
                { key: 'risk', label: 'Risk', has: status.hasRisk },
                { key: 'compliance', label: 'Compliance', has: status.hasCompliance },
                { key: 'clauses', label: 'Clauses', has: status.hasClauses },
              ].map(artifact => (
                <div 
                  key={artifact.key}
                  className={`p-2 rounded text-center text-xs font-medium transition-all ${
                    artifact.has 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {artifact.has && <CheckCircle2 className="h-3 w-3 mx-auto mb-1" />}
                  {artifact.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timing Details */}
        {status.timing && (
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-gray-500 text-xs">Elapsed</p>
              <p className="font-semibold text-blue-700">{status.timing.elapsedFormatted}</p>
            </div>
            {isProcessing && (
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Remaining</p>
                <p className="font-semibold text-orange-700">{status.timing.estimatedRemainingFormatted}</p>
              </div>
            )}
            {isComplete && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Total Time</p>
                <p className="font-semibold text-green-700">{status.timing.processingDurationFormatted}</p>
              </div>
            )}
            {status.processingJob && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Priority</p>
                <p className="font-semibold text-purple-700">
                  {status.processingJob.priority <= 5 ? 'High' :
                   status.processingJob.priority <= 10 ? 'Normal' :
                   status.processingJob.priority <= 20 ? 'Low' : 'Background'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Details */}
        {isFailed && status.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Processing Failed</p>
                <p className="text-sm text-red-600 mt-1">{status.error}</p>
                {status.processingJob && status.processingJob.retryCount > 0 && (
                  <p className="text-xs text-red-500 mt-2">
                    Retried {status.processingJob.retryCount}/{status.processingJob.maxRetries} times
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

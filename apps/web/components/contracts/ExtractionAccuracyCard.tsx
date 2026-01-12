'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Loader2,
  Sparkles,
  Info,
  BarChart3,
  Target,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ============ TYPES ============

interface ExtractionFieldProps {
  contractId: string
  fieldName: string
  fieldLabel: string
  extractedValue: unknown
  confidence: number
  source?: string
  onFeedback?: (isCorrect: boolean, correctedValue?: unknown) => void
}

interface ExtractionAccuracyCardProps {
  contractId: string
  className?: string
  fields?: Array<{
    name: string
    label: string
    value: unknown
    confidence: number
    source?: string
  }>
  onUpdate?: () => void
}

interface AccuracyStats {
  overall: {
    accuracy: number
    trend: 'improving' | 'stable' | 'declining'
    totalContracts: number
    totalCorrections: number
  }
  problematicFields: Array<{
    field: string
    corrections: number
    accuracy: number
  }>
  recommendations: string[]
}

// ============ HELPER COMPONENTS ============

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  const getColor = () => {
    if (confidence >= 90) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    if (confidence >= 70) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    if (confidence >= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }

  const getIcon = () => {
    if (confidence >= 90) return <CheckCircle2 className="h-3 w-3" />
    if (confidence >= 70) return <Brain className="h-3 w-3" />
    if (confidence >= 50) return <AlertTriangle className="h-3 w-3" />
    return <XCircle className="h-3 w-3" />
  }

  return (
    <Badge variant="secondary" className={cn('text-xs gap-1', getColor())}>
      {getIcon()}
      {confidence}%
    </Badge>
  )
}

const TrendIndicator = ({ trend }: { trend: 'improving' | 'stable' | 'declining' }) => {
  const config = {
    improving: { icon: TrendingUp, color: 'text-emerald-600', label: 'Improving' },
    stable: { icon: Minus, color: 'text-slate-500', label: 'Stable' },
    declining: { icon: TrendingDown, color: 'text-red-600', label: 'Declining' },
  }
  const { icon: Icon, color, label } = config[trend]
  
  return (
    <div className={cn('flex items-center gap-1 text-sm', color)}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  )
}

// ============ EXTRACTION FIELD WITH FEEDBACK ============

export function ExtractionFieldWithFeedback({
  contractId,
  fieldName,
  fieldLabel,
  extractedValue,
  confidence,
  source,
  onFeedback,
}: ExtractionFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [correctedValue, setCorrectedValue] = useState(String(extractedValue || ''))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'correct' | 'incorrect' | null>(null)

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await fetch(`/api/contracts/${contractId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType: 'confirmation',
          fields: [{
            fieldName,
            originalValue: extractedValue,
            extractionConfidence: confidence,
            extractionSource: source || 'ai',
            wasCorrect: true,
          }],
        }),
      })
      setFeedbackGiven('correct')
      onFeedback?.(true)
      toast.success('Thanks! Your feedback helps improve accuracy.')
    } catch {
      toast.error('Failed to record feedback')
    } finally {
      setIsSubmitting(false)
    }
  }, [contractId, fieldName, extractedValue, confidence, source, onFeedback])

  const handleCorrection = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await fetch(`/api/contracts/${contractId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType: 'correction',
          fields: [{
            fieldName,
            originalValue: extractedValue,
            correctedValue,
            extractionConfidence: confidence,
            extractionSource: source || 'ai',
            wasCorrect: false,
          }],
        }),
      })
      setFeedbackGiven('incorrect')
      setIsEditing(false)
      onFeedback?.(false, correctedValue)
      toast.success('Correction recorded! This helps improve future extractions.')
    } catch {
      toast.error('Failed to record correction')
    } finally {
      setIsSubmitting(false)
    }
  }, [contractId, fieldName, extractedValue, correctedValue, confidence, source, onFeedback])

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {fieldLabel}
          </span>
          <ConfidenceBadge confidence={confidence} />
          {feedbackGiven && (
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs',
                feedbackGiven === 'correct' 
                  ? 'border-emerald-300 text-emerald-600' 
                  : 'border-amber-300 text-amber-600'
              )}
            >
              {feedbackGiven === 'correct' ? 'Confirmed' : 'Corrected'}
            </Badge>
          )}
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2 mt-2">
            <Input
              value={correctedValue}
              onChange={(e) => setCorrectedValue(e.target.value)}
              placeholder="Enter correct value"
              className="h-8 text-sm"
            />
            <Button 
              size="sm" 
              onClick={handleCorrection}
              disabled={isSubmitting}
              className="h-8"
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => {
                setIsEditing(false)
                setCorrectedValue(String(extractedValue || ''))
              }}
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {String(extractedValue) || <span className="italic text-slate-400">Not extracted</span>}
          </p>
        )}
      </div>

      {!feedbackGiven && !isEditing && (
        <div className="flex items-center gap-1 ml-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Confirm this is correct</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Correct this value</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}

// ============ MAIN ACCURACY CARD ============

export function ExtractionAccuracyCard({
  contractId,
  className,
  fields: propsFields,
  onUpdate,
}: ExtractionAccuracyCardProps) {
  const [stats, setStats] = useState<AccuracyStats | null>(null)
  const [fields, setFields] = useState(propsFields || [])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('fields')

  // Fetch real confidence data from API
  const fetchConfidence = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/extraction-confidence`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.fields) {
          setFields(data.data.fields)
        }
      }
    } catch {
      // Fall back to props fields if API fails
      if (propsFields) setFields(propsFields)
    }
  }, [contractId, propsFields])

  // Fetch accuracy stats
  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/extraction/accuracy')
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch {
      console.warn('Could not fetch accuracy stats')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchConfidence()
    fetchStats()
  }, [fetchConfidence, fetchStats])

  const handleFieldFeedback = useCallback((isCorrect: boolean, correctedValue?: unknown) => {
    // Refresh stats after feedback
    fetchConfidence()
    fetchStats()
    onUpdate?.()
  }, [fetchConfidence, fetchStats, onUpdate])

  // Calculate overall confidence from fields
  const avgConfidence = fields && fields.length > 0
    ? Math.round(fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length)
    : 0

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">AI Extraction Quality</CardTitle>
              <CardDescription className="text-xs">
                Help improve accuracy by confirming or correcting extractions
              </CardDescription>
            </div>
          </div>
          
          {stats?.overall && (
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                {stats.overall.accuracy}%
              </div>
              <TrendIndicator trend={stats.overall.trend} />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-3">
            <TabsTrigger value="fields" className="flex-1 gap-1 text-xs">
              <Target className="h-3 w-3" />
              Fields
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="flex-1 gap-1 text-xs">
              <BarChart3 className="h-3 w-3" />
              Accuracy
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex-1 gap-1 text-xs">
              <BookOpen className="h-3 w-3" />
              Learning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="mt-0 space-y-2">
            {fields && fields.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                  <span>Average confidence: {avgConfidence}%</span>
                  <span>{fields.length} fields extracted</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fields.map((field) => (
                    <ExtractionFieldWithFeedback
                      key={field.name}
                      contractId={contractId}
                      fieldName={field.name}
                      fieldLabel={field.label}
                      extractedValue={field.value}
                      confidence={field.confidence}
                      source={field.source}
                      onFeedback={handleFieldFeedback}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No extracted fields to review</p>
                <p className="text-xs">Run AI extraction to see results here</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="accuracy" className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stats?.overall ? (
              <div className="space-y-4">
                {/* Overall accuracy */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Accuracy</span>
                    <span className="text-lg font-bold">{stats.overall.accuracy}%</span>
                  </div>
                  <Progress value={stats.overall.accuracy} className="h-2" />
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{stats.overall.totalContracts} contracts processed</span>
                    <span>{stats.overall.totalCorrections} corrections made</span>
                  </div>
                </div>

                {/* Problematic fields */}
                {stats.problematicFields.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Fields Needing Attention
                    </h4>
                    <div className="space-y-1.5">
                      {stats.problematicFields.map((field) => (
                        <div 
                          key={field.field}
                          className="flex items-center justify-between text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/20"
                        >
                          <span className="text-slate-700 dark:text-slate-300">{field.field}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-600">{field.corrections} corrections</span>
                            <Badge variant="outline" className="text-xs">
                              {field.accuracy}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {stats.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Info className="h-3.5 w-3.5 text-blue-500" />
                      Recommendations
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {stats.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-blue-500">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No accuracy data available yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="learning" className="mt-0">
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
                    Continuous Learning Active
                  </span>
                </div>
                <p className="text-xs text-violet-700 dark:text-violet-400">
                  Every correction you make helps the AI improve. ConTigo learns from your feedback to:
                </p>
                <ul className="text-xs text-violet-600 dark:text-violet-400 mt-2 space-y-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Calibrate confidence scores based on accuracy
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Detect and avoid common extraction errors
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Use successful examples for few-shot learning
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Adapt prompts based on contract types
                  </li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground">
                <p className="mb-2">
                  <strong>How it works:</strong> When you confirm or correct an extraction, 
                  the system records the pattern. After enough examples (usually 5+), 
                  the AI automatically adjusts its extraction strategy.
                </p>
                <p>
                  <strong>Privacy:</strong> Learning is tenant-isolated. Your corrections 
                  only improve extractions for your organization.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default ExtractionAccuracyCard

'use client'

/**
 * ArtifactFeedback — Reusable feedback/rating/verification UI for artifacts.
 * 
 * Provides:
 * - 1-5 star rating
 * - Free-text feedback notes
 * - User verification toggle
 * - Per-artifact regenerate button
 * - Per-artifact export (JSON/CSV)
 */

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Star,
  CheckCircle2,
  RefreshCw,
  Download,
  MessageSquare,
  X,
  Send,
  ShieldCheck,
  Loader2,
} from 'lucide-react'

interface ArtifactFeedbackProps {
  contractId: string
  artifactId: string
  artifactType: string
  tenantId?: string
  initialRating?: number | null
  initialNotes?: string | null
  initialVerified?: boolean
  onRegenerate?: () => void
  className?: string
}

export function ArtifactFeedback({
  contractId,
  artifactId,
  artifactType,
  tenantId = 'demo',
  initialRating = null,
  initialNotes = null,
  initialVerified = false,
  onRegenerate,
  className,
}: ArtifactFeedbackProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(initialNotes || '')
  const [isVerified, setIsVerified] = useState(initialVerified)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const submitFeedback = useCallback(async (data: {
    rating?: number
    notes?: string
    verified?: boolean
  }) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            userId: 'current-user', // In production, pull from auth context
          }),
        }
      )
      if (!res.ok) {
        throw new Error('Failed to submit feedback')
      }
      toast.success('Feedback saved')
    } catch {
      toast.error('Failed to save feedback')
    } finally {
      setIsSubmitting(false)
    }
  }, [contractId, artifactId])

  const handleRating = useCallback((star: number) => {
    setRating(star)
    submitFeedback({ rating: star })
  }, [submitFeedback])

  const handleVerify = useCallback(() => {
    const newValue = !isVerified
    setIsVerified(newValue)
    submitFeedback({ verified: newValue })
  }, [isVerified, submitFeedback])

  const handleSubmitNotes = useCallback(() => {
    if (notes.trim()) {
      submitFeedback({ notes: notes.trim() })
      setShowNotes(false)
    }
  }, [notes, submitFeedback])

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true)
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/artifacts/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactType,
            tenantId,
          }),
        }
      )
      if (!res.ok) throw new Error('Regeneration failed')
      toast.success('Artifact regeneration started')
      onRegenerate?.()
    } catch {
      toast.error('Failed to regenerate artifact')
    } finally {
      setIsRegenerating(false)
    }
  }, [contractId, artifactType, tenantId, onRegenerate])

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifactId}/export?format=${format}`
      )
      if (!res.ok) throw new Error('Export failed')
      
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `artifact_${artifactType.toLowerCase()}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }, [contractId, artifactId, artifactType])

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {/* Star Rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(null)}
            disabled={isSubmitting}
            className="p-0.5 transition-colors"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={cn(
                'h-4 w-4 transition-colors',
                (hoveredStar !== null ? star <= hoveredStar : star <= (rating || 0))
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300 hover:text-amber-200'
              )}
            />
          </button>
        ))}
        {rating && (
          <span className="text-xs text-gray-500 ml-1">{rating}/5</span>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-gray-200" />

      {/* Verify Button */}
      <Button
        variant={isVerified ? 'default' : 'outline'}
        size="sm"
        onClick={handleVerify}
        disabled={isSubmitting}
        className={cn(
          'gap-1.5 h-7 text-xs',
          isVerified && 'bg-green-600 hover:bg-green-700 text-white'
        )}
      >
        {isVerified ? (
          <>
            <ShieldCheck className="h-3 w-3" />
            Verified
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Verify
          </>
        )}
      </Button>

      {/* Feedback Notes Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowNotes(!showNotes)}
        className="gap-1.5 h-7 text-xs"
      >
        <MessageSquare className="h-3 w-3" />
        Notes
      </Button>

      {/* Regenerate */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={isRegenerating}
        className="gap-1.5 h-7 text-xs"
      >
        {isRegenerating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        Regenerate
      </Button>

      {/* Export Dropdown */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport('json')}
          className="gap-1.5 h-7 text-xs"
        >
          <Download className="h-3 w-3" />
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport('csv')}
          className="gap-1.5 h-7 text-xs"
        >
          CSV
        </Button>
      </div>

      {/* Notes Input */}
      {showNotes && (
        <div className="w-full flex gap-2 mt-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add feedback notes..."
            className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            onKeyDown={e => e.key === 'Enter' && handleSubmitNotes()}
          />
          <Button
            variant="default"
            size="sm"
            onClick={handleSubmitNotes}
            disabled={!notes.trim() || isSubmitting}
            className="h-8"
          >
            {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(false)}
            className="h-8"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

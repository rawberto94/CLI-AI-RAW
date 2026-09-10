'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface AnalysisPackSummary {
  originalChars?: number
  packedChars?: number
  omitted?: string[]
  kept?: string[]
  analysisLanguage?: string | null
}

const ANALYSIS_LANGUAGE_LABEL: Record<string, string> = {
  de: 'German',
  fr: 'French',
  it: 'Italian',
  en: 'English',
  german: 'German',
  french: 'French',
  italian: 'Italian',
  english: 'English',
}

export function AnalysisCoverageChip({
  pack,
  ocrNeedsReview,
  analysisLanguage,
  scanType,
}: {
  pack?: AnalysisPackSummary | null
  ocrNeedsReview?: boolean
  analysisLanguage?: string | null
  scanType?: 'native' | 'scanned' | 'mixed' | string | null
}) {
  const omitted = Array.isArray(pack?.omitted) ? pack!.omitted.filter(Boolean) : []
  const langKey = (analysisLanguage || pack?.analysisLanguage || '').trim().toLowerCase()
  const langLabel = langKey ? ANALYSIS_LANGUAGE_LABEL[langKey] || analysisLanguage || pack?.analysisLanguage : null
  const scanned = scanType === 'scanned' || scanType === 'mixed'
  if (!pack && !ocrNeedsReview && !langLabel && !scanned) return null

  const packed = pack?.packedChars
  const original = pack?.originalChars
  const ratio =
    typeof packed === 'number' && typeof original === 'number' && original > 0
      ? Math.round((packed / original) * 100)
      : null

  const coverageLabel = ocrNeedsReview || scanned
    ? scanned
      ? 'Scanned document — verify OCR'
      : 'OCR needs review'
    : omitted.length > 0
      ? `${omitted.length} section${omitted.length === 1 ? '' : 's'} skipped`
      : pack
        ? 'Full document analyzed'
        : null
  const label = [langLabel && langLabel !== 'English' ? `Analysis in ${langLabel}` : null, coverageLabel]
    .filter(Boolean)
    .join(' · ') || 'Analysis coverage'

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
            aria-label={`Analysis coverage: ${label}`}
          >
            <Info className="h-3 w-3" />
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {langLabel && langLabel !== 'English' && (
            <p className="mb-1">
              Narrative analysis is in {langLabel}. Quotes stay in the contract&apos;s original wording.
            </p>
          )}
          {(ocrNeedsReview || scanned) && (
            <p className="mb-1">
              {scanned
                ? 'This looks like a scanned PDF. Dates, amounts, and party names should be checked against the original.'
                : 'OCR confidence is low — numbers and names should be checked against the PDF.'}
            </p>
          )}
          {ratio != null && (
            <p>
              Model read {ratio}% of extracted text ({packed!.toLocaleString()} of {original!.toLocaleString()} characters).
            </p>
          )}
          {omitted.length > 0 ? (
            <p className="mt-1">
              Skipped low-value material: {omitted.slice(0, 8).join('; ')}.
            </p>
          ) : (
            <p className="mt-1">Table of contents, blank pages, and marketing exhibits are dropped when present.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

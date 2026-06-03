'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDataMode } from '@/contexts/DataModeContext'
import { useDemoMode } from '@/hooks/useDemoMode'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'
import { EnhancedUploadProgress } from '@/components/contracts/upload'
import type { ProcessingOptions } from '@/components/contracts/upload/ProcessingConfig'
import {
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  ChevronRight,
} from 'lucide-react'
import { getTenantId } from '@/lib/tenant'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import Link from 'next/link'

import { UploadDropZone } from './components'
import { UploadMetadataReviewDialog } from './components'
import { generateUUID } from '@/lib/utils'

// ── Types & Utilities ────────────────────────────────────────────────────────

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  contractId?: string
  error?: string
  processingStage?: string
  showArtifacts?: boolean
  isDuplicate?: boolean
  existingContractId?: string
  versionNumber?: number
  startTime?: number
  endTime?: number
  skipDuplicateCheck?: boolean
}

interface UploadMetadataReviewItem {
  fileId: string
  contractId: string
  fileName: string
}

const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  aiModel: 'azure-ch',
  processingMode: 'standard',
  concurrency: 2,
  enabledArtifacts: [
    'OVERVIEW', 'CLAUSES', 'FINANCIAL', 'RISK', 'COMPLIANCE',
    'OBLIGATIONS', 'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS',
  ],
  enableRagIndexing: true,
  enableRateCardExtraction: true,
  enableDuplicateDetection: true,
  prioritizeRiskAnalysis: false,
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function UploadPage() {
  const isDemo = useDemoMode()
  const router = useRouter()
  const { dataMode } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)
  const [processingOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS)
  const [isMounted, setIsMounted] = useState(false)
  const [shouldAutoStart, setShouldAutoStart] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<UploadMetadataReviewItem[]>([])
  const [activeReview, setActiveReview] = useState<UploadMetadataReviewItem | null>(null)
  const [skipAllMetadataReview, setSkipAllMetadataReview] = useState(false)

  // Clear stale HMR state on mount + cleanup on unmount
  useEffect(() => {
    setFiles([])
    setIsUploading(false)
    setIsMounted(true)
    setReviewQueue([])
    setActiveReview(null)
    setSkipAllMetadataReview(false)
    const cleanupSessionKeys = () => {
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (key.startsWith('artifact-stream-') || key.startsWith('artifact-complete-') || key.startsWith('artifact-notfound-') || key.startsWith('valid-contract-'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key))
      }
    }
    cleanupSessionKeys()
    return () => cleanupSessionKeys()
  }, [])

  // ── File callbacks ──────────────────────────────────────────────────────

  const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB
  const ACCEPTED_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/csv', 'text/markdown',
    'application/json', 'application/xml', 'text/xml',
    'application/rtf',
  ])
  const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.xml', '.rtf', '.html', '.htm'])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSkipAllMetadataReview(false)

    const validFiles: File[] = []
    for (const file of acceptedFiles) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 100 MB size limit`)
        continue
      }
      if (!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
        toast.error(`${file.name}: unsupported file type. Use PDF, DOCX, TXT, CSV, or other text formats.`)
        continue
      }
      validFiles.push(file)
    }
    if (validFiles.length === 0) return

    const newFiles: UploadFile[] = validFiles.map(file => ({
      id: generateUUID(),
      file,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    }))
    setFiles(prev => [...prev, ...newFiles])
    setShouldAutoStart(true)
  }, [])

  const queueMetadataReview = useCallback((fileId: string, contractId?: string, nextFileName?: string) => {
    if (!contractId || !nextFileName || skipAllMetadataReview) return

    setReviewQueue(prev => {
      if (activeReview?.contractId === contractId || prev.some(item => item.contractId === contractId)) {
        return prev
      }

      return [...prev, { fileId, contractId, fileName: nextFileName }]
    })
  }, [activeReview?.contractId, skipAllMetadataReview])

  const uploadFile = async (uploadFile: UploadFile, skipDuplicateCheck = false) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('dataMode', dataMode)
    formData.append('ocrMode', processingOptions.aiModel)
    formData.append('processingMode', processingOptions.processingMode)

    try {
      // Update to uploading with 0% progress
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 0, processingStage: 'Uploading file...', isDuplicate: false }
          : f
      ))

      // Check for pause before proceeding
      if (isPausedRef.current) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'pending', progress: 0 } : f
        ))
        return
      }

      // Upload file - skip duplicate check if re-processing
      const headers: Record<string, string> = {
        'x-tenant-id': getTenantId(),
        'x-data-mode': dataMode
      }
      if (skipDuplicateCheck) {
        headers['x-skip-duplicate-check'] = 'true'
      }
      // XHR bypasses the global fetch CSRF interceptor — attach token manually.
      // Use indexOf to avoid truncating base64 tokens that contain '=' padding.
      const csrfCookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('csrf_token='))
      if (csrfCookie) {
        const eqIdx = csrfCookie.indexOf('=')
        headers['x-csrf-token'] = decodeURIComponent(csrfCookie.slice(eqIdx + 1))
      }
      
      // Adaptive timeout: 30s base + 30s per 10MB (e.g., 100MB file → 330s)
      const MB = 1024 * 1024
      const timeoutMs = Math.max(30_000, 30_000 + Math.ceil(uploadFile.file.size / (10 * MB)) * 30_000)
      
      // Use XMLHttpRequest for real upload progress tracking
      const { responseData, status: httpStatus } = await new Promise<{ responseData: Record<string, unknown>; status: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const timer = setTimeout(() => {
          xhr.abort()
          reject(new DOMException('Upload timed out. The server took too long to respond. Please try again.', 'AbortError'))
        }, timeoutMs)

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setFiles(prev => prev.map(f =>
              f.id === uploadFile.id ? { ...f, progress: pct, processingStage: `Uploading... ${pct}%` } : f
            ))
          }
        })

        xhr.addEventListener('load', () => {
          clearTimeout(timer)
          try {
            const data = JSON.parse(xhr.responseText)
            resolve({ responseData: data, status: xhr.status })
          } catch {
            reject(new Error('Invalid server response'))
          }
        })
        xhr.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Network error during upload')) })
        xhr.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Upload was cancelled', 'AbortError')) })

        xhr.open('POST', '/api/contracts/upload')
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
        xhr.send(formData)
      })
      
      const uploadResponse = { ok: httpStatus >= 200 && httpStatus < 300, status: httpStatus }
      
      if (!uploadResponse.ok) {
        const err = (responseData.error || {}) as Record<string, string>;
        const errorMessage = typeof err === 'string' ? err
          : err.details ? `${err.message}: ${err.details}`
          : (err.message || 'Upload failed');
        throw new Error(errorMessage);
      }

      // API wraps response in { success, data, meta } envelope
      const result = (responseData.data ?? responseData) as Record<string, unknown>;

      // Check for duplicate/version registration response
      if (result.isDuplicate && !skipDuplicateCheck) {
        const versionNumber = typeof result.versionNumber === 'number'
          ? result.versionNumber
          : (result.version && typeof result.version === 'object' && 'versionNumber' in result.version
            ? (result.version as { versionNumber?: number }).versionNumber
            : undefined)

        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { 
                ...f, 
                status: 'completed', 
                progress: 100, 
                contractId: result.contractId as string | undefined,
                isDuplicate: true,
                existingContractId: result.contractId as string | undefined,
                versionNumber,
                processingStage: versionNumber ? `Registered as v${versionNumber}` : 'Duplicate detected',
                endTime: Date.now(),
              }
            : f
        ))
        toast.success(
          versionNumber
            ? `${uploadFile.file.name} registered as v${versionNumber}`
            : `${uploadFile.file.name} is a duplicate`,
          {
          description: versionNumber
            ? 'The duplicate file was added to the existing contract version history.'
            : 'No new copy was created. Open the existing contract or upload it as a fresh analysis.',
          action: {
            label: 'View contract',
            onClick: () => router.push(`/contracts/${result.contractId}`),
          },
          duration: 8000,
        });
        return
      }

      const contractId = result.contractId as string | undefined
      
      logger.info('upload_contract_assigned', { contractId, fileName: uploadFile.file.name });

      // Check if queue was triggered successfully
      if (result.queueTriggered === false) {
        // Upload succeeded but processing couldn't start — show warning, don't pretend it's processing
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, status: 'completed', progress: 100, contractId, endTime: Date.now(), processingStage: 'Uploaded (processing pending)' }
            : f
        ))
        toast.warning(`${uploadFile.file.name} uploaded`, {
          description: 'File saved but AI processing could not start. You can trigger it later.',
          action: {
            label: 'View',
            onClick: () => router.push(`/contracts/${contractId}`),
          },
          duration: 8000,
        })
        return
      }

      // Update to processing with artifact viewer enabled
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'processing', progress: 20, contractId, processingStage: 'Processing with AI...', showArtifacts: true }
          : f
      ))

      // Note: Real-time SSE will handle the rest of the progress updates
      // The RealtimeArtifactViewer component will show live artifact generation

    } catch (error: unknown) {
      const errorMsg = error instanceof Error
        ? error.name === 'AbortError'
          ? error.message || 'Upload timed out. Please try again.'
          : error.message
        : 'Upload failed. Please try again.';
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { 
              ...f, 
              status: 'error', 
              error: errorMsg,
              endTime: Date.now()
            }
          : f
      ))
      toast.error(`Upload failed: ${uploadFile.file.name}`, {
        description: errorMsg,
        action: {
          label: 'Retry',
          onClick: () => retryFile(uploadFile.id),
        },
      });
    }
  }

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true)
    setIsPaused(false)
    isPausedRef.current = false
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    // Process files with concurrency limit
    const concurrency = processingOptions.concurrency
    for (let i = 0; i < pendingFiles.length; i += concurrency) {
      if (isPausedRef.current) break
      
      const batch = pendingFiles.slice(i, i + concurrency)
      // Pass skipDuplicateCheck flag if set (for re-processing)
      await Promise.all(batch.map(file => uploadFile(file, file.skipDuplicateCheck)))
    }
    
    setIsUploading(false)
  }, [files, processingOptions.concurrency])

  // Auto-start upload effect (must be after handleUploadAll is defined)
  useEffect(() => {
    if (shouldAutoStart && !isUploading && files.some(f => f.status === 'pending')) {
      setShouldAutoStart(false)
      // Small delay to ensure state is updated
      const timer = setTimeout(() => {
        handleUploadAll()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAutoStart, isUploading, files, handleUploadAll])

  const handlePauseAll = useCallback(() => {
    setIsPaused(true)
    isPausedRef.current = true
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const retryFile = useCallback((id: string) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined, isDuplicate: false, existingContractId: undefined, skipDuplicateCheck: true } : f
    ))
    setShouldAutoStart(true)
  }, [])

  const clearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'))
  }, [])
  
  const retryAllErrors = useCallback(async () => {
    const errorFiles = files.filter(f => f.status === 'error')
    if (errorFiles.length === 0) return
    
    // Reset all error files to pending with skipDuplicateCheck
    // (partially uploaded files may trigger duplicate detection on retry)
    setFiles(prev => prev.map(f =>
      f.status === 'error' ? { ...f, status: 'pending', progress: 0, error: undefined, skipDuplicateCheck: true } : f
    ))
    
    // Start upload process
    await handleUploadAll()
  }, [files, handleUploadAll])

  const viewContract = useCallback((contractId: string) => { router.push(`/contracts/${contractId}`) }, [router])

  const dismissActiveReview = useCallback(() => {
    setActiveReview(null)
  }, [])

  const startMetadataReview = useCallback(() => {
    if (activeReview) return

    setReviewQueue(prev => {
      const [nextReview, ...remaining] = prev
      if (!nextReview) return prev
      setActiveReview(nextReview)
      return remaining
    })
  }, [activeReview])

  const handleSkipAllMetadataReview = useCallback(() => {
    setSkipAllMetadataReview(true)
    setReviewQueue([])
    setActiveReview(null)
    toast.info('Skipping metadata review for the rest of this upload batch.')
  }, [])

  // ── Derived state ───────────────────────────────────────────────────────
  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length
  const processingCount = files.filter(f => ['uploading', 'processing'].includes(f.status)).length
  const hasFiles = files.length > 0
  const queueTitle = processingCount > 0
    ? `Processing ${processingCount} file${processingCount !== 1 ? 's' : ''}`
    : pendingCount > 0
      ? `${pendingCount} file${pendingCount !== 1 ? 's' : ''} ready`
      : completedCount > 0
        ? `${completedCount} completed`
        : errorCount > 0
          ? `${errorCount} failed`
          : 'Upload queue'
  const queueSubtitle = processingCount > 0
    ? 'Extraction, AI analysis, and artifact generation are running now.'
    : pendingCount > 0
      ? 'Review the files in queue, then start the pipeline when ready.'
      : completedCount > 0
        ? 'Processed contracts stay here until you clear them from the queue.'
        : 'Retry failed uploads or remove them from the current batch.'
  const queueProgress = files.length > 0 ? ((completedCount + errorCount) / files.length) * 100 : 0

  // ── Batch completion notification ───────────────────────────────────────
  const batchCompleteRef = useRef(false)
  useEffect(() => {
    if (files.length === 0) {
      batchCompleteRef.current = false
      return
    }
    if (processingCount > 0 || pendingCount > 0) {
      batchCompleteRef.current = false
      return
    }
    // All files settled (completed or error)
    if (batchCompleteRef.current) return
    batchCompleteRef.current = true

    if (completedCount > 0 && errorCount === 0) {
      const completedFiles = files.filter(f => f.status === 'completed')
      const singleContractId = completedFiles.length === 1 ? completedFiles[0].contractId : null
      toast.success(`All ${completedCount} file${completedCount !== 1 ? 's' : ''} processed successfully`, {
        description: 'AI analysis is complete. Metadata reviews are waiting in the review queue.',
        action: { label: singleContractId ? 'View Contract' : 'View Contracts', onClick: () => router.push(singleContractId ? `/contracts/${singleContractId}` : '/contracts?sort=newest') },
        duration: 8000,
      })
    } else if (completedCount > 0 && errorCount > 0) {
      toast.warning(`${completedCount} succeeded, ${errorCount} failed`, {
        description: 'Completed files can still be reviewed; failed files remain in the queue for retry.',
        duration: 8000,
      })
    }
  }, [files.length, processingCount, pendingCount, completedCount, errorCount, router])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Upload Contracts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Drop files to start AI-powered analysis</p>
          </div>
          <Link href="/contracts">
            <Button variant="outline" size="sm" className="gap-1">
              All Contracts
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Drop Zone */}
        <UploadDropZone onDrop={onDrop} disabled={isUploading} />

        {!isDemo && reviewQueue.length > 0 && !activeReview && !skipAllMetadataReview && (
          <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    {reviewQueue.length} metadata review{reviewQueue.length === 1 ? '' : 's'} ready
                  </div>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-200">
                    Analysis has finished. Review extracted parties, dates, value, and signature details when you are ready.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reviewQueue.slice(0, 3).map((item) => (
                      <span key={item.contractId} className="max-w-[220px] truncate rounded-full border border-blue-200 bg-white/80 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200" title={item.fileName}>
                        {item.fileName}
                      </span>
                    ))}
                    {reviewQueue.length > 3 && (
                      <span className="rounded-full border border-blue-200 bg-white/80 px-2 py-0.5 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                        +{reviewQueue.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleSkipAllMetadataReview} className="text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/40">
                    Skip reviews
                  </Button>
                  <Button size="sm" onClick={startMetadataReview} className="bg-blue-700 text-white hover:bg-blue-800">
                    Review next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* File Queue */}
        {hasFiles && (
          <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-[0_24px_60px_-36px_rgba(79,70,229,0.4)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90">
            <CardHeader className="border-b border-slate-100/80 bg-[radial-gradient(circle_at_top_left,rgba(241,245,249,0.9),rgba(245,243,255,0.95),rgba(255,255,255,1))] pb-4 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.96),rgba(67,56,202,0.18),rgba(15,23,42,1))]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600/80 dark:text-violet-300/80">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Contract Processing
                  </div>
                  <CardTitle className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {queueTitle}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {queueSubtitle}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    {processingCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                        {processingCount} active
                      </div>
                    )}
                    {pendingCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Play className="h-3 w-3" aria-hidden="true" />
                        {pendingCount} queued
                      </div>
                    )}
                    {completedCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {completedCount} ready
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {errorCount} failed
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isDemo && completedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted} className="h-9 rounded-full gap-1 px-3 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear Done
                    </Button>
                  )}
                  {pendingCount > 0 && !isUploading && (
                    <Button onClick={handleUploadAll} size="sm" className="h-9 rounded-full gap-1 px-4">
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Upload All ({pendingCount})
                    </Button>
                  )}
                  {!isDemo && isUploading && !isPaused && (
                    <Button onClick={handlePauseAll} variant="outline" size="sm" className="h-9 rounded-full gap-1 px-4">
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      Pause
                    </Button>
                  )}
                  {!isDemo && isPaused && (
                    <Button onClick={handleUploadAll} size="sm" className="h-9 rounded-full gap-1 px-4">
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>
              {files.length > 1 && (processingCount > 0 || completedCount > 0 || errorCount > 0) && (
                <div className="mt-1 rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{completedCount + errorCount} of {files.length}{errorCount > 0 ? ` (${errorCount} failed)` : ''}</span>
                    <span>{Math.round(queueProgress)}%</span>
                  </div>
                  <Progress value={queueProgress} className="h-2 bg-slate-100 dark:bg-slate-800" />
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 bg-slate-50/40 pt-4 dark:bg-slate-950/20">
              <AnimatePresence mode="popLayout">
                {isMounted && files.map((file, index) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <EnhancedUploadProgress
                      fileId={file.id}
                      fileName={file.file.name}
                      fileSize={file.file.size}
                      contractId={file.contractId}
                      status={file.status}
                      error={file.error}
                      isDuplicate={file.isDuplicate}
                      existingContractId={file.existingContractId}
                      versionNumber={file.versionNumber}
                      onRetry={() => retryFile(file.id)}
                      onRemove={() => removeFile(file.id)}
                      onViewContract={viewContract}
                      onContractNotFound={() => {
                        logger.warn('upload_contract_not_found', { fileId: file.id });
                        setFiles(prev => prev.map(f =>
                          f.id === file.id
                            ? { ...f, status: 'error', error: 'Contract not found. Please try uploading again.', endTime: Date.now() }
                            : f
                        ));
                      }}
                      onComplete={() => {
                        setFiles(prev => prev.map(f =>
                          f.id === file.id
                            ? { ...f, status: 'completed', progress: 100, endTime: Date.now() }
                            : f
                        ));
                        toast.success(`${file.file.name} ready`, {
                          description: 'AI analysis complete. Metadata review was added to the review queue.',
                          action: file.contractId ? {
                            label: 'View',
                            onClick: () => router.push(`/contracts/${file.contractId}`),
                          } : undefined,
                          duration: 5000,
                        });
                        queueMetadataReview(file.id, file.contractId, file.file.name)
                      }}
                      tenantId={getTenantId()}
                    />
                    {file.contractId && file.status === 'processing' && file.showArtifacts && (
                      <div className="mt-3">
                        <RealtimeArtifactViewer
                          contractId={file.contractId}
                          tenantId={getTenantId()}
                          onComplete={() => {
                            setFiles(prev => prev.map(f =>
                              f.id === file.id
                                ? { ...f, status: 'completed', progress: 100, endTime: Date.now() }
                                : f
                            ))
                            queueMetadataReview(file.id, file.contractId, file.file.name)
                          }}
                          onContractNotFound={() => {
                            logger.warn('upload_contract_not_found', { fileId: file.id });
                            setFiles(prev => prev.map(f =>
                              f.id === file.id
                                ? { ...f, status: 'error', error: 'Contract not found. Please try uploading again.', endTime: Date.now() }
                                : f
                            ));
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {errorCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
                    <span className="text-sm text-red-700 dark:text-red-300">{errorCount} file{errorCount !== 1 ? 's' : ''} failed</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={retryAllErrors} className="gap-1 text-red-600 border-red-200 dark:border-red-700">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <UploadMetadataReviewDialog
        open={!!activeReview}
        contractId={activeReview?.contractId ?? null}
        fileName={activeReview?.fileName ?? ''}
        remainingCount={reviewQueue.length}
        onSkip={dismissActiveReview}
        onSkipAll={handleSkipAllMetadataReview}
        onSaved={dismissActiveReview}
      />
    </div>
  )
}

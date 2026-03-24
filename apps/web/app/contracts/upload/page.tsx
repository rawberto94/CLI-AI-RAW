'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDataMode } from '@/contexts/DataModeContext'
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
  startTime?: number
  endTime?: number
  skipDuplicateCheck?: boolean
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
  const router = useRouter()
  const { dataMode } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)
  const [processingOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS)
  const [isMounted, setIsMounted] = useState(false)
  const [shouldAutoStart, setShouldAutoStart] = useState(false)

  // Clear stale HMR state on mount
  useEffect(() => {
    setFiles([])
    setIsUploading(false)
    setIsMounted(true)
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
  }, [])

  // ── File callbacks ──────────────────────────────────────────────────────

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    }))
    setFiles(prev => [...prev, ...newFiles])
    setShouldAutoStart(true)
  }, [])

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
        const err = responseData.error || {};
        const errorMessage = typeof err === 'string' ? err
          : err.details ? `${err.message}: ${err.details}`
          : (err.message || 'Upload failed');
        throw new Error(errorMessage);
      }

      // API wraps response in { success, data, meta } envelope
      const result = responseData.data ?? responseData;

      // Check for duplicate — let user choose to reprocess
      if (result.isDuplicate && !skipDuplicateCheck) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { 
                ...f, 
                status: 'completed', 
                progress: 100, 
                contractId: result.contractId,
                isDuplicate: true,
                existingContractId: result.contractId,
                endTime: Date.now(),
              }
            : f
        ))
        toast.info(`${uploadFile.file.name} already exists`, {
          description: 'You can view the existing contract or reprocess it.',
          action: {
            label: 'Reprocess',
            onClick: () => {
              setFiles(prev => prev.map(f =>
                f.id === uploadFile.id
                  ? { ...f, status: 'pending', progress: 0, isDuplicate: false, existingContractId: undefined, skipDuplicateCheck: true }
                  : f
              ))
              setShouldAutoStart(true)
            },
          },
          duration: 8000,
        });
        return
      }

      const { contractId } = result
      
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

  // ── Derived state ───────────────────────────────────────────────────────
  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length
  const processingCount = files.filter(f => ['uploading', 'processing'].includes(f.status)).length
  const hasFiles = files.length > 0

  // ── Batch completion notification ───────────────────────────────────────
  const batchCompleteRef = useRef(false)
  useEffect(() => {
    if (files.length === 0 || processingCount > 0 || pendingCount > 0) {
      // Reset when a new batch starts
      if (processingCount > 0 || pendingCount > 0) batchCompleteRef.current = false
      return
    }
    // All files settled (completed or error)
    if (batchCompleteRef.current) return
    batchCompleteRef.current = true

    if (completedCount > 0 && errorCount === 0) {
      toast.success(`All ${completedCount} file${completedCount !== 1 ? 's' : ''} processed successfully`, {
        description: 'AI analysis is complete for your batch',
        action: { label: 'View Contracts', onClick: () => router.push('/contracts') },
        duration: 8000,
      })
    } else if (completedCount > 0 && errorCount > 0) {
      toast.warning(`${completedCount} succeeded, ${errorCount} failed`, {
        description: 'Some files encountered errors during processing',
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

        {/* File Queue */}
        {hasFiles && (
          <Card className="shadow-sm dark:border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base dark:text-slate-100">
                  {processingCount > 0 && `Processing ${processingCount} file${processingCount !== 1 ? 's' : ''}`}
                  {processingCount === 0 && pendingCount > 0 && `${pendingCount} file${pendingCount !== 1 ? 's' : ''} ready`}
                  {processingCount === 0 && pendingCount === 0 && completedCount > 0 && `${completedCount} completed`}
                  {processingCount === 0 && pendingCount === 0 && completedCount === 0 && errorCount > 0 && `${errorCount} failed`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {completedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted} className="gap-1 text-gray-500">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Clear Done
                    </Button>
                  )}
                  {pendingCount > 0 && !isUploading && (
                    <Button onClick={handleUploadAll} size="sm" className="gap-1">
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Upload All ({pendingCount})
                    </Button>
                  )}
                  {isUploading && !isPaused && (
                    <Button onClick={handlePauseAll} variant="outline" size="sm" className="gap-1">
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      Pause
                    </Button>
                  )}
                  {isPaused && (
                    <Button onClick={handleUploadAll} size="sm" className="gap-1">
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>
              {files.length > 1 && (processingCount > 0 || completedCount > 0) && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{completedCount} of {files.length}</span>
                    <span>{Math.round((completedCount / files.length) * 100)}%</span>
                  </div>
                  <Progress value={(completedCount / files.length) * 100} className="h-1" />
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
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
                          description: 'AI analysis complete',
                          action: file.contractId ? {
                            label: 'View',
                            onClick: () => router.push(`/contracts/${file.contractId}`),
                          } : undefined,
                          duration: 5000,
                        });
                      }}
                      tenantId={getTenantId()}
                    />
                    {file.contractId && file.status === 'processing' && file.showArtifacts && (
                      <div className="mt-2 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">Live AI Processing</span>
                        </div>
                        <RealtimeArtifactViewer
                          contractId={file.contractId}
                          tenantId={getTenantId()}
                          onComplete={() => {
                            setFiles(prev => prev.map(f =>
                              f.id === file.id
                                ? { ...f, status: 'completed', progress: 100, endTime: Date.now() }
                                : f
                            ))
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
    </div>
  )
}

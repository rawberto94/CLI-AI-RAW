'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'
import { EnhancedUploadProgress, ProcessingConfig } from '@/components/contracts/upload'
import type { ProcessingOptions } from '@/components/contracts/upload/ProcessingConfig'
import {
  Upload,
  AlertTriangle,
  Eye,
  FileText,
  Sparkles,
  Info,
  Settings2,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  FolderUp,
  CheckCircle2,
  Timer,
  Layers,
  History,
  Scale,
  Edit3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

// Extracted components & hooks
import { UploadHeader, AIStatusBanner, UploadDropZone, UploadStatsGrid, FeaturesGrid } from './components'
import type { AIStatus } from './components'

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
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'upload' | 'queue' | 'recent'>('upload')
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [aiStatusLoading, setAiStatusLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [uploadPurpose, setUploadPurpose] = useState<'store' | 'review'>('store')
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

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch('/api/ai/status', { headers: { 'x-tenant-id': getTenantId() } })
        if (response.ok) {
          const data = await response.json()
          setAiStatus(data.data ?? data)
        }
      } catch (error) {
        logger.warn('ai_status_check_failed', { error: error instanceof Error ? error.message : String(error) })
      } finally {
        setAiStatusLoading(false)
      }
    }
    checkAIStatus()
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
    if (files.length === 0 && newFiles.length > 0) setActiveTab('queue')
    setShouldAutoStart(true)
  }, [files.length])

  const uploadFile = async (uploadFile: UploadFile, skipDuplicateCheck = false) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('dataMode', dataMode)
    formData.append('ocrMode', processingOptions.aiModel)
    formData.append('processingMode', processingOptions.processingMode)
    if (uploadPurpose === 'review') {
      formData.append('lifecycle', 'REVIEW')
    }

    try {
      // Update to uploading — use null progress for indeterminate state
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: null as unknown as number, processingStage: 'Uploading file...', isDuplicate: false }
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
      
      // Use AbortController to timeout uploads after 60s
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      
      const uploadResponse = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      })
      
      clearTimeout(timeout)

      const responseData = await uploadResponse.json()
      
      if (!uploadResponse.ok) {
        const err = responseData.error || {};
        const errorMessage = typeof err === 'string' ? err
          : err.details ? `${err.message}: ${err.details}`
          : (err.message || 'Upload failed');
        throw new Error(errorMessage);
      }

      // API wraps response in { success, data, meta } envelope
      const result = responseData.data ?? responseData;

      // Check for duplicate
      if (result.isDuplicate) {
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
        toast.info(`${uploadFile.file.name} is a duplicate`, {
          description: 'This file was uploaded recently. You can view the existing contract.',
          action: {
            label: 'View',
            onClick: () => router.push(`/contracts/${result.contractId}`),
          },
          duration: 5000,
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
          ? 'Upload timed out. The server took too long to respond. Please try again.'
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
    
    // Reset all error files to pending
    setFiles(prev => prev.map(f =>
      f.status === 'error' ? { ...f, status: 'pending', progress: 0, error: undefined } : f
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/40 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/40">
      {/* Hero Header */}
      <UploadHeader
        dataMode={dataMode}
        aiModel={processingOptions.aiModel}
        isUploading={isUploading}
        processingCount={processingCount}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* AI Status Banner */}
        <AIStatusBanner status={aiStatus} loading={aiStatusLoading} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-white dark:bg-slate-800 shadow-sm">
              <TabsTrigger value="upload" className="gap-2 dark:data-[state=active]:bg-slate-700">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="queue" className="gap-2 dark:data-[state=active]:bg-slate-700">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Queue
                {hasFiles && (
                  <Badge variant="secondary" className="ml-1 min-w-[20px] h-5 dark:bg-slate-600">{files.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-2 dark:data-[state=active]:bg-slate-700">
                <History className="h-4 w-4" aria-hidden="true" />
                Recent
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="gap-2 dark:border-slate-600 dark:hover:bg-slate-700" aria-expanded={showSettings}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Settings
              </Button>
            </div>
          </div>

          {/* ── Upload Tab ──────────────────────────────────────────── */}
          <TabsContent value="upload" className="space-y-6">
            <AnimatePresence>
              {showSettings && (
                <motion.div key="settings" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <ProcessingConfig options={processingOptions} onChange={setProcessingOptions} disabled={isUploading} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Document Purpose Selector */}
            <div className="flex items-center gap-3 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm w-fit">
              <button onClick={() => setUploadPurpose('store')} disabled={isUploading} className={cn('flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all', uploadPurpose === 'store' ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                <FolderUp className="h-4 w-4" />
                Store &amp; Process
              </button>
              <button onClick={() => setUploadPurpose('review')} disabled={isUploading} className={cn('flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all', uploadPurpose === 'review' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')}>
                <Scale className="h-4 w-4" />
                Upload for Review
              </button>
            </div>
            {uploadPurpose === 'review' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                <Info className="h-4 w-4 shrink-0" />
                Documents will be uploaded for AI-powered review, redlining, and collaboration — not stored as executed contracts.
              </div>
            )}

            {/* Drop Zone */}
            <UploadDropZone onDrop={onDrop} disabled={isUploading} uploadPurpose={uploadPurpose} />

            {/* Quick Stats */}
            {hasFiles && (
              <UploadStatsGrid
                totalFiles={files.length}
                processingCount={processingCount}
                pendingCount={pendingCount}
                completedCount={completedCount}
                errorCount={errorCount}
              />
            )}

            {/* Features Grid */}
            {!hasFiles && <FeaturesGrid />}
          </TabsContent>
          
          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-6">
            {hasFiles ? (
              <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg dark:text-slate-100">Processing Queue</CardTitle>
                      <CardDescription className="dark:text-slate-400">
                        {processingCount > 0 && `${processingCount} processing`}
                        {processingCount > 0 && pendingCount > 0 && ', '}
                        {pendingCount > 0 && `${pendingCount} queued`}
                        {processingCount === 0 && pendingCount === 0 && completedCount > 0 && 'All done'}
                        {processingCount === 0 && pendingCount === 0 && completedCount === 0 && errorCount > 0 && `${errorCount} failed`}
                        {processingCount === 0 && pendingCount === 0 && completedCount === 0 && errorCount === 0 && `${files.length} file${files.length !== 1 ? 's' : ''}`}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {completedCount > 0 && (
                        <Button variant="outline" size="sm" onClick={clearCompleted} className="gap-1 dark:border-slate-600 dark:hover:bg-slate-700">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Clear Completed
                        </Button>
                      )}
                      
                      {pendingCount > 0 && !isUploading && (
                        <Button 
                          onClick={handleUploadAll} 
                          className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600"
                        >
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Start All ({pendingCount})
                        </Button>
                      )}
                      
                      {isUploading && !isPaused && (
                        <Button onClick={handlePauseAll} variant="outline" className="gap-2 dark:border-slate-600 dark:hover:bg-slate-700">
                          <Pause className="h-4 w-4" aria-hidden="true" />
                          Pause
                        </Button>
                      )}
                      
                      {isPaused && (
                        <Button onClick={handleUploadAll} className="gap-2">
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Resume
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Overall progress */}
                  {(processingCount > 0 || pendingCount > 0) && files.length > 1 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{completedCount} of {files.length} complete</span>
                        <span>{Math.round((completedCount / files.length) * 100)}%</span>
                      </div>
                      <Progress value={(completedCount / files.length) * 100} className="h-1.5" />
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    <AnimatePresence mode="popLayout">
                      {isMounted && files.map((file, index) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
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
                              // Don't remove the file - show error state instead
                              logger.warn('upload_contract_not_found', { fileId: file.id, source: 'EnhancedUploadProgress' });
                              setFiles(prev => prev.map(f =>
                                f.id === file.id
                                  ? { ...f, status: 'error', error: 'Contract not found. Please try uploading again.', endTime: Date.now() }
                                  : f
                              ));
                            }}
                            onComplete={() => {
                              // Update file status to completed when processing finishes
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
                          
                          {/* Realtime artifact viewer for processing files */}
                          {file.contractId && file.status === 'processing' && file.showArtifacts && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 rounded-xl border border-violet-200 dark:border-violet-700"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                                <span className="font-medium text-violet-900 dark:text-violet-200 text-sm">Live AI Processing</span>
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
                                  // Don't remove the file - show error state instead
                                  // This gives user a chance to retry or see what happened
                                  logger.warn('upload_contract_not_found', { fileId: file.id, source: 'RealtimeArtifactViewer' });
                                  setFiles(prev => prev.map(f =>
                                    f.id === file.id
                                      ? { ...f, status: 'error', error: 'Contract not found. Please try uploading again.', endTime: Date.now() }
                                      : f
                                  ));
                                }}
                              />
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  
                  {/* Retry all errors */}
                  {errorCount > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 rounded-xl border border-red-200 dark:border-red-700 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                            {errorCount} file{errorCount !== 1 ? 's' : ''} failed to process
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            Review errors and retry to continue
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                        onClick={retryAllErrors}
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Retry All Errors
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full w-fit mx-auto mb-4">
                    <FolderUp className="h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No files in queue</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Upload some contracts to get started</p>
                  <Button onClick={() => setActiveTab('upload')}>
                    <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                    Go to Upload
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Recent Tab */}
          <TabsContent value="recent" className="space-y-6">
            {/* Success Banner when uploads complete */}
            {completedCount > 0 && !isUploading && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-7 w-7 shrink-0" />
                        <div>
                          <h3 className="text-lg font-bold">
                            {completedCount} {uploadPurpose === 'review' ? 'Document' : 'Contract'}{completedCount !== 1 ? 's' : ''} Processed
                          </h3>
                          <p className="text-sm text-white/80 mt-0.5">AI analysis complete and ready for review</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          className="bg-white/20 hover:bg-white/30 text-white border-0"
                          onClick={() => router.push('/contracts')}
                        >
                          View Contracts
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-white text-violet-700 hover:bg-violet-50"
                          onClick={() => setActiveTab('upload')}
                        >
                          Upload More
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl dark:text-slate-100">Recent Uploads</CardTitle>
                    <CardDescription className="dark:text-slate-400">Your recently processed contracts from this session</CardDescription>
                  </div>
                  {completedCount > 0 && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearCompleted}
                        className="gap-1 dark:border-slate-600 dark:hover:bg-slate-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Clear List
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {completedCount > 0 ? (
                  <div className="space-y-3">
                    {files.filter(f => f.status === 'completed').map((file, index) => (
                      <motion.div 
                        key={file.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/30 rounded-xl border border-green-200 dark:border-green-700 hover:shadow-md transition-all motion-reduce:transition-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{file.file.name}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <span>{formatFileSize(file.file.size)}</span>
                              {file.endTime && file.startTime && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" aria-hidden="true" />
                                    {formatDuration(file.endTime - file.startTime)}
                                  </span>
                                </>
                              )}
                              {file.isDuplicate && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700">
                                    Duplicate
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/contracts/${file.contractId}/redline`)}
                            className="gap-1 hidden md:flex dark:border-slate-600 dark:hover:bg-slate-700"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Redline
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/contracts/${file.contractId}/legal-review`)}
                            className="gap-1 hidden md:flex dark:border-slate-600 dark:hover:bg-slate-700"
                          >
                            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                            Review
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => viewContract(file.contractId!)}
                            className="gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full w-fit mx-auto mb-4">
                      <History className="h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No recent uploads</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Upload contracts to see them here. AI will extract key data, clauses, and obligations automatically.
                    </p>
                    
                    {/* Quick Start Guide */}
                    <div className="max-w-2xl mx-auto">
                      <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 rounded-xl border border-violet-100 dark:border-violet-700 text-left">
                        <h4 className="font-medium text-violet-900 dark:text-violet-200 mb-3 flex items-center gap-2">
                          <Info className="h-4 w-4" aria-hidden="true" />
                          How it works
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          {[
                            { step: '1', label: 'Upload', desc: 'Drop PDF, DOC, or images' },
                            { step: '2', label: 'AI Analysis', desc: 'GPT-4 extracts data' },
                            { step: '3', label: 'Review', desc: 'Verify extractions' },
                            { step: '4', label: 'Use', desc: 'Track & manage' },
                          ].map(item => (
                            <div key={item.step} className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">
                                {item.step}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                                <p className="text-gray-500 dark:text-gray-400 text-xs">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <Button onClick={() => setActiveTab('upload')} className="mt-6">
                      <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                      Start Uploading
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

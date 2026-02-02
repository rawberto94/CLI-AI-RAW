'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'
import { EnhancedUploadProgress, ProcessingConfig } from '@/components/contracts/upload'
import type { ProcessingOptions } from '@/components/contracts/upload/ProcessingConfig'
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  FileText,
  Sparkles,
  Zap,
  Shield,
  Clock,
  Brain,
  TrendingUp,
  FileCheck,
  Target,
  ArrowRight,
  Info,
  ChevronRight,
  Settings2,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  FolderUp,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Timer,
  Key,
  Layers,
  BarChart3,
  FileUp,
  CloudUpload,
  History,
  FileImage,
  File,
  ImageIcon,
  Award,
  Activity,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import Link from 'next/link'

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
}

const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  aiModel: 'azure-ch',
  processingMode: 'standard',
  concurrency: 2,
  enabledArtifacts: [
    'OVERVIEW', 'CLAUSES', 'FINANCIAL', 'RISK', 'COMPLIANCE',
    'OBLIGATIONS', 'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS'
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

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return { icon: FileText, color: 'text-red-500', bg: 'bg-red-100' }
    case 'doc':
    case 'docx': return { icon: FileText, color: 'text-violet-500', bg: 'bg-violet-100' }
    case 'html': return { icon: FileImage, color: 'text-orange-500', bg: 'bg-orange-100' }
    default: return { icon: File, color: 'text-gray-500', bg: 'bg-gray-100' }
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

// AI Status interface
interface AIStatus {
  status: 'healthy' | 'degraded' | 'limited' | 'error';
  providers: {
    openai: { configured: boolean; status: string };
    mistral: { configured: boolean; status: string };
  };
  capabilities: Record<string, boolean>;
  recommendations: string[];
}

export default function UploadPage() {
  const router = useRouter()
  const { dataMode, isRealData, isMockData, isAIGenerated } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>(DEFAULT_PROCESSING_OPTIONS)
  const [showSettings, setShowSettings] = useState(false)
  const [totalProcessingTime, setTotalProcessingTime] = useState(0)
  const [activeTab, setActiveTab] = useState<'upload' | 'queue' | 'recent'>('upload')
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null)
  const [aiStatusLoading, setAiStatusLoading] = useState(true)

  // Check AI status on mount
  useEffect(() => {
    const checkAIStatus = async () => {
      try {
        const response = await fetch('/api/ai/status', {
          headers: { 'x-tenant-id': getTenantId() }
        })
        if (response.ok) {
          const data = await response.json()
          setAiStatus(data)
        }
      } catch (error) {
        console.error('Failed to check AI status:', error)
      } finally {
        setAiStatusLoading(false)
      }
    }
    checkAIStatus()
  }, [])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
    }))
    setFiles(prev => [...prev, ...newFiles])
    
    // Auto-switch to queue tab when files are added
    if (files.length === 0 && newFiles.length > 0) {
      setActiveTab('queue')
    }
  }, [files.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isUploading,
  })

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('dataMode', dataMode)
    formData.append('ocrMode', processingOptions.aiModel)
    formData.append('processingMode', processingOptions.processingMode)

    try {
      // Update to uploading
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 10, processingStage: 'Uploading file...' }
          : f
      ))

      // Simulate upload progress with pause check
      for (let i = 10; i <= 50; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200))
        if (isPaused) {
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id ? { ...f, status: 'pending', progress: 0 } : f
          ))
          return
        }
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, progress: i } : f
        ))
      }

      // Upload file
      const uploadResponse = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'x-tenant-id': getTenantId(),
          'x-data-mode': dataMode
        }
      })

      const responseData = await uploadResponse.json()
      
      if (!uploadResponse.ok) {
        const errorMessage = responseData.details 
          ? `${responseData.error}: ${responseData.details}` 
          : (responseData.error || 'Upload failed');
        throw new Error(errorMessage);
      }

      // Check for duplicate
      if (responseData.isDuplicate) {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { 
                ...f, 
                status: 'completed', 
                progress: 100, 
                contractId: responseData.contractId,
                isDuplicate: true,
                existingContractId: responseData.contractId,
                endTime: Date.now(),
              }
            : f
        ))
        return
      }

      const { contractId } = responseData

      // Update to processing with artifact viewer enabled
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'processing', progress: 60, contractId, processingStage: 'Processing with AI...', showArtifacts: true }
          : f
      ))

      // Note: Real-time SSE will handle the rest of the progress updates
      // The RealtimeArtifactViewer component will show live artifact generation

    } catch (error: unknown) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
              endTime: Date.now()
            }
          : f
      ))
    }
  }

  const handleUploadAll = useCallback(async () => {
    setIsUploading(true)
    setIsPaused(false)
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    // Process files with concurrency limit
    const concurrency = processingOptions.concurrency
    for (let i = 0; i < pendingFiles.length; i += concurrency) {
      if (isPaused) break
      
      const batch = pendingFiles.slice(i, i + concurrency)
      await Promise.all(batch.map(file => uploadFile(file)))
    }
    
    setIsUploading(false)
  }, [files, processingOptions.concurrency, isPaused])

  const handlePauseAll = useCallback(() => {
    setIsPaused(true)
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const retryFile = useCallback((id: string) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f
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

  const viewContract = useCallback((contractId: string) => {
    router.push(`/contracts/${contractId}`)
  }, [router])

  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length
  const processingCount = files.filter(f => ['uploading', 'processing'].includes(f.status)).length
  const hasFiles = files.length > 0
  
  // Update processing time
  useEffect(() => {
    if (isUploading && processingCount > 0) {
      const interval = setInterval(() => {
        setTotalProcessingTime(prev => prev + 100)
      }, 100)
      return () => clearInterval(interval)
    }
  }, [isUploading, processingCount])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/40 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/40">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 dark:from-violet-800 dark:via-purple-800 dark:to-purple-900 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" aria-hidden="true" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <motion.div 
            className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl motion-reduce:animate-none"
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 30, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div 
            className="absolute bottom-10 left-10 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl motion-reduce:animate-none"
            animate={{ 
              scale: [1, 1.3, 1],
              x: [0, -20, 0],
              y: [0, 20, 0]
            }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </div>
        
        <div className="relative px-6 py-10 md:px-12 md:py-14 max-w-7xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <motion.div 
                className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <CloudUpload className="h-10 w-10 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  Upload Contracts
                </h1>
                <p className="text-violet-100 text-lg">
                  AI-powered contract analysis in seconds
                </p>
              </div>
            </div>
            
            <Link href="/contracts">
              <Button variant="secondary" className="gap-2">
                View All Contracts
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {/* Status badges */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <Sparkles className="h-4 w-4 mr-2" />
              {dataMode} mode
            </Badge>
            <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <Brain className="h-4 w-4 mr-2" />
              {processingOptions.aiModel === 'azure-ch' ? 'Azure GPT-4o (CH)' : 
               processingOptions.aiModel === 'mistral' ? 'Mistral Large (EU)' :
               processingOptions.aiModel === 'auto' ? 'Auto Select' : 'Azure GPT-4o (CH)'}
            </Badge>
            {isUploading && (
              <Badge className="bg-green-500/30 text-green-100 border-green-300/30 px-4 py-2 text-sm backdrop-blur-sm motion-safe:animate-pulse">
                <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" aria-hidden="true" />
                Processing {processingCount} file{processingCount !== 1 ? 's' : ''}...
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* AI Status Alert */}
        {!aiStatusLoading && aiStatus && (aiStatus.status === 'limited' || aiStatus.status === 'degraded') && (
          <Alert variant={aiStatus.status === 'limited' ? 'destructive' : 'default'} className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30">
            <Key className="h-4 w-4" />
            <AlertTitle className="font-semibold">
              {aiStatus.status === 'limited' ? 'AI Features Limited' : 'AI System Degraded'}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="font-medium">Providers:</span>
                  <Badge variant={aiStatus.providers.openai.configured ? 'default' : 'outline'} className="text-xs">
                    OpenAI: {aiStatus.providers.openai.configured ? '✅ Ready' : '❌ Not configured'}
                  </Badge>
                  <Badge variant={aiStatus.providers.mistral.configured ? 'default' : 'outline'} className="text-xs">
                    Mistral: {aiStatus.providers.mistral.configured ? '✅ Ready' : '❌ Not configured'}
                  </Badge>
                </div>
                {aiStatus.recommendations.length > 0 && (
                  <ul className="text-sm list-disc list-inside space-y-1 mt-2 text-muted-foreground">
                    {aiStatus.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* AI Ready Status */}
        {!aiStatusLoading && aiStatus?.status === 'healthy' && (
          <Alert className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="font-semibold text-green-800 dark:text-green-200">AI System Ready</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              All AI providers are configured and operational. Upload your contracts for instant AI analysis.
            </AlertDescription>
          </Alert>
        )}

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
                  <Badge variant="secondary" className="ml-1 min-w-[20px] h-5 dark:bg-slate-600">
                    {files.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-2 dark:data-[state=active]:bg-slate-700">
                <History className="h-4 w-4" aria-hidden="true" />
                Recent
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2 dark:border-slate-600 dark:hover:bg-slate-700"
                aria-expanded={showSettings}
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Settings
              </Button>
            </div>
          </div>
          
          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            {/* Processing Config (collapsible) */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <ProcessingConfig 
                    options={processingOptions}
                    onChange={setProcessingOptions}
                    disabled={isUploading}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Drop Zone */}
            <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <motion.div
                  whileHover={!isUploading ? { scale: 1.01 } : undefined}
                  whileTap={!isUploading ? { scale: 0.99 } : undefined}
                  className="motion-reduce:transform-none"
                >
                  <div
                    {...getRootProps()}
                    className={cn(
                      'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden motion-reduce:transition-none',
                      isDragActive
                        ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 scale-[1.02]'
                        : 'border-gray-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-gradient-to-br hover:from-gray-50 hover:to-purple-50/30 dark:hover:from-slate-800 dark:hover:to-purple-900/20',
                      isUploading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <input {...getInputProps()} disabled={isUploading} aria-label="Upload contract documents" />
                  
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))] opacity-50" aria-hidden="true" />
                    
                    <div className="relative z-10">
                    <motion.div
                      className={cn(
                        'mx-auto mb-6 p-6 rounded-full w-fit motion-reduce:animate-none',
                        isDragActive 
                          ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl'
                          : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600'
                      )}
                      animate={isDragActive ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      {isDragActive ? (
                        <CloudUpload className="h-12 w-12 text-white" aria-hidden="true" />
                      ) : (
                        <FileUp className="h-12 w-12 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      )}
                    </motion.div>
                    
                    {isDragActive ? (
                      <>
                        <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mb-2">
                          Drop your contracts here!
                        </p>
                        <p className="text-gray-600 dark:text-gray-300">
                          Release to start the AI analysis
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                          Drag & drop contracts here
                        </p>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
                          or click to browse your files
                        </p>
                        
                        {/* Supported formats */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                          {['PDF', 'DOC', 'DOCX', 'TXT', 'PNG', 'JPG'].map(format => (
                            <Badge key={format} variant="outline" className="text-sm px-3 py-1.5 dark:border-slate-600 dark:text-slate-300">
                              <FileText className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                              {format}
                            </Badge>
                          ))}
                        </div>
                        
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Maximum file size: 50MB per file • Upload multiple files at once
                        </p>
                      </>
                    )}
                    </div>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
            
            {/* Quick Stats when files exist */}
            {hasFiles && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-700 border-slate-200 dark:border-slate-600 hover:shadow-lg transition-all motion-reduce:transition-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-slate-200 dark:bg-slate-600 rounded-lg">
                      <Layers className="h-5 w-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{files.length}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Total Files</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border-violet-200 dark:border-violet-700 hover:shadow-lg transition-all motion-reduce:transition-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-violet-200 dark:bg-violet-800 rounded-lg">
                      <Activity className={cn("h-5 w-5 text-violet-600 dark:text-violet-400", processingCount > 0 && "motion-safe:animate-pulse")} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{processingCount}</p>
                      <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Processing</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 border-amber-200 dark:border-amber-700 hover:shadow-lg transition-all motion-reduce:transition-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">In Queue</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-violet-50 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/30 border-green-200 dark:border-green-700 hover:shadow-lg transition-shadow motion-reduce:transition-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                      <Award className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Completed</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-red-200 dark:border-red-700 hover:shadow-lg transition-shadow motion-reduce:transition-none">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-200 dark:bg-red-800 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">Errors</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Features Grid (when no files) */}
            {!hasFiles && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Zap, gradient: 'from-violet-500 to-purple-600', title: 'Lightning Fast', desc: 'AI extraction in seconds' },
                  { icon: Shield, gradient: 'from-violet-500 to-violet-600', title: 'Secure Storage', desc: 'Bank-grade encryption' },
                  { icon: Brain, gradient: 'from-purple-500 to-pink-600', title: 'AI Analysis', desc: 'GPT-4 powered insights' },
                  { icon: BarChart3, gradient: 'from-orange-500 to-red-600', title: 'Smart Reports', desc: '10 artifact types' },
                ].map(feature => (
                  <Card key={feature.title} className="border-0 dark:border dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-shadow motion-reduce:transition-none dark:bg-slate-800/80">
                    <CardContent className="p-6">
                      <div className={cn('p-3 rounded-xl shadow-lg w-fit mb-4 bg-gradient-to-br', feature.gradient)}>
                        <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-6">
            {hasFiles ? (
              <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl dark:text-slate-100">Processing Queue</CardTitle>
                      <CardDescription className="dark:text-slate-400">
                        {isUploading 
                          ? `Processing ${processingCount} of ${files.length} files...`
                          : `${files.length} file${files.length !== 1 ? 's' : ''} in queue`
                        }
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
                        <Button onClick={handleUploadAll} className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600">
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
                  {isUploading && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Overall Progress</span>
                        <span>{Math.round((completedCount / files.length) * 100)}%</span>
                      </div>
                      <Progress value={(completedCount / files.length) * 100} className="h-2" />
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    <AnimatePresence mode="popLayout">
                      {files.map((file, index) => (
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
                            tenantId={getTenantId()}
                          />
                          
                          {/* Realtime artifact viewer for processing files */}
                          {file.contractId && file.status === 'processing' && file.showArtifacts && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-purple-50 dark:from-purple-900/30 dark:to-purple-900/30 rounded-xl border border-purple-200 dark:border-purple-700"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                                <span className="font-medium text-purple-900 dark:text-purple-200 text-sm">Live AI Processing</span>
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
                <Card className="border-0 shadow-xl bg-gradient-to-br from-violet-500 via-violet-500 to-violet-600 text-white">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <motion.div 
                          className="p-3 bg-white/20 rounded-xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: 3, duration: 0.5 }}
                        >
                          <CheckCircle2 className="h-8 w-8" />
                        </motion.div>
                        <div>
                          <h3 className="text-xl font-bold">
                            {completedCount} Contract{completedCount !== 1 ? 's' : ''} Processed Successfully!
                          </h3>
                          <p className="text-green-100 mt-1">
                            AI analysis complete. Your contracts are ready for review.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="secondary" 
                          className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                          onClick={() => router.push('/contracts')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View All Contracts
                        </Button>
                        <Button 
                          className="bg-white text-green-700 hover:bg-green-50"
                          onClick={() => setActiveTab('upload')}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload More
                        </Button>
                      </div>
                    </div>
                    
                    {/* Next Steps Guide */}
                    <div className="mt-6 pt-6 border-t border-white/20">
                      <p className="text-sm font-medium text-green-100 mb-3">Recommended Next Steps:</p>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        {[
                          { icon: Eye, label: 'Review Extractions', desc: 'Check AI analysis', href: '/contracts' },
                          { icon: Scale, label: 'Legal Review', desc: 'Start redlining', href: '/contracts' },
                          { icon: Target, label: 'Track Obligations', desc: 'Monitor deadlines', href: '/obligations' },
                          { icon: Sparkles, label: 'AI Insights', desc: 'Get recommendations', href: '/ai/chat' },
                        ].map(step => (
                          <Link key={step.label} href={step.href}>
                            <motion.div 
                              className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-all cursor-pointer"
                              whileHover={{ scale: 1.02 }}
                            >
                              <step.icon className="h-5 w-5 mb-2" />
                              <p className="font-medium text-sm">{step.label}</p>
                              <p className="text-xs text-green-100">{step.desc}</p>
                            </motion.div>
                          </Link>
                        ))}
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

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
  Layers,
  BarChart3,
  FileUp,
  CloudUpload,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  aiModel: 'gpt-4o-mini',
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
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
          'x-tenant-id': 'demo',
          'x-data-mode': dataMode
        }
      })

      const responseData = await uploadResponse.json()
      
      if (!uploadResponse.ok) {
        throw new Error(responseData.error || 'Upload failed')
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

    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 30, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div 
            className="absolute bottom-10 left-10 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl"
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
                <p className="text-blue-100 text-lg">
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
              {processingOptions.aiModel === 'gpt-4o' ? 'GPT-4o' : 
               processingOptions.aiModel === 'gpt-4o-mini' ? 'GPT-4o Mini' : 'Auto'}
            </Badge>
            {isUploading && (
              <Badge className="bg-green-500/30 text-green-100 border-green-300/30 px-4 py-2 text-sm backdrop-blur-sm animate-pulse">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing {processingCount} file{processingCount !== 1 ? 's' : ''}...
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-white shadow-sm">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="queue" className="gap-2">
                <Layers className="h-4 w-4" />
                Queue
                {hasFiles && (
                  <Badge variant="secondary" className="ml-1 min-w-[20px] h-5">
                    {files.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-2">
                <History className="h-4 w-4" />
                Recent
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2"
              >
                <Settings2 className="h-4 w-4" />
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
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <motion.div
                  {...getRootProps()}
                  className={cn(
                    'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden',
                    isDragActive
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02]'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50/30',
                    isUploading && 'opacity-50 cursor-not-allowed'
                  )}
                  whileHover={!isUploading ? { scale: 1.01 } : undefined}
                  whileTap={!isUploading ? { scale: 0.99 } : undefined}
                >
                  <input {...getInputProps()} disabled={isUploading} aria-label="Upload contract documents" />
                  
                  {/* Animated background pattern */}
                  <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))] opacity-50" />
                  
                  <div className="relative z-10">
                    <motion.div
                      className={cn(
                        'mx-auto mb-6 p-6 rounded-full w-fit',
                        isDragActive 
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl'
                          : 'bg-gradient-to-br from-slate-100 to-slate-200'
                      )}
                      animate={isDragActive ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      {isDragActive ? (
                        <CloudUpload className="h-12 w-12 text-white" />
                      ) : (
                        <FileUp className="h-12 w-12 text-slate-500" />
                      )}
                    </motion.div>
                    
                    {isDragActive ? (
                      <>
                        <p className="text-2xl font-bold text-blue-600 mb-2">
                          Drop your contracts here!
                        </p>
                        <p className="text-gray-600">
                          Release to start the AI analysis
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-gray-900 mb-3">
                          Drag & drop contracts here
                        </p>
                        <p className="text-gray-600 mb-6 text-lg">
                          or click to browse your files
                        </p>
                        
                        {/* Supported formats */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                          {['PDF', 'DOC', 'DOCX', 'TXT', 'PNG', 'JPG'].map(format => (
                            <Badge key={format} variant="outline" className="text-sm px-3 py-1.5">
                              <FileText className="h-3.5 w-3.5 mr-1.5" />
                              {format}
                            </Badge>
                          ))}
                        </div>
                        
                        <p className="text-sm text-gray-500">
                          Maximum file size: 50MB per file • Upload multiple files at once
                        </p>
                      </>
                    )}
                  </div>
                </motion.div>
              </CardContent>
            </Card>
            
            {/* Quick Stats when files exist */}
            {hasFiles && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-slate-200 rounded-lg">
                      <Layers className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{files.length}</p>
                      <p className="text-xs text-slate-500">Total Files</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <Loader2 className={cn("h-5 w-5 text-blue-600", processingCount > 0 && "animate-spin")} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{processingCount}</p>
                      <p className="text-xs text-blue-600">Processing</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-amber-200 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                      <p className="text-xs text-amber-600">In Queue</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-green-200 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                      <p className="text-xs text-green-600">Completed</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-200 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                      <p className="text-xs text-red-600">Errors</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Features Grid (when no files) */}
            {!hasFiles && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Zap, gradient: 'from-blue-500 to-indigo-600', title: 'Lightning Fast', desc: 'AI extraction in seconds' },
                  { icon: Shield, gradient: 'from-green-500 to-emerald-600', title: 'Secure Storage', desc: 'Bank-grade encryption' },
                  { icon: Brain, gradient: 'from-purple-500 to-pink-600', title: 'AI Analysis', desc: 'GPT-4 powered insights' },
                  { icon: BarChart3, gradient: 'from-orange-500 to-red-600', title: 'Smart Reports', desc: '10 artifact types' },
                ].map(feature => (
                  <Card key={feature.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-6">
                      <div className={cn('p-3 rounded-xl shadow-lg w-fit mb-4 bg-gradient-to-br', feature.gradient)}>
                        <feature.icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-sm text-gray-600">{feature.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-6">
            {hasFiles ? (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Processing Queue</CardTitle>
                      <CardDescription>
                        {isUploading 
                          ? `Processing ${processingCount} of ${files.length} files...`
                          : `${files.length} file${files.length !== 1 ? 's' : ''} in queue`
                        }
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {completedCount > 0 && (
                        <Button variant="outline" size="sm" onClick={clearCompleted} className="gap-1">
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear Completed
                        </Button>
                      )}
                      
                      {pendingCount > 0 && !isUploading && (
                        <Button onClick={handleUploadAll} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600">
                          <Play className="h-4 w-4" />
                          Start All ({pendingCount})
                        </Button>
                      )}
                      
                      {isUploading && !isPaused && (
                        <Button onClick={handlePauseAll} variant="outline" className="gap-2">
                          <Pause className="h-4 w-4" />
                          Pause
                        </Button>
                      )}
                      
                      {isPaused && (
                        <Button onClick={handleUploadAll} className="gap-2">
                          <Play className="h-4 w-4" />
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
                            tenantId="demo"
                          />
                          
                          {/* Realtime artifact viewer for processing files */}
                          {file.contractId && file.status === 'processing' && file.showArtifacts && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                                <span className="font-medium text-purple-900 text-sm">Live AI Processing</span>
                              </div>
                              <RealtimeArtifactViewer
                                contractId={file.contractId}
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
                    <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {errorCount} file{errorCount !== 1 ? 's' : ''} failed to process
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-100"
                        onClick={() => {
                          files.filter(f => f.status === 'error').forEach(f => retryFile(f.id))
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Retry All
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="py-16 text-center">
                  <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                    <FolderUp className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No files in queue</h3>
                  <p className="text-gray-500 mb-4">Upload some contracts to get started</p>
                  <Button onClick={() => setActiveTab('upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Go to Upload
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Recent Tab */}
          <TabsContent value="recent" className="space-y-6">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">Recent Uploads</CardTitle>
                <CardDescription>Your recently processed contracts</CardDescription>
              </CardHeader>
              <CardContent>
                {completedCount > 0 ? (
                  <div className="space-y-3">
                    {files.filter(f => f.status === 'completed').map(file => (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-200 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{file.file.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(file.file.size)}
                              {file.endTime && file.startTime && (
                                <span className="ml-2">
                                  • Processed in {formatDuration(file.endTime - file.startTime)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => viewContract(file.contractId!)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="p-4 bg-slate-100 rounded-full w-fit mx-auto mb-4">
                      <History className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No recent uploads</h3>
                    <p className="text-gray-500">Your completed uploads will appear here</p>
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

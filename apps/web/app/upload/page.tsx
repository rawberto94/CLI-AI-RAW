'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  FileText,
  Sparkles,
  Zap,
  Shield,
  Clock,
  Brain,
  ChevronRight,
  Settings2,
  Files,
  ArrowRight,
  ExternalLink,
  CircleDot,
  Check,
  HelpCircle
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
  estimatedTime?: number
  startTime?: number
}

// OCR engine configurations
const OCR_ENGINES = {
  azure: {
    id: 'azure',
    name: 'Azure Document AI',
    description: 'Enterprise security, Swiss/EU data residency, GDPR compliant',
    icon: Shield,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    baseTime: 12,
    perMbTime: 6,
    accuracy: 97,
    badge: 'Enterprise'
  },
  gpt4: {
    id: 'gpt4',
    name: 'GPT-4 Vision',
    description: 'Highest accuracy for complex documents',
    icon: Brain,
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    baseTime: 15,
    perMbTime: 8,
    accuracy: 98,
    badge: 'Recommended'
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral OCR',
    description: 'Fast processing with great quality',
    icon: Zap,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    baseTime: 10,
    perMbTime: 5,
    accuracy: 94,
    badge: 'Fast'
  },
  tesseract: {
    id: 'tesseract',
    name: 'Tesseract Local',
    description: 'No data leaves your infrastructure',
    icon: Shield,
    color: 'from-slate-500 to-gray-600',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    baseTime: 5,
    perMbTime: 3,
    accuracy: 85,
    badge: 'Privacy'
  }
} as const;

type OcrMode = keyof typeof OCR_ENGINES;

// Estimate processing time based on file size and OCR mode
function estimateProcessingTime(file: File, ocrMode: OcrMode): number {
  const fileSizeMb = file.size / (1024 * 1024);
  const engine = OCR_ENGINES[ocrMode];
  return Math.ceil(engine.baseTime + (fileSizeMb * engine.perMbTime));
}

// Format seconds to human readable
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router = useRouter()
  const { dataMode } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [ocrMode, setOcrMode] = useState<OcrMode>('gpt4')
  const [showEngineSelector, setShowEngineSelector] = useState(false)

  // Compute statistics
  const stats = useMemo(() => {
    const total = files.length;
    const pending = files.filter(f => f.status === 'pending').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const processing = files.filter(f => f.status === 'processing').length;
    const completed = files.filter(f => f.status === 'completed').length;
    const errors = files.filter(f => f.status === 'error').length;
    const inProgress = uploading + processing;
    return { total, pending, uploading, processing, completed, errors, inProgress };
  }, [files]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
      estimatedTime: estimateProcessingTime(file, ocrMode),
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [ocrMode])

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/html': ['.html']
    },
    multiple: true,
    maxSize: 100 * 1024 * 1024
  })

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('ocrMode', ocrMode)

    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id 
        ? { ...f, status: 'uploading', progress: 0, startTime: Date.now() } 
        : f
    ))

    try {
      const response = await fetch('/api/contracts/upload', {
        method: 'POST',
        headers: {
          'x-data-mode': dataMode
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Update to processing
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'processing', progress: 50, contractId: data.contractId }
          : f
      ))

      // Poll for completion
      let attempts = 0
      const maxAttempts = 120
      const pollInterval = setInterval(async () => {
        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'error', error: 'Processing timeout' }
              : f
          ))
          return
        }

        try {
          const statusResponse = await fetch(`/api/contracts/${data.contractId}/status`)
          const statusData = await statusResponse.json()

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval)
            setFiles(prev => prev.map(f =>
              f.id === uploadFile.id
                ? { ...f, status: 'completed', progress: 100, processingStage: 'complete' }
                : f
            ))
          } else if (statusData.status === 'ERROR' || statusData.status === 'FAILED') {
            clearInterval(pollInterval)
            setFiles(prev => prev.map(f =>
              f.id === uploadFile.id
                ? { ...f, status: 'error', error: statusData.error || 'Processing failed' }
                : f
            ))
          } else {
            // Update progress
            const progressMap: Record<string, number> = {
              'TEXT_EXTRACTION': 20,
              'ARTIFACT_GENERATION': 40,
              'RAG_INDEXING': 60,
              'METADATA_EXTRACTION': 80,
              'CATEGORIZATION': 95,
              'COMPLETED': 100
            }
            const progress = progressMap[statusData.currentStage] || 50
            setFiles(prev => prev.map(f =>
              f.id === uploadFile.id
                ? { ...f, progress, processingStage: statusData.currentStage }
                : f
            ))
          }
        } catch (err) {
          console.error('Status poll error:', err)
        }
      }, 2000)

    } catch (err) {
      console.error('Upload error:', err)
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : f
      ))
    }
  }

  const uploadAll = async () => {
    setIsUploading(true)
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    // Process files with concurrency limit
    const concurrencyLimit = 3
    for (let i = 0; i < pendingFiles.length; i += concurrencyLimit) {
      const batch = pendingFiles.slice(i, i + concurrencyLimit)
      await Promise.all(batch.map(uploadFile))
    }
    
    setIsUploading(false)
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'))
  }

  const toggleArtifacts = (id: string) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, showArtifacts: !f.showArtifacts } : f
    ))
  }

  const currentEngine = OCR_ENGINES[ocrMode];
  const EngineIcon = currentEngine.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-x-hidden">
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <PageBreadcrumb />
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Upload Contracts
                </h1>
              </div>
              <p className="text-slate-600 text-lg">
                AI-powered extraction generates structured artifacts from your documents
              </p>
            </div>
            
            {/* Engine Selector Button */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowEngineSelector(!showEngineSelector)}
                className={cn(
                  "h-12 px-5 gap-2.5 border-2 transition-all rounded-xl shadow-sm hover:shadow-md",
                  currentEngine.borderColor,
                  currentEngine.bgColor
                )}
              >
                <EngineIcon className={cn("h-4.5 w-4.5", currentEngine.textColor)} />
                <span className={cn("font-semibold", currentEngine.textColor)}>
                  {currentEngine.name}
                </span>
                <Settings2 className="h-4 w-4 text-slate-400" />
              </Button>
              
              {/* Engine Dropdown */}
              <AnimatePresence>
                {showEngineSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-80 z-20"
                  >
                    <Card className="shadow-2xl border-slate-200/80 bg-white/95 backdrop-blur-md rounded-xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-slate-700">
                          Select OCR Engine
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-2">
                        {Object.values(OCR_ENGINES).map((engine) => {
                          const Icon = engine.icon;
                          const isSelected = ocrMode === engine.id;
                          return (
                            <button
                              key={engine.id}
                              onClick={() => {
                                setOcrMode(engine.id as OcrMode);
                                setShowEngineSelector(false);
                              }}
                              className={cn(
                                "w-full p-3.5 rounded-xl flex items-start gap-3 transition-all text-left",
                                isSelected 
                                  ? cn(engine.bgColor, "ring-2", engine.borderColor.replace('border-', 'ring-'), "shadow-md")
                                  : "hover:bg-slate-50"
                              )}
                            >
                              <div className={cn(
                                "p-2.5 rounded-xl bg-gradient-to-br shadow-lg",
                                engine.color
                              )}>
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {engine.name}
                                  </span>
                                  {engine.badge && (
                                    <Badge 
                                      variant="secondary" 
                                      className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-sm",
                                        engine.bgColor,
                                        engine.textColor
                                      )}
                                    >
                                      {engine.badge}
                                    </Badge>
                                  )}
                                  {isSelected && (
                                    <Check className="h-4 w-4 text-indigo-600 ml-auto" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {engine.description}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {engine.accuracy}% accuracy
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    ~{engine.baseTime}s base
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Click outside to close */}
              {showEngineSelector && (
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowEngineSelector(false)}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div
            {...getRootProps()}
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer",
              "bg-white/80 backdrop-blur-sm hover:bg-white shadow-lg shadow-slate-200/30",
              isDragActive && "border-indigo-400 bg-indigo-50/70 shadow-indigo-200/40",
              isDragAccept && "border-green-400 bg-green-50/70 shadow-green-200/40",
              isDragReject && "border-red-400 bg-red-50/70 shadow-red-200/40",
              !isDragActive && "border-slate-200 hover:border-indigo-300 hover:shadow-xl"
            )}
          >
            <input {...getInputProps()} />
            
            <div className="p-14 text-center">
              <motion.div
                animate={{ 
                  scale: isDragActive ? 1.15 : 1,
                  y: isDragActive ? -10 : 0,
                  rotate: isDragActive ? 5 : 0
                }}
                transition={{ type: "spring", stiffness: 300 }}
                className={cn(
                  "mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6",
                  "bg-gradient-to-br shadow-xl",
                  isDragActive 
                    ? "from-indigo-500 to-purple-600 shadow-indigo-300/50"
                    : "from-slate-100 to-slate-200 shadow-slate-200/50"
                )}
              >
                <Upload className={cn(
                  "h-8 w-8 transition-colors",
                  isDragActive ? "text-white" : "text-slate-500"
                )} />
              </motion.div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isDragActive 
                  ? "Drop files to upload" 
                  : "Drop contract files here"}
              </h3>
              <p className="text-base text-slate-500 mb-6">
                or <span className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">browse</span> to select files
              </p>
              
              <div className="flex items-center justify-center gap-8 text-sm text-slate-400">
                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                  <FileText className="h-4 w-4" />
                  PDF, DOC, DOCX
                </span>
                <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                  <Shield className="h-4 w-4" />
                  Max 100MB
                </span>
                <span className="flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 rounded-full text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                  AI-powered
                </span>
              </div>
            </div>
            
            {/* Decorative gradient */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full blur-3xl" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full blur-3xl" />
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6"
            >
              <Card className="border-slate-200/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Files className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {stats.total} {stats.total === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      
                      {stats.pending > 0 && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                          <CircleDot className="h-3 w-3 mr-1" />
                          {stats.pending} pending
                        </Badge>
                      )}
                      
                      {stats.inProgress > 0 && (
                        <Badge className="bg-blue-100 text-blue-700">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {stats.inProgress} processing
                        </Badge>
                      )}
                      
                      {stats.completed > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {stats.completed} complete
                        </Badge>
                      )}
                      
                      {stats.errors > 0 && (
                        <Badge className="bg-rose-100 text-rose-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {stats.errors} errors
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {stats.completed > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={clearCompleted}
                          className="text-slate-500"
                        >
                          Clear completed
                        </Button>
                      )}
                      
                      {stats.pending > 0 && (
                        <Button
                          onClick={uploadAll}
                          disabled={isUploading}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-200"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Process {stats.pending} {stats.pending === 1 ? 'file' : 'files'}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Queue */}
        <div className="mt-6 space-y-3">
          <AnimatePresence mode="popLayout">
            {files.map((file, index) => (
              <FileCard
                key={file.id}
                file={file}
                index={index}
                ocrMode={ocrMode}
                onRemove={removeFile}
                onToggleArtifacts={toggleArtifacts}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State Tips */}
        {files.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                What happens after upload?
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  title: 'Text Extraction',
                  description: 'AI extracts all text and structure from your document',
                  icon: FileText,
                  color: 'from-blue-500 to-cyan-500'
                },
                {
                  step: '2',
                  title: 'AI Analysis',
                  description: 'Generate overview, clauses, financial, risk & compliance artifacts',
                  icon: Brain,
                  color: 'from-violet-500 to-purple-500'
                },
                {
                  step: '3',
                  title: 'Ready to Use',
                  description: 'Search, analyze, and manage your contract with AI insights',
                  icon: Sparkles,
                  color: 'from-amber-500 to-orange-500'
                }
              ].map((step, i) => (
                <div 
                  key={step.step}
                  className="relative p-5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm",
                      step.color
                    )}>
                      <step.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{step.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{step.description}</p>
                    </div>
                  </div>
                  
                  {i < 2 && (
                    <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// File Card Component
interface FileCardProps {
  file: UploadFile
  index: number
  ocrMode: OcrMode
  onRemove: (id: string) => void
  onToggleArtifacts: (id: string) => void
}

function FileCard({ file, index, ocrMode, onRemove, onToggleArtifacts }: FileCardProps) {
  const getStatusBadge = () => {
    switch (file.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-600">
            <CircleDot className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'uploading':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Uploading
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-indigo-100 text-indigo-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {file.processingStage 
              ? file.processingStage.replace(/_/g, ' ').toLowerCase()
              : 'Processing'}
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-rose-100 text-rose-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
    }
  };

  const progressGradient = file.status === 'completed'
    ? 'from-emerald-500 to-green-500'
    : file.status === 'error'
    ? 'from-rose-500 to-red-500'
    : 'from-indigo-500 to-purple-500';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={cn(
        "overflow-hidden transition-all duration-300",
        "border-slate-200/80 hover:border-slate-300",
        file.status === 'completed' && "border-emerald-200/80",
        file.status === 'error' && "border-rose-200/80"
      )}>
        <CardContent className="p-0">
          {/* Progress bar at top */}
          {(file.status === 'uploading' || file.status === 'processing' || file.status === 'completed') && (
            <div className="h-1 bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${file.progress}%` }}
                transition={{ duration: 0.5 }}
                className={cn("h-full bg-gradient-to-r", progressGradient)}
              />
            </div>
          )}
          
          <div className="p-4">
            <div className="flex items-center gap-4">
              {/* File Icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                file.status === 'completed' 
                  ? "bg-gradient-to-br from-emerald-500 to-green-600"
                  : file.status === 'error'
                  ? "bg-gradient-to-br from-rose-500 to-red-600"
                  : "bg-gradient-to-br from-slate-100 to-slate-200"
              )}>
                <FileText className={cn(
                  "h-6 w-6",
                  file.status === 'completed' || file.status === 'error'
                    ? "text-white"
                    : "text-slate-500"
                )} />
              </div>
              
              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-slate-900 truncate">
                    {file.file.name}
                  </p>
                  {getStatusBadge()}
                </div>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span>{formatFileSize(file.file.size)}</span>
                  {file.status === 'pending' && file.estimatedTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Est. {formatTime(file.estimatedTime)}
                    </span>
                  )}
                  {file.error && (
                    <span className="text-rose-600">{file.error}</span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {file.status === 'completed' && file.contractId && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleArtifacts(file.id)}
                      className="text-slate-600"
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      {file.showArtifacts ? 'Hide' : 'View'}
                    </Button>
                    
                    <Link href={`/contracts/${file.contractId}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </Link>
                  </>
                )}
                
                {(file.status === 'pending' || file.status === 'error') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(file.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            {/* Real-time Artifact Viewer */}
            <AnimatePresence>
              {file.showArtifacts && file.contractId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-slate-100"
                >
                  <RealtimeArtifactViewer
                    contractId={file.contractId}
                    tenantId="demo"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

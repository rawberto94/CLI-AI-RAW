'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RealtimeArtifactViewer } from '@/components/contracts/RealtimeArtifactViewer'
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
  ChevronRight
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
}

export default function UploadPage() {
  const router = useRouter()
  const { dataMode, isRealData, isMockData, isAIGenerated } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [ocrMode, setOcrMode] = useState<'gpt4' | 'mistral' | 'tesseract'>('gpt4')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/html': ['.html']
    },
    multiple: true,
    maxSize: 100 * 1024 * 1024 // 100MB
  })

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('dataMode', dataMode)
    formData.append('ocrMode', ocrMode)

    try {
      // Update to uploading
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'uploading', progress: 10, processingStage: 'Uploading file...' }
          : f
      ))

      // Simulate upload progress
      for (let i = 10; i <= 50; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200))
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, progress: i } : f
        ))
      }

      // Upload file
      console.log('[Upload] Starting upload for file:', uploadFile.file.name);
      const uploadResponse = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'x-data-mode': dataMode
        }
      })

      console.log('[Upload] Response status:', uploadResponse.status);
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[Upload] Upload failed:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status}`)
      }

      const responseData = await uploadResponse.json()
      console.log('[Upload] Response data:', responseData);
      const { contractId } = responseData

      if (!contractId) {
        console.error('[Upload] No contract ID in response:', responseData);
        throw new Error('No contract ID returned')
      }

      console.log('[Upload] Switching to processing state with contract ID:', contractId);

      // Update to processing with artifact viewer enabled
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'processing', progress: 60, contractId, processingStage: 'Processing with AI...', showArtifacts: true }
          : f
      ))

      // Note: Real-time SSE will handle the rest of the progress updates
      // The RealtimeArtifactViewer component will show live artifact generation

    } catch (error) {
      console.error('[Upload] Error during upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', progress: 0, error: errorMessage }
          : f
      ))
    }
  }

  const handleUploadAll = async () => {
    setIsUploading(true)
    const pendingFiles = files.filter(f => f.status === 'pending')
    
    // Upload files sequentially (or in parallel batches)
    for (const file of pendingFiles) {
      await uploadFile(file)
    }
    
    setIsUploading(false)
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'))
  }

  const viewContract = (contractId: string) => {
    router.push(`/contracts/${contractId}`)
  }

  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length
  const pendingCount = files.filter(f => f.status === 'pending').length
  const processingCount = files.filter(f => f.status === 'processing').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]"></div>
          <div className="relative px-8 py-12 md:px-12 md:py-16">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                <Upload className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  Upload Contracts
                </h1>
                <p className="text-blue-100 text-lg">
                  AI-powered contract analysis in seconds
                </p>
              </div>
            </div>
            
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Using {dataMode} mode
              </Badge>
              {isMockData && (
                <Badge className="bg-yellow-500/20 text-yellow-100 border-yellow-300/30 px-4 py-2 text-sm backdrop-blur-sm">
                  <Info className="h-4 w-4 mr-2" />
                  Simulated uploads
                </Badge>
              )}
              {isAIGenerated && (
                <Badge className="bg-purple-500/20 text-purple-100 border-purple-300/30 px-4 py-2 text-sm backdrop-blur-sm">
                  <Brain className="h-4 w-4 mr-2" />
                  AI-generated processing
                </Badge>
              )}
              <Link href="/contracts">
                <Button variant="ghost" className="text-white hover:bg-white/20 ml-auto">
                  View All Contracts
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Feature 1 */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white shadow-xl border-0">
              <CardContent className="p-6">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg w-fit mb-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Lightning Fast</h3>
                <p className="text-sm text-gray-600">
                  AI-powered extraction processes contracts in seconds, not hours
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature 2 */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white shadow-xl border-0">
              <CardContent className="p-6">
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg w-fit mb-4">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Secure Storage</h3>
                <p className="text-sm text-gray-600">
                  Bank-grade encryption with full compliance and data protection
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature 3 */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white shadow-xl border-0">
              <CardContent className="p-6">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg w-fit mb-4">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-600">
                  Advanced GPT-4 models extract clauses, risks, and insights
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature 4 */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
            <Card className="relative bg-white shadow-xl border-0">
              <CardContent className="p-6">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg w-fit mb-4">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">Real-time Status</h3>
                <p className="text-sm text-gray-600">
                  Watch AI generate artifacts live with instant progress updates
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* OCR Model Selector */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Select AI/OCR Model
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setOcrMode('gpt4')}
                    className={cn(
                      'relative p-4 rounded-xl border-2 text-left transition-all',
                      ocrMode === 'gpt4'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className={cn('h-5 w-5', ocrMode === 'gpt4' ? 'text-blue-600' : 'text-gray-600')} />
                      <span className={cn('font-bold', ocrMode === 'gpt4' ? 'text-blue-900' : 'text-gray-900')}>
                        GPT-4 Vision
                      </span>
                      {ocrMode === 'gpt4' && (
                        <CheckCircle className="h-5 w-5 text-blue-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">Highest accuracy, best for complex documents</p>
                    <Badge className="mt-2 bg-green-100 text-green-700 text-xs">Recommended</Badge>
                  </button>

                  <button
                    onClick={() => setOcrMode('mistral')}
                    className={cn(
                      'relative p-4 rounded-xl border-2 text-left transition-all',
                      ocrMode === 'mistral'
                        ? 'border-purple-500 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className={cn('h-5 w-5', ocrMode === 'mistral' ? 'text-purple-600' : 'text-gray-600')} />
                      <span className={cn('font-bold', ocrMode === 'mistral' ? 'text-purple-900' : 'text-gray-900')}>
                        Mistral OCR
                      </span>
                      {ocrMode === 'mistral' && (
                        <CheckCircle className="h-5 w-5 text-purple-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">Fast processing, specialized OCR model</p>
                    <Badge className="mt-2 bg-purple-100 text-purple-700 text-xs">New</Badge>
                  </button>

                  <button
                    onClick={() => setOcrMode('tesseract')}
                    className={cn(
                      'relative p-4 rounded-xl border-2 text-left transition-all',
                      ocrMode === 'tesseract'
                        ? 'border-orange-500 bg-orange-50 shadow-md'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className={cn('h-5 w-5', ocrMode === 'tesseract' ? 'text-orange-600' : 'text-gray-600')} />
                      <span className={cn('font-bold', ocrMode === 'tesseract' ? 'text-orange-900' : 'text-gray-900')}>
                        Tesseract
                      </span>
                      {ocrMode === 'tesseract' && (
                        <CheckCircle className="h-5 w-5 text-orange-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">Free open-source, good for simple text</p>
                    <Badge className="mt-2 bg-orange-100 text-orange-700 text-xs">Free</Badge>
                  </button>
                </div>
              </div>
              <div className="hidden lg:block w-64 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Model Info</h4>
                {ocrMode === 'gpt4' && (
                  <p className="text-xs text-gray-700">
                    OpenAI GPT-4 Vision provides the most accurate extraction with advanced understanding of document structure and context.
                  </p>
                )}
                {ocrMode === 'mistral' && (
                  <p className="text-xs text-gray-700">
                    Mistral OCR is optimized for fast document processing with specialized training on contracts and legal documents.
                  </p>
                )}
                {ocrMode === 'tesseract' && (
                  <p className="text-xs text-gray-700">
                    Tesseract is an open-source OCR engine, best for simple documents with clear text. No AI costs.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div
              {...getRootProps()}
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300',
                isDragActive
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50/30 hover:scale-[1.01]'
              )}
            >
              <input {...getInputProps()} />
              <div className="relative">
                {isDragActive ? (
                  <>
                    <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full w-fit mx-auto mb-6 shadow-xl animate-bounce">
                      <Upload className="h-12 w-12 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mb-2">
                      Drop your files here!
                    </p>
                    <p className="text-gray-600">
                      Release to start uploading
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full w-fit mx-auto mb-6 shadow-xl">
                      <Upload className="h-12 w-12 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 mb-3">
                      Drag & drop contracts here
                    </p>
                    <p className="text-gray-600 mb-6 text-lg">
                      or click to browse your files
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                      <Badge variant="outline" className="text-sm px-4 py-2">
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Badge>
                      <Badge variant="outline" className="text-sm px-4 py-2">
                        <FileText className="h-4 w-4 mr-2" />
                        DOC
                      </Badge>
                      <Badge variant="outline" className="text-sm px-4 py-2">
                        <FileText className="h-4 w-4 mr-2" />
                        DOCX
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Maximum file size: 50MB per file • Upload multiple files at once
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Bar */}
        {files.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{files.length}</p>
                    <p className="text-sm text-gray-600">Total Files</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{processingCount}</p>
                    <p className="text-sm text-gray-600">Processing</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                    <p className="text-sm text-gray-600">Errors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* File Queue */}
        {files.length > 0 && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Upload Queue</h2>
                  <p className="text-gray-600 mt-1">{files.length} file(s) in queue</p>
                </div>
                <div className="flex items-center gap-3">
                  {completedCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={clearCompleted}
                      className="hover:bg-gray-100"
                    >
                      Clear Completed
                    </Button>
                  )}
                  {pendingCount > 0 && (
                    <Button
                      onClick={handleUploadAll}
                      disabled={isUploading}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mr-2" />
                          Upload All ({pendingCount})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {files.map(uploadFile => (
                  <div
                    key={uploadFile.id}
                    className="border-2 border-gray-200 rounded-xl p-6 space-y-4 hover:border-blue-300 transition-colors bg-white shadow-sm"
                  >
                    {/* File Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-lg truncate">
                            {uploadFile.file.name}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-gray-500">
                              {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            {uploadFile.processingStage && (
                              <>
                                <span className="text-gray-300">•</span>
                                <p className="text-sm text-gray-600">
                                  {uploadFile.processingStage}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadFile.status === 'completed' && uploadFile.contractId && (
                          <>
                            <Button
                              onClick={() => viewContract(uploadFile.contractId!)}
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Contract
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(uploadFile.id)}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          </>
                        )}
                        {(uploadFile.status === 'pending' || uploadFile.status === 'error') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(uploadFile.id)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      {uploadFile.status === 'pending' && (
                        <Badge className="bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium">
                          <Clock className="h-4 w-4 mr-2" />
                          Pending
                        </Badge>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-md">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading {uploadFile.progress}%
                        </Badge>
                      )}
                      {uploadFile.status === 'processing' && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 text-sm font-medium shadow-md">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing with AI
                        </Badge>
                      )}
                      {uploadFile.status === 'completed' && (
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 text-sm font-medium shadow-md">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Completed Successfully
                        </Badge>
                      )}
                      {uploadFile.status === 'error' && (
                        <Badge className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 text-sm font-medium shadow-md">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Upload Failed
                        </Badge>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                      <div className="space-y-2">
                        <Progress 
                          value={uploadFile.progress} 
                          className="h-3 bg-gray-200"
                        />
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {uploadFile.status === 'uploading' ? 'Uploading file...' : 'Analyzing with AI...'}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {uploadFile.progress}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {uploadFile.status === 'error' && uploadFile.error && (
                      <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-semibold text-red-900">Upload Failed</p>
                            <p className="text-sm text-red-700 mt-1">{uploadFile.error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    {uploadFile.status === 'completed' && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Processing Complete!</p>
                            <p className="text-sm text-green-700 mt-1">
                              Contract analyzed successfully with AI-powered insights
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewContract(uploadFile.contractId!)}
                            className="text-green-700 hover:text-green-800 hover:bg-green-100"
                          >
                            View Details
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Real-time Artifact Viewer */}
                    {uploadFile.contractId && uploadFile.status === 'processing' && uploadFile.showArtifacts && (
                      <div className="mt-6 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <h3 className="font-semibold text-purple-900">Live AI Processing</h3>
                        </div>
                        <RealtimeArtifactViewer
                          contractId={uploadFile.contractId}
                          onComplete={() => {
                            setFiles(prev => prev.map(f =>
                              f.id === uploadFile.id
                                ? { ...f, status: 'completed', progress: 100 }
                                : f
                            ))
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        {files.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-900 text-lg">Quick Tips</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>Upload multiple contracts at once for batch processing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>Watch AI generate insights in real-time during upload</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>View and analyze contracts immediately after processing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span>Switch data modes to test with mock or AI-generated data</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-900 text-lg">What Gets Extracted</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Overview:</strong> Parties, dates, and executive summary</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Clauses:</strong> All contract clauses with obligations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Financial:</strong> Payment terms, rates, and schedules</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Risk Analysis:</strong> Risk factors with severity levels</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span><strong>Compliance:</strong> Regulatory requirements and gaps</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  FileText,
  Sparkles,
  Download,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  contractId?: string
  error?: string
  processingStage?: string
}

export function ImprovedUploadZone() {
  const router = useRouter()
  const { dataMode, isRealData, isMockData, isAIGenerated } = useDataMode()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024 // 50MB
  })

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    formData.append('dataMode', dataMode)

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
      const uploadResponse = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'x-data-mode': dataMode
        }
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      const { contractId } = await uploadResponse.json()

      // Update to processing
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'processing', progress: 60, contractId, processingStage: 'Extracting text...' }
          : f
      ))

      // Simulate processing stages
      const stages = [
        { progress: 70, stage: 'Analyzing structure...' },
        { progress: 80, stage: 'Extracting artifacts...' },
        { progress: 90, stage: 'Generating insights...' }
      ]

      for (const { progress, stage } of stages) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id
            ? { ...f, progress, processingStage: stage }
            : f
        ))
      }

      // Complete
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'completed', progress: 100, processingStage: 'Complete!' }
          : f
      ))

    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
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

  return (
    <div className="space-y-6">
      {/* Data Mode Indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Sparkles className="h-4 w-4" />
        <span>
          Using <strong>{dataMode}</strong> data mode
          {isMockData && ' - Simulated uploads'}
          {isAIGenerated && ' - AI-generated processing'}
        </span>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drag & drop contracts here
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to browse files
                </p>
                <p className="text-xs text-gray-400">
                  Supports PDF, DOC, DOCX • Max 50MB per file
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Upload Queue ({files.length} files)
            </CardTitle>
            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompleted}
                >
                  Clear Completed
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  onClick={handleUploadAll}
                  disabled={isUploading}
                  size="sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload All ({pendingCount})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Summary Stats */}
            {(completedCount > 0 || errorCount > 0) && (
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                {completedCount > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{completedCount} completed</span>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{errorCount} failed</span>
                  </div>
                )}
              </div>
            )}

            {/* File Items */}
            {files.map(uploadFile => (
              <div
                key={uploadFile.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadFile.status === 'completed' && uploadFile.contractId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewContract(uploadFile.contractId!)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {uploadFile.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {uploadFile.status === 'error' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {uploadFile.status === 'pending' && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {uploadFile.status === 'uploading' && (
                    <Badge className="bg-blue-100 text-blue-700">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading
                    </Badge>
                  )}
                  {uploadFile.status === 'processing' && (
                    <Badge className="bg-purple-100 text-purple-700">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {uploadFile.status === 'completed' && (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                  {uploadFile.status === 'error' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  {uploadFile.processingStage && (
                    <span className="text-xs text-gray-500">
                      {uploadFile.processingStage}
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
                  <div className="space-y-1">
                    <Progress value={uploadFile.progress} className="h-2" />
                    <p className="text-xs text-gray-500 text-right">
                      {uploadFile.progress}%
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {uploadFile.status === 'error' && uploadFile.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {uploadFile.error}
                  </div>
                )}

                {/* Success Actions */}
                {uploadFile.status === 'completed' && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                    <CheckCircle className="h-4 w-4" />
                    <span>Contract processed successfully!</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      {files.length === 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-blue-900">
                  Quick Upload Tips
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Upload multiple files at once</li>
                  <li>• Track processing in real-time</li>
                  <li>• View contracts immediately after processing</li>
                  <li>• Switch data modes to test with mock/AI data</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

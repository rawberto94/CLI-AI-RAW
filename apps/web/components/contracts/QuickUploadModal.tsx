'use client'

/**
 * Quick Upload Modal
 * 
 * A fast, streamlined upload experience accessible from anywhere in the app.
 * Supports drag & drop, file picker, and shows real-time progress.
 */

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  File,
  FileImage,
  Trash2,
  Plus,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner'

// ============ TYPES ============

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
  progress: number
  contractId?: string
  error?: string
}

interface QuickUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (contractIds: string[]) => void
  defaultCategory?: string
}

// ============ FILE TYPE HELPERS ============

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />
  if (mimeType.includes('image')) return <FileImage className="h-5 w-5 text-violet-500" />
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="h-5 w-5 text-violet-500" />
  return <File className="h-5 w-5 text-slate-500" />
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/html',
  'image/png',
  'image/jpeg',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// ============ COMPONENT ============

export function QuickUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  defaultCategory,
}: QuickUploadModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [category, setCategory] = useState(defaultCategory || '')
  const [ocrMode, setOcrMode] = useState('auto')
  const [showSuccess, setShowSuccess] = useState(false)
  const [uploadedContractIds, setUploadedContractIds] = useState<string[]>([])
  
  // Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `File type "${file.type}" is not supported`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`
    }
    return null
  }
  
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const validFiles: UploadFile[] = []
    
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast.error(`${file.name}: ${error}`)
        continue
      }
      
      // Check for duplicates
      const isDuplicate = files.some(f => f.file.name === file.name && f.file.size === file.size)
      if (isDuplicate) {
        toast.warning(`${file.name} is already in the queue`)
        continue
      }
      
      validFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'pending',
        progress: 0,
      })
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }
  }, [files])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
    }
  }, [addFiles])
  
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])
  
  const uploadFile = async (uploadFile: UploadFile): Promise<{ success: boolean; contractId?: string; error?: string }> => {
    const formData = new FormData()
    formData.append('file', uploadFile.file)
    if (category) {
      formData.append('category', category)
    }
    if (ocrMode && ocrMode !== 'auto') {
      formData.append('ocrMode', ocrMode)
    }
    
    try {
      // Do NOT set Content-Type header — the browser sets it automatically
      // with the correct multipart boundary for FormData.
      // Setting it manually (or via a default header interceptor) causes
      // the server to reject the request.
      const tenantId = getTenantId();
      const headers: Record<string, string> = {};
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }

      const response = await fetch('/api/contracts/upload', {
        method: 'POST',
        headers,
        body: formData,
      })
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: `Upload failed with status ${response.status}` }))
        throw new Error(data.error || data.message || `Upload failed (${response.status})`)
      }
      
      const data = await response.json()
      return { success: true, contractId: data.data?.contractId || data.contract?.id || data.id }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }
  }
  
  const handleUploadAll = async () => {
    if (files.length === 0) return
    
    setIsUploading(true)
    const contractIds: string[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.status !== 'pending') continue
      
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading' as const, progress: 30 } : f
      ))
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => 
          f.id === file.id && f.status === 'uploading' 
            ? { ...f, progress: Math.min(f.progress + 10, 80) } 
            : f
        ))
      }, 200)
      
      // Upload the file
      const result = await uploadFile(file)
      
      clearInterval(progressInterval)
      
      if (result.success && result.contractId) {
        contractIds.push(result.contractId)
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'complete' as const, progress: 100, contractId: result.contractId } 
            : f
        ))
      } else {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'error' as const, error: result.error } 
            : f
        ))
      }
    }
    
    setIsUploading(false)
    
    if (contractIds.length > 0) {
      setUploadedContractIds(contractIds)
      setShowSuccess(true)
      onUploadComplete?.(contractIds)
    }
  }
  
  const handleClose = () => {
    if (isUploading) {
      toast.warning('Please wait for uploads to complete')
      return
    }
    setFiles([])
    setShowSuccess(false)
    setUploadedContractIds([])
    onClose()
  }
  
  const handleViewContracts = () => {
    handleClose()
    if (uploadedContractIds.length === 1) {
      router.push(`/contracts/${uploadedContractIds[0]}`)
    } else {
      router.push('/contracts')
    }
  }
  
  const pendingCount = files.filter(f => f.status === 'pending').length
  const completedCount = files.filter(f => f.status === 'complete').length
  const errorCount = files.filter(f => f.status === 'error').length
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-violet-500" />
            Quick Upload
          </DialogTitle>
          <DialogDescription>
            Drop files here or click to browse. Supports PDF, Word, and images.
          </DialogDescription>
        </DialogHeader>
        
        <AnimatePresence mode="wait">
          {showSuccess ? (
            // Success State
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="p-4 bg-violet-100 rounded-full mb-4"
              >
                <CheckCircle2 className="h-12 w-12 text-violet-600" />
              </motion.div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Upload Complete!
              </h3>
              <p className="text-slate-600 mb-6">
                {uploadedContractIds.length} contract{uploadedContractIds.length > 1 ? 's' : ''} uploaded successfully
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => {
                  setShowSuccess(false)
                  setFiles([])
                  setUploadedContractIds([])
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload More
                </Button>
                <Button onClick={handleViewContracts}>
                  View Contract{uploadedContractIds.length > 1 ? 's' : ''}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          ) : (
            // Upload State
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4 overflow-hidden"
            >
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer",
                  isDragging
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-200 hover:border-violet-400 hover:bg-slate-50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    animate={{ y: isDragging ? -5 : 0 }}
                    className={cn(
                      "p-3 rounded-xl mb-3 transition-colors",
                      isDragging ? "bg-violet-100" : "bg-slate-100"
                    )}
                  >
                    <Upload className={cn(
                      "h-8 w-8 transition-colors",
                      isDragging ? "text-violet-600" : "text-slate-400"
                    )} />
                  </motion.div>
                  <p className="text-sm font-medium text-slate-700">
                    {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, Word, or images up to 50MB
                  </p>
                </div>
              </div>
              
              {/* Category Selection */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contract Category (Optional)</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="services">Service Agreement</SelectItem>
                      <SelectItem value="nda">Non-Disclosure Agreement</SelectItem>
                      <SelectItem value="employment">Employment Contract</SelectItem>
                      <SelectItem value="procurement">Procurement Contract</SelectItem>
                      <SelectItem value="license">License Agreement</SelectItem>
                      <SelectItem value="lease">Lease Agreement</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* OCR Processing Mode */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">OCR Processing Mode</Label>
                  <Select value={ocrMode} onValueChange={setOcrMode}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select OCR mode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                      <SelectItem value="azure-di-layout">Azure DI — Layout Analysis</SelectItem>
                      <SelectItem value="azure-di-contract">Azure DI — Contract Model</SelectItem>
                      <SelectItem value="azure-di-invoice">Azure DI — Invoice Model</SelectItem>
                      <SelectItem value="azure-di-read">Azure DI — Read (Lightweight)</SelectItem>
                      <SelectItem value="openai">OpenAI Vision</SelectItem>
                      <SelectItem value="mistral">Mistral OCR</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Auto-detect selects the best model based on document type
                  </p>
                </div>
              )}
              
              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {files.length} file{files.length > 1 ? 's' : ''} selected
                    </span>
                    {files.length > 1 && !isUploading && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setFiles([])}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {files.map((file) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                          file.status === 'complete' && "bg-violet-50 border-violet-200",
                          file.status === 'error' && "bg-red-50 border-red-200",
                          file.status === 'uploading' && "bg-violet-50 border-violet-200",
                          file.status === 'pending' && "bg-white border-slate-200"
                        )}
                      >
                        {getFileIcon(file.file.type)}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {file.file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              {formatFileSize(file.file.size)}
                            </span>
                            {file.status === 'uploading' && (
                              <span className="text-xs text-violet-600">
                                {file.progress}%
                              </span>
                            )}
                            {file.status === 'complete' && (
                              <span className="text-xs text-violet-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Uploaded
                              </span>
                            )}
                            {file.status === 'error' && (
                              <span className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {file.error || 'Failed'}
                              </span>
                            )}
                          </div>
                          
                          {file.status === 'uploading' && (
                            <Progress value={file.progress} className="h-1 mt-2" />
                          )}
                        </div>
                        
                        {file.status === 'pending' && !isUploading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(file.id)
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {file.status === 'uploading' && (
                          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                        )}
                        
                        {file.status === 'complete' && (
                          <CheckCircle2 className="h-5 w-5 text-violet-600" />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  {completedCount > 0 && (
                    <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                      {completedCount} uploaded
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      {errorCount} failed
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUploadAll}
                    disabled={pendingCount === 0 || isUploading}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

export default QuickUploadModal

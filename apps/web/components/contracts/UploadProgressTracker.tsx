'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Pause, 
  Play, 
  X,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import { fadeIn, progressAnimation } from '@/lib/contracts/animations'
import { cn } from '@/lib/utils'

export interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'
  progress: number
  error?: string
  uploadedAt?: Date
  contractId?: string
  retryCount: number
}

export interface UploadProgress {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  totalBytes: number
  uploadedBytes: number
  overallProgress: number
  isUploading: boolean
  estimatedTimeRemaining?: number
}

export interface UploadProgressTrackerProps {
  files: UploadFile[]
  progress: UploadProgress
  onCancel?: (fileId: string) => void
  onRetry?: (fileId: string) => void
  onRemove?: (fileId: string) => void
  onPauseAll?: () => void
  onResumeAll?: () => void
  onCancelAll?: () => void
  className?: string
  compact?: boolean
}

export function UploadProgressTracker({
  files,
  progress,
  onCancel,
  onRetry,
  onRemove,
  onPauseAll,
  onResumeAll,
  onCancelAll,
  className,
  compact = false
}: UploadProgressTrackerProps) {
  if (files.length === 0) return null

  const { 
    totalFiles, 
    completedFiles, 
    failedFiles, 
    totalBytes, 
    uploadedBytes, 
    overallProgress, 
    isUploading,
    estimatedTimeRemaining 
  } = progress

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`
    return `${seconds}s remaining`
  }

  const formatUploadSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }

  const uploadSpeed = estimatedTimeRemaining && uploadedBytes > 0 
    ? uploadedBytes / (Date.now() - (estimatedTimeRemaining + Date.now()))
    : 0

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isUploading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              ) : completedFiles === totalFiles ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : failedFiles > 0 ? (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              ) : (
                <Pause className="w-4 h-4 text-gray-400" />
              )}
              <h3 className="text-sm font-medium text-gray-900">
                {isUploading ? 'Uploading...' : 
                 completedFiles === totalFiles ? 'Upload Complete' :
                 failedFiles > 0 ? 'Upload Issues' : 'Upload Paused'}
              </h3>
            </div>
            
            <div className="text-xs text-gray-500">
              {completedFiles}/{totalFiles} files • {formatFileSize(uploadedBytes)}/{formatFileSize(totalBytes)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isUploading && onPauseAll && (
              <button
                onClick={onPauseAll}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Pause all uploads"
              >
                <Pause className="w-4 h-4 text-gray-600" />
              </button>
            )}
            
            {!isUploading && onResumeAll && (
              <button
                onClick={onResumeAll}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Resume uploads"
              >
                <Play className="w-4 h-4 text-gray-600" />
              </button>
            )}
            
            {onCancelAll && (
              <button
                onClick={onCancelAll}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Cancel all uploads"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Overall Progress</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full transition-colors',
                isUploading ? 'bg-blue-500' :
                completedFiles === totalFiles ? 'bg-green-500' :
                failedFiles > 0 ? 'bg-yellow-500' : 'bg-gray-400'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          {(isUploading || estimatedTimeRemaining) && (
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>
                {uploadSpeed > 0 && formatUploadSpeed(uploadSpeed)}
              </span>
              <span>
                {estimatedTimeRemaining && formatTimeRemaining(estimatedTimeRemaining)}
              </span>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <div className="max-h-60 overflow-y-auto">
          <AnimatePresence>
            {files.map((file) => (
              <FileProgressItem
                key={file.id}
                file={file}
                onCancel={onCancel}
                onRetry={onRetry}
                onRemove={onRemove}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {compact && (
        <div className="px-4 py-2 text-xs text-gray-600">
          {completedFiles > 0 && (
            <span className="text-green-600">{completedFiles} completed</span>
          )}
          {failedFiles > 0 && (
            <span className="text-red-600 ml-2">{failedFiles} failed</span>
          )}
          {isUploading && (
            <span className="text-blue-600 ml-2">
              {files.filter(f => f.status === 'uploading').length} uploading
            </span>
          )}
        </div>
      )}
    </motion.div>
  )
}

interface FileProgressItemProps {
  file: UploadFile
  onCancel?: (fileId: string) => void
  onRetry?: (fileId: string) => void
  onRemove?: (fileId: string) => void
}

function FileProgressItem({ file, onCancel, onRetry, onRemove }: FileProgressItemProps) {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <X className="w-4 h-4 text-gray-400" />
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getStatusColor = () => {
    switch (file.status) {
      case 'uploading':
        return 'bg-blue-50 border-blue-100'
      case 'success':
        return 'bg-green-50 border-green-100'
      case 'error':
        return 'bg-red-50 border-red-100'
      case 'cancelled':
        return 'bg-gray-50 border-gray-100'
      default:
        return 'bg-white border-gray-100'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0',
        getStatusColor()
      )}
    >
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.file.name}
          </p>
          <span className="text-xs text-gray-500 ml-2">
            {formatFileSize(file.file.size)}
          </span>
        </div>
        
        {file.status === 'uploading' && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Uploading...</span>
              <span>{file.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="bg-blue-500 h-1.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${file.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
        
        {file.status === 'error' && file.error && (
          <p className="text-xs text-red-600 mt-1 truncate">
            {file.error}
            {file.retryCount > 0 && (
              <span className="ml-1">(Retry {file.retryCount})</span>
            )}
          </p>
        )}
        
        {file.status === 'success' && file.uploadedAt && (
          <p className="text-xs text-green-600 mt-1">
            Uploaded at {file.uploadedAt.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        {file.status === 'uploading' && onCancel && (
          <button
            onClick={() => onCancel(file.id)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Cancel upload"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
        
        {file.status === 'error' && onRetry && (
          <button
            onClick={() => onRetry(file.id)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Retry upload"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
        
        {(file.status === 'error' || file.status === 'cancelled') && onRemove && (
          <button
            onClick={() => onRemove(file.id)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Remove file"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Download,
  Eye,
  Trash2,
  Upload,
  FileText,
  Clock,
  PartyPopper
} from 'lucide-react'
import { bounceIn, shake, fadeIn, pulse } from '@/lib/contracts/animations'
import { cn } from '@/lib/utils'
import { UploadFile, formatFileSize } from '@/lib/contracts/upload-manager'
import { useState } from 'react'

export interface UploadSuccessStateProps {
  files: UploadFile[]
  onViewContract?: (contractId: string) => void
  onDownload?: (contractId: string) => void
  onStartNew?: () => void
  className?: string
}

export function UploadSuccessState({
  files,
  onViewContract,
  onDownload,
  onStartNew,
  className
}: UploadSuccessStateProps) {
  const successfulFiles = files.filter(f => f.status === 'success')
  const totalSize = successfulFiles.reduce((sum, f) => sum + f.file.size, 0)

  return (
    <motion.div
      variants={bounceIn}
      initial="initial"
      animate="animate"
      className={cn(
        'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 text-center',
        className
      )}
    >
      {/* Success Icon */}
      <motion.div
        variants={bounceIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.2 }}
        className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center"
      >
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </motion.div>

      {/* Success Message */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <h3 className="text-xl font-semibold text-green-800 mb-2">
          Upload Successful! 🎉
        </h3>
        <p className="text-green-700">
          {successfulFiles.length} file{successfulFiles.length !== 1 ? 's' : ''} uploaded successfully
          <span className="block text-sm text-green-600 mt-1">
            Total size: {formatFileSize(totalSize)}
          </span>
        </p>
      </motion.div>

      {/* File List */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.6 }}
        className="space-y-3 mb-6 max-h-40 overflow-y-auto"
      >
        {successfulFiles.map((file, index) => (
          <motion.div
            key={file.id}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.8 + index * 0.1 }}
            className="flex items-center justify-between bg-white/60 rounded-lg p-3 border border-green-200"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-green-800 truncate max-w-48">
                  {file.file.name}
                </p>
                <p className="text-xs text-green-600">
                  {formatFileSize(file.file.size)} • Uploaded {file.uploadedAt?.toLocaleTimeString()}
                </p>
              </div>
            </div>
            
            {file.contractId && (
              <div className="flex items-center gap-1">
                {onViewContract && (
                  <button
                    onClick={() => onViewContract(file.contractId!)}
                    className="p-1.5 hover:bg-green-200 rounded transition-colors"
                    title="View contract"
                  >
                    <Eye className="w-4 h-4 text-green-600" />
                  </button>
                )}
                {onDownload && (
                  <button
                    onClick={() => onDownload(file.contractId!)}
                    className="p-1.5 hover:bg-green-200 rounded transition-colors"
                    title="Download contract"
                  >
                    <Download className="w-4 h-4 text-green-600" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 1.0 }}
        className="flex items-center justify-center gap-3"
      >
        {onStartNew && (
          <button
            onClick={onStartNew}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload More Files
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

export interface UploadErrorStateProps {
  files: UploadFile[]
  onRetry?: (fileId: string) => void
  onRetryAll?: () => void
  onRemove?: (fileId: string) => void
  onStartNew?: () => void
  className?: string
}

export function UploadErrorState({
  files,
  onRetry,
  onRetryAll,
  onRemove,
  onStartNew,
  className
}: UploadErrorStateProps) {
  const errorFiles = files.filter(f => f.status === 'error')
  const [retryingFiles, setRetryingFiles] = useState<Set<string>>(new Set())

  const handleRetry = (fileId: string) => {
    setRetryingFiles(prev => new Set([...prev, fileId]))
    onRetry?.(fileId)
    setTimeout(() => {
      setRetryingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
    }, 2000)
  }

  const handleRetryAll = () => {
    const allErrorIds = errorFiles.map(f => f.id)
    setRetryingFiles(new Set(allErrorIds))
    onRetryAll?.()
    setTimeout(() => {
      setRetryingFiles(new Set())
    }, 2000)
  }

  return (
    <motion.div
      variants={shake}
      initial="initial"
      animate="animate"
      className={cn(
        'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-8 text-center',
        className
      )}
    >
      {/* Error Icon */}
      <motion.div
        variants={bounceIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.2 }}
        className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"
      >
        <XCircle className="w-8 h-8 text-red-600" />
      </motion.div>

      {/* Error Message */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <h3 className="text-xl font-semibold text-red-800 mb-2">
          Upload Failed
        </h3>
        <p className="text-red-700">
          {errorFiles.length} file{errorFiles.length !== 1 ? 's' : ''} failed to upload
          <span className="block text-sm text-red-600 mt-1">
            Please check the errors below and try again
          </span>
        </p>
      </motion.div>

      {/* Error File List */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.6 }}
        className="space-y-3 mb-6 max-h-40 overflow-y-auto"
      >
        {errorFiles.map((file, index) => (
          <motion.div
            key={file.id}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.8 + index * 0.1 }}
            className="flex items-center justify-between bg-white/60 rounded-lg p-3 border border-red-200"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-medium text-red-800 truncate">
                  {file.file.name}
                </p>
                <p className="text-xs text-red-600 truncate">
                  {file.error || 'Unknown error occurred'}
                  {file.retryCount > 0 && (
                    <span className="ml-1">(Retry {file.retryCount})</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleRetry(file.id)}
                disabled={retryingFiles.has(file.id)}
                className="p-1.5 hover:bg-red-200 rounded transition-colors disabled:opacity-50"
                title="Retry upload"
              >
                {retryingFiles.has(file.id) ? (
                  <motion.div variants={pulse} animate="animate">
                    <RefreshCw className="w-4 h-4 text-red-600 animate-spin" />
                  </motion.div>
                ) : (
                  <RefreshCw className="w-4 h-4 text-red-600" />
                )}
              </button>
              {onRemove && (
                <button
                  onClick={() => onRemove(file.id)}
                  className="p-1.5 hover:bg-red-200 rounded transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 1.0 }}
        className="flex items-center justify-center gap-3 flex-wrap"
      >
        {onRetryAll && errorFiles.length > 1 && (
          <button
            onClick={handleRetryAll}
            disabled={retryingFiles.size > 0}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {retryingFiles.size > 0 ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Retry All
          </button>
        )}
        
        {onStartNew && (
          <button
            onClick={onStartNew}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Start Over
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

export interface UploadMixedStateProps {
  files: UploadFile[]
  onViewContract?: (contractId: string) => void
  onDownload?: (contractId: string) => void
  onRetry?: (fileId: string) => void
  onRemove?: (fileId: string) => void
  onStartNew?: () => void
  className?: string
}

export function UploadMixedState({
  files,
  onViewContract,
  onDownload,
  onRetry,
  onRemove,
  onStartNew,
  className
}: UploadMixedStateProps) {
  const successFiles = files.filter(f => f.status === 'success')
  const errorFiles = files.filter(f => f.status === 'error')

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className={cn(
        'bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-8',
        className
      )}
    >
      {/* Mixed State Icon */}
      <motion.div
        variants={bounceIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.2 }}
        className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center"
      >
        <AlertTriangle className="w-8 h-8 text-yellow-600" />
      </motion.div>

      {/* Mixed State Message */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.4 }}
        className="mb-6 text-center"
      >
        <h3 className="text-xl font-semibold text-yellow-800 mb-2">
          Upload Partially Complete
        </h3>
        <p className="text-yellow-700">
          {successFiles.length} file{successFiles.length !== 1 ? 's' : ''} uploaded successfully, 
          {errorFiles.length} failed
        </p>
      </motion.div>

      {/* Success Files */}
      {successFiles.length > 0 && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <h4 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Successful Uploads ({successFiles.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {successFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-white/60 rounded-lg p-2 border border-green-200"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 truncate max-w-48">
                    {file.file.name}
                  </span>
                </div>
                {file.contractId && (
                  <div className="flex items-center gap-1">
                    {onViewContract && (
                      <button
                        onClick={() => onViewContract(file.contractId!)}
                        className="p-1 hover:bg-green-200 rounded transition-colors"
                        title="View contract"
                      >
                        <Eye className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Error Files */}
      {errorFiles.length > 0 && (
        <motion.div
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.8 }}
          className="mb-6"
        >
          <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Failed Uploads ({errorFiles.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {errorFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-white/60 rounded-lg p-2 border border-red-200"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-red-800 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-red-600 truncate">
                      {file.error}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onRetry && (
                    <button
                      onClick={() => onRetry(file.id)}
                      className="p-1 hover:bg-red-200 rounded transition-colors"
                      title="Retry upload"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(file.id)}
                      className="p-1 hover:bg-red-200 rounded transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        transition={{ delay: 1.0 }}
        className="flex items-center justify-center gap-3 flex-wrap"
      >
        {onStartNew && (
          <button
            onClick={onStartNew}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload More Files
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

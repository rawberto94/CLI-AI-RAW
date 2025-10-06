'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Plus,
  File
} from 'lucide-react'
import { fadeIn, bounceIn, shake } from '@/lib/contracts/animations'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

export interface ContractUploadZoneProps {
  onFilesAdded?: (files: File[]) => void
  onFileRemove?: (fileId: string) => void
  onUploadStart?: () => void
  maxFiles?: number
  maxSize?: number
  acceptedTypes?: string[]
  disabled?: boolean
  className?: string
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024

export function ContractUploadZone({
  onFilesAdded,
  onFileRemove,
  onUploadStart,
  maxFiles = 10,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  className
}: ContractUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false)

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type "${file.type}" is not supported.`
    }
    if (file.size > maxSize) {
      return `File size exceeds maximum of ${formatFileSize(maxSize)}.`
    }
    return null
  }, [acceptedTypes, maxSize])

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setDragActive(false)

    rejectedFiles.forEach(({ file, errors }) => {
      const errorMessage = errors.map((e: any) => e.message).join(', ')
      toast.error(`${file.name}: ${errorMessage}`)
    })

    const validFiles: File[] = []
    const invalidFiles: { file: File; error: string }[] = []

    acceptedFiles.forEach(file => {
      const error = validateFile(file)
      if (error) {
        invalidFiles.push({ file, error })
      } else {
        validFiles.push(file)
      }
    })

    invalidFiles.forEach(({ file, error }) => {
      toast.error(`${file.name}: ${error}`)
    })

    if (validFiles.length > maxFiles) {
      toast.error(`Cannot upload more than ${maxFiles} files at once.`)
      return
    }

    if (validFiles.length > 0) {
      onFilesAdded?.(validFiles)
      toast.success(`${validFiles.length} file(s) added successfully`)
    }
  }, [maxFiles, validateFile, onFilesAdded])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize,
    disabled,
    noClick: true
  })

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer',
          'hover:border-blue-400 hover:bg-blue-50/50',
          dragActive || isDragActive
            ? 'border-blue-500 bg-blue-50 scale-105'
            : 'border-gray-300 bg-gray-50/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={open}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {dragActive || isDragActive ? (
            <motion.div
              key="drag-active"
              variants={bounceIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-700">Drop files here</p>
                <p className="text-sm text-blue-600">Release to upload your contracts</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-colors bg-gray-100">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-700">
                  Upload Contract Files
                </p>
                <p className="text-sm text-gray-500">
                  Drag and drop files here, or{' '}
                  <span className="text-blue-600 font-medium">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Supports PDF, Word, and text files up to {formatFileSize(maxSize)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


    </div>
  )
}



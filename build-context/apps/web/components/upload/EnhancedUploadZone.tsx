/**
 * Enhanced Upload Zone Component
 * Drag & drop with preview, progress, and AI processing visualization
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ProgressBar, UploadProgress, StepIndicator, AIProcessingIndicator } from '@/components/ui/enhanced-progress';
import {
  Upload,
  FileText,
  X,
  Check,
  AlertCircle,
  FileImage,
  FileSpreadsheet,
  File,
  Sparkles,
  CloudUpload,
  Loader2,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  stage?: string;
  error?: string;
}

interface EnhancedUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string[];
  maxSize?: number; // in MB
  maxFiles?: number;
  className?: string;
}

export function EnhancedUploadZone({
  onUpload,
  accept = ['.pdf', '.docx', '.doc', '.txt', '.html', '.htm'],
  maxSize = 50,
  maxFiles = 10,
  className
}: EnhancedUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return FileText;
    if (type.includes('image')) return FileImage;
    if (type.includes('spreadsheet') || type.includes('excel')) return FileSpreadsheet;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!accept.includes(extension)) {
      return `File type ${extension} is not supported`;
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `File exceeds ${maxSize}MB limit`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles: FileWithPreview[] = [];
    
    Array.from(newFiles).slice(0, maxFiles - files.length).forEach(file => {
      const error = validateFile(file);
      validFiles.push({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        status: error ? 'error' : 'pending',
        progress: 0,
        error: error || undefined
      });
    });

    setFiles(prev => [...prev, ...validFiles]);
    
  }, [files.length, maxFiles, accept, maxSize]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Simulate upload and processing
    for (const fileObj of pendingFiles) {
      // Update to uploading
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));

      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 100));
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, progress: Math.min(i, 100) } : f
        ));
      }

      // Update to processing
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'processing' as const, stage: 'Analyzing with AI...', progress: 0 } : f
      ));

      // Simulate AI processing
      const stages = ['Extracting text...', 'Analyzing clauses...', 'Identifying risks...', 'Generating summary...'];
      for (let i = 0; i < stages.length; i++) {
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, stage: stages[i], progress: ((i + 1) / stages.length) * 100 } : f
        ));
        await new Promise(r => setTimeout(r, 500));
      }

      // Complete
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: 'completed' as const, progress: 100 } : f
      ));
    }

    try {
      await onUpload(pendingFiles.map(f => f.file));
    } catch {
      // Upload failed - error handled by caller
    }

    setIsUploading(false);
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const completedCount = files.filter(f => f.status === 'completed').length;
  const hasErrors = files.some(f => f.status === 'error');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          scale: isDragging ? 1.02 : 1,
          borderColor: isDragging ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)'
        }}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          isDragging 
            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400' 
            : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept.join(',')}
          onChange={(e) => addFiles(e.target.files)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <AnimatePresence mode="wait">
          {isDragging ? (
            <motion.div
              key="dragging"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="p-4 bg-violet-500 rounded-2xl mb-4"
              >
                <CloudUpload className="h-8 w-8 text-white" />
              </motion.div>
              <p className="text-lg font-medium text-violet-700 dark:text-violet-300">
                Drop files to upload
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl mb-4 shadow-lg shadow-violet-500/20">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Drag & drop your contracts
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse files
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Supported: {accept.join(', ')}</span>
                <span>•</span>
                <span>Max {maxSize}MB per file</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Badge */}
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full text-white text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            AI-Powered Analysis
          </div>
        </div>
      </motion.div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div key="files-length"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {files.map((fileObj) => (
              <FileItem
                key={fileObj.id}
                file={fileObj}
                onRemove={() => removeFile(fileObj.id)}
                getFileIcon={getFileIcon}
                formatFileSize={formatFileSize}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Button */}
      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="text-sm text-gray-500">
            {pendingCount > 0 && `${pendingCount} file${pendingCount > 1 ? 's' : ''} ready to upload`}
            {completedCount > 0 && pendingCount === 0 && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {completedCount} file{completedCount > 1 ? 's' : ''} uploaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={isUploading}
            >
              Clear All
            </Button>
            <Button
              onClick={handleUpload}
              disabled={pendingCount === 0 || isUploading}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {pendingCount > 0 ? `(${pendingCount})` : 'Files'}
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FileItem({
  file,
  onRemove,
  getFileIcon,
  formatFileSize
}: {
  file: FileWithPreview;
  onRemove: () => void;
  getFileIcon: (type: string) => React.ComponentType<{ className?: string }>;
  formatFileSize: (bytes: number) => string;
}) {
  const Icon = getFileIcon(file.file.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        file.status === 'error' 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
          : file.status === 'completed'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'p-2 rounded-lg',
        file.status === 'error' ? 'bg-red-100 dark:bg-red-900/50' :
        file.status === 'completed' ? 'bg-green-100 dark:bg-green-900/50' :
        file.status === 'processing' ? 'bg-violet-100 dark:bg-violet-900/50' :
        file.status === 'uploading' ? 'bg-violet-100 dark:bg-violet-900/50' :
        'bg-gray-100 dark:bg-gray-800'
      )}>
        {file.status === 'uploading' && (
          <Loader2 className="h-5 w-5 text-violet-600 animate-spin" />
        )}
        {file.status === 'processing' && (
          <Sparkles className="h-5 w-5 text-violet-600 animate-pulse" />
        )}
        {file.status === 'completed' && (
          <Check className="h-5 w-5 text-green-600" />
        )}
        {file.status === 'error' && (
          <AlertCircle className="h-5 w-5 text-red-600" />
        )}
        {file.status === 'pending' && (
          <Icon className="h-5 w-5 text-gray-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {file.file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {file.status === 'pending' && formatFileSize(file.file.size)}
          {file.status === 'uploading' && `Uploading... ${file.progress}%`}
          {file.status === 'processing' && (file.stage || 'Processing...')}
          {file.status === 'completed' && 'Upload complete'}
          {file.status === 'error' && (
            <span className="text-red-600">{file.error}</span>
          )}
        </p>

        {/* Progress bar */}
        {(file.status === 'uploading' || file.status === 'processing') && (
          <div className="mt-2">
            <ProgressBar
              value={file.progress}
              variant={file.status === 'processing' ? 'gradient' : 'default'}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Remove button */}
      {(file.status === 'pending' || file.status === 'error' || file.status === 'completed') && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </motion.div>
  );
}

export default EnhancedUploadZone;

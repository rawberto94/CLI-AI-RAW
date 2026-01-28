'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { 
  Upload, X, File, Image, FileText, Film, Music, Archive, 
  CheckCircle, AlertCircle, Loader2, Trash2, Eye, Download, RotateCcw
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface FileWithPreview extends File {
  preview?: string;
  id: string;
  progress?: number;
  status?: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// File Icon Helper
// ============================================================================

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('pdf') || type.includes('document')) return FileText;
  if (type.includes('zip') || type.includes('archive')) return Archive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// Drop Zone
// ============================================================================

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function DropZone({
  onFilesSelected,
  accept,
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  disabled = false,
  className = '',
  children,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => file.size <= maxSize).slice(0, maxFiles);
    onFilesSelected(validFiles);
  }, [disabled, maxSize, maxFiles, onFilesSelected]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => file.size <= maxSize).slice(0, maxFiles);
      onFilesSelected(validFiles);
    }
  }, [maxSize, maxFiles, onFilesSelected]);

  return (
    <motion.div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      animate={{
        scale: isDragging ? 1.02 : 1,
        borderColor: isDragging ? 'rgb(59, 130, 246)' : 'rgb(209, 213, 219)',
      }}
      className={`
        relative border-2 border-dashed rounded-xl p-8 cursor-pointer
        transition-all duration-200 bg-slate-50 dark:bg-slate-900
        ${isDragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50 shadow-lg shadow-violet-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/30'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      
      {children || (
        <div className="flex flex-col items-center text-center">
          <motion.div
            animate={{ y: isDragging ? -5 : 0 }}
            className="mb-4"
          >
            <Upload className={`w-12 h-12 ${isDragging ? 'text-violet-500' : 'text-gray-400'}`} />
          </motion.div>
          <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
            {isDragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
            or click to browse
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Max {formatFileSize(maxSize)} per file
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// File Preview Grid
// ============================================================================

interface FilePreviewGridProps {
  files: FileWithPreview[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

export function FilePreviewGrid({ files, onRemove, onRetry, className = '' }: FilePreviewGridProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 ${className}`}>
      {files.map(file => (
        <FilePreviewCard
          key={file.id}
          file={file}
          onRemove={() => onRemove(file.id)}
          onRetry={() => onRetry?.(file.id)}
        />
      ))}
    </div>
  );
}

interface FilePreviewCardProps {
  file: FileWithPreview;
  onRemove: () => void;
  onRetry?: () => void;
}

function FilePreviewCard({ file, onRemove, onRetry }: FilePreviewCardProps) {
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith('image/');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/10 transition-all"
    >
      <div className="aspect-square relative">
        {isImage && file.preview ? (
          <img
            src={file.preview}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Icon className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Status overlay */}
        <AnimatePresence>
          {file.status === 'uploading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center"
            >
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <span className="text-sm">{file.progress}%</span>
              </div>
            </motion.div>
          )}
          
          {file.status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-2 right-2"
            >
              <CheckCircle className="w-6 h-6 text-green-500 fill-white" />
            </motion.div>
          )}
          
          {file.status === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-red-500/20 flex items-center justify-center"
            >
              <AlertCircle className="w-8 h-8 text-red-500" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            {file.status === 'error' && onRetry && (
              <button
                onClick={onRetry}
                className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <button
              onClick={onRemove}
              className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-2">
        <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(file.size)}
        </p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// File List
// ============================================================================

interface FileListProps {
  files: FileWithPreview[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

export function FileList({ files, onRemove, onRetry, className = '' }: FileListProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <AnimatePresence>
        {files.map(file => (
          <FileListItem
            key={file.id}
            file={file}
            onRemove={() => onRemove(file.id)}
            onRetry={() => onRetry?.(file.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FileListItem({ file, onRemove, onRetry }: FilePreviewCardProps) {
  const Icon = getFileIcon(file.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {file.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatFileSize(file.size)}
        </p>
        
        {file.status === 'uploading' && file.progress !== undefined && (
          <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-600"
              initial={{ width: 0 }}
              animate={{ width: `${file.progress}%` }}
            />
          </div>
        )}
        
        {file.status === 'error' && file.error && (
          <p className="text-xs text-red-500 mt-1">{file.error}</p>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {file.status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
        )}
        {file.status === 'success' && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        {file.status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <button
          onClick={onRemove}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Upload Progress
// ============================================================================

interface UploadProgressProps {
  files: FileWithPreview[];
  totalProgress: number;
  className?: string;
}

export function UploadProgress({ files, totalProgress, className = '' }: UploadProgressProps) {
  const completedCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-violet-600" />
          <span className="font-medium text-gray-900 dark:text-white">
            Uploading {files.length} file{files.length > 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {Math.round(totalProgress)}%
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-violet-600"
          initial={{ width: 0 }}
          animate={{ width: `${totalProgress}%` }}
        />
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        {completedCount > 0 && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>{completedCount} completed</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{errorCount} failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Use File Upload Hook
// ============================================================================

interface UseFileUploadOptions {
  maxSize?: number;
  maxFiles?: number;
  accept?: string[];
  onUpload?: (file: File) => Promise<void>;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { maxSize = 10 * 1024 * 1024, maxFiles = 10, accept, onUpload } = options;
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles
      .filter(file => file.size <= maxSize)
      .filter(file => !accept || accept.some(type => file.type.match(type)))
      .slice(0, maxFiles - files.length)
      .map(file => ({
        ...file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        progress: 0,
        status: 'pending' as const,
      }));

    setFiles(prev => [...prev, ...validFiles] as FileWithPreview[]);
  }, [maxSize, maxFiles, accept, files.length]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<FileWithPreview>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f) as FileWithPreview[]);
  }, []);

  const uploadAll = useCallback(async () => {
    if (!onUpload) return;

    for (const file of files) {
      if (file.status !== 'pending') continue;
      
      updateFile(file.id, { status: 'uploading', progress: 0 });
      
      try {
        await onUpload(file);
        updateFile(file.id, { status: 'success', progress: 100 });
      } catch (error) {
        updateFile(file.id, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed' 
        });
      }
    }
  }, [files, onUpload, updateFile]);

  const clearAll = useCallback(() => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
  }, [files]);

  const totalProgress = files.length > 0
    ? files.reduce((acc, f) => acc + (f.progress || 0), 0) / files.length
    : 0;

  return {
    files,
    addFiles,
    removeFile,
    updateFile,
    uploadAll,
    clearAll,
    totalProgress,
  };
}

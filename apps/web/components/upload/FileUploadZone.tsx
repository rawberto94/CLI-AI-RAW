'use client';

/**
 * File Upload Zone
 * Drag and drop file upload with progress
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  File,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  X,
  Check,
  AlertCircle,
  Loader2,
  CloudUpload,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface UploadedFile {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  error?: string;
  url?: string;
}

interface FileUploadZoneProps {
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  multiple?: boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRemove?: (fileId: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

// ============================================================================
// File Type Icons
// ============================================================================

function getFileIcon(file: File): LucideIcon {
  const type = file.type;
  
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Film;
  if (type.startsWith('audio/')) return Music;
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return Archive;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// File Item Component
// ============================================================================

interface FileItemProps {
  uploadedFile: UploadedFile;
  onRemove: () => void;
}

function FileItem({ uploadedFile, onRemove }: FileItemProps) {
  const { file, progress, status, error } = uploadedFile;
  const Icon = getFileIcon(file);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        'flex items-center gap-3 p-3 bg-white border rounded-xl',
        status === 'error' ? 'border-red-200' : 'border-slate-200'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          status === 'error' ? 'bg-red-100' : 'bg-slate-100'
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5',
            status === 'error' ? 'text-red-500' : 'text-slate-500'
          )}
        />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
          {status === 'error' && error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
        </div>
        
        {/* Progress bar */}
        {status === 'uploading' && (
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-indigo-600 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {status === 'uploading' && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            <span className="text-sm text-slate-500">{progress}%</span>
          </div>
        )}
        {status === 'success' && (
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600" />
          </div>
        )}
        {status === 'error' && (
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
        )}
        {status === 'pending' && (
          <button
            onClick={onRemove}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FileUploadZone({
  accept = '*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  multiple = true,
  onUpload,
  onRemove,
  disabled = false,
  className,
  compact = false,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File too large (max ${formatFileSize(maxSize)})`;
    }
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'));
        }
        return file.type === type;
      });
      if (!isAccepted) {
        return 'File type not supported';
      }
    }
    return null;
  };

  const addFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const availableSlots = maxFiles - files.length;
      const filesToAdd = fileArray.slice(0, availableSlots);

      const uploadedFiles: UploadedFile[] = filesToAdd.map((file) => {
        const error = validateFile(file);
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          progress: 0,
          status: error ? 'error' : 'pending',
          error: error || undefined,
        };
      });

      setFiles((prev) => [...prev, ...uploadedFiles]);

      // Start upload for valid files
      const validFiles = uploadedFiles.filter((f) => f.status === 'pending');
      if (validFiles.length > 0) {
        setIsUploading(true);

        // Simulate progress for demo
        for (const uploadedFile of validFiles) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadedFile.id ? { ...f, status: 'uploading' } : f
            )
          );

          // Simulate upload progress
          for (let i = 0; i <= 100; i += 10) {
            await new Promise((r) => setTimeout(r, 100));
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, progress: i } : f
              )
            );
          }

          try {
            await onUpload([uploadedFile.file]);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id ? { ...f, status: 'success' } : f
              )
            );
          } catch (err) {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadedFile.id
                  ? { ...f, status: 'error', error: 'Upload failed' }
                  : f
              )
            );
          }
        }

        setIsUploading(false);
      }
    },
    [files.length, maxFiles, onUpload, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [disabled, addFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    onRemove?.(fileId);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl transition-all cursor-pointer',
          compact ? 'p-6' : 'p-10',
          isDragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center text-center">
          <div
            className={cn(
              'rounded-2xl flex items-center justify-center mb-4',
              compact ? 'w-12 h-12' : 'w-16 h-16',
              isDragging ? 'bg-indigo-100' : 'bg-slate-100'
            )}
          >
            <CloudUpload
              className={cn(
                compact ? 'w-6 h-6' : 'w-8 h-8',
                isDragging ? 'text-indigo-600' : 'text-slate-400'
              )}
            />
          </div>
          
          <p className="font-medium text-slate-900">
            {isDragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            or <span className="text-indigo-600 hover:underline">browse</span> to choose files
          </p>
          
          {!compact && (
            <p className="text-xs text-slate-400 mt-3">
              Max {formatFileSize(maxSize)} per file • Up to {maxFiles} files
            </p>
          )}
        </div>
      </div>

      {/* File List */}
      <AnimatePresence mode="popLayout">
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file) => (
              <FileItem
                key={file.id}
                uploadedFile={file}
                onRemove={() => handleRemoveFile(file.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Simple Upload Button
// ============================================================================

interface UploadButtonProps {
  accept?: string;
  multiple?: boolean;
  onSelect: (files: File[]) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function UploadButton({
  accept = '*',
  multiple = false,
  onSelect,
  children,
  className,
  disabled = false,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelect(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
    </>
  );
}

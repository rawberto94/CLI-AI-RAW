'use client';

/**
 * File Upload Components
 * Drag & drop, file previews, upload progress
 * 
 * Note: Using native <img> tags for blob URL previews is intentional.
 * Next.js Image component doesn't support blob: URLs properly.
 */



import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  File,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  CloudUpload,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// File Type Icons
// ============================================

const fileTypeIcons: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-5 h-5 text-purple-500" />,
  video: <Film className="w-5 h-5 text-pink-500" />,
  audio: <Music className="w-5 h-5 text-green-500" />,
  pdf: <FileText className="w-5 h-5 text-red-500" />,
  document: <FileText className="w-5 h-5 text-violet-500" />,
  archive: <Archive className="w-5 h-5 text-amber-500" />,
  default: <File className="w-5 h-5 text-slate-500" />,
};

function getFileTypeIcon(mimeType: string, fileName: string): React.ReactNode {
  if (mimeType.startsWith('image/')) return fileTypeIcons.image;
  if (mimeType.startsWith('video/')) return fileTypeIcons.video;
  if (mimeType.startsWith('audio/')) return fileTypeIcons.audio;
  if (mimeType === 'application/pdf') return fileTypeIcons.pdf;
  if (mimeType.includes('document') || mimeType.includes('word')) return fileTypeIcons.document;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) {
    return fileTypeIcons.archive;
  }
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return fileTypeIcons.document;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return fileTypeIcons.archive;
  
  return fileTypeIcons.default;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// File Item
// ============================================

interface FileItemProps {
  file: File;
  progress?: number;
  status?: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  onRemove?: () => void;
  preview?: string;
}

export function FileItem({
  file,
  progress = 0,
  status = 'pending',
  error,
  onRemove,
  preview,
}: FileItemProps) {
  const isImage = file.type.startsWith('image/');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-xl border transition-colors',
        status === 'error'
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : status === 'success'
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      )}
    >
      {/* Preview/Icon */}
      <div className="flex-shrink-0">
        {isImage && preview ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700">
            <img src={preview} alt={`Preview of ${file.name}`} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            {getFileTypeIcon(file.type, file.name)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {file.name}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatFileSize(file.size)}
          {error && <span className="text-red-500 ml-2">{error}</span>}
        </p>
        
        {/* Progress bar */}
        {status === 'uploading' && (
          <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-violet-500 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {status === 'pending' && onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
        {status === 'error' && (
          <AlertCircle className="w-5 h-5 text-red-500" />
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Dropzone
// ============================================

interface DropzoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
  children?: React.ReactNode;
}

export function Dropzone({
  onFilesAccepted,
  accept,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  multiple = true,
  disabled = false,
  variant = 'default',
  children,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const validateFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    
    for (const file of files) {
      if (maxSize && file.size > maxSize) {
        setError(`File "${file.name}" exceeds the ${formatFileSize(maxSize)} limit`);
        continue;
      }
      
      if (accept) {
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', '/'));
          }
          return file.type === type;
        });
        
        if (!isAccepted) {
          setError(`File type "${file.type}" is not accepted`);
          continue;
        }
      }
      
      validFiles.push(file);
    }
    
    if (!multiple && validFiles.length > 1) {
      return [validFiles[0]];
    }
    
    if (maxFiles && validFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return validFiles.slice(0, maxFiles);
    }
    
    return validFiles;
  }, [accept, maxFiles, maxSize, multiple]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setError(null);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFilesAccepted(validFiles);
    }
  }, [disabled, validateFiles, onFilesAccepted]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFilesAccepted(validFiles);
    }
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [validateFiles, onFilesAccepted]);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  if (variant === 'minimal') {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Paperclip className="w-4 h-4" />
          Attach files
        </button>
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleClick}
          disabled={disabled}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all',
            isDragOver
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
            <Upload className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {isDragOver ? 'Drop files here' : 'Click or drag files'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Max {formatFileSize(maxSize)} per file
            </p>
          </div>
        </button>
        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <motion.div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          scale: isDragOver ? 1.02 : 1,
          borderColor: isDragOver ? '#3b82f6' : undefined,
        }}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
          isDragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <motion.div
          animate={{ y: isDragOver ? -5 : 0 }}
          className="p-4 bg-violet-100 dark:bg-violet-900/30 rounded-2xl mb-4"
        >
          <CloudUpload className="w-10 h-10 text-violet-500" />
        </motion.div>
        
        <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">
          {isDragOver ? 'Drop files here' : 'Drag and drop files'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          or click to browse
        </p>
        
        <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {accept && (
            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
              {accept.split(',').slice(0, 3).join(', ')}
            </span>
          )}
          <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
            Max {formatFileSize(maxSize)}
          </span>
          {maxFiles > 1 && (
            <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded">
              Up to {maxFiles} files
            </span>
          )}
        </div>
        
        {children}
      </motion.div>
      
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 flex items-center gap-1"
        >
          <AlertCircle className="w-4 h-4" />
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ============================================
// File Upload Manager
// ============================================

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  preview?: string;
}

interface FileUploadManagerProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
}

export function FileUploadManager({
  onUpload,
  accept,
  maxFiles = 10,
  maxSize,
  multiple = true,
}: FileUploadManagerProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesAccepted = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    
    setFiles(prev => [...prev, ...uploadFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const handleRemove = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Simulate upload progress
    for (const uploadFile of pendingFiles) {
      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
        )
      );

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(r => setTimeout(r, 100));
        setFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id ? { ...f, progress } : f
          )
        );
      }

      // Mark as success
      setFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'success' as const } : f
        )
      );
    }

    try {
      await onUpload(pendingFiles.map(f => f.file));
    } catch (_error) {
      // Handle error
    }

    setIsUploading(false);
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      <Dropzone
        onFilesAccepted={handleFilesAccepted}
        accept={accept}
        maxFiles={maxFiles - files.length}
        maxSize={maxSize}
        multiple={multiple}
        disabled={files.length >= maxFiles}
      />

      {files.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {files.map(file => (
              <FileItem
                key={file.id}
                file={file.file}
                progress={file.progress}
                status={file.status}
                error={file.error}
                preview={file.preview}
                onRemove={file.status === 'pending' ? () => handleRemove(file.id) : undefined}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pendingCount} file{pendingCount > 1 ? 's' : ''} ready to upload
          </p>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {pendingCount > 1 ? 'All' : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Image Upload with Preview
// ============================================

interface ImageUploadProps {
  value?: string;
  onChange: (file: File | null, preview: string | null) => void;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
  maxSize?: number;
  placeholder?: React.ReactNode;
}

export function ImageUpload({
  value,
  onChange,
  aspectRatio = 'square',
  maxSize = 5 * 1024 * 1024,
  placeholder,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isDragOver, setIsDragOver] = useState(false);

  const aspectClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  };

  const handleFileSelect = (file: File) => {
    if (file.size > maxSize) {
      alert(`File size exceeds ${formatFileSize(maxSize)} limit`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const newPreview = e.target?.result as string;
      setPreview(newPreview);
      onChange(file, newPreview);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null, null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
        className="hidden"
      />

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed transition-all',
          aspectClasses[aspectRatio],
          isDragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
            : preview
            ? 'border-transparent'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300'
        )}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30"
                >
                  Change
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-500/80 backdrop-blur-sm rounded-lg hover:bg-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {placeholder || (
              <>
                <ImageIcon className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                  Click or drag image
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Max {formatFileSize(maxSize)}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const FileUploadComponents = {
  FileItem,
  Dropzone,
  FileUploadManager,
  ImageUpload,
};

export default FileUploadComponents;

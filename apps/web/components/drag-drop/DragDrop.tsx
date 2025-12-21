'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  GripVertical, 
  Upload, 
  File, 
  Image, 
  FileText, 
  X, 
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DragDropContextValue {
  isDragging: boolean;
  draggedItem: unknown;
  setDraggedItem: (item: unknown) => void;
  setIsDragging: (dragging: boolean) => void;
}

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
  preview?: string;
}

interface SortableItem {
  id: string;
  [key: string]: unknown;
}

// ============================================================================
// Context
// ============================================================================

const DragDropContext = createContext<DragDropContextValue | null>(null);

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<unknown>(null);

  return (
    <DragDropContext.Provider value={{ isDragging, draggedItem, setDraggedItem, setIsDragging }}>
      {children}
    </DragDropContext.Provider>
  );
}

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within DragDropProvider');
  }
  return context;
}

// ============================================================================
// File Drop Zone
// ============================================================================

interface FileDropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  maxSize?: number; // in bytes
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FileDropZone({
  onFilesAccepted,
  accept = ['*/*'],
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  className = '',
  children,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (valid.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        break;
      }

      if (file.size > maxSize) {
        errors.push(`${file.name} exceeds ${formatBytes(maxSize)} limit`);
        continue;
      }

      if (accept[0] !== '*/*') {
        const fileType = file.type || '';
        const isAccepted = accept.some(type => {
          if (type.endsWith('/*')) {
            return fileType.startsWith(type.replace('/*', '/'));
          }
          return fileType === type;
        });
        if (!isAccepted) {
          errors.push(`${file.name} is not an accepted file type`);
          continue;
        }
      }

      valid.push(file);
    }

    return { valid, errors };
  }, [accept, maxFiles, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors[0] ?? null);
      setTimeout(() => setError(null), 3000);
    }

    if (valid.length > 0) {
      onFilesAccepted(valid);
    }
  }, [disabled, validateFiles, onFilesAccepted]);

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

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      setError(errors[0] ?? null);
      setTimeout(() => setError(null), 3000);
    }

    if (valid.length > 0) {
      onFilesAccepted(valid);
    }

    // Reset input
    e.target.value = '';
  }, [validateFiles, onFilesAccepted]);

  return (
    <div className={className}>
      <motion.div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        animate={{
          scale: isDragOver ? 1.02 : 1,
          borderColor: isDragOver ? 'rgb(59, 130, 246)' : 'rgb(209, 213, 219)',
        }}
        className={`
          relative border-2 border-dashed rounded-xl p-8
          transition-colors cursor-pointer
          ${isDragOver ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-900'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={accept.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {children || (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`
              p-4 rounded-full
              ${isDragOver ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'}
            `}>
              <Upload className={`w-8 h-8 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop files here or <span className="text-blue-500">browse</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Max {maxFiles} files, up to {formatBytes(maxSize)} each
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-4 bottom-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ============================================================================
// File Upload List
// ============================================================================

interface FileUploadListProps {
  files: FileUploadItem[];
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function FileUploadList({ files, onRemove, onRetry }: FileUploadListProps) {
  return (
    <div className="space-y-2">
      <AnimatePresence>
        {files.map((item) => (
          <FileUploadRow 
            key={item.id} 
            item={item} 
            onRemove={onRemove} 
            onRetry={onRetry}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface FileUploadRowProps {
  item: FileUploadItem;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

function FileUploadRow({ item, onRemove, onRetry }: FileUploadRowProps) {
  const FileIcon = getFileIcon(item.file.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      className={`
        flex items-center gap-3 p-3 rounded-lg border
        ${item.status === 'error' 
          ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' 
          : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
        }
      `}
    >
      {/* Preview/Icon */}
      <div className="flex-shrink-0">
        {item.preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={item.preview} 
            alt={item.file.name}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <FileIcon className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {item.file.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{formatBytes(item.file.size)}</span>
          {item.status === 'error' && item.error && (
            <span className="text-xs text-red-600">{item.error}</span>
          )}
        </div>

        {/* Progress Bar */}
        {item.status === 'uploading' && (
          <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              className="h-full bg-blue-500 rounded-full"
            />
          </div>
        )}
      </div>

      {/* Status/Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {item.status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        )}
        {item.status === 'complete' && (
          <Check className="w-5 h-5 text-green-500" />
        )}
        {item.status === 'error' && onRetry && (
          <button
            onClick={() => onRetry(item.id)}
            className="text-xs text-blue-500 hover:underline"
          >
            Retry
          </button>
        )}
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Reorderable List
// ============================================================================

interface ReorderableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function ReorderableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  className = '',
}: ReorderableListProps<T>) {
  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={onReorder}
      className={`space-y-2 ${className}`}
    >
      {items.map((item, index) => (
        <ReorderableListItem key={item.id} item={item}>
          {renderItem(item, index)}
        </ReorderableListItem>
      ))}
    </Reorder.Group>
  );
}

interface ReorderableListItemProps<T extends SortableItem> {
  item: T;
  children: React.ReactNode;
}

function ReorderableListItem<T extends SortableItem>({ item, children }: ReorderableListItemProps<T>) {
  return (
    <Reorder.Item
      value={item}
      className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <div className="flex-1">{children}</div>
    </Reorder.Item>
  );
}

// ============================================================================
// Kanban Board
// ============================================================================

interface KanbanColumn<T extends SortableItem> {
  id: string;
  title: string;
  items: T[];
  color?: string;
}

interface KanbanBoardProps<T extends SortableItem> {
  columns: KanbanColumn<T>[];
  onMoveItem: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
  onReorderColumn: (columnId: string, items: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  renderColumnHeader?: (column: KanbanColumn<T>) => React.ReactNode;
}

export function KanbanBoard<T extends SortableItem>({
  columns,
  onMoveItem,
  onReorderColumn,
  renderItem,
  renderColumnHeader,
}: KanbanBoardProps<T>) {
  const [draggedItem, setDraggedItem] = useState<{ item: T; columnId: string } | null>(null);

  const handleDragStart = (item: T, columnId: string) => {
    setDraggedItem({ item, columnId });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDropOnColumn = (targetColumnId: string) => {
    if (!draggedItem || draggedItem.columnId === targetColumnId) return;
    
    const targetColumn = columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    onMoveItem(
      draggedItem.item.id,
      draggedItem.columnId,
      targetColumnId,
      targetColumn.items.length
    );
    setDraggedItem(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-900 rounded-xl p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnColumn(column.id)}
        >
          {/* Column Header */}
          {renderColumnHeader ? (
            renderColumnHeader(column)
          ) : (
            <div className="flex items-center gap-2 mb-3 px-1">
              {column.color && (
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: column.color }}
                />
              )}
              <h3 className="font-medium text-gray-900 dark:text-white">
                {column.title}
              </h3>
              <span className="text-sm text-gray-500 ml-auto">
                {column.items.length}
              </span>
            </div>
          )}

          {/* Items */}
          <Reorder.Group
            axis="y"
            values={column.items}
            onReorder={(items) => onReorderColumn(column.id, items as T[])}
            className="space-y-2"
          >
            {column.items.map((item) => (
              <Reorder.Item
                key={item.id}
                value={item}
                onDragStart={() => handleDragStart(item, column.id)}
                onDragEnd={handleDragEnd}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing"
              >
                {renderItem(item)}
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {/* Empty state drop zone */}
          {column.items.length === 0 && (
            <div className="h-20 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-sm text-gray-500">
              Drop items here
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Drag Handle
// ============================================================================

interface DragHandleProps {
  className?: string;
}

export function DragHandle({ className = '' }: DragHandleProps) {
  return (
    <div className={`cursor-grab active:cursor-grabbing ${className}`}>
      <GripVertical className="w-5 h-5 text-gray-400" />
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string): typeof File {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return FileText;
  return File;
}

// ============================================================================
// Hook: useFileUpload
// ============================================================================

interface UseFileUploadOptions {
  uploadFn: (file: File, onProgress: (progress: number) => void) => Promise<string>;
  onComplete?: (results: { id: string; url: string }[]) => void;
  onError?: (error: Error, file: File) => void;
}

export function useFileUpload({ uploadFn, onComplete, onError }: UseFileUploadOptions) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = useCallback((newFiles: File[]) => {
    const items: FileUploadItem[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles(prev => [...prev, ...items]);
    return items.map(i => i.id);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pending.length === 0) return;

    setIsUploading(true);
    const results: { id: string; url: string }[] = [];

    for (const item of pending) {
      setFiles(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'uploading', progress: 0 } : f
      ));

      try {
        const url = await uploadFn(item.file, (progress) => {
          setFiles(prev => prev.map(f => 
            f.id === item.id ? { ...f, progress } : f
          ));
        });

        setFiles(prev => prev.map(f => 
          f.id === item.id ? { ...f, status: 'complete', progress: 100 } : f
        ));
        results.push({ id: item.id, url });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setFiles(prev => prev.map(f => 
          f.id === item.id ? { ...f, status: 'error', error: error.message } : f
        ));
        onError?.(error, item.file);
      }
    }

    setIsUploading(false);
    if (results.length > 0) onComplete?.(results);
  }, [files, uploadFn, onComplete, onError]);

  const retryFile = useCallback((id: string) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ));
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles(prev => {
      prev.filter(f => f.status === 'complete' && f.preview).forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      return prev.filter(f => f.status !== 'complete');
    });
  }, []);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    files,
    isUploading,
    addFiles,
    removeFile,
    uploadAll,
    retryFile,
    clearCompleted,
  };
}

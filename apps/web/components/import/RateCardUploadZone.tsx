'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  validateFiles,
  formatFileSize,
  getFileTypeIcon,
  type FileMetadata,
  getFileMetadata,
} from '@/lib/import/file-validation';

interface UploadFile extends FileMetadata {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  jobId?: string;
}

interface RateCardUploadZoneProps {
  onUploadComplete?: (jobIds: string[]) => void;
  onUploadError?: (errors: string[]) => void;
  maxFiles?: number;
  tenantId?: string;
  supplierId?: string;
  supplierName?: string;
}

export function RateCardUploadZone({
  onUploadComplete,
  onUploadError,
  maxFiles = 10,
  tenantId,
  supplierId,
  supplierName,
}: RateCardUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    
    [files, maxFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        addFiles(selectedFiles);
      }
    },
    
    [files, maxFiles]
  );

  const addFiles = (newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      toast.warning(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validation = validateFiles(newFiles);
    
    const uploadFiles: UploadFile[] = validation.validFiles.map((file) => ({
      ...getFileMetadata(file),
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    // Show errors for invalid files
    if (validation.invalidFiles.length > 0) {
      const errors = validation.invalidFiles.map((file) => {
        const result = validation.results.get(file.name);
        return `${file.name}: ${result?.error || 'Invalid file'}`;
      });
      onUploadError?.(errors);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    
    if (tenantId) formData.append('tenantId', tenantId);
    if (supplierId) formData.append('supplierId', supplierId);
    if (supplierName) formData.append('supplierName', supplierName);

    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      const response = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
        headers: tenantId ? { 'x-tenant-id': tenantId } : {},
      });

      const result = await response.json();

      if (result.success) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'completed', progress: 100, jobId: result.jobId }
              : f
          )
        );
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'failed', error: errorMessage }
            : f
        )
      );
      throw error;
    }
  };

  const uploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    const results = await Promise.allSettled(
      pendingFiles.map((file) => uploadFile(file))
    );

    const jobIds = files
      .filter((f) => f.status === 'completed' && f.jobId)
      .map((f) => f.jobId!);

    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason.message);

    setIsUploading(false);

    if (jobIds.length > 0) {
      onUploadComplete?.(jobIds);
    }

    if (errors.length > 0) {
      onUploadError?.(errors);
    }
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const retryFailed = async () => {
    const failedFiles = files.filter((f) => f.status === 'failed');
    
    for (const file of failedFiles) {
      await uploadFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="text-6xl">📤</div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              {isDragging ? 'Drop files here' : 'Drag and drop rate card files'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse (Excel, CSV, PDF)
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Maximum {maxFiles} files, up to 50MB each
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Files ({files.length}/{maxFiles})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={clearCompleted}
                disabled={!files.some((f) => f.status === 'completed')}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Clear Completed
              </button>
              <button
                onClick={clearAll}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 bg-white border rounded-lg"
              >
                <div className="text-2xl">{getFileTypeIcon(file.name)}</div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </p>

                  {file.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-violet-500 h-2 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {file.error && (
                    <p className="text-sm text-red-600 mt-1">{file.error}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {file.status === 'pending' && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      Pending
                    </span>
                  )}
                  {file.status === 'uploading' && (
                    <span className="px-2 py-1 text-xs bg-violet-100 text-violet-600 rounded">
                      Uploading...
                    </span>
                  )}
                  {file.status === 'completed' && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded">
                      ✓ Completed
                    </span>
                  )}
                  {file.status === 'failed' && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">
                      ✗ Failed
                    </span>
                  )}

                  <button
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={uploadAll}
              disabled={
                isUploading || !files.some((f) => f.status === 'pending')
              }
              className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Upload All'}
            </button>

            {files.some((f) => f.status === 'failed') && (
              <button
                onClick={retryFailed}
                disabled={isUploading}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                Retry Failed
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="flex gap-4 text-sm text-gray-600">
            <span>
              Pending: {files.filter((f) => f.status === 'pending').length}
            </span>
            <span>
              Uploading: {files.filter((f) => f.status === 'uploading').length}
            </span>
            <span>
              Completed: {files.filter((f) => f.status === 'completed').length}
            </span>
            <span>
              Failed: {files.filter((f) => f.status === 'failed').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

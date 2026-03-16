/**
 * useUploadQueue — Upload queue state management hook
 *
 * Extracts all file queue state and upload logic from the upload page
 * so page.tsx stays a thin shell.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  contractId?: string;
  error?: string;
  processingStage?: string;
  showArtifacts?: boolean;
  isDuplicate?: boolean;
  existingContractId?: string;
  startTime?: number;
  endTime?: number;
  skipDuplicateCheck?: boolean;
}

export interface ProcessingOptions {
  aiModel: string;
  processingMode: string;
  concurrency: number;
  enabledArtifacts: string[];
  enableRagIndexing: boolean;
  enableRateCardExtraction: boolean;
  enableDuplicateDetection: boolean;
  prioritizeRiskAnalysis: boolean;
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  aiModel: 'azure-ch',
  processingMode: 'standard',
  concurrency: 2,
  enabledArtifacts: [
    'OVERVIEW', 'CLAUSES', 'FINANCIAL', 'RISK', 'COMPLIANCE',
    'OBLIGATIONS', 'RENEWAL', 'NEGOTIATION_POINTS', 'AMENDMENTS', 'CONTACTS',
  ],
  enableRagIndexing: true,
  enableRateCardExtraction: true,
  enableDuplicateDetection: true,
  prioritizeRiskAnalysis: false,
};

// ============================================================================
// Hook
// ============================================================================

export function useUploadQueue(
  dataMode: string,
  processingOptions: ProcessingOptions,
  uploadPurpose: 'store' | 'review',
  router: { push: (url: string) => void },
) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [totalProcessingTime, setTotalProcessingTime] = useState(0);

  // Clear stale state on mount (handles HMR)
  useEffect(() => {
    setFiles([]);
    setIsUploading(false);
  }, []);

  // Track processing time
  const processingCount = files.filter(f =>
    ['uploading', 'processing'].includes(f.status),
  ).length;

  useEffect(() => {
    if (isUploading && processingCount > 0) {
      const interval = setInterval(() => {
        setTotalProcessingTime(prev => prev + 100);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isUploading, processingCount]);

  // ── Upload a single file ────────────────────────────────────────────
  const uploadFile = useCallback(
    async (uploadFile: UploadFile, skipDuplicateCheck = false) => {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('dataMode', dataMode);
      formData.append('ocrMode', processingOptions.aiModel);
      formData.append('processingMode', processingOptions.processingMode);
      if (uploadPurpose === 'review') {
        formData.append('lifecycle', 'REVIEW');
      }

      try {
        // Indeterminate uploading state
        setFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'uploading' as const,
                  progress: null as unknown as number,
                  processingStage: 'Uploading file...',
                  isDuplicate: false,
                }
              : f,
          ),
        );

        if (isPausedRef.current) {
          setFiles(prev =>
            prev.map(f =>
              f.id === uploadFile.id ? { ...f, status: 'pending' as const, progress: 0 } : f,
            ),
          );
          return;
        }

        const headers: Record<string, string> = {
          'x-tenant-id': getTenantId(),
          'x-data-mode': dataMode,
        };
        // IMPORTANT: Do NOT set 'Content-Type' header for FormData uploads.
        // The browser automatically sets it to multipart/form-data with the
        // correct boundary. Setting it manually causes 403 Forbidden errors
        // because the server cannot parse the multipart body.
        if (skipDuplicateCheck) {
          headers['x-skip-duplicate-check'] = 'true';
        }

        const uploadResponse = await fetch('/api/contracts/upload', {
          method: 'POST',
          body: formData,
          headers,
        });

        const responseData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          const err = responseData.error || {};
          const errorMessage =
            typeof err === 'string'
              ? err
              : err.details
                ? `${err.message}: ${err.details}`
                : err.message || 'Upload failed';
          throw new Error(errorMessage);
        }

        const result = responseData.data ?? responseData;

        // Duplicate
        if (result.isDuplicate) {
          setFiles(prev =>
            prev.map(f =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'completed' as const,
                    progress: 100,
                    contractId: result.contractId,
                    isDuplicate: true,
                    existingContractId: result.contractId,
                    endTime: Date.now(),
                  }
                : f,
            ),
          );
          toast.info(`${uploadFile.file.name} is a duplicate`, {
            description:
              'This file was uploaded recently. You can view the existing contract.',
            action: {
              label: 'View',
              onClick: () => router.push(`/contracts/${result.contractId}`),
            },
            duration: 5000,
          });
          return;
        }

        const { contractId } = result;

        // Transition to processing
        setFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'processing' as const,
                  progress: 60,
                  contractId,
                  processingStage: 'Processing with AI...',
                  showArtifacts: true,
                }
              : f,
          ),
        );
      } catch (error: unknown) {
        const errorMsg =
          error instanceof Error
            ? error.message
            : 'Upload failed. Please try again.';
        setFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'error' as const, error: errorMsg, endTime: Date.now() }
              : f,
          ),
        );
        toast.error(`Upload failed: ${uploadFile.file.name}`, {
          description: errorMsg,
          action: {
            label: 'Retry',
            onClick: () => retryFile(uploadFile.id),
          },
        });
      }
    },
    [dataMode, processingOptions, uploadPurpose, router],
  );

  // ── Upload all pending files ────────────────────────────────────────
  const handleUploadAll = useCallback(async () => {
    setIsUploading(true);
    setIsPaused(false);
    isPausedRef.current = false;
    const pendingFiles = files.filter(f => f.status === 'pending');

    const concurrency = processingOptions.concurrency;
    for (let i = 0; i < pendingFiles.length; i += concurrency) {
      if (isPausedRef.current) break;
      const batch = pendingFiles.slice(i, i + concurrency);
      await Promise.all(batch.map(file => uploadFile(file, file.skipDuplicateCheck)));
    }

    setIsUploading(false);
  }, [files, processingOptions.concurrency, uploadFile]);

  // ── File management ─────────────────────────────────────────────────
  const addFiles = useCallback((newFiles: File[]) => {
    const mapped: UploadFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending' as const,
      progress: 0,
      startTime: Date.now(),
    }));
    setFiles(prev => [...prev, ...mapped]);
    return mapped;
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const retryFile = useCallback((id: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id
          ? {
              ...f,
              status: 'pending' as const,
              progress: 0,
              error: undefined,
              isDuplicate: false,
              existingContractId: undefined,
              skipDuplicateCheck: true,
            }
          : f,
      ),
    );
  }, []);

  const clearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  }, []);

  const retryAllErrors = useCallback(async () => {
    const errorFiles = files.filter(f => f.status === 'error');
    if (errorFiles.length === 0) return;
    setFiles(prev =>
      prev.map(f =>
        f.status === 'error'
          ? { ...f, status: 'pending' as const, progress: 0, error: undefined }
          : f,
      ),
    );
    await handleUploadAll();
  }, [files, handleUploadAll]);

  const handlePauseAll = useCallback(() => {
    setIsPaused(true);
    isPausedRef.current = true;
  }, []);

  const markFileCompleted = useCallback((id: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id ? { ...f, status: 'completed' as const, progress: 100, endTime: Date.now() } : f,
      ),
    );
  }, []);

  const markFileError = useCallback((id: string, error: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id ? { ...f, status: 'error' as const, error, endTime: Date.now() } : f,
      ),
    );
  }, []);

  // ── Computed ────────────────────────────────────────────────────────
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const hasFiles = files.length > 0;

  return {
    files,
    setFiles,
    isUploading,
    isPaused,
    totalProcessingTime,
    processingCount,
    completedCount,
    errorCount,
    pendingCount,
    hasFiles,
    addFiles,
    removeFile,
    retryFile,
    clearCompleted,
    retryAllErrors,
    handleUploadAll,
    handlePauseAll,
    markFileCompleted,
    markFileError,
  };
}

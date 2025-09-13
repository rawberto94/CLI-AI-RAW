'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { tenantHeaders } from '@/lib/tenant';
import { Button } from '@/components/ui/button';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  docId?: string;
  error?: string;
}

interface BatchUploadResult {
  name: string;
  docId: string;
}

interface BatchUploadZoneProps {
  tenantId?: string;
  maxFiles?: number;
  disabled?: boolean;
  clientId?: string;
  supplierId?: string;
  policyPack?: string;
  onUploadComplete?: (results: BatchUploadResult[]) => void;
  onError?: (error: string) => void;
}

export function BatchUploadZone({ 
  tenantId = 'demo',
  maxFiles = 15,
  disabled = false,
  clientId,
  supplierId,
  policyPack,
  onUploadComplete,
  onError
}: BatchUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<BatchUploadResult[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0);
  const router = useRouter();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(f => f.errors.map((e: any) => e.message).join(', '));
      onError?.(`Some files were rejected: ${errors.join('; ')}`);
    }

    // Add accepted files
    const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, maxFiles, onError]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles,
    disabled: disabled || isUploading,
  });

  const uploadBatch = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadResults([]);
    
    try {
      // Update all files to uploading
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 10 })));

      const results: BatchUploadResult[] = [];
      
      // Upload files one by one using the single upload endpoint that works
      for (let i = 0; i < files.length; i++) {
        const file = files[i].file;
        
        try {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, progress: 30 } : f
          ));

          const formData = new FormData();
          formData.append('file', file); // Use 'file' not 'files'

          const response = await fetch(`${API_BASE_URL}/uploads`, {
            method: 'POST',
            body: formData,
            headers: {
              'x-tenant-id': tenantId
            }
          });

          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, progress: 60 } : f
          ));

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Upload failed for ${file.name}:`, errorText);
            
            setFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, status: 'error' as const, error: errorText, progress: 0 } : f
            ));
            continue;
          }

          const data = await response.json();
          console.log(`Upload successful for ${file.name}:`, data);
          
          results.push({ name: file.name, docId: data.id || data.docId });
          
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'completed' as const, 
              progress: 100,
              docId: data.id || data.docId 
            } : f
          ));

        } catch (error) {
          console.error(`Upload error for ${file.name}:`, error);
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Upload failed',
              progress: 0 
            } : f
          ));
        }
      }

      setUploadResults(results);
      setGlobalProgress(100);
      onUploadComplete?.(results);

      // Assign client/supplier metadata if provided
      if ((clientId || supplierId) && results.length > 0) {
        try {
          await Promise.all(results.map(it => 
            fetch(`${API_BASE_URL}/api/contracts/${it.docId}/assign`, {
              method: 'POST',
              headers: tenantHeaders({ 'content-type': 'application/json' }),
              body: JSON.stringify({
                clientId: clientId || undefined,
                supplierId: supplierId || undefined
              })
            })
          ));
        } catch (e) {
          console.warn('Failed to assign metadata:', e);
        }
      }

      // Handle navigation
      if (results.length === 1) {
        const qp = policyPack ? `?policyPack=${encodeURIComponent(policyPack)}` : '';
        router.push(`/contracts/${results[0].docId}${qp}`);
      } else if (results.length > 0) {
        try {
          window.sessionStorage.setItem('batchUploadedCount', String(results.length));
          window.sessionStorage.setItem('batchUploadedDocIds', JSON.stringify(results.map(it => it.docId)));
        } catch {}
        router.push('/contracts');
      }

    } catch (error: any) {
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const, error: error.message })));
      onError?.(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setGlobalProgress(0);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
    setUploadResults([]);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending': return 'Ready to upload';
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing...';
      case 'completed': return 'Complete';
      case 'error': return 'Error';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 hover:bg-gray-50'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
        {isDragActive ? (
          <p className="text-lg font-medium text-blue-600">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium">Drag & drop files here</p>
            <p className="text-sm text-gray-500 mt-2">or click to select files</p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOC, DOCX, TXT up to 100MB • Max {maxFiles} files
            </p>
          </>
        )}
      </div>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600 font-medium">Some files were rejected:</p>
          <ul className="text-xs text-red-500 mt-1 space-y-1">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name}>
                {file.name}: {errors.map(e => e.message).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Global Progress */}
      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
            </span>
            <span className="text-sm text-blue-600">{globalProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ inlineSize: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Files ({files.length})
              {completedCount > 0 && <span className="text-green-600 ml-2">• {completedCount} completed</span>}
              {errorCount > 0 && <span className="text-red-600 ml-2">• {errorCount} failed</span>}
            </h3>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear completed
              </button>
            )}
          </div>

          {files.map(file => (
            <div key={file.id} className="border rounded-lg p-3 space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)} • {getStatusText(file.status)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusIcon(file.status)}
                  {file.status === 'completed' && file.docId && (
                    <a
                      href={`/contracts/${file.docId}`}
                      className="p-1 hover:bg-gray-100 rounded text-blue-600 hover:text-blue-700"
                      title="View contract"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {file.status === 'uploading' && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ inlineSize: `${file.progress}%` }}
                  />
                </div>
              )}

              {/* Error Message */}
              {file.error && (
                <p className="text-xs text-red-500 mt-1">{file.error}</p>
              )}

              {/* Document ID */}
              {file.docId && (
                <p className="text-xs text-gray-500 font-mono">ID: {file.docId}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Results Summary */}
      {uploadResults.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-700 mb-2">
            Successfully uploaded {uploadResults.length} contract{uploadResults.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {uploadResults.map((result, i) => (
              <div key={result.docId} className="flex items-center justify-between text-sm">
                <span className="text-green-600">{result.name}</span>
                <a
                  href={`/contracts/${result.docId}`}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => router.push('/contracts')}
              variant="outline"
              size="sm"
            >
              View All Contracts
            </Button>
            {uploadResults.length === 1 && (
              <Button
                onClick={() => router.push(`/contracts/${uploadResults[0].docId}`)}
                size="sm"
              >
                View Contract
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {pendingCount > 0 && (
        <Button
          onClick={uploadBatch}
          disabled={isUploading || pendingCount === 0}
          className="w-full"
          size="lg"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            `Upload ${pendingCount} File${pendingCount !== 1 ? 's' : ''}`
          )}
        </Button>
      )}
    </div>
  );
}

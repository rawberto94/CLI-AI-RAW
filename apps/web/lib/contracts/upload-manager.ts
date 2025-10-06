import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

export interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled'
  progress: number
  error?: string
  uploadedAt?: Date
  contractId?: string
  retryCount: number
}

export interface UploadProgress {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  totalBytes: number
  uploadedBytes: number
  overallProgress: number
  isUploading: boolean
  estimatedTimeRemaining?: number
}

export interface UploadManagerOptions {
  maxConcurrentUploads?: number
  maxRetries?: number
  chunkSize?: number
  onProgress?: (progress: UploadProgress) => void
  onFileComplete?: (file: UploadFile) => void
  onAllComplete?: (results: UploadFile[]) => void
  onError?: (error: string, file?: UploadFile) => void
}

const DEFAULT_OPTIONS: Required<UploadManagerOptions> = {
  maxConcurrentUploads: 3,
  maxRetries: 3,
  chunkSize: 1024 * 1024,
  onProgress: () => {},
  onFileComplete: () => {},
  onAllComplete: () => {},
  onError: () => {},
}

export class UploadManager {
  private files: Map<string, UploadFile> = new Map()
  private activeUploads: Set<string> = new Set()
  private abortControllers: Map<string, AbortController> = new Map()
  private options: Required<UploadManagerOptions>
  private startTime?: number

  constructor(options: UploadManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  addFiles(files: File[]): string[] {
    const fileIds: string[] = []
    
    files.forEach(file => {
      const id = `${file.name}-${Date.now()}-${Math.random()}`
      const uploadFile: UploadFile = {
        id,
        file,
        status: 'pending',
        progress: 0,
        retryCount: 0
      }
      
      this.files.set(id, uploadFile)
      fileIds.push(id)
    })

    this.updateProgress()
    return fileIds
  }

  async startUpload(fileIds?: string[]): Promise<void> {
    const filesToUpload = fileIds 
      ? fileIds.map(id => this.files.get(id)).filter(Boolean) as UploadFile[]
      : Array.from(this.files.values()).filter(f => f.status === 'pending')

    if (filesToUpload.length === 0) return

    this.startTime = Date.now()
    
    const uploadPromises: Promise<void>[] = []
    const queue = [...filesToUpload]

    const processNext = async (): Promise<void> => {
      while (queue.length > 0 && this.activeUploads.size < this.options.maxConcurrentUploads) {
        const file = queue.shift()!
        this.activeUploads.add(file.id)
        
        uploadPromises.push(
          this.uploadFile(file)
            .finally(() => {
              this.activeUploads.delete(file.id)
              return processNext()
            })
        )
      }
    }

    await processNext()
    await Promise.all(uploadPromises)

    const results = Array.from(this.files.values())
    this.options.onAllComplete(results)
  }

  private async uploadFile(uploadFile: UploadFile): Promise<void> {
    const abortController = new AbortController()
    this.abortControllers.set(uploadFile.id, abortController)

    try {
      uploadFile.status = 'uploading'
      uploadFile.progress = 0
      this.files.set(uploadFile.id, uploadFile)
      this.updateProgress()

      const formData = new FormData()
      formData.append('file', uploadFile.file)
      formData.append('filename', uploadFile.file.name)
      formData.append('fileSize', uploadFile.file.size.toString())

      // Try the primary upload endpoint first
      let response: Response;
      let uploadError: Error | null = null;
      
      try {
        response = await this.uploadWithProgress(
          '/api/contracts/upload',
          formData,
          abortController.signal,
          (progress) => {
            uploadFile.progress = progress
            this.files.set(uploadFile.id, uploadFile)
            this.updateProgress()
          }
        )
      } catch (primaryError) {
        console.warn('Primary upload endpoint failed, trying fallback:', primaryError);
        uploadError = primaryError as Error;
        
        // Try fallback endpoint
        response = await this.uploadWithProgress(
          '/api/upload',
          formData,
          abortController.signal,
          (progress) => {
            uploadFile.progress = progress
            this.files.set(uploadFile.id, uploadFile)
            this.updateProgress()
          }
        )
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      
      uploadFile.status = 'success'
      uploadFile.progress = 100
      uploadFile.uploadedAt = new Date()
      uploadFile.contractId = result.contractId
      this.files.set(uploadFile.id, uploadFile)
      
      this.options.onFileComplete(uploadFile)
      toast.success(`${uploadFile.file.name} uploaded successfully`)
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        uploadFile.status = 'cancelled'
      } else {
        uploadFile.status = 'error'
        uploadFile.error = error instanceof Error ? error.message : 'Upload failed'
        
        if (uploadFile.retryCount < this.options.maxRetries) {
          uploadFile.retryCount++
          uploadFile.status = 'pending'
          this.options.onError(`Retrying upload (${uploadFile.retryCount}/${this.options.maxRetries})`, uploadFile)
          
          setTimeout(() => {
            this.uploadFile(uploadFile)
          }, 1000 * uploadFile.retryCount)
        } else {
          this.options.onError(uploadFile.error, uploadFile)
          toast.error(`Failed to upload ${uploadFile.file.name}: ${uploadFile.error}`)
        }
      }
      
      this.files.set(uploadFile.id, uploadFile)
    } finally {
      this.abortControllers.delete(uploadFile.id)
      this.updateProgress()
    }
  }

  private async uploadWithProgress(
    url: string,
    formData: FormData,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText
          }))
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
      })

      signal.addEventListener('abort', () => {
        xhr.abort()
      })

      xhr.open('POST', url)
      xhr.send(formData)
    })
  }

  private updateProgress(): void {
    const files = Array.from(this.files.values())
    const totalFiles = files.length
    const completedFiles = files.filter(f => f.status === 'success').length
    const failedFiles = files.filter(f => f.status === 'error').length
    const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0)
    const uploadedBytes = files.reduce((sum, f) => {
      if (f.status === 'success') return sum + f.file.size
      if (f.status === 'uploading') return sum + (f.file.size * f.progress / 100)
      return sum
    }, 0)
    
    const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0
    const isUploading = files.some(f => f.status === 'uploading')
    
    let estimatedTimeRemaining: number | undefined
    if (isUploading && this.startTime && uploadedBytes > 0) {
      const elapsedTime = Date.now() - this.startTime
      const uploadSpeed = uploadedBytes / elapsedTime
      const remainingBytes = totalBytes - uploadedBytes
      estimatedTimeRemaining = Math.round(remainingBytes / uploadSpeed)
    }

    const progress: UploadProgress = {
      totalFiles,
      completedFiles,
      failedFiles,
      totalBytes,
      uploadedBytes,
      overallProgress,
      isUploading,
      estimatedTimeRemaining
    }

    this.options.onProgress(progress)
  }

  cancelUpload(fileId: string): void {
    const abortController = this.abortControllers.get(fileId)
    if (abortController) {
      abortController.abort()
    }
    
    const file = this.files.get(fileId)
    if (file) {
      file.status = 'cancelled'
      this.files.set(fileId, file)
      this.updateProgress()
    }
  }

  cancelAllUploads(): void {
    this.abortControllers.forEach(controller => controller.abort())
    this.abortControllers.clear()
    
    this.files.forEach(file => {
      if (file.status === 'uploading' || file.status === 'pending') {
        file.status = 'cancelled'
        this.files.set(file.id, file)
      }
    })
    
    this.updateProgress()
  }

  removeFile(fileId: string): void {
    this.cancelUpload(fileId)
    this.files.delete(fileId)
    this.updateProgress()
  }

  retryFile(fileId: string): void {
    const file = this.files.get(fileId)
    if (file && file.status === 'error') {
      file.status = 'pending'
      file.error = undefined
      this.files.set(fileId, file)
      this.uploadFile(file)
    }
  }

  getFile(fileId: string): UploadFile | undefined {
    return this.files.get(fileId)
  }

  getAllFiles(): UploadFile[] {
    return Array.from(this.files.values())
  }

  clear(): void {
    this.cancelAllUploads()
    this.files.clear()
    this.updateProgress()
  }
}

export function useUploadManager(options: UploadManagerOptions = {}) {
  const [progress, setProgress] = useState<UploadProgress>({
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    overallProgress: 0,
    isUploading: false
  })
  
  const [files, setFiles] = useState<UploadFile[]>([])
  const managerRef = useRef<UploadManager | null>(null)

  if (!managerRef.current) {
    managerRef.current = new UploadManager({
      ...options,
      onProgress: (newProgress) => {
        setProgress(newProgress)
        options.onProgress?.(newProgress)
      },
      onFileComplete: (file) => {
        setFiles(prev => prev.map(f => f.id === file.id ? file : f))
        options.onFileComplete?.(file)
      },
      onAllComplete: (results) => {
        setFiles(results)
        options.onAllComplete?.(results)
      },
      onError: options.onError
    })
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const fileIds = managerRef.current!.addFiles(newFiles)
    setFiles(managerRef.current!.getAllFiles())
    return fileIds
  }, [])

  const startUpload = useCallback((fileIds?: string[]) => {
    return managerRef.current!.startUpload(fileIds)
  }, [])

  const cancelUpload = useCallback((fileId: string) => {
    managerRef.current!.cancelUpload(fileId)
    setFiles(managerRef.current!.getAllFiles())
  }, [])

  const cancelAllUploads = useCallback(() => {
    managerRef.current!.cancelAllUploads()
    setFiles(managerRef.current!.getAllFiles())
  }, [])

  const removeFile = useCallback((fileId: string) => {
    managerRef.current!.removeFile(fileId)
    setFiles(managerRef.current!.getAllFiles())
  }, [])

  const retryFile = useCallback((fileId: string) => {
    managerRef.current!.retryFile(fileId)
    setFiles(managerRef.current!.getAllFiles())
  }, [])

  const clear = useCallback(() => {
    managerRef.current!.clear()
    setFiles([])
  }, [])

  return {
    files,
    progress,
    addFiles,
    startUpload,
    cancelUpload,
    cancelAllUploads,
    removeFile,
    retryFile,
    clear
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const formatTimeRemaining = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m remaining`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`
  return `${seconds}s remaining`
}

export const formatUploadSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

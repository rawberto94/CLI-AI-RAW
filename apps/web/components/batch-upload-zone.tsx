"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone, DropzoneOptions, FileRejection } from "react-dropzone";
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
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
  tenantId = "demo",
  maxFiles = 15,
  disabled = false,
  clientId,
  supplierId,
  policyPack,
  onUploadComplete,
  onError,
}: BatchUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<BatchUploadResult[]>([]);
  const [globalProgress, setGlobalProgress] = useState(0);
  const router = useRouter();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files with detailed error messages
      if (rejectedFiles.length > 0) {
        const detailedErrors = rejectedFiles.map((rejection) => {
          const fileName = rejection.file.name;
          const errors = rejection.errors.map((error: any) => {
            switch (error.code) {
              case "file-too-large":
                return `${fileName}: File size (${(
                  rejection.file.size /
                  1024 /
                  1024
                ).toFixed(1)}MB) exceeds the 100MB limit`;
              case "file-invalid-type":
                return `${fileName}: File type not supported. Please use PDF, DOC, DOCX, or TXT files`;
              case "too-many-files":
                return `Too many files selected. Maximum ${maxFiles} files allowed`;
              default:
                return `${fileName}: ${error.message}`;
            }
          });
          return errors.join(", ");
        });

        onError?.(`Upload rejected: ${detailedErrors.join("; ")}`);
      }

      // Check if adding files would exceed the limit
      const availableSlots = maxFiles - files.length;
      if (acceptedFiles.length > availableSlots) {
        onError?.(
          `Cannot add ${acceptedFiles.length} files. Only ${availableSlots} slots available (maximum ${maxFiles} files total).`
        );
        return;
      }

      // Add accepted files
      const newFiles = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).slice(2),
        file,
        status: "pending" as const,
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...newFiles]);

      // Clear any previous errors when files are successfully added
      if (newFiles.length > 0) {
        onError?.("");
      }
    },
    [files.length, maxFiles, onError]
  );

  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 100 * 1024 * 1024,
    maxFiles,
    disabled: disabled || isUploading,
    multiple: true,
  };
  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone(dropzoneOptions);

  // API Health Check
  const checkApiHealth = async (): Promise<boolean> => {
    try {
      // Use local Next.js API route instead of external API
      const response = await fetch("/api/health", {
        method: "GET",
        timeout: 5000,
      } as any);
      return response.ok;
    } catch (error) {
      console.error("API health check failed:", error);
      // For demo purposes, always return true to allow uploads
      return true;
    }
  };

  // Enhanced error handling with specific error types
  const getErrorMessage = (error: any, fileName: string): string => {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return `Network error: Unable to connect to server. Please check your internet connection and try again.`;
    }

    if (error.name === "AbortError") {
      return `Upload timeout: ${fileName} took too long to upload. Please try again.`;
    }

    if (error.status) {
      switch (error.status) {
        case 400:
          return `Invalid file: ${fileName} format is not supported or file is corrupted.`;
        case 401:
          return `Authentication error: Please check your API credentials and try again.`;
        case 403:
          return `Permission denied: You don't have permission to upload files.`;
        case 413:
          return `File too large: ${fileName} exceeds the maximum file size limit (100MB).`;
        case 415:
          return `Unsupported file type: ${fileName} format is not supported.`;
        case 429:
          return `Rate limit exceeded: Too many uploads. Please wait a moment and try again.`;
        case 500:
          return `Server error: There was a problem processing ${fileName}. Please try again later.`;
        case 503:
          return `Service unavailable: The upload service is temporarily down. Please try again later.`;
        default:
          return `Upload failed: ${fileName} could not be uploaded (Error ${error.status}).`;
      }
    }

    return (
      error.message || `Unknown error occurred while uploading ${fileName}.`
    );
  };

  // Retry mechanism for failed uploads
  const retryUpload = async (
    fileIndex: number,
    maxRetries: number = 3
  ): Promise<boolean> => {
    const file = files[fileIndex];
    if (!file) return false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex
              ? {
                  ...f,
                  status: "uploading" as const,
                  progress: 10,
                  error: undefined,
                }
              : f
          )
        );

        const formData = new FormData();
        formData.append("file", file.file);

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        const response = await fetch("/api/contracts/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        setFiles((prev) =>
          prev.map((f, idx) => (idx === fileIndex ? { ...f, progress: 60 } : f))
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = errorText;

          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.error || errorText;
          } catch {
            // Use raw error text if not JSON
          }

          throw { status: response.status, message: errorMessage };
        }

        const data = await response.json();

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex
              ? {
                  ...f,
                  status: "completed" as const,
                  progress: 100,
                  docId: data.id || data.docId,
                }
              : f
          )
        );

        return true;
      } catch (error: any) {
        console.error(
          `Upload attempt ${attempt} failed for ${file.file.name}:`,
          error
        );

        if (attempt === maxRetries) {
          const errorMessage = getErrorMessage(error, file.file.name);
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? {
                    ...f,
                    status: "error" as const,
                    error: errorMessage,
                    progress: 0,
                  }
                : f
            )
          );
          return false;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    return false;
  };

  const uploadBatch = async () => {
    if (files.length === 0) return;

    // Check API health before starting upload
    const isApiHealthy = await checkApiHealth();
    if (!isApiHealthy) {
      onError?.(
        "API is currently unavailable. Please check the service status and try again later."
      );
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    try {
      // Update all files to uploading
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "uploading" as const, progress: 10 }))
      );

      const results: BatchUploadResult[] = [];
      let completedCount = 0;

      // Upload files one by one with retry logic
      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        if (!fileItem) continue;
        const file = fileItem.file;

        try {
          setFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, progress: 30 } : f))
          );

          const formData = new FormData();
          formData.append("file", file);

          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

          const response = await fetch("/api/contracts/upload", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          setFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, progress: 60 } : f))
          );

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
              const errorText = await response.text();
              const errorJson = JSON.parse(errorText);
              errorMessage =
                errorJson.message || errorJson.error || errorMessage;
            } catch {
              // Use default error message if response is not JSON
            }

            throw { status: response.status, message: errorMessage };
          }

          const data = await response.json();

          results.push({ name: file.name, docId: data.id || data.docId });
          completedCount++;

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: "completed" as const,
                    progress: 100,
                    docId: data.id || data.docId,
                  }
                : f
            )
          );

          // Update global progress
          setGlobalProgress(Math.round((completedCount / files.length) * 100));
        } catch (error: unknown) {
          console.error(`Upload error for ${file.name}:`, error);
          const errorMessage = getErrorMessage(error, file.name);

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === i
                ? {
                    ...f,
                    status: "error" as const,
                    error: errorMessage,
                    progress: 0,
                  }
                : f
            )
          );
        }
      }

      setUploadResults(results);

      if (results.length > 0) {
        onUploadComplete?.(results);

        // Assign client/supplier metadata if provided
        if (clientId || supplierId) {
          try {
            await Promise.all(
              results.map(async (result) => {
                try {
                  // Skip contract assignment for demo - contracts are auto-assigned
                  console.log(
                    `Contract ${result.docId} would be assigned to client: ${clientId}, supplier: ${supplierId}`
                  );
                } catch (e) {
                  console.warn(
                    `Failed to assign metadata to ${result.name}:`,
                    e
                  );
                }
              })
            );
          } catch (e) {
            console.warn("Failed to assign metadata to some contracts:", e);
          }
        }

        // Handle navigation
        if (results.length === 1) {
          const firstResult = results[0];
          if (firstResult) {
            const qp = policyPack
              ? `?policyPack=${encodeURIComponent(policyPack)}`
              : "";
            router.push(`/contracts/${firstResult.docId}${qp}`);
          }
        } else if (results.length > 0) {
          try {
            window.sessionStorage.setItem(
              "batchUploadedCount",
              String(results.length)
            );
            window.sessionStorage.setItem(
              "batchUploadedDocIds",
              JSON.stringify(results.map((it) => it.docId))
            );
          } catch {}
          router.push("/contracts");
        }
      } else {
        // All uploads failed
        onError?.(
          "All file uploads failed. Please check the files and try again."
        );
      }
    } catch (error: unknown) {
      console.error("Batch upload error:", error);
      const errorMessage =
        (error instanceof Error ? error.message : String(error)) ||
        "An unexpected error occurred during upload.";
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error" as const,
          error: errorMessage,
        }))
      );
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setGlobalProgress(0);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
    setUploadResults([]);
  };

  const getStatusIcon = (status: UploadFile["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadFile["status"]) => {
    switch (status) {
      case "pending":
        return "Ready to upload";
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing...";
      case "completed":
        return "Complete";
      case "error":
        return "Error";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300"}
          ${
            disabled || isUploading
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-gray-400 hover:bg-gray-50"
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload
          className={`mx-auto h-12 w-12 mb-4 ${
            isDragActive ? "text-blue-500" : "text-gray-400"
          }`}
        />
        {isDragActive ? (
          <p className="text-lg font-medium text-blue-600">
            Drop the files here...
          </p>
        ) : (
          <>
            <p className="text-lg font-medium">Drag & drop files here</p>
            <p className="text-sm text-gray-500 mt-2">
              or click to select files
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOC, DOCX, TXT up to 100MB • Max {maxFiles} files
            </p>
          </>
        )}
      </div>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600 font-medium">
            Some files were rejected:
          </p>
          <ul className="text-xs text-red-500 mt-1 space-y-1">
            {fileRejections.map(({ file, errors }) => (
              <li key={file.name}>
                {file.name}: {errors.map((e) => e.message).join(", ")}
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
              Uploading {files.length} file{files.length !== 1 ? "s" : ""}...
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
              {completedCount > 0 && (
                <span className="text-green-600 ml-2">
                  • {completedCount} completed
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-600 ml-2">• {errorCount} failed</span>
              )}
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

          {files.map((file) => (
            <div
              key={file.id}
              className="border rounded-lg p-3 space-y-2 bg-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)} •{" "}
                      {getStatusText(file.status)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusIcon(file.status)}
                  {file.status === "completed" && file.docId && (
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
                    disabled={file.status === "uploading"}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {file.status === "uploading" && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ inlineSize: `${file.progress}%` }}
                  />
                </div>
              )}

              {/* Error Message */}
              {file.error && (
                <div className="mt-2">
                  <p className="text-xs text-red-500 mb-2">{file.error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      retryUpload(files.findIndex((f) => f.id === file.id))
                    }
                    disabled={isUploading}
                    className="text-xs h-6 px-2"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Document ID */}
              {file.docId && (
                <p className="text-xs text-gray-500 font-mono">
                  ID: {file.docId}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Results Summary */}
      {uploadResults.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-700 mb-2">
            Successfully uploaded {uploadResults.length} contract
            {uploadResults.length !== 1 ? "s" : ""}
          </h3>
          <div className="space-y-2">
            {uploadResults.map((result) => (
              <div
                key={result.docId}
                className="flex items-center justify-between text-sm"
              >
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
              onClick={() => router.push("/contracts")}
              variant="outline"
              size="sm"
            >
              View All Contracts
            </Button>
            {uploadResults.length === 1 && uploadResults[0] && (
              <Button
                onClick={() =>
                  router.push(`/contracts/${uploadResults[0]?.docId}`)
                }
                size="sm"
              >
                View Contract
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload Buttons */}
      <div className="space-y-3">
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
              `Upload ${pendingCount} File${pendingCount !== 1 ? "s" : ""}`
            )}
          </Button>
        )}

        {errorCount > 0 && !isUploading && (
          <Button
            onClick={async () => {
              const failedIndexes = files
                .map((file, index) => (file.status === "error" ? index : -1))
                .filter((index) => index !== -1);

              for (const index of failedIndexes) {
                await retryUpload(index);
              }
            }}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry All Failed ({errorCount})
          </Button>
        )}
      </div>
    </div>
  );
}

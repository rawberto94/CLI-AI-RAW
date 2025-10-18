"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "completed" | "error";
  progress: number;
  docId?: string;
  error?: string;
}

interface UploadZoneProps {
  onUploadComplete?: (docId: string) => void;
  onError?: (error: string) => void;
  tenantId?: string;
  maxFiles?: number;
  disabled?: boolean;
}

export function UploadZone({
  onUploadComplete,
  onError,
  tenantId = "demo",
  maxFiles = 10,
  disabled = false,
}: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map((f) =>
          f.errors.map((e: any) => e.message).join(", ")
        );
        onError?.(`Some files were rejected: ${errors.join("; ")}`);
      }

      // Add accepted files
      const newFiles = acceptedFiles
        .slice(0, maxFiles - files.length)
        .map((file) => ({
          id: Math.random().toString(36).slice(2),
          file,
          status: "pending" as const,
          progress: 0,
        }));

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files.length, maxFiles, onError]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: {
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          [".docx"],
      },
      maxSize: 100 * 1024 * 1024, // 100MB
      maxFiles,
      disabled: disabled || isUploading,
    });

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (const uploadFile of files.filter((f) => f.status === "pending")) {
      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "uploading", progress: 10 }
              : f
          )
        );

        // Validate file client-side
        if (
          ![
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ].includes(uploadFile.file.type)
        ) {
          throw new Error(
            "Invalid file type. Only PDF, DOC, and DOCX files are allowed."
          );
        }

        if (uploadFile.file.size > 100 * 1024 * 1024) {
          throw new Error("File size must be less than 100MB.");
        }

        // Create FormData
        const formData = new FormData();
        formData.append("file", uploadFile.file);

        // Upload with progress tracking
        const response = await fetch("/api/contracts/upload", {
          method: "POST",
          headers: {
            "x-tenant-id": tenantId,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const { docId } = await response.json();

        // Update status to processing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "processing", progress: 50, docId }
              : f
          )
        );

        // Poll for completion
        await pollForCompletion(docId, uploadFile.id);
      } catch (error) {
        const errorMessage = (error as Error).message;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error", error: errorMessage }
              : f
          )
        );
        onError?.(errorMessage);
      }
    }

    setIsUploading(false);
  };

  const pollForCompletion = async (docId: string, fileId: string) => {
    const maxAttempts = 60; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/contracts/${docId}/progress`, {
          headers: { "x-tenant-id": tenantId },
        });

        if (response.ok) {
          const { status, percent } = await response.json();

          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    progress: Math.max(50, Math.min(95, 50 + percent * 0.45)),
                  }
                : f
            )
          );

          if (status === "COMPLETED") {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? { ...f, status: "completed", progress: 100 }
                  : f
              )
            );
            onUploadComplete?.(docId);
            break;
          } else if (status === "FAILED") {
            throw new Error("Document processing failed");
          }
        }
      } catch (error) {
        console.warn("Error polling for completion:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "error",
                error: "Processing timeout - please check document status",
              }
            : f
        )
      );
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
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
              PDF, DOC, DOCX up to 100MB • Max {maxFiles} files
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
                  <button
                    onClick={() => removeFile(file.id)}
                    disabled={
                      file.status === "uploading" ||
                      file.status === "processing"
                    }
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {(file.status === "uploading" ||
                file.status === "processing") && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}

              {/* Error Message */}
              {file.error && (
                <p className="text-xs text-red-500 mt-1">{file.error}</p>
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

      {/* Upload Button */}
      {pendingCount > 0 && (
        <button
          onClick={uploadFiles}
          disabled={isUploading || pendingCount === 0}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading{" "}
              {
                files.filter(
                  (f) => f.status === "uploading" || f.status === "processing"
                ).length
              }{" "}
              of {files.length}...
            </>
          ) : (
            `Upload ${pendingCount} File${pendingCount !== 1 ? "s" : ""}`
          )}
        </button>
      )}
    </div>
  );
}

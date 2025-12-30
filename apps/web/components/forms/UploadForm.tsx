"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCallback, useEffect, useState, useRef } from "react";
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Validation schema
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

const uploadSchema = z.object({
  file: z
    .instanceof(File, { message: "File is required" })
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File must be less than 10MB",
    })
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), {
      message: "File must be PDF, DOC, DOCX, or TXT",
    }),
  documentType: z.enum(["contract", "invoice", "sow", "other"], {
    required_error: "Document type is required",
  }),
  description: z.string().min(5, "Description must be at least 5 characters").max(500),
  tags: z.array(z.string()).optional(),
  clientId: z.string().min(1, "Client is required"),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface UploadFormProps {
  onSubmit: (data: UploadFormData) => Promise<void>;
  defaultValues?: Partial<UploadFormData>;
  clients?: { id: string; name: string }[];
}

export function UploadForm({ onSubmit, defaultValues, clients = [] }: UploadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    control,
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      documentType: "contract",
      description: "",
      tags: [],
      ...defaultValues,
    },
  });

  const selectedFile = watch("file");
  const watchedValues = useWatch({ control });

  // Auto-save functionality
  useEffect(() => {
    if (!isDirty) return;

    setAutoSaveStatus("saving");
    const timeout = setTimeout(() => {
      // Here you would call your auto-save API
      console.log("Auto-saving draft:", watchedValues);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [watchedValues, isDirty]);

  // Drag and drop handlers
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

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setValue("file", files[0], { shouldValidate: true, shouldDirty: true });
      }
    },
    [setValue]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setValue("file", files[0], { shouldValidate: true, shouldDirty: true });
      }
    },
    [setValue]
  );

  const removeFile = useCallback(() => {
    setValue("file", undefined as any, { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [setValue]);

  const handleFormSubmit = async (data: UploadFormData) => {
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await onSubmit(data);

      setUploadProgress(100);
      clearInterval(progressInterval);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {autoSaveStatus === "saving" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-muted-foreground">Saving draft...</span>
            </>
          )}
          {autoSaveStatus === "saved" && (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Draft saved</span>
            </>
          )}
        </div>
        {isDirty && (
          <Badge variant="outline" className="text-orange-600">
            Unsaved changes
          </Badge>
        )}
      </div>

      {/* File Upload Area */}
      <div className="space-y-2">
        <Label htmlFor="file-upload">Document File *</Label>
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
            ${errors.file ? "border-red-500" : ""}
          `}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeFile}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">{uploadProgress}% uploaded</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Drop your file here, or{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, DOC, DOCX, TXT (Max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
            </>
          )}
        </div>
        {errors.file && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.file.message}
          </p>
        )}
      </div>

      {/* Document Type */}
      <div className="space-y-2">
        <Label htmlFor="documentType">Document Type *</Label>
        <Select
          defaultValue={defaultValues?.documentType}
          onValueChange={(value) =>
            setValue("documentType", value as any, { shouldValidate: true })
          }
          disabled={isSubmitting}
        >
          <SelectTrigger id="documentType">
            <SelectValue placeholder="Select document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="sow">Statement of Work</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.documentType && (
          <p className="text-sm text-red-500">{errors.documentType.message}</p>
        )}
      </div>

      {/* Client Selection */}
      <div className="space-y-2">
        <Label htmlFor="clientId">Client *</Label>
        <Select
          defaultValue={defaultValues?.clientId}
          onValueChange={(value) => setValue("clientId", value, { shouldValidate: true })}
          disabled={isSubmitting}
        >
          <SelectTrigger id="clientId">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.clientId && (
          <p className="text-sm text-red-500">{errors.clientId.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <textarea
          id="description"
          {...register("description")}
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Describe the document..."
          disabled={isSubmitting}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
        {errors.description && (
          <p id="description-error" className="text-sm text-red-500">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !selectedFile}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

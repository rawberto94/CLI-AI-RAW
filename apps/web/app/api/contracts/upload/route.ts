/**
 * Contract Upload API
 * POST /api/contracts/upload - Upload a contract file
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService
 * - Proper file validation and storage
 * - Automatic artifact generation trigger
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { contractService } from "@/lib/data-orchestration";
import {
  ensureProcessingJob,
  startProcessingJob,
} from "@/lib/contract-processing";
import { triggerArtifactGeneration } from "@/lib/artifact-trigger";

// ============================================================================
// FILE VALIDATION CONSTANTS
// ============================================================================

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/html",
  "application/xhtml+xml",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/webp",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".html",
  ".htm",
  ".jpeg",
  ".jpg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".tif",
  ".webp",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UploadResponse {
  success: boolean;
  contractId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
  message?: string;
  error?: string;
  details?: string;
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate file type based on extension and MIME type
 */
function validateFileType(file: File): FileValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf("."));

  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: "Invalid file type",
      details: `File extension ${fileExtension} is not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(
        ", "
      )}`,
    };
  }

  // Check MIME type (if provided)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid MIME type",
      details: `MIME type ${file.type} is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
function validateFileSize(file: File): FileValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      error: "Empty file",
      details: "The uploaded file is empty",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: "File too large",
      details: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/\.+/g, ".")
    .replace(/_+/g, "_")
    .substring(0, 255); // Limit filename length
}

// ============================================================================
// MAIN UPLOAD HANDLER
// ============================================================================

/**
 * POST /api/contracts/upload
 *
 * Upload a contract file with validation
 * Requirements: 1.1, 1.7
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse>> {
  console.log("📤 Contract upload request received");

  try {
    const tenantId = request.headers.get("x-tenant-id") || "demo";
    console.log("Tenant ID:", tenantId);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
          details: "Please select a file to upload",
        },
        { status: 400 }
      );
    }

    console.log("📋 File received:", {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validate file
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: typeValidation.error,
          details: typeValidation.details,
        },
        { status: 400 }
      );
    }

    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: sizeValidation.error,
          details: sizeValidation.details,
        },
        { status: 400 }
      );
    }

    // Save file to disk
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${timestamp}-${sanitizedFileName}`;
    const uploadDir = join(process.cwd(), "uploads", "contracts", tenantId);
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, storedFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    console.log("💾 File saved to:", filePath);

    // Extract metadata
    const metadata = {
      contractType: formData.get("contractType") as string | null,
      contractTitle: formData.get("contractTitle") as string | null,
      clientName: formData.get("clientName") as string | null,
      supplierName: formData.get("supplierName") as string | null,
      uploadedBy: formData.get("uploadedBy") as string | null,
      description: formData.get("description") as string | null,
      category: formData.get("category") as string | null,
      totalValue: formData.get("totalValue") as string | null,
      currency: formData.get("currency") as string | null,
    };

    // Create contract using data-orchestration service
    const result = await contractService.createContract({
      tenantId,
      fileName: file.name,
      originalName: file.name,
      fileSize: BigInt(file.size),
      mimeType: file.type || "application/octet-stream",
      storagePath: filePath,
      storageProvider: "local",
      status: "PROCESSING",
      uploadedBy: metadata.uploadedBy || "anonymous",
      contractType: metadata.contractType || "UNKNOWN",
      contractTitle: metadata.contractTitle || file.name,
      clientName: metadata.clientName,
      supplierName: metadata.supplierName,
      description: metadata.description,
      category: metadata.category,
      uploadedAt: new Date(),
    } as any);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create contract",
          details: result.error.message,
        },
        { status: 500 }
      );
    }

    const contract = result.data;

    // Create processing job
    ensureProcessingJob(contract.id);
    const processingJob = startProcessingJob(contract.id);

    // Initialize contract metadata
    const { initializeContractMetadata } = await import(
      "@/lib/contract-integration"
    );
    initializeContractMetadata(contract.id, contract.tenantId, {
      fileName: file.name,
      contractType: metadata.contractType,
      clientName: metadata.clientName,
      supplierName: metadata.supplierName,
      totalValue: metadata.totalValue ? Number(metadata.totalValue) : undefined,
      currency: metadata.currency,
    }).catch((error) => {
      console.error("❌ Metadata initialization error:", error);
    });

    // Trigger artifact generation in background
    triggerArtifactGeneration({
      contractId: contract.id,
      tenantId: contract.tenantId,
      filePath,
      mimeType: file.type,
      useQueue: false,
    })
      .then((artifactResult) => {
        console.log("🎉 Artifact generation started:", artifactResult);
      })
      .catch((error) => {
        console.error("❌ Artifact generation error:", error);
      });

    console.log("✅ Contract created:", {
      contractId: contract.id,
      processingJobId: processingJob.id,
    });

    return NextResponse.json(
      {
        success: true,
        contractId: contract.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        status: "PROCESSING",
        processingJobId: processingJob.id,
        message: "File uploaded successfully",
      },
      {
        status: 201,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
        },
      }
    );
  } catch (error) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

/**
 * OPTIONS /api/contracts/upload
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
      "Access-Control-Max-Age": "86400",
    },
  });
}

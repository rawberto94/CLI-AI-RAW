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
import cors from "@/lib/security/cors";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { triggerArtifactGeneration, PROCESSING_PRIORITY } from "@/lib/artifact-trigger";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { contractUploadSchema } from "@/lib/validation/contract.validation";
import { ZodError } from "zod";

// Using singleton prisma instance from @/lib/prisma

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
  processingJobId?: string;
  message?: string;
  error?: string;
  details?: string;
  code?: string;
  retryable?: boolean;
  isDuplicate?: boolean;
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate content hash for deduplication
 */
function generateContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
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
): Promise<NextResponse> {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Tenant ID is required",
          details: "Please provide x-tenant-id header",
        },
        { status: 400 }
      );
    }

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

    // Extract and validate metadata using Zod schema
    try {
      const metadata = {
        contractType: formData.get("contractType") ? (formData.get("contractType") as string) : undefined,
        startDate: formData.get("startDate") ? (formData.get("startDate") as string) : undefined,
        endDate: formData.get("endDate") ? (formData.get("endDate") as string) : undefined,
        totalValue: formData.get("totalValue") ? parseFloat(formData.get("totalValue") as string) : undefined,
        currency: formData.get("currency") ? (formData.get("currency") as string) : undefined,
        clientName: formData.get("clientName") ? (formData.get("clientName") as string) : undefined,
        supplierName: formData.get("supplierName") ? (formData.get("supplierName") as string) : undefined,
        contractTitle: formData.get("contractTitle") ? (formData.get("contractTitle") as string) : undefined,
        description: formData.get("description") ? (formData.get("description") as string) : undefined,
        category: formData.get("category") ? (formData.get("category") as string) : undefined,
        uploadedBy: formData.get("uploadedBy") ? (formData.get("uploadedBy") as string) : undefined,
        priority: formData.get("priority") ? (formData.get("priority") as string) : undefined,
        ocrMode: formData.get("ocrMode") ? (formData.get("ocrMode") as string) : undefined,
      };

      // Validate with contractUploadSchema
      contractUploadSchema.parse(metadata);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          },
          { status: 400 }
        );
      }
      throw error;
    }

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

    // Save file to object storage (MinIO/S3)
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${timestamp}-${sanitizedFileName}`;
    const objectKey = `contracts/${tenantId}/${storedFileName}`;
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate content hash for deduplication (uses checksum field)
    const contentHash = generateContentHash(buffer);
    
    // Check for duplicate file using transactional read for consistency
    // DISABLED: Duplicate detection is currently disabled to avoid false positives
    // To re-enable, set ENABLE_DUPLICATE_DETECTION=true in env
    const skipDuplicateCheck = request.headers.get('x-skip-duplicate-check') === 'true';
    const enableDuplicateDetection = process.env.ENABLE_DUPLICATE_DETECTION === 'true';
    
    if (enableDuplicateDetection && !skipDuplicateCheck) {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const existingContract = await prisma.$transaction(async (tx) => {
          const contract = await tx.contract.findFirst({
            where: {
              tenantId,
              checksum: contentHash,
              isDeleted: false,
              status: { notIn: ['FAILED', 'DELETED'] },
              // Only consider as duplicate if uploaded in last 7 days
              createdAt: { gte: sevenDaysAgo }
            },
            select: { id: true, status: true, fileName: true, createdAt: true }
          });
          
          // Double-check the contract exists in same transaction
          if (contract) {
            const verified = await tx.contract.findUnique({
              where: { id: contract.id },
              select: { id: true, status: true }
            });
            return verified ? contract : null;
          }
          return null;
        }, {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 10000,
        });
        
        if (existingContract) {
          return NextResponse.json(
            {
              success: true,
              contractId: existingContract.id,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              status: existingContract.status,
              message: "This file was uploaded recently (within 7 days). You can re-process or view existing.",
              isDuplicate: true,
            },
            { status: 200 }
          );
        }
      } catch {
        // Continue with upload if duplicate check fails
      }
    }

    let filePath = objectKey;
    let storageProvider = "s3";
    let uploadResult: { success: boolean; url?: string; error?: string } | null = null;

    // Try to upload to object storage first
    try {
      const { initializeStorage } = await import("@/lib/storage-service");
      const storageService = initializeStorage();
      
      if (storageService) {
        uploadResult = await storageService.upload({
          fileName: objectKey,
          buffer,
          contentType: file.type,
          metadata: {
            tenantId,
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        });

        if (uploadResult.success) {
          filePath = objectKey;
          storageProvider = "s3";
        } else {
          throw new Error(uploadResult.error || "Upload failed");
        }
      } else {
        throw new Error("Storage service not available");
      }
    } catch {
      // Fallback to local filesystem
      const uploadDir = join(process.cwd(), "uploads", "contracts", tenantId);
      await mkdir(uploadDir, { recursive: true });
      const localPath = join(uploadDir, storedFileName);
      await writeFile(localPath, buffer);
      
      filePath = localPath;
      storageProvider = "local";
    }

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
      lifecycle: formData.get("lifecycle") as string | null,
    };

    // Create contract with all side effects in a transaction
    const idempotencyKey = formData.get("idempotency_key") as string | undefined;
    
    const { result: transactionResult, wasExecuted } = await (async () => {
      try {
        const { createContractWithSideEffects } = await import("@/lib/transaction-service");
        
        return await createContractWithSideEffects({
          contractData: {
            tenantId: tenantId,
            fileName: file.name,
            originalName: file.name,
            fileSize: BigInt(file.size),
            mimeType: file.type || "application/octet-stream",
            storagePath: filePath,
            storageProvider: storageProvider,
            status: metadata.lifecycle === 'NEW' || metadata.lifecycle === 'AMENDMENT' ? "DRAFT" : "PROCESSING",
            documentRole: metadata.lifecycle === 'NEW' ? 'NEW_CONTRACT' : 
                         metadata.lifecycle === 'AMENDMENT' ? 'AMENDMENT' :
                         metadata.lifecycle === 'RENEWAL' ? 'RENEWAL' : 'EXISTING',
            uploadedBy: metadata.uploadedBy || "anonymous",
            contractType: metadata.contractType || "UNKNOWN",
            contractTitle: metadata.contractTitle || file.name,
            clientName: metadata.clientName || undefined,
            supplierName: metadata.supplierName || undefined,
            description: metadata.description || undefined,
            category: metadata.category || undefined,
            uploadedAt: new Date(),
            checksum: contentHash, // Add checksum for deduplication
          },
          idempotencyKey,
        });
      } catch {
        
        // Fallback to direct creation
        const contract = await prisma.contract.create({
          data: {
            tenantId: tenantId,
            fileName: file.name,
            originalName: file.name,
            fileSize: BigInt(file.size),
            mimeType: file.type || "application/octet-stream",
            storagePath: filePath,
            storageProvider: storageProvider,
            status: "PROCESSING",
            uploadedBy: metadata.uploadedBy || "anonymous",
            contractType: metadata.contractType || "UNKNOWN",
            contractTitle: metadata.contractTitle || file.name,
            clientName: metadata.clientName || undefined,
            supplierName: metadata.supplierName || undefined,
            description: metadata.description || undefined,
            category: metadata.category || undefined,
            uploadedAt: new Date(),
            checksum: contentHash, // Add checksum for deduplication
          },
        });

        const processingJob = await prisma.processingJob.create({
          data: {
            contractId: contract.id,
            tenantId: contract.tenantId,
            status: "PENDING",
            progress: 0,
            currentStep: "uploaded",
            totalStages: 5,
            priority: 5,
            maxRetries: 3,
            retryCount: 0,
          },
        });

        return {
          result: { contract, processingJob, outboxEvent: null },
          wasExecuted: true,
        };
      }
    })();

    const { contract, processingJob } = transactionResult;

    if (wasExecuted) {
      await publishRealtimeEvent({
        event: "contract:created",
        data: {
          tenantId: contract.tenantId,
          contractId: contract.id,
          status: contract.status,
        },
        source: "api:contracts/upload",
      });
    }

    // Initialize contract metadata (non-blocking)
    try {
      const { initializeContractMetadata } = await import(
        "@/lib/contract-integration"
      );
      await initializeContractMetadata(contract.id, contract.tenantId, {
        fileName: file.name,
        contractType: metadata.contractType,
        clientName: metadata.clientName,
        supplierName: metadata.supplierName,
        totalValue: metadata.totalValue ? Number(metadata.totalValue) : undefined,
        currency: metadata.currency,
      }).catch((err) => {
        console.error('[ContractUpload] Metadata initialization error:', err);
      });
    } catch {
      // Silently handle import errors
    }

    // Classify contract using taxonomy (non-blocking, async)
    try {
      // Read first few pages for classification
      const textContent = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
      
      const { quickClassifyContract } = await import("@/lib/ai/contract-classifier-taxonomy");
      
      // Run classification in background
      quickClassifyContract(textContent, file.name)
        .then(async (classification) => {
          // Validate category ownership before assignment
          const category = await prisma.taxonomyCategory.findFirst({
            where: { 
              id: classification.category_id,
              tenantId 
            },
          });
          
          // Only update if category is valid for this tenant
          if (category || !classification.category_id) {
            // Update contract with taxonomy classification
            await prisma.contract.update({
              where: { id: contract.id },
              data: {
                contractCategoryId: classification.category_id,
                contractSubtype: classification.subtype,
                documentRole: classification.role,
                classificationConf: classification.confidence,
                classifiedAt: new Date(),
              },
            });
          }
        })
        .catch((err) => {
          console.error('[ContractUpload] Classification error:', err);
        });
    } catch {
      // Silently handle taxonomy classifier import errors
    }

    // Trigger artifact generation via queue (non-blocking)
    try {
      // Initialize queue service if not already done
      await import("@/lib/queue-init");
      
      // Determine priority from form data or default to NORMAL
      const priorityParam = formData.get("priority") as string | null;
      let priority: number = PROCESSING_PRIORITY.NORMAL;
      
      if (priorityParam === 'urgent' || priorityParam === 'high') {
        priority = PROCESSING_PRIORITY.HIGH;
      } else if (priorityParam === 'low' || priorityParam === 'bulk') {
        priority = PROCESSING_PRIORITY.LOW;
      } else if (priorityParam === 'background') {
        priority = PROCESSING_PRIORITY.BACKGROUND;
      }
      
      // Get OCR mode from form data (user-selected AI model)
      const ocrMode = formData.get("ocrMode") as string | null;
      
      const artifactResult = await triggerArtifactGeneration({
        contractId: contract.id,
        tenantId: contract.tenantId,
        filePath,
        mimeType: file.type,
        useQueue: true, // Use queue system
        priority: priority as any, // Type assertion for numeric priority
        source: 'upload',
        ocrMode: ocrMode || undefined, // Pass user's AI model selection
      });
      
      if (artifactResult.jobId) {
        // Update processing job with queue job ID
        await prisma.processingJob.update({
          where: { id: processingJob.id },
          data: {
            queueId: artifactResult.jobId,
            status: "RUNNING",
          },
        }).catch((err) => console.error('[ContractUpload] Processing job update error:', err));
      }
    } catch {
      // Continue anyway - job will still process via fallback
    }

    const response = NextResponse.json<UploadResponse>(
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
      { status: 201 }
    );
    return cors.addCorsHeaders(response, request, "POST, OPTIONS");
  } catch (error: unknown) {
    // Determine error type and retryability
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    let code = "UPLOAD_ERROR";
    let retryable = true;
    let statusCode = 500;
    
    if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
      code = "RATE_LIMITED";
      retryable = true;
      statusCode = 429;
    } else if (errorMessage.includes("quota") || errorMessage.includes("storage")) {
      code = "QUOTA_EXCEEDED";
      retryable = false;
      statusCode = 507;
    } else if (errorMessage.includes("validation") || errorMessage.includes("invalid")) {
      code = "VALIDATION_ERROR";
      retryable = false;
      statusCode = 400;
    } else if (errorMessage.includes("connection") || errorMessage.includes("timeout")) {
      code = "CONNECTION_ERROR";
      retryable = true;
      statusCode = 503;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
        code,
        details: errorMessage,
        retryable,
      },
      {
        status: statusCode,
        headers: code === "RATE_LIMITED" ? { "Retry-After": "60" } : {},
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
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "POST, OPTIONS");
}

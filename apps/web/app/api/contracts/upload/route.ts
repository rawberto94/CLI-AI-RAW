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
import { contractService } from 'data-orchestration/services';
// TODO: Replace prisma.contract.create with contractService.createContractWithIntegrity
import { triggerArtifactGeneration, PROCESSING_PRIORITY } from "@/lib/artifact-trigger";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { contractUploadSchema } from "@/lib/validation/contract.validation";
import { ZodError } from "zod";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateLimitConfigs } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { scanBuffer } from '@/lib/security/virus-scan';

// ============================================================================
// UPLOAD RATE LIMITING (Redis-backed with in-memory fallback)
// ============================================================================

let _redisClient: any = null;
async function getUploadRedisClient(): Promise<any> {
  if (_redisClient) return _redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  try {
    const Redis = (await import('ioredis')).default;
    _redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
    await _redisClient.connect();
    return _redisClient;
  } catch {
    return null;
  }
}

const _memRateStore = new Map<string, { count: number; resetAt: number }>();
// Clean up expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _memRateStore.entries()) {
    if (val.resetAt < now) _memRateStore.delete(key);
  }
}, 120_000);

async function checkUploadRateLimit(tenantId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = rateLimitConfigs['/api/contracts/upload'] || { windowMs: 60000, maxRequests: 10, keyPrefix: 'ratelimit:upload:' };
  const key = `${config.keyPrefix}${tenantId}`;
  const now = Date.now();

  // Try Redis first
  const redis = await getUploadRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, config.windowMs);
      }
      if (count > config.maxRequests) {
        const ttl = await redis.pttl(key);
        return { allowed: false, retryAfter: Math.ceil(Math.max(ttl, 1000) / 1000) };
      }
      return { allowed: true };
    } catch {
      // Redis failed, fall through to memory
    }
  }

  // In-memory fallback
  const entry = _memRateStore.get(key);
  if (entry && entry.resetAt > now) {
    entry.count++;
    if (entry.count > config.maxRequests) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true };
  }
  _memRateStore.set(key, { count: 1, resetAt: now + config.windowMs });
  return { allowed: true };
}

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
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const uploadStartTime = Date.now();
  
  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400, {
      details: 'Please provide x-tenant-id header',
    });
  }

  // Rate limiting: 10 uploads per minute per tenant (Redis-backed)
  const rlResult = await checkUploadRateLimit(tenantId);
  if (!rlResult.allowed) {
    return createErrorResponse(ctx, 'RATE_LIMITED', `Too many uploads. Limit: 10 per minute.`, 429, {
      retryAfter: rlResult.retryAfter,
    });
  }

  // Tenant upload quota: configurable max contracts per tenant
  const TENANT_MAX_CONTRACTS = parseInt(process.env.TENANT_MAX_CONTRACTS || '10000', 10);
  const TENANT_MAX_STORAGE_MB = parseInt(process.env.TENANT_MAX_STORAGE_MB || '50000', 10);
  try {
    const tenantUsage = await prisma.contract.aggregate({
      where: { tenantId, isDeleted: false },
      _count: { id: true },
      _sum: { fileSize: true },
    });
    const contractCount = tenantUsage._count.id || 0;
    const storageMB = Number(tenantUsage._sum.fileSize || 0) / (1024 * 1024);

    if (contractCount >= TENANT_MAX_CONTRACTS) {
      return createErrorResponse(ctx, 'QUOTA_EXCEEDED', `Tenant quota exceeded: ${contractCount}/${TENANT_MAX_CONTRACTS} contracts`, 403, {
        details: `Maximum ${TENANT_MAX_CONTRACTS} contracts per tenant. Please archive or delete unused contracts.`,
        currentCount: contractCount,
        limit: TENANT_MAX_CONTRACTS,
      });
    }
    if (storageMB >= TENANT_MAX_STORAGE_MB) {
      return createErrorResponse(ctx, 'QUOTA_EXCEEDED', `Storage quota exceeded: ${storageMB.toFixed(0)}MB/${TENANT_MAX_STORAGE_MB}MB`, 403, {
        details: `Maximum ${TENANT_MAX_STORAGE_MB}MB storage per tenant.`,
        currentMB: Math.round(storageMB),
        limitMB: TENANT_MAX_STORAGE_MB,
      });
    }
  } catch (quotaError) {
    // Non-blocking: if quota check fails, allow upload but log warning
    logger.warn({ tenantId, error: quotaError }, 'Failed to check tenant quota, allowing upload');
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No file provided', 400, {
      details: 'Please select a file to upload',
    });
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
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, {
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    throw error;
  }

  // Validate file
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', typeValidation.error || 'Invalid file type', 400, {
      details: typeValidation.details,
    });
  }

  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', sizeValidation.error || 'Invalid file size', 400, {
      details: sizeValidation.details,
    });
  }

  // Save file to object storage (MinIO/S3)
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFileName(file.name);
  const storedFileName = `${timestamp}-${sanitizedFileName}`;
  const objectKey = `contracts/${tenantId}/${storedFileName}`;
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Virus/malware scan before processing
  const scanResult = await scanBuffer(buffer, file.name);
  if (!scanResult.clean) {
    logger.warn(`Virus scan failed for ${file.name}`, { threats: scanResult.threats, tenantId });
    return NextResponse.json(
      { error: 'File rejected by security scan', threats: scanResult.threats },
      { status: 422 }
    );
  }
  
  // Generate content hash for deduplication (uses checksum field)
  const contentHash = generateContentHash(buffer);
  
  // Check for duplicate file using transactional read for consistency
  // ENABLED by default — set DISABLE_DUPLICATE_DETECTION=true to opt out
  const skipDuplicateCheck = request.headers.get('x-skip-duplicate-check') === 'true';
  const enableDuplicateDetection = process.env.DISABLE_DUPLICATE_DETECTION !== 'true';
  
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
        const successResp = createSuccessResponse(ctx, {
            contractId: existingContract.id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            status: existingContract.status,
            message: "This file was uploaded recently (within 7 days). You can re-process or view existing.",
            isDuplicate: true,
        });
        return successResp;
      }
    } catch (dupErr) {
      logger.error('[ContractUpload] Duplicate check failed:', dupErr);
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
        // Also save a local copy so the artifact worker can always access the file
        // even when BullMQ workers aren't running or S3 is unreachable from the worker
        try {
          const localUploadDir = join(process.cwd(), "uploads", "contracts", tenantId);
          await mkdir(localUploadDir, { recursive: true });
          const localCopyPath = join(localUploadDir, storedFileName);
          await writeFile(localCopyPath, buffer);
          logger.info(`[ContractUpload] Local copy saved at ${localCopyPath}`);
        } catch (localCopyErr) {
          logger.warn('[ContractUpload] Failed to save local copy (non-critical):', localCopyErr);
        }
      } else {
        throw new Error(uploadResult.error || "Upload failed");
      }
    } else {
      throw new Error("Storage service not available");
    }
  } catch (storageErr) {
    logger.error('[ContractUpload] S3/MinIO upload failed, falling back to local:', storageErr);
    // Fallback to local filesystem
    // WARNING: In multi-container deployments the worker may not access this path.
    // This works in dev (same host), but in production ensure MinIO/S3 is always available.
    const uploadDir = join(process.cwd(), "uploads", "contracts", tenantId);
    await mkdir(uploadDir, { recursive: true });
    const localPath = join(uploadDir, storedFileName);
    await writeFile(localPath, buffer);
    
    filePath = localPath;
    storageProvider = "local";
    logger.warn(`[ContractUpload] File stored locally at ${localPath} — worker must run on same host`);
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
          status: metadata.lifecycle === 'REVIEW' ? "PENDING" :
                 metadata.lifecycle === 'NEW' || metadata.lifecycle === 'AMENDMENT' ? "DRAFT" : "PROCESSING",
          documentRole: metadata.lifecycle === 'REVIEW' ? 'REVIEW' :
                       metadata.lifecycle === 'NEW' ? 'NEW_CONTRACT' : 
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
    } catch (sideEffectsErr) {
      logger.warn('[ContractUpload] createContractWithSideEffects unavailable, using direct creation:', (sideEffectsErr as Error).message);
      // Fallback to direct creation — use transaction for atomicity
      const txResult = await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.create({
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

        const processingJob = await tx.processingJob.create({
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

        return { contract, processingJob, outboxEvent: null };
      });

      return {
        result: txResult,
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
      logger.error('[ContractUpload] Metadata initialization error:', err);
    });
  } catch (metaErr) {
    logger.error('[ContractUpload] Metadata init import error:', metaErr);
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
        logger.error('[ContractUpload] Classification error:', err);
      });
  } catch (classErr) {
    logger.error('[ContractUpload] Taxonomy classification error:', classErr);
  }

  // Fast text-based party extraction at upload time
  // Gives immediate clientName/supplierName from document text before AI processing
  try {
    const partyText = buffer.toString('utf-8', 0, Math.min(15000, buffer.length));
    if (!metadata.clientName && !metadata.supplierName && partyText.length > 50) {
      const partyUpdate: Record<string, string> = {};
      // "between X and Y" — most common contract pattern
      const betweenMatch = partyText.match(
        /(?:between|by and between|entered into by)\s+([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(.*?\))?\s*(?:,?\s*(?:and|&)\s+)([A-Z][A-Za-z0-9\s&,.'()\-]{2,80}?)\s*(?:\(|,|\n)/i
      );
      if (betweenMatch) {
        partyUpdate.clientName = betweenMatch[1].replace(/\s+$/, '').trim();
        partyUpdate.supplierName = betweenMatch[2].replace(/\s+$/, '').trim();
      } else {
        // Label patterns: "Client: X", "Vendor: X"
        const clientMatch = partyText.match(/(?:Client|Buyer|Customer|Auftraggeber)\s*[:.]\s*(.+?)(?:\n|$)/i);
        const supplierMatch = partyText.match(/(?:Service Provider|Vendor|Supplier|Provider|Contractor|Auftragnehmer)\s*[:.]\s*(.+?)(?:\n|$)/i);
        if (clientMatch) partyUpdate.clientName = clientMatch[1].replace(/[,;]+$/, '').trim().substring(0, 200);
        if (supplierMatch) partyUpdate.supplierName = supplierMatch[1].replace(/[,;]+$/, '').trim().substring(0, 200);
      }
      if (Object.keys(partyUpdate).length > 0) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: partyUpdate,
        });
      }
    }
  } catch (partyErr) {
    logger.error('[ContractUpload] Party extraction error:', partyErr);
    // Non-critical — AI worker will extract parties later
  }

  // Fast keyword-based contract type detection at upload time
  // This gives an immediate contractType (e.g., "SOW", "NDA", "MSA") without an API call.
  // The OCR worker will later refine this with AI-based detection for higher accuracy.
  try {
    const textContent = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
    const { detectContractType } = await import("@repo/workers/contract-type-profiles");
    const detection = detectContractType(textContent);
    if (detection.type !== 'OTHER' && detection.confidence >= 0.4) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          contractType: detection.type,
          classificationMeta: {
            method: 'upload-keyword-detection',
            confidence: detection.confidence,
            matchedKeywords: detection.matchedKeywords,
            detectedAt: new Date().toISOString(),
          },
        },
      });
    }
  } catch (typeErr) {
    logger.error('[ContractUpload] Contract type detection error:', typeErr);
    // OCR worker will detect type later
  }

  // Trigger artifact generation via queue (non-blocking)
  let queueTriggered = true;
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

    // P4.2: File size priority boost — smaller files get higher priority
    // when no explicit priority was requested by the user
    if (!priorityParam) {
      const fileSizeBytes = file.size;
      const MB = 1024 * 1024;
      if (fileSizeBytes < 1 * MB) {
        priority = PROCESSING_PRIORITY.HIGH;      // < 1 MB → fast-track
      } else if (fileSizeBytes < 5 * MB) {
        priority = PROCESSING_PRIORITY.NORMAL;    // 1–5 MB → normal
      } else if (fileSizeBytes < 20 * MB) {
        priority = PROCESSING_PRIORITY.LOW;       // 5–20 MB → lower prio
      } else {
        priority = PROCESSING_PRIORITY.BACKGROUND; // > 20 MB → background
      }
      logger.info({ fileSizeBytes, derivedPriority: priority }, 'File size priority boost applied');
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
      // Update processing job with queue job ID and set QUEUED status
      await prisma.processingJob.update({
        where: { id: processingJob.id },
        data: {
          queueId: artifactResult.jobId,
          status: "QUEUED",
        },
      }).catch((err) => logger.error('[ContractUpload] Processing job update error:', err));

      // Set contract to QUEUED until worker picks it up
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: 'QUEUED',
        },
      }).catch((err) => logger.error('[ContractUpload] Contract QUEUED status update error:', err));
    }
  } catch (queueErr) {
    logger.error('[ContractUpload] Artifact queue trigger error:', queueErr);
    // CRITICAL: Revert contract to UPLOADED so it's not stuck in PROCESSING forever.
    // The user can retry processing later via the status API.
    try {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'UPLOADED' },
      });
      await prisma.processingJob.update({
        where: { id: processingJob.id },
        data: { status: 'FAILED', error: `Queue trigger failed: ${(queueErr as Error).message}` },
      });
      logger.warn(`[ContractUpload] Contract ${contract.id} reverted to UPLOADED after queue failure`);
    } catch (revertErr) {
      logger.error('[ContractUpload] Failed to revert contract status:', revertErr);
    }
    queueTriggered = false;
  }

  const actualStatus = !queueTriggered ? 'UPLOADED' : 
    metadata.lifecycle === 'REVIEW' ? 'PENDING' : 'PROCESSING';

  // Upload metrics logging
  logger.info('upload_complete', {
    tenantId,
    contractId: contract.id,
    fileSize: file.size,
    fileType: file.type,
    duration: Date.now() - uploadStartTime,
    processingMode: metadata.lifecycle || 'standard',
    ocrMode: formData.get('ocrMode') as string || 'default',
    queueTriggered,
    status: queueTriggered ? 'success' : 'fallback',
  });

  const response = createSuccessResponse(ctx, {
      contractId: contract.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      status: actualStatus,
      documentRole: metadata.lifecycle === 'REVIEW' ? 'REVIEW' : undefined,
      processingJobId: processingJob.id,
      queueTriggered,
      message: !queueTriggered
        ? "File uploaded but processing could not be started. Please retry from the contract page."
        : metadata.lifecycle === 'REVIEW' 
          ? "File uploaded for review — AI analysis is running in the background"
          : "File uploaded successfully",
    },
    { status: 201 }
  );
  return cors.addCorsHeaders(response, request, "POST, OPTIONS");
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

/**
 * OPTIONS /api/contracts/upload
 *
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(request);
  return cors.optionsResponse(request, "POST, OPTIONS");
}

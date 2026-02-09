/**
 * Batch Operations API Routes
 * 
 * Handles batch download, import, and delete operations for contract files.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { z } from "zod";
import {
  batchDownload,
  batchImport,
  batchDelete,
  BatchDownloadRequest,
} from "@/lib/integrations/services/batch-operations.service";
import { withRateLimit } from "@/lib/integrations/middleware/rate-limit";
import { getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// Validation schemas
const batchDownloadSchema = z.object({
  sourceId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).min(1).max(100),
  format: z.enum(["zip", "individual"]).default("zip"),
  includeMetadata: z.boolean().default(false),
});

const batchImportSchema = z.object({
  sourceId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).min(1).max(100),
});

const batchDeleteSchema = z.object({
  sourceId: z.string().uuid(),
  fileIds: z.array(z.string().uuid()).min(1).max(100),
});

/**
 * POST /api/contract-sources/batch/download
 * Batch download files from a contract source
 */
async function handleDownload(req: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(req);
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchDownloadSchema.parse(body);

    const result = await batchDownload(
      validated as BatchDownloadRequest,
      session.user.tenantId
    );

    return createSuccessResponse(ctx, {
      totalFiles: result.totalFiles,
      processedFiles: result.processedFiles,
      failedFiles: result.failedFiles,
      errors: result.errors,
      outputPath: result.outputPath,
      duration: result.duration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, { details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') });
    }
    console.error("[Batch Download Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to download files', 500);
  }
}

/**
 * POST /api/contract-sources/batch/import
 * Batch import files to create contracts
 */
async function handleImport(req: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(req);
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId || !session.user.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchImportSchema.parse(body);

    const result = await batchImport(
      validated.sourceId,
      validated.fileIds,
      session.user.tenantId,
      session.user.id
    );

    return createSuccessResponse(ctx, {
      totalFiles: result.totalFiles,
      processedFiles: result.processedFiles,
      failedFiles: result.failedFiles,
      errors: result.errors,
      duration: result.duration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, { details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') });
    }
    console.error("[Batch Import Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to import files', 500);
  }
}

/**
 * POST /api/contract-sources/batch/delete
 * Batch delete files from a contract source
 */
async function handleDelete(req: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(req);
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchDeleteSchema.parse(body);

    const result = await batchDelete(
      validated.sourceId,
      validated.fileIds,
      session.user.tenantId
    );

    return createSuccessResponse(ctx, {
      totalFiles: result.totalFiles,
      processedFiles: result.processedFiles,
      failedFiles: result.failedFiles,
      errors: result.errors,
      duration: result.duration,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, { details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') });
    }
    console.error("[Batch Delete Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete files', 500);
  }
}

// Export rate-limited handlers
export const POST = withRateLimit(async (req: NextRequest) => {
  const url = new URL(req.url);
  const operation = url.pathname.split("/").pop();
  const ctx = getApiContext(req);

  switch (operation) {
    case "download":
      return handleDownload(req);
    case "import":
      return handleImport(req);
    case "delete":
      return handleDelete(req);
    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Unknown operation', 400);
  }
}, "sync");

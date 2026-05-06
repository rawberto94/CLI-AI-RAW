/**
 * Batch Operations API Routes
 * 
 * Handles batch download, import, and delete operations for contract files.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  batchDownload,
  batchImport,
  batchDelete,
  BatchDownloadRequest,
} from "@/lib/integrations/services/batch-operations.service";
import { withRateLimit } from "@/lib/integrations/middleware/rate-limit";
import { getAuthenticatedApiContextWithSessionFallback, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

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
async function handleDownload(req: NextRequest, ctx: Awaited<ReturnType<typeof getAuthenticatedApiContextWithSessionFallback>>): Promise<NextResponse> {
  try {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchDownloadSchema.parse(body);

    const result = await batchDownload(
      validated as BatchDownloadRequest,
      ctx.tenantId
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
    logger.error("[Batch Download Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to download files', 500);
  }
}

/**
 * POST /api/contract-sources/batch/import
 * Batch import files to create contracts
 */
async function handleImport(req: NextRequest, ctx: Awaited<ReturnType<typeof getAuthenticatedApiContextWithSessionFallback>>): Promise<NextResponse> {
  try {
    if (!ctx.tenantId || !ctx.userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchImportSchema.parse(body);

    const result = await batchImport(
      validated.sourceId,
      validated.fileIds,
      ctx.tenantId,
      ctx.userId
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
    logger.error("[Batch Import Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to import files', 500);
  }
}

/**
 * POST /api/contract-sources/batch/delete
 * Batch delete files from a contract source
 */
async function handleDelete(req: NextRequest, ctx: Awaited<ReturnType<typeof getAuthenticatedApiContextWithSessionFallback>>): Promise<NextResponse> {
  try {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = batchDeleteSchema.parse(body);

    const result = await batchDelete(
      validated.sourceId,
      validated.fileIds,
      ctx.tenantId
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
    logger.error("[Batch Delete Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete files', 500);
  }
}

// Export rate-limited handlers
export const POST = withRateLimit(async (req: NextRequest) => {
  const url = new URL(req.url);
  const operation = url.pathname.split("/").pop();
  const ctx = await getAuthenticatedApiContextWithSessionFallback(req);
  if (!ctx) {
    return createErrorResponse(getApiContext(req), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  switch (operation) {
    case "download":
      return handleDownload(req, ctx);
    case "import":
      return handleImport(req, ctx);
    case "delete":
      return handleDelete(req, ctx);
    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Unknown operation', 400);
  }
}, "sync");

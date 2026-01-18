/**
 * Batch Operations API Routes
 * 
 * Handles batch download, import, and delete operations for contract files.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import {
  batchDownload,
  batchImport,
  batchDelete,
  BatchDownloadRequest,
} from "@/lib/integrations/services/batch-operations.service";
import { withRateLimit } from "@/lib/integrations/middleware/rate-limit";

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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = batchDownloadSchema.parse(body);

    const result = await batchDownload(
      validated as BatchDownloadRequest,
      session.user.tenantId
    );

    return NextResponse.json({
      success: result.success,
      data: {
        totalFiles: result.totalFiles,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        errors: result.errors,
        outputPath: result.outputPath,
        duration: result.duration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Batch Download Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to download files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract-sources/batch/import
 * Batch import files to create contracts
 */
async function handleImport(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = batchImportSchema.parse(body);

    const result = await batchImport(
      validated.sourceId,
      validated.fileIds,
      session.user.tenantId,
      session.user.id
    );

    return NextResponse.json({
      success: result.success,
      data: {
        totalFiles: result.totalFiles,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        errors: result.errors,
        duration: result.duration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Batch Import Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to import files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract-sources/batch/delete
 * Batch delete files from a contract source
 */
async function handleDelete(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = batchDeleteSchema.parse(body);

    const result = await batchDelete(
      validated.sourceId,
      validated.fileIds,
      session.user.tenantId
    );

    return NextResponse.json({
      success: result.success,
      data: {
        totalFiles: result.totalFiles,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        errors: result.errors,
        duration: result.duration,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Batch Delete Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete files" },
      { status: 500 }
    );
  }
}

// Export rate-limited handlers
export const POST = withRateLimit(async (req: NextRequest) => {
  const url = new URL(req.url);
  const operation = url.pathname.split("/").pop();

  switch (operation) {
    case "download":
      return handleDownload(req);
    case "import":
      return handleImport(req);
    case "delete":
      return handleDelete(req);
    default:
      return NextResponse.json(
        { success: false, error: "Unknown operation" },
        { status: 400 }
      );
  }
}, "sync");

/**
 * Contract Download API
 *
 * GET /api/contracts/[id]/download
 *
 * Serves the actual contract file for download:
 * - If storagePath exists → stream from object storage (MinIO/S3)
 * - If rawText exists → generate downloadable file from content
 * - Falls back to HTML content with proper filename
 *
 * Query params:
 *   ?format=pdf|docx|original (default: original)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initializeStorage } from '@/lib/storage-service';
import {
  getAuthenticatedApiContextWithSessionFallback,
  getApiContext,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthenticatedApiContextWithSessionFallback(request);
  if (!ctx) {
    return createErrorResponse(
      getApiContext(request),
      'UNAUTHORIZED',
      'Authentication required',
      401,
      { retryable: false }
    );
  }

  try {
    const tenantId = ctx.tenantId;
    const { id } = await params;

    const contract = await prisma.contract.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        rawText: true,
        fileSize: true,
        status: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404, {
        retryable: false,
      });
    }

    const displayName =
      contract.originalName ||
      contract.contractTitle ||
      contract.fileName ||
      `contract-${id}`;

    // 1. Try object storage if storagePath is set
    if (contract.storagePath) {
      try {
        const storage = initializeStorage();

        if (storage) {
          const buffer = await storage.download(contract.storagePath);
          if (buffer) {
            const safeFilename = encodeURIComponent(displayName.replace(/[^\w\s.-]/g, '_'));
            const bytes = new Uint8Array(buffer);
            return new Response(bytes, {
              status: 200,
              headers: {
                'Content-Type': contract.mimeType || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
                'Content-Length': String(bytes.length),
                'Cache-Control': 'private, max-age=300',
              },
            });
          }
        }
      } catch {
        // Fall through to rawText
      }
    }

    // 2. Serve rawText as downloadable file
    if (contract.rawText) {
      const content = contract.rawText;
      const isHtml = content.trim().startsWith('<') || contract.mimeType === 'text/html';
      const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
      const ext = isHtml ? '.html' : '.txt';
      const filename = displayName.endsWith(ext) ? displayName : `${displayName}${ext}`;
      const safeFilename = encodeURIComponent(filename.replace(/[^\w\s.-]/g, '_'));

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
          'Content-Length': String(new TextEncoder().encode(content).length),
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    // 3. No downloadable content
    return createErrorResponse(
      ctx,
      'NO_CONTENT',
      'This contract has no downloadable file. Use the Export feature to generate a PDF or DOCX.',
      404,
      { retryable: false }
    );
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

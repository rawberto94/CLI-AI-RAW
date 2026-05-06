/**
 * Signed Copy Upload API
 *
 * POST /api/contracts/[id]/signed-copy
 *
 * Accepts a signed document upload (PDF/DOCX), stores it,
 * creates a ContractVersion, and updates signature status.
 *
 * Body: multipart/form-data
 *   - file: The signed document
 *   - signers?: JSON string of signer names
 *   - notes?: Description of signatures collected
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedApiContextWithSessionFallback,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword', // DOC
  'image/png',
  'image/jpeg',
];

export async function POST(
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
    const { id: contractId } = await params;

    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        signatureStatus: true,
        fileName: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404, {
        retryable: false,
      });
    }

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'Invalid request. Please upload a file using multipart/form-data.',
        422,
        { retryable: false }
      );
    }
    const file = formData.get('file') as File | null;
    const notes = (formData.get('notes') as string) || 'Signed copy uploaded';
    const signersJson = formData.get('signers') as string;

    if (!file) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'No file provided. Please upload the signed document.',
        422,
        { retryable: false }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        `Unsupported file type: ${file.type}. Accepted: PDF, DOCX, DOC, PNG, JPEG.`,
        422,
        { retryable: false }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB.`,
        422,
        { retryable: false }
      );
    }

    // Parse signers if provided
    let signers: string[] = [];
    if (signersJson) {
      try {
        signers = JSON.parse(signersJson);
      } catch {
        signers = [];
      }
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
    const ext = file.name.split('.').pop() || 'pdf';
    const filename = `signed_${contractId}_${hash}.${ext}`;
    const objectKey = `signed/${tenantId}/${filename}`;

    // Upload to object storage with local fallback
    let fileUrl: string;
    try {
      const { initializeStorage } = await import('@/lib/storage-service');
      const storage = initializeStorage();

      if (storage) {
        const uploadResult = await storage.upload({
          fileName: objectKey,
          buffer,
          contentType: file.type,
          metadata: {
            tenantId,
            contractId,
            type: 'signed-copy',
            originalName: file.name,
            uploadedBy: ctx.userId,
          },
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Storage upload failed');
        }
        fileUrl = `/api/files/signed/${filename}`;
      } else {
        throw new Error('Storage not available');
      }
    } catch {
      // Fallback: local filesystem
      const uploadsDir = join(process.cwd(), 'uploads', 'signed');
      await mkdir(uploadsDir, { recursive: true });
      const filePath = join(uploadsDir, filename);
      await writeFile(filePath, buffer);
      fileUrl = `/api/files/signed/${filename}`;
    }

    // Perform all updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get latest version number
      const latestVersion = await tx.contractVersion.findFirst({
        where: { contractId, tenantId },
        orderBy: { versionNumber: 'desc' },
      });

      const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      // 2. Mark previous active version as superseded
      if (latestVersion?.isActive) {
        await tx.contractVersion.update({
          where: { id: latestVersion.id },
          data: { isActive: false, supersededAt: new Date() },
        });
      }

      // 3. Create signed version record
      const version = await tx.contractVersion.create({
        data: {
          contractId,
          tenantId,
          versionNumber: newVersionNumber,
          fileUrl,
          summary: notes,
          changes: {
            type: 'signed_copy_upload',
            signers,
            originalFileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString(),
          },
          uploadedBy: ctx.userId,
          isActive: true,
        },
      });

      // 4. Update contract signature status
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          signatureStatus: 'signed',
          signatureDate: new Date(),
          signatureRequiredFlag: false,
          // Store signed document URL in metadata
          metadata: {
            ...(typeof contract.signatureStatus === 'object' ? {} : {}),
            signedCopyUrl: fileUrl,
            signedCopyUploadedAt: new Date().toISOString(),
            signedCopyUploadedBy: ctx.userId,
            signedCopyOriginalName: file.name,
          },
        },
      });

      // 5. Update any pending signature request
      await tx.signatureRequest.updateMany({
        where: {
          contractId,
          status: { in: ['pending', 'sent', 'in_progress'] },
        },
        data: {
          status: 'completed',
          signedDocumentUrl: fileUrl,
          completedAt: new Date(),
        },
      });

      return { version, contract: updatedContract };
    });

    return createSuccessResponse(ctx, {
      message: 'Signed copy uploaded successfully',
      version: {
        id: result.version.id,
        versionNumber: result.version.versionNumber,
        fileUrl: result.version.fileUrl,
      },
      contract: {
        id: result.contract.id,
        signatureStatus: result.contract.signatureStatus,
        signatureDate: result.contract.signatureDate,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/contracts/[id]/signed-copy
 *
 * Download the signed copy if it exists.
 */
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
    const { id: contractId } = await params;

    // Find the latest signed version
    const signedVersion = await prisma.contractVersion.findFirst({
      where: {
        contractId,
        tenantId,
        changes: { path: ['type'], equals: 'signed_copy_upload' },
      },
      orderBy: { versionNumber: 'desc' },
    });

    if (!signedVersion?.fileUrl) {
      return createErrorResponse(
        ctx,
        'NOT_FOUND',
        'No signed copy found for this contract.',
        404,
        { retryable: false }
      );
    }

    // Try to serve from object storage
    const objectKey = signedVersion.fileUrl.replace('/api/files/', '');
    try {
      const { initializeStorage } = await import('@/lib/storage-service');
      const storage = initializeStorage();
      if (storage) {
        const buffer = await storage.download(objectKey);
        if (buffer) {
          const changes = signedVersion.changes as Record<string, unknown>;
          const mimeType = (changes?.mimeType as string) || 'application/pdf';
          const originalName = (changes?.originalFileName as string) || `signed-contract-${contractId}.pdf`;
          const bytes = new Uint8Array(buffer);

          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
              'Content-Length': String(bytes.length),
            },
          });
        }
      }
    } catch {
      // Fall through
    }

    // Fallback: serve from local filesystem
    try {
      const { readFile } = await import('fs/promises');
      const filePath = join(process.cwd(), 'uploads', objectKey);
      const buffer = await readFile(filePath);
      const changes = signedVersion.changes as Record<string, unknown>;
      const mimeType = (changes?.mimeType as string) || 'application/pdf';
      const originalName = (changes?.originalFileName as string) || `signed-contract-${contractId}.pdf`;

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch {
      return createErrorResponse(
        ctx,
        'NOT_FOUND',
        'Signed copy file not found in storage.',
        404,
        { retryable: false }
      );
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

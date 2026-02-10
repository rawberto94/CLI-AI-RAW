import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { initializeStorage } from '@/lib/storage-service';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Mock version data for demonstration
const getMockVersions = () => [
      {
        id: '1',
        versionNumber: 1,
        uploadedBy: 'Sarah Chen',
        uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: false,
        summary: 'Initial contract version',
      },
      {
        id: '2',
        versionNumber: 2,
        uploadedBy: 'Roberto Ostojic',
        uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: false,
        summary: 'Updated payment terms and expiration date',
        changes: {
          totalValue: { old: '$500,000', new: '$525,000' },
          expirationDate: { old: '2025-12-31', new: '2026-03-31' },
        }
      },
      {
        id: '3',
        versionNumber: 3,
        uploadedBy: 'Mike Johnson',
        uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        summary: 'Final negotiated terms',
        changes: {
          totalValue: { old: '$525,000', new: '$550,000' },
          paymentTerms: { old: 'Net 30', new: 'Net 45' },
          autoRenewal: { old: null, new: 'Yes' },
        }
      },
    ];

/**
 * GET /api/contracts/:id/versions
 * Get all versions of a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    if (useMock) {
      return createSuccessResponse(ctx, {
        success: true,
        versions: getMockVersions(),
        source: 'mock'
      });
    }

    try {
      const db = await getDb();

      // Get contract versions from database
      const versions = await db.contractVersion.findMany({
        where: { contractId, tenantId },
        orderBy: { versionNumber: 'asc' },
        include: {
          uploadedByUser: {
            select: { firstName: true, lastName: true, email: true }
          }
        }
      });

      const transformedVersions = versions.map(v => {
        const userName = v.uploadedByUser 
          ? `${v.uploadedByUser.firstName || ''} ${v.uploadedByUser.lastName || ''}`.trim() 
          : null;
        return {
          id: v.id,
          versionNumber: v.versionNumber,
          uploadedBy: userName || v.uploadedBy || 'Unknown',
          uploadedAt: v.uploadedAt.toISOString(),
          isActive: v.isActive,
          summary: v.summary || undefined,
          changes: v.changes || undefined,
          fileUrl: v.fileUrl || undefined
        };
      });

      return createSuccessResponse(ctx, {
        success: true,
        versions: transformedVersions,
        source: 'database'
      });

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/contracts/:id/versions
 * Create a new version of a contract
 * 
 * Accepts either:
 * - FormData with file upload (multipart/form-data)
 * - JSON with metadata-only version (application/json)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const db = await getDb();

    // Check if contract exists
    const contract = await db.contract.findFirst({
      where: { id: contractId, tenantId }
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get the highest version number
    const latestVersion = await db.contractVersion.findFirst({
      where: { contractId, tenantId },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Check content type
    const contentType = request.headers.get('content-type') || '';
    
    let fileUrl: string | null = null;
    let summary: string = '';
    let changes: Record<string, unknown> = {};
    let uploadedBy: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      summary = (formData.get('summary') as string) || `Version ${newVersionNumber}`;
      uploadedBy = (formData.get('uploadedBy') as string) || null;
      
      const changesStr = formData.get('changes') as string;
      if (changesStr) {
        try {
          changes = JSON.parse(changesStr);
        } catch {
          changes = {};
        }
      }

      if (file) {
        // Save file to object storage (MinIO/S3) with local fallback
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Generate unique filename
        const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
        const ext = file.name.split('.').pop() || 'pdf';
        const filename = `${contractId}_v${newVersionNumber}_${hash}.${ext}`;
        const objectKey = `versions/${tenantId}/${filename}`;

        try {
          const storageService = initializeStorage();
          if (storageService) {
            const uploadResult = await storageService.upload({
              fileName: objectKey,
              buffer,
              contentType: file.type || 'application/pdf',
              metadata: {
                tenantId,
                contractId,
                versionNumber: String(newVersionNumber),
              },
            });

            if (uploadResult.success) {
              fileUrl = `/api/files/versions/${filename}`;
            } else {
              throw new Error(uploadResult.error || 'Upload failed');
            }
          } else {
            throw new Error('Storage service not available');
          }
        } catch {
          // Fallback to local filesystem
          const uploadsDir = join(process.cwd(), 'uploads', 'versions');
          await mkdir(uploadsDir, { recursive: true });
          const filePath = join(uploadsDir, filename);
          await writeFile(filePath, buffer);
          fileUrl = `/api/files/versions/${filename}`;
        }
      }
    } else {
      // Handle JSON request (metadata-only version / snapshot)
      const body = await request.json();
      summary = body.summary || `Version ${newVersionNumber} - Metadata update`;
      changes = body.changes || {};
      uploadedBy = body.uploadedBy || null;
    }

    // Mark previous active version as superseded
    if (latestVersion?.isActive) {
      await db.contractVersion.update({
        where: { id: latestVersion.id },
        data: { 
          isActive: false, 
          supersededAt: new Date() 
        }
      });
    }

    // Create the new version
    const newVersion = await db.contractVersion.create({
      data: {
        contractId,
        tenantId,
        versionNumber: newVersionNumber,
        parentVersionId: latestVersion?.id || null,
        summary,
        changes: changes as Record<string, unknown>,
        fileUrl,
        uploadedBy,
        isActive: true,
        uploadedAt: new Date()
      }
    });

    // Update contract's currentVersion reference if it exists
    try {
      await db.contract.update({
        where: { id: contractId },
        data: { 
          updatedAt: new Date(),
          // If there's a currentVersionNumber field, update it
          ...(contract.hasOwnProperty('currentVersionNumber') ? { currentVersionNumber: newVersionNumber } : {})
        }
      });
    } catch {
      // Ignore if currentVersionNumber doesn't exist
    }

    return createSuccessResponse(ctx, {
      success: true,
      version: {
        id: newVersion.id,
        versionNumber: newVersion.versionNumber,
        summary: newVersion.summary,
        changes: newVersion.changes,
        fileUrl: newVersion.fileUrl,
        uploadedBy: newVersion.uploadedBy,
        uploadedAt: newVersion.uploadedAt.toISOString(),
        isActive: newVersion.isActive
      },
      message: `Version ${newVersionNumber} created successfully`
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * PUT /api/contracts/:id/versions
 * Activate a specific version (revert)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const db = await getDb();
    
    const { versionId, versionNumber } = await request.json();

    if (!versionId && !versionNumber) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'versionId or versionNumber is required', 400);
    }

    // Find the target version
    const targetVersion = await db.contractVersion.findFirst({
      where: {
        contractId,
        tenantId,
        ...(versionId ? { id: versionId } : { versionNumber })
      }
    });

    if (!targetVersion) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Version not found', 404);
    }

    // Deactivate all versions
    await db.contractVersion.updateMany({
      where: { contractId, tenantId },
      data: { isActive: false }
    });

    // Activate the target version
    await db.contractVersion.update({
      where: { id: targetVersion.id },
      data: { isActive: true }
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: `Reverted to version ${targetVersion.versionNumber}`,
      activeVersion: {
        id: targetVersion.id,
        versionNumber: targetVersion.versionNumber,
        summary: targetVersion.summary
      }
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

import { NextRequest } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

async function getDbClient() {
  const { default: getDb } = await import('@/lib/prisma');
  return getDb();
}

async function findTenantContract(db: any, contractId: string, tenantId: string) {
  return db.contract.findFirst({
    where: {
      id: contractId,
      tenantId,
    },
  });
}

async function saveVersionFile(
  file: File,
  contractId: string,
  tenantId: string,
  versionNumber: number,
) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  const ext = file.name.split('.').pop() || 'pdf';
  const filename = `${contractId}_v${versionNumber}_${hash}.${ext}`;
  const objectKey = `versions/${tenantId}/${filename}`;

  try {
    const { initializeStorage } = await import('@/lib/storage-service');
    const storageService = initializeStorage();
    if (!storageService) {
      throw new Error('Storage service not available');
    }

    const uploadResult = await storageService.upload({
      fileName: objectKey,
      buffer,
      contentType: file.type || 'application/pdf',
      metadata: {
        tenantId,
        contractId,
        versionNumber: String(versionNumber),
      },
    });

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    return `/api/files/versions/${filename}`;
  } catch {
    const { writeFile, mkdir } = await import('fs/promises');
    const { join } = await import('path');

    const uploadsDir = join(process.cwd(), 'uploads', 'versions');
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, buffer);
    return `/api/files/versions/${filename}`;
  }
}

export async function getContractVersions(
  context: ContractApiContext,
  contractId: string,
) {
  const db = await getDbClient();
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const versions = await db.contractVersion.findMany({
    where: { contractId, tenantId: context.tenantId },
    orderBy: { versionNumber: 'asc' },
    include: {
      uploadedByUser: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  const transformedVersions = versions.map((version: any) => {
    const userName = version.uploadedByUser
      ? `${version.uploadedByUser.firstName || ''} ${version.uploadedByUser.lastName || ''}`.trim()
      : null;

    return {
      id: version.id,
      versionNumber: version.versionNumber,
      uploadedBy: userName || version.uploadedBy || 'Unknown',
      uploadedAt: version.uploadedAt.toISOString(),
      isActive: version.isActive,
      summary: version.summary || undefined,
      changes: version.changes || undefined,
      fileUrl: version.fileUrl || undefined,
    };
  });

  return createSuccessResponse(context, {
    success: true,
    versions: transformedVersions,
    source: 'database',
  });
}

export async function postContractVersion(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const db = await getDbClient();
  const contract = await findTenantContract(db, contractId, context.tenantId);

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const latestVersion = await db.contractVersion.findFirst({
    where: { contractId, tenantId: context.tenantId },
    orderBy: { versionNumber: 'desc' },
  });

  const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;
  const contentType = request.headers.get('content-type') || '';

  let fileUrl: string | null = null;
  let summary = '';
  let changes: Record<string, unknown> = {};
  const uploadedBy = context.userId;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    summary = (formData.get('summary') as string) || `Version ${newVersionNumber}`;

    const changesStr = formData.get('changes') as string;
    if (changesStr) {
      try {
        changes = JSON.parse(changesStr);
      } catch {
        changes = {};
      }
    }

    if (file) {
      fileUrl = await saveVersionFile(file, contractId, context.tenantId, newVersionNumber);
    }
  } else {
    const body = await request.json();
    summary = body.summary || `Version ${newVersionNumber} - Metadata update`;
    changes = body.changes || {};
  }

  if (latestVersion?.isActive) {
    await db.contractVersion.update({
      where: { id: latestVersion.id },
      data: {
        isActive: false,
        supersededAt: new Date(),
      },
    });
  }

  const newVersion = await db.contractVersion.create({
    data: {
      contractId,
      tenantId: context.tenantId,
      versionNumber: newVersionNumber,
      parentVersionId: latestVersion?.id || null,
      summary,
      changes: changes as Record<string, unknown>,
      fileUrl,
      uploadedBy,
      isActive: true,
      uploadedAt: new Date(),
    },
  });

  try {
    await db.contract.update({
      where: { id: contractId },
      data: {
        updatedAt: new Date(),
        ...(Object.prototype.hasOwnProperty.call(contract, 'currentVersionNumber')
          ? { currentVersionNumber: newVersionNumber }
          : {}),
      },
    });
  } catch {
    // Ignore if currentVersionNumber doesn't exist.
  }

  return createSuccessResponse(context, {
    success: true,
    version: {
      id: newVersion.id,
      versionNumber: newVersion.versionNumber,
      summary: newVersion.summary,
      changes: newVersion.changes,
      fileUrl: newVersion.fileUrl,
      uploadedBy: newVersion.uploadedBy,
      uploadedAt: newVersion.uploadedAt.toISOString(),
      isActive: newVersion.isActive,
    },
    message: `Version ${newVersionNumber} created successfully`,
  });
}

export async function putContractVersion(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const db = await getDbClient();
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const { versionId, versionNumber } = await request.json();
  if (!versionId && !versionNumber) {
    return createErrorResponse(context, 'BAD_REQUEST', 'versionId or versionNumber is required', 400);
  }

  const targetVersion = await db.contractVersion.findFirst({
    where: {
      contractId,
      tenantId: context.tenantId,
      ...(versionId ? { id: versionId } : { versionNumber }),
    },
  });

  if (!targetVersion) {
    return createErrorResponse(context, 'NOT_FOUND', 'Version not found', 404);
  }

  await db.contractVersion.updateMany({
    where: { contractId, tenantId: context.tenantId },
    data: { isActive: false },
  });

  await db.contractVersion.update({
    where: { id: targetVersion.id },
    data: { isActive: true },
  });

  return createSuccessResponse(context, {
    success: true,
    message: `Reverted to version ${targetVersion.versionNumber}`,
    activeVersion: {
      id: targetVersion.id,
      versionNumber: targetVersion.versionNumber,
      summary: targetVersion.summary,
    },
  });
}

interface VersionDifference {
  field: string;
  label?: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'modified' | 'removed';
}

export async function getContractVersionComparison(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const searchParams = request.nextUrl.searchParams;
  const v1 = searchParams.get('v1');
  const v2 = searchParams.get('v2');

  if (!v1 || !v2) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Both v1 and v2 parameters are required', 400);
  }

  const db = await getDbClient();
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      tenantId: context.tenantId,
    },
    select: { id: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const versionNumber1 = parseInt(v1, 10);
  const versionNumber2 = parseInt(v2, 10);

  const [version1, version2] = await Promise.all([
    db.contractVersion.findFirst({
      where: { contractId, tenantId: context.tenantId, versionNumber: versionNumber1 },
    }),
    db.contractVersion.findFirst({
      where: { contractId, tenantId: context.tenantId, versionNumber: versionNumber2 },
    }),
  ]);

  if (!version1 || !version2) {
    return createErrorResponse(context, 'NOT_FOUND', 'One or both versions not found', 404);
  }

  const differences = (version2.changes || []) as VersionDifference[];

  return createSuccessResponse(context, {
    success: true,
    differences,
    source: 'database',
    summary: {
      totalChanges: Array.isArray(differences) ? differences.length : 0,
      added: Array.isArray(differences)
        ? differences.filter((difference) => difference.changeType === 'added').length
        : 0,
      modified: Array.isArray(differences)
        ? differences.filter((difference) => difference.changeType === 'modified').length
        : 0,
      removed: Array.isArray(differences)
        ? differences.filter((difference) => difference.changeType === 'removed').length
        : 0,
    },
  });
}
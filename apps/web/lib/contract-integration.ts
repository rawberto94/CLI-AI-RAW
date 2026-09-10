/**
 * Contract Integration helpers
 */

export async function processUploadedContract(filePath: string, metadata: Record<string, unknown>) {
  const { prisma } = await import('@/lib/prisma');

  const contract = await prisma.contract.create({
    data: {
      tenantId: (metadata.tenantId as string) || 'default',
      fileName: metadata.fileName as string || filePath.split('/').pop() || 'unknown.pdf',
      mimeType: (metadata.mimeType as string) || 'application/pdf',
      fileSize: (metadata.fileSize as number) || 0,
      status: 'PENDING',
      uploadedBy: (metadata.uploadedBy as string) || 'system',
    },
  });

  return { success: true, contractId: contract.id };
}

export async function validateContract(data: Record<string, unknown>) {
  const errors: string[] = [];

  if (!data.fileName && !data.file) errors.push('File is required');
  if (!data.tenantId) errors.push('Tenant ID is required');

  return { valid: errors.length === 0, errors };
}

/**
 * Initialize contract metadata
 */
export async function initializeContractMetadata(
  contractId: string,
  tenantId: string,
  metadata: Record<string, unknown>
) {
  const { prisma } = await import('@/lib/prisma');
  const { resolveDocumentNumber } = await import('@/lib/contracts/document-number');

  const fileName = (metadata.fileName as string) || '';
  const documentNumber = resolveDocumentNumber({
    extracted: (metadata.documentNumber as string) || (metadata.document_number as string) || null,
    fileName,
    contractId,
  });

  const existing = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { tags: true, aiMetadata: true },
  });

  const existingAiMetadata =
    existing?.aiMetadata && typeof existing.aiMetadata === 'object' && !Array.isArray(existing.aiMetadata)
      ? (existing.aiMetadata as Record<string, unknown>)
      : {};

  const existingTags = Array.isArray(existing?.tags)
    ? (existing.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
    : [];

  const incomingTags = Array.isArray(metadata.tags)
    ? (metadata.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  // Never clobber existing tags with an implicit/empty [].
  const shouldWriteTags = incomingTags !== undefined && !(incomingTags.length === 0 && existingTags.length > 0);

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      contractType: (metadata.contractType as string) || null,
      clientName: (metadata.clientName as string) || null,
      supplierName: (metadata.supplierName as string) || null,
      ...(shouldWriteTags ? { tags: incomingTags } : {}),
      aiMetadata: {
        ...existingAiMetadata,
        document_number: documentNumber,
        document_title: (metadata.contractTitle as string) || fileName || existingAiMetadata.document_title,
        ...(shouldWriteTags ? { tags: incomingTags } : {}),
      },
    },
  });

  await prisma.contractMetadata.upsert({
    where: { contractId },
    create: {
      contractId,
      tenantId,
      tags: existingTags,
      customFields: {},
      systemFields: { document_number: documentNumber },
      updatedBy: (metadata.uploadedBy as string) || 'system',
    },
    update: {
      lastUpdated: new Date(),
    },
  });

  return { success: true, contractId: contract.id, documentNumber };
}

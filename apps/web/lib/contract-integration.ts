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

  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: {
      contractType: (metadata.contractType as string) || null,
      clientName: (metadata.clientName as string) || null,
      supplierName: (metadata.supplierName as string) || null,
    },
  });

  return { success: true, contractId: contract.id };
}

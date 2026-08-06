/**
 * Shared helpers for reading / writing agent-mutable domain fields.
 * Used by approvals (apply) and decisions revert (undo).
 */

import { prisma } from '@/lib/prisma';

export type DomainEntity = 'Contract' | 'ContractMetadata' | 'Obligation';

/**
 * Read the current value of a single field on a domain entity (tenant-scoped).
 */
export async function readDomainFieldValue(
  entity: DomainEntity | string,
  entityId: string,
  field: string,
  tenantId: string,
): Promise<unknown> {
  if (!entityId || !field) return undefined;

  if (entity === 'Contract') {
    const rows = await prisma.contract.findMany({
      where: { id: entityId, tenantId },
      take: 1,
    });
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? row[field] : undefined;
  }

  if (entity === 'ContractMetadata') {
    const rows = await prisma.contractMetadata.findMany({
      where: { contractId: entityId, tenantId },
      take: 1,
    });
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? row[field] : undefined;
  }

  if (entity === 'Obligation') {
    const rows = await prisma.obligation.findMany({
      where: { id: entityId, tenantId },
      take: 1,
    });
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? row[field] : undefined;
  }

  return undefined;
}

/**
 * Write a field on a domain entity (tenant-scoped). Returns true if a row was updated.
 */
export async function writeDomainFieldValue(
  entity: DomainEntity | string,
  entityId: string,
  field: string,
  value: unknown,
  tenantId: string,
): Promise<boolean> {
  if (!entityId || !field) return false;

  if (entity === 'Contract') {
    const updated = await prisma.contract.updateMany({
      where: { id: entityId, tenantId },
      data: { [field]: value as never },
    });
    return updated.count > 0;
  }

  if (entity === 'ContractMetadata') {
    const updated = await prisma.contractMetadata.updateMany({
      where: { contractId: entityId, tenantId },
      data: { [field]: value as never },
    });
    return updated.count > 0;
  }

  if (entity === 'Obligation') {
    const updated = await prisma.obligation.updateMany({
      where: { id: entityId, tenantId },
      data: { [field]: value as never },
    });
    return updated.count > 0;
  }

  throw new Error(`Unsupported entity: ${entity}`);
}

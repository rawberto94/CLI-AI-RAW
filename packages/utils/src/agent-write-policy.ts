/**
 * Shared agent-write policy (workers gateway + web approvals HITL).
 * Keep critical-field denylist identical on both sides.
 */

/** Critical SSOT fields — extraction + human only. Agents never write these. */
export const AGENT_WRITE_DENYLIST: readonly string[] = [
  'totalValue',
  'annualValue',
  'monthlyValue',
  'currency',
  'effectiveDate',
  'expirationDate',
  'startDate',
  'endDate',
  'clientName',
  'supplierName',
  'external_parties',
  'clientId',
  'supplierId',
  'rawText',
  'tenantId',
  'storagePath',
  'checksum',
  'fileName',
  'originalName',
  'id',
] as const;

export const AGENT_WRITE_DENYLIST_SET = new Set<string>(AGENT_WRITE_DENYLIST);

/**
 * Fields agents may propose (still gated by confidence + AGENT_WRITES_ENABLED).
 * Expand deliberately.
 */
export const AGENT_WRITE_ALLOWLIST_FIELDS = {
  Contract: ['tags', 'renewalStatus'] as const,
  ContractMetadata: [] as const,
  Obligation: [] as const,
} as const;

export type AgentWriteEntityName = keyof typeof AGENT_WRITE_ALLOWLIST_FIELDS;

export function isAgentWriteDenylisted(field: string): boolean {
  return AGENT_WRITE_DENYLIST_SET.has(field);
}

export function isAgentWriteAllowlisted(entity: string, field: string): boolean {
  const list = AGENT_WRITE_ALLOWLIST_FIELDS[entity as AgentWriteEntityName];
  if (!list) return false;
  return (list as readonly string[]).includes(field);
}

export const RENEWAL_STATUS_VALUES = [
  'PENDING',
  'UPCOMING',
  'INITIATED',
  'IN_PROGRESS',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
] as const;

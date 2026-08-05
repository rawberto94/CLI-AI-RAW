/**
 * Critical-field sync enforcer
 *
 * - Ensures derived party mirrors can be rebuilt from canonical Contract names
 * - Detects TCV/date/party drift vs artifacts (does NOT overwrite canonical columns)
 * - Persists report on ContractMetadata.systemFields.criticalFieldSync
 */

import {
  buildCriticalFields,
  collectCriticalFieldDrift,
  derivePartiesFromCanonical,
  type DerivedMirrors,
} from '@repo/utils';
import clientsDb from 'clients-db';
import { logger } from '../utils/logger';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

export interface CriticalFieldSyncResult {
  contractId: string;
  tenantId: string;
  drifts: ReturnType<typeof collectCriticalFieldDrift>;
  partiesBackfilled: boolean;
  criticalFields: ReturnType<typeof buildCriticalFields>;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function unwrapDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (typeof v === 'object' && v !== null && 'value' in (v as any)) {
    return unwrapDate((v as any).value);
  }
  return null;
}

/**
 * Run after artifact generation / on demand. Safe to re-run (idempotent).
 */
export async function runCriticalFieldSync(
  contractId: string,
  tenantId: string,
): Promise<CriticalFieldSyncResult> {
  const log = logger.child({ contractId, tenantId, service: 'critical-field-sync' });

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      totalValue: true,
      currency: true,
      effectiveDate: true,
      expirationDate: true,
      startDate: true,
      endDate: true,
      clientName: true,
      supplierName: true,
      autoRenewalEnabled: true,
      noticePeriodDays: true,
      classificationConf: true,
      aiMetadata: true,
      metadata: true,
    },
  });

  if (!contract) {
    throw new Error(`Contract ${contractId} not found for tenant ${tenantId}`);
  }

  const artifacts = await prisma.artifact.findMany({
    where: { contractId, tenantId },
    select: { type: true, data: true, confidence: true },
  });

  let artifactTotalValue: number | null = null;
  let artifactCurrency: string | null = null;
  let artifactEffectiveDate: string | null = null;
  let artifactExpirationDate: string | null = null;
  let artifactParties: Array<{ legalName?: string; name?: string; role?: string }> = [];
  const fieldConfidence: Record<string, number> = {};

  for (const a of artifacts) {
    const type = String(a.type || '').toUpperCase();
    const data = (a.data ?? {}) as Record<string, unknown>;
    if (type === 'FINANCIAL' || type === 'OVERVIEW') {
      const tv = num(data.totalValue ?? data.tcv_amount ?? (data as any).total_value);
      if (tv != null && artifactTotalValue == null) artifactTotalValue = tv;
      const cur = data.currency;
      if (typeof cur === 'string' && !artifactCurrency) artifactCurrency = cur;
    }
    if (type === 'OVERVIEW' || type === 'DATES') {
      artifactEffectiveDate =
        artifactEffectiveDate ||
        unwrapDate(data.effectiveDate) ||
        unwrapDate(data.startDate) ||
        unwrapDate(data.effective_date);
      artifactExpirationDate =
        artifactExpirationDate ||
        unwrapDate(data.expirationDate) ||
        unwrapDate(data.endDate) ||
        unwrapDate(data.expiration_date);
    }
    if (type === 'PARTIES' || type === 'OVERVIEW') {
      const list = (data.parties || data.keyParties || data.external_parties) as unknown;
      if (Array.isArray(list) && artifactParties.length === 0) {
        artifactParties = list as typeof artifactParties;
      }
    }
    if (typeof a.confidence === 'number' && type === 'FINANCIAL') {
      fieldConfidence.totalValue = a.confidence;
    }
  }

  const aiMeta = (contract.aiMetadata ?? {}) as Record<string, unknown>;
  const externalParties = Array.isArray(aiMeta.external_parties)
    ? aiMeta.external_parties
    : Array.isArray((contract.metadata as any)?.external_parties)
      ? (contract.metadata as any).external_parties
      : undefined;

  const mirrors: DerivedMirrors = {
    artifactTotalValue,
    artifactCurrency,
    artifactEffectiveDate,
    artifactExpirationDate,
    artifactParties,
    fieldConfidence,
  };

  const criticalFields = buildCriticalFields(
    {
      totalValue: contract.totalValue,
      currency: contract.currency,
      effectiveDate: contract.effectiveDate,
      expirationDate: contract.expirationDate,
      startDate: contract.startDate,
      endDate: contract.endDate,
      clientName: contract.clientName,
      supplierName: contract.supplierName,
      external_parties: externalParties,
      autoRenewalEnabled: contract.autoRenewalEnabled,
      noticePeriodDays: contract.noticePeriodDays,
      classificationConf: contract.classificationConf,
    },
    mirrors,
  );

  const drifts = collectCriticalFieldDrift(criticalFields, mirrors);

  // Backfill empty external_parties in aiMetadata from canonical names (derived store only)
  let partiesBackfilled = false;
  const hasExternal =
    Array.isArray(externalParties) &&
    externalParties.some((p: any) => p?.legalName || p?.name);

  if (!hasExternal && (contract.clientName || contract.supplierName)) {
    const derived = derivePartiesFromCanonical({
      clientName: contract.clientName,
      supplierName: contract.supplierName,
    });
    if (derived.length > 0) {
      await prisma.contract.updateMany({
        where: { id: contractId, tenantId },
        data: {
          aiMetadata: {
            ...aiMeta,
            external_parties: derived,
            _partiesSource: 'canonical_sync',
            _partiesSyncedAt: new Date().toISOString(),
          },
        },
      });
      partiesBackfilled = true;
      log.info({ parties: derived.length }, 'Backfilled aiMetadata.external_parties from canonical names');
    }
  }

  // Persist drift report for UI / ops
  const existingMeta = await prisma.contractMetadata.findUnique({
    where: { contractId },
    select: { systemFields: true },
  });
  const systemFields = {
    ...((existingMeta?.systemFields as object) || {}),
    criticalFieldSync: {
      ranAt: new Date().toISOString(),
      drifts,
      partiesBackfilled,
      trustSummary: Object.fromEntries(
        Object.entries(criticalFields).map(([k, v]) => [k, v.trust]),
      ),
    },
  };

  await prisma.contractMetadata.upsert({
    where: { contractId },
    create: {
      contractId,
      tenantId,
      updatedBy: 'critical-field-sync',
      systemFields,
    },
    update: {
      systemFields,
      updatedBy: 'critical-field-sync',
    },
  });

  if (drifts.length > 0) {
    log.warn({ driftCount: drifts.length, drifts }, 'Critical field drift detected');
  } else {
    log.info('Critical field sync complete — no material drift');
  }

  return {
    contractId,
    tenantId,
    drifts,
    partiesBackfilled,
    criticalFields,
  };
}

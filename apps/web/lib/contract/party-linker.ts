import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { PartyType } from '@prisma/client';

/**
 * Map a free-text role string from the PARTIES artifact to one of:
 *   - 'client'   → Contract.clientId
 *   - 'supplier' → Contract.supplierId
 *   - null       → no mapping
 *
 * The PARTIES extraction prompt asks the model to use the contract's own
 * labels ("Buyer", "Supplier", etc.), so we normalise heuristically.
 */
function classifyRole(role: string | undefined | null, type: string | undefined | null): 'client' | 'supplier' | null {
  const haystack = `${role || ''} ${type || ''}`.toLowerCase();
  if (!haystack.trim()) return null;
  // Order matters: more specific terms first.
  if (/(supplier|vendor|seller|provider|contractor|consultant|licensor|landlord|lessor|service\s*provider)/.test(haystack)) {
    return 'supplier';
  }
  if (/(client|buyer|customer|purchaser|licensee|tenant|lessee|company|principal)/.test(haystack)) {
    return 'client';
  }
  return null;
}

/**
 * Map our resolved role onto the global `PartyType` enum used on the Party
 * table. (Party has no tenantId — it's globally unique by `(name, type)`.)
 */
function partyTypeForRole(role: 'client' | 'supplier'): PartyType {
  return (role === 'client' ? 'CLIENT' : 'SUPPLIER') as PartyType;
}

/**
 * After the PARTIES artifact is saved, populate `Contract.clientId` /
 * `Contract.supplierId` by find-or-create-ing global `Party` rows. We only
 * write when the column is currently NULL — never overwrite manual links.
 *
 * Returns a small report so callers can log what was linked.
 */
export async function linkPartiesToContract(args: {
  contractId: string;
  partiesArtifactData: unknown;
}): Promise<{ clientId?: string; supplierId?: string; linked: string[] }> {
  const { contractId, partiesArtifactData } = args;
  const linked: string[] = [];
  if (!partiesArtifactData || typeof partiesArtifactData !== 'object') {
    return { linked };
  }

  const data = partiesArtifactData as Record<string, unknown>;
  const rawParties = Array.isArray(data.parties) ? data.parties : [];
  if (rawParties.length === 0) return { linked };

  // Deduplicate by (resolvedRole) — first hit wins so that "Acme Corp (Buyer)"
  // beats a later mention without role context.
  const picks: Partial<Record<'client' | 'supplier', { name: string }>> = {};
  for (const entry of rawParties) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!name || name.length > 200) continue;
    const role = classifyRole(
      typeof e.role === 'string' ? e.role : null,
      typeof e.type === 'string' ? e.type : null,
    );
    if (!role) continue;
    if (!picks[role]) picks[role] = { name };
  }

  if (!picks.client && !picks.supplier) return { linked };

  // Read current Contract to avoid clobbering manual user edits.
  const current = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { clientId: true, supplierId: true },
  });
  if (!current) return { linked };

  const update: { clientId?: string; supplierId?: string } = {};

  for (const role of ['client', 'supplier'] as const) {
    const pick = picks[role];
    if (!pick) continue;
    const fkField = role === 'client' ? 'clientId' : 'supplierId';
    if (current[fkField]) continue; // already set, respect manual link

    const partyType = partyTypeForRole(role);
    // Find-or-create on the global `(name, type)` unique key.
    const party = await prisma.party.upsert({
      where: { name_type: { name: pick.name, type: partyType } },
      create: { name: pick.name, type: partyType },
      update: {},
    });
    update[fkField] = party.id;
    linked.push(`${role}=${pick.name}`);
  }

  if (Object.keys(update).length === 0) return { linked };

  await prisma.contract.update({ where: { id: contractId }, data: update });
  logger.info('Linked parties to contract', { contractId, linked });
  return { ...update, linked };
}

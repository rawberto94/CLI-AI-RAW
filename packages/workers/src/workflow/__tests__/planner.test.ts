import { describe, expect, it } from 'vitest';

import { resolvePolicyPackIdForPlan, shouldEnqueuePolicyEvaluation } from '../planner';

describe('shouldEnqueuePolicyEvaluation', () => {
  it('is off by default when no pack is selected', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 5000,
        policyPackId: null,
      }),
    ).toBe(false);
  });

  it('runs after artifacts when a pack was selected at upload', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 5000,
        policyPackId: 'pack_swiss_dpa',
      }),
    ).toBe(true);
  });

  it('still supports global AUTO_POLICY_EVALUATION=true without a pack', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 5000,
        policyPackId: null,
        autoPolicyEvaluation: 'true',
      }),
    ).toBe(true);
  });

  it('does not enqueue short text (would be INDETERMINATE)', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 1000,
        policyPackId: 'pack_swiss_dpa',
      }),
    ).toBe(false);
  });

  it('honors AUTO_POLICY_EVALUATION=false even when a pack is set', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 5000,
        policyPackId: 'pack_swiss_dpa',
        autoPolicyEvaluation: 'false',
      }),
    ).toBe(false);
  });

  it('uses the contract pack id when set', async () => {
    const prisma = { policyPack: { findFirst: async () => ({ id: 'tenant_default' }) } };
    await expect(
      resolvePolicyPackIdForPlan({
        prisma,
        tenantId: 't1',
        contractPolicyPackId: 'pack_from_upload',
      }),
    ).resolves.toBe('pack_from_upload');
  });

  it('falls back to the tenant default pack', async () => {
    const prisma = { policyPack: { findFirst: async () => ({ id: 'tenant_default' }) } };
    await expect(
      resolvePolicyPackIdForPlan({
        prisma,
        tenantId: 't1',
        contractPolicyPackId: null,
      }),
    ).resolves.toBe('tenant_default');
  });

  it('honors POLICY_PACKS_ENABLED=false', () => {
    expect(
      shouldEnqueuePolicyEvaluation({
        textLength: 5000,
        policyPackId: 'pack_swiss_dpa',
        autoPolicyEvaluation: 'true',
        policyPacksEnabled: 'false',
      }),
    ).toBe(false);
  });
});

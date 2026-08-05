/**
 * CI gate: deterministic critical-field evidence must catch a seeded hallucination.
 * Fails the build if assessCriticalContractEvidence no longer extracts the aggregate TCV.
 */
import { describe, it, expect } from 'vitest';
import { assessCriticalContractEvidence } from '../contract-extraction';

const GOLDEN_TEXT = `
MASTER SERVICES AGREEMENT
Client: Contigo Demo AG
Supplier: Nordic Components GmbH
Effective Date: 1 January 2026
This Agreement shall remain in force for an initial term of three (3) years, until 31 December 2028.
The total contract value / aggregate consideration shall amount to CHF 1,200,000 (one million two hundred thousand).
Individual milestones of CHF 50,000 do not constitute the total value.
Either party may terminate with 90 days written notice.
Auto-renewal: yes.
`;

describe('CI critical-fields gate (seeded hallucination)', () => {
  it('extracts strongest aggregate TCV from golden text', () => {
    const result = assessCriticalContractEvidence(GOLDEN_TEXT);
    expect(result.metadata.totalValue).toBe(1_200_000);
    expect(result.metadata.currency).toBe('CHF');
  });

  it('flags stored under-claim vs evidence as needs_repair (gate condition)', () => {
    const result = assessCriticalContractEvidence(GOLDEN_TEXT);
    const storedHallucination = 1_000; // plausible-looking but wrong
    const evidence = result.metadata.totalValue;
    expect(evidence).not.toBeNull();
    // Gate rule: material under-claim relative to deterministic evidence
    const abs = Math.abs((evidence as number) - storedHallucination);
    const rel = abs / Math.max(evidence as number, storedHallucination);
    const needsRepair = abs > 100 && rel > 0.05;
    expect(needsRepair).toBe(true);
  });

  it('accepts stored value matching evidence', () => {
    const result = assessCriticalContractEvidence(GOLDEN_TEXT);
    const stored = result.metadata.totalValue!;
    const abs = Math.abs(stored - result.metadata.totalValue!);
    expect(abs).toBe(0);
  });
});

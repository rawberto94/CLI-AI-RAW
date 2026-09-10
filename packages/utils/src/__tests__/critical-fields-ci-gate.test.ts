/**
 * CI gate: deterministic critical-field evidence must catch a seeded hallucination.
 * Fails the build if assessCriticalContractEvidence no longer extracts the aggregate TCV.
 */
import { describe, it, expect } from 'vitest';
import { assessCriticalContractEvidence, parseIsoDate } from '../contract-extraction';
import { applyExtractionValidation, isDefinitionOnlyQuote } from '../extraction-validation';

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

  it('extracts German Gesamtvertragswert instead of Haftung or Tagessatz', () => {
    const german = `
Dienstleistungsvertrag zwischen Contigo AG und Vendor GmbH.
Inkrafttreten: 01.04.2026.
Der Gesamtvertragswert beträgt CHF 1,200,000.
Die Haftung ist begrenzt auf CHF 2,000,000.
Honorartabelle: Senior Consultant Tagessatz CHF 1,400.
`;
    const result = assessCriticalContractEvidence(german);
    expect(result.metadata.totalValue).toBe(1_200_000);
    expect(result.metadata.currency).toBe('CHF');
  });

  it('extracts French valeur totale instead of responsabilité', () => {
    const french = `
Contrat de services. La valeur totale du contrat s'élève à EUR 800000.
La responsabilité est limitée à EUR 2000000.
`;
    const result = assessCriticalContractEvidence(french);
    expect(result.metadata.totalValue).toBe(800000);
    expect(result.metadata.currency).toBe('EUR');
  });

  it('extracts Italian valore complessivo instead of responsabilità', () => {
    const italian = `
Contratto di servizi. Il valore complessivo è pari a CHF 1,200,000.
La responsabilità è limitata a CHF 2,000,000.
`;
    const result = assessCriticalContractEvidence(italian);
    expect(result.metadata.totalValue).toBe(1_200_000);
    expect(result.metadata.currency).toBe('CHF');
  });

  it('does not treat a Kündigung definition as operative termination evidence', () => {
    const packed = `
[PAGE 1]
1. Definitions
"Kündigung" bedeutet die vorzeitige Beendigung dieses Vertrags durch schriftliche Mitteilung.
[PAGE 8]
Die Parteien können den Vertrag mit einer Frist von 90 Tagen ordentlich kündigen.
`;
    expect(isDefinitionOnlyQuote('"Kündigung" bedeutet die vorzeitige Beendigung', packed)).toBe(true);
    expect(isDefinitionOnlyQuote('mit einer Frist von 90 Tagen ordentlich kündigen', packed)).toBe(false);
  });

  it('leaves EN slash dates ambiguous when both parts are <= 12', () => {
    expect(parseIsoDate('04/05/2024', { locale: 'en' })).toBeNull();
    expect(parseIsoDate('04.05.2024', { locale: 'de' })).toBe('2024-05-04');
  });

  it('marks relative dates as ambiguous rather than inventing a calendar day', () => {
    const result = applyExtractionValidation(
      {
        OVERVIEW: {
          effectiveDate: { value: null, valueRaw: '30 days after execution', sourceQuote: 'This Agreement is effective 30 days after execution' },
          certainty: 0.9,
        },
      },
      'This Agreement is effective 30 days after execution of the documents by both parties.',
      { locale: 'en' },
    );
    expect(result.groundedFields.effectiveDate.status).toBe('ambiguous');
  });

  it('does not invent a currency when none is stated', () => {
    const bare = `
Master Services Agreement.
The total contract value / aggregate consideration shall amount to 1,200,000.
`;
    const result = assessCriticalContractEvidence(bare);
    expect(result.metadata.totalValue).toBe(1_200_000);
    expect(result.metadata.currency).not.toBe('USD');
    expect(result.metadata.currency).not.toBe('CHF');
  });
});


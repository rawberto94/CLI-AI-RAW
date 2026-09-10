import { describe, expect, it } from 'vitest';
import { locateCriticalCandidates } from '../utils/locate-extract';

describe('locateCriticalCandidates', () => {
  it('prefers preamble dates over signature dates and skips Kündigung in definitions', () => {
    const packed = `
[PAGE 1]
This Agreement is entered into as of 1 January 2026 between Contigo AG and Vendor GmbH.
The Total Contract Value shall not exceed CHF 1'200'000.

[PAGE 2]
1. Definitions
"Kündigung" bedeutet die vorzeitige Beendigung dieses Vertrags durch schriftliche Mitteilung.

[PAGE 8]
Die Parteien können den Vertrag mit einer Frist von 90 Tagen ordentlich kündigen.

[PAGE 24]
IN WITNESS WHEREOF the parties have executed this Agreement on 15 March 2026.
`;
    const hits = locateCriticalCandidates(packed);
    const dates = hits.filter((h) => h.field === 'effectiveDate');
    const terms = hits.filter((h) => h.field === 'termination');
    expect(dates.some((d) => d.page === 1)).toBe(true);
    expect(terms.every((t) => !/bedeutet die vorzeitige/i.test(t.quote))).toBe(true);
    expect(terms.some((t) => t.page === 8)).toBe(true);
  });
});

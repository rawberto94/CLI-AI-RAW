import { describe, expect, it } from 'vitest';
import { leadTextForClassification, selectContractTextForAnalysis, splitContractSections } from '../utils/smart-text-select';

function longDoc(): string {
  const toc = `TABLE OF CONTENTS
1. Parties ................................ 2
2. Fees ................................... 5
3. Liability .............................. 12
Exhibit B Brochure ........................ 40
`;
  const preamble = `This Master Services Agreement is entered into as of 1 January 2024 between Contigo AG ("Client") and Vendor GmbH ("Supplier").
`;
  const fees = `ARTICLE 5 Fees
The Total Contract Value shall not exceed CHF 1'200'000. Payment terms are Net 30.
`;
  const liability = `ARTICLE 8 Limitation of Liability
Supplier's aggregate liability shall not exceed twelve (12) months of fees. Supplier shall indemnify Client against third-party IP claims.
`;
  const blank = `[This page intentionally left blank]
`;
  const brochure = `EXHIBIT B Marketing Brochure
Our award-winning culture and org chart. Press release follows. Curriculum vitae of the CEO.
${' fluff'.repeat(4000)}
`;
  const signature = `IN WITNESS WHEREOF the parties have executed this Agreement.
Signed: ______________________  Contigo AG
`;
  return [toc, preamble, fees, liability, blank, brochure, signature].join('\n\n');
}

describe('selectContractTextForAnalysis', () => {
  it('drops table of contents, blank pages, and marketing exhibits', () => {
    const packed = selectContractTextForAnalysis(longDoc(), {
      type: 'COMPLIANCE',
      maxChars: 8000,
    });
    expect(packed.omitted.join(' ')).toMatch(/contents|blank|brochure|exhibit/i);
    expect(packed.text).not.toMatch(/Parties \.{5,}/);
    expect(packed.text).not.toMatch(/intentionally left blank/i);
    expect(packed.text.toLowerCase()).not.toContain('curriculum vitae');
    expect(packed.text).toMatch(/Limitation of Liability/);
  });

  it('keeps operative liability and fee language plus the signature block', () => {
    const packed = selectContractTextForAnalysis(longDoc(), {
      type: 'RISK',
      maxChars: 6000,
    });
    expect(packed.text).toMatch(/Limitation of Liability/i);
    expect(packed.text).toMatch(/IN WITNESS WHEREOF/i);
    expect(packed.text).toMatch(/Contigo AG/);
  });

  it('keeps fee language for financial analysis', () => {
    const packed = selectContractTextForAnalysis(longDoc(), {
      type: 'FINANCIAL',
      maxChars: 5000,
    });
    expect(packed.text).toMatch(/Total Contract Value/);
    expect(packed.text).toMatch(/CHF 1'200'000/);
  });

  it('returns the full document when it already fits, minus TOC/blank pages', () => {
    const short = `Agreement between A and B.\nSection 1. Payment of 100.\nIN WITNESS WHEREOF signed.`;
    const packed = selectContractTextForAnalysis(short, { type: 'OVERVIEW', maxChars: 50_000 });
    expect(packed.text).toContain('Payment of 100');
    expect(packed.kept).toContain('full document');
  });

  it('drops a German Inhaltsverzeichnis the same way as an English TOC', () => {
    const german = `Inhaltsverzeichnis
1. Parteien ............................... 2
2. Gebühren ............................... 5

ARTICLE 1 Parteien
This agreement is between Contigo AG and Vendor GmbH.

ARTICLE 2 Fees
The Total Contract Value shall not exceed CHF 500'000.
`;
    const packed = selectContractTextForAnalysis(german, { type: 'FINANCIAL', maxChars: 4000 });
    expect(packed.omitted.join(' ')).toMatch(/contents/i);
    expect(packed.text).not.toMatch(/Parteien \.{5,}/);
    expect(packed.text).toMatch(/CHF 500'000/);
  });

  it('skips Azure page headers and downranks rate tables for compliance', () => {
    const text = `Preamble between A and B.

ARTICLE 3 Confidentiality
Each party shall keep personal data confidential under GDPR.

Rate card
| Role | Day | CHF |
|-----|-----|-----|
| SA  | 8   | 1400 |
| Dev | 8   | 1200 |
| PM  | 8   | 1600 |
| QA  | 8   | 900 |
| UX  | 8   | 1100 |
| Arc | 8   | 1800 |
| SM  | 8   | 1300 |
| PO  | 8   | 1500 |

IN WITNESS WHEREOF signed.`;
    const packed = selectContractTextForAnalysis(text, {
      type: 'COMPLIANCE',
      maxChars: 2500,
      headings: [{ content: 'Confidentiality', role: 'sectionHeading' }],
    });
    expect(packed.text).toMatch(/GDPR/);
    expect(packed.text).not.toMatch(/Day \| CHF/);
  });

  it('keeps German rate-card headings for RATES packing', () => {
    const text = `Präambel zwischen Contigo AG und Vendor GmbH.

Honorartabelle
| Rolle | Stufe | Tagesansatz |
| Senior Consultant | Senior | Fr. 1'400 |

ARTIKEL 8 Haftung
Die Haftung ist auf zwölf Monate begrenzt.
`;
    const packed = selectContractTextForAnalysis(text, { type: 'RATES', maxChars: 4000 });
    expect(packed.text).toMatch(/Honorartabelle|Tagesansatz|Rolle/);
  });

  it('classification lead skips the TOC so the preamble is visible', () => {
    const lead = leadTextForClassification(longDoc(), 1500);
    expect(lead).not.toMatch(/Parties \.{5,}/);
    expect(lead).toMatch(/Master Services Agreement/);
  });
});

describe('splitContractSections', () => {
  it('splits on Article headings', () => {
    const sections = splitContractSections('Preamble here.\nARTICLE 1 Term\nTwo years.\nARTICLE 2 Fees\nPay now.');
    expect(sections.length).toBeGreaterThanOrEqual(2);
    expect(sections.some((s) => /ARTICLE 1/i.test(s.heading) || /ARTICLE 1/i.test(s.body))).toBe(true);
  });

  it('splits German Artikel / Anlage headings', () => {
    const sections = splitContractSections(
      'Präambel zwischen Contigo AG und Vendor GmbH.\nARTIKEL 5 Vergütung\nGesamtvertragswert Fr. 1\'200\'000.\nANLAGE A Honorartabelle\nSA 1400.',
    );
    expect(sections.some((s) => /ARTIKEL 5/i.test(s.heading) || /ARTIKEL 5/i.test(s.body))).toBe(true);
    expect(sections.some((s) => /ANLAGE A/i.test(s.heading) || /ANLAGE A/i.test(s.body))).toBe(true);
  });
});

describe('German/Swiss packing', () => {
  it('keeps Vergütung language and drops Inhaltsverzeichnis for FINANCIAL', () => {
    const german = `Inhaltsverzeichnis
1. Parteien ............................... 2
2. Vergütung .............................. 5

ARTIKEL 1 Vertragsparteien
Dieses Abkommen gilt zwischen Contigo AG und Vendor GmbH.

ARTIKEL 5 Vergütung
Der Gesamtvertragswert beträgt Fr. 1'200'000. Zahlungsbedingungen Net 30.

GESCHEHEN ZU Zürich, den 1. Januar 2024.
Unterschrift: ______________________
`;
    const packed = selectContractTextForAnalysis(german, { type: 'FINANCIAL', maxChars: 4000 });
    expect(packed.omitted.join(' ')).toMatch(/contents/i);
    expect(packed.text).not.toMatch(/Parteien \.{5,}/);
    expect(packed.text).toMatch(/Fr\. 1'200'000/);
    expect(packed.text).toMatch(/GESCHEHEN ZU|Unterschrift/i);
  });

  it('keeps French rémunération and drops table des matières', () => {
    const french = `Table des matières
1. Parties ................................ 2

ARTICLE 1 Parties
Le présent contrat est conclu entre Contigo SA et Vendor Sàrl.

ARTICLE 5 Rémunération
La valeur du contrat s'élève à CHF 500'000.

EN FOI DE QUOI les parties ont signé.
`;
    const packed = selectContractTextForAnalysis(french, { type: 'FINANCIAL', maxChars: 4000 });
    expect(packed.text).toMatch(/CHF 500'000/);
    expect(packed.text).not.toMatch(/Parties \.{5,}/);
    expect(packed.text).toMatch(/EN FOI DE QUOI/i);
  });
});

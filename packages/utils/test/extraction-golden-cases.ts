import type { GoldenFieldKey } from '../src/persist-extracted-columns';
import type { OverviewLike } from '../src/persist-extracted-columns';

export type GoldenCase = {
  id: string;
  language: 'de' | 'fr' | 'it' | 'en';
  scanType: 'native' | 'scanned' | 'mixed';
  length: 'short' | 'long';
  kind: 'msa' | 'amendment' | 'rate_schedule' | 'sow';
  text: string;
  overview?: OverviewLike;
  locale?: string;
  contractType?: string;
  expected: Partial<Record<GoldenFieldKey, unknown>>;
};

function longGermanDocument(): string {
  const pages: string[] = [];
  pages.push(`[PAGE 1]\nRahmenvertrag zwischen Contigo AG (Auftraggeber) und Helvetia IT GmbH (Auftragnehmer).\nInkrafttreten: 01.04.2026.`);
  for (let i = 2; i <= 8; i += 1) {
    pages.push(`[PAGE ${i}]\nAllgemeine Bestimmungen. Dieser Abschnitt enthält keine finanziellen Angaben. Absatz ${i}.`);
  }
  pages.push(`[PAGE 9]\nVergütung. Der Gesamtvertragswert beträgt CHF 1’200’000. Haftung: CHF 50'000.`);
  for (let i = 10; i <= 58; i += 1) {
    pages.push(`[PAGE ${i}]\nAnhang Fülltext ohne Signatur. Seite ${i}. ${'Lorem ipsum Vertragsklausel ohne Beträge. '.repeat(20)}`);
  }
  pages.push(`[PAGE 59]\nANLAGE A — Leistungsbeschreibung. Tagessatz CHF 1'500.00 gilt nicht als Gesamtvertragswert.`);
  pages.push(`[PAGE 60]\nIN WITNESS WHEREOF / Unterschriften. Contigo AG ________________  Helvetia IT GmbH ________________`);
  return pages.join('\n');
}

export const EXTRACTION_GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'de-short-native-msa',
    language: 'de',
    scanType: 'native',
    length: 'short',
    kind: 'msa',
    locale: 'de',
    contractType: 'MSA',
    text: `[PAGE 1]
Dieser Dienstleistungsvertrag wird geschlossen zwischen Contigo AG (Auftraggeber) und Helvetia IT GmbH (Auftragnehmer).
Inkrafttreten: 01.04.2026. Unterzeichnet am 15.03.2026.
[PAGE 2]
Der Gesamtvertragswert beträgt CHF 1’500.00.
Die Kündigungsfrist beträgt 90 Tagen.
Es gilt Schweizer Recht, Gerichtsstand Zürich.
Die Laufzeit beträgt period of 2 years from the Effective Date.`,
    overview: {
      parties: [
        { name: 'Contigo AG', role: 'client' },
        { name: 'Helvetia IT GmbH', role: 'supplier' },
      ],
      effectiveDate: '01.04.2026',
      executionDate: '15.03.2026',
      termAndTermination: 'Die Kündigungsfrist beträgt 90 Tagen. period of 2 years from the Effective Date.',
      jurisdiction: 'Zürich',
      totalValue: 'CHF 1’500.00',
      currency: 'CHF',
    },
    expected: {
      totalValue: 1500,
      currency: 'CHF',
      effectiveDate: '2026-04-01',
      executionDate: '2026-03-15',
      expirationDate: '2028-04-01',
      noticePeriodDays: 90,
      clientName: 'Contigo AG',
      supplierName: 'Helvetia IT GmbH',
      jurisdiction: 'Zürich',
    },
  },
  {
    id: 'de-long-capped-layout',
    language: 'de',
    scanType: 'native',
    length: 'long',
    kind: 'msa',
    locale: 'de',
    text: longGermanDocument(),
    overview: {
      parties: [
        { name: 'Contigo AG', role: 'Auftraggeber' },
        { name: 'Helvetia IT GmbH', role: 'Auftragnehmer' },
      ],
      effectiveDate: '01.04.2026',
      totalValue: "CHF 1'200'000",
      currency: 'CHF',
    },
    expected: {
      totalValue: 1_200_000,
      currency: 'CHF',
      effectiveDate: '2026-04-01',
      clientName: 'Contigo AG',
      supplierName: 'Helvetia IT GmbH',
      executionDate: null,
      noticePeriodDays: null,
    },
  },
  {
    id: 'fr-native-amendment',
    language: 'fr',
    scanType: 'native',
    length: 'short',
    kind: 'amendment',
    locale: 'fr',
    contractType: 'AMENDMENT',
    text: `[PAGE 1]
Avenant n° 2 au contrat-cadre entre Contigo SA (client) et Léman Soft Sàrl (fournisseur).
Le présent avenant prend effet le 01.07.2026.
Il ne modifie pas la valeur totale du contrat.
Taux journalier : EUR 1.500,00.
Préavis de résiliation : 30 jours.`,
    overview: {
      parties: [
        { name: 'Contigo SA', role: 'client' },
        { name: 'Léman Soft Sàrl', role: 'fournisseur' },
      ],
      effectiveDate: '01.07.2026',
      termAndTermination: 'Préavis de résiliation : 30 jours.',
      totalValue: null,
      currency: null,
    },
    expected: {
      totalValue: null,
      currency: null,
      effectiveDate: '2026-07-01',
      noticePeriodDays: 30,
      clientName: 'Contigo SA',
      supplierName: 'Léman Soft Sàrl',
      expirationDate: null,
    },
  },
  {
    id: 'it-rate-schedule',
    language: 'it',
    scanType: 'native',
    length: 'short',
    kind: 'rate_schedule',
    locale: 'it',
    text: `[PAGE 1]
Allegato tariffe. Tra Contigo S.r.l. (committente) e Alpina Consulting S.r.l. (fornitore).
Valore complessivo del contratto: EUR 1500,50.
Tariffa giornaliera senior: EUR 1.200,00.
Tariffa giornaliera junior: EUR 800,00.
Decorrenza: 13/01/2026.
Preavviso: 60 giorni.`,
    overview: {
      parties: [
        { name: 'Contigo S.r.l.', role: 'committente' },
        { name: 'Alpina Consulting S.r.l.', role: 'fornitore' },
      ],
      effectiveDate: '13/01/2026',
      termAndTermination: 'Preavviso: 60 giorni.',
      totalValue: 'EUR 1500,50',
      currency: 'EUR',
    },
    expected: {
      totalValue: 1500.5,
      currency: 'EUR',
      effectiveDate: '2026-01-13',
      noticePeriodDays: 60,
      clientName: 'Contigo S.r.l.',
      supplierName: 'Alpina Consulting S.r.l.',
    },
  },
  {
    id: 'en-scanned-sow',
    language: 'en',
    scanType: 'scanned',
    length: 'short',
    kind: 'sow',
    locale: 'en',
    text: `[PAGE 1]
STATEMENT OF WORK between Contigo Ltd (Client) and Northwind LLC (Provider).
Effective Date: 1 April 2026.
Total Contract Value: USD 1,200,000.
Notice period: 30 days prior written notice.
Governing law: England and Wales.
OCR noise: T0tal C0ntract Value still quoted above as USD 1,200,000.`,
    overview: {
      parties: [
        { name: 'Contigo Ltd', role: 'Client' },
        { name: 'Northwind LLC', role: 'Provider' },
      ],
      effectiveDate: '1 April 2026',
      termAndTermination: 'Notice period: 30 days prior written notice.',
      jurisdiction: 'England and Wales',
      totalValue: 'USD 1,200,000',
      currency: 'USD',
    },
    expected: {
      totalValue: 1_200_000,
      currency: 'USD',
      effectiveDate: '2026-04-01',
      noticePeriodDays: 30,
      clientName: 'Contigo Ltd',
      supplierName: 'Northwind LLC',
      jurisdiction: 'England and Wales',
    },
  },
  {
    id: 'en-signing-trap',
    language: 'en',
    scanType: 'native',
    length: 'short',
    kind: 'msa',
    locale: 'en',
    text: `[PAGE 1]
This Agreement is signed on 15 March 2026 by both parties.
There is no effective date clause.
Liability cap: USD 5,000,000.
No total contract value is stated.`,
    overview: {
      keyDates: [{ event: 'signature / execution', date: '2026-03-15' }],
      executionDate: '2026-03-15',
      totalValue: null,
    },
    expected: {
      totalValue: null,
      effectiveDate: null,
      executionDate: '2026-03-15',
      clientName: null,
      supplierName: null,
      noticePeriodDays: null,
    },
  },
  {
    id: 'en-party-order-trap',
    language: 'en',
    scanType: 'native',
    length: 'short',
    kind: 'msa',
    locale: 'en',
    text: `[PAGE 1]
Agreement between Alpha GmbH and Beta AG.
Effective Date: 2026-05-01.`,
    overview: {
      parties: [{ name: 'Alpha GmbH' }, { name: 'Beta AG' }],
      effectiveDate: '2026-05-01',
    },
    expected: {
      effectiveDate: '2026-05-01',
      clientName: null,
      supplierName: null,
    },
  },
  {
    id: 'de-term-not-notice',
    language: 'de',
    scanType: 'native',
    length: 'short',
    kind: 'msa',
    locale: 'de',
    text: `[PAGE 1]
Die Anfangslaufzeit beträgt 24 Monate ab Inkrafttreten.
Die Kündigungsfrist beträgt 90 Tagen.
Inkrafttreten: 01.01.2026.`,
    overview: {
      effectiveDate: '01.01.2026',
      termAndTermination: 'Die Anfangslaufzeit beträgt 24 Monate ab Inkrafttreten. Die Kündigungsfrist beträgt 90 Tagen.',
    },
    expected: {
      effectiveDate: '2026-01-01',
      noticePeriodDays: 90,
      expirationDate: null,
    },
  },
  {
    id: 'en-liability-not-tcv',
    language: 'en',
    scanType: 'mixed',
    length: 'short',
    kind: 'msa',
    locale: 'en',
    text: `[PAGE 1]
Limitation of liability shall not exceed CHF 1'000'000.
Total Contract Value: CHF 250'000.
Daily rate: CHF 1'500.00.`,
    overview: {
      totalValue: null,
      currency: null,
    },
    expected: {
      totalValue: 250_000,
      currency: 'CHF',
    },
  },
  {
    id: 'en-junk-forfeiture',
    language: 'en',
    scanType: 'native',
    length: 'short',
    kind: 'sow',
    locale: 'en',
    text: `[PAGE 1]
In case of not respecting a rule the company will give 20% of its total quotes.
No total contract value is stated.`,
    overview: { totalValue: null, currency: null },
    expected: {
      totalValue: null,
      currency: null,
      effectiveDate: null,
      clientName: null,
      supplierName: null,
    },
  },
  {
    id: 'en-missing-fields',
    language: 'en',
    scanType: 'scanned',
    length: 'short',
    kind: 'sow',
    locale: 'en',
    text: `[PAGE 1]
This document is a cover letter. It names no parties, no money, and no dates.`,
    overview: {},
    expected: {
      totalValue: null,
      currency: null,
      effectiveDate: null,
      expirationDate: null,
      executionDate: null,
      noticePeriodDays: null,
      clientName: null,
      supplierName: null,
      jurisdiction: null,
    },
  },
];

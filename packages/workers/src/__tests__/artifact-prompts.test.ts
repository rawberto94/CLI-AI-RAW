import { describe, expect, it } from 'vitest';
import {
  analysisLanguageInstructions,
  buildArtifactPrompt,
  buildGroupedPrompt,
  documentInsightsFromOverview,
  formatDiSharedAppendix,
  formatDiTablesAppendix,
  getFallbackTemplate,
  getSystemPrompt,
  packGroupedContractText,
  resolveAnalysisLanguage,
  type ArtifactGroup,
  type PromptContext,
} from '../utils/artifact-prompts';

const coreGroup: ArtifactGroup = {
  name: 'core',
  label: 'Core Extraction',
  types: ['OVERVIEW', 'FINANCIAL', 'RATES'],
  model: 'gpt-4o-mini',
};

function tocContract(): string {
  return `TABLE OF CONTENTS
1. Parties ................................ 2
2. Fees ................................... 5
3. Liability .............................. 12
Exhibit B Brochure ........................ 40

This Master Services Agreement is entered into as of 1 January 2024 between Contigo AG ("Client") and Vendor GmbH ("Supplier").

ARTICLE 5 Fees
The Total Contract Value shall not exceed CHF 1'200'000. Payment terms are Net 30.

ARTICLE 8 Limitation of Liability
Supplier's aggregate liability shall not exceed twelve (12) months of fees.

EXHIBIT B Marketing Brochure
Our award-winning culture and curriculum vitae of the CEO.
${' fluff'.repeat(200)}

IN WITNESS WHEREOF the parties have executed this Agreement.
Signed: ______________________  Contigo AG
`;
}

const rateTable = {
  pageNumber: 4,
  headers: ['Role', 'Day rate', 'CHF'],
  rows: [
    ['Solution Architect', '8', '1400'],
    ['Developer', '8', '1200'],
    ['Project Manager', '8', '1600'],
  ],
  confidence: 0.93,
};

describe('documentInsightsFromOverview', () => {
  it('uses red flags from this document and ignores type-profile boilerplate', () => {
    const insights = documentInsightsFromOverview({
      redFlags: [{ flag: 'Unlimited liability', source: 'Section 8' }],
      industryInsights: { typicalDuration: '2-5 years with renewals' },
      smartSuggestions: [{ suggestion: 'Typical duration 2-5 years' }],
    });
    expect(insights).toHaveLength(1);
    expect(insights[0]?.insight).toMatch(/Unlimited liability/);
    expect(JSON.stringify(insights)).not.toMatch(/2-5 years/);
  });
});

describe('formatDiTablesAppendix', () => {
  it('prefers numeric rate tables and skips low-confidence noise', () => {
    const appendix = formatDiTablesAppendix([
      { pageNumber: 9, headers: ['Photo', 'Caption'], rows: [['a', 'b']], confidence: 0.2 },
      rateTable,
    ]);
    expect(appendix.tableCount).toBe(1);
    expect(appendix.text).toMatch(/STRUCTURED TABLES/);
    expect(appendix.text).toMatch(/Day rate/);
    expect(appendix.text).toMatch(/1400/);
    expect(appendix.text).not.toMatch(/Caption/);
  });

  it('uses the first row as headers when Azure left headers empty', () => {
    const appendix = formatDiTablesAppendix([
      {
        pageNumber: 2,
        headers: [],
        rows: [
          ['Role', 'CHF'],
          ['SA', '1400'],
        ],
        confidence: 0.88,
      },
    ]);
    expect(appendix.tableCount).toBe(1);
    expect(appendix.text).toMatch(/Role/);
    expect(appendix.text).toMatch(/1400/);
  });
});

describe('buildGroupedPrompt packing', () => {
  const ctx: PromptContext = {
    contractText: tocContract(),
    diConfidence: 0.42,
    diTables: [rateTable],
  };

  it('omits the table of contents from the packed contract body', () => {
    const prompt = buildGroupedPrompt(coreGroup, ctx);
    expect(prompt).toBeTruthy();
    expect(prompt).not.toMatch(/Parties \.{5,}/);
    expect(prompt).not.toMatch(/curriculum vitae/i);
    expect(prompt).toMatch(/CHF 1'200'000/);
    expect(prompt).toMatch(/IN WITNESS WHEREOF/);
  });

  it('appends structured DI tables once for financial/rates groups', () => {
    const packed = packGroupedContractText(coreGroup, ctx);
    expect(packed.tableCount).toBe(1);
    expect(packed.omitted.join(' ')).toMatch(/contents|brochure|exhibit/i);

    const prompt = buildGroupedPrompt(coreGroup, ctx, packed.text);
    expect(prompt).toMatch(/--- STRUCTURED TABLES \(Azure Document Intelligence\) ---/);
    expect(prompt).toMatch(/Day rate/);
    expect((prompt!.match(/--- STRUCTURED TABLES \(Azure Document Intelligence\) ---/g) || []).length).toBe(1);
  });

  it('does not repeat tables in per-type instruction slices', () => {
    const slice = buildArtifactPrompt('FINANCIAL', ctx, { includeContractText: false });
    expect(slice).not.toMatch(/PRE-VALIDATED TABLES/);
    expect(slice).not.toMatch(/Day rate/);
  });

  it('still injects tables on the single-type path even when document OCR confidence is low', () => {
    const prompt = buildArtifactPrompt('FINANCIAL', ctx);
    expect(prompt).toMatch(/PRE-VALIDATED TABLES/);
    expect(prompt).toMatch(/Day rate/);
  });

  it('appends key-value pairs once instead of under every grouped type', () => {
    const withKv: PromptContext = {
      ...ctx,
      diKeyValuePairs: [
        { key: 'Total Contract Value', value: 'CHF 1 200 000', confidence: 0.94 },
        { key: 'Governing Law', value: 'Switzerland', confidence: 0.91 },
      ],
    };
    const packed = packGroupedContractText(coreGroup, withKv);
    expect(packed.kvCount).toBe(2);
    expect((packed.text.match(/PRE-VALIDATED KEY-VALUE PAIRS/g) || []).length).toBe(1);

    const prompt = buildGroupedPrompt(coreGroup, withKv, packed.text);
    expect((prompt!.match(/PRE-VALIDATED KEY-VALUE PAIRS/g) || []).length).toBe(1);
    expect(prompt).toMatch(/CHF 1 200 000/);

    const slice = buildArtifactPrompt('FINANCIAL', withKv, { includeContractText: false });
    expect(slice).not.toMatch(/PRE-VALIDATED KEY-VALUE PAIRS/);
    expect(slice).not.toMatch(/Governing Law/);
  });
});

describe('formatDiSharedAppendix', () => {
  it('skips low-confidence key-value pairs', () => {
    const appendix = formatDiSharedAppendix({
      contractText: 'x',
      diKeyValuePairs: [
        { key: 'Noise', value: 'skip', confidence: 0.2 },
        { key: 'Currency', value: 'CHF', confidence: 0.9 },
      ],
    });
    expect(appendix.kvCount).toBe(1);
    expect(appendix.text).toMatch(/Currency: CHF/);
    expect(appendix.text).not.toMatch(/Noise/);
  });
});

describe('getFallbackTemplate', () => {
  it('does not invent USD, TCV 0, or a mid-range risk score', () => {
    const overview = getFallbackTemplate('OVERVIEW');
    expect(overview.totalValue).toBeNull();
    expect(overview.currency).toBeNull();
    expect(overview._meta.fallback).toBe(true);

    const financial = getFallbackTemplate('FINANCIAL');
    expect(financial.totalValue).toBeNull();
    expect(financial.currency).toBeNull();

    const risk = getFallbackTemplate('RISK');
    expect(risk.riskScore).toBeNull();
    expect(risk.overallRisk).toBe('Unknown');
  });
});

describe('CLAUSES prompt', () => {
  it('asks for a verbatim source quote, not only a paraphrase', () => {
    const prompt = buildArtifactPrompt('CLAUSES', {
      contractText: tocContract(),
    }, { includeContractText: false });
    expect(prompt).toMatch(/"source"/);
    expect(prompt).toMatch(/verbatim/i);
    expect(prompt).toMatch(/clauseId/);
  });
});

describe('German analysis language', () => {
  const germanText = `Präambel zwischen Contigo AG und Vendor GmbH.
ARTIKEL 1 Vertrag
Dieser Vertrag gilt gemäß den Bestimmungen.
ARTIKEL 5 Vergütung
Der Gesamtvertragswert beträgt Fr. 1'200'000. Haftung und Kündigungsfrist.
GESCHEHEN ZU Zürich.`;

  it('resolves de-CH DI locale as German', () => {
    expect(resolveAnalysisLanguage({
      contractText: tocContract(),
      diDetectedLanguages: ['de-CH'],
    })).toBe('de');
  });

  it('resolves English DI locale as English even if a German word appears', () => {
    expect(resolveAnalysisLanguage({
      contractText: 'This Agreement shall bind the party. Vertrag.',
      diDetectedLanguages: ['en'],
    })).toBe('en');
  });

  it('uses a German heuristic when DI languages are missing', () => {
    expect(resolveAnalysisLanguage({ contractText: germanText })).toBe('de');
  });

  it('injects German narrative instructions for German documents', () => {
    const prompt = buildGroupedPrompt(coreGroup, {
      contractText: germanText,
      diDetectedLanguages: ['de-CH'],
    });
    expect(prompt).toMatch(/ANALYSIS LANGUAGE: German/);
    expect(prompt).toMatch(/verbatim/);
    expect(prompt).not.toMatch(/or 0 if not found/);
  });

  it('does not ask for German narrative on an English MSA', () => {
    const prompt = buildGroupedPrompt(coreGroup, { contractText: tocContract() });
    expect(prompt).not.toMatch(/ANALYSIS LANGUAGE: German/);
    expect(prompt).toMatch(/verbatim/);
  });

  it('OVERVIEW prompt uses null TCV, not 0', () => {
    const prompt = buildArtifactPrompt('OVERVIEW', { contractText: tocContract() }, { includeContractText: false });
    expect(prompt).not.toMatch(/or 0 if not found/);
    expect(prompt).toMatch(/null if not stated/);
  });

  it('system prompt for German asks for German narrative and English keys', () => {
    const system = getSystemPrompt({ analysisLanguage: 'de' });
    expect(system).toMatch(/ANALYSIS LANGUAGE: German/);
    expect(system).toMatch(/JSON keys/);
  });

  it('system prompt treats the document as untrusted and keeps legal suffixes', () => {
    const system = getSystemPrompt();
    expect(system).toMatch(/untrusted/i);
    expect(system).toMatch(/GmbH/);
    expect(system).toMatch(/not_found/);
    expect(system).toMatch(/\[PAGE n\]/);
  });

  it('German grouped prompt injects Kündigung and Gesamtvertragswert synonyms', () => {
    const prompt = buildGroupedPrompt(coreGroup, {
      contractText: germanText,
      diDetectedLanguages: ['de-CH'],
    });
    expect(prompt).toMatch(/Gesamtvertragswert/);
    expect(prompt).toMatch(/Kündigung/);
  });

  it('packs [PAGE n] markers from DI pages', () => {
    const packed = packGroupedContractText(coreGroup, {
      contractText: tocContract(),
      diPages: [
        { pageNumber: 1, text: 'This Master Services Agreement is entered into as of 1 January 2024 between Contigo AG and Vendor GmbH.' },
        { pageNumber: 5, text: 'The Total Contract Value shall not exceed CHF 1\'200\'000.' },
      ],
    });
    expect(packed.text).toMatch(/\[PAGE 1\]/);
    expect(packed.text).toMatch(/CANDIDATE SLICES/);
  });

  it('system prompt uses Settings organization as the baseline party', () => {
    const system = getSystemPrompt({ ourOrganization: 'Contigo AG', aliases: ['Contigo'] });
    expect(system).toMatch(/OUR ORGANIZATION: Contigo AG/);
    expect(system).toMatch(/from our side/);
  });

  it('language instructions keep quotes verbatim for English', () => {
    expect(analysisLanguageInstructions({ contractText: tocContract() })).toMatch(/verbatim/);
    expect(analysisLanguageInstructions({ contractText: tocContract() })).not.toMatch(/ANALYSIS LANGUAGE: German/);
  });

  it('does not let English few-shot override German narrative', () => {
    const prompt = buildArtifactPrompt('OVERVIEW', {
      contractText: germanText,
      diDetectedLanguages: ['de-CH'],
    });
    expect(prompt).toMatch(/MUST be in German/);
    expect(prompt).toMatch(/Do NOT copy the English wording/);
  });

  it('resolves French heuristic as French', () => {
    const french = `Entre Client SA et Fournisseur Sàrl, le présent contrat ci-après. Conformément aux parties, résiliation et accord.`;
    expect(resolveAnalysisLanguage({ contractText: french })).toBe('fr');
    expect(analysisLanguageInstructions({ contractText: french })).toMatch(/ANALYSIS LANGUAGE: French/);
  });
});

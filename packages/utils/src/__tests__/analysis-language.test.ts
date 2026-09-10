import { describe, expect, it } from 'vitest'
import {
  analysisLanguageInstructions,
  expandQueryWithLegalSynonyms,
  fewShotLanguageDisclaimer,
  ocrLanguageInstructions,
  retrievalLanguageInstructions,
  resolveAnalysisLanguage,
  sanitizeFtsQuery,
} from '../analysis-language'

describe('resolveAnalysisLanguage', () => {
  it('uses de-CH DI locale as German', () => {
    expect(resolveAnalysisLanguage({
      contractText: 'This Agreement shall bind the party.',
      diDetectedLanguages: ['de-CH'],
    })).toBe('de')
  })

  it('detects German from legal tokens', () => {
    const text = 'Präambel zwischen Contigo AG und Vendor GmbH. Dieser Vertrag gilt gemäß den Bestimmungen. Artikel 5 Vergütung. Haftung und Kündigungsfrist.'
    expect(resolveAnalysisLanguage({ contractText: text })).toBe('de')
  })

  it('detects French from legal tokens', () => {
    const text = 'Entre Client SA et Fournisseur Sàrl, le présent contrat ci-après. Conformément aux parties, résiliation et accord.'
    expect(resolveAnalysisLanguage({ contractText: text })).toBe('fr')
  })

  it('detects Italian from legal tokens', () => {
    const text = 'Tra Cliente SpA e Fornitore Srl il seguente contratto. Conformemente alla parte, risoluzione e accordo.'
    expect(resolveAnalysisLanguage({ contractText: text })).toBe('it')
  })

  it('defaults English MSAs to English', () => {
    expect(resolveAnalysisLanguage({
      contractText: 'This Agreement shall bind the party pursuant to the liability clause herein.',
    })).toBe('en')
  })
})

describe('analysisLanguageInstructions', () => {
  it('asks for German narrative and English keys on German contracts', () => {
    const block = analysisLanguageInstructions({
      contractText: 'Präambel zwischen Contigo AG und Vendor GmbH. Dieser Vertrag gilt gemäß den Bestimmungen. Artikel 5 Vergütung.',
    })
    expect(block).toMatch(/ANALYSIS LANGUAGE: German/)
    expect(block).toMatch(/JSON keys stay English/)
    expect(block).toMatch(/verbatim/)
  })

  it('does not request German narrative for an English MSA', () => {
    const block = analysisLanguageInstructions({
      contractText: 'This Agreement shall bind the party pursuant to the liability clause herein.',
    })
    expect(block).not.toMatch(/ANALYSIS LANGUAGE: German/)
    expect(block).toMatch(/verbatim/)
  })

  it('marks English few-shot as FORMAT ONLY for German documents', () => {
    expect(fewShotLanguageDisclaimer({ diDetectedLanguages: ['de-CH'] })).toMatch(/MUST be in German/)
  })

  it('tells OCR not to translate or rewrite Swiss dates', () => {
    expect(ocrLanguageInstructions({ diDetectedLanguages: ['de'] })).toMatch(/Do not translate/)
    expect(ocrLanguageInstructions({ diDetectedLanguages: ['de'] })).toMatch(/DD\.MM\.YYYY/)
  })
})

describe('retrieval language', () => {
  it('expands English termination queries with Kündigung', () => {
    expect(expandQueryWithLegalSynonyms('What is the termination notice?')).toContain('kündigung')
  })

  it('expands German Haftung queries with liability', () => {
    expect(expandQueryWithLegalSynonyms('Welche Haftung gilt?')).toContain('liability')
  })

  it('asks HyDE to keep German queries in German', () => {
    expect(retrievalLanguageInstructions('Welche Kündigungsfrist gilt gemäß dem Vertrag?'))
      .toMatch(/The query is in German/)
  })

  it('keeps umlauts in FTS queries', () => {
    expect(sanitizeFtsQuery('Kündigungsfrist Haftung')).toMatch(/Kündigungsfrist/)
    expect(sanitizeFtsQuery('Kündigungsfrist Haftung')).toMatch(/Haftung/)
    expect(sanitizeFtsQuery('termination notice', ' | ')).toBe('termination | notice')
  })
})

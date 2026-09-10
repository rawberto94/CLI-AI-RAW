export type AnalysisLanguage = 'de' | 'fr' | 'it' | 'en';

export type DILocale = 'de-CH' | 'fr-CH' | 'it-CH' | 'en-US';

export function toDILocale(lang: AnalysisLanguage | string | null | undefined): DILocale {
  const code = (lang || '').toLowerCase().slice(0, 2);
  if (code === 'de') return 'de-CH';
  if (code === 'fr') return 'fr-CH';
  if (code === 'it') return 'it-CH';
  if (code === 'en') return 'en-US';
  return 'de-CH';
}

export const NARRATIVE_LANGUAGE_NAME: Record<Exclude<AnalysisLanguage, 'en'>, string> = {
  de: 'German',
  fr: 'French',
  it: 'Italian',
};

export type AnalysisLanguageContext = {
  contractText?: string;
  diDetectedLanguages?: string[];
};

const BOUNDARY = '(?:^|[^A-Za-zÀ-ÿÄÖÜäöüß])';
const BOUNDARY_END = '(?:[^A-Za-zÀ-ÿÄÖÜäöüß]|$)';
const DE_TOKENS_RE = new RegExp(`${BOUNDARY}(zwischen|vereinbarung|vertrag|hiermit|gemäß|gemäss|vertragspartei|artikel|kündigung|kündigungsfrist|haftung|vergütung|anlage|anhang|gesamtvertragswert|laufzeit)${BOUNDARY_END}`, 'gi');
const FR_TOKENS_RE = new RegExp(`${BOUNDARY}(entre|accord|contrat|ci-après|ci-apres|conformément|conformement|résiliation|resiliation|partie)${BOUNDARY_END}`, 'gi');
const IT_TOKENS_RE = new RegExp(`${BOUNDARY}(tra|accordo|contratto|seguente|conformemente|risoluzione|parte)${BOUNDARY_END}`, 'gi');
const EN_TOKENS_RE = /\b(whereas|agreement|herein|shall|pursuant|liability|indemnif|article)\b/gi;

function localeLang(langs: string[], prefix: string): boolean {
  const re = new RegExp(`^${prefix}([-_]|$)`, 'i');
  return langs.some((l) => re.test(l));
}

function tokenScore(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

/** Detect whether narrative analysis should be German, French, Italian, or English. */
export function resolveAnalysisLanguage(ctx: AnalysisLanguageContext): AnalysisLanguage {
  const langs = ctx.diDetectedLanguages || [];
  const di: AnalysisLanguage[] = [];
  if (localeLang(langs, 'de')) di.push('de');
  if (localeLang(langs, 'fr')) di.push('fr');
  if (localeLang(langs, 'it')) di.push('it');
  const enFromDi = localeLang(langs, 'en');
  if (di.length === 1 && !enFromDi) return di[0]!;
  if (enFromDi && di.length === 0) return 'en';

  const text = ctx.contractText || '';
  const scores: Record<AnalysisLanguage, number> = {
    de: tokenScore(text, DE_TOKENS_RE),
    fr: tokenScore(text, FR_TOKENS_RE),
    it: tokenScore(text, IT_TOKENS_RE),
    en: tokenScore(text, EN_TOKENS_RE),
  };
  const ranked = (Object.keys(scores) as AnalysisLanguage[]).sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0]!;
  if (top !== 'en' && scores[top] >= 3 && scores[top] > scores.en) return top;
  if (di.length === 1) return di[0]!;
  return 'en';
}

const QUOTES_RULE =
  'SOURCE QUOTES: Keep "source" / quote / source_text fields verbatim from the contract. Do not translate quotes, party names, clause numbers, Fr./CHF, or dates.';
const HONESTY_RULE =
  'Dates may be DD.MM.YYYY. Fr. and SFr. mean CHF. Missing TCV/amounts are null, never 0 or USD. JSON keys stay English. Enum values stay English (high, medium, signed, compliant, needs-review).';

/** Prompt block: narrative in the document language; keys/enums English; quotes verbatim. */
export function analysisLanguageInstructions(ctx: AnalysisLanguageContext): string {
  const lang = resolveAnalysisLanguage(ctx);
  if (lang === 'en') return `${QUOTES_RULE}\n${HONESTY_RULE}`;
  const name = NARRATIVE_LANGUAGE_NAME[lang];
  return `ANALYSIS LANGUAGE: ${name} (the document is ${name}).
- Write summary, executiveBriefing, risk titles/descriptions, insights, recommendations, clause summaries, and explanations in ${name}.
- ${HONESTY_RULE}
- ${QUOTES_RULE}`;
}

/** Prefix for English few-shot examples so they do not pull DE/FR/IT narrative back to English. */
export function fewShotLanguageDisclaimer(ctx: AnalysisLanguageContext): string {
  const lang = resolveAnalysisLanguage(ctx);
  if (lang === 'en') return 'for output format reference only — do NOT copy these values';
  return `FORMAT ONLY. The example narrative is English. Your summaries, risks, and insights MUST be in ${NARRATIVE_LANGUAGE_NAME[lang]}. Do NOT copy the English wording.`;
}

/** OCR / cleanup: keep original script, Swiss dates, and Fr./CHF. Do not translate. */
export function ocrLanguageInstructions(ctx: AnalysisLanguageContext = {}): string {
  const lang = resolveAnalysisLanguage(ctx);
  const base =
    'Preserve the original language exactly. Do not translate. Keep umlauts (ä ö ü Ä Ö Ü ß), French/Italian accents, and Swiss apostrophe thousands (1\'200\'000). Keep Fr./SFr./CHF as written. Dates may be DD.MM.YYYY — do not rewrite as US MM/DD/YYYY.';
  if (lang === 'en' && !ctx.contractText && !ctx.diDetectedLanguages?.length) return base;
  if (lang === 'en') return base;
  return `${base} Document language: ${NARRATIVE_LANGUAGE_NAME[lang]}.`;
}

/** Cross-language legal terms so English queries still retrieve DE/FR/IT clauses. */
export const LEGAL_QUERY_SYNONYMS: Array<{ terms: string[] }> = [
  { terms: ['termination', 'terminate', 'kündigung', 'kündigen', 'auflösung', 'résiliation', 'risoluzione'] },
  { terms: ['liability', 'liable', 'haftung', 'haften', 'responsabilité', 'responsabilità'] },
  { terms: ['indemnif', 'hold harmless', 'schadlos', 'freistellung', 'indemnisation', 'indennizzo'] },
  { terms: ['confidential', 'nda', 'non-disclosure', 'vertraulich', 'geheimhaltung', 'confidentialité', 'riservatezza'] },
  { terms: ['renewal', 'auto-renew', 'verlängerung', 'erneuerung', 'reconduction', 'renouvellement', 'rinnovo'] },
  { terms: ['payment', 'fee', 'compensation', 'vergütung', 'zahlung', 'honorar', 'rémunération', 'corrispettivo'] },
  { terms: ['term', 'duration', 'expiration', 'laufzeit', 'vertragsdauer', 'durée', 'durata'] },
  { terms: ['notice period', 'kündigungsfrist', 'préavis', 'preavviso'] },
  { terms: ['governing law', 'anwendbares recht', 'droit applicable', 'legge applicabile'] },
  { terms: ['total contract value', 'gesamtvertragswert', 'vertragswert', 'valeur totale', 'valore complessivo'] },
];

export type LegalSynonymTopic = 'termination' | 'liability' | 'tcv' | 'notice' | 'governingLaw' | 'renewal';

const EXTRACTION_SYNONYMS: Record<LegalSynonymTopic, Record<AnalysisLanguage, string[]>> = {
  termination: {
    en: ['termination', 'terminate', 'notice of termination'],
    de: ['Kündigung', 'kündigen', 'Auflösung'],
    fr: ['résiliation', 'résilier'],
    it: ['risoluzione', 'recesso'],
  },
  liability: {
    en: ['liability', 'limitation of liability', 'cap'],
    de: ['Haftung', 'Haftungsobergrenze'],
    fr: ['responsabilité', 'plafond de responsabilité'],
    it: ['responsabilità', 'limite di responsabilità'],
  },
  tcv: {
    en: ['total contract value', 'aggregate', 'not to exceed', 'NTE'],
    de: ['Gesamtvertragswert', 'Vertragswert', 'Höchstbetrag'],
    fr: ['valeur totale', 'valeur du contrat', 'plafond'],
    it: ['valore complessivo', 'valore del contratto'],
  },
  notice: {
    en: ['notice period', 'prior written notice'],
    de: ['Kündigungsfrist', 'schriftliche Mitteilung'],
    fr: ['préavis', 'notification écrite'],
    it: ['preavviso', 'comunicazione scritta'],
  },
  governingLaw: {
    en: ['governing law', 'jurisdiction', 'applicable law'],
    de: ['anwendbares Recht', 'Gerichtsstand'],
    fr: ['droit applicable', 'loi applicable', 'juridiction compétente'],
    it: ['legge applicabile', 'foro competente'],
  },
  renewal: {
    en: ['renewal', 'auto-renew', 'evergreen'],
    de: ['Verlängerung', 'automatische Verlängerung'],
    fr: ['reconduction', 'renouvellement', 'reconduction tacite'],
    it: ['rinnovo', 'rinnovo tacito'],
  },
};

/** Synonym lines to inject into extraction prompts for the document language. */
export function synonymsForPrompt(lang: AnalysisLanguage): string {
  const lines = (Object.keys(EXTRACTION_SYNONYMS) as LegalSynonymTopic[]).map((topic) => {
    const row = EXTRACTION_SYNONYMS[topic];
    const local = row[lang].join(', ');
    const en = row.en.join(', ');
    return lang === 'en' ? `- ${topic}: ${en}` : `- ${topic}: ${local} (EN: ${en})`;
  });
  return `LEGAL CONCEPT SYNONYMS for this document (do not translate the document; use these to find clauses):\n${lines.join('\n')}`;
}

/** Extra search tokens for a query so German/French/Italian contracts still match. */
export function expandQueryWithLegalSynonyms(query: string): string[] {
  const lower = query.toLowerCase();
  const extras: string[] = [];
  for (const group of LEGAL_QUERY_SYNONYMS) {
    if (group.terms.some((term) => lower.includes(term))) {
      extras.push(...group.terms.filter((term) => term.length > 3 && !lower.includes(term)));
    }
  }
  return [...new Set(extras)].slice(0, 12);
}

/** Prompt block for RAG query expansion / HyDE so retrieval is not English-only. */
/** Keep letters (including umlauts/accents) for FTS. Strip punctuation only. */
export function sanitizeFtsQuery(query: string, join: ' & ' | ' | ' = ' & '): string {
  return query
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 12)
    .join(join);
}

const PREVAILING_RE =
  /prevailing language|in case of conflict.{0,80}(english|german|french|italian|deutsch|français|francais|italiano)|maßgebliche?\s+(sprache|fassung)|es gilt die\s+(deutsche|französische|englische|italienische)|fait foi|en cas de contradiction.{0,80}(anglais|français|allemand)|in caso di contrasto.{0,40}(inglese|italiano|tedesco|francese)/i;

export function selectPagesForExtraction(
  pages: Array<{ pageNumber: number; text: string }>,
  options?: { fullText?: string },
): {
  pages: Array<{ pageNumber: number; text: string }>;
  prevailing: AnalysisLanguage | null;
  bilingual: boolean;
  bilingualWarning: string | null;
} {
  const full = options?.fullText || pages.map((p) => p.text || '').join('\n');
  const prevailing = detectPrevailingLanguage(full);
  if (!pages.length) {
    return { pages, prevailing, bilingual: false, bilingualWarning: null };
  }

  const labeled = pages.map((p) => ({
    ...p,
    lang: resolveAnalysisLanguage({ contractText: p.text || '' }),
  }));
  const langs = new Set(labeled.map((p) => p.lang));
  const bilingual = langs.size >= 2;
  if (!bilingual) {
    return { pages, prevailing, bilingual: false, bilingualWarning: null };
  }

  const counts: Record<AnalysisLanguage, number> = { de: 0, fr: 0, it: 0, en: 0 };
  for (const p of labeled) counts[p.lang] += (p.text || '').length;
  const majority = (Object.keys(counts) as AnalysisLanguage[]).sort((a, b) => counts[b] - counts[a])[0]!;
  const target = prevailing || majority;
  const kept = labeled.filter((p) => p.lang === target).map(({ lang: _lang, ...rest }) => rest);
  const keptChars = kept.reduce((n, p) => n + (p.text || '').length, 0);
  const totalChars = labeled.reduce((n, p) => n + (p.text || '').length, 0);
  if (kept.length === 0 || (totalChars > 0 && keptChars / totalChars < 0.2)) {
    return {
      pages,
      prevailing,
      bilingual: true,
      bilingualWarning: prevailing
        ? `Prevailing language ${prevailing} found but pages could not be split cleanly`
        : 'Bilingual document with no prevailing-language clause',
    };
  }
  return {
    pages: kept,
    prevailing: target,
    bilingual: true,
    bilingualWarning: prevailing ? null : 'Bilingual document; no prevailing-language clause — using majority language pages',
  };
}

export function detectPrevailingLanguage(text: string): AnalysisLanguage | null {
  const slice = (text || '').slice(0, 20_000);
  const m = slice.match(PREVAILING_RE);
  if (!m) return null;
  const blob = m[0].toLowerCase();
  if (/english|anglais|inglese|englische/.test(blob)) return 'en';
  if (/german|deutsch|allemand|tedesco/.test(blob)) return 'de';
  if (/french|français|francais|französische/.test(blob)) return 'fr';
  if (/italian|italiano|italienische/.test(blob)) return 'it';
  return null;
}

export function retrievalLanguageInstructions(query: string): string {
  const lang = resolveAnalysisLanguage({ contractText: query });
  const synonymHint =
    'Include German/French/Italian legal synonyms when expanding: Kündigung/termination, Haftung/liability, Vergütung/fees, Laufzeit/term, Vertraulichkeit/confidentiality, Kündigungsfrist/notice period, Verlängerung/renewal.';
  if (lang === 'en') {
    return `${synonymHint} Hypothetical clauses may be English, but also produce a German variant when the query is about Swiss or German contracts.`;
  }
  const name = NARRATIVE_LANGUAGE_NAME[lang];
  return `The query is in ${name}. Generate search variants and hypothetical clauses in ${name}. Also include English legal equivalents so mixed-language corpora still match. ${synonymHint}`;
}

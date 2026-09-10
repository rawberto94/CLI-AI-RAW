/**
 * Pack OCR text for LLM analysis: keep operative contract sections,
 * drop TOC / blank pages / marketing exhibits when the document is long.
 */

export interface HeadingHint {
  content: string;
  role?: string;
}

export interface TextSelectOptions {
  type?: string;
  types?: string[];
  maxChars: number;
  headings?: HeadingHint[];
}

export interface TextSelectResult {
  text: string;
  omitted: string[];
  kept: string[];
}

interface Section {
  heading: string;
  body: string;
  start: number;
  score: number;
  skipReason?: string;
  role?: string;
}

const SPLIT_RE =
  /(?:^|\n)(?:#{1,6}\s+[^\n]+|(?:ARTICLE|Article|ARTIKEL|Artikel|SECTION|Section|ABSCHNITT|Abschnitt|CLAUSE|Clause|ZIFFER|Ziffer)\s+[\dIVXLCDM.]+[^\n]{0,120}|(?:EXHIBIT|Exhibit|SCHEDULE|Schedule|ANNEX|Annex|APPENDIX|Appendix|ANLAGE|Anlage|ANHANG|Anhang|BEILAGE|Beilage|ANNEXE|Annexe|APPENDICE|Appendice)\s+[A-Z0-9][^\n]{0,100}|(?:TABLE OF CONTENTS|Table of Contents|INHALTSVERZEICHNIS|Inhaltsverzeichnis|IN WITNESS WHEREOF|In Witness Whereof|GESCHEHEN ZU|Geschehen zu|ZU URKUND|Zu Urkund|EN FOI DE QUOI|En foi de quoi|FATTO A|Fatto a|(?:Rate cards?|Price list|Pricing schedule|Schedule of rates|Fee schedule|Unit prices|Honorartabelle|Preisliste|grille tarifaire))\b[^\n]*)/g;

const ALWAYS_SKIP =
  /table of contents|inhaltsverzeichnis|table des matières|sommaire|indice dei contenuti|^contents$|^index$|intentionally left blank|page intentionally|running header|list of exhibits|index of defined terms/i;

const LOW_VALUE =
  /brochure|marketing|curriculum vitae|\bcv\b|org(?:anization)? chart|press release|style guide|broschüre|lebenslauf/i;

const PREAMBLE =
  /preamble|recital|parties|whereas|definitions|interpretation|witnesseth|präambel|vertragsparteien|zwischen den parteien|préambule|preambolo|entre les parties/i;

const SIGNATURE =
  /in witness whereof|signature|signed by|executed as of|signatory|attestation|geschehen zu|unterschrift|zu urkund|en foi de quoi|fait à|fatto a/i;

const TYPE_KEYWORDS: Record<string, RegExp> = {
  FINANCIAL: /fee|price|payment|invoice|consideration|total contract value|\btcv\b|n\.?t\.?e\.?|not to exceed|rate card|budget|currency|vergütung|honorar|tagesansatz|gesamtvertragswert|vertragswert|\bfr\.|rémunération|honoraires|valeur du contrat/i,
  RATES: /rate card|day rate|hourly|unit price|role|grade|discount|tagesansatz|stundensatz|preisliste|honorartabelle|grille tarifaire|taux journalier/i,
  COMPLIANCE: /gdpr|dpa|personal data|privacy|hipaa|soc\s?2|audit|regulatory|data protection|confidential|liability|indemnif|datenschutz|haftung|protection des données|rgpd/i,
  RISK: /liability|indemnif|insurance|warranty|force majeure|limitation of|consequential|sla|penalty|haftung|schadloshaltung|gewährleistung|responsabilité|indemnisation/i,
  CLAUSES: /liability|indemnif|termination|confidential|warranty|governing law|assignment|intellectual property|force majeure|haftung|kündigung|anwendbares recht|droit applicable|résiliation|risoluzione/i,
  RENEWAL: /renew|term of|notice period|expiration|auto-?renew|evergreen|kündigungsfrist|verlängerung|automatische verlängerung|reconduction tacite|préavis|rinnovo tacito/i,
  OBLIGATIONS: /\bshall\b|\bmust\b|deliverable|milestone|service level|report|s'engage|doit\b|verpflichtung|ist verpflichtet|hat zu/i,
  PARTIES: /party|parties|between|signatory|registered (?:office|seat)|limited|inc\.|gmbh|ag\b|sàrl|sarl|vertragspartei|zwischen/i,
  CONTACTS: /notice|address for|email|attention:|contact|mitteilung|anschrift/i,
  OVERVIEW: /agreement|effective date|term|party|value|governing|contrat|vertrag|inkrafttreten/i,
  NEGOTIATION_POINTS: /liability|cap|termination for convenience|most favoured|audit right|haftung|kündigung|haftungsobergrenze/i,
  EXECUTIVE_SUMMARY: /agreement|party|term|value|risk|renew|vertrag|kündigung|haftung/i,
  AMENDMENTS: /amend|supplement|addendum|this amendment|nachtrag|änderungsvereinbarung|avenant/i,
  TIMELINE: /date|milestone|deadline|within \d+ days|meilenstein|frist|fälligkeit/i,
  DELIVERABLES: /deliverable|acceptance|scope of work|sow|statement of work|liefergegenstand|abnahme/i,
};

function typesOf(options: TextSelectOptions): string[] {
  const list = [...(options.types || [])];
  if (options.type) list.push(options.type);
  return list.map((t) => t.toUpperCase());
}

function needsSignature(types: string[]): boolean {
  return types.some((t) =>
    ['PARTIES', 'CONTACTS', 'CLAUSES', 'COMPLIANCE', 'OVERVIEW', 'RISK', 'EXECUTIVE_SUMMARY'].includes(t),
  );
}

export function splitContractSections(
  text: string,
  headings?: HeadingHint[],
): Array<{ heading: string; body: string; start: number; role?: string }> {
  const points = new Set<number>([0]);
  const headingAt = new Map<number, string>();
  const roleAt = new Map<number, string>();

  for (const hint of headings || []) {
    if (!hint.content || hint.content.trim().length < 3) continue;
    const needle = hint.content.trim().slice(0, 80);
    const idx = text.indexOf(needle);
    if (idx >= 0) {
      points.add(idx);
      headingAt.set(idx, needle);
      if (hint.role) roleAt.set(idx, hint.role);
    }
  }

  SPLIT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPLIT_RE.exec(text))) {
    points.add(match.index);
    headingAt.set(match.index, match[0].replace(/^\n/, '').trim().slice(0, 120));
  }

  const starts = [...points].sort((a, b) => a - b);
  const sections: Array<{ heading: string; body: string; start: number; role?: string }> = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = starts[i + 1] ?? text.length;
    const body = text.slice(start, end);
    if (!body.trim()) continue;
    sections.push({
      heading: headingAt.get(start) || (i === 0 ? 'Preamble' : `Section ${i}`),
      body,
      start,
      role: roleAt.get(start),
    });
  }
  return sections.length > 0 ? sections : [{ heading: 'Document', body: text, start: 0 }];
}

function looksLikeRateTable(body: string): boolean {
  const lines = body.split('\n').slice(0, 40);
  const numeric = lines.filter((line) => (line.match(/\d/g) || []).length >= 4 && /[|\t,]/.test(line)).length;
  return numeric >= 5;
}

function scoreSection(
  section: { heading: string; body: string; start: number; role?: string },
  types: string[],
  index: number,
  total: number,
): { score: number; skipReason?: string } {
  const heading = section.heading;
  const body = section.body;
  const blob = `${heading}\n${body.slice(0, 1500)}`;

  if (section.role && /pageHeader|pageFooter|pageNumber|footnote/i.test(section.role) && body.length < 400) {
    return { score: -1000, skipReason: section.role };
  }
  if (ALWAYS_SKIP.test(heading) || ALWAYS_SKIP.test(body.slice(0, 400))) {
    return { score: -1000, skipReason: heading || 'boilerplate' };
  }
  if (body.trim().length < 80 && /blank|header|footer|page \d+/i.test(body)) {
    return { score: -1000, skipReason: 'blank/header' };
  }

  let score = 12;
  if (index === 0) score += 35;
  if (index >= total - 2) score += 15;
  if (PREAMBLE.test(heading) || PREAMBLE.test(body.slice(0, 500))) score += 25;
  if (SIGNATURE.test(heading) || SIGNATURE.test(body.slice(0, 400))) {
    score += needsSignature(types) ? 30 : 8;
  }
  if (LOW_VALUE.test(heading) || LOW_VALUE.test(body.slice(0, 300))) score -= 40;

  const isExhibit = /exhibit|schedule|annex|appendix/i.test(heading);
  if (isExhibit) score -= 8;

  for (const type of types) {
    const kw = TYPE_KEYWORDS[type];
    if (kw?.test(blob)) score += 28;
  }

  const shallHits = body.match(/\b(shall|must|agrees to)\b/gi);
  if (shallHits && shallHits.length >= 3) score += 12;

  const wantsRates = types.some((t) => t === 'RATES' || t === 'FINANCIAL');
  if (looksLikeRateTable(body) && !wantsRates) {
    score -= 35;
    if (score < 20) return { score, skipReason: heading || 'rate table' };
  }

  if (isExhibit && score < 20) {
    return { score, skipReason: heading };
  }

  return { score };
}

function dropAlwaysSkipPages(text: string): { text: string; omitted: string[] } {
  const omitted: string[] = [];
  const cleaned = text
    .replace(/(?:^|\n)[ \t]*(?:table of contents|inhaltsverzeichnis|table des matières|sommaire)[\s\S]{0,8000}?(?=\n(?:ARTICLE|Article|ARTIKEL|Artikel|SECTION|Section|ABSCHNITT|Abschnitt|This |IN WITNESS|GESCHEHEN|EN FOI))/i, () => {
      omitted.push('Table of Contents');
      return '\n';
    })
    .replace(/\n[ \t]*\[?this page intentionally left blank\]?[ \t]*\n/gi, () => {
      omitted.push('Intentionally blank page');
      return '\n';
    });
  return { text: cleaned, omitted };
}

/** Packed lead used for type classification so a TOC cannot dominate the sample. */
export function leadTextForClassification(text: string, maxChars = 4000): string {
  return selectContractTextForAnalysis(text, { type: 'OVERVIEW', maxChars }).text.slice(0, maxChars);
}

export function selectContractTextForAnalysis(
  fullText: string,
  options: TextSelectOptions,
): TextSelectResult {
  const maxChars = Math.max(4000, options.maxChars);
  const types = typesOf(options);
  const { text: stripped, omitted: alwaysOmitted } = dropAlwaysSkipPages(fullText);
  const omitted = [...alwaysOmitted];
  const kept: string[] = [];

  const rawSections = splitContractSections(stripped, options.headings);
  const sections: Section[] = rawSections.map((section, index) => {
    const scored = scoreSection(section, types, index, rawSections.length);
    return { ...section, score: scored.score, skipReason: scored.skipReason, role: section.role };
  });

  const dropped = sections.filter((s) => s.score < 0 || (s.skipReason && s.score < 20));
  for (const section of dropped) {
    if (section.skipReason) omitted.push(section.skipReason.slice(0, 80));
  }

  const candidates = sections.filter((s) => !dropped.includes(s));
  const candidateChars = candidates.reduce((sum, s) => sum + s.body.length, 0);
  if (candidateChars <= maxChars) {
    return {
      text: candidates.map((s) => s.body.trimEnd()).join('\n\n').trim(),
      omitted: [...new Set(omitted)],
      kept: candidates.length === rawSections.length && omitted.length === 0 ? ['full document'] : candidates.map((s) => s.heading),
    };
  }

  const selected = new Set<Section>();

  const preamble = candidates[0];
  if (preamble) selected.add(preamble);

  if (needsSignature(types)) {
    const sig = [...candidates].reverse().find((s) => SIGNATURE.test(s.heading) || SIGNATURE.test(s.body.slice(0, 400)))
      || candidates[candidates.length - 1];
    if (sig) selected.add(sig);
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.start - b.start);
  for (const section of ranked) {
    selected.add(section);
    const used = [...selected].reduce((sum, s) => sum + s.body.length, 0);
    if (used >= maxChars) break;
  }

  const ordered = [...selected].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let used = 0;
  const note = omitted.length
    ? `[Packed for analysis. Omitted low-value material: ${[...new Set(omitted)].slice(0, 8).join('; ')}.]\n\n`
    : '';
  used += note.length;

  for (const section of ordered) {
    if (used >= maxChars) {
      omitted.push(section.heading);
      continue;
    }
    const remaining = maxChars - used - 40;
    const chunk = section.body.length > remaining
      ? section.body.slice(0, remaining) + '\n[... section truncated ...]\n'
      : section.body;
    parts.push(chunk.trimEnd());
    kept.push(section.heading);
    used += chunk.length + 2;
  }

  return {
    text: (note + parts.join('\n\n')).trim(),
    omitted: [...new Set(omitted)],
    kept,
  };
}

const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const FULL_DATE_PATTERN = `(?:${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH_NAMES}\\s+\\d{4}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})`;

export interface SignatureEvidenceAssessment {
  hasSignatureBlock: boolean;
  hasActualSignatureEvidence: boolean;
  hasBlankSignatureMarkers: boolean;
  signatureDateText: string | null;
}

const SIGNATURE_BLOCK_PATTERNS = [
  /\b(?:signature|signatures|signed by|executed by|sign here)\b/i,
  /\bfor and on behalf of\b/i,
  /\bauthori[sz]ed\s+signator/i,
  /\bduly\s+authori[sz]ed/i,
  /\b(?:name|title|date|by)\s*[:\-]\s*_{3,}/i,
  /\[\s*signature\s*\]/i,
  /\/s\/\s*\S+/i,
  /\b(?:digitally signed|electronically signed|docusigned by|docusign|adobe sign)\b/i,
];

const DEFINITIVE_SIGNED_PATTERNS = [
  /\/s\/\s*[A-Za-z0-9][A-Za-z0-9 .,'-]{1,120}/i,
  /\bdigitally\s+signed\s+by\s+[A-Za-z0-9][A-Za-z0-9 .,'-]{1,120}/i,
  /\belectronically\s+signed\s+by\s+[A-Za-z0-9][A-Za-z0-9 .,'-]{1,120}/i,
  /\bdocusigned\s+by\s+[A-Za-z0-9][A-Za-z0-9 .,'-]{1,120}/i,
  /\badobe\s+sign\s+(?:certificate|audit|completed|signature)/i,
  /\bdocusign\s+(?:certificate|audit|completed|completion)/i,
  new RegExp(`\\b(?:signed|executed)\\s+(?:on|this)\\s+${FULL_DATE_PATTERN}`, 'i'),
];

const EXPLICIT_SIGNED_BY_PATTERN = /\b(?:signed|executed)\s+by\s*[:\-]?\s+([^\n.;|]{1,120})/gi;

const SIGNATURE_DATE_PATTERNS = [
  new RegExp(`\\b(?:signed|executed)\\s+(?:on|this)\\s+(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`\\b(?:signature date|date signed|date of signature)\\s*[:\-]?\\s+(${FULL_DATE_PATTERN})`, 'i'),
];

const BLANK_SIGNATURE_MARKERS = [
  /(?:^|\n|\|)\s*(?:signature|unterschrift|signed by|executed by|by)\s*[:\-]?\s*(?:\||\n|$|_{2,}|-{2,})/i,
  /(?:^|\n|\|)\s*date\s*[:\-]?\s*(?:\||\n|$|_{2,}|-{2,})/i,
  /\[\s*(?:signature|sign here)\s*\]/i,
];

function extractSignatureLabelCandidates(contractText: string): string[] {
  const candidates: string[] = [];
  const inlineLabelPattern = /(?:^|\n|\|)\s*(?:signature|unterschrift|signed by|executed by|by)\s*[:\-]\s*([^\n|]*)/gi;
  const nextLineLabelPattern = /(?:^|\n)\s*(?:signature|unterschrift)\s*:?\s*\n\s*([^\n]{0,160})/gi;

  for (const match of contractText.matchAll(inlineLabelPattern)) {
    candidates.push(match[1] || '');
  }

  for (const match of contractText.matchAll(nextLineLabelPattern)) {
    candidates.push(match[1] || '');
  }

  return candidates;
}

function normalizeSignatureCandidate(candidate: string): string {
  return candidate
    .replace(/&nbsp;/gi, ' ')
    .replace(/\[[^\]]*(?:signature|sign here)[^\]]*\]/gi, ' ')
    .replace(/[|]/g, ' ')
    .replace(/[_\-.=~*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMeaningfulSignatureCandidate(candidate: string): boolean {
  if (/\/s\/\s*\S+/i.test(candidate)) return true;

  const normalized = normalizeSignatureCandidate(candidate);
  if (!normalized) return false;

  if (/^(?:name|title|date|signature|signed by|executed by|buyer|supplier|client|customer|vendor|seller|purchaser|party|witness)\s*:/i.test(normalized)) {
    return false;
  }

  if (/^(?:name|title|date|signature|signed|sign here|authorized signatory|authorised signatory|buyer|supplier|client|customer|vendor|seller|purchaser|party|witness|extracted tables|key value pairs)$/i.test(normalized)) {
    return false;
  }

  if (/^(?:the\s+)?(?:buyer|supplier|client|customer|vendor|seller|purchaser|party|parties|signatory|signatories)(?:\s+or\s+(?:the\s+)?(?:buyer|supplier|client|customer|vendor|seller|purchaser|party|parties|signatory|signatories))*$/i.test(normalized)) {
    return false;
  }

  if (/^(?:the\s+)?(?:buyer|supplier|client|customer|vendor|seller|purchaser|party|parties|signatory|signatories)\b/i.test(normalized)) {
    return false;
  }

  if (/\b(?:inc\.?|llc|ltd\.?|corp(?:oration)?\.?|co\.?|lp|llp|plc|gmbh|ag|sa|sas|bv|nv|sarl)\b/i.test(normalized)) {
    return false;
  }

  if (new RegExp(`^${FULL_DATE_PATTERN}$`, 'i').test(normalized)) {
    return false;
  }

  return /[A-Za-z]{2,}/.test(normalized);
}

function hasExplicitSignedByEvidence(contractText: string): boolean {
  for (const match of contractText.matchAll(EXPLICIT_SIGNED_BY_PATTERN)) {
    if (isMeaningfulSignatureCandidate(match[1] || '')) return true;
  }

  return false;
}

function extractSignatureDateText(contractText: string): string | null {
  for (const pattern of SIGNATURE_DATE_PATTERNS) {
    const match = contractText.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function assessSignatureEvidence(contractText: string): SignatureEvidenceAssessment {
  if (!contractText || contractText.trim().length === 0) {
    return {
      hasSignatureBlock: false,
      hasActualSignatureEvidence: false,
      hasBlankSignatureMarkers: false,
      signatureDateText: null,
    };
  }

  const hasSignatureBlock = SIGNATURE_BLOCK_PATTERNS.some(pattern => pattern.test(contractText));
  const hasBlankSignatureMarkers = BLANK_SIGNATURE_MARKERS.some(pattern => pattern.test(contractText));
  const hasDefinitiveSignedPhrase = DEFINITIVE_SIGNED_PATTERNS.some(pattern => pattern.test(contractText));
  const hasExplicitSignedByPhrase = hasExplicitSignedByEvidence(contractText);
  const hasCompletedSignatureField = extractSignatureLabelCandidates(contractText).some(isMeaningfulSignatureCandidate);

  return {
    hasSignatureBlock,
    hasActualSignatureEvidence: hasDefinitiveSignedPhrase || hasExplicitSignedByPhrase || hasCompletedSignatureField,
    hasBlankSignatureMarkers,
    signatureDateText: extractSignatureDateText(contractText),
  };
}
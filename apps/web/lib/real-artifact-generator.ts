/**
 * Real Artifact Generator
 * 
 * This module provides a standalone artifact generation function that can be used
 * by the legacy worker script when the queue system (Redis) is not available.
 * 
 * It extracts text from the contract file and generates AI-powered artifacts.
 */

import { PrismaClient, ArtifactType } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import pino from 'pino';
import { buildPersistedContractTextFields } from '@repo/utils';
import { createOpenAIClient, getOpenAIApiKey } from '@/lib/openai-client';
import { categorizeContract } from '@/lib/categorization-service';
import { queueContractReindex } from '@/lib/rag/reindex-trigger';
import { classifyDocumentType } from '@/lib/ai/document-type-classifier';
import { ensureTenantTaxonomy } from '@/lib/taxonomy/seed-default';
import { linkPartiesToContract } from '@/lib/contract/party-linker';

const logger = pino({ name: 'real-artifact-generator' });

// ── Text Preprocessing ──
// Clean OCR output before feeding to AI: normalize whitespace, remove page numbers,
// detect/preserve tables, and limit consecutive newlines for better extraction accuracy.
function preprocessText(rawText: string): { cleanedText: string; tables: string[] } {
  let text = rawText;

  // 1. Normalize line breaks
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Detect and preserve tables (markdown, tab-separated, pipe-separated)
  const tables: string[] = [];
  const tablePatterns = [
    /\|[^\n]+\|[\s\S]*?(?=\n\n|\n[^|]|$)/g,
    /(?:^|\n)(?:[^\t\n]+\t){2,}[^\t\n]+(?:\n(?:[^\t\n]+\t){2,}[^\t\n]+)+/g,
    /(?:^|\n)(?:[^|\n]+\|){2,}[^|\n]+(?:\n(?:[^|\n]+\|){2,}[^|\n]+)+/g,
  ];
  for (const pattern of tablePatterns) {
    const matches = text.match(pattern);
    if (matches) tables.push(...matches);
  }

  // 3. Remove page numbers ("Page 1 of 10", "- 1 -", etc.)
  text = text.replace(/(?:^|\n)\s*(?:Page\s+)?(\d+)\s*(?:of\s+\d+|\/\s*\d+)?\s*(?:\n|$)/gi, '\n');
  text = text.replace(/(?:^|\n)\s*-\s*\d+\s*-\s*(?:\n|$)/g, '\n');

  // 4. Collapse excessive inline whitespace (preserve indentation)
  text = text.replace(/[^\S\n]{3,}/g, '  ');

  // 5. Limit consecutive newlines to 3
  text = text.replace(/\n{4,}/g, '\n\n\n');

  return { cleanedText: text.trim(), tables };
}

/**
 * Estimate text quality/confidence from heuristic signals.
 * Used when actual DI per-word confidence is unavailable (inline processing path).
 * Returns 0-1 where 1 = high confidence in text accuracy.
 */
function estimateTextConfidence(text: string): number {
  if (!text || text.length < 50) return 0.3;

  let score = 0.85; // baseline for machine-readable PDFs

  // Penalty: high ratio of non-ASCII or garbled characters
  const nonAsciiRatio = (text.match(/[^\x20-\x7E\n\t]/g)?.length || 0) / text.length;
  if (nonAsciiRatio > 0.15) score -= 0.25;
  else if (nonAsciiRatio > 0.05) score -= 0.1;

  // Penalty: lots of isolated single characters (OCR noise: "a b c d e")
  const words = text.split(/\s+/);
  const singleCharRatio = words.filter(w => w.length === 1 && !/^[aAiI0-9]$/.test(w)).length / Math.max(words.length, 1);
  if (singleCharRatio > 0.2) score -= 0.2;
  else if (singleCharRatio > 0.1) score -= 0.1;

  // Penalty: very short text for a supposed contract
  if (text.length < 500) score -= 0.15;

  // Bonus: contains structured legal patterns (good OCR)
  if (/(?:AGREEMENT|CONTRACT|WHEREAS|hereinafter|pursuant)/i.test(text)) score += 0.05;

  return Math.max(0.1, Math.min(1.0, score));
}

// Artifact types to generate - matching the workers package configuration
// These are organized by priority: core > analysis > advanced
const ARTIFACT_TYPES: ArtifactType[] = [
  // Core artifacts (highest priority)
  'OVERVIEW',
  'CLAUSES', 
  'FINANCIAL',
  // Analysis artifacts
  'RISK',
  'COMPLIANCE',
  'OBLIGATIONS',
  'RENEWAL',
  // Advanced artifacts
  'NEGOTIATION_POINTS',
  'AMENDMENTS',
  'CONTACTS',
  // Additional artifacts for comprehensive analysis
  'PARTIES',
  'TIMELINE',
  'DELIVERABLES',
  'EXECUTIVE_SUMMARY',
];

interface ArtifactData {
  type: ArtifactType;
  content: Record<string, any>;
}

type ExtractedParty = {
  name: string;
  role: string;
};

interface BasicContractExtraction {
  title: string | null;
  contractType: string | null;
  summary: string | null;
  totalValue: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  supplierName: string | null;
  parties: ExtractedParty[];
  keyPoints: string[];
  paymentTerms: string | null;
  signatureStatus: string | null;
  signatureDate: string | null;
}

const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const FULL_DATE_PATTERN = `(?:${MONTH_NAMES}\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+${MONTH_NAMES}\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})`;
const LEGAL_ENTITY_SUFFIX_PATTERN = '(?:Inc\\.?|LLC|Ltd\\.?|Corp(?:oration)?\\.?|Co\\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV|SARL|S\\.r\\.l\\.?|Oy|AB)';

const TITLE_PATTERNS = [
  /^[\s\n]*((?:STATEMENT\s+OF\s+WORK|MASTER\s+SERVICE\s+AGREEMENT|NON[- ]?DISCLOSURE\s+AGREEMENT|SERVICE\s+AGREEMENT|SUPPLIER\s+AGREEMENT|SUPPLY\s+AGREEMENT|VENDOR\s+AGREEMENT|EMPLOYMENT\s+(?:AGREEMENT|CONTRACT)|LEASE\s+AGREEMENT|SOFTWARE\s+LICENSE\s+AGREEMENT|SUBSCRIPTION\s+AGREEMENT|PURCHASE\s+(?:ORDER|AGREEMENT)|AMENDMENT)[^\n]*)/im,
  /^[\s\n]*([A-Z][A-Z\s]{2,80}(?:AGREEMENT|CONTRACT|STATEMENT\s+OF\s+WORK|ADDENDUM|AMENDMENT))/m,
  /(?:^|\n)\s*(?:title|re|subject|regarding)[:\s]+([^\n]{3,120}?)(?:\n|$)/im,
];

const CONTRACT_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/supplier\s+agreement|supply\s+agreement|vendor\s+agreement/i, 'SUPPLIER'],
  [/statement\s+of\s+work|\bSOW\b/i, 'SOW'],
  [/master\s+service\s+agreement|\bMSA\b/i, 'MSA'],
  [/non[- ]?disclosure\s+agreement|\bNDA\b|confidentiality\s+agreement/i, 'NDA'],
  [/employment\s+(?:agreement|contract)/i, 'EMPLOYMENT'],
  [/professional\s+services?\s+agreement/i, 'SERVICE'],
  [/service\s+(?:agreement|contract)/i, 'SERVICE'],
  [/lease\s+(?:agreement|contract)/i, 'LEASE'],
  [/purchase\s+(?:order|agreement)/i, 'PURCHASE_ORDER'],
  [/software\s+license/i, 'SOFTWARE_LICENSE'],
  [/subscription\s+agreement/i, 'SUBSCRIPTION'],
  [/amendment/i, 'AMENDMENT'],
];

const START_DATE_PATTERNS = [
  new RegExp(`effective\\s*date[:\\s]*(?:is\\s+)?(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`entered\\s+into\\s+on\\s+(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`effective\\s+as\\s+of\\s+(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`(?:commencing|starting|begins?)\\s*(?:on)?[:\\s]*(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`start\\s*date[:\\s]*(${FULL_DATE_PATTERN})`, 'i'),
];

const END_DATE_PATTERNS = [
  new RegExp(`expir(?:ation|y|es?)\\s*date[:\\s]*(?:is\\s+)?(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`(?:terminat(?:ion|es?)|end)\\s*date[:\\s]*(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`through\\s+(${FULL_DATE_PATTERN})`, 'i'),
  new RegExp(`until\\s+(${FULL_DATE_PATTERN})`, 'i'),
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseMonetaryValue(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    normalized = parts[parts.length - 1]?.length === 2
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectCurrencyCode(value: string): string | null {
  if (/\bCHF\b/i.test(value)) return 'CHF';
  if (/\bEUR\b/i.test(value) || /€/.test(value)) return 'EUR';
  if (/\bGBP\b/i.test(value) || /£/.test(value)) return 'GBP';
  if (/\bUSD\b/i.test(value) || /\$/.test(value)) return 'USD';
  return null;
}

function extractEntityName(candidate: string): string | null {
  let normalized = normalizeWhitespace(candidate)
    .replace(/^(?:and|between)\s+/i, '')
    .replace(/[.;:]$/, '');

  const legalNameMatch = normalized.match(
    new RegExp(`^(.*?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})(?:,|$)`, 'i')
  );
  if (legalNameMatch?.[1]) {
    normalized = normalizeWhitespace(legalNameMatch[1]);
  } else if (normalized.includes(',')) {
    normalized = normalizeWhitespace(normalized.split(',')[0] || '');
  }

  normalized = normalized.replace(/\s+\([^)]*\)$/, '').trim();
  if (normalized.length < 2 || normalized.length > 140) return null;
  return normalized;
}

function normalizePartyRole(role: string): string {
  const normalized = normalizeWhitespace(role).toLowerCase();
  if (normalized.includes('service provider')) return 'Service Provider';
  if (normalized.includes('supplier')) return 'Supplier';
  if (normalized.includes('vendor')) return 'Vendor';
  if (normalized.includes('seller')) return 'Seller';
  if (normalized.includes('contractor')) return 'Contractor';
  if (normalized.includes('buyer')) return 'Buyer';
  if (normalized.includes('client')) return 'Client';
  if (normalized.includes('customer')) return 'Customer';
  if (normalized.includes('purchaser')) return 'Purchaser';
  return role.trim();
}

function isClientRole(role: string): boolean {
  return /(buyer|client|customer|purchaser|licensee|recipient)/i.test(role);
}

function isSupplierRole(role: string): boolean {
  return /(supplier|vendor|seller|service provider|provider|contractor|licensor)/i.test(role);
}

function dedupeParties(parties: ExtractedParty[]): ExtractedParty[] {
  const deduped = new Map<string, ExtractedParty>();
  for (const party of parties) {
    const name = normalizeWhitespace(party.name);
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = deduped.get(key);
    const nextParty = { name, role: party.role || 'Party' };
    if (!existing) {
      deduped.set(key, nextParty);
      continue;
    }

    if (existing.role === 'Party' && nextParty.role !== 'Party') {
      deduped.set(key, nextParty);
    }
  }

  return Array.from(deduped.values()).slice(0, 10);
}

function extractRoleAnchoredParties(contractText: string): ExtractedParty[] {
  const introText = normalizeWhitespace(contractText.substring(0, 2500));
  const parties: ExtractedParty[] = [];
  const roleAnchoredPattern = new RegExp(
    `([A-Z][A-Za-z0-9&.,'’\\- ]{1,120}?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})(?:,[^\\n\"]{0,180})?\\s*\\(\"([^\"]{2,40})\"\\)`,
    'g'
  );

  let match: RegExpExecArray | null;
  while ((match = roleAnchoredPattern.exec(introText)) !== null) {
    const name = extractEntityName(match[1]);
    const role = normalizePartyRole(match[2] || 'Party');
    if (name) {
      parties.push({ name, role });
    }
  }

  const explicitLabelPatterns: Array<[RegExp, string]> = [
    [new RegExp(`(?:client|customer|buyer|purchaser)\\s*[:\\-]\\s*([A-Z][A-Za-z0-9&.,'’\\- ]{1,120}?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})`, 'ig'), 'Client'],
    [new RegExp(`(?:service\\s+provider|vendor|supplier|contractor|seller)\\s*[:\\-]\\s*([A-Z][A-Za-z0-9&.,'’\\- ]{1,120}?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})`, 'ig'), 'Supplier'],
  ];

  for (const [pattern, role] of explicitLabelPatterns) {
    let labelMatch: RegExpExecArray | null;
    while ((labelMatch = pattern.exec(contractText)) !== null) {
      const name = extractEntityName(labelMatch[1]);
      if (name) {
        parties.push({ name, role });
      }
    }
  }

  if (parties.length === 0) {
    const betweenPattern = new RegExp(
      `(?:between|by\\s+and\\s+between)\\s+([A-Z][A-Za-z0-9&.,'’\\- ]{1,120}?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})(?:,[^\\n]{0,140})?\\s+(?:and|,)\\s+([A-Z][A-Za-z0-9&.,'’\\- ]{1,120}?\\b${LEGAL_ENTITY_SUFFIX_PATTERN})`,
      'i'
    );
    const betweenMatch = introText.match(betweenPattern);
    if (betweenMatch?.[1] && betweenMatch[2]) {
      const firstParty = extractEntityName(betweenMatch[1]);
      const secondParty = extractEntityName(betweenMatch[2]);
      if (firstParty) parties.push({ name: firstParty, role: 'Party' });
      if (secondParty) parties.push({ name: secondParty, role: 'Party' });
    }
  }

  return dedupeParties(parties);
}

function selectPrimaryParties(parties: ExtractedParty[]): { clientName: string | null; supplierName: string | null } {
  const clientParty = parties.find(party => isClientRole(party.role));
  const supplierParty = parties.find(party => isSupplierRole(party.role));

  return {
    clientName: clientParty?.name || parties[0]?.name || null,
    supplierName: supplierParty?.name || parties[1]?.name || null,
  };
}

function extractExplicitTotalValue(contractText: string): { value: number | null; currency: string | null } {
  const moneyRegex = /((?:USD|EUR|GBP|CHF)\s*[\d,.]+|[$€£]\s*[\d,.]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = moneyRegex.exec(contractText)) !== null) {
    const amountText = match[1];
    const context = normalizeWhitespace(
      contractText.slice(Math.max(0, match.index - 100), Math.min(contractText.length, match.index + amountText.length + 100))
    ).toLowerCase();

    const looksExplicitTotal = /(total|aggregate|overall|contract value|contract amount|total fees?|purchase price|consideration)/.test(context);
    const excludedContext = /(example|sample|illustrative|unit price|per unit|per order|order quantity|liability|insurance|coverage|discount|interest|penalt|shipment|forecast|warranty)/.test(context);
    if (!looksExplicitTotal || excludedContext) {
      continue;
    }

    const value = parseMonetaryValue(amountText);
    if (value == null) continue;

    return { value, currency: detectCurrencyCode(amountText) };
  }

  return { value: null, currency: null };
}

function extractPrimaryCurrency(contractText: string): string | null {
  const currencyMatches = contractText.match(/\b(?:USD|EUR|GBP|CHF)\b|[$€£]/gi) || [];
  if (currencyMatches.length === 0) return null;

  const counts = new Map<string, number>();
  for (const match of currencyMatches) {
    const currency = detectCurrencyCode(match);
    if (!currency) continue;
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }

  let topCurrency: string | null = null;
  let topCount = 0;
  for (const [currency, count] of counts.entries()) {
    if (count > topCount) {
      topCurrency = currency;
      topCount = count;
    }
  }

  return topCurrency;
}

function extractPaymentTerms(contractText: string): string | null {
  const paymentPatterns = [
    /([A-Z][^.\n]{0,40}\bpay[^.\n]{0,140}\bwithin\s+\d+\s+days[^.\n]*\.?)/i,
    /(?:payment\s+(?:terms?|schedule|conditions?))[:\s]+([^\n]{10,220})/i,
    /([A-Z][^.\n]{0,40}\binvoices?[^.\n]{0,140}\.)/i,
  ];

  for (const pattern of paymentPatterns) {
    const match = contractText.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]).replace(/\s+\.$/, '.');
    }
  }

  return null;
}

function extractSignatureInfo(contractText: string): { signatureStatus: string | null; signatureDate: string | null } {
  const signatureBlockPatterns = [
    /(?:IN WITNESS WHEREOF|SIGNED|EXECUTED)\b/i,
    /\bSignature[:\s]*_{3,}/i,
    /\bSigned\s+by[:\s]/i,
    /\/s\/\s+\w+/i,
    /\[SIGNATURE\]/i,
    // Additional patterns for scanned/handwritten/electronic signatures
    /\bFor and on behalf of\b/i,
    /\bauthori[sz]ed\s+signator/i,
    /\bduly\s+authori[sz]ed/i,
    /\bPlace[,:\s]+Date[:\s]/i,
    /\bOrt[,:\s]+Datum[:\s]/i,        // German: Place, Date
    /\bUnterschrift/i,                 // German: Signature
    /\bName[:\s]*_{3,}/i,
    /\bTitle[:\s]*_{3,}/i,
    /\bBy[:\s]*_{3,}/i,
    /_{5,}\s*\n.*(?:Name|Title|Date)/i,
    /\bDigitally signed\b/i,
    /\bDocuSign/i,
    /\bAdobe Sign/i,
    /\belectronic(?:ally)?\s+signed/i,
  ];
  const signedIndicators = [
    /\/s\/\s+\S+/i,
    new RegExp(`(?:Signed|Executed)\s+(?:on|this)\s+${FULL_DATE_PATTERN}`, 'i'),
    new RegExp(`\bDate(?:d)?[:\s]+${FULL_DATE_PATTERN}`, 'i'),
    // Additional signed indicators
    /\bFor and on behalf of\b.*\n.*[A-Z][a-z]/i,
    /\bduly\s+executed/i,
    /\bDigitally signed by\b/i,
    /\bDocuSigned by\b/i,
    // Completed signature blocks: Signature field followed by Name/Title fields with values
    // (indicates physical/handwritten signatures exist even if DI can't OCR the ink)
    /\bSignature[:\s]*\n[\s\S]{0,200}?\bName[:\s]+[A-Z][a-z]/i,
    /\bBuyer\b[\s\S]{0,300}?\bSupplier\b[\s\S]{0,300}?\bName[:\s]+\S/i,
  ];

  const hasSignatureBlock = signatureBlockPatterns.some(pattern => pattern.test(contractText));
  const hasSignedContent = signedIndicators.some(pattern => pattern.test(contractText));

  if (!hasSignatureBlock && !hasSignedContent) {
    return { signatureStatus: null, signatureDate: null };
  }

  const signatureDateMatch = contractText.match(
    new RegExp(`(?:Executed|Signed|Dated?)\s+(?:this\s+)?(?:on\s+)?(${FULL_DATE_PATTERN})`, 'i')
  ) || contractText.match(new RegExp(`\bDate(?:d)?[:\s]+(${FULL_DATE_PATTERN})`, 'i'));

  return {
    signatureStatus: hasSignedContent ? 'signed' : 'unsigned',
    signatureDate: signatureDateMatch?.[1] ? tryParseDate(signatureDateMatch[1]) : null,
  };
}

function buildArtifactGroundingContext(extracted: BasicContractExtraction, contractTitle?: string | null): string {
  const facts: string[] = ['Known document facts extracted before AI analysis:'];
  const title = contractTitle || extracted.title;

  facts.push(`- title: ${title || 'unknown'}`);
  facts.push(`- contractType: ${extracted.contractType || 'unknown'}`);
  facts.push(`- clientName: ${extracted.clientName || 'unknown'}`);
  facts.push(`- supplierName: ${extracted.supplierName || 'unknown'}`);
  facts.push(`- effectiveDate: ${extracted.startDate || 'unknown'}`);
  facts.push(`- endDate: ${extracted.endDate || 'unknown'}`);
  facts.push(`- totalValue: ${extracted.totalValue != null ? `${extracted.totalValue} ${extracted.currency || ''}`.trim() : 'not explicitly stated'}`);
  if (extracted.paymentTerms) {
    facts.push(`- paymentTerms: ${extracted.paymentTerms}`);
  }
  if (extracted.parties.length > 0) {
    facts.push(`- parties: ${extracted.parties.map(party => `${party.name} (${party.role})`).join('; ')}`);
  }
  facts.push('- Use these facts when consistent with the contract text. If the contract is ambiguous, return null instead of guessing.');
  facts.push('- Do not treat unit prices, example calculations, insurance limits, liability caps, penalties, or forecast volumes as the total contract value unless explicitly labelled as the total or aggregate contract value.');

  return facts.join('\n');
}

function mergeExtractedFactsWithMetadata(
  extracted: BasicContractExtraction,
  metadata: {
    title?: string;
    contractType?: string;
    startDate?: string;
    endDate?: string;
    totalValue?: number;
    currency?: string;
    parties?: string[];
    clientName?: string;
    supplierName?: string;
    signatureStatus?: string;
    signatureDate?: string;
  }
): BasicContractExtraction {
  const clientRole = extracted.parties.find(party => isClientRole(party.role))?.role || 'Client';
  const supplierRole = extracted.parties.find(party => isSupplierRole(party.role))?.role || 'Supplier';
  const mergedParties = dedupeParties([
    ...extracted.parties,
    ...(metadata.clientName ? [{ name: metadata.clientName, role: clientRole }] : []),
    ...(metadata.supplierName ? [{ name: metadata.supplierName, role: supplierRole }] : []),
    ...((metadata.parties || []).map((partyName, index) => ({
      name: partyName,
      role: index === 0 ? clientRole : index === 1 ? supplierRole : 'Party',
    }))),
  ]);
  const primaryParties = selectPrimaryParties(mergedParties);

  return {
    ...extracted,
    title: metadata.title || extracted.title,
    contractType: metadata.contractType || extracted.contractType,
    summary: extracted.summary,
    totalValue: metadata.totalValue ?? extracted.totalValue,
    currency: metadata.currency || extracted.currency,
    startDate: metadata.startDate || extracted.startDate,
    endDate: metadata.endDate || extracted.endDate,
    clientName: metadata.clientName || primaryParties.clientName,
    supplierName: metadata.supplierName || primaryParties.supplierName,
    parties: mergedParties,
    keyPoints: extracted.keyPoints,
    paymentTerms: extracted.paymentTerms,
    signatureStatus: metadata.signatureStatus || extracted.signatureStatus,
    signatureDate: metadata.signatureDate || extracted.signatureDate,
  };
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function getString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function getDateString(value: unknown): string | null {
  const raw = getString(value);
  return raw ? tryParseDate(raw) : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractPartiesFromMetadata(value: unknown): ExtractedParty[] {
  if (!Array.isArray(value)) return [];

  const parties: ExtractedParty[] = [];

  for (const entry of value) {
    if (typeof entry === 'string') {
      const normalized = extractEntityName(entry) || normalizeWhitespace(entry);
      if (normalized) {
        parties.push({ name: normalized, role: 'Party' });
      }
      continue;
    }

    const record = getObject(entry);
    if (!record) continue;

    const nameCandidate =
      getString(record.name) ||
      getString(record.partyName) ||
      getString(record.organization) ||
      getString(record.entityName);

    if (!nameCandidate) continue;

    const name = extractEntityName(nameCandidate) || nameCandidate;
    const role = normalizePartyRole(getString(record.role) || getString(record.type) || 'Party');
    parties.push({ name, role });
  }

  return dedupeParties(parties);
}

function extractPersistedOcrFacts(aiMetadata: unknown): {
  metadata: {
    title?: string;
    startDate?: string;
    endDate?: string;
    currency?: string;
    parties?: string[];
    clientName?: string;
    supplierName?: string;
    signatureStatus?: string;
    signatureDate?: string;
  };
  ocrConfidence?: number;
} {
  const aiMeta = getObject(aiMetadata);
  if (!aiMeta) {
    return { metadata: {} };
  }

  const diStructuredMeta = getObject(aiMeta.ocrStructuredMeta);
  const diContractFields = getObject(aiMeta.diContractFields);
  const contractDates = getObject(diContractFields?.dates);

  const mergedParties = dedupeParties([
    ...extractPartiesFromMetadata(diContractFields?.parties),
    ...extractPartiesFromMetadata(aiMeta.external_parties),
  ]);
  const primaryParties = selectPrimaryParties(mergedParties);

  const metadata: {
    title?: string;
    startDate?: string;
    endDate?: string;
    currency?: string;
    parties?: string[];
    clientName?: string;
    supplierName?: string;
    signatureStatus?: string;
    signatureDate?: string;
  } = {};

  const title = getString(diContractFields?.title) || getString(aiMeta.document_title);
  if (title) metadata.title = title;

  const startDate =
    getDateString(contractDates?.effectiveDate) ||
    getDateString(aiMeta.contract_effective_date) ||
    getDateString(aiMeta.start_date);
  if (startDate) metadata.startDate = startDate;

  const endDate =
    getDateString(contractDates?.expirationDate) ||
    getDateString(aiMeta.contract_end_date) ||
    getDateString(aiMeta.end_date);
  if (endDate) metadata.endDate = endDate;

  const signatureStatus = getString(aiMeta.signature_status);
  if (signatureStatus) metadata.signatureStatus = signatureStatus;

  const signatureDate = getDateString(aiMeta.signature_date) || getDateString(contractDates?.executionDate);
  if (signatureDate) metadata.signatureDate = signatureDate;

  const currency = getString(aiMeta.currency);
  if (currency) metadata.currency = currency.toUpperCase();

  if (mergedParties.length > 0) {
    metadata.parties = mergedParties.map(party => party.name);
    if (primaryParties.clientName) metadata.clientName = primaryParties.clientName;
    if (primaryParties.supplierName) metadata.supplierName = primaryParties.supplierName;
  }

  const ocrConfidence = getNumber(diStructuredMeta?.confidence) ?? undefined;
  return { metadata, ocrConfidence };
}

function coerceNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return parseMonetaryValue(value);
  return null;
}

function canonicalizePartyName(candidate: unknown, canonicalName: string | null): string | null {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return canonicalName;
  }

  const normalizedCandidate = normalizeWhitespace(candidate);
  if (!canonicalName) {
    return normalizedCandidate;
  }

  const candidateLower = normalizedCandidate.toLowerCase();
  const canonicalLower = canonicalName.toLowerCase();
  if (canonicalLower.includes(candidateLower) || candidateLower.includes(canonicalLower)) {
    return canonicalName;
  }

  return normalizedCandidate;
}

function deriveNarrativeAmount(description: string): number | null {
  const normalized = normalizeWhitespace(description);
  if (!normalized) return null;

  const explicitAmountMatch = normalized.match(/((?:USD|EUR|GBP|CHF)\s*[\d,.]+|[$€£]\s*[\d,.]+)/i);
  if (explicitAmountMatch?.[1]) {
    return parseMonetaryValue(explicitAmountMatch[1]);
  }

  const quantityMatch = normalized.match(/([\d,]+)\s+units?/i);
  const unitPriceMatch = normalized.match(/(?:at|price of)?\s*((?:USD|EUR|GBP|CHF)\s*[\d,.]+|[$€£]\s*[\d,.]+)\s*(?:per\s+unit|unit\s+price)?/i);
  if (quantityMatch?.[1] && unitPriceMatch?.[1]) {
    const quantity = parseMonetaryValue(quantityMatch[1]);
    const unitPrice = parseMonetaryValue(unitPriceMatch[1]);
    if (quantity != null && unitPrice != null) {
      return quantity * unitPrice;
    }
  }

  return null;
}

function repairArtifactData(
  type: ArtifactType,
  data: Record<string, any>,
  extracted: BasicContractExtraction,
  contractTitle?: string | null
): Record<string, any> {
  const repaired = { ...data };
  const effectiveTitle = contractTitle || extracted.title || null;
  const clientParty = extracted.parties.find(party => party.name === extracted.clientName);
  const supplierParty = extracted.parties.find(party => party.name === extracted.supplierName);

  switch (type) {
    case 'OVERVIEW': {
      if (!repaired.summary && extracted.summary) repaired.summary = extracted.summary;
      if (!repaired.contractType && extracted.contractType) repaired.contractType = extracted.contractType;
      if (!repaired.title && effectiveTitle) repaired.title = effectiveTitle;
      if (!repaired.effectiveDate && extracted.startDate) repaired.effectiveDate = extracted.startDate;
      if (!repaired.endDate && extracted.endDate) repaired.endDate = extracted.endDate;
      if (!Array.isArray(repaired.parties) || repaired.parties.length === 0) {
        repaired.parties = extracted.parties.map(party => party.name);
      }
      if (!repaired.clientName && extracted.clientName) repaired.clientName = extracted.clientName;
      if (!repaired.supplierName && extracted.supplierName) repaired.supplierName = extracted.supplierName;
      if (!Array.isArray(repaired.keyPoints) || repaired.keyPoints.length === 0) {
        repaired.keyPoints = extracted.keyPoints;
      }
      break;
    }
    case 'FINANCIAL': {
      const amounts = Array.isArray(repaired.amounts) ? repaired.amounts : [];
      repaired.amounts = amounts
        .map((amount: Record<string, any>) => {
          if (!amount || typeof amount !== 'object') return null;

          const nextAmount = { ...amount };
          const currentValue = coerceNumericValue(nextAmount.value ?? nextAmount.amount);
          const describedValue = deriveNarrativeAmount(String(nextAmount.description || ''));
          const repairedValue = describedValue != null && (currentValue == null || currentValue < describedValue * 0.1)
            ? describedValue
            : currentValue;

          nextAmount.value = repairedValue;
          delete nextAmount.amount;
          if (!nextAmount.currency && extracted.currency) {
            nextAmount.currency = extracted.currency;
          }

          return repairedValue != null ? nextAmount : null;
        })
        .filter(Boolean);

      if ((repaired.totalValue == null || !Number.isFinite(Number(repaired.totalValue))) && extracted.totalValue != null) {
        repaired.totalValue = extracted.totalValue;
      }
      if (!repaired.currency && extracted.currency) repaired.currency = extracted.currency;
      if (!repaired.paymentTerms && extracted.paymentTerms) repaired.paymentTerms = extracted.paymentTerms;
      break;
    }
    case 'PARTIES': {
      if (!Array.isArray(repaired.parties) || repaired.parties.length === 0) {
        repaired.parties = extracted.parties.map(party => ({
          name: party.name,
          role: party.role,
          type: 'Company',
        }));
      }
      if (!repaired.partyRoles || typeof repaired.partyRoles !== 'object' || Array.isArray(repaired.partyRoles)) {
        repaired.partyRoles = extracted.parties.reduce<Record<string, string>>((acc, party) => {
          acc[party.name] = party.role;
          return acc;
        }, {});
      }
      break;
    }
    case 'TIMELINE': {
      if (!repaired.effectiveDate && extracted.startDate) repaired.effectiveDate = extracted.startDate;
      if (!repaired.endDate && extracted.endDate) repaired.endDate = extracted.endDate;
      if (!Array.isArray(repaired.keyDates) || repaired.keyDates.length === 0) {
        repaired.keyDates = [extracted.startDate, extracted.endDate].filter(Boolean);
      }
      break;
    }
    case 'EXECUTIVE_SUMMARY': {
      if (!repaired.executiveSummary && extracted.summary) repaired.executiveSummary = extracted.summary;
      if (!Array.isArray(repaired.keyTakeaways) || repaired.keyTakeaways.length === 0) {
        repaired.keyTakeaways = extracted.keyPoints;
      }
      break;
    }
    default:
      break;
  }

  if (type !== 'PARTIES') {
    repaired.clientName = canonicalizePartyName(repaired.clientName, extracted.clientName);
    repaired.supplierName = canonicalizePartyName(repaired.supplierName, extracted.supplierName);
  }
  if (!repaired.partyRoles && (clientParty || supplierParty)) {
    repaired.partyRoles = {
      ...(clientParty ? { client: clientParty.name } : {}),
      ...(supplierParty ? { supplier: supplierParty.name } : {}),
    };
  } else if (repaired.partyRoles && typeof repaired.partyRoles === 'object' && !Array.isArray(repaired.partyRoles)) {
    repaired.partyRoles = {
      ...repaired.partyRoles,
      ...(Object.prototype.hasOwnProperty.call(repaired.partyRoles, 'client')
        ? { client: canonicalizePartyName(repaired.partyRoles.client, extracted.clientName) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(repaired.partyRoles, 'supplier')
        ? { supplier: canonicalizePartyName(repaired.partyRoles.supplier, extracted.supplierName) }
        : {}),
    };
  }

  return repaired;
}

/**
 * Use GPT-4o to extract text from a scanned/image-based PDF.
 * Uses native PDF file input (NOT image_url which rejects application/pdf MIME).
 */
async function extractScannedPDFWithVision(fileContent: Buffer): Promise<string> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — cannot use Vision OCR for scanned PDF');
    return '';
  }
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = createOpenAIClient(apiKey);
    const base64 = fileContent.toString('base64');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract ALL text from this PDF document with high accuracy.
Preserve the exact structure, formatting, and layout.
Include all headings, paragraphs, lists, tables (as markdown), headers, footers.
IMPORTANT: Pay special attention to signature pages — include all signature blocks,
"IN WITNESS WHEREOF" sections, "For and on behalf of" clauses, signer names, titles,
dates of execution, and any handwritten signatures or marks.
If you see handwritten text or signatures, transcribe them and note "[handwritten]" next to them.
Return the extracted text in clean markdown format.`,
            },
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: `data:application/pdf;base64,${base64}`,
              },
            } as any,
          ],
        },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    }, { signal: AbortSignal.timeout(90_000) });
    
    const text = response.choices[0]?.message?.content || '';
    logger.info({ textLength: text.length }, 'GPT-4o native PDF OCR completed for scanned PDF');
    return text;
  } catch (error) {
    logger.error({ error }, 'GPT-4o Vision OCR failed for scanned PDF');
    return '';
  }
}

function buildDocumentIntelligenceOcrText(result: {
  content?: string;
  tables?: Array<{ headers?: string[]; rows?: string[][] }>;
  keyValuePairs?: Array<{ key?: string; value?: string }>;
}): string {
  const parts: string[] = [];
  const content = typeof result.content === 'string' ? result.content.trim() : '';

  if (content) {
    parts.push(content);
  }

  if (Array.isArray(result.tables) && result.tables.length > 0) {
    const renderedTables: string[] = [];
    for (const table of result.tables) {
      const headers = Array.isArray(table.headers) ? table.headers.filter(Boolean) : [];
      const rows = Array.isArray(table.rows) ? table.rows : [];
      if (headers.length === 0 && rows.length === 0) continue;

      if (headers.length > 0) {
        renderedTables.push(`| ${headers.join(' | ')} |`);
        renderedTables.push(`| ${headers.map(() => '---').join(' | ')} |`);
      }
      for (const row of rows) {
        renderedTables.push(`| ${row.join(' | ')} |`);
      }
      renderedTables.push('');
    }

    if (renderedTables.length > 0) {
      parts.push(['--- EXTRACTED TABLES ---', ...renderedTables].join('\n').trim());
    }
  }

  if (Array.isArray(result.keyValuePairs) && result.keyValuePairs.length > 0) {
    const kvLines = result.keyValuePairs
      .map((pair) => {
        const key = typeof pair.key === 'string' ? normalizeWhitespace(pair.key) : '';
        const value = typeof pair.value === 'string' ? normalizeWhitespace(pair.value) : '';
        return key && value ? `${key}: ${value}` : null;
      })
      .filter((line): line is string => Boolean(line));

    if (kvLines.length > 0) {
      parts.push(['--- KEY-VALUE PAIRS ---', ...kvLines].join('\n'));
    }
  }

  return parts.join('\n\n').trim();
}

interface DIExtractionResult {
  text: string;
  hasHandwriting: boolean;
  handwrittenSpans: string[];
  /** Number of pages DI actually processed (may be less than total PDF pages) */
  pagesProcessed: number;
}

// Per-invocation DI handwriting results — returned from extractTextFromBuffer
// instead of using unsafe module-level mutable state.
interface DIHandwritingEvidence {
  hasHandwriting: boolean;
  handwrittenSpans: string[];
}

const NO_HANDWRITING: DIHandwritingEvidence = { hasHandwriting: false, handwrittenSpans: [] };

async function extractPDFWithDocumentIntelligence(fileContent: Buffer, totalPdfPages?: number): Promise<DIExtractionResult> {
  const empty: DIExtractionResult = { text: '', hasHandwriting: false, handwrittenSpans: [], pagesProcessed: 0 };
  try {
    const { analyzeLayout, analyzeRead, isDIConfigured, isDIEnabled } = await import('@repo/workers/azure-document-intelligence');

    if (!isDIConfigured() || !isDIEnabled()) {
      logger.info('Azure Document Intelligence not configured or disabled — skipping DI extraction');
      return empty;
    }

    // Helper to extract handwritten spans from DI styles
    const extractHandwritten = (content: string, styles?: Array<{ isHandwritten?: boolean; confidence?: number; spans?: Array<{ offset: number; length: number }> }>): string[] => {
      if (!content || !styles?.length) return [];
      const spans: string[] = [];
      for (const style of styles) {
        if (!style.isHandwritten || (style.confidence ?? 0) < 0.5) continue;
        for (const span of style.spans ?? []) {
          const text = content.substring(span.offset, span.offset + span.length).trim();
          if (text.length > 0) spans.push(text);
        }
      }
      return spans;
    };

    // Helper: call DI layout for a specific page range
    const analyzePageRange = async (pages?: string): Promise<DIExtractionResult> => {
      const layoutResult = await analyzeLayout(fileContent, { extractKeyValuePairs: true, pages });
      const layoutText = buildDocumentIntelligenceOcrText(layoutResult);
      const handwrittenSpans = extractHandwritten(layoutResult.content || '', (layoutResult as any).styles);
      const diPageCount = layoutResult.metadata?.pageCount || layoutResult.pages?.length || 0;
      return { text: layoutText, hasHandwriting: handwrittenSpans.length > 0, handwrittenSpans, pagesProcessed: diPageCount };
    };

    try {
      // First call — let DI process without page range (covers first N pages, limited by tier)
      const firstResult = await analyzePageRange();
      if (firstResult.text.length <= 10) {
        logger.warn('Azure Document Intelligence layout extraction returned insufficient text');
      } else {
        const diPages = firstResult.pagesProcessed;
        logger.info({ textLength: firstResult.text.length, pagesProcessed: diPages, handwrittenSpans: firstResult.handwrittenSpans.length }, 'Azure Document Intelligence layout extraction completed');

        // If DI processed fewer pages than the PDF total (e.g. free tier 2-page limit),
        // make additional DI calls for remaining page ranges in batches of 2
        if (totalPdfPages && totalPdfPages > diPages && diPages > 0) {
          logger.info({ diPages, totalPdfPages, remaining: totalPdfPages - diPages }, 'DI tier page limit detected — making additional DI calls for remaining pages');
          const allTexts = [firstResult.text];
          let allHandwrittenSpans = [...firstResult.handwrittenSpans];
          let hasHandwriting = firstResult.hasHandwriting;
          let totalProcessed = diPages;
          const batchSize = diPages; // Use same batch size as initial result (usually 2 for free tier)

          for (let startPage = diPages + 1; startPage <= totalPdfPages; startPage += batchSize) {
            const endPage = Math.min(startPage + batchSize - 1, totalPdfPages);
            const pageRange = `${startPage}-${endPage}`;
            try {
              const batchResult = await analyzePageRange(pageRange);
              if (batchResult.text.length > 0) {
                allTexts.push(batchResult.text);
                totalProcessed += batchResult.pagesProcessed;
                if (batchResult.hasHandwriting) {
                  hasHandwriting = true;
                  allHandwrittenSpans = [...allHandwrittenSpans, ...batchResult.handwrittenSpans];
                }
                logger.info({ pageRange, textLength: batchResult.text.length, handwrittenSpans: batchResult.handwrittenSpans.length }, 'DI batch page range processed');
              }
            } catch (batchError) {
              logger.warn({ pageRange, error: batchError }, 'DI batch page range failed — skipping');
            }
          }

          const combinedText = allTexts.join('\n\n');
          logger.info({ totalProcessed, totalChars: combinedText.length, hasHandwriting }, 'DI multi-batch extraction complete');
          return { text: combinedText, hasHandwriting, handwrittenSpans: allHandwrittenSpans, pagesProcessed: totalProcessed };
        }

        return firstResult;
      }
    } catch (layoutError) {
      logger.warn({ error: layoutError }, 'Azure Document Intelligence layout extraction failed, trying read model');
    }

    try {
      const readResult = await analyzeRead(fileContent);
      const readText = (readResult.content || '').trim();
      const handwrittenSpans = extractHandwritten(readResult.content || '', (readResult as any).styles);
      const readPageCount = readResult.metadata?.pageCount || readResult.pages?.length || 0;
      if (readText.length > 10) {
        logger.info({ textLength: readText.length, handwrittenSpans: handwrittenSpans.length, pagesProcessed: readPageCount }, 'Azure Document Intelligence read extraction completed');
        return { text: readText, hasHandwriting: handwrittenSpans.length > 0, handwrittenSpans, pagesProcessed: readPageCount };
      }
      logger.warn('Azure Document Intelligence read extraction returned insufficient text');
    } catch (readError) {
      logger.warn({ error: readError }, 'Azure Document Intelligence read extraction failed');
    }
  } catch (error) {
    logger.warn({ error }, 'Azure Document Intelligence unavailable in inline generator');
  }

  return empty;
}

/**
 * Extract text content from a buffer based on file type.
 *
 * For PDFs, Azure Document Intelligence is **always** invoked (when configured)
 * to provide richer structure (tables, key-value pairs, confidence scores).
 * DI text is preferred over plain pdf-parse output; pdf-parse serves as a
 * fallback when DI is unavailable or returns less content.
 */
async function extractTextFromBuffer(
  fileContent: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ text: string; diHandwriting: DIHandwritingEvidence; ocrProvider?: string; ocrModel?: string }> {
  const ext = path.extname(fileName).toLowerCase();

  // PDF extraction — always prefer Azure Document Intelligence for richer output
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    // 1. Get total page count from pdf-parse first (cheap, fast) so DI can batch if needed
    let pdfParseText = '';
    let pdfParseTotalPages = 0;
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileContent);
      pdfParseText = data.text || '';
      pdfParseTotalPages = data.numpages || 0;
      const meaningfulText = pdfParseText.replace(/\s+/g, ' ').trim();
      logger.info({ pages: data.numpages, chars: pdfParseText.length, meaningfulChars: meaningfulText.length }, 'PDF parsed with pdf-parse (page count + fallback)');
    } catch (parseError) {
      logger.warn({ error: parseError }, 'pdf-parse failed');
    }

    // 2. Run DI with total page count — handles free tier 2-page limit via batching
    let diText = '';
    let diResult: DIExtractionResult = { text: '', hasHandwriting: false, handwrittenSpans: [], pagesProcessed: 0 };
    const diHandwriting: DIHandwritingEvidence = { hasHandwriting: false, handwrittenSpans: [] };
    try {
      diResult = await extractPDFWithDocumentIntelligence(fileContent, pdfParseTotalPages || undefined);
      diText = diResult.text;
      // Capture DI handwriting evidence for return to caller
      diHandwriting.hasHandwriting = diResult.hasHandwriting;
      diHandwriting.handwrittenSpans = diResult.handwrittenSpans;
      if (diText && diText.length > 10) {
        logger.info({ diChars: diText.length, pagesProcessed: diResult.pagesProcessed, hasHandwriting: diResult.hasHandwriting }, 'Azure Document Intelligence extracted text for PDF');
      }
    } catch (diError) {
      logger.warn({ error: diError }, 'Azure Document Intelligence failed for PDF, will fall back to pdf-parse');
    }

    // 3. Choose the best result — prefer DI when it returned meaningful content
    if (diText && diText.length > 10) {
      return { text: diText, diHandwriting, ocrProvider: 'azure-document-intelligence', ocrModel: 'prebuilt-layout' };
    }
    if (pdfParseText.replace(/\s+/g, ' ').trim().length >= 50) {
      logger.info('DI unavailable or insufficient — using pdf-parse text');
      return { text: pdfParseText, diHandwriting, ocrProvider: 'pdf-parse', ocrModel: 'pdf-parse' };
    }

    // 4. Scanned/image PDF with no text from either source — try Vision OCR
    logger.info('No meaningful text from DI or pdf-parse — attempting GPT-4o Vision OCR');
    const ocrText = await extractScannedPDFWithVision(fileContent);
    if (ocrText && ocrText.length > 10) {
      return { text: ocrText, diHandwriting, ocrProvider: 'azure-openai-vision', ocrModel: 'gpt-4o' };
    }

    // 5. Last resort — if pdf-parse returned any small amount of text, use it
    if (pdfParseText.trim().length > 0) return { text: pdfParseText, diHandwriting, ocrProvider: 'pdf-parse', ocrModel: 'pdf-parse' };

    throw new Error('Failed to extract text from PDF — DI, pdf-parse, and Vision OCR all returned no content');
  }

  // Word documents using mammoth
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileContent });
      logger.info({ chars: result.value.length }, 'DOCX parsed successfully');
      return { text: result.value, diHandwriting: NO_HANDWRITING, ocrProvider: 'mammoth', ocrModel: 'mammoth' };
    } catch (error) {
      logger.error({ error }, 'mammoth failed to parse DOCX');
      throw new Error('Failed to extract text from DOCX');
    }
  }

  // Plain text files
  if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
    return { text: fileContent.toString('utf8'), diHandwriting: NO_HANDWRITING, ocrProvider: 'plain-text', ocrModel: 'utf8' };
  }

  // RTF files - basic extraction
  if (ext === '.rtf') {
    const text = fileContent.toString('utf8');
    return { text: text
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\\\/g, '\\')
      .trim(), diHandwriting: NO_HANDWRITING };
  }

  // Image files - return placeholder (would need OCR)
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return { text: '[Image file - text extraction requires OCR processing]', diHandwriting: NO_HANDWRITING };
  }

  // Unknown format - try as text
  logger.warn({ ext, mimeType }, 'Unknown file format, attempting text extraction');
  const textContent = fileContent.toString('utf8');
  const printableRatio = textContent.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textContent.length;
  if (printableRatio > 0.8) {
    return { text: textContent, diHandwriting: NO_HANDWRITING };
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

/**
 * Extract text content from a file based on its type
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<{ text: string; diHandwriting: DIHandwritingEvidence; ocrProvider?: string; ocrModel?: string }> {
  const fileContent = await fs.readFile(filePath);
  return extractTextFromBuffer(fileContent, filePath, mimeType);
}

/**
 * Try to parse a date string into ISO format (YYYY-MM-DD)
 */
function tryParseDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const normalized = dateStr
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/[\s,]+$/g, '')
      .trim();
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }
  return dateStr;
}

/**
 * Extract key metadata from contract text
 */
async function extractContractMetadata(
  contractText: string,
  contractId: string,
  seededBasicExtraction?: BasicContractExtraction
): Promise<{
  title?: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  currency?: string;
  parties?: string[];
  clientName?: string;
  supplierName?: string;
  signatureStatus?: string;
  signatureDate?: string;
}> {
  const apiKey = getOpenAIApiKey();
  const basicFields = seededBasicExtraction ?? extractBasicFieldsFromText(contractText);

  const basicMetadata: {
    title?: string;
    contractType?: string;
    startDate?: string;
    endDate?: string;
    totalValue?: number;
    currency?: string;
    parties?: string[];
    clientName?: string;
    supplierName?: string;
    signatureStatus?: string;
    signatureDate?: string;
  } = {
    ...(basicFields.title ? { title: basicFields.title } : {}),
    ...(basicFields.contractType ? { contractType: basicFields.contractType } : {}),
    ...(basicFields.startDate ? { startDate: basicFields.startDate } : {}),
    ...(basicFields.endDate ? { endDate: basicFields.endDate } : {}),
    ...(basicFields.totalValue != null ? { totalValue: basicFields.totalValue } : {}),
    ...(basicFields.currency ? { currency: basicFields.currency } : {}),
    ...(basicFields.parties.length > 0 ? { parties: basicFields.parties.map(party => party.name) } : {}),
    ...(basicFields.clientName ? { clientName: basicFields.clientName } : {}),
    ...(basicFields.supplierName ? { supplierName: basicFields.supplierName } : {}),
    ...(basicFields.signatureStatus ? { signatureStatus: basicFields.signatureStatus } : {}),
    ...(basicFields.signatureDate ? { signatureDate: basicFields.signatureDate } : {}),
  };

  // Try AI extraction if available
  if (apiKey) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = createOpenAIClient(apiKey);

      const truncatedText = contractText.substring(0, 50000); // First 50k chars for metadata

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a contract metadata extractor. Extract only explicit facts from the contract and return valid JSON only. Do not use addresses as party names. Do not infer total contract value from unit prices, example calculations, insurance limits, liability caps, penalties, or forecasts. If a field is not explicit, return null.',
          },
          {
            role: 'user',
            content: `Extract the following metadata from this contract:
- title: Contract title or name
- contractType: Type (e.g., SERVICE, NDA, EMPLOYMENT, LEASE, MSA, SOW, etc.)
- startDate: Effective/start date (ISO format YYYY-MM-DD or null)
- endDate: Expiration/end date (ISO format YYYY-MM-DD or null)  
- totalValue: Total contract value as number (or null)
- currency: Currency code (e.g., USD, EUR, GBP)
- parties: Array of all party names as strings (companies/individuals only, no addresses)
- clientName: Name of the client/buyer/customer party if explicit, otherwise null
- supplierName: Name of the supplier/vendor/service provider party if explicit, otherwise null
- signatureStatus: One of "signed", "partially_signed", "unsigned", or "unknown". Look for signature blocks, "For and on behalf of", "/s/" markers, names appearing after signature lines, handwritten-style names, DocuSign/Adobe Sign indicators, execution clauses, witness sections, or any indication the contract was executed. If the document has signature blocks with names filled in, it is "signed". If signature blocks exist but are blank, it is "unsigned".
- signatureDate: Date of final execution (ISO format YYYY-MM-DD or null)

Return ONLY valid JSON.

Known extracted facts:
- title: ${basicFields.title || 'unknown'}
- contractType: ${basicFields.contractType || 'unknown'}
- clientName: ${basicFields.clientName || 'unknown'}
- supplierName: ${basicFields.supplierName || 'unknown'}
- startDate: ${basicFields.startDate || 'unknown'}
- endDate: ${basicFields.endDate || 'unknown'}
- totalValue: ${basicFields.totalValue != null ? `${basicFields.totalValue} ${basicFields.currency || ''}`.trim() : 'not explicitly stated'}
- parties: ${basicFields.parties.length > 0 ? basicFields.parties.map(party => `${party.name} (${party.role})`).join('; ') : 'unknown'}

Contract text:
${truncatedText}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }, { signal: AbortSignal.timeout(30_000) });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const parsedParties = Array.isArray(parsed.parties)
          ? parsed.parties
              .map((party: unknown) => {
                if (typeof party === 'string') return normalizeWhitespace(party);
                if (party && typeof party === 'object' && typeof (party as Record<string, unknown>).name === 'string') {
                  return normalizeWhitespace((party as Record<string, string>).name);
                }
                return null;
              })
              .filter((party: string | null): party is string => Boolean(party))
          : basicMetadata.parties;

        // Log conflicts between regex and AI extraction for auditability
        const conflicts: string[] = [];
        if (basicMetadata.contractType && parsed.contractType && basicMetadata.contractType !== parsed.contractType) {
          conflicts.push(`contractType: regex="${basicMetadata.contractType}" vs AI="${parsed.contractType}"`);
        }
        if (basicMetadata.startDate && parsed.startDate && basicMetadata.startDate !== parsed.startDate) {
          conflicts.push(`startDate: regex="${basicMetadata.startDate}" vs AI="${parsed.startDate}"`);
        }
        if (basicMetadata.endDate && parsed.endDate && basicMetadata.endDate !== parsed.endDate) {
          conflicts.push(`endDate: regex="${basicMetadata.endDate}" vs AI="${parsed.endDate}"`);
        }
        if (basicMetadata.totalValue && parsed.totalValue && basicMetadata.totalValue !== parsed.totalValue) {
          conflicts.push(`totalValue: regex=${basicMetadata.totalValue} vs AI=${parsed.totalValue}`);
        }
        if (basicMetadata.signatureStatus && parsed.signatureStatus && basicMetadata.signatureStatus !== parsed.signatureStatus) {
          conflicts.push(`signatureStatus: regex="${basicMetadata.signatureStatus}" vs AI="${parsed.signatureStatus}"`);
        }
        if (conflicts.length > 0) {
          logger.warn({ contractId, conflicts }, 'Metadata extraction conflicts (AI values used)');
        }

        return {
          title: parsed.title || basicMetadata.title,
          contractType: parsed.contractType || basicMetadata.contractType,
          startDate: parsed.startDate || basicMetadata.startDate,
          endDate: parsed.endDate || basicMetadata.endDate,
          totalValue: parsed.totalValue ?? basicMetadata.totalValue,
          currency: parsed.currency || basicMetadata.currency,
          parties: parsedParties || basicMetadata.parties,
          clientName: parsed.clientName || basicMetadata.clientName,
          supplierName: parsed.supplierName || basicMetadata.supplierName,
          // For signatureStatus: prefer regex "signed" over AI "unsigned" because
          // AI only sees extracted text and cannot detect handwritten/ink signatures
          // that the regex heuristics identify from completed signature blocks
          signatureStatus: (basicMetadata.signatureStatus === 'signed' && parsed.signatureStatus === 'unsigned')
            ? basicMetadata.signatureStatus
            : (parsed.signatureStatus || basicMetadata.signatureStatus),
          signatureDate: parsed.signatureDate || basicMetadata.signatureDate,
        };
      }
    } catch (aiError) {
      logger.warn({ aiError, contractId }, 'AI metadata extraction failed, using basic extraction');
    }
  }

  return basicMetadata;
}

/**
 * Extract basic structured fields from contract text using regex patterns
 * Used by generateBasicArtifact to populate artifacts with real data from the document
 */
function extractBasicFieldsFromText(contractText: string): {
  title: string | null;
  contractType: string | null;
  summary: string | null;
  totalValue: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  supplierName: string | null;
  parties: Array<{ name: string; role: string }>;
  keyPoints: string[];
  paymentTerms: string | null;
  signatureStatus: string | null;
  signatureDate: string | null;
} {
  const result = {
    title: null as string | null,
    contractType: null as string | null,
    summary: null as string | null,
    totalValue: null as number | null,
    currency: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
    clientName: null as string | null,
    supplierName: null as string | null,
    parties: [] as Array<{ name: string; role: string }>,
    keyPoints: [] as string[],
    paymentTerms: null as string | null,
    signatureStatus: null as string | null,
    signatureDate: null as string | null,
  };

  if (!contractText || contractText.length < 10) return result;

  // --- Title ---
  for (const pattern of TITLE_PATTERNS) {
    const match = contractText.match(pattern);
    if (match) {
      result.title = normalizeWhitespace(match[1]);
      break;
    }
  }

  // --- Contract Type ---
  for (const [pattern, cType] of CONTRACT_TYPE_PATTERNS) {
    if (pattern.test(contractText)) {
      result.contractType = cType;
      break;
    }
  }

  // --- Dates ---
  for (const pattern of START_DATE_PATTERNS) {
    const match = contractText.match(pattern);
    if (match) {
      result.startDate = tryParseDate(match[1]);
      break;
    }
  }

  for (const pattern of END_DATE_PATTERNS) {
    const match = contractText.match(pattern);
    if (match) {
      result.endDate = tryParseDate(match[1]);
      break;
    }
  }

  // --- Total Value ---
  const explicitTotalValue = extractExplicitTotalValue(contractText);
  result.totalValue = explicitTotalValue.value;
  result.currency = explicitTotalValue.currency || extractPrimaryCurrency(contractText);

  // --- Parties ---
  result.parties = extractRoleAnchoredParties(contractText);
  const primaryParties = selectPrimaryParties(result.parties);
  result.clientName = primaryParties.clientName;
  result.supplierName = primaryParties.supplierName;

  // --- Payment Terms ---
  result.paymentTerms = extractPaymentTerms(contractText);

  // --- Signatures ---
  const signatureInfo = extractSignatureInfo(contractText);
  result.signatureStatus = signatureInfo.signatureStatus;
  result.signatureDate = signatureInfo.signatureDate;

  // --- Build summary as prose ---
  if (result.clientName && result.supplierName && result.totalValue && result.title) {
    const typeLabel = result.contractType ? ` (${result.contractType})` : '';
    const periodStr = result.startDate && result.endDate ? `, effective from ${result.startDate} through ${result.endDate}` : '';
    result.summary = `This ${result.title}${typeLabel} establishes an agreement between ${result.clientName} (Client) and ${result.supplierName} (Service Provider) with a total contract value of ${result.currency === 'USD' ? '$' : result.currency || ''}${result.totalValue.toLocaleString()} ${result.currency || 'USD'}${periodStr}.`;
  } else {
    const summaryParts: string[] = [];
    if (result.title) summaryParts.push(result.title);
    if (result.contractType) summaryParts.push(`Type: ${result.contractType}`);
    if (result.clientName && result.supplierName) {
      summaryParts.push(`Between ${result.clientName} and ${result.supplierName}`);
    }
    if (result.totalValue) {
      summaryParts.push(`Value: ${result.currency === 'USD' ? '$' : result.currency || ''}${result.totalValue.toLocaleString()}`);
    }
    if (result.startDate && result.endDate) {
      summaryParts.push(`Period: ${result.startDate} to ${result.endDate}`);
    }
    if (summaryParts.length > 0) {
      result.summary = summaryParts.join('. ') + '.';
    }
  }

  // --- Key Points ---
  if (result.clientName) result.keyPoints.push(`${clientLabel(result.parties, result.clientName)}: ${result.clientName}`);
  if (result.supplierName) result.keyPoints.push(`${supplierLabel(result.parties, result.supplierName)}: ${result.supplierName}`);
  if (result.totalValue) result.keyPoints.push(`Total Value: ${result.currency ? `${result.currency} ` : ''}${result.totalValue.toLocaleString()}`);
  if (result.startDate) result.keyPoints.push(`Effective: ${result.startDate}`);
  if (result.endDate) result.keyPoints.push(`Expires: ${result.endDate}`);
  if (result.paymentTerms) result.keyPoints.push(`Payment Terms: ${result.paymentTerms}`);

  return result;
}

function clientLabel(parties: ExtractedParty[], clientName: string): string {
  return parties.find(party => party.name === clientName)?.role || 'Client';
}

function supplierLabel(parties: ExtractedParty[], supplierName: string): string {
  return parties.find(party => party.name === supplierName)?.role || 'Supplier';
}

/**
 * Generate basic artifact data without AI (fallback mode)
 * Now performs regex-based extraction from the document text
 */
function generateBasicArtifact(
  type: ArtifactType,
  contractText: string,
  contractId: string,
  contractTitle?: string | null,
  extractedContractFacts?: BasicContractExtraction
): Record<string, any> {
  const now = new Date().toISOString();
  const textPreview = contractText.substring(0, 500);
  const wordCount = contractText.split(/\s+/).length;
  
  const baseData = {
    _generated: now,
    _mode: 'basic',
    _contractId: contractId,
    _wordCount: wordCount,
  };

  // Extract basic metadata from text for enriching artifacts
  const basicExtracted = extractedContractFacts ?? extractBasicFieldsFromText(contractText);

  switch (type) {
    case 'OVERVIEW': {
      const effectiveTitle = contractTitle || basicExtracted.title || null;
      const summaryParts: string[] = [];
      if (effectiveTitle) summaryParts.push(effectiveTitle);
      if (basicExtracted.contractType) summaryParts.push(`Type: ${basicExtracted.contractType}`);
      if (basicExtracted.clientName && basicExtracted.supplierName) {
        summaryParts.push(`Between ${basicExtracted.clientName} and ${basicExtracted.supplierName}`);
      }
      if (basicExtracted.totalValue) summaryParts.push(`Value: ${basicExtracted.currency || ''}${basicExtracted.totalValue.toLocaleString()}`);
      const derivedSummary = summaryParts.length > 0 ? summaryParts.join('. ') + '.' : null;
      return {
        ...baseData,
        summary: derivedSummary || `Contract document with ${wordCount} words. Full analysis requires AI processing.`,
        contractType: basicExtracted.contractType || null,
        title: effectiveTitle,
        totalValue: basicExtracted.totalValue || null,
        currency: basicExtracted.currency || null,
        effectiveDate: basicExtracted.startDate || null,
        startDate: basicExtracted.startDate || null,
        expirationDate: basicExtracted.endDate || null,
        endDate: basicExtracted.endDate || null,
        parties: basicExtracted.parties.length > 0 ? basicExtracted.parties : [],
        clientName: basicExtracted.clientName || null,
        supplierName: basicExtracted.supplierName || null,
        keyPoints: basicExtracted.keyPoints.length > 0 ? basicExtracted.keyPoints : ['Document uploaded and processed', 'Full analysis requires AI processing'],
        documentInfo: {
          estimatedPages: Math.ceil(wordCount / 250),
          hasText: contractText.length > 0,
          preview: textPreview,
        },
      };
    }

    case 'CLAUSES':
      return {
        ...baseData,
        clauses: [],
        totalClauses: 0,
        note: 'Clause extraction requires AI analysis',
      };

    case 'FINANCIAL':
      return {
        ...baseData,
        amounts: basicExtracted.totalValue ? [{ amount: basicExtracted.totalValue, currency: basicExtracted.currency || 'USD', description: 'Total Contract Value' }] : [],
        currency: basicExtracted.currency || null,
        totalValue: basicExtracted.totalValue || null,
        paymentTerms: basicExtracted.paymentTerms || null,
        note: basicExtracted.totalValue ? undefined : 'Financial extraction requires AI analysis',
      };

    case 'RISK':
      return {
        ...baseData,
        riskLevel: 'UNKNOWN',
        risks: [],
        note: 'Risk analysis requires AI processing',
      };

    case 'COMPLIANCE':
      return {
        ...baseData,
        complianceStatus: 'PENDING_REVIEW',
        requirements: [],
        note: 'Compliance analysis requires AI processing',
      };

    case 'OBLIGATIONS':
      return {
        ...baseData,
        obligations: [],
        partyObligations: {},
        note: 'Obligation extraction requires AI analysis',
      };

    case 'RENEWAL':
      return {
        ...baseData,
        renewalTerms: null,
        autoRenewal: null,
        noticePeriod: null,
        note: 'Renewal analysis requires AI processing',
      };

    case 'NEGOTIATION_POINTS':
      return {
        ...baseData,
        negotiationPoints: [],
        priorityAreas: [],
        note: 'Negotiation points analysis requires AI processing',
      };

    case 'AMENDMENTS':
      return {
        ...baseData,
        amendments: [],
        hasAmendments: false,
        note: 'Amendments analysis requires AI processing',
      };

    case 'CONTACTS':
      return {
        ...baseData,
        contacts: [],
        primaryContact: null,
        note: 'Contact extraction requires AI processing',
      };

    case 'PARTIES':
      return {
        ...baseData,
        parties: basicExtracted.parties.length > 0 ? basicExtracted.parties : [],
        partyRoles: basicExtracted.clientName || basicExtracted.supplierName ? {
          ...(basicExtracted.clientName ? { client: basicExtracted.clientName } : {}),
          ...(basicExtracted.supplierName ? { supplier: basicExtracted.supplierName } : {}),
        } : {},
        note: basicExtracted.parties.length > 0 ? undefined : 'Party extraction requires AI processing',
      };

    case 'TIMELINE':
      return {
        ...baseData,
        milestones: [],
        keyDates: [],
        duration: null,
        note: 'Timeline extraction requires AI processing',
      };

    case 'DELIVERABLES':
      return {
        ...baseData,
        deliverables: [],
        deliverySchedule: null,
        note: 'Deliverables extraction requires AI processing',
      };

    case 'EXECUTIVE_SUMMARY':
      return {
        ...baseData,
        executiveSummary: basicExtracted.summary || `Contract document with ${wordCount} words uploaded for review.`,
        keyTakeaways: basicExtracted.keyPoints.length > 0 ? basicExtracted.keyPoints : [],
        recommendations: [],
        note: basicExtracted.summary ? undefined : 'Executive summary requires AI processing',
      };

    default:
      return {
        ...baseData,
        note: `${type} artifact - analysis pending`,
      };
  }
}

/**
 * Try to generate an artifact using OpenAI
 */
async function generateAIArtifact(
  type: ArtifactType,
  contractText: string,
  contractId: string,
  contractType?: string,
  ocrConfidence?: number,
  detectedTables?: string[],
  extractedContractFacts?: BasicContractExtraction,
  contractTitle?: string | null
): Promise<Record<string, any> | null> {
  // getOpenAIApiKey() throws if no AI key is configured — let it propagate
  // so callers know AI is required
  const apiKey = getOpenAIApiKey();

  try {
    const OpenAI = (await import('openai')).default;
    const openai = createOpenAIClient(apiKey);

    // Truncate text if too long (approximately 100k tokens ~ 400k chars)
    const maxChars = 100000;
    const truncatedText = contractText.length > maxChars 
      ? contractText.substring(0, maxChars) + '\n\n[... text truncated for analysis ...]'
      : contractText;
    const groundingFacts = buildArtifactGroundingContext(
      extractedContractFacts ?? extractBasicFieldsFromText(contractText),
      contractTitle
    );

    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract and provide a JSON response with:
        - summary: A brief summary (2-3 sentences)
        - keyPoints: Array of key points (max 5)
        - parties: Array of party names mentioned
        - effectiveDate: Date if found (ISO format or null)
        - endDate: End or expiration date if found (ISO format or null)
        - contractType: Type of contract if identifiable
        - clientName: Client/buyer/customer party if explicit, otherwise null
        - supplierName: Supplier/vendor/service provider party if explicit, otherwise null`,
      
      CLAUSES: `Extract the main clauses from this contract. Return JSON with:
        - clauses: Array of objects with {title, content, type, importance}
        - totalClauses: Number of clauses found`,
      
      FINANCIAL: `Extract financial information from this contract. Return JSON with:
        - amounts: Array of {value, currency, description}
        - totalValue: Total contract value if stated
        - currency: Primary currency
        - paymentTerms: Payment terms if specified (e.g. "Net 30", "50% upfront / 50% on delivery")
        - billingFrequency: One of "monthly", "quarterly", "annual", "one-time", "milestone", or null if unclear
        Use numbers only for value fields, with full amounts and no thousands separators in strings.`,
      
      RISK: `Analyze risks in this contract. Return JSON with:
        - riskLevel: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
        - risks: Array of {category, description, severity, mitigation}`,
      
      COMPLIANCE: `Analyze compliance aspects of this contract. Return JSON with:
        - complianceStatus: 'COMPLIANT', 'NEEDS_REVIEW', or 'NON_COMPLIANT'
        - requirements: Array of compliance requirements found
        - standards: Any standards or regulations referenced (e.g. GDPR, HIPAA, SOC 2, ISO 27001)
        - jurisdiction: The state/country/region named in the governing-law / jurisdiction clause (e.g. "Delaware, USA", "England and Wales", "Switzerland"), or null if not stated
        - governingLaw: Full governing-law clause text, or null`,
      
      OBLIGATIONS: `Extract obligations from this contract. Return JSON with:
        - obligations: Array of {party, obligation, deadline, type}
        - partyObligations: Object mapping party names to their obligations`,
      
      RENEWAL: `Extract renewal information from this contract. Return JSON with:
        - renewalTerms: Description of renewal terms
        - autoRenewal: Boolean if auto-renewal exists
        - noticePeriod: Notice period for renewal/termination as written (e.g. "60 days", "3 months")
        - noticePeriodDays: Notice period normalised to a whole number of days (e.g. 60, 90), or null if not stated
        - terminationClause: Brief description of the termination-for-convenience clause if any, else null
        - expirationDate: Contract expiration date if found`,

      NEGOTIATION_POINTS: `Identify potential negotiation points in this contract. Return JSON with:
        - negotiationPoints: Array of {area, currentTerm, suggestedChange, priority, rationale}
        - priorityAreas: Array of top 3 areas to focus on
        - overallLeverage: 'STRONG', 'MODERATE', or 'WEAK'`,

      AMENDMENTS: `Identify any amendments or modifications in this contract. Return JSON with:
        - amendments: Array of {date, description, section, impact}
        - hasAmendments: Boolean
        - originalVersion: Reference to original if found`,

      CONTACTS: `Extract contact information from this contract. Return JSON with:
        - contacts: Array of {name, role, organization, email, phone, address}
        - primaryContact: The main contact for each party
        - notificationAddresses: Where formal notices should be sent`,

      PARTIES: `Extract all parties mentioned in this contract. Return JSON with:
        - parties: Array of {name, role, type, jurisdiction, signatoryName}
        - relationships: Description of party relationships
        - partyRoles: Object mapping party names to their contractual roles
        Prefer the role labels used in the contract itself, such as Buyer or Supplier.`,

      TIMELINE: `Extract timeline information from this contract. Return JSON with:
        - effectiveDate: When contract begins
        - endDate: When contract ends
        - milestones: Array of {date, event, description}
        - keyDates: Array of important dates
        - duration: Total contract duration
        Use ISO dates when the contract provides exact dates.`,

      DELIVERABLES: `Extract deliverables from this contract. Return JSON with:
        - deliverables: Array of {name, description, party, deadline, acceptanceCriteria}
        - deliverySchedule: Timeline of deliverables
        - acceptanceProcess: How deliverables are accepted`,

      EXECUTIVE_SUMMARY: `Provide an executive summary of this contract. Return JSON with:
        - executiveSummary: 3-5 paragraph summary for executives
        - keyTakeaways: Array of critical points (max 5)
        - recommendations: Array of suggested actions
        - riskHighlights: Top risks to be aware of
        - valueProposition: Main value of this contract`,

      // Additional artifact types
      METADATA: `Extract metadata about this contract document. Return JSON with:
        - documentType: Type of contract
        - language: Primary language
        - jurisdiction: Governing law jurisdiction
        - confidentialityLevel: Public, Confidential, etc.
        - version: Document version if found`,
      
      SUMMARY: `Provide a comprehensive summary of this contract. Return JSON with:
        - summary: Detailed summary (5-10 sentences)
        - purpose: Main purpose of the contract
        - scope: What the contract covers`,
    };

    const prompt = prompts[type] || `Analyze the ${type} aspects of this contract and return relevant information as JSON.`;

    // Append detected table content for artifact types that benefit from structured data
    let tableContext = '';
    if (detectedTables && detectedTables.length > 0) {
      const tableTypes: ArtifactType[] = ['FINANCIAL', 'DELIVERABLES', 'TIMELINE', 'OBLIGATIONS', 'CONTACTS', 'PARTIES'];
      if (tableTypes.includes(type)) {
        const tablesStr = detectedTables.slice(0, 5).join('\n\n');
        tableContext = `\n\nThe following tables were detected in the document (preserve their structure in your analysis):\n${tablesStr}`;
      }
    }

    // Build the request once; retry on transient 429/5xx errors honoring
    // the Retry-After / retry-after-ms headers Azure OpenAI returns when the
    // per-minute token bucket is exhausted. Without this, generating ~14
    // artifacts in 5-wide batches reliably blows the gpt-4o TPM and the
    // last 2-3 artifacts (commonly PARTIES/TIMELINE) come back null.
    const callOpenAI = () => openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a contract analysis expert. Always respond with valid JSON only, no markdown or explanation. Prefer explicit facts from the contract. If a field is not clearly stated, return null or an empty array instead of guessing. Preserve full numeric values as numbers without truncation.${contractType && contractType !== 'OTHER' ? `\nThis document is a ${contractType.replace(/_/g, ' ')}. Focus your analysis on elements typical of this contract type.` : ''}${ocrConfidence !== undefined && ocrConfidence < 0.7 ? `\nWARNING: OCR text quality is low (${Math.round(ocrConfidence * 100)}% confidence). Be cautious with numbers, dates, and proper nouns. Flag any values you are uncertain about.` : ''}`,
        },
        {
          role: 'user',
          content: `${prompt}\n\n${groundingFacts}\n\nContract text:\n${truncatedText}${tableContext}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }, { signal: AbortSignal.timeout(60_000) });

    const MAX_RETRIES = 3;
    let response: Awaited<ReturnType<typeof callOpenAI>> | undefined;
    let lastErr: any;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        response = await callOpenAI();
        break;
      } catch (err: any) {
        lastErr = err;
        const status: number | undefined = err?.status ?? err?.response?.status;
        const isRateLimit = status === 429;
        const isServerErr = typeof status === 'number' && status >= 500 && status < 600;
        if (attempt === MAX_RETRIES || (!isRateLimit && !isServerErr)) {
          throw err;
        }
        // Honor Retry-After-Ms / Retry-After if present, otherwise exponential backoff with jitter.
        const headers = err?.headers || err?.response?.headers || {};
        const retryAfterMsRaw = headers['retry-after-ms'] ?? headers['Retry-After-Ms'];
        const retryAfterRaw = headers['retry-after'] ?? headers['Retry-After'];
        let waitMs = 0;
        if (retryAfterMsRaw) waitMs = Math.min(parseInt(String(retryAfterMsRaw), 10) || 0, 30_000);
        else if (retryAfterRaw) waitMs = Math.min((parseInt(String(retryAfterRaw), 10) || 0) * 1000, 30_000);
        if (waitMs <= 0) waitMs = Math.min(1000 * Math.pow(2, attempt), 15_000);
        waitMs += Math.floor(Math.random() * 500); // jitter
        logger.warn({ contractId, type, attempt: attempt + 1, status, waitMs }, 'AI call rate-limited/transient — retrying');
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    if (!response) throw lastErr ?? new Error('AI call failed without response');

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      _generated: new Date().toISOString(),
      _mode: 'ai',
      _model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      _contractId: contractId,
      _ocrConfidence: ocrConfidence,
    };
  } catch (error: any) {
    const status: number | undefined = error?.status ?? error?.response?.status;
    const reason = status === 429
      ? 'rate-limited (429) — retries exhausted'
      : status && status >= 500
        ? `upstream ${status}`
        : error?.message || 'unknown error';
    logger.error({ error, type, contractId, status, reason }, 'AI artifact generation failed');
    return null;
  }
}

// ── Artifact Validation ──
// Required fields per artifact type — if missing, artifact is flagged for review.
const ARTIFACT_REQUIRED_FIELDS: Partial<Record<ArtifactType, string[]>> = {
  OVERVIEW: ['summary'],
  CLAUSES: ['clauses'],
  FINANCIAL: ['amounts'],
  RISK: ['riskLevel', 'risks'],
  COMPLIANCE: ['complianceStatus'],
  OBLIGATIONS: ['obligations'],
  NEGOTIATION_POINTS: ['negotiationPoints'],
  AMENDMENTS: ['hasAmendments'],
  CONTACTS: ['contacts'],
  PARTIES: ['parties'],
  TIMELINE: ['keyDates'],
  DELIVERABLES: ['deliverables'],
  EXECUTIVE_SUMMARY: ['executiveSummary'],
};

/**
 * Validate artifact data has required fields for its type.
 * Returns list of issues (empty = valid).
 */
function validateArtifactData(type: ArtifactType, data: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const requiredFields = ARTIFACT_REQUIRED_FIELDS[type];
  if (requiredFields) {
    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null) {
        issues.push(`Missing required field: ${field}`);
      } else if (Array.isArray(value) && value.length === 0) {
        issues.push(`Empty array for required field: ${field}`);
      } else if (typeof value === 'string' && value.trim() === '') {
        issues.push(`Empty string for required field: ${field}`);
      }
    }
  }

  // Type-specific checks
  if (type === 'RISK' && data.riskLevel) {
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validLevels.includes(String(data.riskLevel).toUpperCase())) {
      issues.push(`Invalid riskLevel: ${data.riskLevel} (expected ${validLevels.join('|')})`);
    }
  }
  if (type === 'COMPLIANCE' && data.complianceStatus) {
    const validStatuses = ['COMPLIANT', 'NEEDS_REVIEW', 'NON_COMPLIANT'];
    if (!validStatuses.includes(String(data.complianceStatus).toUpperCase())) {
      issues.push(`Invalid complianceStatus: ${data.complianceStatus}`);
    }
  }
  if (type === 'FINANCIAL' && data.amounts && Array.isArray(data.amounts)) {
    for (const amt of data.amounts) {
      if (amt && typeof amt === 'object' && amt.value !== undefined && typeof amt.value !== 'number') {
        issues.push(`Financial amount value must be a number, got ${typeof amt.value}`);
      }
    }
  }
  if (type === 'TIMELINE' && data.keyDates && Array.isArray(data.keyDates)) {
    for (const d of data.keyDates) {
      if (d && typeof d === 'object' && d.date && isNaN(Date.parse(String(d.date)))) {
        issues.push(`Invalid date format in keyDates: ${d.date}`);
      }
    }
  }
  if (type === 'RENEWAL') {
    const hasRenewalTerms = typeof data.renewalTerms === 'string' && data.renewalTerms.trim() !== '';
    const hasAutoRenewalFlag = typeof data.autoRenewal === 'boolean';
    const hasNoticePeriod =
      (typeof data.noticePeriod === 'string' && data.noticePeriod.trim() !== '') ||
      (typeof data.noticePeriod === 'number' && Number.isFinite(data.noticePeriod)) ||
      (typeof data.noticePeriodDays === 'number' && Number.isFinite(data.noticePeriodDays));
    const hasExpiryDate =
      (typeof data.expirationDate === 'string' && data.expirationDate.trim() !== '') ||
      (typeof data.renewalDate === 'string' && data.renewalDate.trim() !== '');
    const hasTerminationOptions = Array.isArray(data.terminationOptions) && data.terminationOptions.length > 0;

    if (!hasRenewalTerms && !hasAutoRenewalFlag && !hasNoticePeriod && !hasExpiryDate && !hasTerminationOptions) {
      issues.push('Missing renewal and expiry details');
    }
  }

  return issues;
}

/**
 * Create or update an artifact in the database
 */
async function saveArtifact(
  prisma: PrismaClient,
  contractId: string,
  tenantId: string,
  type: ArtifactType,
  data: Record<string, any>
): Promise<string> {
  const now = new Date();
  
  // Validate artifact data has required fields for this type
  const issues = validateArtifactData(type, data);
  if (issues.length > 0) {
    logger.warn({ contractId, type, issues }, 'Artifact validation issues detected');
  }

  // Determine validation status: AI-generated artifacts with good OCR and no issues are 'valid'
  const ocrConf = typeof data._ocrConfidence === 'number' ? data._ocrConfidence : undefined;
  const isLowConfidence = ocrConf !== undefined && ocrConf < 0.7;
  const hasValidationIssues = issues.length > 0;
  const validationStatus = data._mode === 'ai' && !isLowConfidence && !hasValidationIssues ? 'valid' : 'needs_review';
  const confidenceValue = ocrConf !== undefined ? ocrConf : (data._mode === 'ai' ? 0.85 : 0.5);

  // Try to upsert the artifact
  const artifact = await prisma.artifact.upsert({
    where: {
      contractId_type: {
        contractId,
        type,
      },
    },
    create: {
      contractId,
      tenantId,
      type,
      data,
      confidence: confidenceValue,
      validationStatus,
      validationIssues: issues.length > 0 ? issues : [],
      modelUsed: data._model || null,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      data,
      confidence: confidenceValue,
      validationStatus,
      validationIssues: issues.length > 0 ? issues : [],
      modelUsed: data._model || null,
      updatedAt: now,
    },
  });

  return artifact.id;
}

/**
 * Main artifact generation function
 * Called by the legacy worker script
 */
export async function generateRealArtifacts(
  contractId: string,
  tenantId: string,
  filePath: string,
  mimeType: string,
  prisma: PrismaClient
): Promise<{ success: boolean; artifactsCreated: number; errors?: string[] }> {
  const errors: string[] = [];
  const artifactIds: string[] = [];
  const failedArtifactTypes: string[] = [];
  const startTime = performance.now();

  logger.info({ contractId, tenantId, filePath }, 'Starting artifact generation');

  try {
    // Update contract status to PROCESSING
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'PROCESSING' },
    });

    // Update processing job if exists
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'RUNNING',
        currentStep: 'extracting_text',
        progress: 10,
        startedAt: new Date(),
      },
    });

    // Determine actual file path
    let actualPath = filePath;
    let fileContent: Buffer | null = null;
    
    // Check if it's a relative path from storage (S3/MinIO path)
    if (!filePath.startsWith('/')) {
      // Try local uploads directory first — upload route saves a local copy here
      const localPath = path.join(process.cwd(), 'uploads', filePath);
      const webLocalPath = path.join(process.cwd(), 'apps', 'web', 'uploads', filePath);
      const rootLocalPath = path.join(process.cwd(), '..', '..', 'uploads', filePath);
      // Also check the "uploads/contracts/..." pattern used by upload route (process.cwd() is apps/web)
      const webCwdUploads = path.join(process.cwd(), 'uploads', 'contracts');
      // filePath looks like "contracts/acme/timestamp-file.pdf" — try stripping "contracts/" prefix
      const strippedPath = filePath.replace(/^contracts\//, '');
      const cwdStripped = path.join(process.cwd(), 'uploads', 'contracts', strippedPath);
      const rootStripped = path.join(process.cwd(), '..', '..', 'uploads', 'contracts', strippedPath);
      
      // Try paths in order of likelihood
      const pathsToTry = [
        { p: localPath, label: 'local uploads' },
        { p: cwdStripped, label: 'cwd uploads/contracts (stripped)' },
        { p: webLocalPath, label: 'web uploads' },
        { p: rootLocalPath, label: 'root uploads' },
        { p: rootStripped, label: 'root uploads/contracts (stripped)' },
      ];
      
      let found = false;
      for (const { p, label } of pathsToTry) {
        if (await fs.access(p).then(() => true).catch(() => false)) {
          actualPath = p;
          found = true;
          logger.info({ actualPath, label }, 'Found file locally');
          break;
        }
      }
      
      if (!found) {
        // File is in S3/MinIO - try to download it
        logger.info({ filePath }, 'File appears to be in S3/MinIO, attempting download');
        
        try {
          // Try to use the S3 client to download
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
          
          // Build the endpoint URL from components
          let endpoint = process.env.S3_ENDPOINT;
          if (!endpoint) {
            const minioHost = process.env.MINIO_ENDPOINT || 'localhost';
            const minioPort = process.env.MINIO_PORT || '9000';
            const useSSL = process.env.MINIO_USE_SSL === 'true';
            const protocol = useSSL ? 'https' : 'http';
            endpoint = `${protocol}://${minioHost}:${minioPort}`;
          }
          
          logger.info({ endpoint }, 'Using S3 endpoint');
          
          const isProduction = process.env.NODE_ENV === 'production';
          const accessKeyId = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
          const secretAccessKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
          
          // In production, require explicit credentials
          if (isProduction && (!accessKeyId || !secretAccessKey)) {
            throw new Error('S3/MinIO credentials required in production');
          }
          
          const s3Client = new S3Client({
            endpoint,
            region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
            credentials: {
              accessKeyId: accessKeyId || process.env.MINIO_ACCESS_KEY || '',
              secretAccessKey: secretAccessKey || process.env.MINIO_SECRET_KEY || '',
            },
            forcePathStyle: true, // Required for MinIO
          });
          
          const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'contracts';
          
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: filePath,
          });
          
          const response = await s3Client.send(command);
          
          if (response.Body) {
            const chunks: Buffer[] = [];
            // @ts-expect-error - Body is a Readable stream
            for await (const chunk of response.Body) {
              chunks.push(Buffer.from(chunk));
            }
            fileContent = Buffer.concat(chunks);
            logger.info({ filePath, size: fileContent.length }, 'Downloaded file from S3/MinIO');
          } else {
            throw new Error('No body in S3 response');
          }
        } catch (s3Error) {
          logger.error({ s3Error, filePath }, 'Failed to download from S3/MinIO');
          
          // Last resort - check contract record for storage path
          const contract = await prisma.contract.findUnique({
            where: { id: contractId },
            select: { storagePath: true, storageProvider: true },
          });
          
          if (contract?.storageProvider === 'local' && contract.storagePath) {
            actualPath = contract.storagePath;
            logger.info({ actualPath }, 'Using storage path from contract record');
          } else {
            throw new Error(`Cannot access file: ${filePath}. S3 download failed and no local fallback available.`);
          }
        }
      }
    }

    // Extract text from the file
    logger.info({ actualPath, mimeType, hasBuffer: !!fileContent }, 'Extracting text from file');
    const { text: rawExtractedText, diHandwriting: diHandwritingEvidence, ocrProvider, ocrModel } = fileContent 
      ? await extractTextFromBuffer(fileContent, filePath, mimeType)
      : await extractTextFromFile(actualPath, mimeType);
    
    if (!rawExtractedText || rawExtractedText.length < 10) {
      throw new Error('Failed to extract meaningful text from file');
    }

    // Preprocess: normalize whitespace, remove page numbers, preserve tables
    const { cleanedText: contractText, tables: detectedTables } = preprocessText(rawExtractedText);
    logger.info({ rawLength: rawExtractedText.length, cleanedLength: contractText.length, tablesDetected: detectedTables.length }, 'Text extracted and preprocessed');

    // For DOCX files, also convert to formatted HTML for the redline editor
    let docxHtml: string | null = null;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const buf = fileContent || await fs.readFile(actualPath);
        const mammoth = await import('mammoth');
        const htmlResult = await mammoth.convertToHtml({ buffer: buf });
        if (htmlResult.value && htmlResult.value.length > 20) {
          docxHtml = htmlResult.value;
          logger.info({ htmlChars: docxHtml.length }, 'DOCX converted to HTML for redline editor');
        }
      } catch (htmlErr) {
        logger.warn({ htmlErr }, 'DOCX→HTML conversion failed (non-critical, raw text still available)');
      }
    }

    // Persist raw text immediately so it's available for RAG and search
    // Also store formatted HTML in metadata for the redline editor
    const existingContract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { metadata: true, aiMetadata: true, fileName: true, originalName: true },
    });
    const existingMeta = (existingContract?.metadata as Record<string, unknown>) || {};
    const persistedOcrFacts = extractPersistedOcrFacts(existingContract?.aiMetadata);
    const updateData: Record<string, unknown> = {
      ...buildPersistedContractTextFields(contractText),
      ocrProcessedAt: new Date(),
      ...(ocrProvider ? { ocrProvider } : {}),
      ...(ocrModel ? { ocrModel } : {}),
    };
    if (docxHtml) {
      updateData.metadata = { ...existingMeta, docxHtml };
    }
    await prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    // Update progress
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        currentStep: 'generating_artifacts',
        progress: 30,
      },
    });

    const extractedContractFacts = mergeExtractedFactsWithMetadata(
      extractBasicFieldsFromText(contractText),
      persistedOcrFacts.metadata
    );
    let artifactGroundingFacts = extractedContractFacts;

    // ── Extract metadata FIRST so contractTitle is in DB before artifacts run ──
    logger.info({ contractId }, 'Extracting contract metadata (pre-artifact)');
    try {
      const preMetadata = await extractContractMetadata(contractText, contractId, extractedContractFacts);
      const preUpdateData: Record<string, any> = {};
      if (preMetadata.title) preUpdateData.contractTitle = preMetadata.title;
      if (preMetadata.contractType) preUpdateData.contractType = preMetadata.contractType;
      if (preMetadata.startDate) {
        const sd = new Date(preMetadata.startDate);
        if (!isNaN(sd.getTime())) preUpdateData.startDate = sd;
        else logger.warn({ contractId, value: preMetadata.startDate }, 'Invalid startDate from metadata extraction, skipped');
      }
      if (preMetadata.endDate) {
        const ed = new Date(preMetadata.endDate);
        if (!isNaN(ed.getTime())) preUpdateData.endDate = ed;
        else logger.warn({ contractId, value: preMetadata.endDate }, 'Invalid endDate from metadata extraction, skipped');
      }
      // Sanity: startDate should be before endDate
      if (preUpdateData.startDate && preUpdateData.endDate && preUpdateData.startDate > preUpdateData.endDate) {
        logger.warn({ contractId, startDate: preMetadata.startDate, endDate: preMetadata.endDate }, 'startDate is after endDate — both dates kept but flagged');
      }
      if (preMetadata.totalValue != null) {
        const tv = Number(preMetadata.totalValue);
        if (!isNaN(tv) && tv >= 0) {
          preUpdateData.totalValue = tv;
        } else {
          logger.warn({ contractId, value: preMetadata.totalValue }, 'Invalid totalValue from metadata extraction, skipped');
        }
      }
      if (preMetadata.currency) preUpdateData.currency = preMetadata.currency;
      if (preMetadata.clientName) preUpdateData.clientName = preMetadata.clientName;
      if (preMetadata.supplierName) preUpdateData.supplierName = preMetadata.supplierName;
      if (preMetadata.parties && preMetadata.parties.length > 0) {
        const validParties = preMetadata.parties.filter(p => p && p.trim().length > 1);
        if (!preUpdateData.clientName && validParties[0]) preUpdateData.clientName = validParties[0];
        if (!preUpdateData.supplierName && validParties[1] && validParties[1] !== validParties[0]) preUpdateData.supplierName = validParties[1];
      }
      if (preMetadata.signatureStatus) {
        preUpdateData.signatureStatus = preMetadata.signatureStatus;
        preUpdateData.signatureRequiredFlag = preMetadata.signatureStatus === 'unsigned' || preMetadata.signatureStatus === 'partially_signed';
      }
      // DI handwriting override: if Document Intelligence detected handwritten content
      // in a document that has signature-related context, treat as signed
      if (diHandwritingEvidence.hasHandwriting && (!preUpdateData.signatureStatus || preUpdateData.signatureStatus === 'unknown')) {
        logger.info({ contractId, handwrittenSpans: diHandwritingEvidence.handwrittenSpans.length }, 'DI detected handwritten content — overriding signature status to signed');
        preUpdateData.signatureStatus = 'signed';
        preUpdateData.signatureRequiredFlag = false;
      }
      if (preMetadata.signatureDate) {
        const sigDate = new Date(preMetadata.signatureDate);
        if (!isNaN(sigDate.getTime())) preUpdateData.signatureDate = sigDate;
      }

      // Mirror startDate -> effectiveDate and endDate -> expirationDate so callers
      // that read either column pair see the same value. (The schema carries both
      // legacy and modern date columns; only one was populated previously.)
      if (preUpdateData.startDate && !preUpdateData.effectiveDate) {
        preUpdateData.effectiveDate = preUpdateData.startDate;
      }
      if (preUpdateData.endDate && !preUpdateData.expirationDate) {
        preUpdateData.expirationDate = preUpdateData.endDate;
      }

      // ── Tiered document-type classification (filename → keyword → AI) ──
      // Always runs (zero AI dependency for tiers A+B). Persists confidence and
      // diagnostic metadata so callers can show a "type detected via X (Y%)"
      // affordance and audit drift between heuristic and AI guesses.
      try {
        const filenameForClassifier =
          existingContract?.originalName ||
          existingContract?.fileName ||
          path.basename(filePath || '');
        const docTypeResult = await classifyDocumentType(contractText, filenameForClassifier, {
          priorType: preMetadata.contractType ?? extractedContractFacts.contractType,
          priorConfidence: 0.3,
        });
        if (docTypeResult.type && docTypeResult.type !== 'OTHER') {
          // Only overwrite contractType when classifier is reasonably confident
          // OR when no contractType was detected by AI/regex at all.
          const aiOrRegexType = preUpdateData.contractType as string | undefined;
          if (!aiOrRegexType || docTypeResult.confidence >= 0.6) {
            preUpdateData.contractType = docTypeResult.type;
          }
        }
        preUpdateData.classificationConf = docTypeResult.confidence;
        preUpdateData.classifiedAt = new Date(docTypeResult.classifiedAt);
        // Mirror to the parallel `document*` columns consumed by the contract
        // detail API (`/api/contracts/[id]`) and chat-intelligence layer.
        preUpdateData.documentClassificationConf = docTypeResult.confidence;
        if (docTypeResult.type === 'OTHER' || docTypeResult.confidence < 0.4) {
          preUpdateData.documentClassificationWarning =
            `Document type uncertain (${docTypeResult.source}, confidence ${(docTypeResult.confidence * 100).toFixed(0)}%). Manual review recommended.`;
        }
        preUpdateData.classificationMeta = {
          method: 'real-artifact-generator-tiered',
          source: docTypeResult.source,
          reasoning: docTypeResult.reasoning,
          matchedKeywords: docTypeResult.matchedKeywords,
          tiersRun: docTypeResult.tiersRun,
          candidates: docTypeResult.candidates,
          aiPriorType: preMetadata.contractType ?? extractedContractFacts.contractType ?? null,
        };
      } catch (typeErr) {
        logger.warn({ typeErr, contractId }, 'Tiered document-type classification failed, falling back to AI/regex result');
      }

      if (Object.keys(preUpdateData).length > 0) {
        await prisma.contract.update({ where: { id: contractId }, data: preUpdateData });
        logger.info({ contractId, fields: Object.keys(preUpdateData) }, 'Pre-artifact metadata written');
      }
      artifactGroundingFacts = mergeExtractedFactsWithMetadata(extractedContractFacts, preMetadata);
    } catch (preMetaErr) {
      logger.warn({ preMetaErr, contractId }, 'Pre-artifact metadata extraction failed, continuing');
    }

    // Generate each artifact type
    const totalTypes = ARTIFACT_TYPES.length;
    let completed = 0;

    // Estimate OCR confidence from text quality heuristics
    // (When called from the worker pipeline, actual DI per-word confidence would be used instead)
    const resolvedOcrConfidence = persistedOcrFacts.ocrConfidence ?? estimateTextConfidence(contractText);
    if (persistedOcrFacts.ocrConfidence !== undefined) {
      logger.info({ contractId, confidence: resolvedOcrConfidence }, 'Using persisted OCR confidence from AI metadata');
    }
    if (resolvedOcrConfidence < 0.7) {
      logger.warn({ contractId, confidence: resolvedOcrConfidence }, 'Low OCR confidence detected — artifacts will be flagged for review');
    }

    // Query contract record (contractTitle now populated from pre-artifact metadata)
    const contractRecord = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { contractType: true, contractTitle: true },
    });
    const contractType = contractRecord?.contractType || 'OTHER';
    const contractTitle = contractRecord?.contractTitle || null;

    // Process artifacts in parallel batches for ~4x speed improvement
    const BATCH_SIZE = parseInt(process.env.ARTIFACT_BATCH_SIZE || '5', 10);
    for (let batchStart = 0; batchStart < ARTIFACT_TYPES.length; batchStart += BATCH_SIZE) {
      const batch = ARTIFACT_TYPES.slice(batchStart, batchStart + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (type) => {
          logger.info({ contractId, type }, `Generating ${type} artifact`);
          
          // AI generation is mandatory — no silent fallback to basic regex
          let artifactData = await generateAIArtifact(
            type,
            contractText,
            contractId,
            contractType,
            resolvedOcrConfidence,
            detectedTables,
            artifactGroundingFacts,
            contractTitle
          );
          
          if (!artifactData) {
            // generateAIArtifact already logs the upstream status (429, 5xx, etc.)
            // so callers can grep the warning trail. The thrown message stays
            // generic because we no longer assume "no data" means "missing key".
            throw new Error(`AI artifact generation returned no data for ${type} (see prior log for upstream status)`);
          }

          artifactData = repairArtifactData(type, artifactData, artifactGroundingFacts, contractTitle);

          // Save the artifact
          const artifactId = await saveArtifact(prisma, contractId, tenantId, type, artifactData);
          logger.info({ contractId, type, artifactId }, `${type} artifact saved`);
          return { type, artifactId };
        })
      );

      // Collect results from this batch
      for (const result of results) {
        if (result.status === 'fulfilled') {
          artifactIds.push(result.value.artifactId);
        } else {
          const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          const failedType = batch[results.indexOf(result)] || 'unknown';
          logger.error({ error: errorMsg, type: failedType, contractId }, `Failed to generate ${failedType} artifact`);
          errors.push(`${failedType}: ${errorMsg}`);
          failedArtifactTypes.push(failedType);
        }
      }

      completed += batch.length;
      const progress = 30 + Math.floor((completed / totalTypes) * 60);

      // Heartbeat: touch contract.updatedAt so auto-resolve doesn't fire mid-processing
      await prisma.contract.update({
        where: { id: contractId },
        data: { updatedAt: new Date() },
      });
      
      await prisma.processingJob.updateMany({
        where: { contractId, tenantId },
        data: { 
          currentStep: `artifact_batch_${Math.ceil(completed / BATCH_SIZE)}`,
          progress,
        },
      });
    }

    // Metadata was already extracted before the artifact loop.
    // Update progress to reflect completion of metadata step.
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        currentStep: 'extracting_metadata',
        progress: 92,
      },
    });

    // ── Artifact → Contract scalar mirror ─────────────────────────────────────
    // The Contract row has scalar columns (paymentTerms, jurisdiction, renewalTerms,
    // noticePeriodDays, terminationClause, autoRenewalEnabled) that the contracts
    // list / details UI binds to directly. Without this pass those columns stay
    // NULL even though the FINANCIAL/COMPLIANCE/RENEWAL artifacts already contain
    // the data — so the UI shows "Not specified" while the artifacts page shows
    // rich answers. This mirror only fills NULL fields; it never overwrites
    // values the user has manually edited.
    if (artifactIds.length > 0) {
      try {
        const mirrorArtifacts = await prisma.artifact.findMany({
          where: { contractId, type: { in: ['FINANCIAL', 'COMPLIANCE', 'RENEWAL', 'OVERVIEW', 'TIMELINE'] } },
          select: { type: true, data: true },
        });
        const byType = new Map(mirrorArtifacts.map((a) => [a.type, a.data as Record<string, unknown>]));
        const fin = byType.get('FINANCIAL') || {};
        const comp = byType.get('COMPLIANCE') || {};
        const ren = byType.get('RENEWAL') || {};
        const ovr = byType.get('OVERVIEW') || {};
        const tml = byType.get('TIMELINE') || {};

        const current = await prisma.contract.findUnique({
          where: { id: contractId },
          select: {
            paymentTerms: true,
            jurisdiction: true,
            renewalTerms: true,
            noticePeriodDays: true,
            terminationClause: true,
            autoRenewalEnabled: true,
            billingCycle: true,
            description: true,
            effectiveDate: true,
            expirationDate: true,
            endDate: true,
            keywords: true,
            totalValue: true,
          },
        });

        const mirror: Record<string, unknown> = {};
        const asStr = (v: unknown): string | null => {
          if (typeof v === 'string' && v.trim().length > 0) return v.trim();
          return null;
        };
        const asInt = (v: unknown): number | null => {
          if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
          if (typeof v === 'string') {
            const m = v.match(/(\d+)/);
            if (m) return parseInt(m[1], 10);
          }
          return null;
        };

        if (!current?.paymentTerms) {
          const pt = asStr(fin.paymentTerms);
          if (pt) mirror.paymentTerms = pt.slice(0, 500);
        }
        if (!current?.billingCycle) {
          const bf = asStr((fin as Record<string, unknown>).billingFrequency);
          if (bf) mirror.billingCycle = bf.slice(0, 50);
        }
        if (!current?.jurisdiction) {
          const j = asStr((comp as Record<string, unknown>).jurisdiction);
          if (j) mirror.jurisdiction = j.slice(0, 200);
        }
        if (!current?.renewalTerms) {
          const rt = asStr(ren.renewalTerms);
          if (rt) mirror.renewalTerms = { description: rt.slice(0, 1000), source: 'artifact:RENEWAL' };
        }
        if (current?.noticePeriodDays == null) {
          const npd = asInt((ren as Record<string, unknown>).noticePeriodDays) ?? asInt(ren.noticePeriod);
          if (npd != null && npd > 0 && npd < 3650) mirror.noticePeriodDays = npd;
        }
        if (!current?.terminationClause) {
          const tc = asStr((ren as Record<string, unknown>).terminationClause);
          if (tc) mirror.terminationClause = tc.slice(0, 1000);
        }
        if (current?.autoRenewalEnabled !== true) {
          const ar = (ren as Record<string, unknown>).autoRenewal;
          if (typeof ar === 'boolean') mirror.autoRenewalEnabled = ar;
        }

        // OVERVIEW.summary → Contract.description (rich human-readable summary
        // shown on the contract details page when no manual description exists).
        if (!current?.description) {
          const summary = asStr((ovr as Record<string, unknown>).summary);
          if (summary) mirror.description = summary.slice(0, 2000);
        }

        // TIMELINE → expirationDate / endDate. The artifact often supplies
        // an `effectiveDate` plus a `duration` string ("12 months", "1 year",
        // "30 days") instead of an explicit endDate, so compute it.
        const parseDuration = (v: unknown): { months: number } | null => {
          const s = asStr(v);
          if (!s) return null;
          const m = s.match(/(\d+)\s*(year|yr|month|mo|day|week|wk)s?/i);
          if (!m) return null;
          const n = parseInt(m[1], 10);
          const unit = m[2].toLowerCase();
          if (unit.startsWith('year') || unit === 'yr') return { months: n * 12 };
          if (unit.startsWith('month') || unit === 'mo') return { months: n };
          if (unit.startsWith('week') || unit === 'wk') return { months: n / 4.345 };
          if (unit.startsWith('day')) return { months: n / 30.44 };
          return null;
        };
        const parseDate = (v: unknown): Date | null => {
          const s = asStr(v);
          if (!s) return null;
          const d = new Date(s);
          return isNaN(d.getTime()) ? null : d;
        };
        let computedEnd: Date | null = parseDate((tml as Record<string, unknown>).endDate);
        if (!computedEnd) {
          const eff = current?.effectiveDate || parseDate((tml as Record<string, unknown>).effectiveDate);
          const dur = parseDuration((tml as Record<string, unknown>).duration);
          if (eff && dur) {
            const d = new Date(eff);
            // Approximate month-add via setMonth which handles overflow correctly.
            d.setMonth(d.getMonth() + Math.round(dur.months));
            computedEnd = d;
          }
        }
        if (computedEnd && !current?.expirationDate) mirror.expirationDate = computedEnd;
        if (computedEnd && !current?.endDate) mirror.endDate = computedEnd;

        // OVERVIEW.keyPoints → Contract.keywords (jsonb). Used by the search
        // facets and "topics" chips on the contract detail page.
        if (!current?.keywords || (Array.isArray(current.keywords) && current.keywords.length === 0)) {
          const kp = (ovr as Record<string, unknown>).keyPoints;
          if (Array.isArray(kp) && kp.length > 0) {
            const kw = kp
              .map((k) => (typeof k === 'string' ? k.trim() : ''))
              .filter((k) => k.length > 0 && k.length <= 200)
              .slice(0, 20);
            if (kw.length > 0) mirror.keywords = kw;
          }
        }

        // FINANCIAL → Contract.totalValue. Only mirror when the artifact
        // surfaced a single explicit aggregate value (not a rate-card array).
        if (current?.totalValue == null) {
          const tv = (fin as Record<string, unknown>).totalValue;
          const n = typeof tv === 'number' ? tv : (typeof tv === 'string' ? parseFloat(tv) : NaN);
          if (Number.isFinite(n) && n > 0 && n < 1e12) mirror.totalValue = n;
        }

        // Compute daysUntilExpiry from the resolved end date (mirror or current).
        // Cached for performance; index `[tenantId, daysUntilExpiry]` exists for
        // upcoming-expiration queries on the dashboard.
        const resolvedExp = (mirror.expirationDate as Date | undefined) ?? current?.expirationDate ?? (mirror.endDate as Date | undefined) ?? current?.endDate;
        if (resolvedExp instanceof Date && !isNaN(resolvedExp.getTime())) {
          const days = Math.round((resolvedExp.getTime() - Date.now()) / 86400000);
          mirror.daysUntilExpiry = days;
        }

        if (Object.keys(mirror).length > 0) {
          await prisma.contract.update({ where: { id: contractId }, data: mirror });
          logger.info({ contractId, mirroredFields: Object.keys(mirror) }, 'Mirrored artifact data to Contract scalars');
        }
      } catch (mirrorErr) {
        logger.warn({ mirrorErr, contractId }, 'Artifact→Contract mirror failed (non-fatal)');
      }

      // ── PARTIES → Contract.clientId / Contract.supplierId ──────────────
      // Same idea as the scalar mirror above but for the relational links.
      // Find-or-create global Party rows from the PARTIES artifact, never
      // overwriting manual links the user may already have set.
      try {
        const partiesArt = await prisma.artifact.findFirst({
          where: { contractId, type: 'PARTIES' },
          select: { data: true },
        });
        if (partiesArt?.data) {
          await linkPartiesToContract({ contractId, partiesArtifactData: partiesArt.data });
        }
      } catch (linkErr) {
        logger.warn({ linkErr, contractId }, 'Party linking failed (non-fatal)');
      }
    }

    // Auto-categorize the contract using AI after artifacts are generated
    if (artifactIds.length > 0) {
      try {
        // Make sure the tenant has a taxonomy seeded — first-time tenants
        // otherwise hit "No taxonomy categories defined for tenant" and never
        // get a category assigned.
        await ensureTenantTaxonomy(tenantId);
        logger.info({ contractId }, 'Running inline auto-categorization');
        const catResult = await categorizeContract({
          contractId,
          tenantId,
          forceRecategorize: false,
        });
        if (catResult.success) {
          logger.info({ contractId, category: catResult.category, confidence: catResult.confidence }, 'Auto-categorization completed');
        } else {
          logger.warn({ contractId, error: catResult.error }, 'Auto-categorization returned no match');
        }
      } catch (catErr) {
        logger.warn({ catErr, contractId }, 'Inline auto-categorization failed, continuing');
      }
    }

    // Determine final status
    const finalStatus = artifactIds.length > 0 ? 'COMPLETED' : 'FAILED';

    // Surface partial-failure metadata so the UI can flag "13/14 artifacts"
    // instead of silently treating partial success as fully COMPLETED.
    let mergedMetadata: Record<string, unknown> | undefined;
    try {
      const existing = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { metadata: true },
      });
      const base = (existing?.metadata as Record<string, unknown> | null) ?? {};
      mergedMetadata = {
        ...base,
        artifactsGenerated: artifactIds.length,
        artifactsExpected: ARTIFACT_TYPES.length,
        failedArtifactTypes: failedArtifactTypes.slice().sort(),
        partialFailure: failedArtifactTypes.length > 0,
        lastArtifactRunAt: new Date().toISOString(),
      };
    } catch (metaReadErr) {
      logger.warn({ metaReadErr, contractId }, 'Failed to read existing metadata for partial-failure flag');
    }

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: finalStatus,
        updatedAt: new Date(),
        // Provenance: stamp processing/analysis timestamps so the contracts
        // list and analytics views can show "last analyzed" without needing
        // to join ProcessingJob.
        ...(finalStatus === 'COMPLETED'
          ? { processedAt: new Date(), lastAnalyzedAt: new Date() }
          : {}),
        ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
      },
    });

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        currentStep: 'complete',
        progress: 100,
        completedAt: new Date(),
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    if (finalStatus === 'COMPLETED') {
      try {
        const reindex = await queueContractReindex(contractId, tenantId);
        logger.info({ contractId, queued: reindex.queued, message: reindex.message }, 'Queued contract reindex after artifact generation');
      } catch (reindexError) {
        logger.warn({ contractId, reindexError }, 'Post-artifact reindex trigger failed');
      }

      // Outbound contract.processed webhook (non-blocking).
      import('@/lib/webhook-triggers')
        .then(({ triggerContractProcessed }) =>
          triggerContractProcessed(tenantId, contractId, {
            artifactsCreated: artifactIds.length,
          }),
        )
        .catch(() => {});

      // Durable event log
      import('@/lib/events/integration-events')
        .then(({ recordIntegrationEvent }) =>
          recordIntegrationEvent({
            tenantId,
            eventType: 'contract.processed',
            resourceId: contractId,
            payload: {
              contractId,
              artifactsCreated: artifactIds.length,
            },
          }),
        )
        .catch(() => {});
    }

    const totalDurationMs = Math.round(performance.now() - startTime);
    logger.info({ 
      contractId, 
      artifactsCreated: artifactIds.length,
      errors: errors.length,
      status: finalStatus,
      durationMs: totalDurationMs,
      durationSec: (totalDurationMs / 1000).toFixed(1),
    }, `Artifact generation completed in ${(totalDurationMs / 1000).toFixed(1)}s`);

    return {
      success: artifactIds.length > 0,
      artifactsCreated: artifactIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const totalDurationMs = Math.round(performance.now() - startTime);
    logger.error({ error: errorMsg, contractId, durationMs: totalDurationMs }, `Artifact generation failed after ${(totalDurationMs / 1000).toFixed(1)}s`);

    // Update contract status to FAILED
    await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: 'FAILED',
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'FAILED',
        currentStep: 'failed',
        progress: 100,
        completedAt: new Date(),
        error: errorMsg,
      },
    }).catch(() => {});

    return {
      success: false,
      artifactsCreated: 0,
      errors: [errorMsg],
    };
  }
}

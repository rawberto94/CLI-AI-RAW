export interface UploadMetadataConfidence {
  value?: number;
  source?: string;
  needsVerification?: boolean;
  message?: string;
}

export interface UploadMetadataParty {
  legalName?: string;
  role?: string;
  [key: string]: unknown;
}

export interface UploadMetadataReviewPayload {
  metadata?: {
    document_title?: string;
    document_classification?: string;
    document_classification_confidence?: number;
    document_classification_warning?: string;
    external_parties?: UploadMetadataParty[];
    start_date?: string;
    end_date?: string | null;
    tcv_amount?: number | string;
    currency?: string;
    jurisdiction?: string;
    _field_confidence?: Record<string, UploadMetadataConfidence | number>;
  };
  data?: {
    contractType?: string | null;
    clientName?: string | null;
    supplierName?: string | null;
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type UploadMetadataReviewFieldKey =
  | 'document_title'
  | 'document_classification'
  | 'contractType'
  | 'clientName'
  | 'supplierName'
  | 'start_date'
  | 'end_date'
  | 'tcv_amount'
  | 'currency'
  | 'jurisdiction';

export interface UploadMetadataReviewField {
  key: UploadMetadataReviewFieldKey;
  label: string;
  value: string;
  confidence: number | null;
  reason: 'title-review' | 'missing' | 'low-confidence';
}

export interface UploadMetadataReviewDraft {
  document_title: string;
  document_classification: string;
  contractType: string;
  clientName: string;
  supplierName: string;
  start_date: string;
  end_date: string;
  tcv_amount: string;
  currency: string;
  jurisdiction: string;
}

const REVIEW_CONFIDENCE_THRESHOLD = 0.8;
const CONTRACT_LIKE_CLASSIFICATIONS = new Set([
  'contract',
  'amendment',
  'addendum',
  'purchase_order',
  'work_order',
]);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function unwrapUploadMetadataReviewPayload(payload: unknown): UploadMetadataReviewPayload {
  let current = payload;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isObjectRecord(current)) return {};

    if ('metadata' in current) {
      return current as UploadMetadataReviewPayload;
    }

    if (current.success === true && isObjectRecord(current.data)) {
      current = current.data;
      continue;
    }

    break;
  }

  if (isObjectRecord(current) && ('metadata' in current || 'data' in current)) {
    return current as UploadMetadataReviewPayload;
  }

  return isObjectRecord(current)
    ? { data: current as UploadMetadataReviewPayload['data'] }
    : {};
}

function normalizeComparisonText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeConfidence(value: UploadMetadataConfidence | number | undefined): number | null {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return value > 1 ? Math.min(value / 100, 1) : Math.min(Math.max(value, 0), 1);
  }

  if (!value || typeof value.value !== 'number' || Number.isNaN(value.value)) {
    return null;
  }

  return value.value > 1 ? Math.min(value.value / 100, 1) : Math.min(Math.max(value.value, 0), 1);
}

function findPartyByRole(parties: UploadMetadataParty[] | undefined, rolePatterns: RegExp[]): string {
  if (!Array.isArray(parties)) return '';

  for (const party of parties) {
    const role = normalizeText(party.role);
    if (!role) continue;

    if (rolePatterns.some((pattern) => pattern.test(role))) {
      return normalizeText(party.legalName);
    }
  }

  return '';
}

function shouldPromptForTitle(documentTitle: string, uploadedFileName: string): boolean {
  if (!documentTitle) return true;
  if (!uploadedFileName) return false;

  return normalizeComparisonText(documentTitle) === normalizeComparisonText(uploadedFileName);
}

function needsReview(value: string, confidence: number | null): 'missing' | 'low-confidence' | null {
  if (!value) return 'missing';
  if (confidence !== null && confidence < REVIEW_CONFIDENCE_THRESHOLD) {
    return 'low-confidence';
  }
  return null;
}

function isUnknownContractType(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return !normalized || normalized === 'unknown';
}

function isClassificationLowConfidence(
  classification: string,
  confidence: number | null,
  warning: string,
): boolean {
  if (!classification || classification === 'unknown') return true;
  if (warning) return true;
  return confidence !== null && confidence < REVIEW_CONFIDENCE_THRESHOLD;
}

function shouldReviewContractType(classification: string, contractType: string, classificationNeedsReview: boolean): boolean {
  if (!CONTRACT_LIKE_CLASSIFICATIONS.has(classification)) return false;
  return classificationNeedsReview || isUnknownContractType(contractType);
}

export function createUploadMetadataReviewDraft(
  payload: UploadMetadataReviewPayload,
  uploadedFileName: string,
): UploadMetadataReviewDraft {
  const metadata = payload.metadata || {};
  const parties = metadata.external_parties;
  const documentClassification = normalizeText(metadata.document_classification).toLowerCase() || 'unknown';

  return {
    document_title: normalizeText(metadata.document_title) || normalizeText(uploadedFileName),
    document_classification: documentClassification,
    contractType: normalizeText(payload.data?.contractType),
    clientName:
      normalizeText(payload.data?.clientName) ||
      findPartyByRole(parties, [/client/i, /buyer/i, /customer/i]),
    supplierName:
      normalizeText(payload.data?.supplierName) ||
      findPartyByRole(parties, [/supplier/i, /vendor/i, /provider/i, /service provider/i, /contractor/i]),
    start_date: normalizeText(metadata.start_date),
    end_date: normalizeText(metadata.end_date),
    tcv_amount:
      metadata.tcv_amount === null || metadata.tcv_amount === undefined
        ? ''
        : String(metadata.tcv_amount).trim(),
    currency: normalizeText(metadata.currency),
    jurisdiction: normalizeText(metadata.jurisdiction),
  };
}

export function buildUploadMetadataReviewFields(
  payload: UploadMetadataReviewPayload,
  uploadedFileName: string,
): UploadMetadataReviewField[] {
  const draft = createUploadMetadataReviewDraft(payload, uploadedFileName);
  const confidence = payload.metadata?._field_confidence || {};
  const fields: UploadMetadataReviewField[] = [];
  const classificationWarning = normalizeText(payload.metadata?.document_classification_warning);

  const titleConfidence = normalizeConfidence(confidence.document_title);
  const promptForTitle = shouldPromptForTitle(draft.document_title, uploadedFileName);

  if (promptForTitle) {
    fields.push({
      key: 'document_title',
      label: 'Contract title',
      value: draft.document_title,
      confidence: titleConfidence,
      reason: 'title-review',
    });
  }

  const classificationConfidence = normalizeConfidence(
    confidence.document_classification ?? payload.metadata?.document_classification_confidence,
  );
  const classificationNeedsReview = isClassificationLowConfidence(
    draft.document_classification,
    classificationConfidence,
    classificationWarning,
  );

  if (classificationNeedsReview) {
    fields.push({
      key: 'document_classification',
      label: 'Document classification',
      value: draft.document_classification,
      confidence: classificationConfidence,
      reason: draft.document_classification === 'unknown' ? 'missing' : 'low-confidence',
    });
  }

  if (shouldReviewContractType(draft.document_classification, draft.contractType, classificationNeedsReview)) {
    fields.push({
      key: 'contractType',
      label: 'Contract type',
      value: draft.contractType,
      confidence: normalizeConfidence(confidence.contractType),
      reason: isUnknownContractType(draft.contractType) ? 'missing' : 'low-confidence',
    });
  }

  const candidates: Array<{ key: Exclude<UploadMetadataReviewFieldKey, 'document_title' | 'document_classification' | 'contractType'>; label: string; value: string; confidenceKey?: string }> = [
    { key: 'clientName', label: 'Client / buyer', value: draft.clientName, confidenceKey: 'clientName' },
    { key: 'supplierName', label: 'Supplier / vendor', value: draft.supplierName, confidenceKey: 'supplierName' },
    { key: 'start_date', label: 'Effective date', value: draft.start_date, confidenceKey: 'start_date' },
    { key: 'end_date', label: 'Expiration date', value: draft.end_date, confidenceKey: 'end_date' },
    { key: 'tcv_amount', label: 'Total contract value', value: draft.tcv_amount, confidenceKey: 'tcv_amount' },
    { key: 'currency', label: 'Currency', value: draft.currency, confidenceKey: 'currency' },
    { key: 'jurisdiction', label: 'Governing law / jurisdiction', value: draft.jurisdiction, confidenceKey: 'jurisdiction' },
  ];

  for (const candidate of candidates) {
    const candidateConfidence = normalizeConfidence(
      candidate.confidenceKey ? confidence[candidate.confidenceKey] : undefined,
    );
    const reason = needsReview(candidate.value, candidateConfidence);

    if (!reason) continue;

    fields.push({
      key: candidate.key,
      label: candidate.label,
      value: candidate.value,
      confidence: candidateConfidence,
      reason,
    });
  }

  return fields;
}

export function mergeReviewedParties(
  existingParties: UploadMetadataParty[] | undefined,
  clientName: string,
  supplierName: string,
): UploadMetadataParty[] | undefined {
  const next = Array.isArray(existingParties) ? [...existingParties] : [];

  const upsertParty = (rolePatterns: RegExp[], roleLabel: string, legalName: string) => {
    const normalizedName = normalizeText(legalName);
    if (!normalizedName) return;

    const existingIndex = next.findIndex((party) => {
      const role = normalizeText(party.role);
      return rolePatterns.some((pattern) => pattern.test(role));
    });

    if (existingIndex >= 0) {
      next[existingIndex] = {
        ...next[existingIndex],
        legalName: normalizedName,
      };
      return;
    }

    next.push({
      legalName: normalizedName,
      role: roleLabel,
    });
  };

  upsertParty([/client/i, /buyer/i, /customer/i], 'Client', clientName);
  upsertParty([/supplier/i, /vendor/i, /provider/i, /service provider/i, /contractor/i], 'Service Provider', supplierName);

  return next.length > 0 ? next : undefined;
}
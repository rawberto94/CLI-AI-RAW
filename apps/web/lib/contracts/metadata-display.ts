/**
 * Shared helpers for resolving display metadata on the contract detail page.
 * Keeps artifact-derived fallbacks and persisted DB values aligned.
 */

const FILENAME_TITLE_PATTERN = /\.(pdf|docx?|txt|md|csv|json|xml|rtf|html?)$/i;

export function isFilenameLikeTitle(value: string | null | undefined): boolean {
  if (!value) return false;
  return FILENAME_TITLE_PATTERN.test(value.trim());
}

export function titleFromSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const match = summary.match(/^This\s+([^,]+?),/i);
  return match?.[1]?.trim() || null;
}

export function resolveDocumentTitle(
  candidates: Array<string | null | undefined>,
): string {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized || isFilenameLikeTitle(normalized)) continue;
    return normalized;
  }
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized) return normalized;
  }
  return '';
}

/** Stored classification, or `unknown` — never invent `contract`. */
export function resolveDocumentClassification(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : '';
    if (value) return value;
  }
  return 'unknown';
}

export function isEmptyMetadataValue(value: unknown): boolean {
  return (
    value === undefined
    || value === null
    || value === ''
    || (Array.isArray(value) && value.length === 0)
  );
}

export function extractNoticePeriodFromText(
  ...sources: Array<string | null | undefined>
): string {
  for (const source of sources) {
    if (!source) continue;
    const match = source.match(/(\d+)\s*[- ]?\s*day[s]?\s+notice/i);
    if (match) return `${match[1]} days`;
  }
  return '';
}

export function inferPaymentTypeFromTerms(paymentTerms: string): string {
  const terms = paymentTerms.toLowerCase();
  if (!terms) return '';
  if (terms.includes('milestone')) return 'milestone';
  if (terms.includes('time') || terms.includes('hourly')) return 'time_and_material';
  if (terms.includes('subscription')) return 'subscription';
  if (terms.includes('retainer')) return 'retainer';
  if (terms.includes('fixed') || terms.includes('lump')) return 'fixed_price';
  if (terms.includes('invoice') || terms.includes('per unit') || terms.includes('payment')) {
    return 'fixed_price';
  }
  return '';
}

export function inferBillingFromSchedule(
  schedule: unknown,
): { billing_frequency_type: string; periodicity: string } {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return { billing_frequency_type: '', periodicity: '' };
  }
  const len = schedule.length;
  if (len === 1) return { billing_frequency_type: 'one_off', periodicity: 'on_delivery' };
  if (len === 4) return { billing_frequency_type: 'recurring', periodicity: 'quarterly' };
  if (len === 12) return { billing_frequency_type: 'recurring', periodicity: 'monthly' };
  return { billing_frequency_type: 'recurring', periodicity: 'other' };
}

export function enrichCommercialFieldsFromArtifacts(
  metadata: Record<string, unknown>,
  overviewData?: Record<string, unknown> | null,
  financialData?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next = { ...metadata };

  if (isEmptyMetadataValue(next.jurisdiction) && overviewData?.jurisdiction) {
    next.jurisdiction = overviewData.jurisdiction;
  }

  const paymentTerms = String(financialData?.paymentTerms ?? '');
  if (isEmptyMetadataValue(next.payment_type) && paymentTerms) {
    next.payment_type = inferPaymentTypeFromTerms(paymentTerms);
  }

  if (financialData?.paymentSchedule) {
    const billing = inferBillingFromSchedule(financialData.paymentSchedule);
    if (isEmptyMetadataValue(next.billing_frequency_type) && billing.billing_frequency_type) {
      next.billing_frequency_type = billing.billing_frequency_type;
    }
    if (isEmptyMetadataValue(next.periodicity) && billing.periodicity) {
      next.periodicity = billing.periodicity;
    }
  }

  const notice = extractNoticePeriodFromText(
    String(next.notice_period ?? ''),
    String(next.contract_short_description ?? ''),
    String(overviewData?.summary ?? ''),
    paymentTerms,
  );
  if (isEmptyMetadataValue(next.notice_period) && notice) {
    next.notice_period = notice;
    const days = Number.parseInt(notice, 10);
    if (Number.isFinite(days)) next.notice_period_days = days;
  }

  return next;
}

const UI_ONLY_METADATA_KEYS = new Set([
  'tcvProvenance',
  'tcvDrift',
  '_criticalFields',
  '_field_confidence',
  '_fieldValidations',
  '_fields_needing_verification',
  '_extraction_confidence',
  '_extracted_at',
  '_extraction_model',
]);

/** Payload for PUT /metadata — drops UI-only keys and placeholder zeros. */
export function toPersistableMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!key || key.startsWith('_') || UI_ONLY_METADATA_KEYS.has(key)) continue;
    if (key === 'tcv_amount' && (value === 0 || value === '0')) {
      out[key] = null;
      continue;
    }
    if (
      (key === 'reminder_days_before_end' || key === 'notice_period_days')
      && (value === '' || value === undefined)
    ) {
      out[key] = null;
      continue;
    }
    out[key] = value;
  }
  if (typeof out.notice_period === 'string' && (out.notice_period_days == null || out.notice_period_days === '')) {
    const days = Number.parseInt(out.notice_period, 10);
    if (Number.isFinite(days) && days > 0) out.notice_period_days = days;
  }
  return out;
}

export function mergePersistedMetadata<T extends Record<string, unknown>>(
  derived: T,
  persisted: Partial<T> | null | undefined,
): T {
  if (!persisted) return derived;
  const merged = { ...derived };
  for (const [key, value] of Object.entries(persisted)) {
    if (isEmptyMetadataValue(value)) continue;
    if (key === 'document_title' && isFilenameLikeTitle(String(value))) {
      const derivedTitle = String(merged.document_title ?? '');
      if (derivedTitle && !isFilenameLikeTitle(derivedTitle)) continue;
    }
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}
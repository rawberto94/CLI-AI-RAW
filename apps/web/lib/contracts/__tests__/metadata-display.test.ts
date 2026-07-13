import { describe, expect, it } from 'vitest';

import {
  enrichCommercialFieldsFromArtifacts,
  extractNoticePeriodFromText,
  inferPaymentTypeFromTerms,
  isFilenameLikeTitle,
  mergePersistedMetadata,
  resolveDocumentTitle,
  titleFromSummary,
} from '../metadata-display';

describe('metadata-display', () => {
  it('detects filename-like titles', () => {
    expect(isFilenameLikeTitle('realistic_contract_v4.pdf')).toBe(true);
    expect(isFilenameLikeTitle('Supplier Agreement')).toBe(false);
  });

  it('resolves a human title over a filename', () => {
    expect(resolveDocumentTitle([
      'realistic_contract_v4.pdf',
      'Supplier Agreement',
      'realistic_contract_v4.pdf',
    ])).toBe('Supplier Agreement');
  });

  it('extracts a title from the summary lead-in', () => {
    expect(titleFromSummary(
      "This Supplier Agreement, effective April 1, 2026, is between Alpine Retail AG and Nordic Components GmbH.",
    )).toBe('Supplier Agreement');
  });

  it('infers payment and notice fields from artifacts', () => {
    const enriched = enrichCommercialFieldsFromArtifacts(
      { payment_type: '', notice_period: '' },
      { jurisdiction: 'Switzerland', summary: 'Includes a 90-day notice period for termination.' },
      {
        paymentTerms: 'Buyer shall pay all undisputed invoices within 30 days after receipt of invoice.',
        paymentSchedule: [{ amount: 92500 }],
      },
    );

    expect(enriched.payment_type).toBe('fixed_price');
    expect(enriched.billing_frequency_type).toBe('one_off');
    expect(enriched.periodicity).toBe('on_delivery');
    expect(enriched.notice_period).toBe('90 days');
    expect(enriched.jurisdiction).toBe('Switzerland');
  });

  it('extracts notice periods from free text', () => {
    expect(extractNoticePeriodFromText('Either party may terminate with 90-day notice.')).toBe('90 days');
  });

  it('infers fixed-price payment terms from invoice language', () => {
    expect(inferPaymentTypeFromTerms('Pay all undisputed invoices within 30 days.')).toBe('fixed_price');
  });

  it('keeps a derived human title when persisted metadata only has a filename', () => {
    const merged = mergePersistedMetadata(
      { document_title: 'Supplier Agreement', payment_type: 'fixed_price' },
      { document_title: 'realistic_contract_v4.pdf', payment_type: '' },
    );

    expect(merged.document_title).toBe('Supplier Agreement');
    expect(merged.payment_type).toBe('fixed_price');
  });
});
import { describe, expect, it } from 'vitest';

import { CONTRACT_METADATA_FIELDS, fieldNeedsAttention, getFieldsNeedingAttention } from '../contract-metadata-schema';

describe('getFieldsNeedingAttention', () => {
  it('does not flag populated warning fields that are already acceptable', () => {
    const flagged = getFieldsNeedingAttention({
      document_classification: 'contract',
      reminder_enabled: true,
      currency: 'CHF',
      reminder_days_before_end: 60,
      signature_required_flag: false,
      signature_status: 'signed',
      signature_date: '2026-04-01',
      document_title: 'Supplier Agreement',
      external_parties: [{ legalName: 'Buyer' }],
      tcv_amount: 92500,
      payment_type: 'fixed_price',
      billing_frequency_type: 'one_off',
      periodicity: 'on_delivery',
      jurisdiction: 'Switzerland',
      start_date: '2026-04-01',
      notice_period: '90 days',
      contract_owner_user_ids: [],
      access_group_ids: [],
    });

    expect(flagged.map((field) => field.key)).toEqual([]);
  });

  it('flags unknown signature status and missing commercial required fields', () => {
    const flagged = getFieldsNeedingAttention({
      currency: 'CHF',
      signature_status: 'unknown',
      payment_type: '',
      billing_frequency_type: '',
      periodicity: '',
      notice_period: '',
      jurisdiction: '',
      document_title: 'Supplier Agreement',
      external_parties: [{ legalName: 'Buyer' }],
      tcv_amount: 92500,
      start_date: '2026-04-01',
      reminder_enabled: true,
      reminder_days_before_end: 60,
    });

    expect(flagged.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        'signature_status',
        'payment_type',
        'billing_frequency_type',
        'periodicity',
        'notice_period',
        'jurisdiction',
      ]),
    );
  });

  it('ignores ownership fields and real classification warnings only when present', () => {
    const flagged = getFieldsNeedingAttention({
      document_classification: 'contract',
      document_classification_warning: 'Looks like a purchase order',
      contract_owner_user_ids: [],
      access_group_ids: [],
      document_title: 'Supplier Agreement',
      external_parties: [{ legalName: 'Buyer' }],
      tcv_amount: 92500,
      payment_type: 'fixed_price',
      billing_frequency_type: 'one_off',
      periodicity: 'on_delivery',
      jurisdiction: 'Switzerland',
      currency: 'CHF',
      start_date: '2026-04-01',
      notice_period: '90 days',
      signature_status: 'signed',
      signature_date: '2026-04-01',
      reminder_enabled: true,
      reminder_days_before_end: 60,
    });

    expect(flagged.map((field) => field.key)).toEqual(['document_classification_warning']);
  });

  it('does not flag filled warning-severity fields (currency, reminder days, owners)', () => {
    const metadata = {
      document_title: 'MSA',
      document_classification: 'contract',
      external_parties: [{ legalName: 'Buyer' }],
      tcv_amount: 1000,
      payment_type: 'fixed_price' as const,
      billing_frequency_type: 'one_off' as const,
      periodicity: 'on_delivery' as const,
      currency: 'CHF',
      signature_status: 'unsigned' as const,
      signature_required_flag: false,
      start_date: '2026-01-01',
      reminder_enabled: true,
      reminder_days_before_end: 60,
      notice_period: '30 days',
      jurisdiction: 'Switzerland',
      contract_owner_user_ids: [],
      access_group_ids: [],
    };
    expect(getFieldsNeedingAttention(metadata).map((field) => field.key)).toEqual([]);
  });

  it('does not treat mid-range AI confidence on a filled field as a warning', () => {
    const titleField = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'document_title')!;
    expect(fieldNeedsAttention(titleField, {
      document_title: 'Supplier Agreement',
      _field_confidence: { document_title: { value: 0.72, needsVerification: true, message: 'Low confidence - please verify' } },
    })).toBe(false);
  });

  it('flags only very low confidence on a filled field', () => {
    const titleField = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'document_title')!;
    expect(fieldNeedsAttention(titleField, {
      document_title: 'Supplier Agreement',
      _field_confidence: { document_title: { value: 0.32, needsVerification: true } },
    })).toBe(true);
  });

  it('does not flag TCV as missing on an NDA', () => {
    const tcv = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'tcv_amount')!;
    expect(fieldNeedsAttention(tcv, { tcv_amount: undefined }, { contractType: 'NDA' })).toBe(false);
  });

  it('does not flag signature-required when the flag is false', () => {
    const flag = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'signature_required_flag')!;
    expect(fieldNeedsAttention(flag, { signature_required_flag: false, signature_status: 'unknown' })).toBe(false);
  });

  it('does not flag reminder lead time when reminders are disabled', () => {
    const days = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'reminder_days_before_end')!;
    expect(fieldNeedsAttention(days, { reminder_enabled: false, reminder_days_before_end: undefined })).toBe(false);
  });

  it('flags reminder lead time only when reminders are on and the value is missing', () => {
    const days = CONTRACT_METADATA_FIELDS.find((field) => field.key === 'reminder_days_before_end')!;
    expect(fieldNeedsAttention(days, { reminder_enabled: true, reminder_days_before_end: undefined })).toBe(true);
    expect(fieldNeedsAttention(days, { reminder_enabled: true, reminder_days_before_end: 60 })).toBe(false);
  });
});
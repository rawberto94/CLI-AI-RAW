import { describe, expect, it } from 'vitest';

import { getFieldsNeedingAttention } from '../contract-metadata-schema';

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
});
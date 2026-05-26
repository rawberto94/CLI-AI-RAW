import { describe, expect, it } from 'vitest';

import {
  buildUploadMetadataReviewFields,
  createUploadMetadataReviewDraft,
  mergeReviewedParties,
  unwrapUploadMetadataReviewPayload,
} from '../upload-metadata-review';

describe('upload metadata review helpers', () => {
  it('prompts for title when the extracted title matches the uploaded file name', () => {
    const fields = buildUploadMetadataReviewFields(
      {
        metadata: {
          document_title: 'msa-final.pdf',
          document_classification: 'contract',
          document_classification_confidence: 0.95,
          start_date: '2026-05-01',
          end_date: '2027-05-01',
          tcv_amount: 125000,
          currency: 'USD',
          jurisdiction: 'Delaware',
          _field_confidence: {
            document_title: { value: 0.93 },
            start_date: { value: 0.95 },
            end_date: { value: 0.94 },
            tcv_amount: { value: 0.92 },
            currency: { value: 0.98 },
            jurisdiction: { value: 0.91 },
          },
        },
        data: {
          contractType: 'MSA',
          clientName: 'Buyer Corp',
          supplierName: 'Seller LLC',
        },
      },
      'msa-final.pdf',
    );

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      key: 'document_title',
      reason: 'title-review',
    });
  });

  it('returns missing and low-confidence metadata fields for review', () => {
    const fields = buildUploadMetadataReviewFields(
      {
        metadata: {
          document_title: 'Master Services Agreement',
          document_classification: 'contract',
          document_classification_confidence: 0.62,
          start_date: '2026-05-01',
          end_date: '',
          jurisdiction: 'Delaware',
          _field_confidence: {
            start_date: { value: 0.61 },
            jurisdiction: { value: 0.94 },
          },
        },
        data: {
          clientName: null,
          supplierName: 'Acme Services',
        },
      },
      'msa-final.pdf',
    );

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'document_classification', reason: 'low-confidence' }),
        expect.objectContaining({ key: 'contractType', reason: 'missing' }),
        expect.objectContaining({ key: 'clientName', reason: 'missing' }),
        expect.objectContaining({ key: 'start_date', reason: 'low-confidence' }),
        expect.objectContaining({ key: 'end_date', reason: 'missing' }),
        expect.objectContaining({ key: 'tcv_amount', reason: 'missing' }),
        expect.objectContaining({ key: 'currency', reason: 'missing' }),
      ]),
    );
  });

  it('builds a review draft from party fallbacks', () => {
    const draft = createUploadMetadataReviewDraft(
      {
        metadata: {
          document_classification: 'contract',
          external_parties: [
            { legalName: 'Buyer Corp', role: 'Client' },
            { legalName: 'Seller LLC', role: 'Service Provider' },
          ],
        },
        data: {
          contractType: 'MSA',
        },
      },
      'buyer-v-seller.pdf',
    );

    expect(draft.document_classification).toBe('contract');
    expect(draft.contractType).toBe('MSA');
    expect(draft.clientName).toBe('Buyer Corp');
    expect(draft.supplierName).toBe('Seller LLC');
    expect(draft.document_title).toBe('buyer-v-seller.pdf');
  });

  it('does not ask for contract type when the document classification is non-contract', () => {
    const fields = buildUploadMetadataReviewFields(
      {
        metadata: {
          document_title: 'Invoice 1042',
          document_classification: 'invoice',
          document_classification_confidence: 0.95,
          currency: 'USD',
          tcv_amount: 500,
          jurisdiction: 'Delaware',
          start_date: '2026-05-01',
          end_date: '2026-05-31',
        },
        data: {
          contractType: 'UNKNOWN',
          clientName: 'Buyer Corp',
          supplierName: 'Seller LLC',
        },
      },
      'invoice-1042.pdf',
    );

    expect(fields.find((field) => field.key === 'contractType')).toBeUndefined();
  });

  it('merges reviewed party names without dropping unrelated parties', () => {
    const merged = mergeReviewedParties(
      [
        { legalName: 'Old Client', role: 'Client', note: 'keep me' },
        { legalName: 'Auditor Inc', role: 'Auditor' },
      ],
      'New Client',
      'New Supplier',
    );

    expect(merged).toEqual([
      { legalName: 'New Client', role: 'Client', note: 'keep me' },
      { legalName: 'Auditor Inc', role: 'Auditor' },
      { legalName: 'New Supplier', role: 'Service Provider' },
    ]);
  });

  it('preserves metadata when unwrapping nested API success envelopes', () => {
    const payload = unwrapUploadMetadataReviewPayload({
      success: true,
      data: {
        success: true,
        metadata: {
          document_classification: 'contract',
          external_parties: [
            { legalName: 'Alpine Retail AG', role: 'Client' },
          ],
        },
        data: {
          contractType: 'SUPPLY',
          clientName: 'Alpine Retail AG',
        },
      },
    });

    expect(payload.metadata?.document_classification).toBe('contract');
    expect(payload.metadata?.external_parties?.[0]?.legalName).toBe('Alpine Retail AG');
    expect(payload.data?.contractType).toBe('SUPPLY');
    expect(payload.data?.clientName).toBe('Alpine Retail AG');
  });
});
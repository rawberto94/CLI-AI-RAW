import { describe, expect, it } from 'vitest';

import {
  BASE_REQUIRED_ISSUE_KEYS,
  contractTypesExemptFromIssue,
  exemptionsForType,
  isFieldRequired,
  requiredIssueKeysForType,
} from '../metadata-requirements';

describe('metadata-requirements', () => {
  describe('isFieldRequired', () => {
    it('requires value-related fields for standard contract types', () => {
      expect(isFieldRequired('tcv_amount', 'Service Agreement')).toBe(true);
      expect(isFieldRequired('currency', 'Service Agreement')).toBe(true);
    });

    it('exempts value and billing fields for NDAs (both spellings)', () => {
      for (const type of ['NDA', 'Non-Disclosure Agreement']) {
        expect(isFieldRequired('tcv_amount', type)).toBe(false);
        expect(isFieldRequired('currency', type)).toBe(false);
        expect(isFieldRequired('payment_type', type)).toBe(false);
        expect(isFieldRequired('billing_frequency_type', type)).toBe(false);
        // Non-exempted fields stay required
        expect(isFieldRequired('document_title', type)).toBe(true);
        expect(isFieldRequired('external_parties', type)).toBe(true);
      }
    });

    it('matches contract types case-insensitively and punctuation-tolerantly', () => {
      expect(isFieldRequired('tcv_amount', 'nda')).toBe(false);
      expect(isFieldRequired('tcv_amount', 'non disclosure agreement')).toBe(false);
      expect(isFieldRequired('tcv_amount', 'Partnership Agreement')).toBe(false);
      // Partnership keeps billing fields required
      expect(isFieldRequired('payment_type', 'Partnership Agreement')).toBe(true);
    });

    it('falls back to the default rule set for unknown or null types', () => {
      expect(isFieldRequired('tcv_amount', null)).toBe(true);
      expect(isFieldRequired('tcv_amount', undefined)).toBe(true);
      expect(isFieldRequired('tcv_amount', 'Something Else')).toBe(true);
    });
  });

  describe('requiredIssueKeysForType', () => {
    it('returns the full base set for standard types', () => {
      const keys = requiredIssueKeysForType('Service Agreement');
      expect(keys.size).toBe(BASE_REQUIRED_ISSUE_KEYS.length);
      expect(keys.has('missing-value')).toBe(true);
    });

    it('drops missing-value for NDAs, shrinking the denominator', () => {
      const keys = requiredIssueKeysForType('NDA');
      expect(keys.size).toBe(BASE_REQUIRED_ISSUE_KEYS.length - 1);
      expect(keys.has('missing-value')).toBe(false);
      expect(keys.has('missing-party')).toBe(true);
    });

    it('returns the full base set for null types', () => {
      expect(requiredIssueKeysForType(null).size).toBe(BASE_REQUIRED_ISSUE_KEYS.length);
    });
  });

  describe('contractTypesExemptFromIssue', () => {
    it('lists the canonical type names exempt from missing-value', () => {
      expect(contractTypesExemptFromIssue('missing-value')).toEqual([
        'NDA',
        'Non-Disclosure Agreement',
        'Partnership Agreement',
      ]);
    });

    it('returns an empty list for issues with no exemptions', () => {
      expect(contractTypesExemptFromIssue('missing-party')).toEqual([]);
    });
  });

  describe('exemptionsForType', () => {
    it('returns an empty set for unknown types', () => {
      expect(exemptionsForType('Unknown Type').size).toBe(0);
    });
  });
});

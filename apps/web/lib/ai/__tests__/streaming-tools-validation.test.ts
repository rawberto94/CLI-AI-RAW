/**
 * Unit Tests for Streaming Tool Args Validation
 * Tests Zod validation schemas in /lib/ai/tool-validation.ts
 * 
 * Tests the exported `validateToolArgs` function directly from
 * the extracted module to avoid dynamic import issues.
 */
import { describe, it, expect } from 'vitest';

import { validateToolArgs } from '@/lib/ai/tool-validation';

describe('Tool Args Validation', () => {

  describe('update_contract validation', () => {
    it('rejects invalid contractId (not UUID)', () => {
      const result = validateToolArgs('update_contract', {
        contractId: 'not-a-uuid',
        field: 'status',
        value: 'ACTIVE',
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('UUID');
      }
    });

    it('rejects disallowed field names', () => {
      const result = validateToolArgs('update_contract', {
        contractId: '00000000-0000-0000-0000-000000000001',
        field: 'password',
        value: 'hacked',
      });
      expect(result.valid).toBe(false);
    });

    it('accepts valid update_contract args', () => {
      const result = validateToolArgs('update_contract', {
        contractId: '00000000-0000-0000-0000-000000000001',
        field: 'status',
        value: 'ACTIVE',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty value', () => {
      const result = validateToolArgs('update_contract', {
        contractId: '00000000-0000-0000-0000-000000000001',
        field: 'status',
        value: '',
      });
      expect(result.valid).toBe(false);
    });

    it('allows all permitted field names', () => {
      const allowedFields = [
        'status', 'totalValue', 'effectiveDate', 'expirationDate',
        'supplierName', 'clientName', 'category', 'contractTitle',
      ];
      for (const field of allowedFields) {
        const result = validateToolArgs('update_contract', {
          contractId: '00000000-0000-0000-0000-000000000001',
          field,
          value: 'test',
        });
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('create_contract validation', () => {
    it('rejects missing title', () => {
      const result = validateToolArgs('create_contract', {});
      expect(result.valid).toBe(false);
    });

    it('rejects title exceeding max length', () => {
      const result = validateToolArgs('create_contract', {
        title: 'x'.repeat(501),
      });
      expect(result.valid).toBe(false);
    });

    it('accepts valid create_contract args', () => {
      const result = validateToolArgs('create_contract', {
        title: 'New Service Agreement',
        supplierName: 'Acme Corp',
        contractType: 'MSA',
      });
      expect(result.valid).toBe(true);
    });

    it('validates totalValue as non-negative number', () => {
      const neg = validateToolArgs('create_contract', {
        title: 'Test',
        totalValue: -100,
      });
      expect(neg.valid).toBe(false);

      const pos = validateToolArgs('create_contract', {
        title: 'Test',
        totalValue: 50000,
      });
      expect(pos.valid).toBe(true);
    });
  });

  describe('search_contracts validation', () => {
    it('rejects empty query', () => {
      const result = validateToolArgs('search_contracts', { query: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects query exceeding 500 chars', () => {
      const result = validateToolArgs('search_contracts', { query: 'x'.repeat(501) });
      expect(result.valid).toBe(false);
    });

    it('accepts valid search query', () => {
      const result = validateToolArgs('search_contracts', {
        query: 'office lease',
        limit: 5,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects limit > 50', () => {
      const result = validateToolArgs('search_contracts', {
        query: 'test',
        limit: 100,
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('get_contract_details validation', () => {
    it('rejects non-UUID contractId', () => {
      const result = validateToolArgs('get_contract_details', { contractId: 'abc' });
      expect(result.valid).toBe(false);
    });

    it('accepts valid UUID', () => {
      const result = validateToolArgs('get_contract_details', {
        contractId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('navigate_to_page validation', () => {
    it('accepts page string', () => {
      const result = validateToolArgs('navigate_to_page', { page: 'dashboard' });
      expect(result.valid).toBe(true);
    });

    it('rejects empty page', () => {
      const result = validateToolArgs('navigate_to_page', { page: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid optional contractId', () => {
      const result = validateToolArgs('navigate_to_page', {
        page: 'contracts',
        contractId: 'not-uuid',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('rate_response validation', () => {
    it('rejects rating out of range', () => {
      const result = validateToolArgs('rate_response', {
        messageId: 'msg-1',
        rating: 10,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects rating below 1', () => {
      const result = validateToolArgs('rate_response', {
        messageId: 'msg-1',
        rating: 0,
      });
      expect(result.valid).toBe(false);
    });

    it('accepts valid rating', () => {
      const result = validateToolArgs('rate_response', {
        messageId: 'msg-1',
        rating: 4,
        feedback: 'Great response',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects feedback exceeding 2000 chars', () => {
      const result = validateToolArgs('rate_response', {
        messageId: 'msg-1',
        rating: 4,
        feedback: 'x'.repeat(2001),
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('approve_or_reject_step validation', () => {
    it('rejects non-UUID stepId', () => {
      const result = validateToolArgs('approve_or_reject_step', {
        stepId: 'invalid',
        action: 'approve',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects invalid action', () => {
      const result = validateToolArgs('approve_or_reject_step', {
        stepId: '00000000-0000-0000-0000-000000000001',
        action: 'delete',
      });
      expect(result.valid).toBe(false);
    });

    it('accepts valid approve action', () => {
      const result = validateToolArgs('approve_or_reject_step', {
        stepId: '00000000-0000-0000-0000-000000000001',
        action: 'approve',
        comment: 'Looks good',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('unknown tools passthrough', () => {
    it('passes through for tools without explicit schema', () => {
      const result = validateToolArgs('list_expiring_contracts', { days: 30 });
      expect(result.valid).toBe(true);
    });

    it('passes through for completely unknown tools', () => {
      const result = validateToolArgs('nonexistent_tool', { anything: 'goes' });
      expect(result.valid).toBe(true);
    });
  });
});

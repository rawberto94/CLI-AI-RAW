/**
 * Unit Tests for Validation Schemas
 * Tests for lib/validation/schemas.ts
 *
 * Rewritten for Vitest (no @jest/globals).
 * Fixed to match actual schema exports and field shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  signupSchema,
  contractCreateSchema,
  rateCardCreateSchema,
  roleRateSchema,
  tagCreateSchema,
  commentSchema,
  shareSchema,
  approvalRequestSchema,
  paginationSchema,
  fileUploadSchema,
} from '@/lib/validation/schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('should validate correct signup data', () => {
      const result = signupSchema.safeParse({
        name: 'John Doe',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        terms: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const result = signupSchema.safeParse({
        name: 'John Doe',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass456!',
        terms: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('match');
      }
    });

    it('should reject weak password', () => {
      const result = signupSchema.safeParse({
        name: 'John Doe',
        email: 'newuser@example.com',
        password: 'weakpass',
        confirmPassword: 'weakpass',
        terms: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject when terms not accepted', () => {
      const result = signupSchema.safeParse({
        name: 'John Doe',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        terms: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('contractCreateSchema', () => {
    it('should validate correct contract data', () => {
      const result = contractCreateSchema.safeParse({
        title: 'Service Agreement 2024',
        client: 'Acme Corp',
        supplier: 'Tech Services Inc',
        contractType: 'sow',
        value: 50000,
        currency: 'USD',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should require title, client, supplier, contractType', () => {
      // Missing required fields
      const result = contractCreateSchema.safeParse({
        title: 'Basic Contract',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty title', () => {
      const result = contractCreateSchema.safeParse({
        title: '',
        client: 'Client',
        supplier: 'Supplier',
        contractType: 'msa',
      });
      expect(result.success).toBe(false);
    });

    it('should reject very long title', () => {
      const result = contractCreateSchema.safeParse({
        title: 'A'.repeat(300),
        client: 'Client',
        supplier: 'Supplier',
        contractType: 'msa',
      });
      expect(result.success).toBe(false);
    });

    it('should reject end date before start date', () => {
      const result = contractCreateSchema.safeParse({
        title: 'Test Contract',
        client: 'Client',
        supplier: 'Supplier',
        contractType: 'nda',
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should validate contractType enum', () => {
      const validTypes = ['msa', 'sow', 'nda', 'amendment', 'other'];
      validTypes.forEach(contractType => {
        const result = contractCreateSchema.safeParse({
          title: 'Test',
          client: 'Client',
          supplier: 'Supplier',
          contractType,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('rateCardCreateSchema', () => {
    it('should validate correct rate card data', () => {
      const result = rateCardCreateSchema.safeParse({
        name: 'IT Services Rate Card',
        supplierName: 'Tech Provider',
        clientName: 'Acme Corp',
        currency: 'USD',
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
        roles: [
          { role: 'Senior Developer', dailyRate: 1200 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = rateCardCreateSchema.safeParse({
        name: '',
        supplierName: 'Supplier',
        clientName: 'Client',
        roles: [{ role: 'Dev', dailyRate: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject validTo before validFrom', () => {
      const result = rateCardCreateSchema.safeParse({
        name: 'Test Rate Card',
        supplierName: 'Supplier',
        clientName: 'Client',
        validFrom: '2024-12-31',
        validTo: '2024-01-01',
        roles: [{ role: 'Dev', dailyRate: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it('should require at least one role', () => {
      const result = rateCardCreateSchema.safeParse({
        name: 'Test',
        supplierName: 'Supplier',
        clientName: 'Client',
        roles: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('roleRateSchema', () => {
    it('should validate correct entry data', () => {
      const result = roleRateSchema.safeParse({
        role: 'Senior Developer',
        dailyRate: 1200,
        hourlyRate: 150,
        level: 'senior',
        location: 'Remote',
      });
      expect(result.success).toBe(true);
    });

    it('should require role name and dailyRate', () => {
      const result = roleRateSchema.safeParse({
        role: 'Developer',
      });
      expect(result.success).toBe(false);
    });

    it('should require positive dailyRate', () => {
      const result = roleRateSchema.safeParse({
        role: 'Developer',
        dailyRate: -10,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tagCreateSchema', () => {
    it('should validate correct tag data', () => {
      const result = tagCreateSchema.safeParse({
        name: 'urgent',
        color: '#FF0000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty tag name', () => {
      const result = tagCreateSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional color', () => {
      const result = tagCreateSchema.safeParse({
        name: 'priority',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('commentSchema', () => {
    it('should validate correct comment data', () => {
      const result = commentSchema.safeParse({
        content: 'This is a helpful comment.',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = commentSchema.safeParse({
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional parentId for threads', () => {
      const result = commentSchema.safeParse({
        content: 'Reply to comment',
        // parentId is a UUID
        parentId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shareSchema', () => {
    it('should validate correct share data', () => {
      const result = shareSchema.safeParse({
        emails: ['colleague@example.com'],
        permission: 'view',
        expiresAt: '2024-12-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate all permission types', () => {
      const permissions = ['view', 'comment', 'edit'];
      permissions.forEach(permission => {
        const result = shareSchema.safeParse({
          emails: ['user@example.com'],
          permission,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid permission', () => {
      const result = shareSchema.safeParse({
        emails: ['user@example.com'],
        permission: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should require at least one email', () => {
      const result = shareSchema.safeParse({
        emails: [],
        permission: 'view',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('approvalRequestSchema', () => {
    it('should validate correct approval request', () => {
      const result = approvalRequestSchema.safeParse({
        approvers: [
          { email: 'approver1@example.com' },
          { email: 'approver2@example.com' },
        ],
        notes: 'Please review and approve this contract.',
        dueDate: '2024-02-01T17:00:00Z',
        urgency: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one approver', () => {
      const result = approvalRequestSchema.safeParse({
        approvers: [],
        notes: 'Please review',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate correct pagination params', () => {
      const result = paginationSchema.safeParse({
        page: 1,
        pageSize: 20,
      });
      expect(result.success).toBe(true);
    });

    it('should apply defaults for missing fields', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({
        page: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize greater than 100', () => {
      const result = paginationSchema.safeParse({
        pageSize: 200,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('fileUploadSchema', () => {
    it('should validate file upload with allowed type', () => {
      const result = fileUploadSchema.safeParse({
        name: 'contract.pdf',
        type: 'application/pdf',
        size: 1024 * 1024, // 1MB
      });
      expect(result.success).toBe(true);
    });

    it('should reject file too large', () => {
      const result = fileUploadSchema.safeParse({
        name: 'huge-file.pdf',
        type: 'application/pdf',
        size: 100 * 1024 * 1024, // 100MB
      });
      expect(result.success).toBe(false);
    });

    it('should reject disallowed mime type', () => {
      const result = fileUploadSchema.safeParse({
        name: 'script.exe',
        type: 'application/x-msdownload',
        size: 1024,
      });
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Unit Tests for Validation Schemas
 * Tests for lib/validation/schemas.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
  loginSchema,
  signupSchema,
  contractCreateSchema,
  rateCardCreateSchema,
  rateCardEntrySchema,
  tagCreateSchema,
  commentSchema,
  shareSchema,
  approvalRequestSchema,
  settingsSchema,
  paginationSchema,
  searchQuerySchema,
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

    it('should reject short password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('should validate correct signup data', () => {
      const result = signupSchema.safeParse({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const result = signupSchema.safeParse({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass456!',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('match');
      }
    });

    it('should reject weak password', () => {
      const result = signupSchema.safeParse({
        email: 'newuser@example.com',
        password: 'weakpass',
        confirmPassword: 'weakpass',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('contractCreateSchema', () => {
    it('should validate correct contract data', () => {
      const result = contractCreateSchema.safeParse({
        title: 'Service Agreement 2024',
        vendor: 'Acme Corp',
        status: 'draft',
        type: 'service',
        category: 'IT',
        value: 50000,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional fields', () => {
      const result = contractCreateSchema.safeParse({
        title: 'Basic Contract',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = contractCreateSchema.safeParse({
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject very long title', () => {
      const result = contractCreateSchema.safeParse({
        title: 'A'.repeat(300),
      });
      expect(result.success).toBe(false);
    });

    it('should reject end date before start date', () => {
      const result = contractCreateSchema.safeParse({
        title: 'Test Contract',
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rateCardCreateSchema', () => {
    it('should validate correct rate card data', () => {
      const result = rateCardCreateSchema.safeParse({
        name: 'IT Services Rate Card',
        vendor: 'Tech Provider',
        currency: 'USD',
        effectiveDate: '2024-01-01',
        expirationDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = rateCardCreateSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject expiration before effective date', () => {
      const result = rateCardCreateSchema.safeParse({
        name: 'Test Rate Card',
        effectiveDate: '2024-12-31',
        expirationDate: '2024-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('rateCardEntrySchema', () => {
    it('should validate correct entry data', () => {
      const result = rateCardEntrySchema.safeParse({
        roleTitle: 'Senior Developer',
        hourlyRate: 150,
        dailyRate: 1200,
        monthlyRate: 24000,
        currency: 'USD',
        level: 'senior',
        location: 'Remote',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative rates', () => {
      const result = rateCardEntrySchema.safeParse({
        roleTitle: 'Developer',
        hourlyRate: -10,
      });
      expect(result.success).toBe(false);
    });

    it('should validate minimum fields', () => {
      const result = rateCardEntrySchema.safeParse({
        roleTitle: 'Developer',
      });
      expect(result.success).toBe(true);
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
        resourceType: 'contract',
        resourceId: 'contract-123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = commentSchema.safeParse({
        content: '',
        resourceType: 'contract',
        resourceId: 'contract-123',
      });
      expect(result.success).toBe(false);
    });

    it('should allow optional parentId for threads', () => {
      const result = commentSchema.safeParse({
        content: 'Reply to comment',
        resourceType: 'contract',
        resourceId: 'contract-123',
        parentId: 'comment-parent-1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shareSchema', () => {
    it('should validate correct share data', () => {
      const result = shareSchema.safeParse({
        email: 'colleague@example.com',
        permission: 'view',
        expiresAt: '2024-12-31T23:59:59Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate all permission types', () => {
      const permissions = ['view', 'comment', 'edit', 'admin'];
      permissions.forEach(permission => {
        const result = shareSchema.safeParse({
          email: 'user@example.com',
          permission,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid permission', () => {
      const result = shareSchema.safeParse({
        email: 'user@example.com',
        permission: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('approvalRequestSchema', () => {
    it('should validate correct approval request', () => {
      const result = approvalRequestSchema.safeParse({
        approvers: ['approver1@example.com', 'approver2@example.com'],
        message: 'Please review and approve this contract.',
        deadline: '2024-02-01T17:00:00Z',
        requireAllApprovers: true,
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one approver', () => {
      const result = approvalRequestSchema.safeParse({
        approvers: [],
        message: 'Please review',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('settingsSchema', () => {
    it('should validate complete settings', () => {
      const result = settingsSchema.safeParse({
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          push: true,
          inApp: true,
          digest: 'daily',
        },
        display: {
          compactMode: false,
          showPreviews: true,
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          currency: 'USD',
        },
        privacy: {
          profileVisibility: 'team',
          activityVisibility: 'team',
          showOnlineStatus: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should allow partial settings', () => {
      const result = settingsSchema.safeParse({
        theme: 'light',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid theme', () => {
      const result = settingsSchema.safeParse({
        theme: 'rainbow',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate correct pagination params', () => {
      const result = paginationSchema.safeParse({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result.success).toBe(true);
    });

    it('should apply defaults for missing fields', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({
        page: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = paginationSchema.safeParse({
        limit: 200,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchQuerySchema', () => {
    it('should validate search query', () => {
      const result = searchQuerySchema.safeParse({
        q: 'contract vendor services',
        filters: {
          status: 'active',
          type: 'service',
        },
        facets: ['status', 'vendor'],
        highlight: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = searchQuerySchema.safeParse({
        q: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('fileUploadSchema', () => {
    it('should validate file upload with allowed type', () => {
      const result = fileUploadSchema.safeParse({
        filename: 'contract.pdf',
        mimeType: 'application/pdf',
        size: 1024 * 1024, // 1MB
      });
      expect(result.success).toBe(true);
    });

    it('should reject file too large', () => {
      const result = fileUploadSchema.safeParse({
        filename: 'huge-file.pdf',
        mimeType: 'application/pdf',
        size: 100 * 1024 * 1024, // 100MB
      });
      expect(result.success).toBe(false);
    });

    it('should reject disallowed mime type', () => {
      const result = fileUploadSchema.safeParse({
        filename: 'script.exe',
        mimeType: 'application/x-msdownload',
        size: 1024,
      });
      expect(result.success).toBe(false);
    });
  });
});

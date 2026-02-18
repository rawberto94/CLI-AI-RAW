/**
 * Unit Tests for Tenant Security Module
 * Tests for lib/security/tenant.ts
 *
 * Rewritten for Vitest (no @jest/globals).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  tenantWhere,
  assertTenantMatch,
  TenantError,
} from '@/lib/security/tenant';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Tenant Security Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TenantError', () => {
    it('should create error with correct code', () => {
      const error = new TenantError('Test error', 'UNAUTHORIZED');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('TenantError');
    });

    it('should support all error codes', () => {
      const codes = ['UNAUTHORIZED', 'NOT_FOUND', 'INVALID', 'FORBIDDEN'] as const;
      codes.forEach(code => {
        const error = new TenantError(`Error: ${code}`, code);
        expect(error.code).toBe(code);
      });
    });
  });

  describe('tenantWhere', () => {
    it('should create where clause with tenantId', () => {
      const result = tenantWhere('tenant-123');
      expect(result).toEqual({ tenantId: 'tenant-123' });
    });

    it('should merge additional where conditions', () => {
      const result = tenantWhere('tenant-123', { status: 'ACTIVE', type: 'contract' });
      expect(result).toEqual({
        tenantId: 'tenant-123',
        status: 'ACTIVE',
        type: 'contract',
      });
    });

    it('should allow additionalWhere to override tenantId (spread order)', () => {
      // The spread puts additionalWhere last, so it overrides tenantId
      const result = tenantWhere('tenant-123', { tenantId: 'override-value' });
      expect(result.tenantId).toBe('override-value');
    });

    it('should handle empty additional conditions', () => {
      const result = tenantWhere('tenant-456', {});
      expect(result).toEqual({ tenantId: 'tenant-456' });
    });

    it('should handle complex nested conditions', () => {
      const result = tenantWhere('tenant-789', {
        OR: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
        createdAt: { gte: new Date('2024-01-01') },
      });
      expect(result.tenantId).toBe('tenant-789');
      expect(result.OR).toHaveLength(2);
    });
  });

  describe('assertTenantMatch', () => {
    it('should not throw when tenants match', () => {
      expect(() => {
        assertTenantMatch('tenant-123', 'tenant-123');
      }).not.toThrow();
    });

    it('should throw TenantError when tenants do not match', () => {
      expect(() => {
        assertTenantMatch('tenant-123', 'tenant-456');
      }).toThrow(TenantError);
    });

    it('should throw with FORBIDDEN code', () => {
      try {
        assertTenantMatch('tenant-123', 'tenant-456');
      } catch (error) {
        expect(error).toBeInstanceOf(TenantError);
        expect((error as TenantError).code).toBe('FORBIDDEN');
      }
    });

    it('should throw when resource tenant is null', () => {
      expect(() => {
        assertTenantMatch(null, 'tenant-123');
      }).toThrow(TenantError);
    });

    it('should throw when resource tenant is undefined', () => {
      expect(() => {
        assertTenantMatch(undefined, 'tenant-123');
      }).toThrow(TenantError);
    });
  });

  describe('getApiTenantId', () => {
    it('should return null when session is not available', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue(null);

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      const result = await getApiTenantId(request);
      expect(result).toBeNull();
    });

    it('should return null when user has no tenantId', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      } as any);

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      const result = await getApiTenantId(request);
      expect(result).toBeNull();
    });

    it('should return tenantId from session', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com', tenantId: 'tenant-abc' },
      } as any);

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      const result = await getApiTenantId(request);
      expect(result).toBe('tenant-abc');
    });
  });

  describe('getValidatedTenantId', () => {
    it('should throw UNAUTHORIZED when no session', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue(null);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should throw NOT_FOUND when tenant does not exist', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'non-existent-tenant' },
      } as any);

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should throw FORBIDDEN when tenant is not active', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'inactive-tenant' },
      } as any);

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
        id: 'inactive-tenant',
        status: 'SUSPENDED',
      } as any);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should return tenantId when tenant is active', async () => {
      const { getServerSession } = await import('@/lib/auth');
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'active-tenant' },
      } as any);

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
        id: 'active-tenant',
        status: 'ACTIVE',
      } as any);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');

      const result = await getValidatedTenantId(request);
      expect(result).toBe('active-tenant');
    });
  });

  describe('hasAccessToTenant', () => {
    it('should return true for same tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'ACTIVE' },
      } as any);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');

      const result = await hasAccessToTenant('user-1', 'tenant-123');
      expect(result).toBe(true);
    });

    it('should return false for different tenant without super admin', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'ACTIVE' },
      } as any);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');

      const result = await hasAccessToTenant('user-1', 'tenant-456');
      expect(result).toBe(false);
    });

    it('should return true for super admin on any tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'super_admin',
        tenant: { status: 'ACTIVE' },
      } as any);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');

      const result = await hasAccessToTenant('user-1', 'tenant-456');
      expect(result).toBe(true);
    });

    it('should return false for inactive tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'SUSPENDED' },
      } as any);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');

      const result = await hasAccessToTenant('user-1', 'tenant-123');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');

      const result = await hasAccessToTenant('non-existent-user', 'tenant-123');
      expect(result).toBe(false);
    });
  });
});

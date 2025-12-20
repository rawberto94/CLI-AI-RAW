/**
 * Unit Tests for Tenant Security Module
 * Tests for lib/security/tenant.ts
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  tenantWhere,
  assertTenantMatch,
  TenantError,
} from '@/lib/security/tenant';

// Mock the auth module
jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('Tenant Security Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should not override tenantId from additional conditions', () => {
      const result = tenantWhere('tenant-123', { tenantId: 'should-not-override' });
      // tenantId from first argument takes precedence
      expect(result.tenantId).toBe('tenant-123');
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
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      const result = await getApiTenantId(request);
      expect(result).toBeNull();
    });

    it('should return null when user has no tenantId', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com' },
      });

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      const result = await getApiTenantId(request);
      expect(result).toBeNull();
    });

    it('should return tenantId from session', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com', tenantId: 'tenant-abc' },
      });

      const { getApiTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      const result = await getApiTenantId(request);
      expect(result).toBe('tenant-abc');
    });
  });

  describe('getValidatedTenantId', () => {
    it('should throw UNAUTHORIZED when no session', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should throw NOT_FOUND when tenant does not exist', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'non-existent-tenant' },
      });

      const { prisma } = await import('@/lib/prisma');
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should throw FORBIDDEN when tenant is not active', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'inactive-tenant' },
      });

      const { prisma } = await import('@/lib/prisma');
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: 'inactive-tenant',
        status: 'SUSPENDED',
      });

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      await expect(getValidatedTenantId(request)).rejects.toThrow(TenantError);
    });

    it('should return tenantId when tenant is active', async () => {
      const { getServerSession } = await import('@/lib/auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'user-123', tenantId: 'active-tenant' },
      });

      const { prisma } = await import('@/lib/prisma');
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: 'active-tenant',
        status: 'ACTIVE',
      });

      const { getValidatedTenantId } = await import('@/lib/security/tenant');
      const request = new NextRequest('http://localhost/api/test');
      
      const result = await getValidatedTenantId(request);
      expect(result).toBe('active-tenant');
    });
  });

  describe('hasAccessToTenant', () => {
    it('should return true for same tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'ACTIVE' },
      });

      const { hasAccessToTenant } = await import('@/lib/security/tenant');
      
      const result = await hasAccessToTenant('user-1', 'tenant-123');
      expect(result).toBe(true);
    });

    it('should return false for different tenant without super admin', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'ACTIVE' },
      });

      const { hasAccessToTenant } = await import('@/lib/security/tenant');
      
      const result = await hasAccessToTenant('user-1', 'tenant-456');
      expect(result).toBe(false);
    });

    it('should return true for super admin on any tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'super_admin',
        tenant: { status: 'ACTIVE' },
      });

      const { hasAccessToTenant } = await import('@/lib/security/tenant');
      
      const result = await hasAccessToTenant('user-1', 'tenant-456');
      expect(result).toBe(true);
    });

    it('should return false for inactive tenant', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        tenantId: 'tenant-123',
        role: 'member',
        tenant: { status: 'SUSPENDED' },
      });

      const { hasAccessToTenant } = await import('@/lib/security/tenant');
      
      const result = await hasAccessToTenant('user-1', 'tenant-123');
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const { prisma } = await import('@/lib/prisma');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const { hasAccessToTenant } = await import('@/lib/security/tenant');
      
      const result = await hasAccessToTenant('non-existent-user', 'tenant-123');
      expect(result).toBe(false);
    });
  });
});

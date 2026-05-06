import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserFindUnique,
  mockInvitationFindMany,
  mockWarn,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockInvitationFindMany: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    teamInvitation: { findMany: mockInvitationFindMany },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mockWarn,
  },
}));

import { resolveSSOSignInMapping } from '../sso-access';

describe('resolveSSOSignInMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the active existing user mapping', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
      status: 'ACTIVE',
    });

    await expect(resolveSSOSignInMapping('user@example.com')).resolves.toEqual({
      tenantId: 'tenant-1',
      role: 'admin',
    });

    expect(mockInvitationFindMany).not.toHaveBeenCalled();
  });

  it('denies inactive existing users', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'member',
      status: 'SUSPENDED',
    });

    await expect(resolveSSOSignInMapping('user@example.com')).resolves.toBeNull();
  });

  it('returns the single pending invitation mapping', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInvitationFindMany.mockResolvedValue([
      { tenantId: 'tenant-2', role: 'member' },
    ]);

    await expect(resolveSSOSignInMapping('invitee@example.com')).resolves.toEqual({
      tenantId: 'tenant-2',
      role: 'member',
    });
  });

  it('denies ambiguous invitation matches instead of choosing one arbitrarily', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockInvitationFindMany.mockResolvedValue([
      { tenantId: 'tenant-a', role: 'member' },
      { tenantId: 'tenant-b', role: 'admin' },
    ]);

    await expect(resolveSSOSignInMapping('consultant@example.com')).resolves.toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      '[Auth] Ambiguous pending invitations for SSO sign-in',
      expect.objectContaining({
        email: 'consultant@example.com',
        invitationCount: 2,
      })
    );
  });

  it('falls back to configured auto-provisioning only when no invitations exist', async () => {
    vi.stubEnv('SSO_AUTO_PROVISION', 'true');
    vi.stubEnv('SSO_DEFAULT_TENANT_ID', 'default-tenant');
    mockUserFindUnique.mockResolvedValue(null);
    mockInvitationFindMany.mockResolvedValue([]);

    await expect(resolveSSOSignInMapping('newuser@example.com')).resolves.toEqual({
      tenantId: 'default-tenant',
      role: 'member',
    });
  });
});